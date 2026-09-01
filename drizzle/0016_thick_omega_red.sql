ALTER TABLE `club_albums` ADD `cover_image_url` text;

INSERT INTO `club_albums` (`id`, `club_id`, `title`, `description`, `cover_image_url`, `created_by_id`, `created_by_name`, `is_published`, `created_at`, `updated_at`)
SELECT
  CONCAT('club-photos-', REPLACE(UUID(), '-', '')),
  `c`.`id`,
  'Club Photos',
  'A place for the club’s tournament nights, meetups, and community moments.',
  '/manus-storage/club-photos-default-cover_8e826089.jpg',
  `c`.`owner_id`,
  COALESCE(`c`.`owner_name`, ''),
  1,
  NOW(),
  NOW()
FROM `clubs` AS `c`
WHERE NOT EXISTS (
  SELECT 1
  FROM `club_albums` AS `a`
  WHERE `a`.`club_id` = `c`.`id`
    AND `a`.`title` = 'Club Photos'
);
