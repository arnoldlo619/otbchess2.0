CREATE TABLE `population_aggregates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataset_id` varchar(64) NOT NULL,
	`position_key` varchar(64) NOT NULL,
	`speed` varchar(8) NOT NULL,
	`rating_band` int NOT NULL,
	`move_uci` varchar(5) NOT NULL,
	`move_san` varchar(16) NOT NULL,
	`parent_total` bigint NOT NULL,
	`move_total` bigint NOT NULL,
	`white_wins` bigint NOT NULL,
	`draws` bigint NOT NULL,
	`black_wins` bigint NOT NULL,
	CONSTRAINT `population_aggregates_id` PRIMARY KEY(`id`),
	CONSTRAINT `population_aggregate_unique` UNIQUE(`dataset_id`,`position_key`,`speed`,`rating_band`,`move_uci`)
);
--> statement-breakpoint
CREATE TABLE `population_dataset_months` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataset_id` varchar(64) NOT NULL,
	`source_month` varchar(7) NOT NULL,
	`source_filename` varchar(96) NOT NULL,
	`expected_sha256` varchar(64) NOT NULL,
	`observed_sha256` varchar(64),
	`verification_status` varchar(20) NOT NULL,
	`compressed_bytes` bigint NOT NULL,
	`games_parsed` bigint NOT NULL,
	`games_accepted` bigint NOT NULL,
	`excluded_json` text NOT NULL DEFAULT ('{}'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `population_dataset_months_id` PRIMARY KEY(`id`),
	CONSTRAINT `population_dataset_month_unique` UNIQUE(`dataset_id`,`source_month`)
);
--> statement-breakpoint
CREATE TABLE `population_dataset_versions` (
	`id` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL,
	`schema_version` int NOT NULL,
	`tracked_set_version` int NOT NULL,
	`tracked_position_count` int NOT NULL DEFAULT 0,
	`complete_months_json` text NOT NULL,
	`source_license` varchar(32) NOT NULL DEFAULT 'CC0-1.0',
	`import_code_version` varchar(64) NOT NULL,
	`previous_published_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`published_at` timestamp,
	`rolled_back_at` timestamp,
	CONSTRAINT `population_dataset_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `population_explorer_cache` (
	`request_key` varchar(128) NOT NULL,
	`response_json` text NOT NULL,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`stale_until` timestamp NOT NULL,
	`source_month_from` varchar(7) NOT NULL,
	`source_month_to` varchar(7) NOT NULL,
	CONSTRAINT `population_explorer_cache_request_key` PRIMARY KEY(`request_key`)
);
--> statement-breakpoint
CREATE TABLE `population_jobs` (
	`id` varchar(64) NOT NULL,
	`dataset_id` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL,
	`source_filename` varchar(96),
	`compressed_bytes` bigint NOT NULL,
	`games_parsed` bigint NOT NULL,
	`games_accepted` bigint NOT NULL,
	`aggregate_rows` bigint NOT NULL,
	`exclusions_json` text NOT NULL DEFAULT ('{}'),
	`failure_code` varchar(64),
	`failure_detail_redacted` varchar(500),
	`started_at` timestamp,
	`heartbeat_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `population_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `population_tracked_positions` (
	`position_key` varchar(64) NOT NULL,
	`canonical_epd` varchar(160) NOT NULL,
	`uci_path_json` text NOT NULL,
	`ply` int NOT NULL,
	`side_to_move` varchar(5) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`tracked_set_version` int NOT NULL,
	`demand_count` int NOT NULL DEFAULT 0,
	`added_at` timestamp NOT NULL DEFAULT (now()),
	`last_requested_at` timestamp,
	CONSTRAINT `population_tracked_positions_position_key` PRIMARY KEY(`position_key`)
);
--> statement-breakpoint
CREATE TABLE `rsvp_form_responses` (
	`id` varchar(36) NOT NULL,
	`form_id` varchar(36) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`user_id` varchar(64),
	`respondent_name` varchar(100) NOT NULL DEFAULT 'Anonymous',
	`respondent_email` varchar(200),
	`answers` json NOT NULL DEFAULT ('[]'),
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rsvp_form_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rsvp_forms` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`title` varchar(200) NOT NULL DEFAULT 'RSVP Form',
	`description` text,
	`questions` json NOT NULL DEFAULT ('[]'),
	`slug` varchar(64) NOT NULL,
	`is_published` tinyint NOT NULL DEFAULT 0,
	`closes_at` timestamp,
	`confirmation_message` text,
	`collect_email` tinyint NOT NULL DEFAULT 0,
	`max_responses` int,
	`allow_multiple_submissions` tinyint NOT NULL DEFAULT 0,
	`theme_color` varchar(7) DEFAULT '#22c55e',
	`header_image` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rsvp_forms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rsvp_forms_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `rf_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `clubs` ADD `silk_speed` float;--> statement-breakpoint
ALTER TABLE `clubs` ADD `silk_color` varchar(20);--> statement-breakpoint
ALTER TABLE `clubs` ADD `silk_noise` float;--> statement-breakpoint
ALTER TABLE `clubs` ADD `payment_venmo` varchar(200);--> statement-breakpoint
ALTER TABLE `clubs` ADD `payment_cashapp` varchar(200);--> statement-breakpoint
ALTER TABLE `clubs` ADD `payment_paypal` varchar(200);--> statement-breakpoint
ALTER TABLE `clubs` ADD `payment_qr_url` text;--> statement-breakpoint
ALTER TABLE `clubs` ADD `payment_note` varchar(300);--> statement-breakpoint
CREATE INDEX `population_aggregate_lookup_idx` ON `population_aggregates` (`dataset_id`,`position_key`,`speed`,`rating_band`);--> statement-breakpoint
CREATE INDEX `population_dataset_month_dataset_idx` ON `population_dataset_months` (`dataset_id`);--> statement-breakpoint
CREATE INDEX `population_dataset_status_idx` ON `population_dataset_versions` (`status`);--> statement-breakpoint
CREATE INDEX `population_dataset_published_idx` ON `population_dataset_versions` (`published_at`);--> statement-breakpoint
CREATE INDEX `population_explorer_expires_idx` ON `population_explorer_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `population_jobs_dataset_idx` ON `population_jobs` (`dataset_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `population_tracked_active_idx` ON `population_tracked_positions` (`active`,`tracked_set_version`);--> statement-breakpoint
CREATE INDEX `rfr_form_idx` ON `rsvp_form_responses` (`form_id`);--> statement-breakpoint
CREATE INDEX `rfr_event_idx` ON `rsvp_form_responses` (`event_id`);--> statement-breakpoint
CREATE INDEX `rfr_club_idx` ON `rsvp_form_responses` (`club_id`);--> statement-breakpoint
CREATE INDEX `rfr_user_idx` ON `rsvp_form_responses` (`user_id`);--> statement-breakpoint
CREATE INDEX `rf_event_idx` ON `rsvp_forms` (`event_id`);--> statement-breakpoint
CREATE INDEX `rf_club_idx` ON `rsvp_forms` (`club_id`);