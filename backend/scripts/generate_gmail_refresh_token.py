"""One-time local script — run this once on your own machine, never on
Render, to obtain a Gmail API refresh token for the account that will send
notification emails (core/email_gmail.py).

Setup (once):
  1. https://console.cloud.google.com/ -> create/select a project ->
     enable the "Gmail API".
  2. APIs & Services -> Credentials -> Create Credentials -> OAuth client
     ID -> Application type "Desktop app". Download the client secret
     JSON, save it next to this script as client_secret.json.
  3. OAuth consent screen: add the Gmail account that will send emails as
     a Test user (unless the app is published/verified).
  4. pip install google-auth-oauthlib   (only needed for this script —
     NOT added to requirements.txt, production only needs google-auth +
     google-api-python-client, already installed).

Usage:
  python scripts/generate_gmail_refresh_token.py

A browser window opens — sign in with the sending Gmail account and
accept. The script then prints GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET /
GMAIL_REFRESH_TOKEN — paste those three, plus GMAIL_SENDER_EMAIL (the
address you signed in with), as Render environment variables. The refresh
token does not expire unless revoked from the Google Account's
"Third-party access" settings.
"""

import json
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/gmail.send']
CLIENT_SECRET_FILE = Path(__file__).parent / 'client_secret.json'


def main():
    if not CLIENT_SECRET_FILE.exists():
        raise SystemExit(
            f'Missing {CLIENT_SECRET_FILE} — download it from Google Cloud Console '
            '(Credentials -> your OAuth client -> Download JSON) and save it there first.'
        )

    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_FILE), SCOPES)
    creds = flow.run_local_server(port=0)

    client_config = json.loads(CLIENT_SECRET_FILE.read_text())['installed']
    print('\nAdd these as Render environment variables on the backend service:\n')
    print(f'GMAIL_CLIENT_ID={client_config["client_id"]}')
    print(f'GMAIL_CLIENT_SECRET={client_config["client_secret"]}')
    print(f'GMAIL_REFRESH_TOKEN={creds.refresh_token}')
    print('GMAIL_SENDER_EMAIL=<the Gmail address you just signed in with>')


if __name__ == '__main__':
    main()
