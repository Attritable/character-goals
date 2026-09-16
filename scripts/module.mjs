import {
  MODULE_ID,
  applyMutation,
  canUserUpdateActor,
  normalizeFlag,
  readActorFlag,
} from "./data.mjs";
import {
  injectSheetClasses,
  onRenderActorSheet,
  onRenderActorSheetV2,
  setWriteMutation,
} from "./sheet.mjs";
import { dnd5eRenderHooks, isDnd5eSystem } from "./systems/dnd5e.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;

function notify(kind, message) {
  globalThis.ui?.notifications?.[kind]?.(message);
}

function localize(key, fallback) {
  return globalThis.game?.i18n?.localize?.(key) || fallback;
}

function activeGmOnline() {
  return Boolean(globalThis.game?.users?.some?.((user) => user.isGM && user.active));
}

async function persistFlag(actor, flag) {
  if (typeof actor.setFlag === "function" && typeof actor.unsetFlag === "function") {
    await actor.update({ [`flags.${MODULE_ID}`]: flag });
    return;
  }
  await actor.update({ [`flags.${MODULE_ID}`]: flag });
}

async function writeMutation(actor, mutation) {
  const user = globalThis.game?.user;
  const current = readActorFlag(actor);
  const preview = applyMutation(current, mutation, { user, actor });
  if (!preview.ok) {
    if (preview.error && preview.error !== "cancelled") {
      notify("warn", localize("CHARACTERGOALS.NotPermitted", preview.error));
    }
    return preview;
  }

  if (canUserUpdateActor(actor, user)) {
    await persistFlag(actor, preview.flag);
    return preview;
  }

  if (!activeGmOnline()) {
    notify("error", localize("CHARACTERGOALS.NoGM", "A GM must be connected to change another player's character."));
    return { ok: false, error: "NO_GM", flag: null };
  }

  globalThis.game.socket.emit(SOCKET_EVENT, {
    op: "mutate",
    actorUuid: actor.uuid ?? actor.id,
    mutation,
    userId: user.id,
  });
  return preview;
}

async function onSocket(payload = {}) {
  if (!globalThis.game?.user?.isGM) return;
  if (payload.op !== "mutate") return;
  const requester = globalThis.game.users.get(payload.userId);
  if (!requester) return;
  const actor = payload.actorUuid
    ? await globalThis.fromUuid?.(payload.actorUuid)
    : globalThis.game.actors.get(payload.actorId);
  if (!actor) return;
  const result = applyMutation(readActorFlag(actor), payload.mutation, {
    user: requester,
    actor,
  });
  if (!result.ok) return;
  await persistFlag(actor, result.flag);
}

function register() {
  setWriteMutation(writeMutation);
  injectSheetClasses();
  if (globalThis.game?.socket) {
    globalThis.game.socket.on(SOCKET_EVENT, onSocket);
  }
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
});

Hooks.once("setup", () => {
  injectSheetClasses();
});

Hooks.once("ready", () => {
  register();
});

Hooks.on("renderActorSheetV2", (app, element) => {
  onRenderActorSheetV2(app, element);
});

Hooks.on("renderActorSheet", (app, html) => {
  onRenderActorSheet(app, html);
});

for (const hook of dnd5eRenderHooks()) {
  Hooks.on(hook, (app, html) => {
    if (!isDnd5eSystem()) return;
    onRenderActorSheet(app, html);
  });
}

export { MODULE_ID, normalizeFlag, writeMutation };
