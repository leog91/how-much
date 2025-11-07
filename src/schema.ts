
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from 'drizzle-orm';

export const products = sqliteTable("products", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    price: text("price").notNull(),
    url: text("url").notNull(),
    scrapedAt: text("scraped_at").default(sql`CURRENT_TIMESTAMP`),
});



export const productsToScrape = sqliteTable("products_to_scrape", {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    dateAdded: text("date_added").default(sql`CURRENT_TIMESTAMP`),
    active: integer("active", { mode: "boolean" }).default(true),
    notes: text("notes").default(''),
});


export const providerSelectors = sqliteTable("provider_selectors", {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().unique(),
    priceSelector: text("price_selector").notNull(),
    priceSelectorNotInSale: text("price_selector_not_in_sale").notNull().default(''),
    titleSelector: text("title_selector").notNull(),
    imageSelector: text("image_selector"),
    availabilitySelector: text("availability_selector"),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
    notes: text("notes"),
});