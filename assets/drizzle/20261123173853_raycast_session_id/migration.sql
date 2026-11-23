ALTER TABLE `sessions` ADD `raycast_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_raycast_id_unique` ON `sessions` (`raycast_id`);