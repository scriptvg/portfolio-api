CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`slug` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` varchar(2000) NOT NULL,
	`imageUrl` varchar(512) NOT NULL,
	`liveUrl` varchar(512),
	`githubUrl` varchar(512),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `project_technologies` (
	`projectId` varchar(36) NOT NULL,
	`technologyId` varchar(36) NOT NULL,
	CONSTRAINT `project_technologies_projectId_technologyId_pk` PRIMARY KEY(`projectId`,`technologyId`)
);
--> statement-breakpoint
ALTER TABLE `project_technologies` ADD CONSTRAINT `project_technologies_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `project_technologies` ADD CONSTRAINT `project_technologies_technologyId_technologies_id_fk` FOREIGN KEY (`technologyId`) REFERENCES `technologies`(`id`) ON DELETE cascade ON UPDATE no action;
