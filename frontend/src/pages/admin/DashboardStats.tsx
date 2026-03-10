import { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  TrendingUp, Users, Target, Activity,
  CreditCard, Heart, CheckCircle, DollarSign, UserCheck,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function StatCard({
  label, value, sub, icon, colorClass, trend,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  colorClass: string; trend?: string;
}) {
  return (
    <div className={`glass rounded-xl p-5 border-l-4 ${colorClass} flex items-start gap-4`}>
      <div className="p-3 rounded-xl bg-white/60 shadow-sm shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        {trend && <p className="text-xs font-medium text-green-600 mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('amount') ? fmtFull(p.value) : p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardStats() {
  const [stats, setStats] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/reports/ledger'),
      api.get('/dashboard/live-feed'),
    ]).then(([s, l, f]) => {
      setStats(s.data.data);
      setLedger(l.data.data);
      const feed = f.data.data || [];
      setRecentTxns(feed);

      // Build monthly chart data from ledger transactions
      const txns: any[] = l.data.data?.transactions || [];
      const monthMap: Record<string, { month: string; amount: number; count: number }> = {};
      txns.forEach((t: any) => {
        const d = new Date(t.transaction_date || t.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (!monthMap[key]) monthMap[key] = { month: label, amount: 0, count: 0 };
        monthMap[key].amount += Number(t.net_amount || t.amount || 0);
        monthMap[key].count += 1;
      });
      const sorted = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
      setMonthlyData(sorted.map(([, v]) => v));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-xl" />
          <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const totalRaised = ledger?.summary?.totalIncome || 0;
  const totalDeployed = ledger?.summary?.totalExpenses || 0;
  const pendingExp = ledger?.summary?.pendingExpenses || 0;
  const approvedExp = ledger?.summary?.approvedExpenses || 0;
  const netBalance = totalRaised - totalDeployed;

  const fundBreakdown = (ledger?.fundBreakdown || []).map((f: any, i: number) => ({
    name: f.fund_name,
    value: Number(f.current_balance || 0),
    fill: COLORS[i % COLORS.length],
    target: Number(f.target_goal || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Mission Control Overview</h2>
        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Live Data</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Raised" value={fmt(totalRaised)} sub={fmtFull(totalRaised)} icon={<TrendingUp className="text-green-600" size={22} />} colorClass="border-green-500" trend="↑ All time" />
        <StatCard label="Total Donors" value={String(stats?.total_donors || 0)} sub="Registered" icon={<Users className="text-blue-600" size={22} />} colorClass="border-blue-500" />
        <StatCard label="Active Campaigns" value={String(stats?.active_campaigns || 0)} sub="Running now" icon={<Target className="text-purple-600" size={22} />} colorClass="border-purple-500" />
        <StatCard label="Pending Expenses" value={fmtFull(pendingExp)} sub="Awaiting approval" icon={<CreditCard className="text-amber-600" size={22} />} colorClass="border-amber-500" />
        <StatCard label="Volunteers" value={String(stats?.total_volunteers || 0)} sub="Active members" icon={<UserCheck className="text-cyan-600" size={22} />} colorClass="border-cyan-500" />
        <StatCard label="Donations" value={String(stats?.total_donations || 0)} sub="All transactions" icon={<Heart className="text-rose-500" size={22} />} colorClass="border-rose-500" />
        <StatCard label="Approved Expenses" value={fmtFull(approvedExp)} sub="Disbursed" icon={<CheckCircle className="text-emerald-600" size={22} />} colorClass="border-emerald-500" />
        <StatCard label="Net Balance" value={fmt(netBalance)} sub={fmtFull(netBalance)} icon={<DollarSign className="text-indigo-600" size={22} />} colorClass="border-indigo-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly Trend - Area Chart */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Monthly Donation Trend</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" name="amount" stroke="#6366f1" strokeWidth={2} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No transaction data yet</div>
          )}
        </div>

        {/* Fund Distribution - Pie Chart */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Fund Distribution</h3>
          {fundBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={fundBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {fundBreakdown.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtFull(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {fundBreakdown.slice(0, 4).map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.fill }} />
                      <span className="text-slate-600 truncate max-w-[110px]">{f.name}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{fmt(f.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No fund data yet</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Donation Count Bar Chart */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Donations per Month (Count)</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Donations" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Live Feed */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="text-green-500" size={18} /> Live Feed
          </h3>
          <div className="space-y-2 overflow-y-auto max-h-48">
            {recentTxns.slice(0, 8).map((txn: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{txn.payment_method || 'Donation'}</p>
                  <p className="text-xs text-slate-400 truncate">{txn.fund_name || 'General Fund'}</p>
                </div>
                <span className="text-sm font-bold text-green-600 shrink-0 ml-2">+{fmt(txn.net_amount || txn.amount || 0)}</span>
              </div>
            ))}
            {recentTxns.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-6">No recent activity</p>
            )}
          </div>

          {/* Fund Balance Bars */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Fund Progress</p>
            <div className="space-y-2">
              {fundBreakdown.slice(0, 3).map((fund: any, i: number) => {
                const pct = fund.target > 0 ? Math.min(100, (fund.value / fund.target) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600 truncate max-w-[120px]">{fund.name}</span>
                      <span className="text-slate-400">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fund.fill }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
