# Agentic OS — React + Supabase (multi-user pilot build)

This is the **pilot path**: the same operating system as the static prototype, but with
real accounts, shared data, and database-enforced guardrails. Use it once a client pilot
has validated the workflow and needs more than one person in the same workspace.

## What carries over from the static prototype (by design)

| Piece | Where it lives here | Notes |
| --- | --- | --- |
| White-label config schema | `src/core/config.js` + `workspaces.config` (jsonb) | Same shape as `assets/config.js` — brand, terms, workstreams, routing rules, checklists, governance. One config per client workspace. |
| Routing engine | `src/core/routing.js` → `recommendTrack()` | Identical logic + confidence. |
| Guardrails | `src/core/routing.js` + **database triggers** | Valid stage movement, one-named-owner, quick checklist completion, and non-owner reviewer sign-off are enforced in the app *and* in Postgres (`supabase/schema.sql`), so no client can bypass them. |
| Stage model | `intake → routing → owned → in_review → ready → shipped` | Same as the static app. |
| Audit trail | `audit_events` table (append-only) | Task mutations are logged by database triggers with the authenticated actor. |

## Setup (10 minutes)

1. **Create a Supabase project** (free tier is fine): https://supabase.com
2. **Run the schema**: Supabase → SQL Editor → paste `supabase/schema.sql` → Run.
   This creates the tables, Row Level Security policies (workspace isolation), and the
   guardrail triggers.
3. **Configure env**: `cp .env.example .env.local` and fill in the Project URL and anon
   key from Project Settings → API.
4. **Run it**:
   ```
   npm install
   npm run dev
   ```
5. Sign in with a magic link, create your workspace, and you're on the board.
   Team invites should go through a dedicated invite/admin RPC; direct self-service edits to
   `profiles.workspace_id` and `profiles.role` are blocked by RLS and triggers.

## What's here vs. what ports next

This scaffold proves the port: auth → workspace onboarding → a working stage board with
routing + guardrails backed by Postgres. The full Command Center UI (the static app's
dashboard, agent workbench, white-label settings screens) ports screen-by-screen on top —
the render logic in the static `assets/os.js` maps 1:1 onto React components, and
`fable.css`/`os.css` come across nearly unchanged.

Recommended next increments:
1. Port the Command Center dashboard panels (stat cards, kanban, ownership console).
2. Agent runs: move the proxy (`../proxy/server.js`) to a Supabase Edge Function and
   write `agent_runs` rows from it.
3. Invite/roles UI on top of `profiles`.
4. Per-workspace theming from `workspaces.config.brand` (same CSS-variable trick).

## Security notes

- The anon key is safe in the browser **only because RLS is on** — do not skip step 2.
- Guardrails are enforced twice: in the UI (nice errors) and in Postgres triggers
  (hard backstop). Try skipping a stage, shipping an incomplete Quick Check, or signing
  off your own Full Review task — the database itself refuses.
