import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface Project {
  project_id: number;
  project_name: string;
  description?: string;
  status: string;
  budget_allocated: number;
  budget_spent: number;
  budget_remaining: number;
  location_country?: string;
  location_city?: string;
  start_date?: string;
  target_completion_date?: string;
  campaign_title?: string;
  fund_name?: string;
  created_at: string;
}

interface Fund { fund_id: number; fund_name: string; }
interface Campaign { campaign_id: number; title: string; }

const statusColors: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function ProjectsPanel() {
  const [projects, setProjects]   = useState<Project[]>([]);
  const [funds, setFunds]         = useState<Fund[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    projectName: '', fundId: '', campaignId: '', budgetAllocated: '',
    status: 'planning', startDate: '', targetCompletionDate: '',
    locationCountry: '', locationCity: '', description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const [pRes, fRes, cRes] = await Promise.all([
        api.get(`/projects${params}`),
        api.get('/funds'),
        api.get('/campaigns'),
      ]);
      setProjects(pRes.data.data);
      setFunds(fRes.data.data || []);
      setCampaigns(cRes.data.data || []);
    } catch { setError('Failed to load projects'); }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/projects/${editId}`, {
          projectName: form.projectName, fundId: Number(form.fundId),
          campaignId: form.campaignId ? Number(form.campaignId) : undefined,
          budgetAllocated: form.budgetAllocated ? Number(form.budgetAllocated) : undefined,
          status: form.status, startDate: form.startDate || undefined,
          targetCompletionDate: form.targetCompletionDate || undefined,
          locationCountry: form.locationCountry, locationCity: form.locationCity,
          description: form.description,
        });
      } else {
        await api.post('/projects', {
          projectName: form.projectName, fundId: Number(form.fundId),
          campaignId: form.campaignId ? Number(form.campaignId) : undefined,
          budgetAllocated: form.budgetAllocated ? Number(form.budgetAllocated) : undefined,
          status: form.status, startDate: form.startDate || undefined,
          targetCompletionDate: form.targetCompletionDate || undefined,
          locationCountry: form.locationCountry, locationCity: form.locationCity,
          description: form.description,
        });
      }
      setShowForm(false); setEditId(null);
      setForm({ projectName:'',fundId:'',campaignId:'',budgetAllocated:'',status:'planning',startDate:'',targetCompletionDate:'',locationCountry:'',locationCity:'',description:'' });
      load();
    } catch { setError('Failed to save project'); }
  };

  const openEdit = (p: Project) => {
    setEditId(p.project_id);
    setForm({
      projectName: p.project_name, fundId: '', campaignId: '', budgetAllocated: String(p.budget_allocated || ''),
      status: p.status, startDate: p.start_date?.split('T')[0] || '',
      targetCompletionDate: p.target_completion_date?.split('T')[0] || '',
      locationCountry: p.location_country || '', locationCity: p.location_city || '',
      description: p.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project?')) return;
    await api.delete(`/projects/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + New Project
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      <div className="flex gap-2">
        {['','planning','active','on_hold','completed','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">{editId ? 'Edit' : 'New'} Project</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input required placeholder="Project Name" value={form.projectName} onChange={e => setForm(f => ({...f, projectName: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <select required value={form.fundId} onChange={e => setForm(f => ({...f, fundId: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Fund</option>
                {funds.map(f => <option key={f.fund_id} value={f.fund_id}>{f.fund_name}</option>)}
              </select>
              <select value={form.campaignId} onChange={e => setForm(f => ({...f, campaignId: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">No Campaign (optional)</option>
                {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.title}</option>)}
              </select>
              <input type="number" placeholder="Budget Allocated" value={form.budgetAllocated} onChange={e => setForm(f => ({...f, budgetAllocated: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {['planning','active','on_hold','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" placeholder="Start Date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
                <input type="date" placeholder="Target Completion" value={form.targetCompletionDate} onChange={e => setForm(f => ({...f, targetCompletionDate: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Country" value={form.locationCountry} onChange={e => setForm(f => ({...f, locationCountry: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="City" value={form.locationCity} onChange={e => setForm(f => ({...f, locationCity: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {projects.map(p => (
            <div key={p.project_id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.project_name}</h3>
                  <p className="text-sm text-gray-500">{p.fund_name} {p.campaign_title && `· ${p.campaign_title}`} {p.location_city && `· ${p.location_city}, ${p.location_country}`}</p>
                  {p.description && <p className="text-sm text-gray-600 mt-1">{p.description.slice(0, 100)}{p.description.length > 100 ? '…' : ''}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[p.status] || 'bg-gray-100 text-gray-800'}`}>{p.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">Allocated</span><br/><strong>${Number(p.budget_allocated||0).toLocaleString()}</strong></div>
                <div><span className="text-gray-500">Spent</span><br/><strong>${Number(p.budget_spent||0).toLocaleString()}</strong></div>
                <div><span className="text-gray-500">Remaining</span><br/><strong>${Number(p.budget_remaining||0).toLocaleString()}</strong></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => openEdit(p)} className="text-sm text-blue-600 hover:underline">Edit</button>
                <button onClick={() => handleDelete(p.project_id)} className="text-sm text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
          {projects.length === 0 && <div className="text-center py-12 text-gray-500">No projects found.</div>}
        </div>
      )}
    </div>
  );
}
