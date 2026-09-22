ALTER TABLE `clubs` MODIFY COLUMN `is_public` tinyint NOT NULL DEFAULT 0;
UPDATE `clubs` SET `is_public` = 0;
