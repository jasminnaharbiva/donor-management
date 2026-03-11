import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import fs from 'fs';

export const mediaRouter = Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and PDF are allowed.'));
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/media/upload
// ---------------------------------------------------------------------------
mediaRouter.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    try {
      const mediaId = uuidv4();
      const relativePath = `/uploads/${req.file.filename}`;
      const cdnUrl = `${process.env.APP_URL || 'http://localhost:3000'}${relativePath}`;
      
      const purpose = req.body.purpose || 'other';
      const referenceType = req.body.referenceType || null;
      const referenceId = req.body.referenceId || null;

      await db('dfb_media').insert({
        media_id: mediaId,
        uploader_user_id: req.user!.userId,
        file_name: req.file.originalname,
        file_path: relativePath,
        mime_type: req.file.mimetype,
        file_size_bytes: req.file.size,
        purpose: purpose,
        reference_type: referenceType,
        reference_id: referenceId,
        is_public: true,
        cdn_url: cdnUrl,
        storage_provider: 'local',
        virus_scan_status: 'clean',
        created_at: new Date()
      });

      res.status(201).json({
        success: true,
        data: {
          mediaId,
          url: cdnUrl,
          fileName: req.file.originalname,
          sizeBytes: req.file.size
        }
      });
    } catch (error) {
      console.error('Media upload error:', error);
      res.status(500).json({ success: false, message: 'Database error saving media registry' });
    }
  }
);
