import { mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const staging = join(root, ".pack-staging");
const destDir = join(staging, "character-goals");
const dist = join(root, "dist");
const zipPath = join(dist, "character-goals.zip");

const include = [
  "module.json",
  "README.md",
  "scripts",
  "styles",
  "lang",
  "templates",
  "docs",
];

rmSync(staging, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
mkdirSync(dist, { recursive: true });

for (const entry of include) {
  const from = join(root, entry);
  if (!existsSync(from)) continue;
  cpSync(from, join(destDir, entry), { recursive: true });
}

if (existsSync(zipPath)) rmSync(zipPath);
execFileSync("zip", ["-r", "-q", zipPath, "character-goals"], { cwd: staging });
rmSync(staging, { recursive: true, force: true });
console.log(`Wrote ${zipPath}`);
