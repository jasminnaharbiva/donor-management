import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Target, Plus, CheckCircle, XCircle, Search } from 'lucide-react';

interface Campaign {
  campaign_id: number;
  title: string;
  slug: string;
  fund_name: string;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  status: string;
  is_public: boolean;
  start_date: string;
  end_date: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-primary-100 text-primary-700',
  archived: 'bg-red-100 text-red-700',
};

export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [funds, setFunds] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', slug: '', fundId: '', goalAmount: '', description: '', isPublic: true });
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [cr, fr] = await Promise.all([api.get('/campaigns'), api.get('/funds')]);
      setCampaigns(cr.data.data);
      setFunds(fr.data.data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCampaign = async () => {
    if (!form.title || !form.slug || !form.fundId || !form.goalAmount) return;
    setCreating(true);
    try {
      await api.post('/campaigns', {
        title: form.title,
        slug: form.slug.toLowerCase().replace(/\s+/g, '-'),
        fundId: Number(form.fundId),
        goalAmount: Number(form.goalAmount),
        description: form.description,
        isPublic: form.isPublic,
      });
      setShowCreate(false);
      setForm({ title: '', slug: '', fundId: '', goalAmount: '', description: '', isPublic: true });
      await load();
    } catch { alert('Failed to create campaign'); }
    setCreating(false);
  };

  const toggleStatus = async (id: number, current: string) => {
    setUpdating(id);
    try {
      const next = current === 'active' ? 'paused' : current === 'draft' ? 'active' : 'active';
      await api.put(`/campaigns/${id}`, { status: next });
      await load();
    } catch { alert('Update failed'); }
    setUpdating(null);
  };

  const togglePublic = async (id: number, current: boolean) => {
    setUpdating(id);
    try {
      await api.put(`/campaigns/${id}`, { isPublic: !current });
      await load();
    } catch { alert('Update failed'); }
    setUpdating(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const filtered = campaigns.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Target className="text-primary-500" /> Campaign Management</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center justify-center sm:justify-start gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {showCreate && (
        <div className="glass rounded-xl p-6 border-2 border-primary-200">
          <h3 className="font-semibold text-slate-700 mb-4">Create New Campaign</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Title" value={form.title}
              onChange={e => { setForm(f => ({ ...f, title: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })); }} />
            <input className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Slug (URL friendly)" value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm" value={form.fundId}
              onChange={e => setForm(f => ({ ...f, fundId: e.target.value }))}>
              <option value="">Select Fund</option>
              {funds.map((f: any) => <option key={f.fund_id} value={f.fund_id}>{f.fund_name}</option>)}
            </select>
            <input className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Goal Amount (USD)" type="number" value={form.goalAmount}
              onChange={e => setForm(f => ({ ...f, goalAmount: e.target.value }))} />
            <textarea className="px-3 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2 h-20 resize-none" placeholder="Description" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} className="w-4 h-4 accent-primary-600" />
              Make Public
            </label>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button onClick={createCampaign} disabled={creating} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <></>}Create Campaign
            </button>
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-6">
        <div className="mb-4 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search campaigns..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Title</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Fund</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Progress</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Status</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-600">Public</th>
                <th className="py-3 px-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const pct = c.goal_amount > 0 ? Math.min(100, (c.raised_amount / c.goal_amount) * 100) : 0;
                return (
                  <tr key={c.campaign_id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{c.title}</div>
                      <div className="text-xs text-slate-400">/{c.slug}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-xs">{c.fund_name}</td>
                    <td className="py-3 px-3 w-40">
                      <div className="text-xs text-slate-500 mb-1">{fmt(c.raised_amount)} / {fmt(c.goal_amount)} ({c.donor_count} donors)</div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="py-3 px-3">
                      <button onClick={() => togglePublic(c.campaign_id, c.is_public)} disabled={updating === c.campaign_id} className="p-1">
                        {c.is_public ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-slate-400" />}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggleStatus(c.campaign_id, c.status)}
                        disabled={updating === c.campaign_id}
                        className="text-primary-600 hover:text-primary-800 text-xs px-2 py-1 border border-primary-200 rounded"
                      >
                        {updating === c.campaign_id ? <Loader2 size={12} className="animate-spin" /> :
                          c.status === 'active' ? 'Pause' : c.status === 'draft' ? 'Activate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No campaigns found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
