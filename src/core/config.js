/* ============================================================
   Default white-label config — the SAME schema as the static
   prototype's assets/config.js. Stored per-workspace in the
   `workspaces.config` jsonb column, so each client keeps their
   own brand, terminology, rules, and checklists.
   ============================================================ */
export const DEFAULT_CONFIG = {
  brand: {
    productName: "Agentic OS",
    version: "v0.1.0",
    companyName: "Advanced Agentic Systems",
    tagline: "Operate with clarity. One owner. Right track. Ship with confidence.",
    colors: { blue: "#1E5BFF", blueDeep: "#0F45E0", ink: "#0E1116", paper: "#F9F7F1", night: "#0A0D13" }
  },
  terms: {
    task: "Task", tasks: "Tasks", owner: "Owner", reviewer: "Reviewer",
    workstream: "Workstream", workstreams: "Workstreams", requester: "Requester",
    intake: "Intake", quickCheck: "Quick Check", fullReview: "Full Review", shipped: "Shipped"
  },
  workstreams: [
    { id: "ws_onboarding", name: "Client Onboarding" },
    { id: "ws_delivery", name: "Deliverables & Production" },
    { id: "ws_billing", name: "Billing & Invoicing" },
    { id: "ws_ops", name: "Internal Operations" }
  ],
  routingRules: [
    { id: "clientFacing", flag: "clientFacing", label: "Client-facing deliverable", why: "Reputational and brand risk" },
    { id: "financialLegal", flag: "financialLegal", label: "Financial / contractual impact", why: "Compliance exposure" },
    { id: "newProcess", flag: "newProcess", label: "New process or system involved", why: "Unproven, higher error rate" },
    { id: "irreversible", flag: "irreversible", label: "Irreversible or high-risk change", why: "No opportunity to correct after the fact" },
    { id: "ownerUncertain", flag: "ownerUncertain", label: "Uncertain owner", why: "Reduces risk of gaps in judgment" }
  ],
  checklists: {
    quick: [
      { id: "q_owner", label: "Owner confirmed and named" },
      { id: "q_routine", label: "Task matches an existing routine or template" },
      { id: "q_norisk", label: "No client-facing, financial, legal, or irreversible element" },
      { id: "q_meets", label: "Output meets the stated request" },
      { id: "q_self", label: "Owner has reviewed their own work once before marking done" }
    ],
    full: [
      { id: "f_request", label: "Original request validated" },
      { id: "f_legal", label: "Legal / Compliance review" },
      { id: "f_financial", label: "Financial accuracy check" },
      { id: "f_brand", label: "Brand / Client standards" },
      { id: "f_factual", label: "Factual verification" },
      { id: "f_irreversible", label: "Irreversible risk confirmation" },
      { id: "f_signoff", label: "Reviewer sign-off", requiresReviewer: true }
    ]
  },
  governance: {
    requireOwnerToProceed: true,
    requireReviewerSignoffForFull: true,
    defaultToFullReviewWhenUnsure: true,
    downgradeRequiresReason: true,
    atRiskDays: 2
  }
};
