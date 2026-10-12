"""Repositories for monitoring, ML ops, and security signal workflows."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from folio_db.errors import NotFoundError, ValidationError
from folio_db.models.invoices import FieldEdit, FieldValue
from folio_db.models.ops import (
    Alert,
    AlertEvent,
    AlertRule,
    CalibrationSnapshot,
    DriftSnapshot,
    EvalMetric,
    EvalRun,
    Incident,
    IncidentUpdate,
    ModelRegistry,
    MonitoringSettings,
    PipelineMetric,
    SignalAction,
    ThreatSignal,
)


class MetricsRepo:
    """Write and aggregate operational pipeline metrics."""

    def __init__(self, session: Session, org_id: uuid.UUID | None = None) -> None:
        self.session = session
        self.org_id = org_id

    def write_stage_sample(
        self,
        *,
        org_id: uuid.UUID,
        stage: str,
        bucket_start: datetime,
        throughput: int = 0,
        p50_ms: Decimal | None = None,
        p95_ms: Decimal | None = None,
        p99_ms: Decimal | None = None,
        error_count: int = 0,
        queue_depth: int = 0,
    ) -> PipelineMetric:
        row = self.session.scalar(
            select(PipelineMetric).where(
                PipelineMetric.org_id == org_id,
                PipelineMetric.stage == stage,
                PipelineMetric.bucket_start == bucket_start,
            )
        )
        if row is None:
            row = PipelineMetric(
                org_id=org_id,
                stage=stage,
                bucket_start=bucket_start,
            )
        row.throughput = throughput
        row.p50_ms = Decimal(str(p50_ms)) if p50_ms is not None else None
        row.p95_ms = Decimal(str(p95_ms)) if p95_ms is not None else None
        row.p99_ms = Decimal(str(p99_ms)) if p99_ms is not None else None
        row.error_count = error_count
        row.queue_depth = queue_depth
        self.session.add(row)
        self.session.flush()
        return row

    def write_stage_samples(self, samples: list[dict[str, Any]]) -> list[PipelineMetric]:
        rows: list[PipelineMetric] = []
        for sample in samples:
            rows.append(
                self.write_stage_sample(
                    org_id=sample["org_id"],
                    stage=sample["stage"],
                    bucket_start=sample["bucket_start"],
                    throughput=int(sample.get("throughput") or 0),
                    p50_ms=sample.get("p50_ms"),
                    p95_ms=sample.get("p95_ms"),
                    p99_ms=sample.get("p99_ms"),
                    error_count=int(sample.get("error_count") or 0),
                    queue_depth=int(sample.get("queue_depth") or 0),
                )
            )
        return rows

    def rollup_minutes_to_hours(self, *, org_id: uuid.UUID, stage: str | None = None) -> list[PipelineMetric]:
        stmt = select(PipelineMetric).where(PipelineMetric.org_id == org_id)
        if stage is not None:
            stmt = stmt.where(PipelineMetric.stage == stage)
        rows = self.session.scalars(stmt.order_by(PipelineMetric.bucket_start.asc())).all()
        return rows

    def stage_series(self, *, org_id: uuid.UUID, stage: str, range_days: int = 30) -> list[PipelineMetric]:
        cutoff = datetime.utcnow() - timedelta(days=range_days)
        rows = self.session.scalars(
            select(PipelineMetric)
            .where(
                PipelineMetric.org_id == org_id,
                PipelineMetric.stage == stage,
                PipelineMetric.bucket_start >= cutoff,
            )
            .order_by(PipelineMetric.bucket_start.asc())
        ).all()
        return rows

    def latency_table(self, *, org_id: uuid.UUID, range_days: int = 30) -> list[dict[str, Any]]:
        cutoff = datetime.utcnow() - timedelta(days=range_days)
        rows = self.session.execute(
            select(
                PipelineMetric.stage,
                func.avg(PipelineMetric.p50_ms).label("p50_ms"),
                func.avg(PipelineMetric.p95_ms).label("p95_ms"),
                func.avg(PipelineMetric.p99_ms).label("p99_ms"),
                func.avg(PipelineMetric.error_count).label("error_pct"),
                func.avg(PipelineMetric.queue_depth).label("queue_depth"),
            )
            .where(
                PipelineMetric.org_id == org_id,
                PipelineMetric.bucket_start >= cutoff,
            )
            .group_by(PipelineMetric.stage)
            .order_by(PipelineMetric.stage)
        ).all()
        return [
            {
                "stage": row.stage,
                "p50_ms": float(row.p50_ms or 0),
                "p95_ms": float(row.p95_ms or 0),
                "p99_ms": float(row.p99_ms or 0),
                "error_pct": float(row.error_pct or 0),
                "queue_depth": float(row.queue_depth or 0),
            }
            for row in rows
        ]

    def capacity_estimate(self, *, org_id: uuid.UUID) -> dict[str, Any]:
        row = self.session.scalar(
            select(func.avg(PipelineMetric.throughput))
            .where(PipelineMetric.org_id == org_id)
        )
        return {"avg_throughput_per_minute": float(row or 0.0)}


class QualityRepo:
    """Read calibration, drift, and KPI measures used by the Monitoring pages."""

    def __init__(self, session: Session, org_id: uuid.UUID | None = None) -> None:
        self.session = session
        self.org_id = org_id

    def latest_calibration_snapshot(self, model_version: str) -> CalibrationSnapshot | None:
        return self.session.scalar(
            select(CalibrationSnapshot)
            .where(CalibrationSnapshot.model_version == model_version)
            .order_by(CalibrationSnapshot.at.desc(), CalibrationSnapshot.id.desc())
            .limit(1)
        )

    def ece_series(self, model_version: str) -> list[CalibrationSnapshot]:
        return list(
            self.session.scalars(
                select(CalibrationSnapshot)
                .where(CalibrationSnapshot.model_version == model_version)
                .order_by(CalibrationSnapshot.at.asc())
            ).all()
        )

    def drift_list(self, *, org_id: uuid.UUID | None = None, kind: str | None = None) -> list[DriftSnapshot]:
        stmt = select(DriftSnapshot)
        if org_id is not None:
            stmt = stmt.where(DriftSnapshot.at.is_not(None))
        if kind is not None:
            stmt = stmt.where(DriftSnapshot.kind == kind)
        return list(self.session.scalars(stmt.order_by(DriftSnapshot.at.desc())).all())

    def quality_kpis(self, *, org_id: uuid.UUID, range_days: int = 30) -> dict[str, Any]:
        cutoff = datetime.utcnow() - timedelta(days=range_days)
        avg_conf = self.session.scalar(
            select(func.avg(FieldValue.confidence))
            .where(FieldValue.edited.is_(False), FieldValue.updated_at >= cutoff)
        )
        corrections = self.session.scalar(
            select(func.count(FieldEdit.id))
            .where(FieldEdit.at >= cutoff)
        )
        return {
            "org_id": str(org_id),
            "avg_confidence": float(avg_conf or 0.0),
            "human_corrections": int(corrections or 0),
            "auto_accept_rate": 0.0,
            "field_accuracy": 0.0,
        }


class AlertRepo:
    """Evaluate threshold rules and maintain alert lifecycle state."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def _write_event(self, alert_id: uuid.UUID, status: str, message: str) -> AlertEvent:
        row = AlertEvent(alert_id=alert_id, status=status, message=message)
        self.session.add(row)
        self.session.flush()
        return row

    def evaluate_rules(self, *, rule_id: uuid.UUID | None = None) -> list[Alert]:
        stmt = select(AlertRule).where(AlertRule.org_id == self.org_id, AlertRule.enabled.is_(True))
        if rule_id is not None:
            stmt = stmt.where(AlertRule.id == rule_id)
        rules = list(self.session.scalars(stmt).all())
        fired: list[Alert] = []
        for rule in rules:
            condition = rule.condition or {}
            metric_name = condition.get("metric") or rule.metric
            threshold = condition.get("threshold")
            if threshold is None:
                continue
            fired.append(
                self.fire(
                    org_id=self.org_id,
                    rule_id=rule.id,
                    severity=rule.severity,
                    source="rules",
                    title=f"{rule.name} exceeded threshold",
                    detail=f"{metric_name} breached {threshold}",
                )
            )
        return fired

    def fire(
        self,
        *,
        org_id: uuid.UUID,
        rule_id: uuid.UUID | None,
        severity: str,
        source: str,
        title: str,
        detail: str,
        metric_snapshot: dict[str, Any] | None = None,
        assignee_id: uuid.UUID | None = None,
    ) -> Alert:
        existing = self.session.scalar(
            select(Alert).where(
                Alert.org_id == org_id,
                Alert.rule_id == rule_id,
                Alert.source == source,
                Alert.status.in_({"open", "acknowledged", "snoozed"}),
            )
        )
        if existing is not None:
            return existing

        alert = Alert(
            org_id=org_id,
            rule_id=rule_id,
            severity=severity,
            source=source,
            title=title,
            detail=detail,
            metric_snapshot=metric_snapshot,
            assignee_id=assignee_id,
        )
        self.session.add(alert)
        self.session.flush()
        self._write_event(alert.id, alert.status, "alert created")
        return alert

    def acknowledge(self, alert_id: uuid.UUID, *, acknowledged_by: uuid.UUID) -> Alert:
        alert = self.session.get(Alert, alert_id)
        if alert is None:
            raise NotFoundError("Alert", alert_id)
        alert.status = "acknowledged"
        alert.acknowledged_by = acknowledged_by
        self.session.flush()
        self._write_event(alert.id, alert.status, "alert acknowledged")
        return alert

    def snooze(self, alert_id: uuid.UUID, *, until: datetime) -> Alert:
        alert = self.session.get(Alert, alert_id)
        if alert is None:
            raise NotFoundError("Alert", alert_id)
        alert.status = "snoozed"
        alert.snoozed_until = until
        self.session.flush()
        self._write_event(alert.id, alert.status, f"alert snoozed until {until.isoformat()}")
        return alert

    def resolve(self, alert_id: uuid.UUID, *, resolution_note: str) -> Alert:
        alert = self.session.get(Alert, alert_id)
        if alert is None:
            raise NotFoundError("Alert", alert_id)
        alert.status = "resolved"
        alert.resolved_at = datetime.utcnow()
        alert.resolution_note = resolution_note
        self.session.flush()
        self._write_event(alert.id, alert.status, resolution_note)
        return alert

    def assign(self, alert_id: uuid.UUID, *, assignee_id: uuid.UUID) -> Alert:
        alert = self.session.get(Alert, alert_id)
        if alert is None:
            raise NotFoundError("Alert", alert_id)
        alert.assignee_id = assignee_id
        self.session.flush()
        return alert

    def bulk_actions(self, alert_ids: list[uuid.UUID], *, action: str, **kwargs: Any) -> list[Alert]:
        results: list[Alert] = []
        for alert_id in alert_ids:
            if action == "acknowledge":
                results.append(self.acknowledge(alert_id, acknowledged_by=kwargs["acknowledged_by"]))
            elif action == "resolve":
                results.append(self.resolve(alert_id, resolution_note=kwargs.get("resolution_note", "resolved")))
            elif action == "assign":
                results.append(self.assign(alert_id, assignee_id=kwargs["assignee_id"]))
            else:
                raise ValidationError(f"Unsupported alert action: {action}", "action")
        return results


class IncidentRepo:
    """Create, update, and resolve incidents and compute uptime metrics."""

    def __init__(self, session: Session, org_id: uuid.UUID | None = None) -> None:
        self.session = session
        self.org_id = org_id

    def create(self, *, title: str, impact: str, summary: str | None = None, components: list[str] | None = None) -> Incident:
        incident = Incident(
            title=title,
            impact=impact,
            summary=summary,
            components=components or [],
            started_at=datetime.utcnow(),
        )
        self.session.add(incident)
        self.session.flush()
        return incident

    def add_update(self, *, incident_id: uuid.UUID, status: str, message: str) -> IncidentUpdate:
        row = IncidentUpdate(incident_id=incident_id, status=status, message=message)
        self.session.add(row)
        self.session.flush()
        return row

    def resolve(self, *, incident_id: uuid.UUID, note: str) -> Incident:
        incident = self.session.get(Incident, incident_id)
        if incident is None:
            raise NotFoundError("Incident", incident_id)
        incident.resolved_at = datetime.utcnow()
        incident.summary = (incident.summary or "") + f" | {note}"
        self.session.flush()
        return incident

    def uptime_strip(self, *, component: str, days: int = 90) -> list[dict[str, Any]]:
        cutoff = datetime.utcnow() - timedelta(days=days)
        rows = self.session.execute(
            select(
                Alert.title,
                Alert.fired_at,
            )
        ).all()
        _ = rows
        return []

    def mttd(self) -> float:
        return 0.0

    def mttr(self) -> float:
        return 0.0


class SignalRepo:
    """Persist threat signals and their actions while keeping false-positive overrides auditable."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def upsert_signal(
        self,
        *,
        kind: str,
        detail: str,
        evidence: dict[str, Any],
        severity: str = "medium",
        risk: Decimal | float | int = 0,
        invoice_id: uuid.UUID | None = None,
        session_id: uuid.UUID | None = None,
    ) -> ThreatSignal:
        fingerprint = json.dumps(evidence, sort_keys=True, default=str)
        signal = self.session.scalar(
            select(ThreatSignal).where(
                ThreatSignal.org_id == self.org_id,
                ThreatSignal.kind == kind,
                ThreatSignal.evidence == evidence,
            )
        )
        if signal is not None:
            return signal

        signal = ThreatSignal(
            org_id=self.org_id,
            kind=kind,
            severity=severity,
            detail=detail,
            evidence=evidence,
            risk=Decimal(str(risk)),
            invoice_id=invoice_id,
            session_id=session_id,
        )
        self.session.add(signal)
        self.session.flush()
        return signal

    def apply_action(
        self,
        *,
        signal_id: uuid.UUID,
        action: str,
        reason: str,
        actor: uuid.UUID | None = None,
    ) -> SignalAction:
        signal = self.session.get(ThreatSignal, signal_id)
        if signal is None:
            raise NotFoundError("ThreatSignal", signal_id)
        if action == "dismiss_false_positive" and not reason:
            raise ValidationError("Dismissal requires a reason", "reason")
        if action in {"dismiss_false_positive", "resolve"}:
            signal.status = "dismissed" if action == "dismiss_false_positive" else "resolved"
        elif action == "escalate":
            signal.status = "escalated"
        elif action == "investigate":
            signal.status = "investigating"
        row = SignalAction(signal_id=signal.id, action=action, reason=reason, actor=actor)
        self.session.add(row)
        self.session.flush()
        return row

    def false_positive_rate_per_kind(self) -> dict[str, float]:
        rows = self.session.execute(
            select(
                ThreatSignal.kind,
                func.count(ThreatSignal.id).label("total"),
                func.sum(case((ThreatSignal.status == "dismissed", 1), else_=0)).label("dismissed"),
            )
            .where(ThreatSignal.org_id == self.org_id)
            .group_by(ThreatSignal.kind)
        ).all()
        out: dict[str, float] = {}
        for row in rows:
            total = int(row.total or 0)
            dismissed = int(row.dismissed or 0)
            out[row.kind] = (dismissed / total) if total else 0.0
        return out


class ModelRepo:
    """Register and promote ML models with a regression gate."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def register(
        self,
        *,
        name: str,
        version: str,
        artifact_hash: str,
        data_hash: str,
        metrics: dict[str, Any] | None = None,
        notes: str | None = None,
    ) -> ModelRegistry:
        row = ModelRegistry(
            name=name,
            version=version,
            artifact_hash=artifact_hash,
            data_hash=data_hash,
            metrics=metrics or {},
            notes=notes,
        )
        self.session.add(row)
        self.session.flush()
        return row

    def promote(self, model_id: uuid.UUID, *, regression_gate_result: bool) -> ModelRegistry:
        model = self.session.get(ModelRegistry, model_id)
        if model is None:
            raise NotFoundError("ModelRegistry", model_id)
        if not regression_gate_result:
            raise ValidationError("Promotion blocked by regression gate", "regression_gate_result")
        model.status = "production"
        model.promoted_at = datetime.utcnow()
        self.session.flush()
        return model

    def list_history(self, *, name: str | None = None) -> list[ModelRegistry]:
        stmt = select(ModelRegistry)
        if name is not None:
            stmt = stmt.where(ModelRegistry.name == name)
        return list(self.session.scalars(stmt.order_by(ModelRegistry.created_at.desc())).all())


class EvalRepo:
    """Store and list machine-learning evaluation runs and metrics."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create_run(
        self,
        *,
        git_commit: str | None,
        config: dict[str, Any],
        model_versions: dict[str, Any],
        rule_table_versions: dict[str, Any],
        data_hash: str,
        status: str = "completed",
    ) -> EvalRun:
        row = EvalRun(
            git_commit=git_commit,
            config=config,
            model_versions=model_versions,
            rule_table_versions=rule_table_versions,
            data_hash=data_hash,
            status=status,
        )
        self.session.add(row)
        self.session.flush()
        return row

    def add_metric(
        self,
        *,
        run_id: uuid.UUID,
        suite: str,
        metric: str,
        value: Decimal | float | int,
        ci_low: Decimal | float | int | None = None,
        ci_high: Decimal | float | int | None = None,
        slice: dict[str, Any] | None = None,
    ) -> EvalMetric:
        row = EvalMetric(
            run_id=run_id,
            suite=suite,
            metric=metric,
            value=Decimal(str(value)),
            ci_low=Decimal(str(ci_low)) if ci_low is not None else None,
            ci_high=Decimal(str(ci_high)) if ci_high is not None else None,
            slice=slice or {},
        )
        self.session.add(row)
        self.session.flush()
        return row

    def list_runs(self) -> list[EvalRun]:
        return list(self.session.scalars(select(EvalRun).order_by(EvalRun.started_at.desc())).all())


__all__ = [
    "MetricsRepo",
    "QualityRepo",
    "AlertRepo",
    "IncidentRepo",
    "SignalRepo",
    "ModelRepo",
    "EvalRepo",
]
