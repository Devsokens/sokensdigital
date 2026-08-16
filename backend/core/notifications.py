from core import email_gmail, firestore_client


def notify(user, title: str, message: str, notification_type: str, link: str | None = None, email: bool = False) -> None:
    """Single entry point for cross-department notifications — always
    writes an in-app Firestore notification (see firestore_client.create_
    notification, read by the bell in admin-header.tsx), optionally also
    sends an email. Any department's backend code should call this rather
    than firestore_client/email_gmail directly, so every notification
    stays consistent and email delivery is an explicit opt-in per call
    site instead of duplicated logic.
    """
    if user.firebase_uid:
        firestore_client.create_notification(user.firebase_uid, title, message, notification_type, link)
    if email and user.email:
        email_gmail.send_email(user.email, title, message)
