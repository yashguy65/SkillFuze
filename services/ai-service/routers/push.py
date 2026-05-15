import os
import json
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from pywebpush import webpush, WebPushException
from pipelines.supabase_client import get_supabase

router = APIRouter()

class WebhookPayload(BaseModel):
    type: str
    table: str
    record: dict
    old_record: dict = None
    schema: str

@router.post("/push/notify")
async def notify_user(payload: WebhookPayload, background_tasks: BackgroundTasks):
    """
    Endpoint triggered by Supabase Webhook when a new message is inserted.
    """
    if payload.table != "messages" or payload.type != "INSERT":
        return {"status": "ignored"}

    msg = payload.record
    receiver_id = msg.get("receiver_id")
    sender_id = msg.get("sender_id")
    text = msg.get("text", "New message")

    if not receiver_id:
        return {"error": "No receiver_id found"}

    background_tasks.add_task(send_push_to_user, receiver_id, sender_id, text)
    return {"status": "processing"}

async def send_push_to_user(user_id: str, sender_id: str, text: str):
    supabase = get_supabase()
    
    # Get receiver's push subscription
    res = supabase.table("push_subscriptions").select("subscription").eq("user_id", user_id).execute()
    
    if not res.data:
        print(f"No push subscription for user {user_id}")
        return

    # Get sender info for the notification title
    sender_res = supabase.table("profiles").select("full_name, handle").eq("id", sender_id).execute()
    sender_name = "Someone"
    if sender_res.data:
        sender_name = sender_res.data[0].get("full_name") or sender_res.data[0].get("handle") or "Someone"

    subscription_info = res.data[0]["subscription"]
    
    vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
    vapid_public_key = os.getenv("VAPID_PUBLIC_KEY")
    vapid_claims = {"sub": os.getenv("VAPID_MAILTO", "mailto:admin@skillfuze.com")}

    if not vapid_private_key or not vapid_public_key:
        print("VAPID keys not configured in backend")
        return

    payload = {
        "title": f"New message from {sender_name}",
        "body": text if len(text) < 100 else f"{text[:97]}...",
        "url": f"/messages?user_id={sender_id}"
    }

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_private_key,
            vapid_claims=vapid_claims
        )
        print(f"Push notification sent to {user_id}")
    except WebPushException as ex:
        print(f"WebPush error: {ex}")
        # If subscription is expired/invalid, we could remove it here
        if ex.response and ex.response.status_code in [404, 410]:
            supabase.table("push_subscriptions").delete().eq("user_id", user_id).execute()
