"""Event store protocol and SQLite / In-Memory implementations for vendor events."""

import json
import sqlite3
from pathlib import Path
from typing import Protocol, runtime_checkable

from folio_ml.vendor.contracts import VendorEvent


@runtime_checkable
class VendorStore(Protocol):
    """Protocol for vendor event persistence and query."""

    def record_event(self, event: VendorEvent) -> VendorEvent:
        """Appends an immutable event to the store."""
        ...

    def get_events(self, gstin: str, limit: int | None = None) -> list[VendorEvent]:
        """Retrieves events for a vendor ordered by timestamp ascending."""
        ...

    def get_all_gstins(self) -> list[str]:
        """Returns distinct GSTINs recorded in the store."""
        ...


class InMemoryVendorStore:
    """Thread-safe in-memory event store for unit testing."""

    def __init__(self) -> None:
        self._events: dict[str, list[VendorEvent]] = {}

    def record_event(self, event: VendorEvent) -> VendorEvent:
        if event.gstin not in self._events:
            self._events[event.gstin] = []
        self._events[event.gstin].append(event)
        return event

    def get_events(self, gstin: str, limit: int | None = None) -> list[VendorEvent]:
        evs = self._events.get(gstin, [])
        sorted_evs = sorted(evs, key=lambda e: e.timestamp)
        if limit is not None:
            return sorted_evs[-limit:]
        return sorted_evs

    def get_all_gstins(self) -> list[str]:
        return list(self._events.keys())


class SQLiteVendorStore:
    """SQLite-backed append-only event store for development and persistent environments."""

    def __init__(self, db_path: str | Path = ":memory:") -> None:
        self.db_path = str(db_path)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS vendor_events (
                    id TEXT PRIMARY KEY,
                    gstin TEXT NOT NULL,
                    period TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    details TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_vendor_events_gstin ON vendor_events(gstin, timestamp)"
            )
            conn.commit()

    def record_event(self, event: VendorEvent) -> VendorEvent:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO vendor_events (id, gstin, period, event_type, timestamp, details)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    event.id,
                    event.gstin,
                    event.period,
                    event.event_type,
                    event.timestamp,
                    json.dumps(event.details),
                ),
            )
            conn.commit()
        return event

    def get_events(self, gstin: str, limit: int | None = None) -> list[VendorEvent]:
        query = "SELECT id, gstin, period, event_type, timestamp, details FROM vendor_events WHERE gstin = ? ORDER BY timestamp ASC"
        params: list[object] = [gstin]
        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()

        events: list[VendorEvent] = []
        for r in rows:
            events.append(
                VendorEvent(
                    id=r["id"],
                    gstin=r["gstin"],
                    period=r["period"],
                    event_type=r["event_type"],
                    timestamp=r["timestamp"],
                    details=json.loads(r["details"]),
                )
            )
        return events

    def get_all_gstins(self) -> list[str]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT DISTINCT gstin FROM vendor_events")
            rows = cursor.fetchall()
        return [r["gstin"] for r in rows]
