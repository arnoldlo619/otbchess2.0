CREATE TABLE `population_dataset_versions` (
  `id` varchar(64) NOT NULL,
  `status` varchar(20) NOT NULL,
  `schema_version` int NOT NULL,
  `tracked_set_version` int NOT NULL,
  `tracked_position_count` int NOT NULL DEFAULT 0,
  `complete_months_json` text NOT NULL,
  `source_license` varchar(32) NOT NULL DEFAULT 'CC0-1.0',
  `import_code_version` varchar(64) NOT NULL,
  `previous_published_id` varchar(64),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `published_at` timestamp NULL,
  `rolled_back_at` timestamp NULL,
  PRIMARY KEY (`id`), KEY `population_dataset_status_idx` (`status`), KEY `population_dataset_published_idx` (`published_at`)
);
CREATE TABLE `population_dataset_months` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dataset_id` varchar(64) NOT NULL, `source_month` varchar(7) NOT NULL,
  `source_filename` varchar(96) NOT NULL, `expected_sha256` varchar(64) NOT NULL, `observed_sha256` varchar(64),
  `verification_status` varchar(20) NOT NULL, `compressed_bytes` bigint NOT NULL DEFAULT 0,
  `games_parsed` bigint NOT NULL DEFAULT 0, `games_accepted` bigint NOT NULL DEFAULT 0, `excluded_json` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `population_dataset_month_unique` (`dataset_id`,`source_month`), KEY `population_dataset_month_dataset_idx` (`dataset_id`)
);
CREATE TABLE `population_tracked_positions` (
  `position_key` varchar(64) NOT NULL, `canonical_epd` varchar(160) NOT NULL, `uci_path_json` text NOT NULL,
  `ply` int NOT NULL, `side_to_move` varchar(5) NOT NULL, `active` boolean NOT NULL DEFAULT true,
  `tracked_set_version` int NOT NULL, `demand_count` int NOT NULL DEFAULT 0,
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `last_requested_at` timestamp NULL,
  PRIMARY KEY (`position_key`), KEY `population_tracked_active_idx` (`active`,`tracked_set_version`)
);
CREATE TABLE `population_aggregates` (
  `id` int NOT NULL AUTO_INCREMENT, `dataset_id` varchar(64) NOT NULL, `position_key` varchar(64) NOT NULL,
  `speed` varchar(8) NOT NULL, `rating_band` int NOT NULL, `move_uci` varchar(5) NOT NULL, `move_san` varchar(16) NOT NULL,
  `parent_total` bigint NOT NULL, `move_total` bigint NOT NULL, `white_wins` bigint NOT NULL DEFAULT 0,
  `draws` bigint NOT NULL DEFAULT 0, `black_wins` bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `population_aggregate_unique` (`dataset_id`,`position_key`,`speed`,`rating_band`,`move_uci`),
  KEY `population_aggregate_lookup_idx` (`dataset_id`,`position_key`,`speed`,`rating_band`)
);
CREATE TABLE `population_explorer_cache` (
  `request_key` varchar(128) NOT NULL, `response_json` text NOT NULL,
  `fetched_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `expires_at` timestamp NOT NULL, `stale_until` timestamp NOT NULL,
  `source_month_from` varchar(7) NOT NULL, `source_month_to` varchar(7) NOT NULL,
  PRIMARY KEY (`request_key`), KEY `population_explorer_expires_idx` (`expires_at`)
);
CREATE TABLE `population_jobs` (
  `id` varchar(64) NOT NULL, `dataset_id` varchar(64) NOT NULL, `status` varchar(20) NOT NULL,
  `source_filename` varchar(96), `compressed_bytes` bigint NOT NULL DEFAULT 0, `games_parsed` bigint NOT NULL DEFAULT 0,
  `games_accepted` bigint NOT NULL DEFAULT 0, `aggregate_rows` bigint NOT NULL DEFAULT 0, `exclusions_json` text NOT NULL,
  `failure_code` varchar(64), `failure_detail_redacted` varchar(500), `started_at` timestamp NULL,
  `heartbeat_at` timestamp NULL, `completed_at` timestamp NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `population_jobs_dataset_idx` (`dataset_id`,`created_at`)
);
