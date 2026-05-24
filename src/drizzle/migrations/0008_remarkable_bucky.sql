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
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_webhook_id_webhooks_id_fk` FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON DELETE cascade ON UPDATE no action;