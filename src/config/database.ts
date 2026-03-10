import knex from 'knex';
import { config } from '../config';

export const db = knex({
  client: 'mysql2',
  connection: {
    host:     config.db.host,
    port:     config.db.port,
    database: config.db.database,
    user:     config.db.user,
    password: config.db.password,
    charset:  'utf8mb4',
    timezone: '+00:00',
    connectTimeout: 10000,
  },
  pool: {
    min: config.db.poolMin,
    max: config.db.poolMax,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis:    10000,
  },
  asyncStackTraces: config.env !== 'production',
});
