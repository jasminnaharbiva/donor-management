import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Heart, Search, RefreshCw, Download } from 'lucide-react';

interface Donor {
  donor_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  donor_type: string;
  lifetime_value: number;
  last_donation_date: string;
  created_at: string;
}

export default function DonorsPanel() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get(`/donors?page=${p}&limit=25`);
      setDonors(res.data.data);
      setTotal(res.data.meta?.total || 0);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  const handleExport = async () => {
    try {
      const res = await api.get('/reports/donors?format=csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donors_${Date.now()}.csv`;
      a.click();
    } catch { alert('Export failed'); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';

  const filtered = donors.filter(d =>
    `${d.first_name} ${d.last_name} ${d.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Heart className="text-primary-500" /> Donor CRM</h2>
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
        <div className="mb-4 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Name</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Email</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Type</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Lifetime Value</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Last Donation</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(d => (
                <tr key={d.donor_id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-medium text-slate-800">{d.first_name} {d.last_name}</td>
                  <td className="py-3 px-3 text-slate-600 text-sm">{d.email}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs">{d.donor_type}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-green-700">{fmt(d.lifetime_value)}</td>
                  <td className="py-3 px-3 text-slate-500">{fmtDate(d.last_donation_date)}</td>
                  <td className="py-3 px-3 text-slate-500">{fmtDate(d.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No donors found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} total donors</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Prev</button>
            <span className="px-3 py-1">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={donors.length < 25} className="px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
