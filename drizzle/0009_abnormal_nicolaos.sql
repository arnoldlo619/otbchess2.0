CREATE TABLE `bracket_groups` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`venue` varchar(255),
	`date` varchar(20),
	`brackets_json` text NOT NULL,
	`rating_platform` varchar(20) NOT NULL DEFAULT 'chess.com',
	`rating_type` varchar(20) NOT NULL DEFAULT 'rapid',
	`format` varchar(50),
	`rounds` int,
	`time_base` int,
	`time_increment` int,
	`parent_tournament_id` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`club_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bracket_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_announcements` (
	`id` varchar(36) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`visibility` varchar(20) NOT NULL DEFAULT 'public',
	`pinned` tinyint NOT NULL DEFAULT 0,
	`related_event_id` varchar(64),
	`related_tournament_id` varchar(100),
	`created_by` varchar(36) NOT NULL,
	`created_by_name` varchar(120) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_season_standings` (
	`id` varchar(36) NOT NULL,
	`season_id` varchar(36) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`avatar_url` varchar(500),
	`points` int NOT NULL DEFAULT 0,
	`events_attended` int NOT NULL DEFAULT 0,
	`tournaments_played` int NOT NULL DEFAULT 0,
	`wins` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`draws` int NOT NULL DEFAULT 0,
	`rank` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_season_standings_id` PRIMARY KEY(`id`),
	CONSTRAINT `css_unique` UNIQUE(`season_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `club_seasons` (
	`id` varchar(36) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`start_date` varchar(20) NOT NULL,
	`end_date` varchar(20),
	`scoring_method` varchar(30) NOT NULL DEFAULT 'hybrid',
	`visibility` varchar(20) NOT NULL DEFAULT 'public',
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_seasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_recaps` (
	`id` varchar(36) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`event_id` varchar(64) NOT NULL,
	`generated_caption` text,
	`generated_summary` text,
	`attendance_count` int NOT NULL DEFAULT 0,
	`first_time_count` int NOT NULL DEFAULT 0,
	`returning_count` int NOT NULL DEFAULT 0,
	`next_event_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_recaps_id` PRIMARY KEY(`id`),
	CONSTRAINT `er_event_idx` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `member_engagement` (
	`id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`events_attended_count` int NOT NULL DEFAULT 0,
	`tournaments_played_count` int NOT NULL DEFAULT 0,
	`last_attended_at` timestamp,
	`current_streak` int NOT NULL DEFAULT 0,
	`longest_streak` int NOT NULL DEFAULT 0,
	`badges_json` text,
	`referral_source` varchar(50),
	`referred_by_user_id` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `member_engagement_id` PRIMARY KEY(`id`),
	CONSTRAINT `me_unique` UNIQUE(`member_id`,`club_id`)
);
--> statement-breakpoint
CREATE TABLE `player_achievements` (
	`id` varchar(36) NOT NULL,
	`player_id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`section_id` varchar(64),
	`achievement_type` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`tournament_name` varchar(255),
	`earned_at` timestamp NOT NULL DEFAULT (now()),
	`visibility` varchar(20) NOT NULL DEFAULT 'public',
	CONSTRAINT `player_achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quad_prizes` (
	`id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`section_id` varchar(64),
	`placement` int NOT NULL DEFAULT 1,
	`prize_title` varchar(255) NOT NULL,
	`prize_type` varchar(50) NOT NULL DEFAULT 'cash',
	`prize_value` varchar(100),
	`sponsor_name` varchar(255),
	`sponsor_logo_url` text,
	`assigned_player_id` varchar(36),
	`assigned_player_name` varchar(255),
	`status` varchar(30) NOT NULL DEFAULT 'pending',
	`template_type` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quad_prizes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_assets` (
	`id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`asset_type` varchar(50) NOT NULL,
	`format` varchar(30) NOT NULL DEFAULT 'square',
	`generated_image_url` text,
	`data_json` json,
	`created_by_host_id` varchar(36),
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_recaps` (
	`id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`hero_image_url` text,
	`summary_text` text,
	`tournament_name` varchar(255),
	`venue` varchar(255),
	`event_date` varchar(50),
	`host_name` varchar(255),
	`club_id` varchar(64),
	`format` varchar(50),
	`player_count` int,
	`section_count` int,
	`time_control` varchar(100),
	`champions_json` json,
	`sections_json` json,
	`highlights_json` json,
	`sponsor_note` text,
	`venue_note` text,
	`custom_note` text,
	`privacy_mode` varchar(30) NOT NULL DEFAULT 'standard',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tournament_recaps_id` PRIMARY KEY(`id`),
	CONSTRAINT `tr_tournament_idx` UNIQUE(`tournament_id`),
	CONSTRAINT `tr_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `club_events` ADD `capacity` int;--> statement-breakpoint
ALTER TABLE `club_events` ADD `rsvp_required` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `club_events` ADD `waitlist_enabled` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `club_events` ADD `entry_fee` varchar(50);--> statement-breakpoint
ALTER TABLE `club_events` ADD `event_status` varchar(20) DEFAULT 'upcoming' NOT NULL;--> statement-breakpoint
ALTER TABLE `club_events` ADD `recurrence` varchar(20) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `club_events` ADD `recurrence_series_id` varchar(64);--> statement-breakpoint
ALTER TABLE `club_events` ADD `recurrence_end_date` varchar(30);--> statement-breakpoint
ALTER TABLE `clubs` ADD `background_image` text;--> statement-breakpoint
ALTER TABLE `clubs` ADD `instagram` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `tiktok` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `youtube` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `linktree` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `contact_email` varchar(200);--> statement-breakpoint
ALTER TABLE `clubs` ADD `contact_phone` varchar(50);--> statement-breakpoint
ALTER TABLE `clubs` ADD `meeting_schedule` varchar(20) DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `meeting_day` varchar(20);--> statement-breakpoint
ALTER TABLE `clubs` ADD `meeting_time` varchar(10);--> statement-breakpoint
ALTER TABLE `clubs` ADD `meeting_notes` text;--> statement-breakpoint
ALTER TABLE `clubs` ADD `join_policy` varchar(20) DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `intake_questions` text;--> statement-breakpoint
ALTER TABLE `clubs` ADD `status` varchar(20) DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `facebook` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `x_url` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `meetup_url` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `whatsapp` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `groupme` varchar(300);--> statement-breakpoint
ALTER TABLE `clubs` ADD `beginner_friendly` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `is_verified` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `is_claimed` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `clubs` ADD `region` varchar(100);--> statement-breakpoint
ALTER TABLE `clubs` ADD `venue_name` varchar(200);--> statement-breakpoint
ALTER TABLE `clubs` ADD `event_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `games_played` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `new_members_this_month` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubs` ADD `active_since` timestamp;--> statement-breakpoint
ALTER TABLE `clubs` ADD `what_to_expect` text;--> statement-breakpoint
ALTER TABLE `clubs` ADD `featured_event_id` varchar(64);--> statement-breakpoint
ALTER TABLE `clubs` ADD `featured_tournament_id` varchar(64);--> statement-breakpoint
ALTER TABLE `user_tournaments` ADD `parent_bracket_group_id` varchar(36);--> statement-breakpoint
ALTER TABLE `user_tournaments` ADD `bracket_label` varchar(100);--> statement-breakpoint
ALTER TABLE `user_tournaments` ADD `bracket_order` int;--> statement-breakpoint
CREATE INDEX `bg_user_id_idx` ON `bracket_groups` (`user_id`);--> statement-breakpoint
CREATE INDEX `bg_parent_tournament_idx` ON `bracket_groups` (`parent_tournament_id`);--> statement-breakpoint
CREATE INDEX `ca_club_idx` ON `club_announcements` (`club_id`);--> statement-breakpoint
CREATE INDEX `ca_pinned_idx` ON `club_announcements` (`club_id`,`pinned`);--> statement-breakpoint
CREATE INDEX `css_season_idx` ON `club_season_standings` (`season_id`);--> statement-breakpoint
CREATE INDEX `css_club_idx` ON `club_season_standings` (`club_id`);--> statement-breakpoint
CREATE INDEX `cs_club_idx` ON `club_seasons` (`club_id`);--> statement-breakpoint
CREATE INDEX `cs_status_idx` ON `club_seasons` (`club_id`,`status`);--> statement-breakpoint
CREATE INDEX `er_club_idx` ON `event_recaps` (`club_id`);--> statement-breakpoint
CREATE INDEX `me_club_idx` ON `member_engagement` (`club_id`);--> statement-breakpoint
CREATE INDEX `pa_player_idx` ON `player_achievements` (`player_id`);--> statement-breakpoint
CREATE INDEX `pa_tournament_idx` ON `player_achievements` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `pa_type_idx` ON `player_achievements` (`achievement_type`);--> statement-breakpoint
CREATE INDEX `qp_tournament_idx` ON `quad_prizes` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `qp_player_idx` ON `quad_prizes` (`assigned_player_id`);--> statement-breakpoint
CREATE INDEX `sa_tournament_idx` ON `social_assets` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `sa_type_idx` ON `social_assets` (`asset_type`);--> statement-breakpoint
CREATE INDEX `tr_club_idx` ON `tournament_recaps` (`club_id`);--> statement-breakpoint
CREATE INDEX `ce_series_idx` ON `club_events` (`recurrence_series_id`);