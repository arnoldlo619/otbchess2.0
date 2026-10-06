UPDATE `club_events` SET `event_type` = 'casual' WHERE `event_type` IN ('speed_dating', 'trivia', 'trivia_night');--> statement-breakpoint
DROP TABLE `club_speed_dating_pairings`;--> statement-breakpoint
DROP TABLE `club_speed_dating_participants`;--> statement-breakpoint
DROP TABLE `club_speed_dating_sessions`;--> statement-breakpoint
DROP TABLE `club_trivia_questions`;--> statement-breakpoint
DROP TABLE `club_trivia_responses`;--> statement-breakpoint
DROP TABLE `club_trivia_sessions`;--> statement-breakpoint
DROP TABLE `club_trivia_team_members`;--> statement-breakpoint
DROP TABLE `club_trivia_teams`;--> statement-breakpoint
ALTER TABLE `club_events` DROP COLUMN `speed_dating_rounds`;--> statement-breakpoint
ALTER TABLE `club_events` DROP COLUMN `speed_dating_minutes`;--> statement-breakpoint
ALTER TABLE `club_events` DROP COLUMN `trivia_question_count`;--> statement-breakpoint
ALTER TABLE `club_events` DROP COLUMN `trivia_categories`;
