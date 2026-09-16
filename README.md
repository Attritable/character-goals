# Character Goals

Foundry VTT **v14** module (`character-goals`). Adds an unobtrusive **Goals** page on the character sheet for long/mid-term goals, up to two short-term steps, and complications.

This is a sheet page, not a floating board. Data lives on the Actor at `flags.character-goals`. System-agnostic Actor sheet injection (WWN PC sheets via `PARTS`/`TABS`; other systems via the same hook or a DOM fallback). No dnd5e-only specialization.

Players invent the goals. Write them as something measurable you can fail. Free text is enough for v1.

## Install (Ornn / local)

Private GitHub: [Attritable/character-goals](https://github.com/Attritable/character-goals). Foundry’s in-app installer cannot fetch a private manifest without credentials. Install by copying the module tree:

1. Clone or download this repo (or use `dist/character-goals.zip`).
2. Place the folder at **`Data/modules/character-goals/`** so that file is `Data/modules/character-goals/module.json`.
3. Restart Foundry (or reload the setup screen), enable **Character Goals** in Manage Modules.
4. Orianna: enable on the **wwn** world only — **after** this GitHub tree exists.

Compatibility: Foundry **14.x** (`minimum` / `verified` 14).

```bash
npm test          # offline data + visibility tests (no Foundry)
npm run pack      # rebuild dist/character-goals.zip
```

## Sheet usage

Open a **character** Actor sheet → **Goals**.

- **Owner or GM** adds a long/mid-term goal, then up to **2** short-term children. Short-term goals are approvable and can have complications.
- **Any player** can add a **possible complication** on their own character **or another player’s**.
- New entries default to **creator-only**. GM-created → GM-only. **The GM always sees every node**, including private ones.
- **GM eyeball** (`fa-eye` / `fa-eye-slash`) publishes that entry to everyone. The GM can toggle this even when they are not the creator.
- **GM approve / reject** on goals and short-term goals: checkmark vs red exclamation. Hover the mark to read the reject reason (required on reject).
- **Drag a Foundry Item** (or Actor/Token) onto a goal, short-term goal, or complication to link it. Links use Foundry’s default drag payload and icon. **Links are always GM-only**, even when the node is published.
- Edit/delete: creator or GM (not another player’s complication on your sheet).

A player adding a complication on someone else’s character needs a **connected GM** (socket relay). Owners write flags directly.

## Permission matrix

| Action | Who |
| --- | --- |
| Add goal / short-term goal | Owner of that Actor, or GM |
| Add short-term goal beyond 2 | Nobody (hard cap) |
| Add complication | Any player, on their own **or** another PC; or GM |
| Edit / delete a node | Creator of that node, or GM |
| Approve / reject | GM |
| Eyeball (visible to all) | GM, including nodes they did not create |
| See a node | Creator, **any GM (always)**, or everyone when the eyeball is on |
| See item links | GM only |

Proven offline in `tests/visibility.test.mjs` and `tests/data.test.mjs`.

Default visibility: `visibleToAll: false`, `createdBy` = the user who created the node. Enforcement is in the UI and in `applyMutation` (the only write path). Actor flags are still on the document for clients who can see the Actor — this is not a hidden Journal.

## Data

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the flag shape, v14 sheet injection, and documented deviations.

## Research

The hierarchy follows the **Fishel proactive-goal framework** as described in secondary sources (players invent measurable goals with stakes; the GM puts barriers in the way; short steps serve a longer goal). That research is **secondary** — reviews and community notes, not the book text. This README does not quote the book.

Complications on other PCs, default-hidden nodes, the GM eyeball, and approve/reject-with-reason are **table design** for this sheet. They are not named book mechanics.

**Not in v1 (stub for later):** separate fields for failure stakes and “what success looks like.” Free-text goals are enough now. Faction clocks, villain boards, and Alexandrian Nodes are out of scope.

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
