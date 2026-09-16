import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMutation,
  createComplication,
  createGoal,
  createShortGoal,
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

  it("normalizes and persists successStake and failureStake on parent and short goals", () => {
    const flag = normalizeFlag({
      goals: [
        {
          id: "g1",
          text: "Crown the heir",
          successStake: "The rightful heir sits the throne",
          failureStake: "Civil war",
          shortGoals: [
            {
              id: "s1",
              text: "Find the signet",
              successStake: "Signet recovered",
              failureStake: "A forged signet spreads",
            },
          ],
          complications: [{ id: "c1", text: "A pretender" }],
        },
      ],
    });
    const goal = flag.goals[0];
    assert.equal(goal.successStake, "The rightful heir sits the throne");
    assert.equal(goal.failureStake, "Civil war");
    assert.equal(goal.shortGoals[0].successStake, "Signet recovered");
    assert.equal(goal.shortGoals[0].failureStake, "A forged signet spreads");
    assert.equal("successStake" in goal.complications[0], false);
    assert.equal(createGoal({ text: "X", userId: "u-alice" }).successStake, "");
    assert.equal(createShortGoal({ text: "Y", userId: "u-alice" }).failureStake, "");
    assert.equal("successStake" in createComplication({ text: "Z", userId: "u-bob" }), false);
  });

  it("applyMutation persists stakes on add and updateStakes", () => {
    let result = applyMutation(
      emptyFlag(),
      { type: "addGoal", text: "Win the election", successStake: "Mayor", failureStake: "Exile" },
      { user: alice, actor: aliceActor },
    );
    assert.equal(result.ok, true);
    assert.equal(result.flag.goals[0].successStake, "Mayor");
    assert.equal(result.flag.goals[0].failureStake, "Exile");
    const goalId = result.flag.goals[0].id;
    result = applyMutation(
      result.flag,
      { type: "addShortGoal", goalId, text: "Kiss babies", successStake: "Popular", failureStake: "Scandal" },
      { user: alice, actor: aliceActor },
    );
    assert.equal(result.flag.goals[0].shortGoals[0].successStake, "Popular");
    const shortId = result.flag.goals[0].shortGoals[0].id;
    result = applyMutation(
      result.flag,
      { type: "updateStakes", nodeId: goalId, successStake: "Chancellor", failureStake: "Prison" },
      { user: alice, actor: aliceActor },
    );
    assert.equal(result.ok, true);
    assert.equal(result.flag.goals[0].successStake, "Chancellor");
    assert.equal(result.flag.goals[0].failureStake, "Prison");
    result = applyMutation(
      result.flag,
      { type: "updateText", nodeId: shortId, text: "Shake hands", successStake: "Allies", failureStake: "" },
      { user: alice, actor: aliceActor },
    );
    assert.equal(result.flag.goals[0].shortGoals[0].text, "Shake hands");
    assert.equal(result.flag.goals[0].shortGoals[0].successStake, "Allies");
    assert.equal(result.flag.goals[0].shortGoals[0].failureStake, "");
    result = applyMutation(result.flag, { type: "addComplication", parentId: goalId, text: "Spy" }, { user: bob, actor: aliceActor });
    const denied = applyMutation(
      result.flag,
      { type: "updateStakes", nodeId: result.flag.goals[0].complications[0].id, successStake: "Nope" },
      { user: bob, actor: aliceActor },
    );
    assert.equal(denied.ok, false);
    assert.match(denied.error, /goals only/);
    const hijack = applyMutation(
      result.flag,
      { type: "updateStakes", nodeId: goalId, successStake: "Hijack" },
      { user: bob, actor: aliceActor },
    );
    assert.equal(hijack.ok, false);
  });

  it("normalize preserves extra short-term goals already stored", () => {
    const goal = createGoal({ text: "Long", userId: "u-alice" });
    goal.shortGoals = [1, 2, 3].map((n) => ({ id: `s${n}`, text: `Step ${n}` }));
    const flag = normalizeFlag({ goals: [goal] });
    assert.equal(flag.goals[0].shortGoals.length, 3);
    assert.equal(flag.goals[0].type, "goal_longmid");
    assert.equal(flag.goals[0].shortGoals[0].type, "goal_short");
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

  it("enforces a maximum of 2 short-term goals per parent", () => {
    let { flag } = addGoal(emptyFlag(), alice, aliceActor, "Long");
    const goalId = flag.goals[0].id;
    const first = applyMutation(flag, { type: "addShortGoal", goalId, text: "A" }, { user: alice, actor: aliceActor });
    const second = applyMutation(first.flag, { type: "addShortGoal", goalId, text: "B" }, { user: alice, actor: aliceActor });
    const third = applyMutation(second.flag, { type: "addShortGoal", goalId, text: "C" }, { user: alice, actor: aliceActor });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, false);
    assert.match(third.error, /At most 2/);
    assert.equal(second.flag.goals[0].shortGoals.length, 2);
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
    const missingReason = applyMutation(flag, { type: "setApproval", nodeId: id, approval: "rejected" }, { user: gm, actor: aliceActor });
    assert.equal(missingReason.ok, false);
  });

  it("links items onto complications as well as goals", () => {
    let { flag } = addGoal(emptyFlag(), alice, aliceActor, "Goal");
    const goalId = flag.goals[0].id;
    ({ flag } = applyMutation(flag, { type: "addComplication", parentId: goalId, text: "Spy" }, { user: bob, actor: aliceActor }));
    const complicationId = flag.goals[0].complications[0].id;
    ({ flag } = applyMutation(
      flag,
      { type: "addLinkedItem", parentId: complicationId, item: { uuid: "Item.spyglass", name: "Spyglass" } },
      { user: gm, actor: aliceActor },
    ));
    assert.equal(flag.goals[0].complications[0].linkedItems[0].uuid, "Item.spyglass");
    assert.equal(flag.goals[0].linkedItems.length, 0);
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
