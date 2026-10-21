ALTER TABLE `clubs` ADD `join_code` varchar(8);
--> statement-breakpoint
CREATE UNIQUE INDEX `clubs_join_code_unique` ON `clubs` (`join_code`);
