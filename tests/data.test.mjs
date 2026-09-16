import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMutation,
  createGoal,
  emptyFlag,
  findNode,
  normalizeFlag,
} from "../scripts/data.mjs";
import { fixtures } from "./helpers.mjs";

const { gm, alice, bob, aliceActor, bobActor } = fixtures;

function addGoal(flag, user, actor, text) {
  return applyMutation(flag, { type: "addGoal", text }, { user, actor });
}

describe("normalizeFlag", () => {
  it("returns an empty tree for missing or junk input", () => {
    assert.deepEqual(normalizeFlag(null), emptyFlag());
    assert.deepEqual(normalizeFlag(undefined), emptyFlag());
    assert.deepEqual(normalizeFlag("nope"), emptyFlag());
    assert.deepEqual(normalizeFlag({ goals: [null, 5, { text: "ok" }] }).goals.length, 1);
  });

  it("fills defaults and keeps rejectReason only when present", () => {
    const flag = normalizeFlag({
      goals: [
        {
          id: "g1",
          text: "Recover the heirloom",
          approval: "rejected",
          rejectReason: "Too vague",
          visibility: { createdBy: "u-alice" },
          shortGoals: [{ id: "s1", text: "Ask the archivist" }],
          linkedItems: [{ uuid: "Item.abc", name: "Map" }, { name: "broken" }],
        },
      ],
    });
    const goal = flag.goals[0];
    assert.equal(goal.approval, "rejected");
    assert.equal(goal.rejectReason, "Too vague");
    assert.equal(goal.visibility.visibleToAll, false);
    assert.equal(goal.shortGoals[0].approval, "pending");
    assert.equal(goal.linkedItems.length, 1);
    assert.equal(goal.linkedItems[0].name, "Map");
  });

  it("does not hard-cap short-term goals in data", () => {
    const goal = createGoal({ text: "Long", userId: "u-alice" });
    goal.shortGoals = [1, 2, 3].map((n) => ({ id: `s${n}`, text: `Step ${n}` }));
    const flag = normalizeFlag({ goals: [goal] });
    assert.equal(flag.goals[0].shortGoals.length, 3);
  });
});

describe("CRUD mutations", () => {
  it("adds nested short goals and complications", () => {
    let { flag } = addGoal(emptyFlag(), alice, aliceActor, "Find the lost heirloom");
    const goalId = flag.goals[0].id;
    ({ flag } = applyMutation(flag, { type: "addShortGoal", goalId, text: "Ask the archivist" }, { user: alice, actor: aliceActor }));
    const shortId = flag.goals[0].shortGoals[0].id;
    ({ flag } = applyMutation(flag, { type: "addComplication", parentId: shortId, text: "The archivist is a spy" }, { user: bob, actor: aliceActor }));
    ({ flag } = applyMutation(flag, { type: "addComplication", parentId: goalId, text: "Rival treasure hunters" }, { user: gm, actor: aliceActor }));

    assert.equal(flag.goals[0].shortGoals.length, 1);
    assert.equal(flag.goals[0].shortGoals[0].complications[0].text, "The archivist is a spy");
    assert.equal(flag.goals[0].shortGoals[0].complications[0].visibility.createdBy, "u-bob");
    assert.equal(flag.goals[0].complications[0].visibility.createdBy, "gm1");
    assert.equal(flag.goals[0].complications[0].visibility.visibleToAll, false);
  });

  it("allows a third short-term goal in data while UI encourages 1–2", () => {
    let { flag } = addGoal(emptyFlag(), alice, aliceActor, "Long");
    const goalId = flag.goals[0].id;
    for (const text of ["A", "B", "C"]) {
      ({ flag } = applyMutation(flag, { type: "addShortGoal", goalId, text }, { user: alice, actor: aliceActor }));
    }
    assert.equal(flag.goals[0].shortGoals.length, 3);
  });

  it("updates and deletes only the targeted node", () => {
    let { flag } = addGoal(emptyFlag(), alice, aliceActor, "Keep");
    ({ flag } = addGoal(flag, alice, aliceActor, "Drop"));
    const dropId = flag.goals[1].id;
    ({ flag } = applyMutation(flag, { type: "updateText", nodeId: flag.goals[0].id, text: "Kept" }, { user: alice, actor: aliceActor }));
    ({ flag } = applyMutation(flag, { type: "deleteNode", nodeId: dropId }, { user: alice, actor: aliceActor }));
    assert.equal(flag.goals.length, 1);
    assert.equal(flag.goals[0].text, "Kept");
  });

  it("links items on goals and short goals, not as a player-visible field", () => {
    let { flag } = addGoal(emptyFlag(), alice, aliceActor, "Goal");
    const goalId = flag.goals[0].id;
    ({ flag } = applyMutation(flag, { type: "addShortGoal", goalId, text: "Step" }, { user: alice, actor: aliceActor }));
    const shortId = flag.goals[0].shortGoals[0].id;
    ({ flag } = applyMutation(
      flag,
      { type: "addLinkedItem", parentId: goalId, item: { uuid: "Item.one", name: "Sword", img: "icons/sword.svg" } },
      { user: gm, actor: aliceActor },
    ));
    ({ flag } = applyMutation(
      flag,
      { type: "addLinkedItem", parentId: shortId, item: { uuid: "Item.two", name: "Key" } },
      { user: alice, actor: aliceActor },
    ));
    ({ flag } = applyMutation(
      flag,
      { type: "addLinkedItem", parentId: goalId, item: { uuid: "Item.one", name: "Sword" } },
      { user: gm, actor: aliceActor },
    ));
    assert.equal(flag.goals[0].linkedItems.length, 1);
    assert.equal(flag.goals[0].shortGoals[0].linkedItems[0].uuid, "Item.two");
    ({ flag } = applyMutation(flag, { type: "removeLinkedItem", parentId: goalId, uuid: "Item.one" }, { user: gm, actor: aliceActor }));
    assert.equal(flag.goals[0].linkedItems.length, 0);
  });

  it("finds nodes across the tree", () => {
    const flag = normalizeFlag({
      goals: [
        {
          id: "g",
          text: "G",
          shortGoals: [{ id: "s", text: "S", complications: [{ id: "c", text: "C" }] }],
        },
      ],
    });
    assert.equal(findNode(flag, "s").kind, "shortGoal");
    assert.equal(findNode(flag, "c").parent.id, "s");
    assert.equal(findNode(flag, "missing"), null);
  });

  it("rejects empty text and unknown mutations", () => {
    assert.equal(addGoal(emptyFlag(), alice, aliceActor, "   ").ok, false);
    assert.equal(applyMutation(emptyFlag(), { type: "nope" }, { user: gm, actor: aliceActor }).ok, false);
    assert.equal(applyMutation(emptyFlag(), { type: "addShortGoal", goalId: "x", text: "S" }, { user: alice, actor: aliceActor }).ok, false);
  });

  it("lets a GM approve and reject with a hover reason", () => {
    let { flag } = addGoal(emptyFlag(), alice, aliceActor, "Goal");
    const id = flag.goals[0].id;
    ({ flag } = applyMutation(flag, { type: "setApproval", nodeId: id, approval: "approved" }, { user: gm, actor: aliceActor }));
    assert.equal(flag.goals[0].approval, "approved");
    assert.equal(flag.goals[0].rejectReason, undefined);
    ({ flag } = applyMutation(
      flag,
      { type: "setApproval", nodeId: id, approval: "rejected", rejectReason: "Scope is a campaign, not a goal" },
      { user: gm, actor: aliceActor },
    ));
    assert.equal(flag.goals[0].approval, "rejected");
    assert.equal(flag.goals[0].rejectReason, "Scope is a campaign, not a goal");
  });
});

describe("cross-actor writes still authorize the requester", () => {
  it("denies Bob adding a goal on Alice even if a GM will persist it", () => {
    const result = applyMutation(emptyFlag(), { type: "addGoal", text: "Sneaky" }, { user: bob, actor: aliceActor });
    assert.equal(result.ok, false);
  });

  it("allows Bob to add a complication on Alice (socket relay case)", () => {
    const seeded = addGoal(emptyFlag(), alice, aliceActor, "Visible later");
    const result = applyMutation(
      seeded.flag,
      { type: "addComplication", parentId: seeded.flag.goals[0].id, text: "Bob's wrinkle" },
      { user: bob, actor: aliceActor },
    );
    assert.equal(result.ok, true);
    assert.equal(result.flag.goals[0].complications[0].visibility.createdBy, "u-bob");
  });
});
