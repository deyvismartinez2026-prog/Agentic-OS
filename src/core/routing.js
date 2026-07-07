/* ============================================================
   Core operating logic — ported 1:1 from the static prototype
   (assets/os.js). Pure functions, no framework, no I/O: the
   routing engine and the guardrails ARE the product, so they
   carry over unchanged.
   ============================================================ */

/** Recommend a review track from a task's risk flags. */
export function recommendTrack(task, config) {
  const flags = task.flags || {};
  const reasons = (config.routingRules || []).filter((r) => flags[r.flag]);
  if (reasons.length) {
    return { track: "full", reasons, confidence: Math.min(97, 72 + 9 * reasons.length) };
  }
  return { track: "quick", reasons: [], confidence: 90 };
}

/** Guardrail: can this task ship? */
export function canShip(task, config) {
  if (task.stage === "shipped" || task.blocked) return false;
  if (task.stage !== "ready") return false;
  if (config.governance?.requireOwnerToProceed !== false && !task.owner_id && !task.ownerId) return false;
  if (task.track === "full") {
    const fullItems = config.checklists?.full || [];
    if (!fullItems.every((i) => task.checklist && task.checklist[i.id])) return false;
    if (config.governance?.requireReviewerSignoffForFull === false) return true;
    return !!task.signoff && validReviewer(task);
  }
  const items = config.checklists?.quick || [];
  return items.every((i) => task.checklist && task.checklist[i.id]);
}

/** Guardrail: can this task move out of routing into owned work? */
export function canStartWork(task) {
  return !!(task.owner_id || task.ownerId);
}

/** Guardrail: valid reviewer — required for full, never the owner. */
export function validReviewer(task) {
  const owner = task.owner_id || task.ownerId;
  const reviewer = task.reviewer_id || task.reviewerId;
  if (task.track !== "full") return true;
  return !!reviewer && reviewer !== owner;
}

/** Is a track change a downgrade that requires a logged reason? */
export function downgradeNeedsReason(task, newTrack, config) {
  return newTrack === "quick" && recommendTrack(task, config).track === "full";
}

export const STAGES = ["intake", "routing", "owned", "in_review", "ready", "shipped"];

export const STAGE_LABELS = {
  intake: "Intake", routing: "Routing", owned: "Owned",
  in_review: "In Review", ready: "Ready to Ship", shipped: "Shipped"
};
