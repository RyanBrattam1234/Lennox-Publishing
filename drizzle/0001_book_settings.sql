CREATE TABLE `book_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text,
	`subtitle` text,
	`description` text,
	`mime` text,
	`cover` blob
);
