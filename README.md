# Character Goals

Foundry VTT **v14** module (`character-goals`) **v1.1.0**. Adds an unobtrusive **Goals** page on the character sheet for long/mid-term goals, up to two short-term steps, optional success/failure stakes, and complications.

This is a **Foundry module only** — a sheet page, not a floating board or a separate app. Data lives on the Actor at `flags.character-goals`.

Players invent the goals. Write them as something measurable you can fail. Optional stake fields sit under the text when you fill them in.

## Systems (same module)

One module, two sheet paths:

- **System-agnostic core** — injects a Goals tab on character-like Actor sheets (`character`, `pc`, `player`, `hero`) via ApplicationV2 `PARTS` / object-style `TABS`, with a DOM fallback. Worlds Without Number PC sheets are the first-class agnostic target.
- **dnd5e skin / hook** — when the world is `dnd5e` or the sheet class is a 5e Actor sheet (`ActorSheet5e*`, `CharacterActorSheet`), the same tab is registered on 5e’s array-style `TABS`, the page gets `character-goals-dnd5e` plus 5e gold/card styling (`styles/character-goals-dnd5e.css`), and dedicated `renderActorSheet5e*` hooks re-bind the page. Data, flags, and permissions are shared; only chrome changes.

Not a dnd5e-only module. Not a second app.

## Install (Ornn / local)

Private GitHub: [Attritable/character-goals](https://github.com/Attritable/character-goals). Foundry’s in-app installer cannot fetch a private manifest without credentials. Install by copying the module tree:

1. Clone or download this repo (or use `dist/character-goals.zip` / `dist/character-goals.tgz`).
2. Place the folder at **`Data/modules/character-goals/`** so that file is `Data/modules/character-goals/module.json`.
3. Restart Foundry (or reload the setup screen), enable **Character Goals** in Manage Modules.
4. Orianna: enable on the world **after** this GitHub tree exists.

Compatibility: Foundry **14.x** (`minimum` / `verified` 14).

```bash
npm test          # offline data + visibility tests (no Foundry)
npm run pack      # rebuild dist/character-goals.zip and .tgz
```

## Sheet usage

Open a **character** Actor sheet → **Goals**.

- **Owner or GM** adds a long/mid-term goal, then up to **2** short-term children. Short-term goals are approvable and can have complications.
- Add/edit dialogs on goals and short-term goals include optional **Success** and **Failure** stakes. Leave them blank if you want; they persist and show compactly under the goal when present.
- **Any player** can add a **possible complication** on their own character **or another player’s**.
- New entries default to **creator-only**. GM-created → GM-only.
- **Hidden means hidden from other players only.** The **GM always sees every node**, including hidden ones. Other players see a node only if they created it or the GM eyeball has published it.
- **GM eyeball** (`fa-eye` / `fa-eye-slash`) publishes that entry to everyone. The GM can toggle this even when they are not the creator. The slash-eye tooltip reads: “Hidden from other players (the GM still sees this).”
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
| Edit / delete a node (including stakes) | Creator of that node, or GM |
| Approve / reject | GM |
| Eyeball (visible to all) | GM, including nodes they did not create |
| See a node | Creator, **any GM (always — hidden is from other players only)**, or everyone when the eyeball is on |
| See item links | GM only |

Proven offline in `tests/visibility.test.mjs` and `tests/data.test.mjs`.

Default visibility: `visibleToAll: false`, `createdBy` = the user who created the node. Enforcement is in the UI and in `applyMutation` (the only write path). Actor flags are still on the document for clients who can see the Actor — this is not a hidden Journal.

## Data

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the flag shape, v14 sheet injection (agnostic + dnd5e), and documented deviations.

Parent and short goals persist:

- `successStake` (string) — what success looks like / the reward
- `failureStake` (string) — consequence of failure

Empty strings are valid. Complications do not have stakes.

## Research

The hierarchy follows the **Fishel proactive-goal framework** as described in secondary sources (players invent measurable goals with stakes; the GM puts barriers in the way; short steps serve a longer goal). That research is **secondary** — reviews and community notes, not the book text. This README does not quote the book.

Complications on other PCs, default-hidden nodes, the GM eyeball, and approve/reject-with-reason are **table design** for this sheet. They are not named book mechanics.

Faction clocks, villain boards, and Alexandrian Nodes are out of scope.

## Layout

```
module.json
scripts/module.mjs
scripts/data.mjs
scripts/sheet.mjs
scripts/systems/dnd5e.mjs
styles/character-goals.css
styles/character-goals-dnd5e.css
lang/en.json
templates/goals-page.hbs
tests/*.mjs
```
