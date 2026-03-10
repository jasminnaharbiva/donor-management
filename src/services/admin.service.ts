import { db } from '../config/database';
import { redis } from '../config/redis';
import { io } from '../index';
import { logger } from '../utils/logger';

/**
 * Invalidates the Redis cache for all permissions.
 * This ensures that the next request will reload fresh permissions from MySQL.
 */
export async function invalidatePermissionCache(): Promise<void> {
  try {
    const keys = await redis.keys('perm:*');
    if (keys.length > 0) {
      await redis.del(keys);
      logger.info(`Invalidated ${keys.length} permission cache keys`);
    }
  } catch (err) {
    logger.error('Failed to invalidate permission cache', { error: err });
  }
}

/**
 * Broadcasts a configuration change to all connected clients.
 * This allows React clients to immediately reload Settings / Values without a page refresh.
 * @param configKey The setting key or feature name that changed
 * @param entityType The type of data ('setting', 'feature', 'form_schema', 'email_template')
 */
export function broadcastConfigChange(configKey: string, entityType: string): void {
  io.emit('admin_config_changed', {
    type: entityType,
    key: configKey,
    timestamp: new Date().toISOString()
  });
  logger.info(`Broadcasted config change`, { entityType, configKey });
}
