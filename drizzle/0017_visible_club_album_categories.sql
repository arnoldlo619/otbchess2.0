INSERT INTO `club_albums` (`id`, `club_id`, `title`, `description`, `cover_image_url`, `created_by_id`, `created_by_name`, `is_published`, `created_at`, `updated_at`)
SELECT
  CONCAT('club-tournaments-', REPLACE(UUID(), '-', '')),
  `c`.`id`,
  'Chess Tournaments',
  'Tournament moments and results from the club.',
  '/manus-storage/chess-tournaments_23c8b088.jpg',
  `c`.`owner_id`,
  COALESCE(`c`.`owner_name`, ''),
  1,
  NOW(),
  NOW()
FROM `clubs` AS `c`
WHERE NOT EXISTS (
  SELECT 1 FROM `club_albums` AS `a`
  WHERE `a`.`club_id` = `c`.`id` AND `a`.`title` = 'Chess Tournaments'
)
UNION ALL
SELECT
  CONCAT('club-leagues-', REPLACE(UUID(), '-', '')),
  `c`.`id`,
  'Chess Leagues',
  'League nights, standings, and club competition.',
  '/manus-storage/chess-leagues_770bca1d.jpg',
  `c`.`owner_id`,
  COALESCE(`c`.`owner_name`, ''),
  1,
  NOW(),
  NOW()
FROM `clubs` AS `c`
WHERE NOT EXISTS (
  SELECT 1 FROM `club_albums` AS `a`
  WHERE `a`.`club_id` = `c`.`id` AND `a`.`title` = 'Chess Leagues'
)
UNION ALL
SELECT
  CONCAT('club-meetups-', REPLACE(UUID(), '-', '')),
  `c`.`id`,
  'Chess Club Meetups',
  'Casual over-the-board meetups and community moments.',
  '/manus-storage/chess-club-meetups_c17d81ae.jpg',
  `c`.`owner_id`,
  COALESCE(`c`.`owner_name`, ''),
  1,
  NOW(),
  NOW()
FROM `clubs` AS `c`
WHERE NOT EXISTS (
  SELECT 1 FROM `club_albums` AS `a`
  WHERE `a`.`club_id` = `c`.`id` AND `a`.`title` = 'Chess Club Meetups'
);
