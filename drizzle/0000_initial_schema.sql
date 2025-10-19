CREATE TABLE `scraped_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`price` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scraped_items_url_unique` ON `scraped_items` (`url`);