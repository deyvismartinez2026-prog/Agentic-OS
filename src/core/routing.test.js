import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import {
  canShip,
  canStartWork,
  downgradeNeedsReason,
  recommendTrack,
  validReviewer
} from "./routing";

const ownerId = "11111111-1111-1111-1111-111111111111";
const reviewerId = "22222222-2222-2222-2222-222222222222";

function completeChecklist(items) {
  return Object.fromEntries(items.map((item) => [item.id, true]));
}

describe("recommendTrack", () => {
  it("routes unflagged work to quick check with 90% confidence", () => {
    expect(recommendTrack({ flags: {} }, DEFAULT_CONFIG)).toMatchObject({
      track: "quick",
      confidence: 90,
      reasons: []
    });
  });

  it("uses the configured flag count for the full-review confidence curve", () => {
    const oneFlag = recommendTrack({ flags: { financialLegal: true } }, DEFAULT_CONFIG);
    const twoFlags = recommendTrack({ flags: { financialLegal: true, clientFacing: true } }, DEFAULT_CONFIG);

    expect(oneFlag).toMatchObject({ track: "full", confidence: 81 });
    expect(twoFlags.confidence).toBe(90);
    expect(twoFlags.reasons.map((reason) => reason.flag)).toEqual(["clientFacing", "financialLegal"]);
  });

  it("caps full-review confidence at 97%", () => {
    const manyRules = {
      ...DEFAULT_CONFIG,
      routingRules: Array.from({ length: 5 }, (_, index) => ({
        id: `rule${index}`,
        flag: `flag${index}`,
        label: `Flag ${index}`,
        why: "test"
      }))
    };
    const flags = Object.fromEntries(manyRules.routingRules.map((rule) => [rule.flag, true]));

    expect(recommendTrack({ flags }, manyRules)).toMatchObject({
      track: "full",
      confidence: 97
    });
  });
});

describe("canShip", () => {
  it("allows completed quick work from ready", () => {
    expect(canShip({
      stage: "ready",
      track: "quick",
      owner_id: ownerId,
      checklist: completeChecklist(DEFAULT_CONFIG.checklists.quick)
    }, DEFAULT_CONFIG)).toBe(true);
  });

  it("blocks quick work before ready and with incomplete checklist", () => {
    expect(canShip({
      stage: "owned",
      track: "quick",
      owner_id: ownerId,
      checklist: completeChecklist(DEFAULT_CONFIG.checklists.quick)
    }, DEFAULT_CONFIG)).toBe(false);

    expect(canShip({
      stage: "ready",
      track: "quick",
      owner_id: ownerId,
      checklist: {}
    }, DEFAULT_CONFIG)).toBe(false);
  });

  it("blocks shipped, blocked, ownerless, and non-ready tasks", () => {
    const readyQuick = {
      stage: "ready",
      track: "quick",
      owner_id: ownerId,
      checklist: completeChecklist(DEFAULT_CONFIG.checklists.quick)
    };

    expect(canShip({ ...readyQuick, stage: "shipped" }, DEFAULT_CONFIG)).toBe(false);
    expect(canShip({ ...readyQuick, blocked: true }, DEFAULT_CONFIG)).toBe(false);
    expect(canShip({ ...readyQuick, stage: "owned" }, DEFAULT_CONFIG)).toBe(false);
    expect(canShip({ ...readyQuick, owner_id: null }, DEFAULT_CONFIG)).toBe(false);
  });

  it("requires non-owner reviewer sign-off for full review", () => {
    expect(canShip({
      stage: "ready",
      track: "full",
      owner_id: ownerId,
      reviewer_id: ownerId,
      checklist: completeChecklist(DEFAULT_CONFIG.checklists.full),
      signoff: { reviewer_id: ownerId }
    }, DEFAULT_CONFIG)).toBe(false);

    expect(canShip({
      stage: "ready",
      track: "full",
      owner_id: ownerId,
      reviewer_id: reviewerId,
      checklist: completeChecklist(DEFAULT_CONFIG.checklists.full),
      signoff: { reviewer_id: reviewerId }
    }, DEFAULT_CONFIG)).toBe(true);
  });

  it("requires full-review checklist completion before sign-off can ship", () => {
    expect(canShip({
      stage: "ready",
      track: "full",
      owner_id: ownerId,
      reviewer_id: reviewerId,
      checklist: {},
      signoff: { reviewer_id: reviewerId }
    }, DEFAULT_CONFIG)).toBe(false);
  });

  it("honors governance switches", () => {
    const relaxedConfig = {
      ...DEFAULT_CONFIG,
      governance: {
        ...DEFAULT_CONFIG.governance,
        requireOwnerToProceed: false,
        requireReviewerSignoffForFull: false
      }
    };

    expect(canShip({
      stage: "ready",
      track: "full",
      checklist: completeChecklist(DEFAULT_CONFIG.checklists.full)
    }, relaxedConfig)).toBe(true);

    expect(canShip({
      stage: "ready",
      track: "quick",
      checklist: completeChecklist(DEFAULT_CONFIG.checklists.quick)
    }, relaxedConfig)).toBe(true);
  });
});

describe("validReviewer", () => {
  it("requires a full-review reviewer who is not the owner", () => {
    expect(validReviewer({ track: "quick" })).toBe(true);
    expect(validReviewer({ track: "full", owner_id: ownerId })).toBe(false);
    expect(validReviewer({ track: "full", owner_id: ownerId, reviewer_id: ownerId })).toBe(false);
    expect(validReviewer({ track: "full", owner_id: ownerId, reviewer_id: reviewerId })).toBe(true);
  });
});

describe("canStartWork", () => {
  it("requires a named owner", () => {
    expect(canStartWork({})).toBe(false);
    expect(canStartWork({ owner_id: ownerId })).toBe(true);
    expect(canStartWork({ ownerId })).toBe(true);
  });
});

describe("downgradeNeedsReason", () => {
  it("requires a reason when moving recommended full-review work to quick check", () => {
    const riskyTask = { flags: { clientFacing: true } };

    expect(downgradeNeedsReason(riskyTask, "quick", DEFAULT_CONFIG)).toBe(true);
    expect(downgradeNeedsReason(riskyTask, "full", DEFAULT_CONFIG)).toBe(false);
    expect(downgradeNeedsReason({ flags: {} }, "quick", DEFAULT_CONFIG)).toBe(false);
  });
});
