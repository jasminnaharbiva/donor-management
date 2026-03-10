import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { Heart, Trophy, RefreshCw, Activity, Bell, Loader2, CheckCircle, XCircle, Plus, DollarSign } from 'lucide-react';
import api from '../../services/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Badge {
  badge_name: string;
  description: string;
  icon_url: string;
  awarded_at: string;
}

interface Donation {
  id: number;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  fund_name?: string;
  campaign_title?: string;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

function Overview() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState({ lifetime: 0, active_subs: 0, pending_pledges: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [donateForm, setDonateForm] = useState({ amount: '', fundId: '', method: 'card' });
  const [funds, setFunds] = useState<any[]>([]);
  const [donating, setDonating] = useState(false);
  const [donateSuccess, setDonateSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/advanced/badges/me').catch(() => ({ data: { data: [] } })),
      api.get('/donations/my').catch(() => ({ data: { data: [] } })),
      api.get('/notifications').catch(() => ({ data: { data: [] } })),
      api.get('/pledges').catch(() => ({ data: { data: [] } })),
      api.get('/recurring').catch(() => ({ data: { data: [] } })),
      api.get('/funds').catch(() => ({ data: { data: [] } })),
    ]).then(([b, d, n, pl, r, f]) => {
      setBadges(b.data.data || []);
      setNotifications((n.data.data || []).slice(0, 5));
      const donationList: Donation[] = d.data.data || [];
      setDonations(donationList);
      const lifetime = donationList.filter((x: any) => x.status === 'completed').reduce((sum: number, x: any) => sum + parseFloat(x.amount || 0), 0);
      const active_subs = (r.data.data || []).filter((s: any) => s.status === 'active').length;
      const pending_pledges = (pl.data.data || []).filter((p: any) => p.status === 'pending').length;
      setStats({ lifetime, active_subs, pending_pledges });
      setFunds(f.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const markRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const submitDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donateForm.amount || Number(donateForm.amount) <= 0) return;
    setDonating(true);
    setDonateSuccess(false);
    try {
      await api.post('/donations', {
        amount: Number(donateForm.amount),
        paymentMethod: donateForm.method,
        fundId: donateForm.fundId ? Number(donateForm.fundId) : undefined,
      });
      setDonateSuccess(true);
      setDonateForm({ amount: '', fundId: '', method: 'card' });
      // Refresh stats
      const d = await api.get('/donations/my');
      const donationList: Donation[] = d.data.data || [];
      setDonations(donationList);
      const lifetime = donationList.filter((x: any) => x.status === 'completed').reduce((sum: number, x: any) => sum + parseFloat(x.amount || 0), 0);
      setStats(prev => ({ ...prev, lifetime }));
    } catch {
      alert('Donation failed. Please try again.');
    }
    setDonating(false);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // Build monthly chart data
  const monthMap: Record<string, { month: string; amount: number }> = {};
  donations.filter(d => d.status === 'completed').forEach(d => {
    const date = new Date(d.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    if (!monthMap[key]) monthMap[key] = { month: label, amount: 0 };
    monthMap[key].amount += Number(d.amount);
  });
  const chartData = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, v]) => v);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-primary-500">
          <div className="p-4 bg-primary-100 text-primary-600 rounded-full shrink-0"><Heart size={26} /></div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Lifetime Giving</p>
            <p className="text-2xl font-bold text-slate-800">{fmt(stats.lifetime)}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-purple-500">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-full shrink-0"><Activity size={26} /></div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Active Subscriptions</p>
            <p className="text-2xl font-bold text-slate-800">{stats.active_subs}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-amber-500">
          <div className="p-4 bg-amber-100 text-amber-600 rounded-full shrink-0"><Trophy size={26} /></div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Badges Earned</p>
            <p className="text-2xl font-bold text-slate-800">{badges.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Donation Trend Chart */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="text-primary-500" size={18} /> My Giving History (Last 6 Months)
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="donorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} />
                <Tooltip formatter={(v: any) => [fmt(Number(v)), 'Donated']} />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#donorGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Heart size={32} className="text-slate-200" />
              <p>No donations yet — make your first contribution below!</p>
            </div>
          )}
        </div>

        {/* Quick Donate */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <DollarSign className="text-green-500" size={18} /> Quick Donate
          </h3>
          {donateSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm flex items-center gap-2">
              <CheckCircle size={16} /> Donation submitted! Thank you.
            </div>
          )}
          <form onSubmit={submitDonation} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={donateForm.amount}
                  onChange={e => setDonateForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none"
                  required
                />
              </div>
              <div className="flex gap-2 mt-1.5">
                {[25, 50, 100].map(amt => (
                  <button key={amt} type="button" onClick={() => setDonateForm(f => ({ ...f, amount: String(amt) }))}
                    className="flex-1 text-xs py-1 border border-slate-200 rounded hover:bg-primary-50 hover:border-primary-300 text-slate-600 transition">
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fund</label>
              <select value={donateForm.fundId} onChange={e => setDonateForm(f => ({ ...f, fundId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                <option value="">General Fund</option>
                {funds.map(f => <option key={f.fund_id} value={f.fund_id}>{f.fund_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
              <select value={donateForm.method} onChange={e => setDonateForm(f => ({ ...f, method: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                <option value="card">Credit / Debit Card</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
            <button type="submit" disabled={donating}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50 transition">
              {donating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {donating ? 'Processing…' : 'Donate Now'}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Badges */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Trophy className="text-amber-500" /> Your Achievements</h3>
          {badges.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Make your first donation to earn a badge!</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badges.map((b, i) => (
                <div key={i} className="bg-slate-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3 hover:shadow-md transition">
                  <div className="text-3xl">{b.icon_url || '🏅'}</div>
                  <div><h4 className="font-bold text-slate-800 text-sm">{b.badge_name}</h4><p className="text-xs text-slate-500">{b.description}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Bell className="text-blue-500" /> Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map(n => (
                <li key={n.id} className={`p-3 rounded-lg border text-sm transition cursor-pointer ${n.is_read ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-blue-50 border-blue-200 text-slate-700'}`}
                  onClick={() => !n.is_read && markRead(n.id)}>
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-xs mt-0.5">{n.message}</p>
                  {!n.is_read && <span className="text-xs text-blue-600 font-medium">Click to mark read</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DonationHistory() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/donations/my').then(r => setDonations(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const statusColor: Record<string, string> = { completed: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700', failed: 'bg-red-100 text-red-600', refunded: 'bg-slate-100 text-slate-500' };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Heart className="text-primary-500" /> My Donation History</h2>
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Amount</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Fund / Campaign</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Method</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {donations.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="py-2 px-4 text-slate-500">{new Date(d.created_at).toLocaleDateString()}</td>
                <td className="py-2 px-4 font-semibold text-slate-800">{fmt(d.amount)}</td>
                <td className="py-2 px-4 text-slate-600">{d.campaign_title || d.fund_name || '—'}</td>
                <td className="py-2 px-4 text-slate-500 capitalize">{d.payment_method}</td>
                <td className="py-2 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[d.status] || 'bg-slate-100 text-slate-600'}`}>{d.status}</span></td>
              </tr>
            ))}
            {donations.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No donations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Subscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);

  useEffect(() => {
    api.get('/recurring').then(r => setSubs(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const cancel = async (id: number) => {
    if (!confirm('Cancel this subscription?')) return;
    setCancelling(id);
    await api.patch(`/recurring/${id}/cancel`).catch(console.error);
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' } : s));
    setCancelling(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><RefreshCw className="text-purple-500" /> Recurring Subscriptions</h2>
      <div className="space-y-3">
        {subs.map(s => (
          <div key={s.id} className={`glass rounded-xl p-5 flex justify-between items-center border-l-4 ${s.status === 'active' ? 'border-green-500' : 'border-slate-300'}`}>
            <div>
              <p className="font-semibold text-slate-800">{fmt(s.amount)} / {s.frequency}</p>
              <p className="text-sm text-slate-500">Fund: {s.fund_id} · Next: {s.next_run_date ? new Date(s.next_run_date).toLocaleDateString() : '—'}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
            </div>
            {s.status === 'active' && (
              <button onClick={() => cancel(s.id)} disabled={cancelling === s.id}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
                {cancelling === s.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Cancel
              </button>
            )}
          </div>
        ))}
        {subs.length === 0 && <div className="glass rounded-xl p-8 text-center text-slate-400">No recurring subscriptions.</div>}
      </div>
    </div>
  );
}

export default function DonorDashboard() {
  const { user } = useAuth();
  const menuItems = [
    { name: 'Overview', path: '/donor/overview', icon: <Activity size={20} /> },
    { name: 'Donation History', path: '/donor/history', icon: <Heart size={20} /> },
    { name: 'Subscriptions', path: '/donor/billing', icon: <RefreshCw size={20} /> },
    { name: 'Notifications', path: '/donor/notifications', icon: <Bell size={20} /> },
  ];

  return (
    <DashboardLayout title="Donor Portal" role={user?.role || 'Donor'} menuItems={menuItems}>
      <Routes>
        <Route path="/" element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="history" element={<DonationHistory />} />
        <Route path="billing" element={<Subscriptions />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Routes>
    </DashboardLayout>
  );
}

function NotificationsPage() {
  const [notes, setNotes] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then(r => setNotes(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const markAll = async () => {
    await api.patch('/notifications/read-all');
    setNotes(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Bell className="text-blue-500" /> All Notifications</h2>
        {notes.some(n => !n.is_read) && (
          <button onClick={markAll} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><CheckCircle size={14} /> Mark all read</button>
        )}
      </div>
      <div className="space-y-2">
        {notes.map(n => (
          <div key={n.id} className={`glass rounded-lg p-4 border-l-4 ${n.is_read ? 'border-slate-200' : 'border-blue-400'}`}>
            <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
            <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
            <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        ))}
        {notes.length === 0 && <div className="text-center py-8 text-slate-400">No notifications yet.</div>}
      </div>
    </div>
  );
}
