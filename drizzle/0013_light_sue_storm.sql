ALTER TABLE `club_event_rsvps` ADD `payment_status` varchar(20) DEFAULT 'untracked' NOT NULL;--> statement-breakpoint
ALTER TABLE `club_event_rsvps` ADD `payment_updated_at` timestamp;--> statement-breakpoint
ALTER TABLE `club_event_rsvps` ADD `payment_updated_by` varchar(64);