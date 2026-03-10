import { db } from '../config/database';
import { sha256Hash } from '../utils/crypto';
import { logger } from '../utils/logger';

interface IntegrityInput {
  recordType: 'transaction' | 'allocation' | 'expense';
  recordId:   string;
  payload:    Record<string, unknown>;
}

/**
 * Creates an integrity hash record (blockchain-style append-only chain).
 * Fetches the last existing hash for the same recordType as the previous link.
 */
export async function createIntegrityHash(input: IntegrityInput): Promise<number> {
  const { recordType, recordId, payload } = input;

  // Fetch the most recent hash in the chain for this record type
  const prev = await db('dfb_integrity_hashes')
    .where({ record_type: recordType })
    .orderBy('hash_id', 'desc')
    .first();

  const hashInput = {
    ...payload,
    record_type: recordType,
    record_id:   recordId,
    prev_hash:   prev ? prev.sha256_hash : '0'.repeat(64),
    ts:          new Date().toISOString(),
  };

  const hashString = sha256Hash(JSON.stringify(hashInput));

  const [hashId] = await db('dfb_integrity_hashes').insert({
    record_type:         recordType,
    record_id:           recordId,
    hash_input_payload:  JSON.stringify(hashInput),
    sha256_hash:         hashString,
    previous_hash_id:    prev ? prev.hash_id : null,
    created_at:          new Date(),
  });

  logger.info('Integrity hash created', { hashId, recordType, recordId });
  return hashId;
}

/**
 * Verifies the full integrity chain for a given record type.
 * Returns true if the chain is valid, false if tampered.
 */
export async function verifyChain(recordType: 'transaction' | 'allocation' | 'expense'): Promise<boolean> {
  const hashes = await db('dfb_integrity_hashes')
    .where({ record_type: recordType })
    .orderBy('hash_id', 'asc');

  for (let i = 0; i < hashes.length; i++) {
    const row        = hashes[i];
    const computed   = sha256Hash(row.hash_input_payload);
    if (computed !== row.sha256_hash) {
      logger.warn('Integrity chain BROKEN', { recordType, hash_id: row.hash_id });
      return false;
    }
  }
  return true;
}
