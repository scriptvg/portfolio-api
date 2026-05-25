CREATE TABLE `education` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`institution` varchar(255) NOT NULL,
	`degree` varchar(255) NOT NULL,
	`field_of_study` varchar(255),
	`period` varchar(255) NOT NULL,
	`description` varchar(2000),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `education_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `education_technologies` (
	`educationId` varchar(36) NOT NULL,
	`technologyId` varchar(36) NOT NULL,
	CONSTRAINT `education_technologies_educationId_technologyId_pk` PRIMARY KEY(`educationId`,`technologyId`)
);
--> statement-breakpoint
ALTER TABLE `experiences` MODIFY COLUMN `employment_type` enum('full_time','part_time','internship','contract','freelance','volunteer') NOT NULL DEFAULT 'full_time';--> statement-breakpoint
ALTER TABLE `education_technologies` ADD CONSTRAINT `education_technologies_educationId_education_id_fk` FOREIGN KEY (`educationId`) REFERENCES `education`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `education_technologies` ADD CONSTRAINT `education_technologies_technologyId_technologies_id_fk` FOREIGN KEY (`technologyId`) REFERENCES `technologies`(`id`) ON DELETE cascade ON UPDATE no action;