CREATE TABLE `shareholder_structures` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer DEFAULT 2024 NOT NULL,
	`shareholder_name` text NOT NULL,
	`shareholder_type` text NOT NULL,
	`share_count` integer,
	`share_percentage` real NOT NULL,
	`is_major_shareholder` integer DEFAULT false NOT NULL,
	`is_board_member` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sh_struct_ticker_year_idx` ON `shareholder_structures` (`ticker`,`year`);--> statement-breakpoint
ALTER TABLE `financial_insights` ADD `business_risks` text;