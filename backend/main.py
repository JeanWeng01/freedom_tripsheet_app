"""
Freedom Trip Sheet — FastAPI backend
SQLite storage + Excel generation
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from database import init_db, upsert_trip, mark_submitted, list_trips
from excel_gen import generate_excel, OUTPUT_READY, OUTPUT_FLAGGED

app = FastAPI(title="Freedom Trip Sheet API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Trip sync (auto-save) ─────────────────────────────────────────────────────

@app.post("/api/trips/sync")
async def sync_trip(request: Request):
    """Save or update in-progress trip data. Called periodically by the app."""
    try:
        trip = await request.json()
        upsert_trip(trip)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Submit ────────────────────────────────────────────────────────────────────

@app.post("/api/trips/{trip_id}/submit")
async def submit_trip(trip_id: str, request: Request):
    """
    Final submit: save to DB, generate Excel, return download URL.
    status = 'ready' means the Excel file passed verification.
    status = 'flagged' means something needs review (file still generated).
    """
    try:
        trip = await request.json()

        if trip.get("id") != trip_id:
            raise HTTPException(status_code=400, detail="Trip ID mismatch")

        upsert_trip(trip)
        filepath, filename, status = generate_excel(trip)
        mark_submitted(trip_id, filename, status)

        return {
            "ok": True,
            "trip_id": trip_id,
            "filename": filename,
            "status": status,
            "download_url": f"/api/files/{filename}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── File download ─────────────────────────────────────────────────────────────

@app.get("/api/files/{filename:path}")
def download_file(filename: str):
    """Serve a generated Excel file (from ready or flagged folder)."""
    for folder in [OUTPUT_READY, OUTPUT_FLAGGED]:
        path = folder / filename
        if path.exists():
            return FileResponse(
                path=str(path),
                filename=filename,
                media_type=(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                ),
            )
    raise HTTPException(status_code=404, detail="File not found")


# ── Admin: list trips ─────────────────────────────────────────────────────────

@app.get("/api/trips")
def get_trips():
    """List all trips (for admin/debugging)."""
    return list_trips()
