import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAB_ID } from "../scripts/data.mjs";
import { buildSheetContext, injectSheetClass, isCharacterActor, renderGoalsHtmlFallback } from "../scripts/sheet.mjs";
import { injectDnd5eTabs, isDnd5eSheetClass, resolveSheetSkin } from "../scripts/systems/dnd5e.mjs";
import { fixtures } from "./helpers.mjs";
import { applyMutation, emptyFlag } from "../scripts/data.mjs";

describe("sheet helpers", () => {
  it("treats WWN/generic character types as character sheets", () => {
    assert.equal(isCharacterActor({ type: "character" }), true);
    assert.equal(isCharacterActor({ type: "pc" }), true);
    assert.equal(isCharacterActor({ type: "faction" }), false);
    assert.equal(isCharacterActor({ type: "starship" }), false);
  });

  it("injects PARTS and TABS.primary onto an AppV2-style sheet class", () => {
    class FakePcSheet {
      static TABS = {
        primary: {
          tabs: [{ id: "main", label: "Main" }],
          initial: "main",
        },
      };
      static PARTS = {
        header: { template: "header.hbs" },
        tabs: { template: "templates/generic/tab-navigation.hbs" },
        main: { template: "main.hbs" },
      };
      async _preparePartContext(partId, context) {
        context.tab = context.tabs?.[partId];
        return context;
      }
    }

    assert.equal(injectSheetClass(FakePcSheet), true);
    assert.equal(injectSheetClass(FakePcSheet), false);
    assert.ok(FakePcSheet.PARTS[TAB_ID]);
    assert.ok(FakePcSheet.TABS.primary.tabs.some((tab) => tab.id === TAB_ID));
  });

  it("builds a viewer context that hides links from players", () => {
    let flag = applyMutation(emptyFlag(), { type: "addGoal", text: "Public-ish" }, { user: fixtures.alice, actor: fixtures.aliceActor }).flag;
    flag = applyMutation(flag, { type: "setVisibleToAll", nodeId: flag.goals[0].id, visibleToAll: true }, { user: fixtures.gm, actor: fixtures.aliceActor }).flag;
    flag = applyMutation(
      flag,
      { type: "addLinkedItem", parentId: flag.goals[0].id, item: { uuid: "Item.x", name: "Relic" } },
      { user: fixtures.gm, actor: fixtures.aliceActor },
    ).flag;
    const actor = { ...fixtures.aliceActor, flags: { "character-goals": flag } };

    const player = buildSheetContext(actor, fixtures.bob, { id: TAB_ID, group: "primary" });
    const gm = buildSheetContext(actor, fixtures.gm, { id: TAB_ID, group: "primary" });
    assert.equal(player.canAddGoal, false);
    assert.equal(player.canAddComplication, true);
    assert.equal(player.goals[0].linkedItems.length, 0);
    assert.equal(gm.goals[0].linkedItems.length, 1);
    assert.equal(gm.isGM, true);
  });

  it("renders a fallback Goals page without Handlebars", () => {
    const html = renderGoalsHtmlFallback({
      tab: { id: TAB_ID, group: "primary", cssClass: "" },
      canAddGoal: true,
      empty: true,
      goals: [],
      isGM: false,
      labels: { title: "Goals", addGoal: "Add goal", empty: "No goals yet." },
    });
    assert.match(html, /data-tab="character-goals"/);
    assert.match(html, /No goals yet/);
  });

  it("sheet copy says hidden is from other players only and the GM still sees", () => {
    const lang = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
    assert.match(lang.CHARACTERGOALS.HiddenToOthers, /other players/i);
    assert.match(lang.CHARACTERGOALS.HiddenToOthers, /GM/i);
    assert.match(lang.CHARACTERGOALS.HiddenMeans, /hidden from other players only/i);
    assert.match(lang.CHARACTERGOALS.HiddenMeans, /GM always sees/i);

    const ctx = buildSheetContext(fixtures.aliceActor, fixtures.gm, { id: TAB_ID, group: "primary" });
    assert.match(ctx.labels.hiddenToOthers, /other players/i);
    assert.match(ctx.labels.hiddenToOthers, /GM/i);
    assert.match(ctx.labels.hiddenMeans, /hidden from other players only/i);
    const html = renderGoalsHtmlFallback({
      ...ctx,
      empty: true,
      goals: [],
      labels: { ...ctx.labels, empty: "No goals yet." },
    });
    assert.match(html, /hidden from other players only/i);
    assert.match(html, /character-goals-visibility-note/);
  });

  it("shows compact stakes on the fallback sheet", () => {
    let flag = applyMutation(
      emptyFlag(),
      { type: "addGoal", text: "Take the keep", successStake: "A holding", failureStake: "Outlawed" },
      { user: fixtures.alice, actor: fixtures.aliceActor },
    ).flag;
    const actor = { ...fixtures.aliceActor, flags: { "character-goals": flag } };
    const ctx = buildSheetContext(actor, fixtures.alice, { id: TAB_ID, group: "primary" });
    assert.equal(ctx.goals[0].successStake, "A holding");
    assert.equal(ctx.goals[0].hasStakes, true);
    const html = renderGoalsHtmlFallback(ctx);
    assert.match(html, /A holding/);
    assert.match(html, /Outlawed/);
    assert.match(html, /character-goals-stakes/);
  });

  it("injects array-style TABS and 5e part classes on a dnd5e character sheet", () => {
    class ActorSheet5eCharacter {
      static TABS = [
        { tab: "details", group: "primary", label: "Details", icon: "fas fa-cog" },
      ];
      static PARTS = {
        header: { template: "header.hbs" },
        details: { template: "details.hbs" },
      };
    }

    assert.equal(isDnd5eSheetClass(ActorSheet5eCharacter), true);
    assert.equal(resolveSheetSkin({ cls: ActorSheet5eCharacter }), "dnd5e");
    assert.equal(injectSheetClass(ActorSheet5eCharacter), true);
    assert.ok(ActorSheet5eCharacter.PARTS[TAB_ID].classes.includes("character-goals-dnd5e"));
    assert.ok(ActorSheet5eCharacter.TABS.some((tab) => tab.tab === TAB_ID || tab.id === TAB_ID));
    assert.equal(injectDnd5eTabs(ActorSheet5eCharacter), false);
  });

  it("marks the 5e skin when the system is dnd5e", () => {
    const prev = globalThis.game;
    globalThis.game = { ...(prev ?? {}), system: { id: "dnd5e" } };
    try {
      const ctx = buildSheetContext(fixtures.aliceActor, fixtures.alice, { id: TAB_ID, group: "primary" });
      assert.equal(ctx.isDnd5e, true);
      assert.equal(ctx.skin, "dnd5e");
      const html = renderGoalsHtmlFallback({
        ...ctx,
        empty: true,
        goals: [],
        labels: { ...ctx.labels, empty: "None" },
      });
      assert.match(html, /character-goals-dnd5e/);
    } finally {
      globalThis.game = prev;
    }
  });
});
