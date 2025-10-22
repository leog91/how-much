CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`price` text NOT NULL,
	`url` text NOT NULL,
	`scraped_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `products_to_scrape` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`date_added` text DEFAULT CURRENT_TIMESTAMP,
	`active` integer DEFAULT true,
	`notes` text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE `provider_selectors` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`price_selector` text NOT NULL,
	`title_selector` text NOT NULL,
	`image_selector` text,
	`availability_selector` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_selectors_provider_unique` ON `provider_selectors` (`provider`);