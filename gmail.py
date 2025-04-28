import os
import base64
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.oauth2 import id_token
from google.auth.transport.requests import Request
from email.mime.text import MIMEText

# our env-vars:
CLIENT_ID     = os.environ["GOOGLE_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
REFRESH_TOKEN = os.environ["GMAIL_REFRESH_TOKEN"]
TOKEN_URI     = "https://oauth2.googleapis.com/token"

def get_gmail_service():
  creds = Credentials(
      token=None,  # we don’t have a live access token yet
      refresh_token=REFRESH_TOKEN,
      token_uri=TOKEN_URI,
      client_id=CLIENT_ID,
      client_secret=CLIENT_SECRET,
      scopes=["https://www.googleapis.com/auth/gmail.send"],
  )
  # automatically does the first refresh for you
  creds.refresh(Request())
  return build("gmail", "v1", credentials=creds)

def create_message(sender, to, subject, html_content):
  msg = MIMEText(html_content, "html")
  msg["from"] = sender
  msg["to"]   = to
  msg["subject"] = subject
  raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
  return {"raw": raw}

def send_message_raw(service, message_body):
  return service.users().messages().send(userId="me", body=message_body).execute()

