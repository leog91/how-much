
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from 'drizzle-orm';

export const products = sqliteTable("products", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    price: text("price").notNull(),
    url: text("url").notNull(),
    scrapedAt: text("scraped_at").default(sql`CURRENT_TIMESTAMP`),
});
