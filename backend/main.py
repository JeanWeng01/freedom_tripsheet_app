"""
Freedom Trip Sheet — FastAPI backend
SQLite storage + Excel generation
"""

import os
import shutil
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent)))
UPLOADS_DIR = DATA_DIR / "uploads"

from database import init_db, upsert_trip, mark_submitted, list_trips, get_trip_data
from excel_gen import generate_excel, OUTPUT_READY, OUTPUT_FLAGGED, OUTPUT_RECOVERED

app = FastAPI(title="Freedom Trip Sheet API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_RECOVERED.mkdir(parents=True, exist_ok=True)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/health")
def api_health():
    """Same as /health but under /api/ prefix so the Vite proxy can reach it."""
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


# ── Photo upload ──────────────────────────────────────────────────────────────

@app.post("/api/trips/{trip_id}/photos")
async def upload_photo(
    trip_id: str,
    file: UploadFile = File(...),
    date: str = Form(...),
    route: str = Form(...),
    driver_code: str = Form(...),
):
    """Upload a trip photo. Returns the stored filename and URL."""
    try:
        UPLOADS_DIR.mkdir(exist_ok=True)

        # Sequential number: count existing files for this trip's prefix
        prefix = f"{date}_{route}_{driver_code}_"
        existing = list(UPLOADS_DIR.glob(f"{prefix}*.jpg"))
        n = len(existing) + 1

        filename = f"{date}_{route}_{driver_code}_{n}.jpg"
        dest = UPLOADS_DIR / filename

        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        return {
            "filename": filename,
            "url": f"/api/uploads/{filename}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/uploads/{filename}")
def serve_photo(filename: str):
    """Serve a stored trip photo."""
    path = UPLOADS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(str(path))


# ── Admin: list trips ─────────────────────────────────────────────────────────

@app.get("/api/trips")
def get_trips():
    """List all trips (for admin/debugging)."""
    return list_trips()


# ── Admin page ────────────────────────────────────────────────────────────────

@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    """Owner-facing HTML page listing all trips with Download Excel buttons."""
    trips = list_trips()
    rows_html = ""
    for t in trips:
        submitted = t.get("submitted_at") or ""
        status_class = "submitted" if submitted else "pending"
        status_label = submitted[:16] if submitted else "In progress"
        updated = (t.get("updated_at") or "")[:16]
        rows_html += (
            f"<tr>"
            f"<td>{t['driver_name']}</td>"
            f"<td>{t['route_number']}</td>"
            f"<td>{t['date']}</td>"
            f"<td class='{status_class}'>{status_label}</td>"
            f"<td>{updated}</td>"
            f"<td><a class='btn' href='/api/trips/{t['id']}/recover-excel'>Download Excel</a></td>"
            f"</tr>"
        )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trip Sheet Admin</title>
<style>
body{{font-family:sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}}
h1{{color:#f8fafc;margin-bottom:20px}}
table{{width:100%;border-collapse:collapse}}
th{{background:#1e293b;color:#94a3b8;text-align:left;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}}
td{{padding:10px 14px;border-bottom:1px solid #1e293b;font-size:14px}}
tr:hover td{{background:#1e293b60}}
a.btn{{display:inline-block;padding:5px 12px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600}}
a.btn:hover{{background:#2563eb}}
.submitted{{color:#4ade80}}.pending{{color:#fbbf24}}
</style></head>
<body>
<h1>Freedom Trip Sheets — Admin</h1>
<table>
<thead><tr><th>Driver</th><th>Route</th><th>Date</th><th>Submitted</th><th>Last Updated</th><th>Action</th></tr></thead>
<tbody>{rows_html}</tbody>
</table>
</body></html>"""
    return HTMLResponse(content=html)


# ── Recover Excel (for owner, any trip) ───────────────────────────────────────

@app.get("/api/trips/{trip_id}/recover-excel")
def recover_excel(trip_id: str):
    """Generate (or re-generate) Excel for any trip in the DB. For owner use."""
    trip = get_trip_data(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    try:
        filepath, filename, _status = generate_excel(trip, output_dir=OUTPUT_RECOVERED)
        return FileResponse(
            path=str(filepath),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── SPA static files (production only) ───────────────────────────────────────
# In production the built React app lives in ./static/ (copied by Dockerfile).
# This MUST be the last section — the catch-all route would shadow anything below it.

STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA. Any non-API route returns index.html."""
        file_path = STATIC_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
