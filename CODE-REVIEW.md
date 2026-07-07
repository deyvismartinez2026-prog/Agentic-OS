# Code Review — Round 2 (re-review after fixes)

Scope: `react-app/` — App.jsx, supabase/schema.sql, src/core/routing.js, styles.css.
Round 1 items are referenced by their original numbers.

## ✅ Verified fixed

| # | Item | How it was fixed |
|---|------|------------------|
| 1 | Onboarding RLS chicken-and-egg | `create_workspace_with_profile` security-definer RPC, atomic, validates input, blocks double-onboard. Workspace insert policy removed. |
| 2 | Role escalation / workspace hopping | Update policy pins `workspace_id`/`role` via `my_role()`, plus `profiles_privilege_guard` trigger as backstop. Profile insert policy removed (RPC-only). |
| 3 | Self-review | UI: `validReviewer` + disabled buttons; guard query `.neq("owner_id", …).is("reviewer_id", null)`; DB: reviewer ≠ owner, `signoff.reviewer_id` must match `reviewer_id`, and the recording update must come from `auth.uid() = reviewer_id`. I probed bypass paths (forged signoff written during `owned`, owner promoting `in_review→ready` with pre-set signoff) — the trigger catches them. |
| 4 | Weak DB backstop | Trigger now validates insert stages, full stage-transition graph, quick-checklist completion against workspace config, and blocks track changes. |
| 5 | Optional client-side audit | `tasks_audit` after-trigger (security definer), actor from `auth.uid()`; client audit insert removed; audit insert policy dropped so clients can't forge events. |
| 6 | "Own it" race | Guarded conditional updates + `data.length === 0` → conflict message + refresh. |
| 7 | No realtime | Channel per workspace with `postgres_changes` filter; publication add is idempotent. |
| 9 | One-click checklist | Real per-item checkboxes, owner-only, persisted; "Mark ready" gated on completion. |
| 10 | Governance flags | `canShip` now consults `requireOwnerToProceed` / `requireReviewerSignoffForFull`. |
| 11 | Silent errors / config drift | Both query errors surfaced; `mergeConfig` deep-merges stored config over `DEFAULT_CONFIG`. |
| 12 | Dead intake stage | Tasks insert at `intake` with an explicit "Route →" step. |

Also fixed from the Low list: explicit workspace filter on task select, input trimming, `emailRedirectTo`, `cycle_time_hours`/`shipped_at` computed in the ship trigger, `profiles_workspace` index.

## 🟠 Remaining (carried over)

### R1. No invite flow — workspaces are still effectively single-user (#8)
Every new user is forced into `Onboarding` and creates their own workspace. Worse, the new guardrails now *reference* flows that don't exist: "workspace changes require an invite or admin RPC" / "role changes require an admin RPC" — neither RPC is implemented, so there is no legitimate way to get a second person into a workspace, and no way for an admin to change anyone's role. This is now the blocker for the "multi-user pilot" claim. Add: `invites` table (admin-writable, token + email + role) and an `accept_invite(token)` security-definer RPC that creates the profile; an `admin_set_role(profile_id, role)` RPC.

### R2. Roles are still decorative
Any member — including `requester` — can route, own, check off items, and ship. Now that R1 will bring real second users, gate actions by role (e.g., requester: submit only; reviewer: sign-off; owner/admin: everything) in both the UI and the RLS/trigger layer.

### R3. No tests
`routing.js` and the trigger logic are now the enforcement surface and remain untested. Vitest for `recommendTrack`/`canShip`/`validReviewer` is cheap; the SQL guardrails deserve at least a documented manual test matrix (or pgTAP).

## 🟡 New / minor findings this round

### N1. Dead audit plumbing in `mutate`
`mutate(id, patch, _event, guard)` — the `_event` argument is unused, but every call site still builds prose strings ("Owner: name", "Shipped via …") that go nowhere. Meanwhile the DB audit texts are generic ("Owner updated"), and the routing recommendation prose from submit ("recommended Full Review (90%)") is lost entirely. Either delete the param and the strings, or add a structured `payload jsonb` to `audit_events` and pass client context through legitimately.

### N2. Full-track checklist never rendered
`config.checklists.full` (legal, financial, brand, factual…) is still unused — a reviewer records sign-off without seeing the items the config says they're attesting to. Render it in the `in_review` card and gate "Record sign-off" on completion, mirroring the quick track.

### N3. Track is now frozen with no reroute flow
The trigger blocks all track changes ("require a dedicated reroute flow") but no such flow exists, and `downgradeNeedsReason()` is still uncalled. `recommendTrack` runs only at submit — if flags were wrong, the task is stuck on the wrong track forever. Acceptable for the pilot, but either build the reroute RPC (with the logged reason `downgradeNeedsReason` was designed for) or note it in the README.

### N4. Double refresh after own mutations
`mutate` calls `refresh()` and the realtime event triggers a second one. Harmless now; if it grows, drop the explicit refresh and rely on the subscription. Also note DELETE events won't reach the filtered channel without `replica identity full` — irrelevant today (no deletes), just don't be surprised later.

### N5. Pre-emptive signoff residue
A forged `signoff` jsonb can be written while a task sits in `owned` (validation only fires at `ready`/`shipped`). Transitions catch it, so it's not exploitable — but consider rejecting `signoff` writes outside `in_review` to keep rows clean.

## Suggested order

1. R1 (invites + admin RPCs) — unblocks actual multi-user pilots
2. R2 (role gating), N2 (full checklist UI)
3. N1 (audit payload cleanup), N3 (reroute flow or README note)
4. R3 (tests), N4/N5 (polish)
