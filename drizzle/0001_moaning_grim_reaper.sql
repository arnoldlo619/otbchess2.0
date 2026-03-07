CREATE TABLE `correction_entries` (
	`id` varchar(36) NOT NULL,
	`game_id` varchar(36) NOT NULL,
	`move_number` int NOT NULL,
	`candidate_moves` text,
	`chosen_move` varchar(20),
	`confidence` int,
	`skipped` int DEFAULT 0,
	CONSTRAINT `correction_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `move_analyses` (
	`id` varchar(36) NOT NULL,
	`game_id` varchar(36) NOT NULL,
	`move_number` int NOT NULL,
	`color` varchar(5) NOT NULL,
	`san` varchar(20) NOT NULL,
	`fen` text NOT NULL,
	`eval` int,
	`best_move` varchar(20),
	`classification` varchar(20),
	`win_chance` int,
	`continuation` text,
	CONSTRAINT `move_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processed_games` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`pgn` text NOT NULL,
	`move_timestamps` text,
	`opening_name` varchar(255),
	`opening_eco` varchar(10),
	`total_moves` int DEFAULT 0,
	`white_player` varchar(100),
	`black_player` varchar(100),
	`result` varchar(10),
	`event` varchar(255),
	`date` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processed_games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recording_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tournament_id` varchar(255),
	`status` varchar(30) NOT NULL DEFAULT 'ready',
	`video_key` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recording_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_state` (
	`tournament_id` varchar(255) NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tournament_state_tournament_id` PRIMARY KEY(`tournament_id`)
);
--> statement-breakpoint
CREATE TABLE `user_tournaments` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`venue` varchar(255),
	`date` varchar(20),
	`format` varchar(50),
	`rounds` int,
	`invite_code` varchar(20),
	`status` varchar(20) DEFAULT 'registration',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_tournaments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`chesscom_username` varchar(100),
	`lichess_username` varchar(100),
	`chesscom_elo` int,
	`lichess_elo` int,
	`avatar_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `ce_game_id_idx` ON `correction_entries` (`game_id`);--> statement-breakpoint
CREATE INDEX `ma_game_id_idx` ON `move_analyses` (`game_id`);--> statement-breakpoint
CREATE INDEX `pg_session_id_idx` ON `processed_games` (`session_id`);--> statement-breakpoint
CREATE INDEX `rs_user_id_idx` ON `recording_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `rs_status_idx` ON `recording_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `ut_user_id_idx` ON `user_tournaments` (`user_id`);--> statement-breakpoint
CREATE INDEX `ut_tournament_id_idx` ON `user_tournaments` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);