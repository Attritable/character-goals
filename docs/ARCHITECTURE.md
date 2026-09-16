# Character Goals — architecture

Starting contract from the Azir sketch, verified against Foundry VTT **v14** and the Vel'Koz / Heimerdinger v1 handoff. Deviations and resolved policy are listed at the bottom.

## Public surface

- One Actor sheet **page/tab**: "Goals"
- No ApplicationV2 floating board
- **System-agnostic** character Actor sheets (not dnd5e-only)

## Data (per Actor)

`flags.character-goals`:

```ts
type Visibility = { createdBy: string; visibleToAll: boolean }; // GM eyeball sets visibleToAll
type Approval = "pending" | "approved" | "rejected";
type LinkedItem = { uuid: string; name?: string; img?: string }; // GM-only in UI
type NodeType = "goal_longmid" | "goal_short" | "complication";

type Complication = {
  id: string;
  type: "complication";
  text: string;
  visibility: Visibility;
  createdAt?: string;
  linkedItems: LinkedItem[];
};

type ShortGoal = {
  id: string;
  type: "goal_short";
  text: string;
  approval: Approval;
  rejectReason?: string; // required when rejected
  visibility: Visibility;
  createdAt?: string;
  complications: Complication[];
  linkedItems: LinkedItem[];
};

type Goal = {
  id: string;
  type: "goal_longmid";
  text: string; // long/midterm; free text in v1
  approval: Approval;
  rejectReason?: string;
  visibility: Visibility;
  createdAt?: string;
  shortGoals: ShortGoal[]; // hard cap: 2
  complications: Complication[];
  linkedItems: LinkedItem[];
};

type ActorGoalsFlag = { goals: Goal[] };
```

`img` on `LinkedItem` caches the Foundry icon so the GM chip can render without a live `fromUuid` round-trip.

v1 does **not** store failure stakes or “what success looks like” as separate fields. Stubbed in the README for later.

## Permissions (UI + write path)

| Action | Who |
| --- | --- |
| Add goal | Owner of actor, or GM |
| Add short-term goal | Owner of actor, or GM; **max 2** per parent |
| Add complication | Any player (own or others' actors), or GM |
| Edit/delete own created node | Creator or GM (not another player on your sheet) |
| Approve/reject | GM; reject requires a reason |
| Eyeball visibility | GM (even if not the creator) |
| See node | Creator, **any GM always**, or everyone if `visibleToAll` |
| See linkedItems | GM only |

Visibility is **UI + write-path**. Actor flags are still in the document payload for anyone who can see the Actor.

## Hooks / sheet injection (v14)

Foundry v14 does **not** ship a global “register an extra Actor sheet page” API. ApplicationV2 sheets expose `static PARTS` + `static TABS`. Worlds Without Number PC sheets already do this (`TABS.primary`).

This module:

1. On `setup` / `ready`, walks `CONFIG.Actor.sheetClasses` for character-like types (`character`, `pc`, `player`, `hero`) and injects `PARTS["character-goals"]` + a `TABS` entry. Wraps `_preparePartContext` so the part receives the filtered goals view-model.
2. Hooks `renderActorSheetV2` (HTMLElement) and legacy `renderActorSheet`. If the Goals tab is missing, the module DOM-injects a nav item + page.
3. Binds click / drop listeners on the Goals page only. Item (or Actor/Token) drops call `foundry.applications.ux.TextEditor.implementation.getDragEventData` and `stopPropagation`.

## Writes

- Owner/GM: `actor.update({ flags.character-goals })`.
- Non-owner adding a complication: `socket: true`. A connected GM re-runs `applyMutation` **as the requester**.

No world documents. No Alexandrian Nodes features. No faction clocks.

## Resolved v1 policy (Heimerdinger handoff)

1. **GM always sees** every node, including private ones.
2. **Max 2** short children per parent — enforced in `applyMutation`, not only in the UI. Normalize does not delete extras already stored.
3. **System-agnostic** Actor sheet tab. WWN is the first-class `PARTS`/`TABS` target; other systems use the same injection or DOM fallback.
4. Foundry **v14**.
5. Optional later fields: failure stakes / success vision — README stub only.
6. Repo stays **`Attritable/character-goals`**. GitHub before Hostinger.

## Deviations from the original Azir sketch

1. **No formal “sheet page registration” API.** v14 path is mutating `PARTS` / `TABS` and wrapping `_preparePartContext`.
2. **Socket relay** for cross-actor complications.
3. **Character-like actor types only** (not WWN faction / starship sheets).
4. **Linked item `img`** stored with `uuid` / `name`.
5. **Short-term cap is hard** (research + Heimerdinger acceptance), not a hint.
6. **Complications hold their own `linkedItems`** (handoff: drop onto a goal or complication).
7. **`type` + optional `createdAt`** added so nodes match the handoff model without flattening the tree.

## Research

Fishel proactive-goal shell (secondary sources only; no book excerpts): players invent measurable goals with stakes; 1–2 short steps serve a longer goal. Complications on other PCs, default-hidden visibility, eyeball publish, and approve/reject are table process for this sheet — not named book mechanics. Do not grow Alexandrian Nodes here.
