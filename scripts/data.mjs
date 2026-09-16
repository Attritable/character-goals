/**
 * Character Goals — flag shape, CRUD, and permission helpers.
 * Pure ESM: no Foundry runtime required (offline tests import this file).
 *
 * Hierarchy follows the Fishel proactive-goal shell (players invent measurable
 * long/mid goals, then 1–2 short steps). Complications, approve/reject, and
 * default-hidden visibility are table process — not book mechanics.
 *
 * Hidden means hidden from other players only. Every GM always sees all nodes.
 * Parent and short goals persist optional successStake / failureStake strings.
 */

export const MODULE_ID = "character-goals";
export const TAB_ID = "character-goals";
export const FLAG_KEY = MODULE_ID;
export const MAX_SHORT_GOALS = 2;
/** @deprecated use MAX_SHORT_GOALS */
export const SHORT_GOAL_HINT_MAX = MAX_SHORT_GOALS;

export const NODE_TYPE = Object.freeze({
  goal: "goal_longmid",
  shortGoal: "goal_short",
  complication: "complication",
});

export const APPROVAL = Object.freeze({
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
});

export const NODE_KIND = Object.freeze({
  goal: "goal",
  shortGoal: "shortGoal",
  complication: "complication",
});

export const ACTIONS = Object.freeze({
  ADD_GOAL: "addGoal",
  ADD_SHORT_GOAL: "addShortGoal",
  ADD_COMPLICATION: "addComplication",
  EDIT: "edit",
  DELETE: "delete",
  APPROVE: "approve",
  REJECT: "reject",
  TOGGLE_VISIBILITY: "toggleVisibility",
  SEE: "see",
  SEE_LINKS: "seeLinks",
  LINK_ITEM: "linkItem",
  UPDATE_STAKES: "updateStakes",
});

export const OWNERSHIP_OWNER = 3;

/** @returns {string} */
export function createId() {
  if (globalThis.foundry?.utils?.randomID) return foundry.utils.randomID();
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return `cg${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

export function emptyFlag() {
  return { goals: [] };
}

export function isGM(user) {
  return Boolean(user?.isGM);
}

export function isCreator(node, user) {
  return Boolean(user?.id) && node?.visibility?.createdBy === user.id;
}

/**
 * Owner of the actor (or GM). Uses Foundry permission APIs when present.
 * @param {object} actor
 * @param {object} user
 */
export function isOwner(actor, user) {
  if (!actor || !user) return false;
  if (isGM(user)) return true;
  if (typeof actor.testUserPermission === "function") {
    return actor.testUserPermission(user, "OWNER");
  }
  if (typeof actor.isOwner === "boolean" && actor.ownership == null) {
    return actor.isOwner;
  }
  const level = actor.ownership?.[user.id] ?? actor.ownership?.default ?? 0;
  return Number(level) >= OWNERSHIP_OWNER;
}

export function canUserUpdateActor(actor, user) {
  if (!actor || !user) return false;
  if (isGM(user)) return true;
  if (typeof actor.canUserModify === "function") {
    return actor.canUserModify(user, "update");
  }
  return isOwner(actor, user);
}

/**
 * Creator and every GM always see the node.
 * Hidden (`visibleToAll: false`) means hidden from other players only.
 */
export function canSeeNode(node, user) {
  if (!node || !user) return false;
  if (isGM(user)) return true;
  if (node.visibility?.visibleToAll) return true;
  return isCreator(node, user);
}

export function canSeeLinkedItems(user) {
  return isGM(user);
}

export function authorize(action, { user, actor, node } = {}) {
  switch (action) {
    case ACTIONS.ADD_GOAL:
    case ACTIONS.ADD_SHORT_GOAL:
      return isGM(user) || isOwner(actor, user);
    case ACTIONS.ADD_COMPLICATION:
      return Boolean(user?.id);
    case ACTIONS.EDIT:
    case ACTIONS.DELETE:
    case ACTIONS.UPDATE_STAKES:
      return isGM(user) || isCreator(node, user);
    case ACTIONS.APPROVE:
    case ACTIONS.REJECT:
    case ACTIONS.TOGGLE_VISIBILITY:
      return isGM(user);
    case ACTIONS.SEE:
      return canSeeNode(node, user);
    case ACTIONS.SEE_LINKS:
      return canSeeLinkedItems(user);
    case ACTIONS.LINK_ITEM:
      return isGM(user) || isCreator(node, user) || isOwner(actor, user);
    default:
      return false;
  }
}

export function createVisibility(userId) {
  return { createdBy: String(userId ?? ""), visibleToAll: false };
}

export function createLinkedItem({ uuid, name, img } = {}) {
  if (!uuid) return null;
  const item = { uuid: String(uuid) };
  if (name != null && name !== "") item.name = String(name);
  if (img != null && img !== "") item.img = String(img);
  return item;
}

function nowIso() {
  return new Date().toISOString();
}

export function createComplication({ text = "", userId } = {}) {
  return {
    id: createId(),
    type: NODE_TYPE.complication,
    text: String(text ?? ""),
    visibility: createVisibility(userId),
    createdAt: nowIso(),
    linkedItems: [],
  };
}

export function normalizeStake(raw) {
  return typeof raw === "string" ? raw : "";
}

export function createShortGoal({ text = "", userId, successStake = "", failureStake = "" } = {}) {
  return {
    id: createId(),
    type: NODE_TYPE.shortGoal,
    text: String(text ?? ""),
    approval: APPROVAL.pending,
    visibility: createVisibility(userId),
    createdAt: nowIso(),
    successStake: normalizeStake(successStake),
    failureStake: normalizeStake(failureStake),
    complications: [],
    linkedItems: [],
  };
}

export function createGoal({ text = "", userId, successStake = "", failureStake = "" } = {}) {
  return {
    id: createId(),
    type: NODE_TYPE.goal,
    text: String(text ?? ""),
    approval: APPROVAL.pending,
    visibility: createVisibility(userId),
    createdAt: nowIso(),
    successStake: normalizeStake(successStake),
    failureStake: normalizeStake(failureStake),
    shortGoals: [],
    complications: [],
    linkedItems: [],
  };
}

function normalizeVisibility(raw) {
  return {
    createdBy: typeof raw?.createdBy === "string" ? raw.createdBy : "",
    visibleToAll: Boolean(raw?.visibleToAll),
  };
}

function normalizeApproval(raw) {
  if (raw === APPROVAL.approved || raw === APPROVAL.rejected || raw === APPROVAL.pending) return raw;
  return APPROVAL.pending;
}

function normalizeLinkedItem(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.uuid !== "string" || !raw.uuid) return null;
  return createLinkedItem(raw);
}

function normalizeCreatedAt(raw) {
  return typeof raw === "string" && raw ? raw : undefined;
}

function normalizeComplication(raw) {
  if (!raw || typeof raw !== "object") return null;
  const node = {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    type: NODE_TYPE.complication,
    text: String(raw.text ?? ""),
    visibility: normalizeVisibility(raw.visibility),
    linkedItems: Array.isArray(raw.linkedItems)
      ? raw.linkedItems.map(normalizeLinkedItem).filter(Boolean)
      : [],
  };
  const createdAt = normalizeCreatedAt(raw.createdAt);
  if (createdAt) node.createdAt = createdAt;
  return node;
}

function normalizeShortGoal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const node = {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    type: NODE_TYPE.shortGoal,
    text: String(raw.text ?? ""),
    approval: normalizeApproval(raw.approval),
    visibility: normalizeVisibility(raw.visibility),
    complications: Array.isArray(raw.complications)
      ? raw.complications.map(normalizeComplication).filter(Boolean)
      : [],
    linkedItems: Array.isArray(raw.linkedItems)
      ? raw.linkedItems.map(normalizeLinkedItem).filter(Boolean)
      : [],
    successStake: normalizeStake(raw.successStake),
    failureStake: normalizeStake(raw.failureStake),
  };
  const createdAt = normalizeCreatedAt(raw.createdAt);
  if (createdAt) node.createdAt = createdAt;
  if (typeof raw.rejectReason === "string" && raw.rejectReason) node.rejectReason = raw.rejectReason;
  return node;
}

function normalizeGoal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const node = {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    type: NODE_TYPE.goal,
    text: String(raw.text ?? ""),
    approval: normalizeApproval(raw.approval),
    visibility: normalizeVisibility(raw.visibility),
    shortGoals: Array.isArray(raw.shortGoals)
      ? raw.shortGoals.map(normalizeShortGoal).filter(Boolean)
      : [],
    complications: Array.isArray(raw.complications)
      ? raw.complications.map(normalizeComplication).filter(Boolean)
      : [],
    linkedItems: Array.isArray(raw.linkedItems)
      ? raw.linkedItems.map(normalizeLinkedItem).filter(Boolean)
      : [],
    successStake: normalizeStake(raw.successStake),
    failureStake: normalizeStake(raw.failureStake),
  };
  const createdAt = normalizeCreatedAt(raw.createdAt);
  if (createdAt) node.createdAt = createdAt;
  if (typeof raw.rejectReason === "string" && raw.rejectReason) node.rejectReason = raw.rejectReason;
  return node;
}

export function normalizeFlag(raw) {
  if (!raw || typeof raw !== "object") return emptyFlag();
  const source = Array.isArray(raw.goals) ? raw.goals : Array.isArray(raw) ? raw : [];
  return { goals: source.map(normalizeGoal).filter(Boolean) };
}

export function cloneFlag(flag) {
  return structuredClone(normalizeFlag(flag));
}

/**
 * Locate a goal, short-term goal, or complication by id.
 * @returns {{ node: object, kind: string, goal: object, parent: object|null } | null}
 */
export function findNode(flag, nodeId) {
  // Walk the given tree in place so mutations apply to the same objects.
  const goals = Array.isArray(flag?.goals) ? flag.goals : normalizeFlag(flag).goals;
  if (!nodeId) return null;
  for (const goal of goals) {
    if (goal.id === nodeId) return { node: goal, kind: NODE_KIND.goal, goal, parent: null };
    for (const shortGoal of goal.shortGoals) {
      if (shortGoal.id === nodeId) {
        return { node: shortGoal, kind: NODE_KIND.shortGoal, goal, parent: goal };
      }
      for (const complication of shortGoal.complications) {
        if (complication.id === nodeId) {
          return { node: complication, kind: NODE_KIND.complication, goal, parent: shortGoal };
        }
      }
    }
    for (const complication of goal.complications) {
      if (complication.id === nodeId) {
        return { node: complication, kind: NODE_KIND.complication, goal, parent: goal };
      }
    }
  }
  return null;
}

function fail(error) {
  return { ok: false, error, flag: null };
}

function ok(flag) {
  return { ok: true, error: null, flag: normalizeFlag(flag) };
}

function requireAuth(ctx, action, node) {
  if (!authorize(action, { user: ctx.user, actor: ctx.actor, node })) {
    return fail(`Not permitted: ${action}`);
  }
  return null;
}

function applyApproval(node, approval, rejectReason) {
  node.approval = normalizeApproval(approval);
  if (node.approval === APPROVAL.rejected) {
    node.rejectReason = String(rejectReason ?? "");
  } else {
    delete node.rejectReason;
  }
}

/**
 * Single write path. Always authorize against ctx.user (the requester),
 * never against a relaying GM.
 *
 * @param {object} flag
 * @param {object} mutation
 * @param {{ user: object, actor: object }} ctx
 */
export function applyMutation(flag, mutation, ctx = {}) {
  if (!mutation || typeof mutation !== "object" || !mutation.type) {
    return fail("Invalid mutation");
  }
  const next = cloneFlag(flag);
  const userId = ctx.user?.id;

  switch (mutation.type) {
    case "addGoal": {
      const denied = requireAuth(ctx, ACTIONS.ADD_GOAL);
      if (denied) return denied;
      const text = String(mutation.text ?? "").trim();
      if (!text) return fail("Goal text is required");
      next.goals.push(createGoal({
        text,
        userId,
        successStake: mutation.successStake,
        failureStake: mutation.failureStake,
      }));
      return ok(next);
    }
    case "addShortGoal": {
      const denied = requireAuth(ctx, ACTIONS.ADD_SHORT_GOAL);
      if (denied) return denied;
      const found = findNode(next, mutation.goalId);
      if (!found || found.kind !== NODE_KIND.goal) return fail("Goal not found");
      const text = String(mutation.text ?? "").trim();
      if (!text) return fail("Short-term goal text is required");
      if (found.node.shortGoals.length >= MAX_SHORT_GOALS) {
        return fail(`At most ${MAX_SHORT_GOALS} short-term goals per parent`);
      }
      found.node.shortGoals.push(createShortGoal({
        text,
        userId,
        successStake: mutation.successStake,
        failureStake: mutation.failureStake,
      }));
      return ok(next);
    }
    case "addComplication": {
      const denied = requireAuth(ctx, ACTIONS.ADD_COMPLICATION);
      if (denied) return denied;
      const found = findNode(next, mutation.parentId);
      if (!found || found.kind === NODE_KIND.complication) return fail("Parent not found");
      const text = String(mutation.text ?? "").trim();
      if (!text) return fail("Complication text is required");
      found.node.complications.push(createComplication({ text, userId }));
      return ok(next);
    }
    case "updateText": {
      const found = findNode(next, mutation.nodeId);
      if (!found) return fail("Node not found");
      const denied = requireAuth(ctx, ACTIONS.EDIT, found.node);
      if (denied) return denied;
      const text = String(mutation.text ?? "").trim();
      if (!text) return fail("Text is required");
      found.node.text = text;
      if (found.kind !== NODE_KIND.complication) {
        if ("successStake" in mutation) found.node.successStake = normalizeStake(mutation.successStake);
        if ("failureStake" in mutation) found.node.failureStake = normalizeStake(mutation.failureStake);
      }
      return ok(next);
    }
    case "updateStakes": {
      const found = findNode(next, mutation.nodeId);
      if (!found) return fail("Node not found");
      if (found.kind === NODE_KIND.complication) return fail("Stakes apply to goals only");
      const denied = requireAuth(ctx, ACTIONS.UPDATE_STAKES, found.node);
      if (denied) return denied;
      if ("successStake" in mutation) found.node.successStake = normalizeStake(mutation.successStake);
      if ("failureStake" in mutation) found.node.failureStake = normalizeStake(mutation.failureStake);
      return ok(next);
    }
    case "deleteNode": {
      const found = findNode(next, mutation.nodeId);
      if (!found) return fail("Node not found");
      const denied = requireAuth(ctx, ACTIONS.DELETE, found.node);
      if (denied) return denied;
      if (found.kind === NODE_KIND.goal) {
        next.goals = next.goals.filter((goal) => goal.id !== found.node.id);
      } else if (found.kind === NODE_KIND.shortGoal) {
        found.parent.shortGoals = found.parent.shortGoals.filter((row) => row.id !== found.node.id);
      } else {
        found.parent.complications = found.parent.complications.filter((row) => row.id !== found.node.id);
      }
      return ok(next);
    }
    case "setApproval": {
      const found = findNode(next, mutation.nodeId);
      if (!found) return fail("Node not found");
      if (found.kind === NODE_KIND.complication) return fail("Complications are not approved");
      const action = mutation.approval === APPROVAL.rejected ? ACTIONS.REJECT : ACTIONS.APPROVE;
      const denied = requireAuth(ctx, action, found.node);
      if (denied) return denied;
      if (mutation.approval === APPROVAL.rejected && !String(mutation.rejectReason ?? "").trim()) {
        return fail("Reject reason is required");
      }
      applyApproval(found.node, mutation.approval, mutation.rejectReason);
      return ok(next);
    }
    case "setVisibleToAll": {
      const found = findNode(next, mutation.nodeId);
      if (!found) return fail("Node not found");
      const denied = requireAuth(ctx, ACTIONS.TOGGLE_VISIBILITY, found.node);
      if (denied) return denied;
      found.node.visibility.visibleToAll = Boolean(mutation.visibleToAll);
      return ok(next);
    }
    case "addLinkedItem": {
      const found = findNode(next, mutation.parentId);
      if (!found) return fail("Parent not found");
      const parent = found.node;
      if (!Array.isArray(parent.linkedItems)) parent.linkedItems = [];
      const denied = requireAuth(ctx, ACTIONS.LINK_ITEM, parent);
      if (denied) return denied;
      const item = createLinkedItem(mutation.item ?? mutation);
      if (!item) return fail("Item uuid is required");
      if (!parent.linkedItems.some((existing) => existing.uuid === item.uuid)) {
        parent.linkedItems.push(item);
      }
      return ok(next);
    }
    case "removeLinkedItem": {
      const found = findNode(next, mutation.parentId);
      if (!found) return fail("Parent not found");
      const parent = found.node;
      if (!Array.isArray(parent.linkedItems)) parent.linkedItems = [];
      const denied = requireAuth(ctx, ACTIONS.LINK_ITEM, parent);
      if (denied) return denied;
      parent.linkedItems = parent.linkedItems.filter((item) => item.uuid !== mutation.uuid);
      return ok(next);
    }
    default:
      return fail(`Unknown mutation: ${mutation.type}`);
  }
}

function decorateNode(node, user, extras = {}) {
  const seen = canSeeNode(node, user);
  const kind = extras.kind ?? node.kind;
  const isGoalLike = kind === NODE_KIND.goal || kind === NODE_KIND.shortGoal
    || node.type === NODE_TYPE.goal || node.type === NODE_TYPE.shortGoal;
  const successStake = isGoalLike ? normalizeStake(node.successStake) : "";
  const failureStake = isGoalLike ? normalizeStake(node.failureStake) : "";
  return {
    ...node,
    ...extras,
    canSee: seen,
    canEdit: authorize(ACTIONS.EDIT, { user, node }),
    canDelete: authorize(ACTIONS.DELETE, { user, node }),
    canApprove: authorize(ACTIONS.APPROVE, { user, node }),
    canToggleVisibility: authorize(ACTIONS.TOGGLE_VISIBILITY, { user, node }),
    canLinkItems: authorize(ACTIONS.LINK_ITEM, { user, actor: extras.actor, node }),
    isApproved: node.approval === APPROVAL.approved,
    isRejected: node.approval === APPROVAL.rejected,
    isPending: !node.approval || node.approval === APPROVAL.pending,
    visibleToAll: Boolean(node.visibility?.visibleToAll),
    rejectReason: node.rejectReason ?? "",
    successStake,
    failureStake,
    hasStakes: Boolean(successStake || failureStake),
  };
}

/**
 * Viewer-facing tree: hidden nodes omitted, linkedItems stripped unless GM.
 */
export function filterFlagForViewer(flag, user, actor) {
  const data = normalizeFlag(flag);
  const showLinks = canSeeLinkedItems(user);
  const goals = [];

  for (const goal of data.goals) {
    if (!canSeeNode(goal, user)) continue;
    const shortGoals = goal.shortGoals
      .filter((row) => canSeeNode(row, user))
      .map((row) => {
        const complications = row.complications
          .filter((item) => canSeeNode(item, user))
          .map((item) => decorateNode(item, user, {
            actor,
            kind: NODE_KIND.complication,
            linkedItems: showLinks ? item.linkedItems ?? [] : [],
          }));
        return decorateNode(row, user, {
          actor,
          kind: NODE_KIND.shortGoal,
          complications,
          linkedItems: showLinks ? row.linkedItems : [],
          canAddComplication: authorize(ACTIONS.ADD_COMPLICATION, { user, actor }),
        });
      });
    const complications = goal.complications
      .filter((item) => canSeeNode(item, user))
      .map((item) => decorateNode(item, user, {
        actor,
        kind: NODE_KIND.complication,
        linkedItems: showLinks ? item.linkedItems ?? [] : [],
      }));
    const storedShortCount = goal.shortGoals.length;
    const atShortGoalCap = storedShortCount >= MAX_SHORT_GOALS;
    goals.push(
      decorateNode(goal, user, {
        actor,
        kind: NODE_KIND.goal,
        shortGoals,
        complications,
        linkedItems: showLinks ? goal.linkedItems : [],
        canAddShortGoal: authorize(ACTIONS.ADD_SHORT_GOAL, { user, actor, node: goal }) && !atShortGoalCap,
        canAddComplication: authorize(ACTIONS.ADD_COMPLICATION, { user, actor }),
        shortGoalCount: storedShortCount,
        atShortGoalCap,
        encourageAnotherShort: !atShortGoalCap,
      }),
    );
  }

  return {
    goals,
    canAddGoal: authorize(ACTIONS.ADD_GOAL, { user, actor }),
    canAddComplication: authorize(ACTIONS.ADD_COMPLICATION, { user, actor }),
    isGM: isGM(user),
    canSeeLinks: showLinks,
    empty: goals.length === 0,
  };
}

export function readActorFlag(actor) {
  const raw = actor?.flags?.[FLAG_KEY] ?? actor?.getFlag?.(FLAG_KEY) ?? null;
  if (raw && Array.isArray(raw.goals)) return normalizeFlag(raw);
  if (Array.isArray(raw)) return normalizeFlag({ goals: raw });
  if (raw && Array.isArray(raw.goals) === false && raw.goals == null && actor?.getFlag) {
    const goals = actor.getFlag(FLAG_KEY, "goals");
    if (Array.isArray(goals)) return normalizeFlag({ goals });
  }
  return normalizeFlag(raw);
}
