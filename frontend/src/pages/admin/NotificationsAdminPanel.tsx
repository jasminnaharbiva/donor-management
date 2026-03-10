import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Bell, AlertCircle, RefreshCw, Search, CheckCheck, Megaphone } from 'lucide-react';

interface Notification {
  notification_id: number;
  recipient_email?: string;
  recipient_name?: string;
  type: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
  sent_at?: string;
  read_at?: string;
}

const TYPE_COLORS: Record<string, string> = {
  donation_received: 'bg-green-100 text-green-700',
  campaign_update: 'bg-blue-100 text-blue-700',
  volunteer_signup: 'bg-purple-100 text-purple-700',
  pledge_reminder: 'bg-yellow-100 text-yellow-700',
  system: 'bg-slate-100 text-slate-600',
  announcement: 'bg-orange-100 text-orange-700',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-600',
  sent: 'bg-green-50 text-green-700',
  read: 'bg-slate-50 text-slate-500',
  failed: 'bg-red-50 text-red-600',
};

interface BroadcastForm {
  title: string;
  message: string;
  target: string;
}

export default function NotificationsAdminPanel() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcast, setBroadcast] = useState<BroadcastForm>({ title: '', message: '', target: 'all' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { fetchData(); }, [statusFilter, page]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/notifications?${params}`);
      setRows(res.data.data || res.data || []);
      setTotal(res.data.total || 0);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load notifications');
    } finally { setLoading(false); }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.title || !broadcast.message) return;
    setSending(true);
    try {
      await api.post('/notifications/broadcast', broadcast);
      setSent(true);
      setTimeout(() => { setSent(false); setShowBroadcast(false); setBroadcast({ title: '', message: '', target: 'all' }); }, 2000);
      fetchData();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to send broadcast');
    } finally { setSending(false); }
  };

  const filtered = rows.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.recipient_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Bell size={20} className="text-primary-600" /> Notifications
          </h2>
          <p className="text-sm text-slate-500">{total} total notifications</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="read">Read</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={() => setShowBroadcast(!showBroadcast)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Megaphone size={16} /> Broadcast
          </button>
          <button onClick={fetchData} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Broadcast form */}
      {showBroadcast && (
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5">
          <h3 className="font-semibold text-primary-800 mb-3 flex items-center gap-2"><Megaphone size={18} /> Send Broadcast Notification</h3>
          <form onSubmit={handleBroadcast} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Notification title"
                value={broadcast.title}
                onChange={e => setBroadcast(p => ({ ...p, title: e.target.value }))}
                required
                className="col-span-2 px-3 py-2 border border-primary-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-white"
              />
              <textarea
                placeholder="Message body…"
                value={broadcast.message}
                onChange={e => setBroadcast(p => ({ ...p, message: e.target.value }))}
                required
                rows={3}
                className="col-span-2 px-3 py-2 border border-primary-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-white resize-none"
              />
              <select
                value={broadcast.target}
                onChange={e => setBroadcast(p => ({ ...p, target: e.target.value }))}
                className="px-3 py-2 border border-primary-300 rounded-xl text-sm outline-none bg-white"
              >
                <option value="all">All Users</option>
                <option value="donors">Donors Only</option>
                <option value="volunteers">Volunteers Only</option>
              </select>
              <div className="flex gap-2">
                <button type="submit" disabled={sending || sent}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : sent ? <CheckCheck size={16} /> : <Megaphone size={16} />}
                  {sending ? 'Sending…' : sent ? 'Sent!' : 'Send'}
                </button>
                <button type="button" onClick={() => setShowBroadcast(false)}
                  className="px-4 py-2 border border-primary-300 text-primary-700 rounded-xl text-sm hover:bg-primary-100 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by title or recipient…"
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
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Title</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Recipient</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Created</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400">No notifications found</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.notification_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800 max-w-xs truncate">{r.title}</td>
                    <td className="px-5 py-3 text-slate-600">{r.recipient_name || r.recipient_email || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[r.type] || 'bg-slate-100 text-slate-600'}`}>
                        {r.type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
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
