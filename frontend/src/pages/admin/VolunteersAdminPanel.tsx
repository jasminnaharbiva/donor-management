import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, UserCheck, CheckCircle, Search, RefreshCw } from 'lucide-react';

interface Application {
  application_id: number;
  applicant_name: string;
  applicant_email: string;
  motivation_statement: string;
  status: string;
  submitted_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-primary-100 text-primary-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  waitlisted: 'bg-purple-100 text-purple-700',
};

export default function VolunteersAdminPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/volunteers/applications');
      setApplications(res.data.data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: number) => {
    if (!confirm('Approve this volunteer application? This will create their account.')) return;
    setActingOn(id);
    try {
      await api.post(`/volunteers/applications/${id}/approve`);
      await load();
      alert('Volunteer approved and account created.');
    } catch (e: any) { alert(e.response?.data?.message || 'Approval failed'); }
    setActingOn(null);
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';

  const filtered = applications.filter(a => {
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchSearch = !search ||
      a.applicant_name.toLowerCase().includes(search.toLowerCase()) ||
      a.applicant_email.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2"><UserCheck className="text-primary-500" /> Volunteer Management</h2>
        <button onClick={load} className="flex items-center justify-center sm:justify-start gap-2 text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search by name or email..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['pending', 'under_review', 'approved', 'rejected', 'waitlisted'].map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Applicant</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Motivation</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Status</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Applied</th>
                <th className="py-3 px-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(app => (
                <tr key={app.application_id} className="hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-800">{app.applicant_name}</div>
                    <div className="text-xs text-slate-500">{app.applicant_email}</div>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-sm text-slate-600 line-clamp-2 max-w-xs">{app.motivation_statement}</p>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[app.status]}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-xs">{fmtDate(app.submitted_at)}</td>
                  <td className="py-3 px-3">
                    {app.status === 'pending' && (
                      <button
                        onClick={() => approve(app.application_id)}
                        disabled={actingOn === app.application_id}
                        className="flex items-center gap-1 text-green-700 text-xs px-3 py-1.5 border border-green-200 rounded bg-green-50 hover:bg-green-100"
                      >
                        {actingOn === app.application_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Approve & Create Account
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">No applications found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
