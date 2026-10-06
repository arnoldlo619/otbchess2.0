CREATE TABLE `club_puzzle_relay_sessions` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`difficulty` varchar(20) NOT NULL,
	`puzzles_per_team` int NOT NULL DEFAULT 3,
	`started_by` varchar(64) NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_puzzle_relay_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `cprs_event_unique` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `club_puzzle_relay_team_members` (
	`id` varchar(64) NOT NULL,
	`team_id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`avatar_url` varchar(500),
	`order_index` int NOT NULL,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_puzzle_relay_team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `cprtm_session_user_unique` UNIQUE(`session_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `club_puzzle_relay_teams` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`team_number` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`current_puzzle_index` int NOT NULL DEFAULT 0,
	`current_member_index` int NOT NULL DEFAULT 0,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_puzzle_relay_teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `cprt_session_team_unique` UNIQUE(`session_id`,`team_number`)
);
--> statement-breakpoint
ALTER TABLE `club_events` ADD `puzzle_relay_teams` int;--> statement-breakpoint
ALTER TABLE `club_events` ADD `puzzle_relay_difficulty` varchar(20);--> statement-breakpoint
CREATE INDEX `cprs_club_idx` ON `club_puzzle_relay_sessions` (`club_id`);--> statement-breakpoint
CREATE INDEX `cprs_status_idx` ON `club_puzzle_relay_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `cprtm_team_idx` ON `club_puzzle_relay_team_members` (`team_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `cprt_session_idx` ON `club_puzzle_relay_teams` (`session_id`);