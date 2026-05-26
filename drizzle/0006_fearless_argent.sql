CREATE TABLE `chess_player_cache` (
	`username` varchar(100) NOT NULL,
	`profile_json` text NOT NULL,
	`stats_json` text NOT NULL,
	`cached_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chess_player_cache_username` PRIMARY KEY(`username`)
);
--> statement-breakpoint
CREATE TABLE `game_result_submissions` (
	`id` varchar(36) NOT NULL,
	`game_session_id` varchar(36) NOT NULL,
	`submitted_by_user_id` varchar(36) NOT NULL,
	`submitted_result` varchar(20) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_result_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `grs_game_user_idx` UNIQUE(`game_session_id`,`submitted_by_user_id`)
);
--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` varchar(36) NOT NULL,
	`host_user_id` varchar(36) NOT NULL,
	`opponent_user_id` varchar(36),
	`host_display_name` varchar(100) NOT NULL,
	`opponent_display_name` varchar(100),
	`host_chesscom_username` varchar(100),
	`opponent_chesscom_username` varchar(100),
	`time_control_category` varchar(20) NOT NULL,
	`base_minutes` int NOT NULL,
	`increment_seconds` int NOT NULL DEFAULT 0,
	`status` varchar(30) NOT NULL DEFAULT 'pending_opponent',
	`qr_token` varchar(64) NOT NULL,
	`qr_expires_at` timestamp NOT NULL,
	`is_rated` boolean NOT NULL DEFAULT true,
	`rating_processed` boolean NOT NULL DEFAULT false,
	`active_clock_device_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `gs_qr_token_idx` UNIQUE(`qr_token`)
);
--> statement-breakpoint
CREATE TABLE `live_bridge_sessions` (
	`id` varchar(36) NOT NULL,
	`broadcast_id` varchar(36) NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'waiting',
	`device_name` varchar(100),
	`connection_type` varchar(30),
	`bridge_version` varchar(20),
	`last_seen_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_bridge_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_broadcasts` (
	`id` varchar(36) NOT NULL,
	`tournament_id` varchar(36) NOT NULL,
	`round_number` int NOT NULL DEFAULT 1,
	`board_number` int NOT NULL DEFAULT 1,
	`pairing_id` varchar(36),
	`white_player_name` varchar(120) NOT NULL DEFAULT 'White',
	`black_player_name` varchar(120) NOT NULL DEFAULT 'Black',
	`white_player_elo` int,
	`black_player_elo` int,
	`white_avatar_url` varchar(500),
	`black_avatar_url` varchar(500),
	`status` varchar(20) NOT NULL DEFAULT 'ready',
	`input_source` varchar(30) NOT NULL DEFAULT 'manual',
	`current_fen` text NOT NULL DEFAULT ('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
	`pgn` mediumtext NOT NULL DEFAULT '',
	`last_move_san` varchar(10),
	`last_move_uci` varchar(10),
	`move_number` int NOT NULL DEFAULT 0,
	`side_to_move` varchar(1) NOT NULL DEFAULT 'w',
	`result` varchar(10),
	`display_mode` varchar(20) NOT NULL DEFAULT 'standard',
	`display_settings` json,
	`tournament_name` varchar(200),
	`bridge_token` varchar(64),
	`bridge_token_hash` varchar(64),
	`bridge_token_revoked` tinyint NOT NULL DEFAULT 0,
	`bridge_status` varchar(30) NOT NULL DEFAULT 'not_configured',
	`bridge_device_name` varchar(100),
	`bridge_connection_type` varchar(30),
	`bridge_last_seen_at` timestamp,
	`bridge_error_message` text,
	`public_slug` varchar(20) NOT NULL,
	`white_time_ms` int,
	`black_time_ms` int,
	`clock_running` tinyint NOT NULL DEFAULT 0,
	`clock_last_updated_at` timestamp,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_broadcasts_id` PRIMARY KEY(`id`),
	CONSTRAINT `lb_public_slug_idx` UNIQUE(`public_slug`)
);
--> statement-breakpoint
CREATE TABLE `live_moves` (
	`id` varchar(36) NOT NULL,
	`broadcast_id` varchar(36) NOT NULL,
	`ply` int NOT NULL,
	`san` varchar(10) NOT NULL,
	`uci` varchar(10) NOT NULL,
	`fen_before` text NOT NULL,
	`fen_after` text NOT NULL,
	`source` varchar(30) NOT NULL DEFAULT 'manual',
	`correction_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_moves_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetup_checkins` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`club_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`avatar_url` varchar(500),
	`chesscom_username` varchar(100),
	`checked_in_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meetup_checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `mc_unique_checkin` UNIQUE(`event_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `otb_rating_history` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`game_session_id` varchar(36) NOT NULL,
	`rating_category` varchar(20) NOT NULL,
	`rating_before` int NOT NULL,
	`rating_after` int NOT NULL,
	`rating_change` int NOT NULL,
	`opponent_user_id` varchar(36) NOT NULL,
	`opponent_rating_before` int NOT NULL,
	`result` varchar(10) NOT NULL,
	`k_factor` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otb_rating_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_ratings` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`category` varchar(20) NOT NULL,
	`rating` int NOT NULL DEFAULT 1000,
	`status` varchar(20) NOT NULL DEFAULT 'unrated',
	`games_played` int NOT NULL DEFAULT 0,
	`wins` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`draws` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `player_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `pr_user_category_idx` UNIQUE(`user_id`,`category`)
);
--> statement-breakpoint
CREATE TABLE `rated_games` (
	`id` varchar(36) NOT NULL,
	`game_session_id` varchar(36) NOT NULL,
	`host_user_id` varchar(36) NOT NULL,
	`opponent_user_id` varchar(36) NOT NULL,
	`winner_user_id` varchar(36),
	`result` varchar(20) NOT NULL,
	`rating_category` varchar(20) NOT NULL,
	`host_rating_before` int NOT NULL,
	`host_rating_after` int NOT NULL,
	`opponent_rating_before` int NOT NULL,
	`opponent_rating_after` int NOT NULL,
	`host_rating_change` int NOT NULL,
	`opponent_rating_change` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rated_games_id` PRIMARY KEY(`id`),
	CONSTRAINT `rg_game_session_idx` UNIQUE(`game_session_id`)
);
--> statement-breakpoint
CREATE TABLE `user_favorite_lines` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`line_id` varchar(36) NOT NULL,
	`opening_id` varchar(36) NOT NULL,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_favorite_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP INDEX `ltm_tag_line_idx` ON `line_tag_map`;--> statement-breakpoint
DROP INDEX `otm_tag_opening_idx` ON `opening_tag_map`;--> statement-breakpoint
ALTER TABLE `openings` ADD `play_character` varchar(30) DEFAULT 'universal' NOT NULL;--> statement-breakpoint
ALTER TABLE `openings` ADD `is_featured` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `openings` ADD `starter_friendly` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `openings` ADD `estimated_line_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `openings` ADD `trap_potential` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `openings` ADD `strategic_complexity` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `prep_cache` ADD `engine_version` varchar(20) DEFAULT '1.0.0';--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `chess_username` varchar(255);--> statement-breakpoint
ALTER TABLE `repertoires` ADD `move_tree` mediumtext;--> statement-breakpoint
ALTER TABLE `users` ADD `is_pro` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `pro_expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `is_staff` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` varchar(255);--> statement-breakpoint
ALTER TABLE `line_tag_map` ADD CONSTRAINT `ltm_unique_line_tag` UNIQUE(`line_id`,`tag_id`);--> statement-breakpoint
ALTER TABLE `opening_tag_map` ADD CONSTRAINT `otm_unique_opening_tag` UNIQUE(`opening_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `grs_game_idx` ON `game_result_submissions` (`game_session_id`);--> statement-breakpoint
CREATE INDEX `gs_host_idx` ON `game_sessions` (`host_user_id`);--> statement-breakpoint
CREATE INDEX `gs_opponent_idx` ON `game_sessions` (`opponent_user_id`);--> statement-breakpoint
CREATE INDEX `gs_status_idx` ON `game_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `lbs_broadcast_idx` ON `live_bridge_sessions` (`broadcast_id`);--> statement-breakpoint
CREATE INDEX `lb_tournament_id_idx` ON `live_broadcasts` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `lm_broadcast_id_idx` ON `live_moves` (`broadcast_id`);--> statement-breakpoint
CREATE INDEX `lm_ply_idx` ON `live_moves` (`broadcast_id`,`ply`);--> statement-breakpoint
CREATE INDEX `mc_event_id_idx` ON `meetup_checkins` (`event_id`);--> statement-breakpoint
CREATE INDEX `mc_club_id_idx` ON `meetup_checkins` (`club_id`);--> statement-breakpoint
CREATE INDEX `mc_user_id_idx` ON `meetup_checkins` (`user_id`);--> statement-breakpoint
CREATE INDEX `orh_user_category_idx` ON `otb_rating_history` (`user_id`,`rating_category`);--> statement-breakpoint
CREATE INDEX `orh_game_idx` ON `otb_rating_history` (`game_session_id`);--> statement-breakpoint
CREATE INDEX `pr_category_status_idx` ON `player_ratings` (`category`,`status`);--> statement-breakpoint
CREATE INDEX `pr_category_rating_idx` ON `player_ratings` (`category`,`rating`);--> statement-breakpoint
CREATE INDEX `rg_host_idx` ON `rated_games` (`host_user_id`);--> statement-breakpoint
CREATE INDEX `rg_opponent_idx` ON `rated_games` (`opponent_user_id`);--> statement-breakpoint
CREATE INDEX `rg_category_idx` ON `rated_games` (`rating_category`);--> statement-breakpoint
CREATE INDEX `ufl_user_id_idx` ON `user_favorite_lines` (`user_id`);--> statement-breakpoint
CREATE INDEX `ufl_line_id_idx` ON `user_favorite_lines` (`line_id`);--> statement-breakpoint
CREATE INDEX `ufl_user_line_uniq` ON `user_favorite_lines` (`user_id`,`line_id`);--> statement-breakpoint
CREATE INDEX `ufl_user_opening_idx` ON `user_favorite_lines` (`user_id`,`opening_id`);--> statement-breakpoint
CREATE INDEX `op_featured_idx` ON `openings` (`is_featured`);--> statement-breakpoint
ALTER TABLE `openings` DROP COLUMN `character`;