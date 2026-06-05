CREATE TABLE IF NOT EXISTS `annual_report_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer DEFAULT 2024 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`pdf_url` text,
	`ocr_job_id` text,
	`page_count` integer,
	`r2_key` text,
	`error_msg` text,
	`attempts` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `daily_quota_log` (
	`date` text PRIMARY KEY NOT NULL,
	`pages_used` integer DEFAULT 0,
	`pages_limit` integer DEFAULT 19500
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_rep_ticker_year_rt_idx` ON `audit_reports` (`ticker`,`year`,`report_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bank_met_ticker_year_rt_idx` ON `banking_metrics` (`ticker`,`year`,`report_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `debts_ticker_year_idx` ON `debts_breakdown` (`ticker`,`year`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `fin_ins_ticker_year_rt_idx` ON `financial_insights` (`ticker`,`year`,`report_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `gen_met_ticker_year_rt_idx` ON `general_metrics` (`ticker`,`year`,`report_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inv_proj_ticker_year_idx` ON `inventories_and_projects` (`ticker`,`year`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `proc_rep_ticker_year_rt_idx` ON `processed_reports` (`ticker`,`year`,`report_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `re_met_ticker_year_rt_idx` ON `real_estate_metrics` (`ticker`,`year`,`report_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `rp_tx_ticker_year_idx` ON `related_party_transactions` (`ticker`,`year`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sec_met_ticker_year_rt_idx` ON `securities_metrics` (`ticker`,`year`,`report_type`);