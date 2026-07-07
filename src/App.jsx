import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { DEFAULT_CONFIG } from "./core/config";
import { recommendTrack, canShip, canStartWork, validReviewer, STAGES, STAGE_LABELS } from "./core/routing";

/* ============================================================
   AAS Agentic OS — React + Supabase pilot scaffold.
   Proves the port: the SAME config schema and routing/guardrail
   core as the static prototype, now multi-user with RLS.
   The full Command Center UI ports screen-by-screen on top.
   ============================================================ */

function mergeConfig(base, override) {
  if (override == null) return base;
  if (typeof override !== "object") return override;
  if (Array.isArray(base) || Array.isArray(override)) return override;
  return Object.fromEntries(
    Object.keys({ ...base, ...override }).map((key) => [
      key,
      mergeConfig(base?.[key], override[key])
    ])
  );
}

function checklistComplete(task, config, listName) {
  const items = checklistItems(config, listName);
  return items.every((item) => task.checklist?.[item.id]);
}

function checklistItems(config, listName) {
  return config.checklists?.[listName] || [];
}

const ROLE_OPTIONS = ["admin", "owner", "reviewer", "requester"];
const canManageTasks = (role) => role === "admin" || role === "owner";
const canReviewTasks = (role) => role === "admin" || role === "owner" || role === "reviewer";

function SetupScreen() {
  return (
    <div className="wrap">
      <h1 className="serif">Agentic OS <em>·</em> Pilot Setup</h1>
      <p className="lede">This is the multi-user (React + Supabase) build. Three steps to connect:</p>
      <ol className="steps">
        <li>Create a free project at <b>supabase.com</b>.</li>
        <li>Open <b>SQL Editor</b> and run <code>supabase/schema.sql</code> (tables, guardrail triggers, row-level security).</li>
        <li>Copy <code>.env.example</code> → <code>.env.local</code> and fill in your project URL + anon key, then restart <code>npm run dev</code>.</li>
      </ol>
      <p className="muted">The white-label config schema and the routing/guardrail engine are identical to the
        static prototype — see <code>src/core/</code>. What Supabase adds: real accounts, shared data, and
        database-level guardrail enforcement.</p>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  async function send(e) {
    e.preventDefault();
    setErr("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setErr("Enter an email address.");
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) setErr(error.message);
    else {
      setEmail(trimmedEmail);
      setSent(true);
    }
  }
  return (
    <div className="wrap">
      <h1 className="serif">Agentic OS <em>·</em> Sign in</h1>
      {sent ? (
        <p className="lede">Magic link sent to <b>{email}</b> — check your inbox.</p>
      ) : (
        <form onSubmit={send} className="row">
          <input type="email" required placeholder="you@company.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <button className="btn">Send magic link</button>
        </form>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function Onboarding({ initialInviteToken = "", onDone }) {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [inviteToken, setInviteToken] = useState(initialInviteToken);
  const [err, setErr] = useState("");
  async function createWorkspace(e) {
    e.preventDefault();
    setErr("");
    const companyName = company.trim();
    const userName = name.trim();
    if (!companyName || !userName) return setErr("Company and name are required.");
    const { error } = await supabase.rpc("create_workspace_with_profile", {
      ws_name: companyName,
      ws_config: { ...DEFAULT_CONFIG, brand: { ...DEFAULT_CONFIG.brand, companyName } },
      user_name: userName
    });
    if (error) return setErr(error.message);
    onDone();
  }

  async function joinWorkspace(e) {
    e.preventDefault();
    setErr("");
    const token = inviteToken.trim();
    if (!token) return setErr("Enter an invite token.");
    const { error } = await supabase.rpc("accept_invite", { invite_token: token });
    if (error) return setErr(error.message);
    window.history.replaceState(null, "", window.location.pathname);
    onDone();
  }

  return (
    <div className="wrap">
      <h1 className="serif">Join Agentic OS</h1>
      <form onSubmit={createWorkspace} className="card col">
        <h2>Create a workspace</h2>
        <input required placeholder="Company / client name" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn">Create workspace →</button>
      </form>
      <form onSubmit={joinWorkspace} className="card col">
        <h2>Join with an invite code</h2>
        <input placeholder="Invite token" value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} />
        <button className="btn">Join workspace →</button>
      </form>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function Board({ profile }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [title, setTitle] = useState("");
  const [flags, setFlags] = useState({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("reviewer");
  const [inviteLink, setInviteLink] = useState("");
  const [err, setErr] = useState("");
  const isAdmin = profile.role === "admin";
  const canManage = canManageTasks(profile.role);
  const canReviewRole = canReviewTasks(profile.role);

  const refresh = useCallback(async () => {
    const [{ data: ws, error: wsError }, { data: rows, error: tasksError }, { data: memberRows, error: membersError }, inviteResult] = await Promise.all([
      supabase.from("workspaces").select("config").eq("id", profile.workspace_id).single(),
      supabase.from("tasks").select("*").eq("workspace_id", profile.workspace_id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,name,role,title,created_at").eq("workspace_id", profile.workspace_id).order("created_at", { ascending: true }),
      isAdmin
        ? supabase.from("invites").select("email,role,token,accepted_at,created_at").eq("workspace_id", profile.workspace_id).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ]);
    const { data: inviteRows, error: invitesError } = inviteResult;
    const errors = [wsError, tasksError, membersError, invitesError].filter(Boolean);
    if (ws?.config) setConfig(mergeConfig(DEFAULT_CONFIG, ws.config));
    if (errors.length) setErr(errors.map((error) => error.message).join(" "));
    else {
      setErr("");
      setTasks(rows || []);
      setMembers(memberRows || []);
      setInvites(inviteRows || []);
    }
  }, [isAdmin, profile.workspace_id]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`tasks:${profile.workspace_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${profile.workspace_id}` },
        refresh
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile.workspace_id, refresh]);

  async function mutate(id, patch, guard = (query) => query) {
    setErr("");
    const query = guard(
      supabase.from("tasks").update(patch).eq("id", id).eq("workspace_id", profile.workspace_id)
    );
    const { data, error } = await query.select("id");
    if (error) { setErr(error.message); return false; } // DB guardrail triggers surface here
    if (!data?.length) {
      setErr("This task changed before your update could be applied. The board has been refreshed.");
      await refresh();
      return false;
    }
    refresh();
    return true;
  }

  async function submitRequest(e) {
    e.preventDefault();
    setErr("");
    const requestTitle = title.trim();
    if (!requestTitle) return setErr("Enter a request title.");
    const rec = recommendTrack({ flags }, config);
    const { error } = await supabase.from("tasks")
      .insert({ workspace_id: profile.workspace_id, title: requestTitle, flags, track: rec.track, stage: "intake" })
      .select("id").single();
    if (error) return setErr(error.message);
    setTitle(""); setFlags({});
    refresh();
  }

  async function createInvite(e) {
    e.preventDefault();
    setErr("");
    setInviteLink("");
    const email = inviteEmail.trim();
    if (!email) return setErr("Enter an invite email.");
    const { data, error } = await supabase.from("invites")
      .insert({ workspace_id: profile.workspace_id, email, role: inviteRole, created_by: profile.id })
      .select("token")
      .single();
    if (error) return setErr(error.message);
    setInviteEmail("");
    setInviteLink(`${window.location.origin}?invite=${data.token}`);
    refresh();
  }

  async function changeRole(memberId, role) {
    setErr("");
    const { error } = await supabase.rpc("admin_set_role", {
      target_profile_id: memberId,
      new_role: role
    });
    if (error) return setErr(error.message);
    refresh();
  }

  const rec = recommendTrack({ flags }, config);
  const t = config.terms;

  return (
    <div className="wrap wide">
      <h1 className="serif">{config.brand.companyName} <em>·</em> Command Center</h1>
      <p className="muted">Signed in as {profile.name} ({profile.role}) · workspace data is isolated by Supabase RLS</p>

      <form onSubmit={submitRequest} className="card">
        <div className="row">
          <input required placeholder="New request title…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <span className="chip">{rec.track === "full" ? t.fullReview : t.quickCheck} · {rec.confidence}%</span>
          <button className="btn">Submit request</button>
        </div>
        <div className="flags">
          {config.routingRules.map((r) => (
            <label key={r.flag}>
              <input type="checkbox" checked={!!flags[r.flag]}
                onChange={(e) => setFlags({ ...flags, [r.flag]: e.target.checked })} /> {r.label}
            </label>
          ))}
        </div>
      </form>

      {err && <p className="error">Guardrail / error: {err}</p>}

      {isAdmin && (
        <section className="card admin-panel">
          <div>
            <h2>Team access</h2>
            <p className="muted">Invite teammates and adjust workspace roles. Invited users accept with the same email address.</p>
          </div>
          <form onSubmit={createInvite} className="row">
            <input type="email" placeholder="teammate@company.com" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)} />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <button className="btn">Create invite</button>
          </form>
          {inviteLink && <p className="invite-link">Invite token: <code>{inviteLink}</code></p>}
          <div className="team-list">
            {members.map((member) => (
              <div key={member.id} className="team-row">
                <span>{member.name || "Unnamed"} <small>{member.id === profile.id ? "you" : ""}</small></span>
                <select value={member.role} onChange={(e) => changeRole(member.id, e.target.value)}>
                  {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
            ))}
          </div>
          {invites.length > 0 && (
            <div className="pending-invites">
              {invites.map((invite) => (
                <small key={invite.token}>
                  {invite.email} · {invite.role} · {invite.accepted_at ? "accepted" : "pending"}
                </small>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="board">
        {STAGES.map((stage) => (
          <div key={stage} className="col-stage">
            <h3>{STAGE_LABELS[stage]} <span>{tasks.filter((x) => x.stage === stage).length}</span></h3>
            {tasks.filter((x) => x.stage === stage).map((task) => {
              const isTaskOwner = task.owner_id === profile.id;
              const isValidReviewer = validReviewer({ ...task, reviewer_id: profile.id });
              const canRecordReview = canReviewRole && (
                task.reviewer_id ? task.reviewer_id === profile.id : isValidReviewer
              );
              const quickDone = checklistComplete(task, config, "quick");
              const fullDone = checklistComplete(task, config, "full");
              const fullItems = checklistItems(config, "full");
              return (
                <div key={task.id} className="tcard">
                  <b>{task.title}</b>
                  <small>{task.track === "full" ? t.fullReview : t.quickCheck}{task.owner_id ? "" : " · no owner"}</small>
                  <div className="acts">
                    {stage === "intake" && (
                      <button disabled={!canManage} onClick={() => mutate(task.id, { stage: "routing" }, (query) => query.eq("stage", "intake"))}>Route →</button>
                    )}
                    {stage === "routing" && !task.owner_id && (
                      <button disabled={!canManage} onClick={() => mutate(task.id, { owner_id: profile.id },
                        (query) => query.eq("stage", "routing").is("owner_id", null))}>Own it</button>
                    )}
                    {stage === "routing" && isTaskOwner && canStartWork({ ownerId: task.owner_id }) && (
                      <button disabled={!canManage} onClick={() => mutate(task.id, { stage: "owned" },
                        (query) => query.eq("stage", "routing").eq("owner_id", profile.id))}>Accept →</button>
                    )}
                    {stage === "owned" && task.track === "quick" && (
                      <div className="checklist">
                        {checklistItems(config, "quick").map((item) => (
                          <label key={item.id}>
                            <input
                              type="checkbox"
                              checked={!!task.checklist?.[item.id]}
                              disabled={!canManage || !isTaskOwner}
                              onChange={(e) => mutate(task.id,
                                { checklist: { ...task.checklist, [item.id]: e.target.checked } },
                                (query) => query.eq("stage", "owned").eq("owner_id", profile.id)
                              )}
                            /> {item.label}
                          </label>
                        ))}
                        <button
                          disabled={!canManage || !isTaskOwner || !quickDone}
                          onClick={() => mutate(task.id, { stage: "ready" },
                            (query) => query.eq("stage", "owned").eq("owner_id", profile.id))}>
                          Mark ready →
                        </button>
                      </div>
                    )}
                    {stage === "owned" && task.track === "full" && (
                      <button disabled={!canManage || !isTaskOwner} onClick={() => mutate(task.id,
                        { stage: "in_review" },
                        (query) => query.eq("stage", "owned").eq("owner_id", profile.id))}>Request review →</button>
                    )}
                    {stage === "in_review" && task.track === "full" && (
                      <div className="checklist">
                        {fullItems.map((item) => (
                          <label key={item.id}>
                            <input
                              type="checkbox"
                              checked={!!task.checklist?.[item.id]}
                              disabled={!canRecordReview}
                              onChange={(e) => mutate(task.id,
                                { checklist: { ...task.checklist, [item.id]: e.target.checked } },
                                (query) => query.eq("stage", "in_review").neq("owner_id", profile.id)
                              )}
                            /> {item.label}
                          </label>
                        ))}
                        <button disabled={!canRecordReview || !fullDone} onClick={() => mutate(task.id,
                          { reviewer_id: profile.id, signoff: { reviewer_id: profile.id, ts: new Date().toISOString() }, stage: "ready" },
                          (query) => query.eq("stage", "in_review").neq("owner_id", profile.id).is("reviewer_id", null))}>Record sign-off</button>
                      </div>
                    )}
                    {stage === "ready" && (
                      <button
                        disabled={!canManage || !canShip({ ...task, ownerId: task.owner_id }, config)}
                        onClick={() => mutate(task.id, { stage: "shipped" },
                          (query) => query.eq("stage", "ready"))}>
                        Ship
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(undefined); // undefined = loading
  const inviteToken = new URLSearchParams(window.location.search).get("invite");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    if (!session) { setProfile(undefined); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    setProfile(data || null); // null = signed in but not onboarded
  }, [session]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (!supabase) return <SetupScreen />;
  if (!session) return <SignIn />;
  if (profile === undefined) return <div className="wrap"><p className="muted">Loading…</p></div>;
  if (profile === null) return <Onboarding initialInviteToken={inviteToken || ""} onDone={loadProfile} />;
  return <Board profile={profile} />;
}
