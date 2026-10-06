CREATE TABLE `club_trivia_questions` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`question_number` int NOT NULL,
	`prompt` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`opened_at` timestamp,
	`closed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_trivia_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ctq_session_number_unique` UNIQUE(`session_id`,`question_number`)
);
--> statement-breakpoint
CREATE TABLE `club_trivia_responses` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`question_id` varchar(64) NOT NULL,
	`team_id` varchar(64) NOT NULL,
	`answer` text NOT NULL,
	`is_correct` tinyint,
	`submitted_by` varchar(64) NOT NULL,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`scored_at` timestamp,
	CONSTRAINT `club_trivia_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `ctr_question_team_unique` UNIQUE(`question_id`,`team_id`)
);
--> statement-breakpoint
CREATE TABLE `club_trivia_sessions` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'waiting',
	`current_question_number` int NOT NULL DEFAULT 0,
	`total_questions` int NOT NULL,
	`started_by` varchar(64) NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_trivia_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `cts_event_unique` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `club_trivia_team_members` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`team_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL DEFAULT '',
	`avatar_url` text,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_trivia_team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `cttm_session_user_unique` UNIQUE(`session_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `club_trivia_teams` (
	`id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`team_number` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_trivia_teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `ctt_session_number_unique` UNIQUE(`session_id`,`team_number`)
);
--> statement-breakpoint
ALTER TABLE `club_events` ADD `trivia_question_count` int;--> statement-breakpoint
ALTER TABLE `club_events` ADD `trivia_categories` text;--> statement-breakpoint
CREATE INDEX `ctq_session_status_idx` ON `club_trivia_questions` (`session_id`,`status`);--> statement-breakpoint
CREATE INDEX `ctr_session_question_idx` ON `club_trivia_responses` (`session_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `cts_club_idx` ON `club_trivia_sessions` (`club_id`);--> statement-breakpoint
CREATE INDEX `cts_status_idx` ON `club_trivia_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `cttm_team_idx` ON `club_trivia_team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `ctt_session_score_idx` ON `club_trivia_teams` (`session_id`,`score`);