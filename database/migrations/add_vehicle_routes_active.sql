-- vehicle_routes.active: visibility on the public /cars catalogue.
-- Default 1 (visible). When 0, the tronçon is hidden from /cars but remains
-- usable in package_items (item_type = 'troncon') and admin CRUD.

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'vehicle_routes'
      AND column_name = 'active') = 0,
  'ALTER TABLE `vehicle_routes`
     ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `currency`',
  'SELECT ''vehicle_routes.active already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'vehicle_routes'
      AND index_name = 'idx_vehicle_routes_active') = 0,
  'ALTER TABLE `vehicle_routes` ADD KEY `idx_vehicle_routes_active` (`active`)',
  'SELECT ''idx_vehicle_routes_active already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
