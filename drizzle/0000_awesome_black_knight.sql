CREATE TABLE `push_subscriptions` (
	`id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_players` (
	`id` varchar(36) NOT NULL,
	`tournament_id` varchar(255) NOT NULL,
	`username` varchar(100) NOT NULL,
	`player_json` text NOT NULL,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tournament_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tournament_id_idx` ON `push_subscriptions` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `tp_tournament_id_idx` ON `tournament_players` (`tournament_id`);