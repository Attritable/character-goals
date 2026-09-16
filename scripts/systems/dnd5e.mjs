/**
 * dnd5e sheet path — same module, same data. Agnostic core in sheet.mjs;
 * this file is the 5e skin/hook: array-style TABS, 5e tab markup, page class.
 */

import { MODULE_ID, TAB_ID } from "../data.mjs";

export const DND5E_SYSTEM_ID = "dnd5e";
export const DND5E_SKIN = "dnd5e";
export const GENERIC_SKIN = "generic";

const DND5E_CLASS_NAME = /ActorSheet5e|CharacterActorSheet|NPCActorSheet|GroupActorSheet/i;

const DND5E_RENDER_HOOKS = Object.freeze([
  "renderActorSheet5e",
  "renderActorSheet5eCharacter",
  "renderActorSheet5eCharacter2",
  "renderCharacterActorSheet",
]);

export function dnd5eRenderHooks() {
  return DND5E_RENDER_HOOKS;
}

export function isDnd5eSystem(game = globalThis.game) {
  return game?.system?.id === DND5E_SYSTEM_ID;
}

export function isDnd5eSheetClass(cls) {
  if (!cls) return false;
  return DND5E_CLASS_NAME.test(cls.name ?? "") || DND5E_CLASS_NAME.test(cls.prototype?.constructor?.name ?? "");
}

export function resolveSheetSkin({ actor, cls, game } = {}) {
  if (isDnd5eSystem(game)) return DND5E_SKIN;
  if (isDnd5eSheetClass(cls)) return DND5E_SKIN;
  if (actor?.systemId === DND5E_SYSTEM_ID || actor?.system === DND5E_SYSTEM_ID) return DND5E_SKIN;
  return GENERIC_SKIN;
}

export function dnd5eTabConfig() {
  return {
    tab: TAB_ID,
    id: TAB_ID,
    group: "primary",
    label: "CHARACTERGOALS.Tab",
    icon: "fa-solid fa-bullseye",
  };
}

export function dnd5ePartConfig() {
  return {
    template: `modules/${MODULE_ID}/templates/goals-page.hbs`,
    scrollable: [""],
    classes: ["character-goals-page", "character-goals-dnd5e"],
  };
}

/**
 * dnd5e 4.x/5.x CharacterActorSheet uses TABS as an array of
 * `{ tab, group, label, icon }` instead of `{ primary: { tabs: [...] } }`.
 */
export function injectDnd5eTabs(cls) {
  if (!cls || !Array.isArray(cls.TABS)) return false;
  if (cls.TABS.some((entry) => entry?.id === TAB_ID || entry?.tab === TAB_ID)) return false;
  cls.TABS.push(dnd5eTabConfig());
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** 5e2-style tab control (icon + label) for DOM fallback. */
export function dnd5eTabNavHtml({ group = "primary", label = "Goals" } = {}) {
  return `<a class="item control" data-action="tab" data-group="${escapeHtml(group)}" data-tab="${TAB_ID}">
    <i class="fa-solid fa-bullseye"></i>
    <span class="label">${escapeHtml(label)}</span>
  </a>`;
}

export function applyDnd5ePageClass(element) {
  if (!element) return null;
  const page =
    element.querySelector?.(".character-goals-page") ??
    (element.classList?.contains("character-goals-page") ? element : null);
  page?.classList?.add("character-goals-dnd5e");
  return page;
}
