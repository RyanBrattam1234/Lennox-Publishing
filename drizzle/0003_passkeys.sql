CREATE TABLE `passkey_challenges` (
	`token` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`scope` text NOT NULL,
	`bucket` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `passkey_challenge_expiry` ON `passkey_challenges` (`expires`);--> statement-breakpoint
CREATE TABLE `account_passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `blog_users`(`id`) ON UPDATE no action ON DELETE cascade
);
