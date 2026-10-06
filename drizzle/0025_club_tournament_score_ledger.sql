CREATE TABLE `club_tournament_score_entries` (
	`id` varchar(36) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`member_user_id` varchar(64) NOT NULL,
	`chesscom_username` varchar(100) NOT NULL,
	`player_name` varchar(100) NOT NULL DEFAULT '',
	`avatar_url` varchar(500),
	`points` varchar(24) NOT NULL DEFAULT '0',
	`wins` int NOT NULL DEFAULT 0,
	`draws` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`final_rank` int,
	`finalized_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_tournament_score_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `ctse_club_tournament_member_uniq` UNIQUE(`club_id`,`tournament_id`,`member_user_id`)
);
--> statement-breakpoint
CREATE INDEX `ctse_club_points_idx` ON `club_tournament_score_entries` (`club_id`,`points`);--> statement-breakpoint
CREATE INDEX `ctse_tournament_idx` ON `club_tournament_score_entries` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `ctse_member_idx` ON `club_tournament_score_entries` (`member_user_id`);