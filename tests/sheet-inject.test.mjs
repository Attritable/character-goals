import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TAB_ID } from "../scripts/data.mjs";
import { buildSheetContext, injectSheetClass, isCharacterActor, renderGoalsHtmlFallback } from "../scripts/sheet.mjs";
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
});
