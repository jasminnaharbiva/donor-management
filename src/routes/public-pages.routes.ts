import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { db } from '../config/database';

export const publicPagesRouter = Router();

// GET /api/v1/public-pages — list all pages
publicPagesRouter.get(
  '/',
  authenticate,
  requireRoles('admin'),
  async (req: Request, res: Response) => {
    try {
      const rows = await db('dfb_public_pages')
        .select('page_id', 'page_slug', 'page_title', 'meta_title', 'meta_description', 'og_image_url', 'is_published', 'is_indexed', 'updated_at')
        .orderBy('page_slug');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/v1/public-pages/:id — get single page with full content
publicPagesRouter.get(
  '/:id',
  authenticate,
  requireRoles('admin'),
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const page = await db('dfb_public_pages').where('page_id', req.params.id).first();
      if (!page) return res.status(404).json({ error: 'Page not found' });
      res.json(page);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/v1/public-pages — create new page
publicPagesRouter.post(
  '/',
  authenticate,
  requireRoles('admin'),
  [
    body('page_slug').isSlug().isLength({ max: 80 }).trim(),
    body('page_title').isLength({ min: 1, max: 120 }).trim().escape(),
    body('meta_title').optional().isLength({ max: 70 }).trim().escape(),
    body('meta_description').optional().isLength({ max: 160 }).trim().escape(),
    body('og_image_url').optional().isURL(),
    body('is_published').optional().isBoolean(),
    body('is_indexed').optional().isBoolean(),
    body('sections_json').optional().isString(),
    body('custom_css').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { page_slug, page_title, meta_title, meta_description, og_image_url, is_published, is_indexed, sections_json, custom_css } = req.body;
      const updatedBy = req.user!.userId;

      // Validate sections_json is valid JSON if provided
      if (sections_json) {
        try { JSON.parse(sections_json); } catch { return res.status(400).json({ error: 'sections_json must be valid JSON' }); }
      }

      const existing = await db('dfb_public_pages').where('page_slug', page_slug).first();
      if (existing) return res.status(409).json({ error: 'Page slug already exists' });

      const [id] = await db('dfb_public_pages').insert({
        page_slug,
        page_title,
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        og_image_url: og_image_url || null,
        is_published: is_published ? 1 : 0,
        is_indexed: is_indexed !== false ? 1 : 0,
        sections_json: sections_json || null,
        custom_css: custom_css || null,
        updated_by: updatedBy,
      });

      const page = await db('dfb_public_pages').where('page_id', id).first();
      res.status(201).json(page);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/v1/public-pages/:id — update page
publicPagesRouter.put(
  '/:id',
  authenticate,
  requireRoles('admin'),
  [
    param('id').isInt({ min: 1 }),
    body('page_slug').optional().isSlug().isLength({ max: 80 }).trim(),
    body('page_title').optional().isLength({ min: 1, max: 120 }).trim().escape(),
    body('meta_title').optional().isLength({ max: 70 }).trim().escape(),
    body('meta_description').optional().isLength({ max: 160 }).trim().escape(),
    body('og_image_url').optional({ nullable: true }).isURL(),
    body('is_published').optional().isBoolean(),
    body('is_indexed').optional().isBoolean(),
    body('sections_json').optional({ nullable: true }).isString(),
    body('custom_css').optional({ nullable: true }).isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const updatedBy = req.user!.userId;

      const existing = await db('dfb_public_pages').where('page_id', id).first();
      if (!existing) return res.status(404).json({ error: 'Page not found' });

      const updates: Record<string, any> = { updated_by: updatedBy };
      const fields = ['page_slug', 'page_title', 'meta_title', 'meta_description', 'og_image_url', 'is_published', 'is_indexed', 'sections_json', 'custom_css'];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          if (f === 'sections_json' && req.body[f]) {
            try { JSON.parse(req.body[f]); } catch { return res.status(400).json({ error: 'sections_json must be valid JSON' }); }
          }
          updates[f] = req.body[f];
        }
      }

      // Check slug uniqueness if changing slug
      if (updates.page_slug && updates.page_slug !== existing.page_slug) {
        const slugExists = await db('dfb_public_pages').where('page_slug', updates.page_slug).whereNot('page_id', id).first();
        if (slugExists) return res.status(409).json({ error: 'Page slug already taken' });
      }

      await db('dfb_public_pages').where('page_id', id).update(updates);
      const page = await db('dfb_public_pages').where('page_id', id).first();
      res.json(page);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/v1/public-pages/:id
publicPagesRouter.delete(
  '/:id',
  authenticate,
  requireRoles('admin'),
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const existing = await db('dfb_public_pages').where('page_id', req.params.id).first();
      if (!existing) return res.status(404).json({ error: 'Page not found' });

      await db('dfb_public_pages').where('page_id', req.params.id).delete();
      res.json({ message: 'Page deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Public endpoint — GET /api/v1/public-pages/slug/:slug (no auth needed, used by frontend rendering)
publicPagesRouter.get(
  '/slug/:slug',
  async (req: Request, res: Response) => {
    try {
      const page = await db('dfb_public_pages')
        .where('page_slug', req.params.slug)
        .where('is_published', 1)
        .first();
      if (!page) return res.status(404).json({ error: 'Page not found' });
      res.json(page);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
