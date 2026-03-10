import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const env = process.env;

export const config = {
  env:    env.NODE_ENV     || 'production',
  port:   Number(env.PORT) || 3001,
  appUrl: env.APP_URL      || 'https://donor-management.nokshaojibon.com',

  db: {
    host:     env.DB_HOST     || '127.0.0.1',
    port:     Number(env.DB_PORT || '3306'),
    database: env.DB_NAME     || 'donor_management',
    user:     env.DB_USER     || 'dfb_user',
    password: env.DB_PASS     || '',
    poolMin:  Number(env.DB_POOL_MIN || '2'),
    poolMax:  Number(env.DB_POOL_MAX || '20'),
  },

  redis: {
    host:     env.REDIS_HOST || '127.0.0.1',
    port:     Number(env.REDIS_PORT || '6379'),
    password: env.REDIS_PASSWORD,
  },

  jwt: {
    accessSecret:  env.JWT_ACCESS_SECRET  || '',
    refreshSecret: env.JWT_REFRESH_SECRET || '',
    accessExpires: env.JWT_ACCESS_EXPIRES  || '15m',
    refreshExpires:env.JWT_REFRESH_EXPIRES || '30d',
  },

  aes: {
    key: env.AES_ENCRYPTION_KEY || '',
  },

  email: {
    host:        env.SMTP_HOST         || 'localhost',
    port:        Number(env.SMTP_PORT || '587'),
    secure:      env.SMTP_SECURE       === 'true',
    user:        env.SMTP_USER,
    pass:        env.SMTP_PASS,
    fromName:    env.EMAIL_FROM_NAME    || 'Donor Management',
    fromAddress: env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
  },

  stripe: {
    secretKey:     env.STRIPE_SECRET_KEY      || '',
    publishableKey:env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET  || '',
  },

  bkash: {
    appKey:    env.BKASH_APP_KEY    || '',
    appSecret: env.BKASH_APP_SECRET || '',
    username:  env.BKASH_USERNAME   || '',
    password:  env.BKASH_PASSWORD   || '',
    baseUrl:   env.BKASH_BASE_URL   || 'https://tokenized.pay.bka.sh/v1.2.0-beta',
  },

  sslcommerz: {
    storeId:       env.SSLCOMMERZ_STORE_ID       || '',
    storePassword: env.SSLCOMMERZ_STORE_PASSWORD || '',
    isSandbox:     env.SSLCOMMERZ_IS_SANDBOX      === 'true',
  },

  storage: {
    provider:  (env.STORAGE_PROVIDER || 'local') as 'local' | 's3' | 'backblaze_b2',
    uploadDir: env.UPLOAD_DIR || path.join('/home/donor-management.nokshaojibon.com', 'uploads'),
    maxFileMb: Number(env.MAX_FILE_SIZE_MB || '10'),
  },

  rateLimit: {
    windowMs:    Number(env.RATE_LIMIT_WINDOW_MS      || '300000'),
    maxRequests: Number(env.RATE_LIMIT_MAX_REQUESTS   || '100'),
  },

  cors: {
    origins: (env.CORS_ORIGINS || 'https://donor-management.nokshaojibon.com').split(','),
  },

  logging: {
    level:  env.LOG_LEVEL || 'info',
    logDir: env.LOG_DIR   || '/home/donor-management.nokshaojibon.com/logs',
  },
} as const;
