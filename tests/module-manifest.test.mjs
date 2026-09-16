import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("module.json", () => {
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

  it("is installable for Foundry 14.x at Data/modules/character-goals/", () => {
    assert.equal(manifest.id, "character-goals");
    assert.equal(manifest.title, "Character Goals");
    assert.equal(manifest.compatibility.minimum, "14");
    assert.equal(String(manifest.compatibility.verified).startsWith("14"), true);
    assert.equal(manifest.socket, true);
    assert.equal(manifest.version, "1.1.0");
    assert.ok(manifest.esmodules.includes("scripts/module.mjs"));
    assert.ok(manifest.styles.includes("styles/character-goals.css"));
    assert.ok(manifest.styles.includes("styles/character-goals-dnd5e.css"));
    assert.equal(manifest.languages[0].path, "lang/en.json");
    const recommended = (manifest.relationships?.recommends ?? []).map((row) => row.id);
    assert.ok(recommended.includes("wwn"));
    assert.ok(recommended.includes("dnd5e"));
  });
});
