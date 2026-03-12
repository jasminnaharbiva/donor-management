import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Activity, Filter, Download } from 'lucide-react';

interface AuditLog {
  log_id: number;
  table_affected: string;
  record_id: string;
  action_type: string;
  actor_email: string;
  actor_role: string;
  ip_address: string;
  timestamp: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/audit');
      setLogs(res.data.data);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-primary-600" size={24} />
            System Audit Logs
          </h2>
          <p className="text-sm text-slate-500 mt-1">Immutable record of all operational and financial changes</p>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm">
            <Filter size={18} /> Filter
          </button>
          <button className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Action</th>
                <th className="py-4 px-6">Actor</th>
                <th className="py-4 px-6">Resource Affected</th>
                <th className="py-4 px-6 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {logs.map((log, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-6 text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-6">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      log.action_type === 'UPDATE' ? 'bg-amber-100 text-amber-800' :
                      log.action_type === 'INSERT' ? 'bg-emerald-100 text-emerald-800' :
                      log.action_type === 'DELETE' ? 'bg-rose-100 text-rose-800' :
                      log.action_type === 'LOGIN'  ? 'bg-primary-100 text-primary-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {log.action_type}
                    </span>
                  </td>
                  <td className="py-3 px-6">
                    <div className="font-medium text-slate-800">{log.actor_email || 'System'}</div>
                    <div className="text-xs text-slate-500">{log.actor_role}</div>
                  </td>
                  <td className="py-3 px-6">
                    <div className="font-medium text-slate-700">{log.table_affected}</div>
                    <div className="text-xs text-slate-500 font-mono">ID: {log.record_id}</div>
                  </td>
                  <td className="py-3 px-6 text-right text-slate-500 font-mono text-xs">
                    {log.ip_address}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">No logs generated yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
