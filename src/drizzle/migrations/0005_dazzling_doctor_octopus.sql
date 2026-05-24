CREATE TABLE `experiences` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`title` varchar(255) NOT NULL,
	`company` varchar(255) NOT NULL,
	`period` varchar(255) NOT NULL,
	`description` varchar(2000) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `experiences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `experience_technologies` (
	`experienceId` varchar(36) NOT NULL,
	`technologyId` varchar(36) NOT NULL,
	CONSTRAINT `experience_technologies_experienceId_technologyId_pk` PRIMARY KEY(`experienceId`,`technologyId`)
);
--> statement-breakpoint
ALTER TABLE `experience_technologies` ADD CONSTRAINT `experience_technologies_experienceId_experiences_id_fk` FOREIGN KEY (`experienceId`) REFERENCES `experiences`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experience_technologies` ADD CONSTRAINT `experience_technologies_technologyId_technologies_id_fk` FOREIGN KEY (`technologyId`) REFERENCES `technologies`(`id`) ON DELETE cascade ON UPDATE no action;