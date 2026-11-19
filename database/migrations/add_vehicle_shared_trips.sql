-- Shared vehicle trips: capacity, per-headcount price tiers, trip entity,
-- booking_items link, and default org setting for payment-close rules.

-- -----------------------------------------------------------------------------
-- 1. vehicles.max_passengers
-- -----------------------------------------------------------------------------
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'vehicles'
      AND column_name = 'max_passengers') = 0,
  'ALTER TABLE `vehicles`
     ADD COLUMN `max_passengers` INT UNSIGNED NOT NULL DEFAULT 4 AFTER `currency`',
  'SELECT ''vehicles.max_passengers already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 2. vehicle_route_price_tiers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vehicle_route_price_tiers` (
  `id` CHAR(36) NOT NULL,
  `route_id` CHAR(36) NOT NULL,
  `min_passengers` SMALLINT UNSIGNED NOT NULL,
  `max_passengers` SMALLINT UNSIGNED NOT NULL,
  `price_cents` INT UNSIGNED NOT NULL,
  `created_by_user_id` CHAR(36) DEFAULT NULL,
  `updated_by_user_id` CHAR(36) DEFAULT NULL,
  `deleted_by_user_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vrpt_route` (`route_id`),
  KEY `idx_vrpt_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_vrpt_route` FOREIGN KEY (`route_id`) REFERENCES `vehicle_routes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vrpt_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vrpt_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vrpt_deleted_by` FOREIGN KEY (`deleted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: one 1–1 tier from each route's legacy price_cents (skip if any tier exists).
INSERT INTO `vehicle_route_price_tiers` (
  `id`, `route_id`, `min_passengers`, `max_passengers`, `price_cents`, `created_by_user_id`
)
SELECT
  UUID(),
  vr.`id`,
  1,
  1,
  vr.`price_cents`,
  vr.`created_by_user_id`
FROM `vehicle_routes` vr
WHERE vr.`deleted_at` IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `vehicle_route_price_tiers` t
    WHERE t.`route_id` = vr.`id`
      AND t.`deleted_at` IS NULL
  );

-- -----------------------------------------------------------------------------
-- 3. vehicle_trips
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vehicle_trips` (
  `id` CHAR(36) NOT NULL,
  `vehicle_id` CHAR(36) NOT NULL,
  `route_id` CHAR(36) NOT NULL,
  `availability_id` CHAR(36) NOT NULL,
  `departure_datetime` DATETIME NOT NULL,
  `created_by_user_id` CHAR(36) NOT NULL,
  `max_capacity` SMALLINT UNSIGNED NOT NULL,
  `seats_reserved` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('open','payment_closed','completed','cancelled') NOT NULL DEFAULT 'open',
  `updated_by_user_id` CHAR(36) DEFAULT NULL,
  `deleted_by_user_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_trips_vehicle_departure` (`vehicle_id`, `departure_datetime`),
  KEY `idx_vehicle_trips_route_status` (`route_id`, `status`),
  KEY `idx_vehicle_trips_status_departure` (`status`, `departure_datetime`),
  KEY `idx_vehicle_trips_availability` (`availability_id`),
  KEY `idx_vehicle_trips_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_vehicle_trips_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vehicle_trips_route` FOREIGN KEY (`route_id`) REFERENCES `vehicle_routes` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_vehicle_trips_availability` FOREIGN KEY (`availability_id`) REFERENCES `vehicle_availability` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_vehicle_trips_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_vehicle_trips_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vehicle_trips_deleted_by` FOREIGN KEY (`deleted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. booking_items.vehicle_trip_id + route_id
-- -----------------------------------------------------------------------------
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'booking_items'
      AND column_name = 'vehicle_trip_id') = 0,
  'ALTER TABLE `booking_items`
     ADD COLUMN `vehicle_trip_id` CHAR(36) NULL AFTER `reference_id`',
  'SELECT ''booking_items.vehicle_trip_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'booking_items'
      AND column_name = 'route_id') = 0,
  'ALTER TABLE `booking_items`
     ADD COLUMN `route_id` CHAR(36) NULL AFTER `vehicle_trip_id`',
  'SELECT ''booking_items.route_id already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'booking_items'
      AND index_name = 'idx_booking_items_vehicle_trip') = 0,
  'ALTER TABLE `booking_items` ADD KEY `idx_booking_items_vehicle_trip` (`vehicle_trip_id`)',
  'SELECT ''idx_booking_items_vehicle_trip already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'booking_items'
      AND index_name = 'idx_booking_items_route') = 0,
  'ALTER TABLE `booking_items` ADD KEY `idx_booking_items_route` (`route_id`)',
  'SELECT ''idx_booking_items_route already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'booking_items'
      AND constraint_name = 'fk_booking_items_vehicle_trip') = 0,
  'ALTER TABLE `booking_items`
     ADD CONSTRAINT `fk_booking_items_vehicle_trip`
     FOREIGN KEY (`vehicle_trip_id`) REFERENCES `vehicle_trips` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_booking_items_vehicle_trip already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'booking_items'
      AND constraint_name = 'fk_booking_items_route') = 0,
  'ALTER TABLE `booking_items`
     ADD CONSTRAINT `fk_booking_items_route`
     FOREIGN KEY (`route_id`) REFERENCES `vehicle_routes` (`id`) ON DELETE SET NULL',
  'SELECT ''fk_booking_items_route already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 5. organization_settings.vehicle_shared_trip (platform org)
-- -----------------------------------------------------------------------------
INSERT INTO `organization_settings` (
  `id`, `organization_id`, `setting_group`, `setting_key`, `setting_value`, `created_by_user_id`
)
SELECT
  '00000000-0000-4000-8000-000000000028',
  '00000000-0000-4000-8000-000000000001',
  'booking',
  'vehicle_shared_trip',
  '{"paymentCloseHoursBeforeDeparture":3,"departureTimeEditableUntil":"until_payment_close"}',
  '00000000-0000-4000-8000-000000000010'
WHERE EXISTS (
  SELECT 1 FROM `organizations` WHERE `id` = '00000000-0000-4000-8000-000000000001'
)
AND NOT EXISTS (
  SELECT 1 FROM `organization_settings`
  WHERE `organization_id` = '00000000-0000-4000-8000-000000000001'
    AND `setting_key` = 'vehicle_shared_trip'
    AND `deleted_at` IS NULL
);
