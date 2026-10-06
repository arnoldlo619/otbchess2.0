CREATE TABLE `club_speed_dating_pairings` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`round_number` int NOT NULL,
	`board_number` int NOT NULL,
	`white_user_id` varchar(64) NOT NULL,
	`black_user_id` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_speed_dating_pairings_id` PRIMARY KEY(`id`),
	CONSTRAINT `csdpr_session_round_board_unique` UNIQUE(`session_id`,`round_number`,`board_number`)
);
--> statement-breakpoint
CREATE TABLE `club_speed_dating_participants` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL DEFAULT '',
	`avatar_url` text,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_speed_dating_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `csdp_session_user_unique` UNIQUE(`session_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `club_speed_dating_sessions` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`current_round` int NOT NULL DEFAULT 1,
	`total_rounds` int NOT NULL,
	`minutes_per_round` int NOT NULL DEFAULT 5,
	`current_round_ends_at` timestamp,
	`started_by` varchar(64) NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_speed_dating_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `csds_event_unique` UNIQUE(`event_id`)
);
--> statement-breakpoint
ALTER TABLE `club_events` ADD `speed_dating_rounds` int;--> statement-breakpoint
ALTER TABLE `club_events` ADD `speed_dating_minutes` int;--> statement-breakpoint
CREATE INDEX `csdpr_session_round_idx` ON `club_speed_dating_pairings` (`session_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `csdp_event_idx` ON `club_speed_dating_participants` (`event_id`);--> statement-breakpoint
CREATE INDEX `csds_club_idx` ON `club_speed_dating_sessions` (`club_id`);--> statement-breakpoint
CREATE INDEX `csds_status_idx` ON `club_speed_dating_sessions` (`status`);