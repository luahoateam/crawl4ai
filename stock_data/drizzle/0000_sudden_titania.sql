CREATE TABLE IF NOT EXISTS `audit_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`auditor_name` text NOT NULL,
	`audit_opinion` text NOT NULL,
	`going_concern_issue` integer DEFAULT false NOT NULL,
	`going_concern_detail` text,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `banking_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`casa_ratio` real,
	`nim` real,
	`non_performing_loans` text,
	`provision_coverage_ratio` real,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `companies` (
	`ticker` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`business_model` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `debts_breakdown` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`creditor_name` text NOT NULL,
	`debt_type` text NOT NULL,
	`amount` real,
	`interest_rate` text,
	`collateral` text,
	`maturity_date` text,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `general_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`gross_margin` real,
	`depreciation_expense` real,
	`divestment_profit` real,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `inventories_and_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`item_name` text NOT NULL,
	`item_type` text NOT NULL,
	`value` real,
	`provision` real,
	`description` text,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `real_estate_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`customer_advances` real,
	`unearned_revenue` real,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `related_party_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`related_party_name` text NOT NULL,
	`relationship` text,
	`transaction_type` text,
	`value` real,
	`interest_rate` text,
	`collateral` text,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `securities_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`margin_outstanding` real,
	`fvtpl_value` real,
	`afs_value` real,
	`htm_value` real,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
