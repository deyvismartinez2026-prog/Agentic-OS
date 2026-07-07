# Codex Prompt — Agentic OS pilot, Round 3

Copy everything below the line into a new Codex chat. It assumes Codex has the repo open at `AAS Agentic OS Codex copy/react-app/`. Supporting artifact: `CODE-REVIEW.md` (round-2 review, same folder) — the prompt references it.

---

## Context

You are working on **`react-app/`** — a React 18 + Vite + Supabase multi-user pilot of the AAS Agentic OS. Architecture:

- `src/core/routing.js` — pure routing/guardrail engine (no I/O). The product's core logic.
- `src/core/config.js` — `DEFAULT_CONFIG` white-label schema, stored per-workspace in `workspaces.config` (jsonb).
- `src/App.jsx` — all UI: SetupScreen → SignIn (magic link) → Onboarding (RPC `create_workspace_with_profile`) → Board (kanban across stages `intake → routing → owned → in_review → ready → shipped`).
- `supabase/schema.sql` — tables (`workspaces`, `profiles`, `tasks`, `agent_runs`, `audit_events`), RLS workspace isolation, `enforce_guardrails()` trigger (stage transitions, owner required, quick-checklist completion, reviewer ≠ owner sign-off), `tasks_audit` trigger (server-side audit log), realtime publication.

**Design principles you must preserve:**

1. Every guardrail is enforced in BOTH layers: UI (disabled buttons + `src/core/routing.js` predicates) AND database (RLS policies / triggers). The DB is the backstop; never trust the client.
2. Client writes that need privilege go through `security definer` RPCs, not direct table inserts (see `create_workspace_with_profile`).
3. `schema.sql` must stay idempotent — re-runnable on an existing project (`create or replace`, `drop policy if exists`, `drop trigger if exists`, conditional `do $$` blocks).
4. Optimistic-concurrency pattern in `App.jsx` `mutate()`: guarded conditional updates (`.eq("stage", …)` etc.) + empty-result conflict handling. Follow it for new mutations.
5. Small, readable components; no new dependencies except Vitest (Task 5).

Two rounds of review are complete. Read **`CODE-REVIEW.md`** in this folder before starting — the "Remaining" (R1–R3) and "New / minor" (N1–N5) sections are your work list. Tasks below, in order.

## Task 1 — Invite flow (R1) [blocker]

Currently every new user is forced to create their own workspace; guardrail error messages reference an "invite or admin RPC" that doesn't exist.

- `schema.sql`: add an `invites` table: `id uuid pk`, `workspace_id` fk, `email text not null`, `role text` (same check as profiles, default 'owner'), `token uuid default gen_random_uuid()`, `created_by` fk profiles, `accepted_at timestamptz`, `created_at`. RLS: select/insert/delete only for admins of that workspace (`my_role() = 'admin' and workspace_id = my_workspace_id()`).
- RPC `accept_invite(invite_token uuid) returns uuid` (security definer): validates caller is authed, not already onboarded, token exists and unaccepted, and the caller's `auth.jwt() ->> 'email'` matches the invite email (case-insensitive); creates the profile with the invite's workspace and role; stamps `accepted_at`; returns workspace_id.
- RPC `admin_set_role(target_profile uuid, new_role text) returns void` (security definer): caller must be admin of the same workspace as the target; validate role against the allowed list; must not demote the last admin of a workspace.
- `App.jsx`: Onboarding screen gets two paths — "Create a workspace" (existing) and "Join with an invite code" (input for token → `accept_invite`). Board gets a minimal admin-only "Invite teammate" form (email + role → insert invite, then display the token to share).

## Task 2 — Role gating (R2)

`profile.role` is currently decorative. Enforce, in UI (hide/disable) and DB (extend `enforce_guardrails()` / policies):

- `requester`: may submit tasks only.
- `reviewer`: may record sign-off; may not own/route/ship.
- `owner`: everything except workspace config changes and invites.
- `admin`: everything.

In the trigger, derive the actor's role via `auth.uid()` → profiles lookup; skip checks when `auth.uid()` is null (service role).

## Task 3 — Full-review checklist UI (N2)

`config.checklists.full` is never rendered — reviewers sign off blind. In the `in_review` card, render the full checklist (same pattern as the quick checklist in `owned`), editable only by a valid reviewer (`validReviewer`, not the owner), persisted to `task.checklist`. Gate "Record sign-off" on all full items being checked (UI + trigger: validate full-checklist completion at `ready`/`shipped` for `track='full'`, mirroring the quick-track loop).

## Task 4 — Audit payload cleanup (N1)

`mutate(id, patch, _event, guard)` has a dead `_event` param; call sites build prose strings that go nowhere; DB audit texts are generic. Add `payload jsonb not null default '{}'` to `audit_events`; extend the `tasks_audit` trigger to include useful diffs (stage from/to, owner, reviewer). For client context that only the app knows (routing recommendation at submit), add a `note_task_event(task uuid, note text)` RPC that validates workspace membership and inserts a structured audit row — then remove the dead `_event` param and stale strings from `App.jsx`.

## Task 5 — Tests (R3)

Add Vitest (devDependency, `"test": "vitest run"`). Cover `src/core/routing.js`: `recommendTrack` (no flags → quick/90; flag count → confidence curve, cap 97), `canShip` (each failure branch incl. governance-flag overrides), `validReviewer`, `canStartWork`, `downgradeNeedsReason`. Also add `supabase/TEST-MATRIX.md`: a manual test table for the SQL guardrails (each trigger exception path + each RLS policy, with the API call that should fail).

## Task 6 — Polish (N3, N4, N5)

- N3: add RPC `reroute_task(task uuid, new_track text, reason text)` — requires admin or owner-of-task, requires non-empty reason when `downgradeNeedsReason` semantics apply (full→quick); logs the reason to audit; the trigger should allow track changes only via this RPC (e.g., a `set_config`/local flag or perform the update inside the security-definer function with a session GUC the trigger checks).
- N4: drop the explicit `refresh()` after successful `mutate` and rely on the realtime subscription; keep the conflict-path refresh.
- N5: in the trigger, reject `signoff` writes when the task is not in `in_review` (or transitioning out of it).

## Acceptance checklist

- `schema.sql` re-runs cleanly on an already-migrated project.
- A second user can join via invite and appears in the same workspace; a requester cannot own or ship (verified via direct PostgREST call, not just UI).
- Owner still cannot self-review through any update path.
- `npm run build` and `npm test` pass.
- Update `README.md`: invite flow setup, roles table, test instructions.

Work through the tasks in order and commit per task. Ask before deviating from the design principles.
