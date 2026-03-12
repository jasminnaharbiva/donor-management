import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Activity, Search, RefreshCw } from 'lucide-react';

interface AuditLog {
  log_id: number;
  table_affected: string;
  record_id: string;
  action_type: string;
  actor_email: string;
  actor_role: string;
  ip_address: string;
  timestamp: string;
  new_payload: any;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-primary-100 text-primary-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-purple-100 text-purple-700',
  APPROVE: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-orange-100 text-orange-700',
  EXPORT: 'bg-slate-100 text-slate-700',
  REFUND: 'bg-pink-100 text-pink-700',
};

export default function AuditLogsFull() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/admin/audit').then(r => setLogs(r.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      (l.actor_email || '').includes(search) ||
      l.table_affected.includes(search) ||
      l.record_id?.includes(search);
    const matchFilter = !filter || l.action_type === filter;
    return matchSearch && matchFilter;
  });

  const fmtDate = (d: string) => new Date(d).toLocaleString();

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Activity className="text-primary-500" /> Audit Logs</h2>
        <button onClick={load} className="flex items-center justify-center sm:justify-start gap-2 text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:text-primary-600">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Search by email, table, or record ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="">All Actions</option>
            {['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'APPROVE', 'REJECT', 'EXPORT', 'REFUND'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Time</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Action</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Table</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Record</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Actor</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(log => (
                <tr key={log.log_id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(log.timestamp)}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[log.action_type] || 'bg-slate-100 text-slate-600'}`}>
                      {log.action_type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-700 font-mono text-xs">{log.table_affected?.replace('dfb_', '')}</td>
                  <td className="py-2 px-3 text-slate-500 text-xs font-mono">{(log.record_id || '').substring(0, 12)}{(log.record_id || '').length > 12 ? '…' : ''}</td>
                  <td className="py-2 px-3 text-slate-700 text-xs">{log.actor_email || log.actor_role || '—'}</td>
                  <td className="py-2 px-3 text-slate-500 text-xs font-mono">{log.ip_address || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3">Showing last 500 entries. Append-only ledger — no entry can be modified.</p>
      </div>
    </div>
  );
}
