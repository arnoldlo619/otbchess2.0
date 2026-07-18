-- Migration: Add Silk animated background settings to clubs table
ALTER TABLE `clubs`
  ADD COLUMN `silk_speed` float,
  ADD COLUMN `silk_color` varchar(20),
  ADD COLUMN `silk_noise` float;
