import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { db } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Route imports
import { authRouter }     from './routes/auth.routes';
import { donorRouter }    from './routes/donors.routes';
import { donationRouter } from './routes/donations.routes';
import { fundsRouter }    from './routes/funds.routes';
import { expenseRouter }  from './routes/expenses.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { publicRouter }   from './routes/public.routes';
import { webhooksRouter } from './routes/webhooks.routes';
import { volunteersRouter } from './routes/volunteers.routes';
import { adminRouter } from './routes/admin.routes';
import { advancedRouter } from './routes/advanced.routes';
import { processDonationQueue, initCronJobs } from './services/queue.worker';
import { campaignsRouter } from './routes/campaigns.routes';
import { beneficiariesRouter } from './routes/beneficiaries.routes';
import { announcementsRouter } from './routes/announcements.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { pledgesRouter } from './routes/pledges.routes';
import { recurringRouter } from './routes/recurring.routes';
import { reportsRouter } from './routes/reports.routes';
import { projectsRouter }              from './routes/projects.routes';
import { featureFlagsRouter }          from './routes/feature-flags.routes';
import { volunteerApplicationsRouter } from './routes/volunteer-applications.routes';
import { shiftsRouter }                from './routes/shifts.routes';
import { p2pRouter }                   from './routes/p2p.routes';
import { emailTemplatesRouter }        from './routes/email-templates.routes';
import { customFieldsRouter }          from './routes/custom-fields.routes';

const app    = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// WebSocket server (Socket.io)
// ---------------------------------------------------------------------------
const io = new SocketIOServer(server, {
  cors: { origin: config.cors.origins, credentials: true },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });

  socket.on('subscribe:fund', (fundId: number) => {
    socket.join(`fund:${fundId}`);
  });

  socket.on('subscribe:campaign', (campaignId: number) => {
    socket.join(`campaign:${campaignId}`);
  });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });
});

// Export io so services can emit events
export { io };

// ---------------------------------------------------------------------------
// Security & request handling middleware
// ---------------------------------------------------------------------------
app.set('trust proxy', 1); // Trust LiteSpeed/Nginx reverse proxy

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin:      config.cors.origins,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());

// Mount webhooks before global body parsers (Stripe needs raw body to verify signature)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many webhooks. Slow down.' },
});
app.use('/api/v1/webhooks', webhookLimiter, webhooksRouter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// HTTP request logging (skip health checks)
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/health',
}));

// ---------------------------------------------------------------------------
// Global rate limiting (per IP)
// ---------------------------------------------------------------------------
app.use(rateLimit({
  windowMs:            config.rateLimit.windowMs,
  max:                 config.rateLimit.maxRequests,
  standardHeaders:     true,
  legacyHeaders:       false,
  message: { success: false, message: 'Too many requests, please slow down.' },
  skip: (req) => req.url === '/health',
}));

// Stricter limit on auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs:  5 * 60 * 1000,   // 5 minutes
  max:       10,
  message: { success: false, message: 'Too many login attempts. Try again in 5 minutes.' },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const API = `/api/${config.appUrl.includes('v1') ? 'v1' : 'v1'}`;
// Shorthand: always mount under /api/v1
app.use('/api/v1/auth',      authLimiter, authRouter);
app.use('/api/v1/donors',    donorRouter);
app.use('/api/v1/donations', donationRouter);
app.use('/api/v1/funds',     fundsRouter);
app.use('/api/v1/expenses',  expenseRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/public',    publicRouter);
app.use('/api/v1/volunteers', volunteersRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/advanced', advancedRouter);
app.use('/api/v1/campaigns', campaignsRouter);
app.use('/api/v1/beneficiaries', beneficiariesRouter);
app.use('/api/v1/announcements', announcementsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/pledges', pledgesRouter);
app.use('/api/v1/recurring', recurringRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/projects',                projectsRouter);
app.use('/api/v1/feature-flags',           featureFlagsRouter);
app.use('/api/v1/volunteer-applications',  volunteerApplicationsRouter);
app.use('/api/v1/shifts',                  shiftsRouter);
app.use('/api/v1/p2p',                     p2pRouter);
app.use('/api/v1/email-templates',         emailTemplatesRouter);
app.use('/api/v1/custom-fields',           customFieldsRouter);

// Health check (no auth, no rate limit)
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    uptime:  process.uptime(),
    ts:      new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// SEO: robots.txt and sitemap.xml dynamic serving
// ---------------------------------------------------------------------------
app.get('/robots.txt', async (_req, res) => {
  try {
    const row = await db('dfb_seo_settings').where({ setting_key: 'seo.robots_txt_content' }).first('setting_value');
    const content = row?.setting_value || 'User-agent: *\nAllow: /\nDisallow: /admin/\n';
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
  } catch {
    res.setHeader('Content-Type', 'text/plain');
    res.send('User-agent: *\nAllow: /\nDisallow: /admin/\n');
  }
});

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const campaigns  = await db('dfb_campaigns').where({ is_public: true, status: 'active' }).select('slug', 'updated_at');
    const base       = config.appUrl;
    const urls       = [
      `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...campaigns.map((c: any) => `<url><loc>${base}/campaigns/${c.slug}</loc><lastmod>${new Date(c.updated_at).toISOString().split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch {
    res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

// ---------------------------------------------------------------------------
// Serve Frontend (React SPA)
// ---------------------------------------------------------------------------
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendBuildPath));

// Fallback all unused non-API routes to React's index.html
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// 404 & error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function bootstrap(): Promise<void> {
  // Verify DB connectivity
  await db.raw('SELECT 1');
  logger.info('MariaDB connected', { database: config.db.database });

  // Connect Redis (lazy)
  await redis.connect();

  server.listen(config.port, () => {
    logger.info(`DFB API running on port ${config.port}`, {
      env:  config.env,
      port: config.port,
    });
    console.log(`\n✅  DFB Donor Management API`);
    console.log(`   Port:    ${config.port}`);
    console.log(`   Env:     ${config.env}`);
    console.log(`   DB:      ${config.db.database}@${config.db.host}`);
    console.log(`   Health:  http://localhost:${config.port}/health\n`);
  });

  // Start Background Workers
  initCronJobs();
  setInterval(processDonationQueue, 15000); // Poll every 15 seconds
  logger.info('Background Queue Poller started');
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { err: err.message });
  process.exit(1);
});
