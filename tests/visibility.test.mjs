import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIONS,
  applyMutation,
  authorize,
  canSeeLinkedItems,
  canSeeNode,
  emptyFlag,
  filterFlagForViewer,
} from "../scripts/data.mjs";
import { fixtures } from "./helpers.mjs";

const { gm, otherGm, alice, bob, aliceActor, bobActor } = fixtures;

function seedAliceGoal(text = "Recover the lost heirloom") {
  return applyMutation(emptyFlag(), { type: "addGoal", text }, { user: alice, actor: aliceActor }).flag;
}

describe("permission matrix", () => {
  it("lets an owner or GM add a goal, but not another player", () => {
    assert.equal(authorize(ACTIONS.ADD_GOAL, { user: alice, actor: aliceActor }), true);
    assert.equal(authorize(ACTIONS.ADD_GOAL, { user: gm, actor: aliceActor }), true);
    assert.equal(authorize(ACTIONS.ADD_GOAL, { user: bob, actor: aliceActor }), false);
    assert.equal(applyMutation(emptyFlag(), { type: "addGoal", text: "X" }, { user: bob, actor: aliceActor }).ok, false);
    assert.equal(applyMutation(emptyFlag(), { type: "addGoal", text: "X" }, { user: alice, actor: aliceActor }).ok, true);
  });

  it("lets any player add a complication on their own or another character", () => {
    const aliceGoal = seedAliceGoal();
    const bobGoal = applyMutation(emptyFlag(), { type: "addGoal", text: "Bob's plan" }, { user: bob, actor: bobActor }).flag;
    assert.equal(authorize(ACTIONS.ADD_COMPLICATION, { user: alice, actor: aliceActor }), true);
    assert.equal(authorize(ACTIONS.ADD_COMPLICATION, { user: bob, actor: aliceActor }), true);
    assert.equal(
      applyMutation(aliceGoal, { type: "addComplication", parentId: aliceGoal.goals[0].id, text: "Own wrinkle" }, { user: alice, actor: aliceActor }).ok,
      true,
    );
    assert.equal(
      applyMutation(aliceGoal, { type: "addComplication", parentId: aliceGoal.goals[0].id, text: "Bob meddles" }, { user: bob, actor: aliceActor }).ok,
      true,
    );
    assert.equal(
      applyMutation(bobGoal, { type: "addComplication", parentId: bobGoal.goals[0].id, text: "Alice meddles" }, { user: alice, actor: bobActor }).ok,
      true,
    );
  });

  it("defaults new nodes to creator-only; GM-created is GM-only", () => {
    const playerFlag = seedAliceGoal();
    const gmFlag = applyMutation(emptyFlag(), { type: "addGoal", text: "Secret pressure" }, { user: gm, actor: aliceActor }).flag;
    const playerGoal = playerFlag.goals[0];
    const gmGoal = gmFlag.goals[0];

    assert.equal(playerGoal.visibility.visibleToAll, false);
    assert.equal(gmGoal.visibility.visibleToAll, false);
    assert.equal(canSeeNode(playerGoal, alice), true);
    assert.equal(canSeeNode(playerGoal, bob), false);
    assert.equal(canSeeNode(playerGoal, gm), true);
    assert.equal(canSeeNode(gmGoal, gm), true);
    assert.equal(canSeeNode(gmGoal, otherGm), true);
    assert.equal(canSeeNode(gmGoal, alice), false);
    assert.equal(canSeeNode(gmGoal, bob), false);
  });

  it("lets a GM eyeball-toggle visibility even when they did not create the node", () => {
    const flag = seedAliceGoal();
    const id = flag.goals[0].id;
    assert.equal(authorize(ACTIONS.TOGGLE_VISIBILITY, { user: alice, node: flag.goals[0] }), false);
    assert.equal(applyMutation(flag, { type: "setVisibleToAll", nodeId: id, visibleToAll: true }, { user: alice, actor: aliceActor }).ok, false);

    const shown = applyMutation(flag, { type: "setVisibleToAll", nodeId: id, visibleToAll: true }, { user: gm, actor: aliceActor });
    assert.equal(shown.ok, true);
    assert.equal(shown.flag.goals[0].visibility.visibleToAll, true);
    assert.equal(canSeeNode(shown.flag.goals[0], bob), true);
    assert.equal(canSeeNode(shown.flag.goals[0], alice), true);
  });

  it("restricts approve/reject to the GM", () => {
    const flag = seedAliceGoal();
    const id = flag.goals[0].id;
    assert.equal(applyMutation(flag, { type: "setApproval", nodeId: id, approval: "approved" }, { user: alice, actor: aliceActor }).ok, false);
    assert.equal(applyMutation(flag, { type: "setApproval", nodeId: id, approval: "rejected", rejectReason: "No" }, { user: bob, actor: aliceActor }).ok, false);
    const approved = applyMutation(flag, { type: "setApproval", nodeId: id, approval: "approved" }, { user: gm, actor: aliceActor });
    assert.equal(approved.ok, true);
    assert.equal(approved.flag.goals[0].approval, "approved");
  });

  it("lets the creator or GM edit/delete; another player cannot", () => {
    const flag = seedAliceGoal();
    const id = flag.goals[0].id;
    assert.equal(applyMutation(flag, { type: "updateText", nodeId: id, text: "Hijack" }, { user: bob, actor: aliceActor }).ok, false);
    assert.equal(applyMutation(flag, { type: "deleteNode", nodeId: id }, { user: bob, actor: aliceActor }).ok, false);
    assert.equal(applyMutation(flag, { type: "updateText", nodeId: id, text: "Clarify" }, { user: alice, actor: aliceActor }).ok, true);
    assert.equal(applyMutation(flag, { type: "deleteNode", nodeId: id }, { user: gm, actor: aliceActor }).ok, true);
  });

  it("shows linkedItems to GMs only, regardless of node visibility", () => {
    let flag = seedAliceGoal();
    const id = flag.goals[0].id;
    flag = applyMutation(flag, { type: "setVisibleToAll", nodeId: id, visibleToAll: true }, { user: gm, actor: aliceActor }).flag;
    flag = applyMutation(
      flag,
      { type: "addLinkedItem", parentId: id, item: { uuid: "Item.secret", name: "Hidden Map" } },
      { user: gm, actor: aliceActor },
    ).flag;

    assert.equal(canSeeLinkedItems(gm), true);
    assert.equal(canSeeLinkedItems(alice), false);
    assert.equal(canSeeLinkedItems(bob), false);

    const aliceView = filterFlagForViewer(flag, alice, aliceActor);
    const bobView = filterFlagForViewer(flag, bob, aliceActor);
    const gmView = filterFlagForViewer(flag, gm, aliceActor);
    assert.equal(aliceView.goals[0].linkedItems.length, 0);
    assert.equal(bobView.goals[0].linkedItems.length, 0);
    assert.equal(gmView.goals[0].linkedItems.length, 1);
    assert.equal(gmView.goals[0].linkedItems[0].name, "Hidden Map");
  });

  it("omits hidden nodes from a non-creator player view", () => {
    let flag = seedAliceGoal("Alice secret");
    flag = applyMutation(flag, { type: "addGoal", text: "GM secret" }, { user: gm, actor: aliceActor }).flag;
    flag = applyMutation(flag, { type: "setVisibleToAll", nodeId: flag.goals[0].id, visibleToAll: true }, { user: gm, actor: aliceActor }).flag;

    const bobView = filterFlagForViewer(flag, bob, aliceActor);
    const aliceView = filterFlagForViewer(flag, alice, aliceActor);
    const gmView = filterFlagForViewer(flag, gm, aliceActor);
    assert.deepEqual(bobView.goals.map((goal) => goal.text), ["Alice secret"]);
    assert.deepEqual(aliceView.goals.map((goal) => goal.text), ["Alice secret"]);
    assert.equal(gmView.goals.length, 2);
  });
});
