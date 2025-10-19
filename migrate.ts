
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./src/db.ts";

async function runMigrations() {
    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations finished.");
}

runMigrations().catch(console.error);