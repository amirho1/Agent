import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const roots = ["app", "components", "src/server"];
const legacyName = ["dum", "my"].join("");
const legacySuffixUpper = ["P", "MS"].join("");
const legacySuffixLower = ["p", "ms"].join("");
const banned = [
  `${legacyName}-${legacySuffixUpper}`,
  `${legacyName}-${legacySuffixLower}`,
  `${legacyName.toUpperCase()}_${legacySuffixUpper}`,
  `../${legacyName}-${legacySuffixLower}`,
];

describe("Lamasoo-only regression guard", function () {
  it("keeps active app/server/component code free of dummy integration references", async function () {
    const files = (
      await Promise.all(roots.map((root) => listFiles(join(process.cwd(), root))))
    ).flat();
    const offenders: string[] = [];

    for (const file of files) {
      if (!/\.(ts|tsx)$/.test(file) || file.endsWith(".test.ts")) {
        continue;
      }

      const content = await readFile(file, "utf8");
      if (banned.some((value) => content.includes(value))) {
        offenders.push(file.replace(`${process.cwd()}/`, ""));
      }
    }

    expect(offenders).toEqual([]);
  });
});

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
    }),
  );

  return files.flat();
}
