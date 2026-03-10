import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, TrendingUp, Users, Target, Activity, BarChart2, CreditCard } from 'lucide-react';

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`glass rounded-xl p-6 flex items-center gap-4 border-l-4 ${color}`}>
      <div className="p-3 bg-white/70 rounded-xl shadow-sm">{icon}</div>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardStats() {
  const [stats, setStats] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/reports/ledger'),
      api.get('/dashboard/live-feed'),
    ]).then(([s, l, f]) => {
      setStats(s.data.data);
      setLedger(l.data.data);
      setRecentTxns(f.data.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Mission Control Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Raised" value={fmt(ledger?.summary?.totalIncome || 0)} icon={<TrendingUp className="text-green-600" size={24} />} color="border-green-500" />
        <StatCard label="Total Donors" value={String(stats?.total_donors || 0)} icon={<Users className="text-blue-600" size={24} />} color="border-blue-500" />
        <StatCard label="Active Campaigns" value={String(stats?.active_campaigns || 0)} icon={<Target className="text-purple-600" size={24} />} color="border-purple-500" />
        <StatCard label="Pending Expenses" value={fmt(ledger?.summary?.pendingExpenses || 0)} icon={<CreditCard className="text-amber-600" size={24} />} color="border-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fund Breakdown */}
        <div className="col-span-2 glass rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart2 className="text-primary-600" size={20} /> Fund Balances
          </h3>
          <div className="space-y-3">
            {(ledger?.fundBreakdown || []).map((fund: any) => {
              const pct = fund.target_goal > 0 ? Math.min(100, (fund.current_balance / fund.target_goal) * 100) : 0;
              return (
                <div key={fund.fund_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{fund.fund_name}</span>
                    <span className="text-slate-500">{fmt(fund.current_balance)} / {fmt(fund.target_goal || 0)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="text-green-600" size={20} /> Live Feed
          </h3>
          <div className="space-y-3">
            {recentTxns.slice(0, 8).map((txn: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{txn.payment_method || 'Donation'}</p>
                  <p className="text-xs text-slate-400">{txn.fund_name || 'General'}</p>
                </div>
                <span className="text-sm font-bold text-green-600">+{fmt(txn.net_amount || txn.amount || 0)}</span>
              </div>
            ))}
            {recentTxns.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No transactions yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
