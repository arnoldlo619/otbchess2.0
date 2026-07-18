ALTER TABLE `users` MODIFY COLUMN `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_google_id_unique` UNIQUE(`google_id`);