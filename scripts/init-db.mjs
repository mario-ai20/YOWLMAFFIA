import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import "../src/lib/runtime-env.mjs";
import { ensureDatabaseInitialized, getConfiguredDatabaseUrl } from "../src/lib/sqlite-schema.mjs";

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const result = ensureDatabaseInitialized(getConfiguredDatabaseUrl());
  console.log(`Database initialized at ${result}`);

  const schemaSync =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npx.cmd prisma db push --skip-generate"], {
          cwd: process.cwd(),
          stdio: "inherit",
          shell: false,
        })
      : spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
          cwd: process.cwd(),
          stdio: "inherit",
          shell: false,
        });

  if (schemaSync.status !== 0) {
    process.exit(schemaSync.status ?? 1);
  }
}
