"""Repositories for versioned rule tables and validation runs."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from folio_db.errors import NotFoundError, ValidationError
from folio_db.models.invoices import Invoice
from folio_db.models.rules import (
    CheckFeedback,
    CheckResult,
    RuleDailyStats,
    RuleTable,
    ValidationRun,
)


class ValidationRepo:
    """Persist and fetch invoice validation runs and their check results."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def save_run(
        self,
        *,
        invoice_id: uuid.UUID,
        verdict: str,
        results: list[dict[str, Any]],
        versions: dict[str, Any],
        engine_version: str = "folio-db",
        trigger: str = "auto",
        rupee_at_risk: Decimal | None = None,
    ) -> ValidationRun:
        """Atomically save one run and its check results."""
        run = ValidationRun(
            org_id=self.org_id,
            invoice_id=invoice_id,
            engine_version=engine_version,
            rule_table_versions=versions,
            verdict=verdict,
            rupee_at_risk=rupee_at_risk,
            trigger=trigger,
        )
        self.session.add(run)
        self.session.flush()

        for item in results:
            check_id = str(item.get("check_id") or item.get("name") or item.get("id"))
            if not check_id:
                raise ValidationError("Each validation result must have a check_id", "check_id")
            self.session.add(
                CheckResult(
                    run_id=run.id,
                    check_id=check_id,
                    name=str(item.get("name") or check_id),
                    status=str(item.get("status") or "inconclusive"),
                    severity=str(item.get("severity") or "medium"),
                    kind=str(item.get("kind") or "deterministic"),
                    expected=item.get("expected"),
                    found=item.get("found"),
                    formula=item.get("formula"),
                    why_it_matters=item.get("why_it_matters"),
                    fixes=item.get("fixes"),
                    details=item.get("details"),
                )
            )
        self.session.flush()
        return run

    def latest_run_for_invoice(self, invoice_id: uuid.UUID) -> ValidationRun | None:
        stmt = (
            select(ValidationRun)
            .where(ValidationRun.org_id == self.org_id, ValidationRun.invoice_id == invoice_id)
            .order_by(ValidationRun.started_at.desc(), ValidationRun.id.desc())
            .limit(1)
        )
        return self.session.scalar(stmt)

    def history_for_invoice(self, invoice_id: uuid.UUID) -> list[ValidationRun]:
        stmt = (
            select(ValidationRun)
            .where(ValidationRun.org_id == self.org_id, ValidationRun.invoice_id == invoice_id)
            .order_by(ValidationRun.started_at.desc(), ValidationRun.id.desc())
        )
        return list(self.session.scalars(stmt).all())


class FeedbackRepo:
    """Record override feedback and summarise rule performance."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def record(
        self,
        *,
        check_result_id: str,
        user_id: uuid.UUID | None,
        feedback: str,
        note: str | None = None,
    ) -> CheckFeedback:
        if feedback not in {"confirmed", "dismissed", "accepted_with_note"}:
            raise ValidationError("Unsupported feedback value", "feedback")
        row = CheckFeedback(
            check_result_id=check_result_id,
            user_id=user_id,
            feedback=feedback,
            note=note,
        )
        self.session.add(row)
        self.session.flush()
        return row

    def dismissal_rate_per_rule(self) -> dict[str, float]:
        rows = self.session.execute(
            select(CheckFeedback.check_result_id, func.count(CheckFeedback.id))
            .where(CheckFeedback.feedback == "dismissed")
            .group_by(CheckFeedback.check_result_id)
        ).all()
        return {rule: float(count) for rule, count in rows}

    def override_rate(self) -> float:
        total = self.session.scalar(select(func.count()).select_from(CheckFeedback))
        if not total:
            return 0.0
        dismissed = self.session.scalar(
            select(func.count())
            .select_from(CheckFeedback)
            .where(CheckFeedback.feedback == "dismissed")
        )
        return float(dismissed / total)


class RuleStatsRepo:
    """Rebuild and query rollup stats for the rules monitoring page."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def rebuild(self, day: date) -> list[RuleDailyStats]:
        rows = self.session.execute(
            select(
                ValidationRun.invoice_id.label("rule_id"),
                func.count(ValidationRun.id).label("runs"),
                func.sum(
                    case(
                        (CheckResult.status == "fail", 1),
                        else_=0,
                    )
                ).label("fails"),
            )
            .join(CheckResult, CheckResult.run_id == ValidationRun.id)
            .where(
                ValidationRun.org_id == self.org_id,
                ValidationRun.started_at >= datetime.combine(day, datetime.min.time()),
                ValidationRun.started_at < datetime.combine(day, datetime.max.time()),
            )
            .group_by(ValidationRun.invoice_id)
        ).all()

        return [
            RuleDailyStats(
                org_id=self.org_id,
                rule_id=row.rule_id,
                date=day,
                runs=int(row.runs or 0),
                fails=int(row.fails or 0),
                inconclusive=0,
                confirmed=0,
                dismissed=0,
            )
            for row in rows
        ]

    def incremental_update(self, day: date) -> list[RuleDailyStats]:
        return self.rebuild(day)

    def performance_table(self) -> list[dict[str, Any]]:
        rows = self.session.scalars(
            select(RuleDailyStats)
            .where(RuleDailyStats.org_id == self.org_id)
            .order_by(RuleDailyStats.date.desc(), RuleDailyStats.rule_id)
        ).all()
        return [
            {
                "org_id": row.org_id,
                "rule_id": row.rule_id,
                "date": row.date,
                "runs": row.runs,
                "fails": row.fails,
                "inconclusive": row.inconclusive,
                "confirmed": row.confirmed,
                "dismissed": row.dismissed,
            }
            for row in rows
        ]


def find_possible_duplicates(
    session: Session,
    *,
    org_id: uuid.UUID,
    fingerprint: str | None,
    supplier: str | None,
    number_norm: str | None,
    window: int = 30,
) -> list[Invoice]:
    """Find likely duplicate invoices using the invoice fingerprint and normalized identifiers."""
    if not any([fingerprint, supplier, number_norm]):
        return []
    query = select(Invoice).where(Invoice.org_id == org_id)
    if fingerprint:
        query = query.where(Invoice.fingerprint == fingerprint)
    if supplier:
        query = query.where(Invoice.supplier_party_id.is_not(None))
    if number_norm:
        query = query.where(Invoice.number_norm == number_norm)
    return list(session.scalars(query.limit(50)).all())
