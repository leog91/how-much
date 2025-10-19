
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from './schema';

// Creates the SQLite file if it doesn't exist
const sqlite = new Database("scraped_data.db");

// Export the Drizzle DB instance and the schema
export const db = drizzle(sqlite, { schema });