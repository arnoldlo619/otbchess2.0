CREATE TABLE `league_encounters` (
	`id` varchar(64) NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`week_id` int NOT NULL,
	`week_number` int NOT NULL,
	`pair_key` varchar(150) NOT NULL,
	`player_a_id` varchar(64) NOT NULL,
	`player_b_id` varchar(64) NOT NULL,
	`player_a_name` varchar(100) NOT NULL DEFAULT '',
	`player_b_name` varchar(100) NOT NULL DEFAULT '',
	`status` varchar(20) NOT NULL DEFAULT 'generated',
	`player_a_game_points` float NOT NULL DEFAULT 0,
	`player_b_game_points` float NOT NULL DEFAULT 0,
	`player_a_season_points` float NOT NULL DEFAULT 0,
	`player_b_season_points` float NOT NULL DEFAULT 0,
	`player_a_rating_delta` int NOT NULL DEFAULT 0,
	`player_b_rating_delta` int NOT NULL DEFAULT 0,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `league_encounters_id` PRIMARY KEY(`id`),
	CONSTRAINT `le_unique_pair_idx` UNIQUE(`league_id`,`pair_key`)
);
--> statement-breakpoint
CREATE TABLE `league_playoff_games` (
	`id` varchar(64) NOT NULL,
	`playoff_match_id` varchar(64) NOT NULL,
	`game_number` int NOT NULL,
	`phase` varchar(20) NOT NULL DEFAULT 'rapid',
	`player_white_id` varchar(64) NOT NULL,
	`player_black_id` varchar(64) NOT NULL,
	`result_status` varchar(20) NOT NULL DEFAULT 'pending',
	`result` varchar(20),
	`reported_by_user_id` varchar(64),
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `league_playoff_games_id` PRIMARY KEY(`id`),
	CONSTRAINT `lpg_match_game_idx` UNIQUE(`playoff_match_id`,`phase`,`game_number`)
);
--> statement-breakpoint
CREATE TABLE `league_playoff_matches` (
	`id` varchar(64) NOT NULL,
	`league_id` varchar(64) NOT NULL,
	`bracket_key` varchar(30) NOT NULL,
	`round_number` int NOT NULL,
	`round_label` varchar(40) NOT NULL,
	`match_number` int NOT NULL,
	`player_a_id` varchar(64),
	`player_b_id` varchar(64),
	`player_a_seed` int,
	`player_b_seed` int,
	`player_a_source` varchar(80) NOT NULL,
	`player_b_source` varchar(80) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`winner_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `league_playoff_matches_id` PRIMARY KEY(`id`),
	CONSTRAINT `lpm_bracket_idx` UNIQUE(`league_id`,`bracket_key`)
);
--> statement-breakpoint
ALTER TABLE `league_matches` ADD `encounter_id` varchar(64), ADD `game_number` int DEFAULT 1 NOT NULL, ADD `game_kind` varchar(30) DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE `league_players` ADD `league_rating` int DEFAULT 1200 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_players` ADD `original_seed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `previous_rank` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `season_points` float DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `game_points` float DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `encounter_wins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `encounter_draws` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `encounter_losses` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `games_played` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `encounters_played` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `sonneborn_berger` float DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `league_rating` int DEFAULT 1200 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_standings` ADD `rating_change` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_weeks` ADD `state` varchar(20) DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE `leagues` ADD `season_phase` varchar(30) DEFAULT 'registration' NOT NULL;--> statement-breakpoint
ALTER TABLE `leagues` ADD `opponents_per_week` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `leagues` ADD `games_per_encounter` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `leagues` ADD `playoff_qualifier_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leagues` ADD `time_control_base` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `leagues` ADD `time_control_increment` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leagues` ADD `roster_locked_at` timestamp;--> statement-breakpoint
ALTER TABLE `leagues` ADD `regular_season_champion_id` varchar(64);--> statement-breakpoint
ALTER TABLE `leagues` ADD `league_champion_id` varchar(64);--> statement-breakpoint
CREATE INDEX `le_league_idx` ON `league_encounters` (`league_id`);--> statement-breakpoint
CREATE INDEX `le_week_idx` ON `league_encounters` (`week_id`);--> statement-breakpoint
CREATE INDEX `lpg_match_idx` ON `league_playoff_games` (`playoff_match_id`);--> statement-breakpoint
CREATE INDEX `lpm_league_idx` ON `league_playoff_matches` (`league_id`);--> statement-breakpoint
CREATE INDEX `lm_encounter_idx` ON `league_matches` (`encounter_id`,`game_number`);
