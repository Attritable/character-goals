export function user({ id, isGM = false, name = id } = {}) {
  return { id, isGM, name };
}

export function actor({ id, owners = [], name = id, type = "character" } = {}) {
  const ownership = { default: 0 };
  for (const ownerId of owners) ownership[ownerId] = 3;
  return { id, name, type, ownership };
}

export const fixtures = {
  gm: user({ id: "gm1", isGM: true, name: "GM" }),
  otherGm: user({ id: "gm2", isGM: true, name: "Other GM" }),
  alice: user({ id: "u-alice", isGM: false, name: "Alice" }),
  bob: user({ id: "u-bob", isGM: false, name: "Bob" }),
};

fixtures.aliceActor = actor({ id: "actor-alice", owners: ["u-alice"], name: "Alice PC" });
fixtures.bobActor = actor({ id: "actor-bob", owners: ["u-bob"], name: "Bob PC" });
