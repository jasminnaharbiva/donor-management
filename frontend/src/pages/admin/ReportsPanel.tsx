import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, BarChart3, Download, TrendingUp, DollarSign, Users, Clock } from 'lucide-react';

export default function ReportsPanel() {
  const [ledger, setLedger] = useState<any>(null);
  const [volunteerStats, setVolunteerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/reports/ledger'),
      api.get('/reports/volunteers'),
    ]).then(([l, v]) => {
      setLedger(l.data.data);
      setVolunteerStats(v.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleExport = async (type: string) => {
    setExporting(type);
    try {
      const res = await api.get(`/reports/${type}?format=csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${type}_${Date.now()}.csv`; a.click();
    } catch { alert(`Export failed for ${type}`); }
    setExporting(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  const s = ledger?.summary || {};

  return (
    <div className="space-y-6">
      <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><BarChart3 className="text-primary-500" /> Reports & Analytics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5 border-l-4 border-green-500">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="text-green-600" size={20} /><span className="text-sm text-slate-500 font-medium">Total Income</span></div>
          <p className="text-xl sm:text-2xl font-bold text-green-700">{fmt(s.totalIncome)}</p>
        </div>
        <div className="glass rounded-xl p-5 border-l-4 border-red-400">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="text-red-500" size={20} /><span className="text-sm text-slate-500 font-medium">Total Spent</span></div>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{fmt(s.totalExpenses)}</p>
        </div>
        <div className="glass rounded-xl p-5 border-l-4 border-amber-400">
          <div className="flex items-center gap-3 mb-2"><Clock className="text-amber-500" size={20} /><span className="text-sm text-slate-500 font-medium">Pending Expenses</span></div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">{fmt(s.pendingExpenses)}</p>
        </div>
        <div className="glass rounded-xl p-5 border-l-4 border-primary-500">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="text-primary-600" size={20} /><span className="text-sm text-slate-500 font-medium">Net Balance</span></div>
          <p className={`text-2xl font-bold ${s.netBalance >= 0 ? 'text-primary-700' : 'text-red-600'}`}>{fmt(s.netBalance)}</p>
        </div>
      </div>

      {/* Export Section */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold text-slate-700 mb-4 text-lg">Data Exports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'donations', label: 'Donations Ledger', desc: 'All income transactions with donor info' },
            { key: 'donors', label: 'Donor CRM', desc: 'Full donor list with lifetime values' },
            { key: 'expenses', label: 'Expense Report', desc: 'All expenses with approval status' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="p-4 border border-slate-200 rounded-xl bg-white hover:border-primary-300 transition">
              <h4 className="font-semibold text-slate-800 mb-1">{label}</h4>
              <p className="text-sm text-slate-500 mb-3">{desc}</p>
              <button
                onClick={() => handleExport(key)}
                disabled={exporting === key}
                className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg w-full justify-center disabled:opacity-50"
              >
                {exporting === key ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Export CSV
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Volunteer Hours */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2 text-lg">
          <Users className="text-purple-500" size={20} /> Volunteer Hours Summary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Volunteer</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Hours Served</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {volunteerStats.map((v: any, i: number) => (
                <tr key={i}>
                  <td className="py-2 px-3 font-medium text-slate-800">{v.name}</td>
                  <td className="py-2 px-3 text-slate-700">{v.total_hours || 0}h</td>
                  <td className="py-2 px-3 text-slate-500">{v.timesheet_count}</td>
                </tr>
              ))}
              {volunteerStats.length === 0 && (
                <tr><td colSpan={3} className="text-center py-6 text-slate-400">No approved timesheets yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
