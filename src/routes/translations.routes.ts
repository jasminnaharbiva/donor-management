import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { db } from '../config/database';

export const translationsRouter = Router();

// GET /api/v1/translations — list all, filter by locale/namespace
translationsRouter.get(
  '/',
  authenticate,
  requireRoles('admin'),
  async (req: Request, res: Response) => {
    try {
      const { locale, namespace, search, page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let q = db('dfb_translations').select('*').orderBy([{ column: 'locale' }, { column: 'namespace' }, { column: 'key' }]);

      if (locale) q = q.where('locale', locale);
      if (namespace) q = q.where('namespace', namespace);
      if (search) q = q.where((b: any) => b.whereLike('key', `%${search}%`).orWhereLike('value', `%${search}%`));

      const [rows, [{ total }]] = await Promise.all([
        q.clone().limit(parseInt(limit)).offset(offset),
        q.clone().count('* as total'),
      ]);

      // Distinct locales + namespaces for filter dropdowns
      const [locales, namespaces] = await Promise.all([
        db('dfb_translations').distinct('locale').orderBy('locale'),
        db('dfb_translations').distinct('namespace').orderBy('namespace'),
      ]);

      res.json({
        data: rows,
        total,
        locales: locales.map((r: any) => r.locale),
        namespaces: namespaces.map((r: any) => r.namespace),
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/v1/translations — upsert a translation
translationsRouter.post(
  '/',
  authenticate,
  requireRoles('admin'),
  [
    body('locale').isLength({ min: 2, max: 10 }).trim(),
    body('namespace').isLength({ min: 1, max: 40 }).trim(),
    body('key').isLength({ min: 1, max: 100 }).trim(),
    body('value').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { locale, namespace, key, value } = req.body;
      const updatedBy = req.user!.userId;

      const existing = await db('dfb_translations').where({ locale, namespace, key }).first();
      if (existing) {
        await db('dfb_translations').where({ locale, namespace, key }).update({ value, updated_by: updatedBy });
        const updated = await db('dfb_translations').where({ locale, namespace, key }).first();
        return res.json(updated);
      }

      await db('dfb_translations').insert({ locale, namespace, key, value, updated_by: updatedBy });
      const created = await db('dfb_translations').where({ locale, namespace, key }).first();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/v1/translations/:id — update by id
translationsRouter.put(
  '/:id',
  authenticate,
  requireRoles('admin'),
  [
    param('id').isInt({ min: 1 }),
    body('value').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const { value } = req.body;
      const updatedBy = req.user!.userId;

      const existing = await db('dfb_translations').where('translation_id', id).first();
      if (!existing) return res.status(404).json({ error: 'Translation not found' });

      await db('dfb_translations').where('translation_id', id).update({ value, updated_by: updatedBy });
      const updated = await db('dfb_translations').where('translation_id', id).first();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/v1/translations/:id
translationsRouter.delete(
  '/:id',
  authenticate,
  requireRoles('admin'),
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const existing = await db('dfb_translations').where('translation_id', id).first();
      if (!existing) return res.status(404).json({ error: 'Translation not found' });

      await db('dfb_translations').where('translation_id', id).delete();
      res.json({ message: 'Deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/v1/translations/bulk-import — import JSON { locale, namespace, translations: {key: value} }
translationsRouter.post(
  '/bulk-import',
  authenticate,
  requireRoles('admin'),
  [
    body('locale').isLength({ min: 2, max: 10 }).trim(),
    body('namespace').isLength({ min: 1, max: 40 }).trim(),
    body('translations').isObject(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { locale, namespace, translations } = req.body;
      const updatedBy = req.user!.userId;

      let upserted = 0;
      for (const [key, value] of Object.entries(translations)) {
        if (typeof value !== 'string') continue;
        const existing = await db('dfb_translations').where({ locale, namespace, key }).first();
        if (existing) {
          await db('dfb_translations').where({ locale, namespace, key }).update({ value, updated_by: updatedBy });
        } else {
          await db('dfb_translations').insert({ locale, namespace, key, value, updated_by: updatedBy });
        }
        upserted++;
      }

      res.json({ message: `Imported ${upserted} translations`, upserted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
