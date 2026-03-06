"""
Freedom Trip Sheet — FastAPI backend
SQLite storage + Excel generation
"""

import os
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from cloud_sync import upload_to_drive, is_enabled as gdrive_enabled, GDRIVE_EXCEL_FOLDER_ID, GDRIVE_PHOTOS_FOLDER_ID

DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent)))
UPLOADS_DIR = DATA_DIR / "uploads"
ADMIN_KEY = os.environ.get("ADMIN_KEY", "")


def require_admin(request: Request) -> None:
    """Check ?key= query param matches ADMIN_KEY. Raises 403 if wrong."""
    if not ADMIN_KEY:
        return  # No key configured (local dev) — allow access
    if request.query_params.get("key") != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

from database import init_db, upsert_trip, mark_submitted, list_trips, get_trip_data, delete_trips

PST = timezone(timedelta(hours=-8))


def _utc_to_pst(utc_str: str | None) -> str:
    """Convert a UTC datetime string from SQLite to PST display string."""
    if not utc_str:
        return ""
    try:
        dt = datetime.strptime(utc_str, "%Y-%m-%d %H:%M:%S")
        dt = dt.replace(tzinfo=timezone.utc).astimezone(PST)
        return dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return utc_str[:16] if utc_str else ""
from excel_gen import generate_excel, OUTPUT_READY, OUTPUT_FLAGGED, OUTPUT_RECOVERED


def _list_dir_files(directory: Path) -> list[dict]:
    """List files in a directory with metadata, newest first."""
    if not directory.exists():
        return []
    result = []
    for f in sorted(directory.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.is_file():
            st = f.stat()
            result.append({
                "name": f.name,
                "size_kb": round(st.st_size / 1024, 1),
                "modified_pst": datetime.fromtimestamp(
                    st.st_mtime, tz=timezone.utc
                ).astimezone(PST).strftime("%Y-%m-%d %H:%M"),
            })
    return result


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
async def submit_trip(trip_id: str, request: Request, background_tasks: BackgroundTasks):
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

        # Upload Excel to Google Drive in the background
        if gdrive_enabled() and GDRIVE_EXCEL_FOLDER_ID:
            background_tasks.add_task(upload_to_drive, filepath, filename, GDRIVE_EXCEL_FOLDER_ID)

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
    for folder in [OUTPUT_READY, OUTPUT_FLAGGED, OUTPUT_RECOVERED]:
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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    date: str = Form(...),
    route: str = Form(...),
    driver_code: str = Form(...),
):
    """Upload a trip photo. Returns the stored filename and URL."""
    try:
        UPLOADS_DIR.mkdir(exist_ok=True)

        # Look up driver first name from DB for the filename
        trip_data = get_trip_data(trip_id)
        if trip_data:
            first_name = trip_data["header"]["driverName"].split()[0]
        else:
            first_name = driver_code  # fallback

        # Format: "YYYY.MM.DD Route FirstName_N.jpg"
        date_dotted = date.replace("-", ".")
        prefix = f"{date_dotted} {route} {first_name}_"
        existing = list(UPLOADS_DIR.glob(f"{prefix}*.jpg"))
        n = len(existing) + 1

        filename = f"{date_dotted} {route} {first_name}_{n}.jpg"
        dest = UPLOADS_DIR / filename

        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        # Upload photo to Google Drive in the background
        if gdrive_enabled() and GDRIVE_PHOTOS_FOLDER_ID:
            background_tasks.add_task(upload_to_drive, str(dest), filename, GDRIVE_PHOTOS_FOLDER_ID)

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
def get_trips(request: Request):
    """List all trips (for admin/debugging)."""
    require_admin(request)
    return list_trips()


@app.post("/api/trips/delete")
async def delete_trips_endpoint(request: Request):
    """Delete selected trips by ID list. Admin only."""
    require_admin(request)
    body = await request.json()
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No trip IDs provided")
    count = delete_trips(ids)
    return {"ok": True, "deleted": count}


# ── Admin page ────────────────────────────────────────────────────────────────

_ADMIN_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trip Sheet Admin</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
h1{color:#f8fafc;margin-bottom:4px}
.sub{color:#64748b;font-size:13px;margin-bottom:16px}
.tabs{display:flex;gap:0;border-bottom:2px solid #1e293b;margin-bottom:20px;overflow-x:auto}
.tab-btn{padding:10px 20px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap}
.tab-btn:hover{color:#e2e8f0}
.tab-btn.active{color:#3b82f6;border-bottom-color:#3b82f6}
.cnt{background:#334155;color:#94a3b8;font-size:11px;padding:1px 6px;border-radius:10px;margin-left:6px}
.tc{display:none}.tc.active{display:block}
table{width:100%;border-collapse:collapse}
th{background:#1e293b;color:#94a3b8;text-align:left;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;position:sticky;top:0}
td{padding:10px 14px;border-bottom:1px solid #1e293b;font-size:14px}
tr:hover td{background:#1e293b60}
a.btn{display:inline-block;padding:5px 12px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600}
a.btn:hover{background:#2563eb}
.ok{color:#4ade80}.warn{color:#fbbf24}
.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:12px}
.del-btn{padding:6px 14px;background:#991b1b;color:#fca5a5;border:1px solid #7f1d1d;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:none}
.del-btn:hover{background:#b91c1c}
input[type=checkbox]{width:16px;height:16px;cursor:pointer}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase}
.badge-ready{background:#065f46;color:#6ee7b7}
.badge-flagged{background:#78350f;color:#fbbf24}
.badge-recovered{background:#1e3a5f;color:#93c5fd}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.pcard{background:#1e293b;border-radius:8px;overflow:hidden}
.pcard img{width:100%;height:180px;object-fit:cover;cursor:pointer}
.pcard .info{padding:8px 12px}
.pcard .nm{font-size:12px;color:#e2e8f0;word-break:break-all}
.pcard .mt{font-size:11px;color:#64748b;margin-top:2px}
.dbwrap{overflow-x:auto}
.dbwrap td{font-size:12px;white-space:nowrap}
.mono{font-family:monospace;font-size:11px;color:#94a3b8}
.empty{color:#64748b;font-style:italic;padding:40px;text-align:center}
</style></head>
<body>
<h1>Freedom Trip Sheets — Admin</h1>
<p class="sub">All times shown in PST</p>
<div class="tabs">
<button class="tab-btn active" onclick="showTab('trips',this)">Trips<span class="cnt">%%TRIPS_COUNT%%</span></button>
<button class="tab-btn" onclick="showTab('excel',this)">Excel Files<span class="cnt">%%EXCEL_COUNT%%</span></button>
<button class="tab-btn" onclick="showTab('photos',this)">Photos<span class="cnt">%%PHOTOS_COUNT%%</span></button>
<button class="tab-btn" onclick="showTab('db',this)">Database<span class="cnt">%%DB_COUNT%%</span></button>
</div>

<div id="tab-trips" class="tc active">
<div class="toolbar">
<button class="del-btn" id="delBtn" onclick="deleteSelected()">Delete selected</button>
<span id="selCount" style="color:#94a3b8;font-size:13px"></span>
</div>
<table><thead><tr>
<th><input type="checkbox" id="selectAll" onclick="toggleAll(this)"></th>
<th>Driver</th><th>Route</th><th>Date</th><th>Submitted</th><th>Last Updated</th><th>Action</th>
</tr></thead><tbody>%%TRIPS_ROWS%%</tbody></table>
</div>

<div id="tab-excel" class="tc">%%EXCEL_CONTENT%%</div>
<div id="tab-photos" class="tc">%%PHOTOS_CONTENT%%</div>

<div id="tab-db" class="tc"><div class="dbwrap"><table>
<thead><tr>
<th>ID</th><th>Driver</th><th>Code</th><th>Route</th><th>Date</th>
<th>Submitted</th><th>Excel File</th><th>Status</th><th>Created</th><th>Updated</th>
</tr></thead><tbody>%%DB_ROWS%%</tbody></table></div></div>

<script>
const key="%%KEY%%";
function showTab(n,btn){
document.querySelectorAll('.tc').forEach(e=>e.classList.remove('active'));
document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
document.getElementById('tab-'+n).classList.add('active');
btn.classList.add('active');
}
function toggleAll(el){
document.querySelectorAll('.row-cb').forEach(cb=>cb.checked=el.checked);
updateToolbar();
}
document.querySelectorAll('.row-cb').forEach(cb=>cb.addEventListener('change',updateToolbar));
function updateToolbar(){
const c=document.querySelectorAll('.row-cb:checked');
document.getElementById('delBtn').style.display=c.length?'inline-block':'none';
document.getElementById('selCount').textContent=c.length?c.length+' selected':'';
}
async function deleteSelected(){
const ids=[...document.querySelectorAll('.row-cb:checked')].map(cb=>cb.value);
if(!ids.length)return;
if(!confirm('Delete '+ids.length+' trip(s)? This cannot be undone.'))return;
const r=await fetch('/api/trips/delete?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
if(r.ok)location.reload();
else alert('Delete failed: '+(await r.text()));
}
</script>
</body></html>"""


@app.get("/admin", response_class=HTMLResponse)
def admin_page(request: Request):
    """Owner-facing admin dashboard with tabs for trips, files, photos, and DB."""
    require_admin(request)
    key = request.query_params.get("key", "")

    # ── Trips data ────────────────────────────────────────────────
    trips = list_trips(limit=500)

    trips_rows = ""
    for t in trips:
        tid = t["id"]
        submitted_pst = _utc_to_pst(t.get("submitted_at"))
        status_class = "ok" if submitted_pst else "warn"
        status_label = submitted_pst if submitted_pst else "In progress"
        updated_pst = _utc_to_pst(t.get("updated_at"))
        trips_rows += (
            f"<tr>"
            f"<td><input type='checkbox' class='row-cb' value='{tid}'></td>"
            f"<td>{t['driver_name']}</td>"
            f"<td>{t['route_number']}</td>"
            f"<td>{t['date']}</td>"
            f"<td class='{status_class}'>{status_label}</td>"
            f"<td>{updated_pst}</td>"
            f"<td><a class='btn' href='/api/trips/{tid}/recover-excel?key={key}'>Download Excel</a></td>"
            f"</tr>"
        )

    # ── Excel files ───────────────────────────────────────────────
    excel_files = []
    for folder_name, folder_path in [
        ("ready", OUTPUT_READY), ("flagged", OUTPUT_FLAGGED), ("recovered", OUTPUT_RECOVERED),
    ]:
        for finfo in _list_dir_files(folder_path):
            finfo["status"] = folder_name
            excel_files.append(finfo)

    if excel_files:
        excel_rows = ""
        for ef in excel_files:
            excel_rows += (
                f"<tr>"
                f"<td><span class='badge badge-{ef['status']}'>{ef['status']}</span></td>"
                f"<td>{ef['name']}</td>"
                f"<td>{ef['size_kb']} KB</td>"
                f"<td>{ef['modified_pst']}</td>"
                f"<td><a class='btn' href='/api/files/{ef['name']}'>Download</a></td>"
                f"</tr>"
            )
        excel_content = (
            "<table><thead><tr>"
            "<th>Status</th><th>Filename</th><th>Size</th><th>Modified</th><th>Action</th>"
            "</tr></thead><tbody>" + excel_rows + "</tbody></table>"
        )
    else:
        excel_content = "<p class='empty'>No Excel files generated yet</p>"

    # ── Photos ────────────────────────────────────────────────────
    photos = _list_dir_files(UPLOADS_DIR)

    if photos:
        photos_html = '<div class="pgrid">'
        for p in photos:
            photos_html += (
                f'<div class="pcard">'
                f'<a href="/api/uploads/{p["name"]}" target="_blank">'
                f'<img src="/api/uploads/{p["name"]}" loading="lazy" alt="{p["name"]}">'
                f'</a>'
                f'<div class="info">'
                f'<div class="nm">{p["name"]}</div>'
                f'<div class="mt">{p["size_kb"]} KB &mdash; {p["modified_pst"]}</div>'
                f'</div></div>'
            )
        photos_html += "</div>"
        photos_content = photos_html
    else:
        photos_content = "<p class='empty'>No photos uploaded yet</p>"

    # ── Database table ────────────────────────────────────────────
    db_rows = ""
    for t in trips:
        submitted_pst = _utc_to_pst(t.get("submitted_at"))
        created_pst = _utc_to_pst(t.get("created_at"))
        updated_pst = _utc_to_pst(t.get("updated_at"))
        tid_short = t["id"][:8] + "..." if len(t["id"]) > 8 else t["id"]
        db_rows += (
            f"<tr>"
            f"<td class='mono' title='{t['id']}'>{tid_short}</td>"
            f"<td>{t['driver_name']}</td>"
            f"<td>{t.get('driver_code', '')}</td>"
            f"<td>{t['route_number']}</td>"
            f"<td>{t['date']}</td>"
            f"<td>{submitted_pst or '—'}</td>"
            f"<td class='mono'>{t.get('excel_filename') or '—'}</td>"
            f"<td>{t.get('excel_status') or '—'}</td>"
            f"<td>{created_pst or '—'}</td>"
            f"<td>{updated_pst or '—'}</td>"
            f"</tr>"
        )

    # ── Assemble HTML ─────────────────────────────────────────────
    html = (_ADMIN_TEMPLATE
        .replace("%%KEY%%", key)
        .replace("%%TRIPS_COUNT%%", str(len(trips)))
        .replace("%%TRIPS_ROWS%%", trips_rows)
        .replace("%%EXCEL_COUNT%%", str(len(excel_files)))
        .replace("%%EXCEL_CONTENT%%", excel_content)
        .replace("%%PHOTOS_COUNT%%", str(len(photos)))
        .replace("%%PHOTOS_CONTENT%%", photos_content)
        .replace("%%DB_COUNT%%", str(len(trips)))
        .replace("%%DB_ROWS%%", db_rows)
    )
    return HTMLResponse(content=html)


# ── Recover Excel (for owner, any trip) ───────────────────────────────────────

@app.get("/api/trips/{trip_id}/recover-excel")
def recover_excel(trip_id: str, request: Request):
    """Generate (or re-generate) Excel for any trip in the DB. For owner use."""
    require_admin(request)
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
