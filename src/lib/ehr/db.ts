import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as schema from "@/lib/ehr/schema";

export const EHR_DB_FILENAME = "careloop.sqlite";

function dbPath() {
  return join(process.cwd(), "data", EHR_DB_FILENAME);
}

let _sqlite: Database.Database | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Shared SQLite connection for API routes (Node runtime only).
 * Creates `data/` if missing. Run `npm run db:push && npm run db:seed` first.
 */
export function getEhrDb() {
  if (_db) return _db;
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  _sqlite = new Database(dbPath());
  _sqlite.pragma("journal_mode = WAL");
  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function ehrDatabaseConfigured(): boolean {
  return existsSync(dbPath());
}
