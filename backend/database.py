import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "trips.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS trips (
                id TEXT PRIMARY KEY,
                driver_name TEXT NOT NULL,
                driver_code TEXT NOT NULL,
                route_number TEXT NOT NULL,
                date TEXT NOT NULL,
                data TEXT NOT NULL,
                submitted_at TEXT,
                excel_filename TEXT,
                excel_status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


def upsert_trip(trip: dict) -> None:
    h = trip["header"]
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO trips (id, driver_name, driver_code, route_number, date, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
        """, (
            trip["id"],
            h["driverName"],
            h["driverCode3"],
            h["routeNumber"],
            h["date"],
            json.dumps(trip),
        ))
        conn.commit()


def mark_submitted(trip_id: str, filename: str, status: str) -> None:
    with get_conn() as conn:
        conn.execute("""
            UPDATE trips SET
                submitted_at = datetime('now'),
                excel_filename = ?,
                excel_status = ?,
                updated_at = datetime('now')
            WHERE id = ?
        """, (filename, status, trip_id))
        conn.commit()


def get_trip_data(trip_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT data FROM trips WHERE id = ?", (trip_id,)
        ).fetchone()
        if row is None:
            return None
        return json.loads(row["data"])


def list_trips(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, driver_name, route_number, date, submitted_at, excel_filename, excel_status, updated_at "
            "FROM trips ORDER BY updated_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
