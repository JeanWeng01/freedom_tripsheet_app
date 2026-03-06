"""
One-time script to get a Google Drive OAuth refresh token.
Run this LOCALLY (not on Railway). It opens your browser to sign in.

Setup:
  1. pip install google-auth-oauthlib
  2. Go to Google Cloud Console → APIs & Services → Credentials
  3. Create an OAuth 2.0 Client ID (type: Desktop app)
  4. Copy the Client ID and Client Secret

Usage:
  python get_gdrive_token.py YOUR_CLIENT_ID YOUR_CLIENT_SECRET
"""

import sys


def main():
    if len(sys.argv) != 3:
        print("Usage: python get_gdrive_token.py CLIENT_ID CLIENT_SECRET")
        sys.exit(1)

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("Missing package. Run: pip install google-auth-oauthlib")
        sys.exit(1)

    client_id = sys.argv[1]
    client_secret = sys.argv[2]

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/drive.file"],
    )

    print("Opening browser for Google sign-in...")
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

    print()
    print("=" * 60)
    print("SUCCESS! Set these 3 env vars on Railway:")
    print("=" * 60)
    print(f"GOOGLE_CLIENT_ID     = {client_id}")
    print(f"GOOGLE_CLIENT_SECRET = {client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN = {creds.refresh_token}")
    print("=" * 60)


if __name__ == "__main__":
    main()
