CREATE TABLE `club_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL DEFAULT '',
	`chesscom_username` varchar(50),
	`lichess_username` varchar(50),
	`avatar_url` varchar(500),
	`role` varchar(20) NOT NULL DEFAULT 'member',
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	`tournaments_played` int NOT NULL DEFAULT 0,
	`best_finish` int,
	CONSTRAINT `club_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`tagline` varchar(200) NOT NULL DEFAULT '',
	`description` text NOT NULL DEFAULT (''),
	`location` varchar(100) NOT NULL DEFAULT '',
	`country` varchar(4) NOT NULL DEFAULT '',
	`category` varchar(30) NOT NULL DEFAULT 'club',
	`avatar_url` varchar(500),
	`banner_url` varchar(500),
	`accent_color` varchar(20) NOT NULL DEFAULT '#4CAF50',
	`owner_id` varchar(64) NOT NULL,
	`owner_name` varchar(100) NOT NULL DEFAULT '',
	`member_count` int NOT NULL DEFAULT 1,
	`tournament_count` int NOT NULL DEFAULT 0,
	`follower_count` int NOT NULL DEFAULT 0,
	`is_public` tinyint NOT NULL DEFAULT 1,
	`website` varchar(300),
	`twitter` varchar(100),
	`discord` varchar(300),
	`announcement` text,
	`founded_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clubs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cm_club_idx` ON `club_members` (`club_id`);--> statement-breakpoint
CREATE INDEX `cm_user_idx` ON `club_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `cm_club_user_idx` ON `club_members` (`club_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `clubs_slug_idx` ON `clubs` (`slug`);--> statement-breakpoint
CREATE INDEX `clubs_owner_idx` ON `clubs` (`owner_id`);--> statement-breakpoint
CREATE INDEX `clubs_public_idx` ON `clubs` (`is_public`);