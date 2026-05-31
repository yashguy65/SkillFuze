# Handover: Resolving Persistent Unread Message Counts

This document provides a comprehensive post-mortem and handover of the actions, trials, and solutions implemented to resolve the recurring issues with unread message counts in SkillFuze.

---

## 📋 Executive Summary

The unread message system suffered from multiple layers of silent failures across the database layer, the network/real-time layer, and the React context state. While initial fixes corrected the SQL-level query filters, the system still failed to mark messages read due to silent Supabase Row-Level Security (RLS) drops and subscription churn caused by unstable state providers.

By moving from client-side direct updates to a `SECURITY DEFINER` database RPC and memoizing the global notification provider, we achieved a robust, permanent fix that successfully cleared full local CI tests.

---

## 🔍 The Anatomy of the Bugs & Fixes

### 1. The Schema Status Filter (Phase 1)
*   **The Problem:** Newly created direct messages initially populated with `status = NULL` in the database. The original client-side query filtered unread counts using `.neq('status', 'read')`. In SQL, comparisons with `NULL` using inequality (`!=`) return unknown, resulting in these messages being completely ignored by the unread count logic.
*   **What Worked:** Rewriting the query filters in `notifications-context.tsx` to explicitly include `NULL` values:
    ```typescript
    .or('status.neq.read,status.is.null')
    ```

### 2. The Real-time Race Condition (Phase 1)
*   **The Problem:** When a user sent a message, the optimistic UI inserted a placeholder with a temporary ID (`temp_...`). If the recipient read the message immediately, the database generated an `UPDATE` event back to the sender before the original `INSERT` network request completed. The client discarded this update because it couldn't map the permanent database ID to any active message.
*   **What Worked:** Implemented a caching queue called `pendingUpdatesRef` in `messages/page.tsx`. It acts as a staging ground: when real-time updates arrive early, they are cached and automatically applied the instant the optimistic message resolves its real database ID.

### 3. The RLS Policy Bottleneck (Phase 2)
*   **The Problem:** Standard Supabase RLS policies on the `messages` table allowed only the **sender** of a message to update its contents. When the **receiver** opened a conversation, their client attempted to execute a direct `.update()` to set the status to `'read'`. Supabase silently rejected this query (updating `0` rows) without throwing an error, leaving the messages perpetually unread.
*   **What Didn't Work:** Loosening the RLS update policies directly on the table, which posed safety risks and potentially exposed message contents to write tampering.
*   **What Worked:** Created a secure database function (RPC) `mark_direct_messages_read` in `packages/db/group_chat.sql`:
    ```sql
    create or replace function public.mark_direct_messages_read(p_sender_id uuid)
    returns void language plpgsql security definer set search_path = public as $$
    begin
      update public.messages
        set status = 'read'
        where receiver_id = auth.uid()
          and sender_id = p_sender_id
          and (status != 'read' or status is null);
    end;
    $$;
    ```
    This function uses `SECURITY DEFINER` (running with elevated schema permissions) to bypass table RLS, allowing only the designated recipient to safely change the message status to `'read'`.

### 4. Subscription Churn & Context Re-renders (Phase 2)
*   **The Problem:** The `NotificationsProvider` in `notifications-context.tsx` returned a raw object as its context value. Every time the unread count changed, this object recreated a new reference, triggering re-renders in all observing components (e.g., the sidebar, message viewports). This churned the real-time Supabase websocket channels, tearing down and re-subscribing in rapid succession, resulting in dropped updates.
*   **What Worked:** Wrapped the context provider value in a `useMemo` block, ensuring stable references that only recalculate when absolute triggers (like `totalUnread` changes) occur.

---

## 🛠️ DX & CI Enhancements

During testing, the Python environment checks in `test.bat` were failing on local machines lacking global packages like `numpy` or `pydantic`.
*   **What Worked:** Updated `test.bat` to scan for the local virtual environment (`services/ai-service/.venv`) and utilize its interpreter for compile/import and unit tests. This keeps the pre-commit pipelines reliable and lightweight.

---

## 🏁 How to Maintain & Verify

1.  **Database Migrations:** If deploying to a fresh staging/production environment, ensure `group_chat.sql` is fully applied to your Supabase SQL Editor.
2.  **Unread Count Logic:**
    *   **Direct:** Tracked via `messages.status != 'read' OR status IS NULL` (via `mark_direct_messages_read` RPC).
    *   **Group:** Tracked via `chat_group_messages.created_at > chat_group_members.last_read_at` (via `mark_chat_group_read` RPC).
3.  **Local Checks:** Run `.\test.bat --full` to verify both Next.js build outputs and Spring Boot / Python test suites.
