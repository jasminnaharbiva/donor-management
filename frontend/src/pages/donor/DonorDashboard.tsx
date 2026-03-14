import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { Heart, Trophy, RefreshCw, Activity, Bell, Loader2, CheckCircle, XCircle, Plus, DollarSign, Calendar, Calculator, Globe, Shield, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import ZakatCalculator from '../../components/ZakatCalculator';
import DonorRecordsPage from './DonorRecordsPage';
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
            <p className="text-xl sm:text-2xl font-bold text-slate-800">{fmt(stats.lifetime)}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-purple-500">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-full shrink-0"><Activity size={26} /></div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Active Subscriptions</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800">{stats.active_subs}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-6 flex items-center gap-4 border-l-4 border-amber-500">
          <div className="p-4 bg-amber-100 text-amber-600 rounded-full shrink-0"><Trophy size={26} /></div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Badges Earned</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800">{badges.length}</p>
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
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Bell className="text-primary-500" /> Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map(n => (
                <li key={n.id} className={`p-3 rounded-lg border text-sm transition cursor-pointer ${n.is_read ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-primary-50 border-primary-200 text-slate-700'}`}
                  onClick={() => !n.is_read && markRead(n.id)}>
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-xs mt-0.5">{n.message}</p>
                  {!n.is_read && <span className="text-xs text-primary-600 font-medium">Click to mark read</span>}
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
      <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Heart className="text-primary-500" /> My Donation History</h2>
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
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
      <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><RefreshCw className="text-purple-500" /> Recurring Subscriptions</h2>
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

function Pledges() {
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [funds, setFunds] = useState<any[]>([]);
  const [form, setForm] = useState({ fundId: '', totalAmount: '', installmentCount: '12', frequency: 'monthly' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/pledges').catch(() => ({ data: { data: [] } })),
      api.get('/funds').catch(() => ({ data: { data: [] } })),
    ]).then(([p, f]) => {
      setPledges(p.data.data || []);
      setFunds(f.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const submitPledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.totalAmount || Number(form.totalAmount) <= 0 || !form.fundId) return;
    setSubmitting(true);
    try {
      await api.post('/pledges', {
        fundId: Number(form.fundId),
        totalPledgeAmount: Number(form.totalAmount),
        installmentCount: Number(form.installmentCount),
        frequency: form.frequency
      });
      alert('Pledge created successfully!');
      setForm({ fundId: '', totalAmount: '', installmentCount: '12', frequency: 'monthly' });
      const p = await api.get('/pledges');
      setPledges(p.data.data || []);
    } catch {
      alert('Failed to create pledge.');
    }
    setSubmitting(false);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="text-primary-500" size={18} /> Make a Commitment
            </h3>
            <p className="text-sm text-slate-500 mb-4">Pledges allow you to commit to a larger total amount today, but pay it in smaller installments over time.</p>
            <form onSubmit={submitPledge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fund</label>
                <select required value={form.fundId} onChange={e => setForm(f => ({ ...f, fundId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                  <option value="">Select a Fund</option>
                  {funds.map(f => <option key={f.fund_id} value={f.fund_id}>{f.fund_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Pledge Amount (USD)</label>
                <input required type="number" min="1" step="0.01" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} 
                  placeholder="e.g. 5000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Total Installments</label>
                  <input required type="number" min="1" max="120" value={form.installmentCount} onChange={e => setForm(f => ({ ...f, installmentCount: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50 transition">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />} 
                {submitting ? 'Processing...' : 'Create Pledge'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2">
            <Calendar className="text-primary-500" /> My Active Pledges
          </h2>
          <div className="space-y-3">
            {pledges.map(p => {
              const remaining = Number(p.total_pledge_amount) - Number(p.amount_fulfilled);
              const progressPct = Math.min(100, (Number(p.amount_fulfilled) / Number(p.total_pledge_amount)) * 100);
              return (
                <div key={p.id} className="glass rounded-xl p-5 border-l-4 border-primary-500">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-lg">{fmt(Number(p.total_pledge_amount))} Pledge</p>
                      <p className="text-xs text-slate-500">Funded: {fmt(Number(p.amount_fulfilled))} · Remaining: {fmt(remaining)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'active' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                    <div className="bg-primary-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <RefreshCw size={12} /> {p.frequency} ({p.installments_paid}/{p.installment_count} installments paid)
                    </div>
                    {p.status === 'active' && <button className="text-primary-600 font-medium hover:underline">Make Payment</button>}
                  </div>
                </div>
              );
            })}
            {pledges.length === 0 && <div className="glass rounded-xl p-8 text-center text-slate-400">You have no active pledges.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DonorDashboard() {
  const { user } = useAuth();
  const [menuVisibility, setMenuVisibility] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    api.get('/donors/me/visibility')
      .then((res) => {
        const items = res.data?.data?.menuItems;
        if (!Array.isArray(items)) {
          setMenuVisibility(null);
          return;
        }

        const next: Record<string, boolean> = {};
        items.forEach((row: any) => {
          const key = typeof row?.key === 'string' ? row.key.trim() : '';
          if (!key) return;
          next[key] = row.enabled !== false;
        });
        setMenuVisibility(next);
      })
      .catch(() => setMenuVisibility(null));
  }, []);

  const menuItems = useMemo(() => {
    const baseMenuItems = [
      { key: 'overview', name: 'Overview', path: '/donor/overview', icon: <Activity size={20} /> },
      { key: 'impact', name: 'My Impact', path: '/donor/impact', icon: <TrendingUp size={20} /> },
      { key: 'history', name: 'Donation History', path: '/donor/history', icon: <Heart size={20} /> },
      { key: 'records', name: 'My Records', path: '/donor/records', icon: <Trophy size={20} /> },
      { key: 'pledges', name: 'Pledges', path: '/donor/pledges', icon: <Calendar size={20} /> },
      { key: 'p2p', name: 'Create Fundraiser', path: '/donor/fundraiser', icon: <Globe size={20} /> },
      { key: 'zakat', name: 'Zakat Calculator', path: '/donor/zakat', icon: <Calculator size={20} /> },
      { key: 'subscriptions', name: 'Subscriptions', path: '/donor/billing', icon: <RefreshCw size={20} /> },
      { key: 'notifications', name: 'Notifications', path: '/donor/notifications', icon: <Bell size={20} /> },
      { key: 'account', name: 'My Account / GDPR', path: '/donor/account', icon: <Shield size={20} /> },
    ];

    return baseMenuItems
      .filter((item) => {
        if (!menuVisibility) return true;
        if (menuVisibility[item.key] === undefined) return true;
        return menuVisibility[item.key] !== false;
      })
      .map(({ key: _key, ...item }) => item);
  }, [menuVisibility]);

  return (
    <DashboardLayout title="Donor Portal" role={user?.role || 'Donor'} menuItems={menuItems}>
      <Routes>
        <Route path="/" element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="impact" element={<MyImpact />} />
        <Route path="history" element={<DonationHistory />} />
        <Route path="records" element={<DonorRecordsPage />} />
        <Route path="pledges" element={<Pledges />} />
        <Route path="fundraiser" element={<P2PFundraiser />} />
        <Route path="zakat" element={<div className="max-w-4xl mx-auto"><ZakatCalculator /></div>} />
        <Route path="billing" element={<Subscriptions />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="account" element={<MyAccount />} />
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
        <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Bell className="text-primary-500" /> All Notifications</h2>
        {notes.some(n => !n.is_read) && (
          <button onClick={markAll} className="text-sm text-primary-600 hover:underline flex items-center gap-1"><CheckCircle size={14} /> Mark all read</button>
        )}
      </div>
      <div className="space-y-2">
        {notes.map(n => (
          <div key={n.id} className={`glass rounded-lg p-4 border-l-4 ${n.is_read ? 'border-slate-200' : 'border-primary-400'}`}>
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

// ---------------------------------------------------------------------------
// My Impact — "Where did my money go?" provenance map
// ---------------------------------------------------------------------------
function MyImpact() {
  const [data, setData] = useState<any>(null);
  const [projectUpdates, setProjectUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  useEffect(() => {
    Promise.all([
      api.get('/donors/me/impact'),
      api.get('/donors/me/project-updates').catch(() => ({ data: { data: [] } })),
    ])
      .then(([impactRes, updatesRes]) => {
        setData(impactRes.data.data);
        setProjectUpdates(updatesRes.data.data || []);
      })
      .catch(() => setError('Could not load impact data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32}/></div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (!data) return null;

  const { summary, donations, visibility } = data;
  const hasSummary = Boolean(summary);
  const updateVisibility = visibility?.updateFields || {};
  const impactSections = Array.isArray(visibility?.impactSections) ? visibility.impactSections : [];
  const isSectionEnabled = (id: string) => {
    const row = impactSections.find((item: any) => item?.id === id);
    return row ? row.enabled !== false : true;
  };
  const canSeeAllocationBreakdown = isSectionEnabled('allocation_breakdown');
  const canSeeApprovedUpdates = isSectionEnabled('approved_updates');
  const deployedPct = hasSummary && summary.total_donated > 0 ? Math.round((summary.total_deployed / summary.total_donated) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><TrendingUp className="text-green-500"/> Where Did My Money Go?</h2>

      {/* Summary cards */}
      {hasSummary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Donated', val: fmt(summary.total_donated), color: 'bg-primary-50 border-primary-200' },
              { label: 'Deployed to Programs', val: fmt(summary.total_deployed), color: 'bg-green-50 border-green-200' },
              { label: 'Pending Deployment', val: fmt(summary.total_pending), color: 'bg-yellow-50 border-yellow-200' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">{c.val}</p>
              </div>
            ))}
          </div>

          {/* Deployment progress bar */}
          <div className="glass rounded-xl p-4 border border-slate-200">
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>Money Deployed</span><span className="font-semibold">{deployedPct}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${deployedPct}%` }}/>
            </div>
          </div>
        </>
      ) : (
        <div className="glass rounded-xl p-4 border border-slate-200 text-sm text-slate-500">Summary is currently hidden by admin visibility settings.</div>
      )}

      {/* Per-donation breakdown */}
      {canSeeAllocationBreakdown ? (
        <>
          {donations.length === 0 && <div className="text-center py-8 text-slate-400">No donations yet.</div>}
          {donations.map((don: any) => (
            <div key={don.transaction_id} className="glass rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 flex flex-wrap gap-3 justify-between items-center">
                <div>
                  <span className="font-semibold text-slate-800">{fmt(don.amount)}</span>
                  <span className="ml-2 text-sm text-slate-500">→ {don.fund?.fund_name}</span>
                </div>
                <span className="text-xs text-slate-400">{new Date(don.donated_at).toLocaleDateString()}</span>
              </div>
              <div className="p-4 space-y-2">
                {don.allocations.length === 0 && <p className="text-sm text-slate-400 italic">Allocation in progress…</p>}
                {don.allocations.map((al: any) => (
                  <div key={al.allocation_id} className={`flex items-start gap-3 p-3 rounded-lg ${al.is_spent ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
                    <div className="mt-0.5">{al.is_spent ? <CheckCircle size={16} className="text-green-500"/> : <DollarSign size={16} className="text-yellow-500"/>}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{fmt(al.allocated_amount)} — {al.is_spent ? 'Deployed' : 'Allocated (pending deployment)'}</p>
                      {al.expense && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {al.expense.purpose} {al.expense.spent_on ? `• ${new Date(al.expense.spent_on).toLocaleDateString()}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="glass rounded-xl p-4 border border-slate-200 text-sm text-slate-500">Allocation breakdown is currently hidden by admin visibility settings.</div>
      )}

      {canSeeApprovedUpdates && (
      <div className="glass rounded-xl p-5 border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-3">Approved Field Updates & Photos</h3>
        {projectUpdates.length === 0 ? (
          <p className="text-sm text-slate-500">No approved field updates yet.</p>
        ) : (
          <div className="space-y-4">
            {projectUpdates.map((item: any) => (
              <div key={item.update_id} className="rounded-lg border border-slate-200 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800 text-sm">{item.update_title || item.narrative}</p>
                  <span className="text-xs text-slate-500">{item.approved_at ? new Date(item.approved_at).toLocaleDateString() : 'Approved'}</span>
                </div>
                {updateVisibility.showProjectLocation !== false && <p className="text-xs text-slate-500 mt-1">{item.project_name}{item.location_city ? ` · ${item.location_city}, ${item.location_country}` : ''}</p>}
                {updateVisibility.showDetails !== false && item.update_details && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{item.update_details}</p>}
                {updateVisibility.showPhotos !== false && Array.isArray(item.photo_urls) && item.photo_urls.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Photos: {item.photo_urls.slice(0, 5).map((url: string, idx: number) => (
                      <span key={`${item.update_id}-photo-${idx}`}>{idx > 0 ? ' · ' : ''}<a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">#{idx + 1}</a></span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// P2P Fundraiser — donor creates peer-to-peer fundraising campaigns
// ---------------------------------------------------------------------------
function P2PFundraiser() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [funds, setFunds] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', personal_story: '', goal_amount: '', end_date: '', fund_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const load = () => {
    Promise.all([
      api.get('/p2p').catch(() => ({ data: { data: [] } })),
      api.get('/funds').catch(() => ({ data: { data: [] } })),
    ]).then(([p, f]) => {
      setCampaigns(p.data.data || []);
      setFunds(f.data.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.goal_amount || !form.end_date || !form.fund_id) { setError('Please fill all required fields.'); return; }
    setSubmitting(true); setError('');
    try {
      await api.post('/p2p', {
        title: form.title,
        personal_story: form.personal_story,
        goal_amount: Number(form.goal_amount),
        end_date: form.end_date,
        fund_id: Number(form.fund_id),
      });
      setSuccess(true);
      setForm({ title: '', personal_story: '', goal_amount: '', end_date: '', fund_id: '' });
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" size={32}/></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Globe className="text-primary-500"/> Create a Fundraiser</h2>

      {/* Create form */}
      <div className="glass rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-4">Start a Peer-to-Peer Campaign</h3>
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><CheckCircle size={16}/> Campaign created successfully!</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><XCircle size={16}/> {error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 outline-none" placeholder="e.g. Running for Clean Water" required maxLength={200}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Fund *</label>
              <select value={form.fund_id} onChange={e => setForm(f => ({ ...f, fund_id: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 outline-none" required>
                <option value="">Select a fund…</option>
                {funds.map((f: any) => <option key={f.fund_id} value={f.fund_id}>{f.fund_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Goal Amount (USD) *</label>
              <input type="number" min={10} value={form.goal_amount} onChange={e => setForm(f => ({ ...f, goal_amount: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 outline-none" placeholder="1000" required/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 outline-none" required min={new Date().toISOString().split('T')[0]}/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Personal Story</label>
            <textarea rows={3} value={form.personal_story} onChange={e => setForm(f => ({ ...f, personal_story: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 outline-none" placeholder="Tell potential donors why this cause matters to you…" maxLength={2000}/>
          </div>
          <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
            {submitting ? <><Loader2 size={14} className="animate-spin"/> Creating…</> : <><Plus size={14}/> Create Fundraiser</>}
          </button>
        </form>
      </div>

      {/* My campaigns */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-700">My Campaigns</h3>
          {campaigns.map((c: any) => {
            const pct = c.goal_amount > 0 ? Math.min(100, Math.round((Number(c.raised_amount || 0) / Number(c.goal_amount)) * 100)) : 0;
            return (
              <div key={c.p2p_id} className="glass rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800">{c.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.personal_story?.slice(0, 120)}{c.personal_story?.length > 120 ? '…' : ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{fmt(Number(c.raised_amount || 0))} raised</span><span>Goal: {fmt(Number(c.goal_amount))}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-primary-500 h-2 rounded-full" style={{ width: `${pct}%` }}/></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Account — GDPR data export and right to be forgotten
// ---------------------------------------------------------------------------
function MyAccount() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { logout } = useAuth();

  const downloadData = async () => {
    setExporting(true); setMessage(''); setError('');
    try {
      const response = await api.get('/donors/me/export', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setMessage('Your data export has been downloaded.');
    } catch {
      setError('Could not export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmDelete !== 'DELETE MY ACCOUNT') { setError('Please type the confirmation text exactly.'); return; }
    setDeleting(true); setError('');
    try {
      await api.delete('/donors/me');
      setMessage('Your account has been anonymised. You will be logged out.');
      setTimeout(() => logout(), 3000);
    } catch {
      setError('Could not process request. Contact support.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Shield className="text-primary-500"/> My Account &amp; Data Rights</h2>

      {message && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><CheckCircle size={16}/>{message}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><XCircle size={16}/>{error}</div>}

      {/* GDPR Article 20 — Data portability */}
      <div className="glass rounded-xl border border-primary-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-2">📦 Download Your Data</h3>
        <p className="text-sm text-slate-600 mb-4">Under GDPR Article 20, you have the right to receive all personal data we hold about you in a portable, machine-readable format (JSON). This includes your profile, donation history, pledges, and notification history.</p>
        <button onClick={downloadData} disabled={exporting} className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
          {exporting ? <><Loader2 size={14} className="animate-spin"/> Preparing…</> : '⬇️ Download My Data (JSON)'}
        </button>
      </div>

      {/* GDPR Article 17 — Right to be forgotten */}
      <div className="glass rounded-xl border border-red-200 p-6">
        <h3 className="font-semibold text-red-700 mb-2">🗑️ Right to Be Forgotten</h3>
        <p className="text-sm text-slate-600 mb-3">Under GDPR Article 17, you may request deletion of your personal data. Your donation records will be retained for legal/financial compliance but all personally identifiable information will be anonymised immediately. <strong className="text-red-600">This action is irreversible.</strong></p>
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700 mb-2">Type <strong>DELETE MY ACCOUNT</strong> to confirm:</p>
          <input type="text" value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} className="w-full border border-red-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-400 outline-none" placeholder="DELETE MY ACCOUNT"/>
        </div>
        <button onClick={deleteAccount} disabled={deleting || confirmDelete !== 'DELETE MY ACCOUNT'} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
          {deleting ? <><Loader2 size={14} className="animate-spin"/> Processing…</> : '🗑️ Permanently Delete My Account'}
        </button>
      </div>
    </div>
  );
}
