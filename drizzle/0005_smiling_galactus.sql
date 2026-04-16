CREATE TABLE `club_event_rsvps` (
	`id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL DEFAULT '',
	`avatar_url` text,
	`status` varchar(20) NOT NULL DEFAULT 'going',
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_event_rsvps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_events` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`start_at` timestamp NOT NULL,
	`end_at` timestamp,
	`venue` varchar(200),
	`address` varchar(300),
	`admission_note` varchar(200),
	`cover_image_url` text,
	`accent_color` varchar(20) NOT NULL DEFAULT '#4CAF50',
	`creator_id` varchar(64) NOT NULL,
	`creator_name` varchar(100) NOT NULL DEFAULT '',
	`is_published` tinyint NOT NULL DEFAULT 1,
	`event_type` varchar(30) NOT NULL DEFAULT 'standard',
	`tournament_id` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_feed` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`type` varchar(40) NOT NULL,
	`actor_name` varchar(100) NOT NULL DEFAULT '',
	`actor_avatar_url` text,
	`detail` text,
	`link_href` varchar(500),
	`link_label` varchar(100),
	`is_pinned` tinyint NOT NULL DEFAULT 0,
	`payload` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_feed_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `director_smtp_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL DEFAULT 587,
	`secure` boolean NOT NULL DEFAULT false,
	`smtp_user` varchar(255) NOT NULL,
	`smtp_pass_encrypted` text NOT NULL,
	`from_name` varchar(100) NOT NULL DEFAULT 'ChessOTB Director',
	`from_email` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `director_smtp_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `director_smtp_config_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `league_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`invited_user_id` varchar(64) NOT NULL,
	`invited_display_name` varchar(100) NOT NULL DEFAULT '',
	`invited_avatar_url` varchar(500),
	`invited_chesscom_username` varchar(50),
	`commissioner_id` varchar(64) NOT NULL,
	`commissioner_name` varchar(100) NOT NULL DEFAULT '',
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`message` varchar(300),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`responded_at` timestamp,
	CONSTRAINT `league_invites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `league_join_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`player_id` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL DEFAULT '',
	`avatar_url` varchar(500),
	`chesscom_username` varchar(50),
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`reviewed_at` timestamp,
	`reviewed_by_user_id` varchar(64),
	CONSTRAINT `league_join_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `league_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`week_id` int NOT NULL,
	`week_number` int NOT NULL,
	`player_white_id` varchar(64) NOT NULL,
	`player_white_name` varchar(100) NOT NULL DEFAULT '',
	`player_black_id` varchar(64) NOT NULL,
	`player_black_name` varchar(100) NOT NULL DEFAULT '',
	`result_status` varchar(20) NOT NULL DEFAULT 'pending',
	`result` varchar(20),
	`reported_by_user_id` varchar(64),
	`white_report` varchar(20),
	`black_report` varchar(20),
	`white_reported_at` timestamp,
	`black_reported_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `league_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `league_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`player_id` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL DEFAULT '',
	`avatar_url` varchar(500),
	`chesscom_username` varchar(50),
	`rating` int,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `league_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `league_push_subscriptions` (
	`id` varchar(36) NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `league_push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `league_standings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`player_id` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL DEFAULT '',
	`avatar_url` varchar(500),
	`wins` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`draws` int NOT NULL DEFAULT 0,
	`points` float NOT NULL DEFAULT 0,
	`rank` int NOT NULL DEFAULT 0,
	`streak` varchar(20) NOT NULL DEFAULT '',
	`movement` varchar(10) NOT NULL DEFAULT 'same',
	`last_results` varchar(100) NOT NULL DEFAULT '',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `league_standings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `league_weeks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`week_number` int NOT NULL,
	`published_at` timestamp,
	`is_complete` tinyint NOT NULL DEFAULT 0,
	`deadline` timestamp,
	CONSTRAINT `league_weeks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`commissioner_id` varchar(64) NOT NULL,
	`commissioner_name` varchar(100) NOT NULL DEFAULT '',
	`format_type` varchar(30) NOT NULL DEFAULT 'round_robin',
	`max_players` int NOT NULL,
	`current_week` int NOT NULL DEFAULT 1,
	`total_weeks` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leagues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `line_nodes` (
	`id` varchar(36) NOT NULL,
	`line_id` varchar(36) NOT NULL,
	`parent_node_id` varchar(36),
	`ply` int NOT NULL,
	`move_san` varchar(20),
	`move_uci` varchar(10),
	`fen` text NOT NULL,
	`is_main_line` tinyint NOT NULL DEFAULT 1,
	`annotation` text,
	`nag` int,
	`eval` int,
	`transposition_node_id` varchar(36),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `line_tag_map` (
	`id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL,
	`line_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_tag_map_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_games` (
	`id` varchar(36) NOT NULL,
	`line_id` varchar(36) NOT NULL,
	`title` varchar(300) NOT NULL,
	`white_player` varchar(100) NOT NULL,
	`black_player` varchar(100) NOT NULL,
	`event` varchar(200),
	`year` int,
	`result` varchar(10) NOT NULL,
	`pgn` text NOT NULL,
	`final_fen` text,
	`total_moves` int,
	`commentary` text,
	`selection_reason` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_published` tinyint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opening_lines` (
	`id` varchar(36) NOT NULL,
	`opening_id` varchar(36) NOT NULL,
	`title` varchar(300) NOT NULL,
	`slug` varchar(300) NOT NULL,
	`eco` varchar(10) NOT NULL,
	`pgn` text NOT NULL,
	`final_fen` text NOT NULL,
	`ply_count` int NOT NULL DEFAULT 0,
	`description` text,
	`difficulty` varchar(20) NOT NULL DEFAULT 'intermediate',
	`commonness` int NOT NULL DEFAULT 50,
	`priority` int NOT NULL DEFAULT 50,
	`is_must_know` tinyint NOT NULL DEFAULT 0,
	`is_trap` tinyint NOT NULL DEFAULT 0,
	`line_type` varchar(20) NOT NULL DEFAULT 'main',
	`color` varchar(10) NOT NULL,
	`strategic_summary` text,
	`hint_text` text,
	`punishment_idea` text,
	`pawn_structure` varchar(100),
	`themes` text,
	`sort_order` int NOT NULL DEFAULT 100,
	`is_published` tinyint NOT NULL DEFAULT 0,
	`author_name` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opening_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opening_tag_map` (
	`id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL,
	`opening_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opening_tag_map_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opening_tags` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`category` varchar(30) NOT NULL DEFAULT 'theme',
	`description` text,
	`sort_order` int NOT NULL DEFAULT 100,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opening_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `opening_tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `openings` (
	`id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`eco` varchar(20) NOT NULL,
	`color` varchar(10) NOT NULL,
	`starting_moves` varchar(200) NOT NULL,
	`starting_fen` text NOT NULL,
	`description` text,
	`summary` varchar(300),
	`difficulty` varchar(20) NOT NULL DEFAULT 'intermediate',
	`popularity` int NOT NULL DEFAULT 50,
	`character` varchar(30) NOT NULL DEFAULT 'universal',
	`themes` text,
	`line_count` int NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 100,
	`is_published` tinyint NOT NULL DEFAULT 0,
	`author_name` varchar(100),
	`cover_image_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `openings_id` PRIMARY KEY(`id`),
	CONSTRAINT `openings_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `prep_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(100) NOT NULL,
	`report_json` text NOT NULL,
	`games_analyzed` int NOT NULL DEFAULT 0,
	`cached_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prep_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `prep_cache_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `repertoire_lines` (
	`id` varchar(36) NOT NULL,
	`repertoire_id` varchar(36) NOT NULL,
	`line_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repertoire_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repertoires` (
	`id` varchar(36) NOT NULL,
	`title` varchar(300) NOT NULL,
	`slug` varchar(300) NOT NULL,
	`description` text,
	`color` varchar(10) NOT NULL,
	`target_level` varchar(20) NOT NULL DEFAULT 'intermediate',
	`author_type` varchar(20) NOT NULL DEFAULT 'staff',
	`author_name` varchar(100),
	`author_user_id` varchar(36),
	`is_published` tinyint NOT NULL DEFAULT 0,
	`is_featured` tinyint NOT NULL DEFAULT 0,
	`line_count` int NOT NULL DEFAULT 0,
	`estimated_minutes` int,
	`cover_image_url` text,
	`sort_order` int NOT NULL DEFAULT 100,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `repertoires_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_prep_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`opponent_username` varchar(100) NOT NULL,
	`opponent_name` varchar(100),
	`win_rate` int,
	`games_analyzed` int,
	`prep_lines_count` int,
	`report_json` text NOT NULL,
	`saved_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_prep_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_analytics` (
	`id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`event_type` varchar(30) NOT NULL,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tournament_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_line_reviews` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`line_id` varchar(36) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'new',
	`interval_days` int NOT NULL DEFAULT 0,
	`ease_factor` int NOT NULL DEFAULT 250,
	`repetitions` int NOT NULL DEFAULT 0,
	`next_review_at` timestamp,
	`last_reviewed_at` timestamp,
	`total_attempts` int NOT NULL DEFAULT 0,
	`correct_attempts` int NOT NULL DEFAULT 0,
	`streak` int NOT NULL DEFAULT 0,
	`best_streak` int NOT NULL DEFAULT 0,
	`last_quality` int,
	`avg_review_seconds` int,
	`review_history` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_line_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clubs` MODIFY COLUMN `avatar_url` text;--> statement-breakpoint
ALTER TABLE `clubs` MODIFY COLUMN `banner_url` text;--> statement-breakpoint
ALTER TABLE `club_members` ADD `league_championships` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_tournaments` ADD `is_public` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_tournaments` ADD `started_at` timestamp;--> statement-breakpoint
CREATE INDEX `idx_cer_event` ON `club_event_rsvps` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_cer_club` ON `club_event_rsvps` (`club_id`);--> statement-breakpoint
CREATE INDEX `idx_cer_user` ON `club_event_rsvps` (`user_id`);--> statement-breakpoint
CREATE INDEX `ce_club_idx` ON `club_events` (`club_id`);--> statement-breakpoint
CREATE INDEX `ce_start_idx` ON `club_events` (`start_at`);--> statement-breakpoint
CREATE INDEX `ce_club_start_idx` ON `club_events` (`club_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `cf_club_idx` ON `club_feed` (`club_id`);--> statement-breakpoint
CREATE INDEX `cf_club_created_idx` ON `club_feed` (`club_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cf_pinned_idx` ON `club_feed` (`club_id`,`is_pinned`);--> statement-breakpoint
CREATE INDEX `linv_league_idx` ON `league_invites` (`league_id`);--> statement-breakpoint
CREATE INDEX `linv_user_idx` ON `league_invites` (`invited_user_id`);--> statement-breakpoint
CREATE INDEX `linv_lu_idx` ON `league_invites` (`league_id`,`invited_user_id`);--> statement-breakpoint
CREATE INDEX `ljr_league_idx` ON `league_join_requests` (`league_id`);--> statement-breakpoint
CREATE INDEX `ljr_lp_idx` ON `league_join_requests` (`league_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `lm_league_idx` ON `league_matches` (`league_id`);--> statement-breakpoint
CREATE INDEX `lm_week_idx` ON `league_matches` (`week_id`);--> statement-breakpoint
CREATE INDEX `lp_league_idx` ON `league_players` (`league_id`);--> statement-breakpoint
CREATE INDEX `lp_lp_idx` ON `league_players` (`league_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `lps_league_idx` ON `league_push_subscriptions` (`league_id`);--> statement-breakpoint
CREATE INDEX `lps_user_idx` ON `league_push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `ls_league_idx` ON `league_standings` (`league_id`);--> statement-breakpoint
CREATE INDEX `ls_lp_idx` ON `league_standings` (`league_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `lw_league_idx` ON `league_weeks` (`league_id`);--> statement-breakpoint
CREATE INDEX `lg_club_idx` ON `leagues` (`club_id`);--> statement-breakpoint
CREATE INDEX `lg_comm_idx` ON `leagues` (`commissioner_id`);--> statement-breakpoint
CREATE INDEX `ln_line_id_idx` ON `line_nodes` (`line_id`);--> statement-breakpoint
CREATE INDEX `ln_parent_node_idx` ON `line_nodes` (`parent_node_id`);--> statement-breakpoint
CREATE INDEX `ln_line_ply_idx` ON `line_nodes` (`line_id`,`ply`);--> statement-breakpoint
CREATE INDEX `ln_transposition_idx` ON `line_nodes` (`transposition_node_id`);--> statement-breakpoint
CREATE INDEX `ltm_tag_id_idx` ON `line_tag_map` (`tag_id`);--> statement-breakpoint
CREATE INDEX `ltm_line_id_idx` ON `line_tag_map` (`line_id`);--> statement-breakpoint
CREATE INDEX `ltm_tag_line_idx` ON `line_tag_map` (`tag_id`,`line_id`);--> statement-breakpoint
CREATE INDEX `mg_line_id_idx` ON `model_games` (`line_id`);--> statement-breakpoint
CREATE INDEX `mg_line_sort_idx` ON `model_games` (`line_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `ol_opening_id_idx` ON `opening_lines` (`opening_id`);--> statement-breakpoint
CREATE INDEX `ol_slug_idx` ON `opening_lines` (`slug`);--> statement-breakpoint
CREATE INDEX `ol_eco_idx` ON `opening_lines` (`eco`);--> statement-breakpoint
CREATE INDEX `ol_color_idx` ON `opening_lines` (`color`);--> statement-breakpoint
CREATE INDEX `ol_priority_idx` ON `opening_lines` (`priority`);--> statement-breakpoint
CREATE INDEX `ol_must_know_idx` ON `opening_lines` (`is_must_know`);--> statement-breakpoint
CREATE INDEX `ol_trap_idx` ON `opening_lines` (`is_trap`);--> statement-breakpoint
CREATE INDEX `ol_published_idx` ON `opening_lines` (`is_published`);--> statement-breakpoint
CREATE INDEX `ol_opening_sort_idx` ON `opening_lines` (`opening_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `otm_tag_id_idx` ON `opening_tag_map` (`tag_id`);--> statement-breakpoint
CREATE INDEX `otm_opening_id_idx` ON `opening_tag_map` (`opening_id`);--> statement-breakpoint
CREATE INDEX `otm_tag_opening_idx` ON `opening_tag_map` (`tag_id`,`opening_id`);--> statement-breakpoint
CREATE INDEX `ot_slug_idx` ON `opening_tags` (`slug`);--> statement-breakpoint
CREATE INDEX `ot_category_idx` ON `opening_tags` (`category`);--> statement-breakpoint
CREATE INDEX `op_slug_idx` ON `openings` (`slug`);--> statement-breakpoint
CREATE INDEX `op_eco_idx` ON `openings` (`eco`);--> statement-breakpoint
CREATE INDEX `op_color_idx` ON `openings` (`color`);--> statement-breakpoint
CREATE INDEX `op_published_idx` ON `openings` (`is_published`);--> statement-breakpoint
CREATE INDEX `op_sort_idx` ON `openings` (`sort_order`);--> statement-breakpoint
CREATE INDEX `pc_username_idx` ON `prep_cache` (`username`);--> statement-breakpoint
CREATE INDEX `pc_cached_at_idx` ON `prep_cache` (`cached_at`);--> statement-breakpoint
CREATE INDEX `rl_repertoire_id_idx` ON `repertoire_lines` (`repertoire_id`);--> statement-breakpoint
CREATE INDEX `rl_line_id_idx` ON `repertoire_lines` (`line_id`);--> statement-breakpoint
CREATE INDEX `rl_rep_sort_idx` ON `repertoire_lines` (`repertoire_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `rep_slug_idx` ON `repertoires` (`slug`);--> statement-breakpoint
CREATE INDEX `rep_color_idx` ON `repertoires` (`color`);--> statement-breakpoint
CREATE INDEX `rep_author_type_idx` ON `repertoires` (`author_type`);--> statement-breakpoint
CREATE INDEX `rep_author_user_idx` ON `repertoires` (`author_user_id`);--> statement-breakpoint
CREATE INDEX `rep_published_idx` ON `repertoires` (`is_published`);--> statement-breakpoint
CREATE INDEX `rep_featured_idx` ON `repertoires` (`is_featured`);--> statement-breakpoint
CREATE INDEX `spr_user_id_idx` ON `saved_prep_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `spr_user_opponent_idx` ON `saved_prep_reports` (`user_id`,`opponent_username`);--> statement-breakpoint
CREATE INDEX `ta_tournament_id_idx` ON `tournament_analytics` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `ta_event_type_idx` ON `tournament_analytics` (`event_type`);--> statement-breakpoint
CREATE INDEX `ta_tid_event_idx` ON `tournament_analytics` (`tournament_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `ulr_user_id_idx` ON `user_line_reviews` (`user_id`);--> statement-breakpoint
CREATE INDEX `ulr_line_id_idx` ON `user_line_reviews` (`line_id`);--> statement-breakpoint
CREATE INDEX `ulr_user_line_idx` ON `user_line_reviews` (`user_id`,`line_id`);--> statement-breakpoint
CREATE INDEX `ulr_user_status_idx` ON `user_line_reviews` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `ulr_next_review_idx` ON `user_line_reviews` (`user_id`,`next_review_at`);