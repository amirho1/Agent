import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), "..");
loadEnvFile(join(rootDir, ".env"));

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = resolve(rootDir, databaseUrl.replace(/^file:/, ""));
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS "_agent_migrations" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const migrations = [
  {
    name: "20260709195100_init",
    path: join(rootDir, "prisma/migrations/20260709195100_init/migration.sql"),
  },
  {
    name: "20260709211000_add_read_results",
    path: join(
      rootDir,
      "prisma/migrations/20260709211000_add_read_results/migration.sql",
    ),
  },
];

for (const migration of migrations) {
  const applied = db
    .prepare('SELECT "name" FROM "_agent_migrations" WHERE "name" = ?')
    .get(migration.name);

  if (applied) {
    continue;
  }

  const sql = readFileSync(migration.path, "utf8");
  db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO "_agent_migrations" ("name") VALUES (?)').run(
      migration.name,
    );
  })();
}

db.close();
console.log(`Initialized SQLite database at ${dbPath}`);

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    process.env[key] ??= valueParts.join("=");
  }
}
