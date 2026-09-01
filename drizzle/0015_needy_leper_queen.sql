CREATE TABLE `club_feed_attachments` (
	`id` varchar(64) NOT NULL,
	`feed_id` varchar(64) NOT NULL,
	`club_id` varchar(64) NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` varchar(180) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`byte_size` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_feed_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `club_feed` ADD `created_by` varchar(64);--> statement-breakpoint
CREATE INDEX `cfa_feed_sort_idx` ON `club_feed_attachments` (`feed_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `cfa_club_idx` ON `club_feed_attachments` (`club_id`);