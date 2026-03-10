import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis({
  host:            config.redis.host,
  port:            config.redis.port,
  password:        config.redis.password,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 10) return null;        // Stop retrying after 10 attempts
    return Math.min(times * 200, 2000); // Exponential back-off, max 2s
  },
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error',   (err) => logger.error('Redis error', { err: err.message }));
