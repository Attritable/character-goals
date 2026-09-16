# Character Goals — architecture

Starting contract from the Azir sketch, verified against Foundry VTT **v14** sheet APIs. Deviations are listed at the bottom.

## Public surface

- One Actor sheet **page/tab**: "Goals"
- No ApplicationV2 floating board

## Data (per Actor)

`flags.character-goals`:

```ts
type Visibility = { createdBy: string; visibleToAll: boolean }; // GM eyeball sets visibleToAll
type Approval = "pending" | "approved" | "rejected";
type LinkedItem = { uuid: string; name?: string; img?: string }; // GM-only in UI

type Complication = {
  id: string;
  text: string;
  visibility: Visibility;
};

type ShortGoal = {
  id: string;
  text: string;
  approval: Approval;
  rejectReason?: string;
  visibility: Visibility;
  complications: Complication[];
  linkedItems: LinkedItem[]; // GM-only display
};

type Goal = {
  id: string;
  text: string; // long/midterm
  approval: Approval;
  rejectReason?: string;
  visibility: Visibility;
  shortGoals: ShortGoal[]; // 1–2 encouraged in UI, not hard-capped in data
  complications: Complication[];
  linkedItems: LinkedItem[];
};

type ActorGoalsFlag = { goals: Goal[] };
```

`img` on `LinkedItem` is an additive cache of the Foundry Item icon so the GM-only chip can render without a live `fromUuid` round-trip.

## Permissions (UI + write path)

| Action | Who |
| --- | --- |
| Add goal | Owner of actor, or GM |
| Add short-term goal | Owner of actor, or GM |
| Add complication | Any player (own or others' actors), or GM |
| Edit/delete own created node | Creator or GM |
| Approve/reject | GM |
| Eyeball visibility | GM (even if not the creator) |
| See node | Creator, or GM, or everyone if `visibleToAll` |
| See linkedItems | GM only |

Visibility is **UI + write-path**. Actor flags are still in the document payload for anyone who can see the Actor. That matches typical Foundry module practice; it is not document-level secrecy.

## Hooks / sheet injection (v14)

Foundry v14 does **not** ship a global “register an extra Actor sheet page” API. ApplicationV2 sheets expose `static PARTS` + `static TABS` so modules can inject a tab. Worlds Without Number PC sheets already do this (`TABS.primary`, generic `tab-navigation.hbs`, `_preparePartContext` assigns `context.tab = context.tabs[partId]`).

This module:

1. On `setup` / `ready`, walks `CONFIG.Actor.sheetClasses` for character-like types (`character`, `pc`, `player`, `hero`) and injects `PARTS["character-goals"]` + a `TABS` entry. Wraps `_preparePartContext` so the part receives the filtered goals view-model.
2. Hooks `renderActorSheetV2` (HTMLElement) and legacy `renderActorSheet` (jQuery-or-element). If the Goals tab is missing (system did not use PARTS/TABS, or `_configureRenderParts` dropped it), the module DOM-injects a nav item + page.
3. Binds click / drop listeners on the Goals page only. Item drops call `foundry.applications.ux.TextEditor.implementation.getDragEventData` (legacy `TextEditor.getDragEventData` fallback) and `stopPropagation` so the sheet does not also embed the Item.

## Writes

- Owner/GM: `actor.update({ flags.character-goals })`.
- Non-owner adding a complication: `module.json` `socket: true`. The client emits `module.character-goals`; a connected GM re-runs `applyMutation` **as the requester** and persists. If no GM is online, the UI errors.

No world documents for MVP. No Alexandrian Nodes features.

## Module layout

```
module.json
README.md
scripts/module.mjs
scripts/data.mjs      // normalize, CRUD, visibility helpers
scripts/sheet.mjs     // sheet page render + listeners
styles/character-goals.css
lang/en.json
templates/goals-page.hbs
tests/*.mjs           // data helpers offline
```

## Install

GitHub `Attritable/character-goals` → Ornn copies to `Data/modules/character-goals/` → Orianna enables on wwn only.

## Deviations from the original sketch

1. **No formal “sheet page registration” API.** v14’s supported extension point is mutating the target sheet class `PARTS` / `TABS` and wrapping `_preparePartContext`. `renderActorSheet` alone is insufficient for ApplicationV2 (hook name is `renderActorSheetV2`, second argument is an `HTMLElement`, not jQuery).
2. **Socket relay is required** for “any player adds a complication on another PC.” Non-owners cannot `actor.update` flags. The sketch allowed “socket or just actor.update”; both are implemented, with socket used only when the requester cannot update the Actor.
3. **Character-like actor types only.** WWN also has faction / starship / project / power-armor sheets. Goals inject on `character` (and aliases), not those.
4. **Linked item `img`** stored alongside `uuid` / `name` so the GM chip can use Foundry’s default item icon without extra lookups.
5. **Approve/reject UI** uses Foundry `data-tooltip` plus `title` so hover works even when the system tooltip manager is not attached to the injected page.

## Research (incoming)

Vel'Koz Ficelle / *Game Master’s Handbook to Proactive Roleplay* research is **not** in this slice. Fold those patterns into `scripts/data.mjs` + the Goals page when they land. Do not grow Alexandrian Nodes here.
