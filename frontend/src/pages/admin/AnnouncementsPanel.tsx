import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Megaphone, Plus, Eye, EyeOff, Trash2, X } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  body: string;
  audience: string;
  is_active: boolean;
  created_at: string;
}

export default function AnnouncementsPanel() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/announcements').then(r => setItems(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = async (id: number, current: boolean) => {
    await api.patch(`/announcements/${id}`, { is_active: !current });
    setItems(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    await api.delete(`/announcements/${id}`);
    setItems(prev => prev.filter(a => a.id !== id));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post('/announcements', form);
      setItems(prev => [r.data.data, ...prev]);
      setShowForm(false);
      setForm({ title: '', body: '', audience: 'all' });
    } catch { alert('Failed to create announcement'); }
    setSaving(false);
  };

  const audienceLabel: Record<string, string> = { all: 'Everyone', donors: 'Donors', volunteers: 'Volunteers', admins: 'Admins' };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><Megaphone className="text-primary-500" /> Announcements</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center justify-center sm:justify-start gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm px-4 py-2 rounded-lg">
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-xl p-6 border border-primary-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Create Announcement</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
              <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                <option value="all">Everyone</option>
                <option value="donors">Donors Only</option>
                <option value="volunteers">Volunteers Only</option>
                <option value="admins">Admins Only</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {items.map(a => (
          <div key={a.id} className={`glass rounded-xl p-5 border-l-4 ${a.is_active ? 'border-green-500' : 'border-slate-300'}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-800">{a.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {a.is_active ? 'Active' : 'Hidden'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">{audienceLabel[a.audience] || a.audience}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{a.body}</p>
                <p className="text-xs text-slate-400 mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button onClick={() => toggle(a.id, a.is_active)} title={a.is_active ? 'Hide' : 'Show'}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                  {a.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button onClick={() => remove(a.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
            <p>No announcements yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
