# SQL Guardrail Test Matrix

Run these against a disposable Supabase project after applying `schema.sql`. Use normal signed-in users through the anon key unless a row says "service role". Calls marked "should fail" verify that RLS or triggers are the real backstop, not the React UI.

## RLS Policies

| Policy area | Actor | API call | Expected result |
| --- | --- | --- | --- |
| `profiles select` | Member of workspace A | `supabase.from("profiles").select("*").eq("workspace_id", workspaceB)` | Returns no rows. |
| `profiles update` | Member | `supabase.from("profiles").update({ name: "New" }).eq("id", otherProfileId)` | Fails or updates zero rows. |
| `profiles update` | Member | `supabase.from("profiles").update({ role: "admin" }).eq("id", myProfileId)` | Fails with profile privilege trigger. |
| `invites select` | Non-admin owner/reviewer/requester | `supabase.from("invites").select("*").eq("workspace_id", myWorkspace)` | Returns no rows. |
| `invites insert` | Non-admin owner | `supabase.from("invites").insert({ workspace_id: myWorkspace, email: "a@example.com", role: "reviewer" })` | Fails RLS. |
| `invites delete` | Non-admin owner | `supabase.from("invites").delete().eq("id", inviteId)` | Fails RLS or deletes zero rows. |
| `workspaces select` | Member of workspace A | `supabase.from("workspaces").select("*").eq("id", workspaceB)` | Returns no rows. |
| `workspaces update` | Non-admin owner | `supabase.from("workspaces").update({ config: {} }).eq("id", myWorkspace)` | Fails RLS. |
| `tasks select` | Member of workspace A | `supabase.from("tasks").select("*").eq("workspace_id", workspaceB)` | Returns no rows. |
| `tasks insert` | Member of workspace A | `supabase.from("tasks").insert({ workspace_id: workspaceB, title: "Cross workspace" })` | Fails RLS. |
| `tasks update` | Requester | `supabase.from("tasks").update({ stage: "routing" }).eq("id", taskId)` | Fails RLS or requester trigger. |
| `agent_runs all` | Member of workspace A | `supabase.from("agent_runs").insert({ workspace_id: workspaceB, task_id: taskB, agent_type: "x" })` | Fails RLS. |
| `audit_events select` | Member of workspace A | `supabase.from("audit_events").select("*").eq("workspace_id", workspaceB)` | Returns no rows. |
| `audit_events insert` | Any anon user | `supabase.from("audit_events").insert({ workspace_id: myWorkspace, event: "forged" })` | Fails because no insert policy exists. |

## RPCs

| Area | Actor | API call | Expected result |
| --- | --- | --- | --- |
| Onboarding | New signed-in user | `supabase.rpc("create_workspace_with_profile", { ws_name: "Acme", ws_config: {}, user_name: "A" })` | Succeeds and creates admin profile. |
| Onboarding | Same user | Same call again | Fails with `Already onboarded`. |
| Invite accept | Signed-out user | `supabase.rpc("accept_invite", { invite_token: token })` | Fails with authentication required. |
| Invite accept | Wrong email | `supabase.rpc("accept_invite", { invite_token: token })` | Fails with email mismatch. |
| Invite accept | Already onboarded user | `supabase.rpc("accept_invite", { invite_token: token })` | Fails with `Already onboarded`. |
| Admin role | Non-admin | `supabase.rpc("admin_set_role", { target_profile_id: memberId, new_role: "owner" })` | Fails admin check. |
| Admin role | Last admin | `supabase.rpc("admin_set_role", { target_profile_id: onlyAdminId, new_role: "owner" })` | Fails last-admin check. |
| Audit note | Non-member | `supabase.rpc("note_task_event", { task: taskInOtherWorkspace, note: "x" })` | Fails with task not found. |

## Task Guardrail Trigger

| Guardrail | Actor | API call | Expected result |
| --- | --- | --- | --- |
| Insert start stage | Member | `supabase.from("tasks").insert({ workspace_id: myWorkspace, title: "Bad", stage: "ready" })` | Fails: new tasks must start in intake. |
| Insert clean ownership | Member | `supabase.from("tasks").insert({ workspace_id: myWorkspace, title: "Bad", owner_id: myProfile })` | Fails: new tasks cannot start with owner/reviewer/signoff. |
| Requester submit-only | Requester | `supabase.from("tasks").update({ owner_id: requesterId }).eq("id", taskId)` | Fails requester guardrail. |
| Reviewer scope | Reviewer | `supabase.from("tasks").update({ stage: "routing" }).eq("id", intakeTaskId)` | Fails reviewer guardrail. |
| Reviewer self-review | Reviewer who owns task | `supabase.from("tasks").update({ checklist: fullChecklist }).eq("id", inReviewTaskId)` | Fails non-owner reviewer guardrail. |
| Direct track change | Owner/Admin | `supabase.from("tasks").update({ track: "quick" }).eq("id", fullTaskId)` | Fails dedicated reroute flow guardrail. |
| Stage graph | Owner/Admin | `supabase.from("tasks").update({ stage: "shipped" }).eq("id", intakeTaskId)` | Fails invalid stage transition. |
| Named owner | Owner/Admin | `supabase.from("tasks").update({ stage: "owned" }).eq("id", routingTaskWithoutOwner)` | Fails named-owner guardrail. |
| Quick checklist | Owner/Admin | `supabase.from("tasks").update({ stage: "ready" }).eq("id", ownedQuickTask)` | Fails incomplete Quick Check item. |
| Full checklist | Reviewer | `supabase.from("tasks").update({ reviewer_id: reviewerId, signoff: { reviewer_id: reviewerId }, stage: "ready" }).eq("id", inReviewFullTask)` | Fails incomplete Full Review item. |
| Missing signoff | Owner/Admin | `supabase.from("tasks").update({ stage: "ready", checklist: fullChecklist }).eq("id", inReviewFullTask)` | Fails missing reviewer sign-off. |
| Reviewer equals owner | Owner/Admin | `supabase.from("tasks").update({ reviewer_id: ownerId, signoff: { reviewer_id: ownerId }, checklist: fullChecklist, stage: "ready" }).eq("id", inReviewFullTask)` | Fails reviewer must differ from owner. |
| Invalid signoff id | Owner/Admin | `supabase.from("tasks").update({ reviewer_id: reviewerId, signoff: { reviewer_id: "bad" }, checklist: fullChecklist, stage: "ready" }).eq("id", inReviewFullTask)` | Fails invalid signoff reviewer id. |
| Signoff mismatch | Owner/Admin | `supabase.from("tasks").update({ reviewer_id: reviewerId, signoff: { reviewer_id: otherReviewerId }, checklist: fullChecklist, stage: "ready" }).eq("id", inReviewFullTask)` | Fails signoff reviewer mismatch. |
| Signoff wrong actor | Reviewer A | `supabase.from("tasks").update({ reviewer_id: reviewerB, signoff: { reviewer_id: reviewerB }, checklist: fullChecklist, stage: "ready" }).eq("id", inReviewFullTask)` | Fails assigned-reviewer check. |
| Signoff residue | Owner/Admin | `supabase.from("tasks").update({ signoff: { reviewer_id: reviewerId } }).eq("id", ownedFullTask)` | Fails signoff timing guardrail. |
| Reviewer assignment residue | Owner/Admin | `supabase.from("tasks").update({ reviewer_id: reviewerId }).eq("id", ownedFullTask)` | Fails reviewer assignment timing guardrail. |

## Reroute

| Guardrail | Actor | API call | Expected result |
| --- | --- | --- | --- |
| Reroute role | Requester/Reviewer | `supabase.rpc("reroute_task", { task: taskId, new_track: "full", reason: "risk found" })` | Fails owner/admin guardrail. |
| Downgrade reason | Task owner/Admin | `supabase.rpc("reroute_task", { task: fullTaskId, new_track: "quick", reason: "" })` | Fails downgrade reason guardrail. |
| Direct update bypass | Task owner/Admin | `supabase.from("tasks").update({ track: "quick" }).eq("id", fullTaskId)` | Fails dedicated reroute flow guardrail. |
