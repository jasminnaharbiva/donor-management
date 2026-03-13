import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config({ path: `${process.cwd()}/.env` });

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME     || 'donor_management',
    user:     process.env.DB_USER     || 'dfb_user',
    password: process.env.DB_PASS     || '',
    charset:  'utf8mb4',
    timezone: '+00:00',
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN) || 2,
    max: Number(process.env.DB_POOL_MAX) || 20,
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
    extension: 'ts',
  },
  asyncStackTraces: process.env.NODE_ENV !== 'production',
};

export default config;
