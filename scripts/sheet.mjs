/**
 * Character sheet page: AppV2 PARTS/TABS injection + render-hook fallback.
 * See docs/ARCHITECTURE.md for the v14 contract and documented deviations.
 */

import {
  ACTIONS,
  MODULE_ID,
  TAB_ID,
  authorize,
  canUserUpdateActor,
  filterFlagForViewer,
  readActorFlag,
} from "./data.mjs";

const CHARACTER_TYPES = new Set(["character", "pc", "player", "hero"]);
const injected = new WeakSet();
const DEFAULT_ITEM_ICON = "icons/svg/item-bag.svg";

/** @type {null | ((actor: object, mutation: object) => Promise<object>)} */
let writeMutation = null;

export function setWriteMutation(fn) {
  writeMutation = fn;
}

export function localize(key, fallback = key) {
  return globalThis.game?.i18n?.localize?.(key) || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isCharacterActor(actor) {
  if (!actor) return false;
  if (CHARACTER_TYPES.has(actor.type)) return true;
  return /character|pc|player/i.test(String(actor.type ?? ""));
}

export function buildSheetContext(actor, user, tab = {}) {
  const view = filterFlagForViewer(readActorFlag(actor), user, actor);
  const group = tab.group ?? "primary";
  return {
    moduleId: MODULE_ID,
    tabId: TAB_ID,
    tab: {
      id: tab.id ?? TAB_ID,
      group,
      cssClass: tab.cssClass ?? "",
    },
    actorId: actor?.id ?? "",
    ...view,
    labels: {
      title: localize("CHARACTERGOALS.Title", "Goals"),
      addGoal: localize("CHARACTERGOALS.AddGoal", "Add goal"),
      addShortGoal: localize("CHARACTERGOALS.AddShortGoal", "Add short-term goal"),
      addComplication: localize("CHARACTERGOALS.AddComplication", "Add complication"),
      empty: view.empty
        ? localize(
            view.canAddGoal ? "CHARACTERGOALS.Empty" : "CHARACTERGOALS.EmptyHidden",
            view.canAddGoal
              ? "No goals yet. Add a long- or mid-term goal to get started."
              : "No goals are visible to you on this character.",
          )
        : "",
      shortGoalHint: localize("CHARACTERGOALS.ShortGoalHint", "1–2 short-term goals work best"),
      dropHint: localize("CHARACTERGOALS.DropHint", "Drop a Foundry Item to link it (GM-only)"),
      linkedItems: localize("CHARACTERGOALS.LinkedItems", "Linked items"),
      approve: localize("CHARACTERGOALS.Approve", "Approve"),
      reject: localize("CHARACTERGOALS.Reject", "Flag an issue"),
      pending: localize("CHARACTERGOALS.Pending", "Pending GM review"),
      approved: localize("CHARACTERGOALS.Approved", "Approved"),
      rejected: localize("CHARACTERGOALS.Rejected", "Needs attention"),
      toggleVisible: localize("CHARACTERGOALS.ToggleVisible", "Toggle visibility for everyone"),
      visibleToAll: localize("CHARACTERGOALS.VisibleToAll", "Visible to everyone"),
      hiddenToOthers: localize("CHARACTERGOALS.HiddenToOthers", "Visible only to the creator and GMs"),
      edit: localize("CHARACTERGOALS.Edit", "Edit"),
      delete: localize("CHARACTERGOALS.Delete", "Delete"),
      removeLink: localize("CHARACTERGOALS.RemoveLink", "Remove link"),
    },
  };
}

function tabAlreadyPresent(root) {
  return Boolean(
    root.querySelector?.(`[data-tab="${TAB_ID}"]`) ||
      root.querySelector?.(`.${MODULE_ID}-page`),
  );
}

function findTabNav(root) {
  return (
    root.querySelector("nav.sheet-tabs") ||
    root.querySelector("nav.tabs") ||
    root.querySelector(".sheet-tabs") ||
    root.querySelector("[data-application-part='tabs'] nav") ||
    root.querySelector(".tabs[data-group]")
  );
}

function findTabBody(root, nav) {
  return (
    root.querySelector(".sheet-body") ||
    root.querySelector(".tab-body") ||
    root.querySelector("[data-application-part='main']")?.parentElement ||
    nav?.parentElement ||
    root
  );
}

function inferTabGroup(nav) {
  return nav?.dataset?.group || nav?.querySelector("[data-group]")?.dataset?.group || "primary";
}

async function renderTemplate(path, context) {
  const render =
    globalThis.foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  if (typeof render === "function") return render(path, context);
  return renderGoalsHtmlFallback(context);
}

export function renderGoalsHtmlFallback(context) {
  const { labels, tab, canAddGoal, empty, goals, isGM } = context;
  const group = tab?.group ?? "primary";
  const tabId = tab?.id ?? TAB_ID;
  const rows = (goals ?? []).map((goal) => renderGoalFallback(goal, labels, isGM)).join("");
  return `<section class="tab ${escapeHtml(tab?.cssClass ?? "")} ${MODULE_ID}-page" data-group="${escapeHtml(group)}" data-tab="${escapeHtml(tabId)}">
    <header class="character-goals-header">
      <h3>${escapeHtml(labels.title)}</h3>
      ${canAddGoal ? `<button type="button" class="character-goals-add" data-cg-action="addGoal">${escapeHtml(labels.addGoal)}</button>` : ""}
    </header>
    ${empty ? `<p class="character-goals-empty hint">${escapeHtml(labels.empty)}</p>` : `<ol class="character-goals-list">${rows}</ol>`}
  </section>`;
}

function renderGoalFallback(goal, labels, isGM) {
  const shorts = (goal.shortGoals ?? [])
    .map((row) => renderChildFallback(row, labels, isGM, "short"))
    .join("");
  const complications = (goal.complications ?? [])
    .map((row) => renderChildFallback(row, labels, isGM, "complication"))
    .join("");
  return `<li class="character-goals-node character-goals-goal" data-node-id="${escapeHtml(goal.id)}" data-node-kind="goal">
    ${renderNodeChrome(goal, labels)}
    <ol class="character-goals-children">${shorts}</ol>
    ${goal.canAddShortGoal ? `<button type="button" data-cg-action="addShortGoal" data-node-id="${escapeHtml(goal.id)}">${escapeHtml(labels.addShortGoal)}</button>` : ""}
    ${goal.encourageAnotherShort ? `<p class="hint character-goals-hint">${escapeHtml(labels.shortGoalHint)}</p>` : ""}
    <ol class="character-goals-complications">${complications}</ol>
    ${goal.canAddComplication ? `<button type="button" data-cg-action="addComplication" data-node-id="${escapeHtml(goal.id)}">${escapeHtml(labels.addComplication)}</button>` : ""}
    ${renderLinksFallback(goal, labels, isGM)}
  </li>`;
}

function renderChildFallback(node, labels, isGM, kind) {
  const complications = (node.complications ?? [])
    .map((row) => renderChildFallback(row, labels, isGM, "complication"))
    .join("");
  return `<li class="character-goals-node character-goals-${kind}" data-node-id="${escapeHtml(node.id)}" data-node-kind="${kind === "short" ? "shortGoal" : "complication"}">
    ${renderNodeChrome(node, labels)}
    ${kind === "short" ? `<ol class="character-goals-complications">${complications}</ol>` : ""}
    ${kind === "short" && node.canAddComplication ? `<button type="button" data-cg-action="addComplication" data-node-id="${escapeHtml(node.id)}">${escapeHtml(labels.addComplication)}</button>` : ""}
    ${kind === "short" ? renderLinksFallback(node, labels, isGM) : ""}
  </li>`;
}

function renderNodeChrome(node, labels) {
  const approvalTitle = node.isRejected
    ? node.rejectReason || labels.rejected
    : node.isApproved
      ? labels.approved
      : labels.pending;
  const approvalClass = node.isApproved ? "approved" : node.isRejected ? "rejected" : "pending";
  const approvalIcon = node.isApproved
    ? "fa-check"
    : node.isRejected
      ? "fa-exclamation"
      : "fa-clock";
  return `<div class="character-goals-row">
    <span class="character-goals-approval ${approvalClass}" data-tooltip="${escapeHtml(approvalTitle)}" title="${escapeHtml(approvalTitle)}"><i class="fas ${approvalIcon}"></i></span>
    <span class="character-goals-text">${escapeHtml(node.text)}</span>
    <span class="character-goals-actions">
      ${node.canToggleVisibility ? `<button type="button" data-cg-action="toggleVisibility" data-node-id="${escapeHtml(node.id)}" data-tooltip="${escapeHtml(node.visibleToAll ? labels.visibleToAll : labels.hiddenToOthers)}" title="${escapeHtml(node.visibleToAll ? labels.visibleToAll : labels.hiddenToOthers)}"><i class="fas ${node.visibleToAll ? "fa-eye" : "fa-eye-slash"}"></i></button>` : ""}
      ${node.canApprove ? `<button type="button" data-cg-action="approve" data-node-id="${escapeHtml(node.id)}" data-tooltip="${escapeHtml(labels.approve)}"><i class="fas fa-check"></i></button><button type="button" data-cg-action="reject" data-node-id="${escapeHtml(node.id)}" data-tooltip="${escapeHtml(labels.reject)}"><i class="fas fa-exclamation"></i></button>` : ""}
      ${node.canEdit ? `<button type="button" data-cg-action="edit" data-node-id="${escapeHtml(node.id)}" data-tooltip="${escapeHtml(labels.edit)}"><i class="fas fa-pen"></i></button>` : ""}
      ${node.canDelete ? `<button type="button" data-cg-action="delete" data-node-id="${escapeHtml(node.id)}" data-tooltip="${escapeHtml(labels.delete)}"><i class="fas fa-trash"></i></button>` : ""}
    </span>
  </div>`;
}

function renderLinksFallback(node, labels, isGM) {
  if (!isGM) return "";
  const items = (node.linkedItems ?? [])
    .map(
      (item) =>
        `<li class="character-goals-link" data-uuid="${escapeHtml(item.uuid)}">
          <a class="content-link" data-link data-uuid="${escapeHtml(item.uuid)}" data-type="Item" draggable="true">
            <img class="character-goals-item-icon" src="${escapeHtml(item.img || DEFAULT_ITEM_ICON)}" alt="">
            <span>${escapeHtml(item.name || item.uuid)}</span>
          </a>
          <button type="button" data-cg-action="removeLinkedItem" data-node-id="${escapeHtml(node.id)}" data-uuid="${escapeHtml(item.uuid)}"><i class="fas fa-times"></i></button>
        </li>`,
    )
    .join("");
  return `<div class="character-goals-links" data-drop-node="${escapeHtml(node.id)}">
    <p class="hint">${escapeHtml(labels.dropHint)}</p>
    <ul>${items}</ul>
  </div>`;
}

export function injectSheetClasses(sheetClasses = globalThis.CONFIG?.Actor?.sheetClasses) {
  if (!sheetClasses) return 0;
  let count = 0;
  for (const [type, registrations] of Object.entries(sheetClasses)) {
    if (!CHARACTER_TYPES.has(type) && !/character|pc|player/i.test(type)) continue;
    for (const def of Object.values(registrations ?? {})) {
      if (injectSheetClass(def?.cls)) count += 1;
    }
  }
  return count;
}

export function injectSheetClass(cls) {
  if (!cls || injected.has(cls)) return false;
  injected.add(cls);

  if (cls.PARTS && !cls.PARTS[TAB_ID]) {
    cls.PARTS[TAB_ID] = {
      template: `modules/${MODULE_ID}/templates/goals-page.hbs`,
      scrollable: [""],
    };
  }

  if (cls.TABS) {
    const groupKey = cls.TABS.primary
      ? "primary"
      : cls.TABS.sheet
        ? "sheet"
        : Object.keys(cls.TABS)[0];
    const group = groupKey ? cls.TABS[groupKey] : null;
    if (group?.tabs && !group.tabs.some((tab) => tab.id === TAB_ID)) {
      group.tabs.push({
        id: TAB_ID,
        label: "CHARACTERGOALS.Tab",
        icon: "fa-solid fa-bullseye",
      });
    }
  }

  const originalPrepare = cls.prototype._preparePartContext;
  cls.prototype._preparePartContext = async function prepareGoalsPart(partId, context, options) {
    const result = originalPrepare
      ? await originalPrepare.call(this, partId, context, options)
      : context;
    if (partId === TAB_ID) {
      const actor = this.actor ?? this.document;
      const tab = result.tab ?? result.tabs?.[TAB_ID] ?? { id: TAB_ID, group: "primary", cssClass: "" };
      Object.assign(result, buildSheetContext(actor, globalThis.game?.user, tab));
    }
    return result;
  };

  return true;
}

async function injectDomPage(app, root) {
  if (!root || tabAlreadyPresent(root)) return root.querySelector?.(`[data-tab="${TAB_ID}"]`);
  const actor = app.actor ?? app.document;
  if (!isCharacterActor(actor)) return null;

  const nav = findTabNav(root);
  const group = inferTabGroup(nav);
  const context = buildSheetContext(actor, globalThis.game?.user, {
    id: TAB_ID,
    group,
    cssClass: "",
  });
  const pageHtml = await renderTemplate(`modules/${MODULE_ID}/templates/goals-page.hbs`, context);

  if (nav && !nav.querySelector(`[data-tab="${TAB_ID}"]`)) {
    const label = localize("CHARACTERGOALS.Tab", "Goals");
    nav.insertAdjacentHTML(
      "beforeend",
      `<a class="item" data-action="tab" data-group="${escapeHtml(group)}" data-tab="${TAB_ID}">
        <i class="fa-solid fa-bullseye"></i> ${escapeHtml(label)}
      </a>`,
    );
  }

  const body = findTabBody(root, nav);
  body.insertAdjacentHTML("beforeend", pageHtml);
  return body.querySelector(`[data-tab="${TAB_ID}"]`) ?? body.querySelector(`.${MODULE_ID}-page`);
}

export function getDragEventData(event) {
  const editor =
    globalThis.foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  if (editor?.getDragEventData) return editor.getDragEventData(event);
  try {
    const raw = event.dataTransfer?.getData("text/plain") || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function promptText({ title, label, initial = "" }) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (DialogV2?.prompt) {
    try {
      return await DialogV2.prompt({
        window: { title },
        content: `<div class="form-group"><label>${escapeHtml(label)}</label><input type="text" name="text" value="${escapeHtml(initial)}"></div>`,
        ok: {
          callback: (_event, button) => String(button.form.elements.text?.value ?? "").trim(),
        },
      });
    } catch {
      return null;
    }
  }
  const typed = globalThis.prompt?.(label, initial);
  return typed == null ? null : String(typed).trim();
}

async function confirmAction(message) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (DialogV2?.confirm) {
    try {
      return await DialogV2.confirm({ content: `<p>${escapeHtml(message)}</p>` });
    } catch {
      return false;
    }
  }
  return globalThis.confirm?.(message) ?? false;
}

async function notify(kind, key, fallback) {
  const text = localize(key, fallback);
  globalThis.ui?.notifications?.[kind]?.(text);
}

export async function handleSheetAction(actor, user, { action, nodeId, uuid, extra } = {}) {
  if (!writeMutation) return { ok: false, error: "Writer not configured" };
  switch (action) {
    case "addGoal": {
      if (!authorize(ACTIONS.ADD_GOAL, { user, actor })) {
        await notify("warn", "CHARACTERGOALS.NotPermitted", "You cannot do that.");
        return { ok: false, error: "Not permitted" };
      }
      const text = await promptText({
        title: localize("CHARACTERGOALS.AddGoal", "Add goal"),
        label: localize("CHARACTERGOALS.PromptGoal", "What is the long- or mid-term goal?"),
      });
      if (!text) return { ok: false, error: "cancelled" };
      return writeMutation(actor, { type: "addGoal", text });
    }
    case "addShortGoal": {
      const text = await promptText({
        title: localize("CHARACTERGOALS.AddShortGoal", "Add short-term goal"),
        label: localize("CHARACTERGOALS.PromptShortGoal", "What short-term step moves this goal?"),
      });
      if (!text) return { ok: false, error: "cancelled" };
      return writeMutation(actor, { type: "addShortGoal", goalId: nodeId, text });
    }
    case "addComplication": {
      const text = await promptText({
        title: localize("CHARACTERGOALS.AddComplication", "Add complication"),
        label: localize("CHARACTERGOALS.PromptComplication", "What complication could arise?"),
      });
      if (!text) return { ok: false, error: "cancelled" };
      return writeMutation(actor, { type: "addComplication", parentId: nodeId, text });
    }
    case "edit": {
      const current = extra?.currentText ?? "";
      const text = await promptText({
        title: localize("CHARACTERGOALS.Edit", "Edit"),
        label: localize("CHARACTERGOALS.PromptEdit", "Update the text"),
        initial: current,
      });
      if (!text) return { ok: false, error: "cancelled" };
      return writeMutation(actor, { type: "updateText", nodeId, text });
    }
    case "delete": {
      const yes = await confirmAction(localize("CHARACTERGOALS.ConfirmDelete", "Remove this entry?"));
      if (!yes) return { ok: false, error: "cancelled" };
      return writeMutation(actor, { type: "deleteNode", nodeId });
    }
    case "approve":
      return writeMutation(actor, { type: "setApproval", nodeId, approval: "approved" });
    case "reject": {
      const rejectReason = await promptText({
        title: localize("CHARACTERGOALS.Reject", "Flag an issue"),
        label: localize("CHARACTERGOALS.PromptReject", "Why is this rejected or in question?"),
      });
      if (rejectReason == null) return { ok: false, error: "cancelled" };
      return writeMutation(actor, {
        type: "setApproval",
        nodeId,
        approval: "rejected",
        rejectReason,
      });
    }
    case "toggleVisibility":
      return writeMutation(actor, {
        type: "setVisibleToAll",
        nodeId,
        visibleToAll: Boolean(extra?.visibleToAll),
      });
    case "removeLinkedItem":
      return writeMutation(actor, { type: "removeLinkedItem", parentId: nodeId, uuid });
    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
}

async function onItemDrop(actor, user, event) {
  const dropHost = event.target?.closest?.("[data-drop-node]");
  if (!dropHost) return false;
  event.preventDefault();
  event.stopPropagation();
  const data = getDragEventData(event);
  if (!data || data.type !== "Item" || !data.uuid) return false;
  let name = data.name;
  let img = data.img;
  try {
    const doc = await globalThis.fromUuid?.(data.uuid);
    name = doc?.name ?? name;
    img = doc?.img ?? img;
  } catch {
    // UUID lookup is optional; the link still stores the uuid.
  }
  if (!writeMutation) return false;
  return writeMutation(actor, {
    type: "addLinkedItem",
    parentId: dropHost.dataset.dropNode,
    item: { uuid: data.uuid, name, img },
  });
}

async function onOpenLinkedItem(event) {
  const link = event.target?.closest?.("[data-uuid]");
  if (!link || event.target.closest("[data-cg-action='removeLinkedItem']")) return;
  const uuid = link.dataset.uuid;
  if (!uuid || !globalThis.fromUuid) return;
  event.preventDefault();
  const doc = await fromUuid(uuid);
  doc?.sheet?.render?.(true);
}

export function bindGoalsListeners(app, root) {
  const page = root.querySelector?.(`.${MODULE_ID}-page`) ?? root.querySelector?.(`[data-tab="${TAB_ID}"]`);
  if (!page || page.dataset.cgBound === "1") return;
  page.dataset.cgBound = "1";
  const actor = app.actor ?? app.document;
  const user = globalThis.game?.user;

  page.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cg-action]");
    if (!button) {
      if (event.target.closest(".character-goals-link [data-uuid], a.content-link")) {
        await onOpenLinkedItem(event);
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nodeEl = button.closest("[data-node-id]");
    const action = button.dataset.cgAction;
    const visibleToAll = nodeEl?.dataset?.visibleToAll !== "true";
    await handleSheetAction(actor, user, {
      action,
      nodeId: button.dataset.nodeId || nodeEl?.dataset.nodeId,
      uuid: button.dataset.uuid,
      extra: {
        currentText: nodeEl?.dataset?.nodeText ?? "",
        visibleToAll,
      },
    });
  });

  page.addEventListener("dragover", (event) => {
    if (event.target.closest("[data-drop-node]")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  page.addEventListener("drop", (event) => {
    onItemDrop(actor, user, event);
  });
}

function asElement(html) {
  if (!html) return null;
  if (html instanceof globalThis.HTMLElement) return html;
  if (html[0] instanceof globalThis.HTMLElement) return html[0];
  if (typeof html?.find === "function" && html[0]) return html[0];
  return html;
}

export async function onRenderActorSheetV2(app, element) {
  const actor = app?.actor ?? app?.document;
  if (!actor || !isCharacterActor(actor)) return;
  const root = asElement(element) ?? app.element;
  if (!root) return;
  if (!tabAlreadyPresent(root)) await injectDomPage(app, root);
  bindGoalsListeners(app, root);
}

export async function onRenderActorSheet(app, html) {
  return onRenderActorSheetV2(app, asElement(html) ?? app?.element);
}

export { canUserUpdateActor, TAB_ID, MODULE_ID };
