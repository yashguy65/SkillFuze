import os
import json
from fastapi import APIRouter, BackgroundTasks
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
    Handles both direct messages (messages table) and group messages
    (chat_group_messages table).
    """
    if payload.type != "INSERT":
        return {"status": "ignored"}

    if payload.table == "messages":
        msg = payload.record
        receiver_id = msg.get("receiver_id")
        sender_id = msg.get("sender_id")
        text = msg.get("text", "New message")

        if not receiver_id:
            return {"error": "No receiver_id found"}

        background_tasks.add_task(send_direct_push, receiver_id, sender_id, text)
        return {"status": "processing"}

    if payload.table == "chat_group_messages":
        msg = payload.record
        group_id = msg.get("group_id")
        sender_id = msg.get("sender_id")
        text = msg.get("text", "New message")

        if not group_id:
            return {"error": "No group_id found"}

        background_tasks.add_task(send_group_push, group_id, sender_id, text)
        return {"status": "processing"}

    return {"status": "ignored"}


# ---------------------------------------------------------------------------
# Direct message push
# ---------------------------------------------------------------------------

async def send_direct_push(user_id: str, sender_id: str, text: str):
    supabase = get_supabase()

    res = (
        supabase.table("push_subscriptions")
        .select("subscription")
        .eq("user_id", user_id)
        .execute()
    )

    if not res.data:
        print(f"No push subscription for user {user_id}")
        return

    sender_res = (
        supabase.table("profiles")
        .select("full_name, handle")
        .eq("id", sender_id)
        .execute()
    )
    sender_name = "Someone"
    if sender_res.data:
        sender_name = (
            sender_res.data[0].get("full_name")
            or sender_res.data[0].get("handle")
            or "Someone"
        )

    notification = {
        "title": f"New message from {sender_name}",
        "body": text if len(text) < 100 else f"{text[:97]}...",
        "url": f"/messages?user_id={sender_id}",
    }

    _send_push(res.data[0]["subscription"], notification, user_id, supabase)


# ---------------------------------------------------------------------------
# Group message push
# ---------------------------------------------------------------------------

async def send_group_push(group_id: str, sender_id: str, text: str):
    supabase = get_supabase()

    # Get group name
    group_res = (
        supabase.table("chat_groups")
        .select("name")
        .eq("id", group_id)
        .execute()
    )
    group_name = "a group"
    if group_res.data:
        group_name = group_res.data[0].get("name") or "a group"

    # Get all members except the sender
    members_res = (
        supabase.table("chat_group_members")
        .select("user_id")
        .eq("group_id", group_id)
        .neq("user_id", sender_id)
        .execute()
    )

    if not members_res.data:
        return

    recipient_ids = [m["user_id"] for m in members_res.data]

    # Get push subscriptions for all recipients in one query
    subs_res = (
        supabase.table("push_subscriptions")
        .select("user_id, subscription")
        .in_("user_id", recipient_ids)
        .execute()
    )

    if not subs_res.data:
        return

    notification = {
        "title": f"New message in {group_name}",
        "body": text if len(text) < 100 else f"{text[:97]}...",
        "url": f"/messages?group_id={group_id}",
    }

    for row in subs_res.data:
        _send_push(row["subscription"], notification, row["user_id"], supabase)


# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

def _send_push(subscription_info: dict, notification: dict, user_id: str, supabase):
    vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
    vapid_public_key = os.getenv("VAPID_PUBLIC_KEY")
    vapid_claims = {"sub": os.getenv("VAPID_MAILTO", "mailto:admin@skillfuze.com")}

    if not vapid_private_key or not vapid_public_key:
        print("VAPID keys not configured in backend")
        return

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(notification),
            vapid_private_key=vapid_private_key,
            vapid_claims=vapid_claims,
        )
        print(f"Push notification sent to {user_id}")
    except WebPushException as ex:
        print(f"WebPush error for {user_id}: {ex}")
        if ex.response and ex.response.status_code in [404, 410]:
            supabase.table("push_subscriptions").delete().eq("user_id", user_id).execute()
