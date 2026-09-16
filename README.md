# Character Goals

Foundry VTT **v14** module (`character-goals`). Adds an unobtrusive **Goals** page on the character sheet for long/mid-term goals, 1–2 short-term steps, and complications.

This is a sheet page, not a floating board. Data lives on the Actor at `flags.character-goals`.

## Install (Ornn / local)

Private GitHub: [Attritable/character-goals](https://github.com/Attritable/character-goals). Foundry’s in-app installer cannot fetch a private manifest without credentials. Install by copying the module tree:

1. Clone or download this repo (or use `dist/character-goals.zip`).
2. Place the folder at **`Data/modules/character-goals/`** so that file is `Data/modules/character-goals/module.json`.
3. Restart Foundry (or reload the setup screen), enable **Character Goals** in Manage Modules.
4. Orianna: enable on the **wwn** world only.

Compatibility: Foundry **14.x** (`minimum` / `verified` 14). System-agnostic, with first-class injection for Worlds Without Number ApplicationV2 PC sheets (`TABS.primary` + `PARTS`). Other systems get the same tab when they expose PARTS/TABS, or a DOM-injected tab via `renderActorSheetV2` / legacy `renderActorSheet`.

```bash
npm test          # offline data + visibility tests (no Foundry)
npm run pack      # rebuild dist/character-goals.zip
```

## Sheet usage

Open a **character** Actor sheet → **Goals**.

- **Owner or GM** adds a long/mid-term goal. The UI encourages **1–2 short-term** sub-goals (not a data cap). Short-term goals are approvable and can have complications.
- **Any player** can add a **possible complication** on their own character **or another player’s**.
- New entries default to **creator-only**. If a GM created it, only GMs see it.
- **GM eyeball** (`fa-eye` / `fa-eye-slash`) makes that entry visible to everyone. The GM can toggle this even when they are not the creator.
- **GM approve / reject** on goals and short-term goals: checkmark vs red exclamation. Hover the mark to read the reject reason.
- **Drag a Foundry Item** onto a goal or short-term goal to link it. Links use Foundry’s default drag payload (`TextEditor.getDragEventData`) and the item icon. **Links are always GM-only**, even when the goal is visible to everyone.
- Edit/delete: creator or GM.

A player adding a complication on someone else’s character needs a **connected GM** (socket relay). Owners write flags directly.

## Permission matrix

| Action | Who |
| --- | --- |
| Add goal / short-term goal | Owner of that Actor, or GM |
| Add complication | Any player, on their own **or** another PC; or GM |
| Edit / delete a node | Creator of that node, or GM |
| Approve / reject | GM |
| Eyeball (visible to all) | GM, including nodes they did not create |
| See a node | Creator, any GM, or everyone when the eyeball is on |
| See item links | GM only |

Proven offline in `tests/visibility.test.mjs` and `tests/data.test.mjs`.

Default visibility: `visibleToAll: false`, `createdBy` = the user who created the node. GM-created → GM-only (all GMs can see). Enforcement is in the UI and in `applyMutation` (the only write path). Actor flags are still on the document for clients who can see the Actor — this is not a hidden Journal.

## Data

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the flag shape, v14 sheet injection, and documented deviations from the original sketch.

## Research (incoming)

**Vel'Koz Ficelle / *Game Master’s Handbook to Proactive Roleplay*** research will be folded in later. This slice only scaffolds goals, short-term steps, and complications. Do not grow Alexandrian Nodes features here.

## Layout

```
module.json
scripts/module.mjs
scripts/data.mjs
scripts/sheet.mjs
styles/character-goals.css
lang/en.json
templates/goals-page.hbs
tests/*.mjs
```
