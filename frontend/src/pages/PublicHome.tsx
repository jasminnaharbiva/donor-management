import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Users, Activity, Sparkles, TrendingUp, Target } from 'lucide-react';
import api from '../services/api';

export default function PublicHome() {
  const [impact, setImpact] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/public/impact').then(r => setImpact(r.data.data)).catch(console.error);
    api.get('/public/campaigns').then(r => setCampaigns((r.data.data || []).slice(0, 3))).catch(console.error);
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(n || 0);
  const pct = (raised: number, goal: number) => goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden relative">
      <div className="absolute top-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
      </div>

      <nav className="relative z-10 w-full px-6 py-4 flex justify-between items-center glass-dark">
        <div className="flex items-center gap-2">
          <Heart className="text-pink-400" fill="currentColor" />
          <span className="font-bold text-xl tracking-tight text-white">DFB Portal</span>
        </div>
        <div>
          <Link to="/login" className="text-white hover:text-primary-300 font-semibold px-4 py-2 transition-colors">Sign In</Link>
          <button onClick={() => navigate('/login')} className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-6 rounded-full shadow-lg hover:shadow-primary-500/50 transition-all ml-4">
            Donate Now
          </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 text-primary-700 font-semibold text-sm">
          <Sparkles size={16} className="text-amber-500" />
          <span>Empowering real-time generosity</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Fund the future, <br /><span className="bg-gradient-to-r from-primary-500 to-purple-600 bg-clip-text text-transparent">transparently.</span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
          Join donors who see the direct impact of their giving. Track allocations in real-time, earn badges, and manage volunteer shifts — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
          <button onClick={() => navigate('/login')} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-full shadow-xl transition-all flex justify-center items-center gap-2 text-lg">
            <Heart size={20} /> Make a Contribution
          </button>
          <button onClick={() => navigate('/login')} className="glass hover:bg-white/90 text-slate-800 font-bold py-4 px-8 rounded-full shadow-lg transition-all flex justify-center items-center gap-2 text-lg">
            <Users size={20} /> Become a Volunteer
          </button>
        </div>

        {/* Live Impact Stats */}
        {impact && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { label: 'Total Raised', value: fmt(impact.total_raised), icon: <TrendingUp className="text-green-500" size={24} /> },
              { label: 'Total Donors', value: impact.total_donors?.toLocaleString() || '0', icon: <Users className="text-primary-500" size={24} /> },
              { label: 'Funds Active', value: impact.active_funds || '0', icon: <Target className="text-purple-500" size={24} /> },
              { label: 'Volunteers', value: impact.total_volunteers || '0', icon: <Activity className="text-amber-500" size={24} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="glass rounded-2xl p-5 text-center">
                <div className="flex justify-center mb-2">{icon}</div>
                <div className="text-2xl font-extrabold text-slate-900">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Active Campaigns */}
      {campaigns.length > 0 && (
        <div className="relative z-10 bg-white border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-10">Active Campaigns</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {campaigns.map((c: any) => (
                <div key={c.campaign_id || c.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col">
                  <h3 className="font-bold text-lg text-slate-800 mb-1">{c.title}</h3>
                  <p className="text-sm text-slate-500 mb-4 flex-1">{c.description?.slice(0, 100)}…</p>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{fmt(c.raised_amount || 0)} raised</span>
                      <span>Goal: {fmt(c.goal_amount)}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${pct(c.raised_amount, c.goal_amount)}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-right">{pct(c.raised_amount, c.goal_amount)}% funded</p>
                  </div>
                  <button onClick={() => navigate('/login')} className="mt-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 px-4 rounded-xl text-sm">
                    Donate to this campaign
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Activity className="w-12 h-12 text-primary-500 mx-auto mb-4" />, title: 'Real-Time Impact', desc: 'Live thermometers update the moment your payment clears.' },
            { icon: <Users className="w-12 h-12 text-purple-500 mx-auto mb-4" />, title: 'Peer to Peer', desc: 'Start your own sub-campaigns and leverage your network.' },
            { icon: <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />, title: 'Gamification', desc: 'Unlock achievement badges as your lifetime giving grows.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
              {icon}
              <h3 className="font-bold text-xl mb-2 text-slate-800">{title}</h3>
              <p className="text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
