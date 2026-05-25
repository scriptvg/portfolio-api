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
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;