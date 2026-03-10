import { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { writeAuditLog } from '../services/audit.service';

export const adminUserRoutes = [
  // User Management Routes
];
