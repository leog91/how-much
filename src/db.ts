
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from './schema';
import { join } from "path";

// Creates the SQLite file if it doesn't exist
const sqlite = new Database(join(import.meta.dir, "../scraped_data.db"));

export const db = drizzle(sqlite, { schema });