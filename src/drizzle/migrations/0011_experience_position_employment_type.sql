ALTER TABLE `experiences` ADD `position` varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `experiences` ADD `employment_type` enum('full_time','part_time','internship','contract','freelance','volunteer') NOT NULL DEFAULT 'full_time';
