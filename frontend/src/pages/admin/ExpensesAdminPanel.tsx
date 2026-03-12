import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, BarChart3, CheckCircle, XCircle, Search, Download, RefreshCw } from 'lucide-react';

interface Expense {
  expense_id: string;
  vendor_name: string;
  purpose: string;
  amount_spent: number;
  fund_name: string;
  volunteer_name: string;
  status: string;
  spent_timestamp: string;
  approved_at: string;
  receipt_url: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function ExpensesAdminPanel() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');

  const load = async (s = statusFilter) => {
    setLoading(true);
    try {
      const res = await api.get(`/expenses?status=${s}&limit=50`);
      setExpenses(res.data.data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const approve = async (id: string) => {
    setActingOn(id);
    try {
      await api.post(`/expenses/${id}/approve`);
      await load();
    } catch (e: any) { alert(e.response?.data?.message || 'Approve failed'); }
    setActingOn(null);
  };

  const reject = async (id: string) => {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    setActingOn(id);
    try {
      await api.post(`/expenses/${id}/reject`, { reason });
      await load();
    } catch { alert('Reject failed'); }
    setActingOn(null);
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/reports/expenses?format=csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `expenses_${Date.now()}.csv`; a.click();
    } catch { alert('Export failed'); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';

  const filtered = expenses.filter(e =>
    `${e.vendor_name} ${e.purpose} ${e.fund_name} ${e.volunteer_name}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><BarChart3 className="text-primary-500" /> Expense Approval</h2>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button onClick={() => load()} className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Vendor / Purpose</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Amount</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Fund</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Volunteer</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Date</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Status</th>
                {statusFilter === 'pending' && <th className="py-3 px-3 font-semibold text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(e => (
                <tr key={e.expense_id} className="hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-800">{e.vendor_name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-48">{e.purpose}</div>
                    {e.receipt_url && (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">View Receipt</a>
                    )}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800">{fmt(e.amount_spent)}</td>
                  <td className="py-3 px-3 text-slate-600 text-xs">{e.fund_name}</td>
                  <td className="py-3 px-3 text-slate-600 text-sm">{e.volunteer_name || '—'}</td>
                  <td className="py-3 px-3 text-slate-500 text-xs">{fmtDate(e.spent_timestamp)}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[e.status]}`}>{e.status}</span>
                  </td>
                  {statusFilter === 'pending' && (
                    <td className="py-3 px-3">
                      <div className="flex gap-2">
                        <button onClick={() => approve(e.expense_id)} disabled={actingOn === e.expense_id}
                          className="flex items-center gap-1 text-green-700 hover:text-green-800 text-xs px-2 py-1 border border-green-200 rounded bg-green-50">
                          {actingOn === e.expense_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Approve
                        </button>
                        <button onClick={() => reject(e.expense_id)} disabled={actingOn === e.expense_id}
                          className="flex items-center gap-1 text-red-700 hover:text-red-800 text-xs px-2 py-1 border border-red-200 rounded bg-red-50">
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No expenses found for "{statusFilter}" status</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
