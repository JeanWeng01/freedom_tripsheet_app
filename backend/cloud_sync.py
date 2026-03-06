"""
Google Drive auto-sync for generated Excel files and uploaded photos.

Uses OAuth 2.0 with a refresh token (personal Google account).
Files are uploaded to the owner's Drive folders and sync locally
via Google Drive for Desktop.

Required env vars (set on Railway, absent during local dev):
  GOOGLE_CLIENT_ID       — OAuth client ID
  GOOGLE_CLIENT_SECRET   — OAuth client secret
  GOOGLE_REFRESH_TOKEN   — long-lived refresh token (from get_gdrive_token.py)
  GDRIVE_EXCEL_FOLDER_ID   — folder ID for trip sheet Excel files
  GDRIVE_PHOTOS_FOLDER_ID  — folder ID for driver photos
"""

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REFRESH_TOKEN = os.environ.get("GOOGLE_REFRESH_TOKEN", "")
GDRIVE_EXCEL_FOLDER_ID = os.environ.get("GDRIVE_EXCEL_FOLDER_ID", "")
GDRIVE_PHOTOS_FOLDER_ID = os.environ.get("GDRIVE_PHOTOS_FOLDER_ID", "")

_service = None


def is_enabled() -> bool:
    """True when OAuth credentials and at least one folder ID are configured."""
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN) and bool(
        GDRIVE_EXCEL_FOLDER_ID or GDRIVE_PHOTOS_FOLDER_ID
    )


def _get_service():
    """Lazy-init the Google Drive API client with OAuth credentials."""
    global _service
    if _service is not None:
        return _service

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=GOOGLE_REFRESH_TOKEN,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
    )
    creds.refresh(Request())

    _service = build("drive", "v3", credentials=creds, cache_discovery=False)
    return _service


def upload_to_drive(filepath: str, filename: str, folder_id: str) -> bool:
    """
    Upload a file to a Google Drive folder.
    Returns True on success. Never raises — errors are logged only.
    """
    try:
        from googleapiclient.http import MediaFileUpload

        service = _get_service()

        ext = Path(filename).suffix.lower()
        mime_map = {
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        }
        mime = mime_map.get(ext, "application/octet-stream")

        media = MediaFileUpload(filepath, mimetype=mime)
        metadata = {"name": filename, "parents": [folder_id]}

        service.files().create(
            body=metadata, media_body=media, fields="id"
        ).execute()

        logger.info("Drive upload OK: %s → folder %s", filename, folder_id[:8])
        return True

    except Exception as e:
        logger.error("Drive upload FAILED for %s: %s", filename, e)
        return False
