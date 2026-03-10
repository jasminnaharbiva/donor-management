import { db } from '../config/database';
import { logger } from '../utils/logger';

export interface AuditEntry {
  tableAffected?: string;
  recordId?:      string;
  actionType:     'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | 'APPROVE' | 'REJECT'
                | 'REFUND' | 'GDPR_ERASE' | 'LOGOUT' | '2FA_ENABLE' | 'IMPERSONATE';
  oldPayload?:    Record<string, unknown>;
  newPayload?:    Record<string, unknown>;
  actorId?:       string;
  actorRole?:     string;
  ipAddress?:     string;
  userAgent?:     string;
}

/**
 * Writes an immutable audit log entry. The trigger on dfb_audit_logs
 * enforces APPEND-ONLY — no update/delete is possible at the DB level.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db('dfb_audit_logs').insert({
      table_affected: entry.tableAffected,
      record_id:      entry.recordId,
      action_type:    entry.actionType,
      old_payload:    entry.oldPayload ? JSON.stringify(entry.oldPayload) : null,
      new_payload:    entry.newPayload ? JSON.stringify(entry.newPayload) : null,
      actor_id:       entry.actorId,
      actor_role:     entry.actorRole,
      ip_address:     entry.ipAddress,
      user_agent:     entry.userAgent,
      timestamp:      new Date(),
    });
  } catch (err) {
    // Audit logging must never crash the main request — log and continue
    logger.error('Failed to write audit log', { err, entry: entry.actionType });
  }
}
