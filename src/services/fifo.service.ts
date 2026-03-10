import { db } from '../config/database';
import { logger } from '../utils/logger';

interface FifoResult {
  consumedAllocations: number[];
  totalConsumed: number;
}

/**
 * FIFO Allocation Engine
 * Deducts `amount` from a fund by consuming oldest (first-in) allocations first.
 * Updates `dfb_allocations.is_spent = true` and `dfb_funds.current_balance`.
 *
 * @param fundId     Target fund to deduct from
 * @param amount     Total amount to spend
 * @param expenseId  The expense record being funded
 * @returns List of allocation IDs consumed and the actual total consumed
 */
export async function consumeAllocations(
  fundId:    number,
  amount:    number,
  expenseId: string
): Promise<FifoResult> {
  return await db.transaction(async (trx) => {
    // Lock allocations for update — prevents race conditions during concurrent spending
    const available = await trx('dfb_allocations')
      .where({ fund_id: fundId, is_spent: false })
      .whereNull('expense_id')
      .orderBy('allocated_at', 'asc')   // FIFO: oldest first
      .forUpdate()
      .select('allocation_id', 'allocated_amount');

    let remaining = amount;
    const consumed: number[] = [];
    let totalConsumed = 0;

    for (const alloc of available) {
      if (remaining <= 0) break;

      consumed.push(alloc.allocation_id);
      totalConsumed += Number(alloc.allocated_amount);
      remaining     -= Number(alloc.allocated_amount);

      await trx('dfb_allocations')
        .where({ allocation_id: alloc.allocation_id })
        .update({ is_spent: true, expense_id: expenseId });
    }

    if (totalConsumed < amount) {
      throw new Error(`Insufficient fund balance in fund ${fundId}. Required: ${amount}, Available: ${totalConsumed}`);
    }

    // Update fund balance atomically
    await trx('dfb_funds')
      .where({ fund_id: fundId })
      .decrement('current_balance', amount);

    logger.info('FIFO allocation consumed', {
      fundId, expenseId, amount, consumed: consumed.length,
    });

    return { consumedAllocations: consumed, totalConsumed };
  });
}
