import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, RefreshCw, AlertCircle, Search, CalendarClock } from 'lucide-react';

interface RecurringDonation {
  recurring_id: number;
  donor_name?: string;
  campaign_title?: string;
  amount: number;
  currency: string;
  frequency: string;
  next_payment_date: string;
  status: string;
  total_paid: number;
  payment_count: number;
  start_date: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-primary-100 text-primary-700',
};

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', bi_weekly: 'Bi-Weekly',
  monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually',
};

function fmt(n: number, cur = 'BDT') {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: cur }).format(n);
}

export default function RecurringPanel() {
  const [rows, setRows] = useState<RecurringDonation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);

  useEffect(() => { fetchData(); }, [status, page]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api.get(`/recurring?${params}`);
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load recurring donations');
    } finally { setLoading(false); }
  };

  const filtered = rows.filter(r =>
    r.donor_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.campaign_title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2">
            <CalendarClock size={20} className="text-primary-600" /> Recurring Donations
          </h2>
          <p className="text-sm text-slate-500 text-center sm:text-left">{total} total records</p>
        </div>
        <div className="flex items-center justify-center sm:justify-start gap-3 w-full sm:w-auto">
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={fetchData} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by donor or campaign…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Donor</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Campaign</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Frequency</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Total Paid</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Next Payment</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No recurring donations found</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.recurring_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{r.donor_name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{r.campaign_title || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(r.amount, r.currency)}</td>
                    <td className="px-5 py-3 text-slate-600">{FREQ_LABELS[r.frequency] || r.frequency}</td>
                    <td className="px-5 py-3 text-right text-green-700">{fmt(r.total_paid || 0, r.currency)}</td>
                    <td className="px-5 py-3 text-slate-500">{r.next_payment_date ? new Date(r.next_payment_date).toLocaleDateString() : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-600'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 20 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
              <span>Page {page} of {Math.ceil(total / 20)}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
                  className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
