CREATE TABLE `battle_rooms` (
	`id` varchar(36) NOT NULL,
	`code` varchar(8) NOT NULL,
	`host_id` varchar(36) NOT NULL,
	`guest_id` varchar(36),
	`status` varchar(20) NOT NULL DEFAULT 'waiting',
	`result` varchar(20),
	`time_control` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`started_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `battle_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `battle_rooms_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `club_battles` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(36) NOT NULL,
	`player_a_id` varchar(64) NOT NULL,
	`player_a_name` varchar(100) NOT NULL,
	`player_b_id` varchar(64) NOT NULL,
	`player_b_name` varchar(100) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`result` varchar(20),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`started_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `club_battles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_chess_games` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36) NOT NULL,
	`white_id` varchar(36) NOT NULL,
	`black_id` varchar(36) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`pgn` text DEFAULT (''),
	`current_fen` text DEFAULT ('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
	`turn` varchar(10) NOT NULL DEFAULT 'white',
	`result` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_chess_games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_conversations` (
	`id` varchar(36) NOT NULL,
	`club_id` varchar(36) NOT NULL,
	`user_a_id` varchar(36) NOT NULL,
	`user_b_id` varchar(36) NOT NULL,
	`last_message_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_invites` (
	`id` varchar(36) NOT NULL,
	`club_id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`token` varchar(64) NOT NULL,
	`invited_by` varchar(36) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`accepted_at` timestamp,
	CONSTRAINT `club_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `club_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `club_messages` (
	`id` varchar(36) NOT NULL,
	`conversation_id` varchar(36) NOT NULL,
	`sender_id` varchar(36) NOT NULL,
	`type` varchar(20) NOT NULL DEFAULT 'text',
	`body` text,
	`chess_game_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cv_jobs` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`video_path` text NOT NULL,
	`frames_processed` int DEFAULT 0,
	`total_frames` int DEFAULT 0,
	`reconstructed_pgn` text,
	`move_timeline` text,
	`error_message` text,
	`fen_timeline_file` text,
	`corners_file` text,
	`last_fen` text,
	`stable_positions` int DEFAULT 0,
	`attempts` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`started_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `cv_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rating_history` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`format` varchar(10) NOT NULL,
	`rating` int NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rating_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_chunks` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`chunk_index` int NOT NULL,
	`file_path` text NOT NULL,
	`size_bytes` int DEFAULT 0,
	`mime_type` varchar(50) DEFAULT 'video/webm',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `move_analyses` ADD `timestamp_ms` int;--> statement-breakpoint
ALTER TABLE `move_analyses` ADD `timestamp_confidence` float;--> statement-breakpoint
ALTER TABLE `move_analyses` ADD `frame_key` text;--> statement-breakpoint
ALTER TABLE `processed_games` ADD `fen_timeline` text;--> statement-breakpoint
ALTER TABLE `processed_games` ADD `is_public` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `processed_games` ADD `share_token` varchar(20);--> statement-breakpoint
ALTER TABLE `processed_games` ADD `white_accuracy` float;--> statement-breakpoint
ALTER TABLE `processed_games` ADD `black_accuracy` float;--> statement-breakpoint
ALTER TABLE `user_tournaments` ADD `custom_slug` varchar(80);--> statement-breakpoint
ALTER TABLE `users` ADD `chesscom_rapid` int;--> statement-breakpoint
ALTER TABLE `users` ADD `chesscom_blitz` int;--> statement-breakpoint
ALTER TABLE `users` ADD `chesscom_bullet` int;--> statement-breakpoint
ALTER TABLE `users` ADD `chesscom_prev_rapid` int;--> statement-breakpoint
ALTER TABLE `users` ADD `chesscom_prev_blitz` int;--> statement-breakpoint
ALTER TABLE `users` ADD `chesscom_prev_bullet` int;--> statement-breakpoint
ALTER TABLE `users` ADD `fide_id` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `is_guest` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `br_code_idx` ON `battle_rooms` (`code`);--> statement-breakpoint
CREATE INDEX `br_host_id_idx` ON `battle_rooms` (`host_id`);--> statement-breakpoint
CREATE INDEX `br_status_idx` ON `battle_rooms` (`status`);--> statement-breakpoint
CREATE INDEX `cb_club_id_idx` ON `club_battles` (`club_id`);--> statement-breakpoint
CREATE INDEX `cb_player_a_idx` ON `club_battles` (`player_a_id`);--> statement-breakpoint
CREATE INDEX `cb_player_b_idx` ON `club_battles` (`player_b_id`);--> statement-breakpoint
CREATE INDEX `cb_club_status_idx` ON `club_battles` (`club_id`,`status`);--> statement-breakpoint
CREATE INDEX `ccg_conversation_id_idx` ON `club_chess_games` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `ccg_white_id_idx` ON `club_chess_games` (`white_id`);--> statement-breakpoint
CREATE INDEX `ccg_black_id_idx` ON `club_chess_games` (`black_id`);--> statement-breakpoint
CREATE INDEX `cc_club_id_idx` ON `club_conversations` (`club_id`);--> statement-breakpoint
CREATE INDEX `cc_user_a_idx` ON `club_conversations` (`user_a_id`);--> statement-breakpoint
CREATE INDEX `cc_user_b_idx` ON `club_conversations` (`user_b_id`);--> statement-breakpoint
CREATE INDEX `ci_club_id_idx` ON `club_invites` (`club_id`);--> statement-breakpoint
CREATE INDEX `ci_token_idx` ON `club_invites` (`token`);--> statement-breakpoint
CREATE INDEX `ci_email_idx` ON `club_invites` (`email`);--> statement-breakpoint
CREATE INDEX `cm_conversation_id_idx` ON `club_messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `cm_sender_id_idx` ON `club_messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX `cj_session_id_idx` ON `cv_jobs` (`session_id`);--> statement-breakpoint
CREATE INDEX `cj_status_idx` ON `cv_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `rh_user_format_idx` ON `rating_history` (`user_id`,`format`);--> statement-breakpoint
CREATE INDEX `vc_session_id_idx` ON `video_chunks` (`session_id`);--> statement-breakpoint
CREATE INDEX `vc_session_chunk_idx` ON `video_chunks` (`session_id`,`chunk_index`);