import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface P2PCampaign {
  p2p_id: number;
  title: string;
  slug: string;
  personal_story?: string;
  goal_amount: number;
  raised_amount: number;
  status: string;
  end_date?: string;
  parent_campaign_title?: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-primary-100 text-primary-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function P2PPanel() {
  const [campaigns, setCampaigns] = useState<P2PCampaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/p2p${params}`);
      setCampaigns(res.data.data);
    } catch { setError('Failed to load P2P campaigns'); }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number, status: 'active'|'rejected') => {
    if (!confirm(`${status === 'active' ? 'Approve' : 'Reject'} this P2P campaign?`)) return;
    try {
      await api.patch(`/p2p/${id}/approve`, { status });
      load();
    } catch { setError('Failed to update status'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 text-center sm:text-left">Peer-to-Peer Campaigns</h2>
        <p className="text-sm text-slate-500">Supporter-created fundraising pages</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      <div className="flex gap-2">
        {['','draft','active','completed','rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-slate-500">Loading...</div> : (
        <div className="grid gap-4">
          {campaigns.map(c => {
            const pct = c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0;
            return (
              <div key={c.p2p_id} className="bg-white border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{c.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">/{c.slug} · {c.parent_campaign_title}</p>
                    {c.personal_story && <p className="text-sm text-slate-600 mt-1">{c.personal_story.slice(0, 120)}…</p>}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>${Number(c.raised_amount||0).toLocaleString()} raised</span>
                        <span>Goal: ${Number(c.goal_amount||0).toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[c.status] || ''}`}>{c.status}</span>
                    {c.status === 'draft' && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleApprove(c.p2p_id, 'rejected')} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Reject</button>
                        <button onClick={() => handleApprove(c.p2p_id, 'active')} className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {campaigns.length === 0 && <div className="text-center py-12 text-slate-500">No P2P campaigns found.</div>}
        </div>
      )}
    </div>
  );
}
