import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleManagerPath = path.join(
  rootDir,
  "node_modules",
  "app-builder-lib",
  "out",
  "node-module-collector",
  "moduleManager.js",
);
async function patchFile(filePath, replacements) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch {
    return false;
  }

  let output = source;
  let changed = false;
  for (const [search, replace] of replacements) {
    if (output.includes(search)) {
      output = output.replace(search, replace);
      changed = true;
    }
  }

  if (changed && output !== source) {
    await writeFile(filePath, output);
  }

  return changed;
}

const results = await Promise.all([
  patchFile(moduleManagerPath, [
    ['[LogMessageByKey.PKG_DUPLICATE_REF]: "info",', '[LogMessageByKey.PKG_DUPLICATE_REF]: "debug",'],
  ]),
]);

if (results.some(Boolean)) {
  console.log("Patched electron-builder warnings.");
}
