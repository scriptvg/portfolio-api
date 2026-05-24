ALTER TABLE `users` MODIFY COLUMN `age` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `image` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `googleId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `githubId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_googleId_unique` UNIQUE(`googleId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_githubId_unique` UNIQUE(`githubId`);