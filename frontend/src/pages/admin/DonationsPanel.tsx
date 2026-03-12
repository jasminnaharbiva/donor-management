import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, DollarSign, Download, Search, RefreshCw } from 'lucide-react';

interface Donation {
  transaction_id: string;
  first_name: string;
  last_name: string;
  email: string;
  amount: number;
  net_amount: number;
  currency: string;
  payment_method: string;
  gateway_fee: number;
  status: string;
  settled_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  Completed: 'bg-green-100 text-green-700',
  Pending: 'bg-amber-100 text-amber-700',
  Failed: 'bg-red-100 text-red-700',
  Refunded: 'bg-primary-100 text-primary-700',
  Flagged: 'bg-purple-100 text-purple-700',
};

export default function DonationsPanel() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (p = page, s = status) => {
    setLoading(true);
    try {
      let url = `/donations?page=${p}&limit=25`;
      if (s) url += `&status=${s}`;
      const res = await api.get(url);
      setDonations(res.data.data);
      setTotal(res.data.meta?.total || 0);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, status]);

  const handleExport = async () => {
    try {
      const res = await api.get('/reports/donations?format=csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donations_${Date.now()}.csv`;
      a.click();
    } catch { alert('Export failed'); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleString() : '—';

  const filtered = donations.filter(d =>
    `${d.first_name} ${d.last_name} ${d.email} ${d.transaction_id}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><DollarSign className="text-primary-500" /> Donations Ledger</h2>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button onClick={() => load()} className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search by name, email, or ID..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['Completed', 'Pending', 'Failed', 'Refunded', 'Flagged'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Transaction</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Donor</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Amount</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Net</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Method</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Status</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(d => (
                <tr key={d.transaction_id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-xs text-slate-500">{d.transaction_id?.substring(0, 12)}…</td>
                  <td className="py-2 px-3 text-slate-800">{d.first_name} {d.last_name}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800">{fmt(d.amount)}</td>
                  <td className="py-2 px-3 text-green-700 font-semibold">{fmt(d.net_amount)}</td>
                  <td className="py-2 px-3 text-slate-500 capitalize">{d.payment_method}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-600'}`}>{d.status}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-500 text-xs">{fmtDate(d.settled_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No donations found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} total donations</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Prev</button>
            <span className="px-3 py-1">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={donations.length < 25} className="px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
