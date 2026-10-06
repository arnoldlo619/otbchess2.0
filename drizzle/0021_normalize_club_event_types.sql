ALTER TABLE `club_events` MODIFY COLUMN `event_type` varchar(30) NOT NULL DEFAULT 'casual';--> statement-breakpoint
UPDATE `club_events`
SET `event_type` = CASE
  WHEN `tournament_id` IS NOT NULL AND `tournament_id` <> '' THEN 'tournament'
  WHEN `event_type` IN ('standard', 'meetup') THEN 'casual'
  WHEN `event_type` = 'trivia_night' THEN 'trivia'
  ELSE `event_type`
END
WHERE `event_type` IN ('standard', 'meetup', 'trivia_night')
   OR (`tournament_id` IS NOT NULL AND `tournament_id` <> '');
