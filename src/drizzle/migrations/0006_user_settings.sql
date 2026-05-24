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
	CONSTRAINT `user_settings_workspace_slug_unique` UNIQUE(`workspace_slug`),
	CONSTRAINT `user_settings_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
