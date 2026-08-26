CREATE TABLE `club_album_photos` (
	`id` varchar(64) NOT NULL,
	`album_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`storage_key` text NOT NULL,
	`url` text NOT NULL,
	`caption` varchar(500),
	`alt_text` varchar(300),
	`width` int,
	`height` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by_id` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_album_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_albums` (
	`id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` text,
	`event_date` varchar(10),
	`created_by_id` varchar(64) NOT NULL,
	`created_by_name` varchar(100) NOT NULL DEFAULT '',
	`is_published` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_albums_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cap_album_sort_idx` ON `club_album_photos` (`album_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `cap_club_idx` ON `club_album_photos` (`club_id`);--> statement-breakpoint
CREATE INDEX `ca_club_created_idx` ON `club_albums` (`club_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ca_club_published_idx` ON `club_albums` (`club_id`,`is_published`);