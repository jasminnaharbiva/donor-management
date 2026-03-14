import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Loader2, RefreshCw, Trash2, Wallet } from 'lucide-react';
import api from '../../services/api';

type FundSummary = {
  fund_id: number;
  fund_name: string;
  fund_category: string;
  current_balance: number;
  target_goal: number;
  is_restricted: boolean;
  restriction_note?: string | null;
  verified_unspent_allocations: number;
  discrepancy: number;
  approved_spent: number;
  pending_spent: number;
  donor_giving_total: number;
  manual_entry_total: number;
  payment_panel_total: number;
  fundraising_total: number;
};

type LedgerPayload = {
  incoming_allocations: Array<{ allocation_id: number; allocated_amount: number; allocated_at: string; is_spent: boolean; transaction_id: string }>;
  approved_expenses: Array<{ expense_id: string; amount_spent: number; vendor_name: string; purpose: string; approved_at: string }>;
};

const FUND_CATEGORIES = ['General', 'Zakat', 'Sadaqah', 'Waqf', 'Restricted', 'Emergency'];
const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check', 'card', 'bkash', 'nagad', 'sslcommerz', 'paypal', 'rocket'];

export default function FundsManagementPanel() {
  const [funds, setFunds] = useState<FundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');

  const [createForm, setCreateForm] = useState({
    fundName: '',
    fundCategory: 'General',
    targetGoal: '',
    openingBalance: '',
    isRestricted: false,
    restrictionNote: '',
  });

  const [editForm, setEditForm] = useState({
    fundId: '',
    fundName: '',
    fundCategory: 'General',
    targetGoal: '',
    isRestricted: false,
    restrictionNote: '',
  });

  const [transferForm, setTransferForm] = useState({
    sourceFundId: '',
    targetFundId: '',
    amount: '',
    reason: '',
  });

  const [manualForm, setManualForm] = useState({
    fundId: '',
    amount: '',
    paymentMethod: 'bank_transfer',
    donorId: '',
    campaignId: '',
    reference: '',
  });

  const [ledgerFundId, setLedgerFundId] = useState<number | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerPayload | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(Number(n || 0));

  const totals = useMemo(() => {
    return funds.reduce(
      (acc, fund) => {
        acc.balance += Number(fund.current_balance || 0);
        acc.unspent += Number(fund.verified_unspent_allocations || 0);
        acc.approved += Number(fund.approved_spent || 0);
        acc.pending += Number(fund.pending_spent || 0);
        return acc;
      },
      { balance: 0, unspent: 0, approved: 0, pending: 0 }
    );
  }, [funds]);

  const load = async () => {
    setLoading(true);
    setNotice('');
    try {
      const candidateEndpoints = ['/funds/admin-summary', '/funds/admin/summary', '/funds/summary'];
      let loaded = false;

      for (const endpoint of candidateEndpoints) {
        try {
          const res = await api.get(endpoint);
          setFunds(res.data.data || []);
          loaded = true;
          break;
        } catch (err: any) {
          const status = Number(err?.response?.status || 0);
          if (status !== 404) throw err;
        }
      }

      if (!loaded) {
        const fallback = await api.get('/funds');
        const basicFunds = (fallback.data.data || []).map((fund: any) => ({
          ...fund,
          verified_unspent_allocations: Number(fund.current_balance || 0),
          discrepancy: 0,
          approved_spent: Number(fund.total_spent || 0),
          pending_spent: 0,
          donor_giving_total: 0,
          manual_entry_total: 0,
          payment_panel_total: 0,
          fundraising_total: 0,
        }));
        setFunds(basicFunds);
        setNotice('Advanced fund summary route is unavailable; showing compatible fallback data.');
      }
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to load fund summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyKey('create');
    setNotice('');
    try {
      await api.post('/funds', {
        fundName: createForm.fundName,
        fundCategory: createForm.fundCategory,
        targetGoal: createForm.targetGoal ? Number(createForm.targetGoal) : 0,
        openingBalance: createForm.openingBalance ? Number(createForm.openingBalance) : 0,
        isRestricted: createForm.isRestricted,
        restrictionNote: createForm.restrictionNote || null,
      });
      setCreateForm({ fundName: '', fundCategory: 'General', targetGoal: '', openingBalance: '', isRestricted: false, restrictionNote: '' });
      setNotice('Fund created successfully.');
      await load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to create fund');
    } finally {
      setBusyKey(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.fundId) {
      setNotice('Select a fund to update.');
      return;
    }
    setBusyKey('update');
    setNotice('');
    try {
      await api.patch(`/funds/${editForm.fundId}`, {
        fundName: editForm.fundName,
        fundCategory: editForm.fundCategory,
        targetGoal: editForm.targetGoal ? Number(editForm.targetGoal) : 0,
        isRestricted: editForm.isRestricted,
        restrictionNote: editForm.restrictionNote || null,
      });
      setNotice('Fund profile updated.');
      await load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to update fund');
    } finally {
      setBusyKey(null);
    }
  };

  const onChooseEditFund = (fundId: string) => {
    const selected = funds.find((f) => String(f.fund_id) === fundId);
    if (!selected) {
      setEditForm((prev) => ({ ...prev, fundId }));
      return;
    }
    setEditForm({
      fundId,
      fundName: selected.fund_name,
      fundCategory: selected.fund_category || 'General',
      targetGoal: String(selected.target_goal || ''),
      isRestricted: Boolean(selected.is_restricted),
      restrictionNote: selected.restriction_note || '',
    });
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.sourceFundId || !transferForm.targetFundId || !transferForm.amount) {
      setNotice('Source fund, target fund and amount are required.');
      return;
    }
    setBusyKey('transfer');
    setNotice('');
    try {
      await api.post('/funds/transfer', {
        sourceFundId: Number(transferForm.sourceFundId),
        targetFundId: Number(transferForm.targetFundId),
        amount: Number(transferForm.amount),
        reason: transferForm.reason || undefined,
      });
      setTransferForm({ sourceFundId: '', targetFundId: '', amount: '', reason: '' });
      setNotice('Fund transfer completed.');
      await load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to transfer funds');
    } finally {
      setBusyKey(null);
    }
  };

  const reconcile = async (fundId: number, applyFix: boolean) => {
    setBusyKey(`reconcile-${fundId}-${applyFix ? 'fix' : 'check'}`);
    setNotice('');
    try {
      const res = await api.post(`/funds/${fundId}/reconcile`, { applyFix });
      const payload = res.data.data;
      setNotice(
        applyFix
          ? `Reconciled ${payload.fund_name}. Balance corrected to ${fmt(payload.verified_unspent)}.`
          : `Checked ${payload.fund_name}. Discrepancy: ${fmt(payload.discrepancy)}.`
      );
      await load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to reconcile fund');
    } finally {
      setBusyKey(null);
    }
  };

  const openLedger = async (fundId: number) => {
    setBusyKey(`ledger-${fundId}`);
    setNotice('');
    try {
      const res = await api.get(`/funds/${fundId}/ledger`);
      setLedgerFundId(fundId);
      setLedgerData(res.data.data);
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to load ledger');
    } finally {
      setBusyKey(null);
    }
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.fundId || !manualForm.amount) {
      setNotice('Manual entry requires fund and amount.');
      return;
    }

    setBusyKey('manual-entry');
    setNotice('');
    try {
      await api.post('/funds/manual-entry', {
        fundId: Number(manualForm.fundId),
        amount: Number(manualForm.amount),
        paymentMethod: manualForm.paymentMethod,
        donorId: manualForm.donorId ? Number(manualForm.donorId) : undefined,
        campaignId: manualForm.campaignId ? Number(manualForm.campaignId) : undefined,
        reference: manualForm.reference || undefined,
      });
      setManualForm({ fundId: '', amount: '', paymentMethod: 'bank_transfer', donorId: '', campaignId: '', reference: '' });
      setNotice('Manual fund entry added successfully.');
      await load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to add manual entry');
    } finally {
      setBusyKey(null);
    }
  };

  const deleteFund = async (fund: FundSummary) => {
    if (!confirm(`Delete fund "${fund.fund_name}"? This works only when balance is zero and no linked records exist.`)) return;
    setBusyKey(`delete-${fund.fund_id}`);
    setNotice('');
    try {
      await api.delete(`/funds/${fund.fund_id}`);
      setNotice(`Fund "${fund.fund_name}" deleted.`);
      await load();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || 'Failed to delete fund');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center gap-2"><Wallet className="text-primary-500" size={18} /> Fund Management</h2>
        <button onClick={load} className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 text-primary-700 px-4 py-3 text-sm flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500">Total Fund Balance</p><p className="text-lg font-bold text-slate-800">{fmt(totals.balance)}</p></div>
        <div className="glass rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500">Verified Unspent</p><p className="text-lg font-bold text-slate-800">{fmt(totals.unspent)}</p></div>
        <div className="glass rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500">Approved Spent</p><p className="text-lg font-bold text-slate-800">{fmt(totals.approved)}</p></div>
        <div className="glass rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500">Pending Spend</p><p className="text-lg font-bold text-slate-800">{fmt(totals.pending)}</p></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <form onSubmit={handleCreate} className="glass rounded-xl p-5 border border-slate-200 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Create Fund</h3>
          <input value={createForm.fundName} onChange={(e) => setCreateForm((p) => ({ ...p, fundName: e.target.value }))} required placeholder="Fund Name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={createForm.fundCategory} onChange={(e) => setCreateForm((p) => ({ ...p, fundCategory: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {FUND_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input type="number" min={0} step="0.01" value={createForm.targetGoal} onChange={(e) => setCreateForm((p) => ({ ...p, targetGoal: e.target.value }))} placeholder="Target Goal" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input type="number" min={0} step="0.01" value={createForm.openingBalance} onChange={(e) => setCreateForm((p) => ({ ...p, openingBalance: e.target.value }))} placeholder="Opening Balance" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={createForm.isRestricted} onChange={(e) => setCreateForm((p) => ({ ...p, isRestricted: e.target.checked }))} /> Restricted fund
          </label>
          <textarea value={createForm.restrictionNote} onChange={(e) => setCreateForm((p) => ({ ...p, restrictionNote: e.target.value }))} rows={2} placeholder="Restriction note (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={busyKey === 'create'} className="w-full bg-primary-600 text-white text-sm font-semibold rounded-lg px-3 py-2 hover:bg-primary-700 disabled:opacity-50">
            {busyKey === 'create' ? 'Creating...' : 'Create Fund'}
          </button>
        </form>

        <form onSubmit={handleUpdate} className="glass rounded-xl p-5 border border-slate-200 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Edit Fund Profile</h3>
          <select value={editForm.fundId} onChange={(e) => onChooseEditFund(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required>
            <option value="">Select Fund</option>
            {funds.map((fund) => <option key={fund.fund_id} value={fund.fund_id}>{fund.fund_name}</option>)}
          </select>
          <input value={editForm.fundName} onChange={(e) => setEditForm((p) => ({ ...p, fundName: e.target.value }))} required placeholder="Fund Name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={editForm.fundCategory} onChange={(e) => setEditForm((p) => ({ ...p, fundCategory: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {FUND_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input type="number" min={0} step="0.01" value={editForm.targetGoal} onChange={(e) => setEditForm((p) => ({ ...p, targetGoal: e.target.value }))} placeholder="Target Goal" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={editForm.isRestricted} onChange={(e) => setEditForm((p) => ({ ...p, isRestricted: e.target.checked }))} /> Restricted fund
          </label>
          <textarea value={editForm.restrictionNote} onChange={(e) => setEditForm((p) => ({ ...p, restrictionNote: e.target.value }))} rows={2} placeholder="Restriction note (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={busyKey === 'update'} className="w-full bg-slate-800 text-white text-sm font-semibold rounded-lg px-3 py-2 hover:bg-slate-700 disabled:opacity-50">
            {busyKey === 'update' ? 'Updating...' : 'Update Fund'}
          </button>
        </form>

        <form onSubmit={handleTransfer} className="glass rounded-xl p-5 border border-slate-200 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><ArrowLeftRight size={15} /> Transfer Between Funds</h3>
          <select value={transferForm.sourceFundId} onChange={(e) => setTransferForm((p) => ({ ...p, sourceFundId: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required>
            <option value="">Source Fund</option>
            {funds.map((fund) => <option key={`source-${fund.fund_id}`} value={fund.fund_id}>{fund.fund_name}</option>)}
          </select>
          <select value={transferForm.targetFundId} onChange={(e) => setTransferForm((p) => ({ ...p, targetFundId: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required>
            <option value="">Target Fund</option>
            {funds.map((fund) => <option key={`target-${fund.fund_id}`} value={fund.fund_id}>{fund.fund_name}</option>)}
          </select>
          <input type="number" min={0.01} step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Transfer Amount" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={transferForm.reason} onChange={(e) => setTransferForm((p) => ({ ...p, reason: e.target.value }))} rows={2} placeholder="Reason (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={busyKey === 'transfer'} className="w-full bg-amber-600 text-white text-sm font-semibold rounded-lg px-3 py-2 hover:bg-amber-700 disabled:opacity-50">
            {busyKey === 'transfer' ? 'Transferring...' : 'Transfer Funds'}
          </button>
        </form>

        <form onSubmit={handleManualEntry} className="glass rounded-xl p-5 border border-slate-200 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Manual Entry / Fundraising Top-up</h3>
          <select value={manualForm.fundId} onChange={(e) => setManualForm((p) => ({ ...p, fundId: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required>
            <option value="">Target Fund</option>
            {funds.map((fund) => <option key={`manual-${fund.fund_id}`} value={fund.fund_id}>{fund.fund_name}</option>)}
          </select>
          <input type="number" min={0.01} step="0.01" value={manualForm.amount} onChange={(e) => setManualForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Amount" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={manualForm.paymentMethod} onChange={(e) => setManualForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type="number" min={1} value={manualForm.donorId} onChange={(e) => setManualForm((p) => ({ ...p, donorId: e.target.value }))} placeholder="Donor ID (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input type="number" min={1} value={manualForm.campaignId} onChange={(e) => setManualForm((p) => ({ ...p, campaignId: e.target.value }))} placeholder="Campaign ID (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={manualForm.reference} onChange={(e) => setManualForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Reference note (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={busyKey === 'manual-entry'} className="w-full bg-emerald-600 text-white text-sm font-semibold rounded-lg px-3 py-2 hover:bg-emerald-700 disabled:opacity-50">
            {busyKey === 'manual-entry' ? 'Adding...' : 'Add Manual Entry'}
          </button>
        </form>
      </div>

      <div className="glass rounded-xl p-5 border border-slate-200 overflow-x-auto">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Fund Ledger Health</h3>
        <table className="w-full text-sm min-w-[1180px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="text-left py-2 px-2">Fund</th>
              <th className="text-left py-2 px-2">Current Balance</th>
              <th className="text-left py-2 px-2">Verified Unspent</th>
              <th className="text-left py-2 px-2">Discrepancy</th>
              <th className="text-left py-2 px-2">Inflow Sources</th>
              <th className="text-left py-2 px-2">Approved Spent</th>
              <th className="text-left py-2 px-2">Pending Spend</th>
              <th className="text-left py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {funds.map((fund) => (
              <tr key={fund.fund_id} className="hover:bg-slate-50 align-top">
                <td className="py-2 px-2">
                  <div className="font-medium text-slate-800">{fund.fund_name}</div>
                  <div className="text-xs text-slate-500">{fund.fund_category}{fund.is_restricted ? ' · Restricted' : ''}</div>
                </td>
                <td className="py-2 px-2 font-semibold text-slate-700">{fmt(fund.current_balance)}</td>
                <td className="py-2 px-2 text-slate-600">{fmt(fund.verified_unspent_allocations)}</td>
                <td className={`py-2 px-2 font-semibold ${Number(fund.discrepancy) === 0 ? 'text-green-600' : 'text-amber-700'}`}>{fmt(fund.discrepancy)}</td>
                <td className="py-2 px-2 text-xs text-slate-600">
                  <div>Donor: <span className="font-medium text-slate-700">{fmt(fund.donor_giving_total)}</span></div>
                  <div>Manual: <span className="font-medium text-slate-700">{fmt(fund.manual_entry_total)}</span></div>
                  <div>Payment: <span className="font-medium text-slate-700">{fmt(fund.payment_panel_total)}</span></div>
                  <div>Fundraising: <span className="font-medium text-slate-700">{fmt(fund.fundraising_total)}</span></div>
                </td>
                <td className="py-2 px-2 text-slate-600">{fmt(fund.approved_spent)}</td>
                <td className="py-2 px-2 text-slate-600">{fmt(fund.pending_spent)}</td>
                <td className="py-2 px-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => reconcile(fund.fund_id, false)}
                      disabled={busyKey === `reconcile-${fund.fund_id}-check`}
                      className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
                    >
                      {busyKey === `reconcile-${fund.fund_id}-check` ? 'Checking…' : 'Check'}
                    </button>
                    <button
                      onClick={() => reconcile(fund.fund_id, true)}
                      disabled={busyKey === `reconcile-${fund.fund_id}-fix`}
                      className="px-2 py-1 text-xs border border-green-300 text-green-700 rounded bg-green-50 hover:bg-green-100"
                    >
                      {busyKey === `reconcile-${fund.fund_id}-fix` ? 'Fixing…' : 'Fix'}
                    </button>
                    <button
                      onClick={() => openLedger(fund.fund_id)}
                      disabled={busyKey === `ledger-${fund.fund_id}`}
                      className="px-2 py-1 text-xs border border-primary-300 text-primary-700 rounded bg-primary-50 hover:bg-primary-100"
                    >
                      {busyKey === `ledger-${fund.fund_id}` ? 'Loading…' : 'Ledger'}
                    </button>
                    <button
                      onClick={() => deleteFund(fund)}
                      disabled={busyKey === `delete-${fund.fund_id}`}
                      className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded bg-red-50 hover:bg-red-100 inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} /> {busyKey === `delete-${fund.fund_id}` ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {funds.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-6">No funds available</td></tr>}
          </tbody>
        </table>
      </div>

      {ledgerFundId && ledgerData && (
        <div className="glass rounded-xl p-5 border border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Incoming Allocations (Fund #{ledgerFundId})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {ledgerData.incoming_allocations.map((row) => (
                <div key={row.allocation_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">{fmt(row.allocated_amount)} • {row.is_spent ? 'Spent' : 'Unspent'}</p>
                  <p>Txn: {row.transaction_id}</p>
                </div>
              ))}
              {ledgerData.incoming_allocations.length === 0 && <p className="text-sm text-slate-400">No incoming allocations.</p>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Approved Expenses (Fund #{ledgerFundId})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {ledgerData.approved_expenses.map((row) => (
                <div key={row.expense_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">{fmt(row.amount_spent)} • {row.vendor_name || 'Expense'}</p>
                  <p>{row.purpose || 'No purpose provided'}</p>
                </div>
              ))}
              {ledgerData.approved_expenses.length === 0 && <p className="text-sm text-slate-400">No approved expenses.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
