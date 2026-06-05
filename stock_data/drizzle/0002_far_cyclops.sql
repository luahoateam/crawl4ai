CREATE TABLE IF NOT EXISTS `financial_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`year` integer NOT NULL,
	`report_type` text NOT NULL,
	`related_party_risk` text,
	`debt_risk` text,
	`inventory_risk` text,
	`governance_risk_score` integer,
	`overall_analysis` text,
	FOREIGN KEY (`ticker`) REFERENCES `companies`(`ticker`) ON UPDATE no action ON DELETE cascade
);
