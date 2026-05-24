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
ALTER TABLE `github_integrations` ADD CONSTRAINT `github_integrations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;