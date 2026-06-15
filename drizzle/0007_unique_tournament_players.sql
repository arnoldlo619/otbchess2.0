DELETE tp1 FROM `tournament_players` tp1
INNER JOIN `tournament_players` tp2
  ON tp1.`tournament_id` = tp2.`tournament_id`
  AND tp1.`username` = tp2.`username`
  AND (
    tp1.`joined_at` > tp2.`joined_at`
    OR (tp1.`joined_at` = tp2.`joined_at` AND tp1.`id` > tp2.`id`)
  );--> statement-breakpoint
ALTER TABLE `tournament_players` ADD CONSTRAINT `tp_unique_tournament_username` UNIQUE(`tournament_id`,`username`);--> statement-breakpoint
