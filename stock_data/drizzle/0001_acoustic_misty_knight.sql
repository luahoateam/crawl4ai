CREATE TABLE IF NOT EXISTS `processed_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`processed_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
