import { useState, useEffect, useCallback } from 'react';
import { Users, X, UserPlus, Trash2, PlusCircle, CheckCircle2, AlertCircle, StickyNote, Wrench, FileText } from 'lucide-react';
import api from '../../services/api';

interface Project {
  project_id: number;
  fund_id?: number;
  campaign_id?: number | null;
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
  volunteer_count?: number;
  progress_log_count?: number;
  latest_progress_percent?: number | null;
  latest_progress_title?: string | null;
  latest_progress_at?: string | null;
}

interface ProgressLog {
  log_id: number;
  update_type: string;
  update_title: string;
  update_body?: string;
  progress_percent: number;
  status_snapshot: string;
  logged_by: string;
  happened_at: string;
}

interface Fund { fund_id: number; fund_name: string; }
interface Campaign { campaign_id: number; title: string; }

interface Assignment {
  assignment_id: number;
  volunteer_id: number;
  first_name: string;
  last_name: string;
  badge_number?: string;
  assigned_at: string;
  status: string;
}

interface VolunteerOption {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  badge_number?: string;
}

const statusColors: Record<string, string> = {
  planning: 'bg-primary-100 text-primary-800',
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-slate-100 text-slate-800',
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

  // Volunteer assignment state
  const [assignProject, setAssignProject] = useState<Project | null>(null);
  const [assignments, setAssignments]     = useState<Assignment[]>([]);
  const [volunteers, setVolunteers]       = useState<VolunteerOption[]>([]);
  const [assignVolId, setAssignVolId]     = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Progress log state
  const [progressProject, setProgressProject]   = useState<Project | null>(null);
  const [progressLogs, setProgressLogs]         = useState<ProgressLog[]>([]);
  const [progressLoading, setProgressLoading]   = useState(false);
  const [showLogForm, setShowLogForm]           = useState(false);
  const [logForm, setLogForm] = useState({
    updateTitle: '', updateBody: '', updateType: 'field_update',
    progressPercent: '0', status: '', happenedAt: '',
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
      projectName: p.project_name,
      fundId: p.fund_id ? String(p.fund_id) : '',
      campaignId: p.campaign_id ? String(p.campaign_id) : '',
      budgetAllocated: String(p.budget_allocated || ''),
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

  // Open volunteer assignment modal
  const openAssign = async (p: Project) => {
    setAssignProject(p);
    setAssignVolId('');
    setAssignLoading(true);
    try {
      const [aRes, vRes] = await Promise.all([
        api.get(`/projects/${p.project_id}/assignments`),
        api.get('/volunteers?limit=200'),
      ]);
      setAssignments(aRes.data.data || []);
      setVolunteers(vRes.data.data || []);
    } catch { /* ignore */ }
    setAssignLoading(false);
  };

  const addAssignment = async () => {
    if (!assignVolId || !assignProject) return;
    try {
      await api.post(`/projects/${assignProject.project_id}/assignments`, { volunteerId: Number(assignVolId) });
      const aRes = await api.get(`/projects/${assignProject.project_id}/assignments`);
      setAssignments(aRes.data.data || []);
      setAssignVolId('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to assign volunteer');
    }
  };

  const removeAssignment = async (assignmentId: number) => {
    if (!assignProject) return;
    await api.delete(`/projects/${assignProject.project_id}/assignments/${assignmentId}`);
    setAssignments(prev => prev.filter(a => a.assignment_id !== assignmentId));
  };

  const openProgressLog = async (p: Project) => {
    setProgressProject(p);
    setShowLogForm(false);
    setLogForm({ updateTitle: '', updateBody: '', updateType: 'field_update', progressPercent: String(p.latest_progress_percent ?? 0), status: '', happenedAt: '' });
    setProgressLoading(true);
    try {
      const res = await api.get(`/projects/${p.project_id}/progress-logs`);
      setProgressLogs(res.data.data || []);
    } catch { setProgressLogs([]); }
    setProgressLoading(false);
  };

  const submitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressProject) return;
    try {
      await api.post(`/projects/${progressProject.project_id}/progress-logs`, {
        updateTitle:     logForm.updateTitle,
        updateBody:      logForm.updateBody || undefined,
        updateType:      logForm.updateType,
        progressPercent: Number(logForm.progressPercent),
        status:          logForm.status || undefined,
        happenedAt:      logForm.happenedAt || undefined,
      });
      const res = await api.get(`/projects/${progressProject.project_id}/progress-logs`);
      setProgressLogs(res.data.data || []);
      setShowLogForm(false);
      setLogForm({ updateTitle: '', updateBody: '', updateType: 'field_update', progressPercent: logForm.progressPercent, status: '', happenedAt: '' });
      load(); // refresh project cards (latest_progress_percent)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to log progress');
    }
  };

  const typeIcon = (t: string) => {
    if (t === 'milestone') return <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />;
    if (t === 'issue')     return <AlertCircle   size={13} className="text-red-500 shrink-0 mt-0.5" />;
    if (t === 'note')      return <StickyNote    size={13} className="text-blue-400 shrink-0 mt-0.5" />;
    return                        <Wrench        size={13} className="text-slate-400 shrink-0 mt-0.5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 text-center sm:text-left">Projects</h2>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
          + New Project
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {['','planning','active','on_hold','completed','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Create/Edit Modal */}
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
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
                <input type="date" value={form.targetCompletionDate} onChange={e => setForm(f => ({...f, targetCompletionDate: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Country" value={form.locationCountry} onChange={e => setForm(f => ({...f, locationCountry: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
                <input placeholder="City" value={form.locationCity} onChange={e => setForm(f => ({...f, locationCity: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Volunteer Assignment Modal */}
      {assignProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Users size={18} /> Volunteers — {assignProject.project_name}</h3>
              <button onClick={() => setAssignProject(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            {assignLoading ? (
              <div className="text-center py-8 text-slate-400">Loading...</div>
            ) : (
              <>
                {/* Assign new volunteer */}
                <div className="flex gap-2">
                  <select value={assignVolId} onChange={e => setAssignVolId(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select volunteer to assign</option>
                    {volunteers
                      .filter(v => !assignments.find(a => a.volunteer_id === v.volunteer_id))
                      .map(v => (
                        <option key={v.volunteer_id} value={v.volunteer_id}>
                          {v.first_name} {v.last_name}{v.badge_number ? ` (${v.badge_number})` : ''}
                        </option>
                      ))}
                  </select>
                  <button onClick={addAssignment} disabled={!assignVolId}
                    className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-40">
                    <UserPlus size={14} /> Assign
                  </button>
                </div>

                {/* Current assignments */}
                <div className="space-y-2">
                  {assignments.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No volunteers assigned yet.</p>
                  ) : (
                    assignments.map(a => (
                      <div key={a.assignment_id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{a.first_name} {a.last_name}</p>
                          <p className="text-xs text-slate-400">Assigned {new Date(a.assigned_at).toLocaleDateString()}{a.badge_number ? ` · ${a.badge_number}` : ''}</p>
                        </div>
                        <button onClick={() => removeAssignment(a.assignment_id)}
                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Progress Log Modal */}
      {progressProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={18} /> Progress Logs — {progressProject.project_name}</h3>
              <button onClick={() => setProgressProject(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            {progressLoading ? (
              <div className="text-center py-8 text-slate-400">Loading logs...</div>
            ) : (
              <>
                {/* Log Form */}
                {!showLogForm ? (
                  <button onClick={() => setShowLogForm(true)} className="w-full flex items-center gap-2 justify-center py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-600 hover:border-primary-300 hover:text-primary-600">
                    <PlusCircle size={16} /> Add Progress Log
                  </button>
                ) : (
                  <form onSubmit={submitLog} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                    <input required placeholder="Log Title (e.g., 'Milestone: Phase 1 Complete')" value={logForm.updateTitle}
                      onChange={e => setLogForm(f => ({...f, updateTitle: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    
                    <select value={logForm.updateType} onChange={e => setLogForm(f => ({...f, updateType: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="field_update">Field Update</option>
                      <option value="milestone">Milestone</option>
                      <option value="issue">Issue</option>
                      <option value="note">Note</option>
                    </select>

                    <textarea placeholder="Details (optional)" value={logForm.updateBody}
                      onChange={e => setLogForm(f => ({...f, updateBody: e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" max="100" placeholder="Progress %" value={logForm.progressPercent}
                        onChange={e => setLogForm(f => ({...f, progressPercent: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
                      <input type="date" value={logForm.happenedAt}
                        onChange={e => setLogForm(f => ({...f, happenedAt: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm" />
                    </div>

                    <input placeholder="Status snapshot (e.g., 'On track')" value={logForm.status}
                      onChange={e => setLogForm(f => ({...f, status: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />

                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setShowLogForm(false)} className="px-3 py-2 border rounded-lg text-sm">Cancel</button>
                      <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Submit Log</button>
                    </div>
                  </form>
                )}

                {/* Log History */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {progressLogs.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No progress logs yet.</p>
                  ) : (
                    progressLogs.map((log: any, i: number) => (
                      <div key={i} className="flex gap-3 px-3 py-2 border border-slate-100 rounded-lg bg-slate-50">
                        <div className="shrink-0 mt-0.5">{typeIcon(log.update_type)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{log.update_title}</p>
                          {log.update_body && <p className="text-xs text-slate-600 mt-0.5">{log.update_body}</p>}
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                            <span>{log.progress_percent}% Progress</span>
                            {log.status_snapshot && <span>· {log.status_snapshot}</span>}
                            <span>· {new Date(log.happened_at || log.logged_at).toLocaleDateString()} by {log.logged_by}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const allocated = Number(p.budget_allocated || 0);
            const spent = Number(p.budget_spent || 0);
            const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
            const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';
            return (
              <div key={p.project_id} className="bg-white border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{p.project_name}</h3>
                    <p className="text-sm text-slate-500">{p.fund_name}{p.campaign_title && ` · ${p.campaign_title}`}{p.location_city && ` · ${p.location_city}, ${p.location_country}`}</p>
                    {p.description && <p className="text-sm text-slate-600 mt-1">{p.description.slice(0, 100)}{p.description.length > 100 ? '…' : ''}</p>}
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${statusColors[p.status] || 'bg-slate-100 text-slate-800'}`}>{p.status}</span>
                </div>

                {/* Budget progress bar */}
                {allocated > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Budget used: {pct}%</span>
                      <span>${spent.toLocaleString()} / ${allocated.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-slate-500 text-xs">Allocated</span><br/><strong>${allocated.toLocaleString()}</strong></div>
                  <div><span className="text-slate-500 text-xs">Spent</span><br/><strong>${spent.toLocaleString()}</strong></div>
                  <div><span className="text-slate-500 text-xs">Remaining</span><br/><strong>${Number(p.budget_remaining||0).toLocaleString()}</strong></div>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => openEdit(p)} className="text-sm text-primary-600 hover:text-primary-800 px-2 py-1.5 rounded-md hover:bg-primary-50 transition-colors">Edit</button>
                  <button onClick={() => openAssign(p)} className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-1">
                    <Users size={13} /> Volunteers
                  </button>
                  <button onClick={() => openProgressLog(p)} className="text-sm text-green-600 hover:text-green-800 px-2 py-1.5 rounded-md hover:bg-green-50 transition-colors flex items-center gap-1">
                    <FileText size={13} /> Logs
                  </button>
                  <button onClick={() => handleDelete(p.project_id)} className="text-sm text-red-600 hover:text-red-800 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors">Delete</button>
                </div>
              </div>
            );
          })}
          {projects.length === 0 && <div className="text-center py-12 text-slate-500">No projects found.</div>}
        </div>
      )}
    </div>
  );
}
