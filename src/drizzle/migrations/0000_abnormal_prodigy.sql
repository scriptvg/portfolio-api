CREATE TABLE `users` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`age` int NOT NULL DEFAULT 0,
	`image` varchar(512),
	`googleId` varchar(255),
	`githubId` varchar(255),
	`passwordHash` varchar(255),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_googleId_unique` UNIQUE(`googleId`),
	CONSTRAINT `users_githubId_unique` UNIQUE(`githubId`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` varchar(36) NOT NULL,
	`panel_theme` varchar(16) NOT NULL DEFAULT 'system',
	`panel_layout` varchar(16) NOT NULL DEFAULT 'fixed',
	`panel_language` varchar(8) NOT NULL DEFAULT 'es',
	`confirm_before_delete` boolean NOT NULL DEFAULT true,
	`notification_prefs` json NOT NULL,
	`workspace` json NOT NULL,
	`workspace_slug` varchar(64),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `user_settings_workspace_slug_unique` UNIQUE(`workspace_slug`)
);
--> statement-breakpoint
CREATE TABLE `technologies` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`name` varchar(255) NOT NULL,
	`icon` varchar(255) NOT NULL,
	`color` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `technologies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`title` varchar(255) NOT NULL,
	`position` varchar(255) NOT NULL DEFAULT '',
	`employment_type` enum('full_time','part_time','internship','contract','freelance','volunteer','bootcamp') NOT NULL DEFAULT 'full_time',
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
CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`slug` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` varchar(2000) NOT NULL,
	`imageUrl` varchar(512) NOT NULL,
	`liveUrl` varchar(512),
	`githubUrl` varchar(512),
	`sortOrder` int NOT NULL DEFAULT 0,
	`github_repo_id` int,
	`github_full_name` varchar(255),
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
CREATE TABLE `webhooks` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(36) NOT NULL,
	`label` varchar(120) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`secret` varchar(128) NOT NULL,
	`events` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`webhook_id` varchar(36) NOT NULL,
	`event` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`next_attempt_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`last_attempt_at` timestamp,
	`response_status` int,
	`response_body` text,
	`error_message` varchar(1024),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `github_integrations` (
	`user_id` varchar(36) NOT NULL,
	`token_cipher` varchar(1024) NOT NULL,
	`token_iv` varchar(64) NOT NULL,
	`token_tag` varchar(64) NOT NULL,
	`token_preview` varchar(16) NOT NULL,
	`github_login` varchar(64) NOT NULL,
	`github_id` int NOT NULL,
	`scopes` varchar(512) NOT NULL DEFAULT '',
	`profile` json NOT NULL,
	`connected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`last_synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `github_integrations_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime(0) NOT NULL,
	`created_at` datetime(0) NOT NULL DEFAULT (now()),
	`revoked_at` datetime(0),
	`replaced_by` char(64),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `refresh_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experience_technologies` ADD CONSTRAINT `experience_technologies_experienceId_experiences_id_fk` FOREIGN KEY (`experienceId`) REFERENCES `experiences`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experience_technologies` ADD CONSTRAINT `experience_technologies_technologyId_technologies_id_fk` FOREIGN KEY (`technologyId`) REFERENCES `technologies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_technologies` ADD CONSTRAINT `project_technologies_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_technologies` ADD CONSTRAINT `project_technologies_technologyId_technologies_id_fk` FOREIGN KEY (`technologyId`) REFERENCES `technologies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_webhook_id_webhooks_id_fk` FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `github_integrations` ADD CONSTRAINT `github_integrations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;