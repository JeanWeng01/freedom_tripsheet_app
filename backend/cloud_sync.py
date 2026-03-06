"""
Google Drive auto-sync for generated Excel files and uploaded photos.

Uses a Google Cloud Service Account. Files are uploaded to shared Drive
folders so they appear in the owner's Google Drive (and sync locally
via Google Drive for Desktop).

Required env vars (set on Railway, absent during local dev):
  GOOGLE_CREDENTIALS_JSON  — full JSON key of the service account
  GDRIVE_EXCEL_FOLDER_ID   — folder ID for trip sheet Excel files
  GDRIVE_PHOTOS_FOLDER_ID  — folder ID for driver photos
"""

import os
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

GOOGLE_CREDENTIALS_JSON = os.environ.get("GOOGLE_CREDENTIALS_JSON", "")
GDRIVE_EXCEL_FOLDER_ID = os.environ.get("GDRIVE_EXCEL_FOLDER_ID", "")
GDRIVE_PHOTOS_FOLDER_ID = os.environ.get("GDRIVE_PHOTOS_FOLDER_ID", "")

_service = None


def is_enabled() -> bool:
    """True when credentials and at least one folder ID are configured."""
    return bool(GOOGLE_CREDENTIALS_JSON) and bool(
        GDRIVE_EXCEL_FOLDER_ID or GDRIVE_PHOTOS_FOLDER_ID
    )


def _get_service():
    """Lazy-init the Google Drive API client."""
    global _service
    if _service is not None:
        return _service

    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds_info = json.loads(GOOGLE_CREDENTIALS_JSON)
    creds = service_account.Credentials.from_service_account_info(
        creds_info, scopes=["https://www.googleapis.com/auth/drive.file"]
    )
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
