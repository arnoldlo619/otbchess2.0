CREATE TABLE `club_album_photo_comments` (
	`id` varchar(64) NOT NULL,
	`photo_id` varchar(64) NOT NULL,
	`album_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`author_user_id` varchar(64) NOT NULL,
	`author_display_name` varchar(100) NOT NULL,
	`author_avatar_url` text,
	`body` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_album_photo_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_album_photo_likes` (
	`id` varchar(64) NOT NULL,
	`photo_id` varchar(64) NOT NULL,
	`album_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_album_photo_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `capl_photo_user_idx` UNIQUE(`photo_id`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX `capc_photo_created_idx` ON `club_album_photo_comments` (`photo_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `capc_club_idx` ON `club_album_photo_comments` (`club_id`);--> statement-breakpoint
CREATE INDEX `capc_author_idx` ON `club_album_photo_comments` (`author_user_id`);--> statement-breakpoint
CREATE INDEX `capl_photo_idx` ON `club_album_photo_likes` (`photo_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `capl_club_idx` ON `club_album_photo_likes` (`club_id`);