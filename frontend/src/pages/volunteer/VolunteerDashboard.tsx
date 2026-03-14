import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Calendar, Clock, Star, Edit3, Loader2, CheckCircle, Plus, UploadCloud, FileImage, Briefcase, ArrowLeft, MessageSquare } from 'lucide-react';
import api from '../../services/api';
import BeneficiaryApplicationPage from './BeneficiaryApplicationPage';

interface Shift {
  shift_id: number;
  shift_title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  max_volunteers: number;
  signed_up_count: number;
  status: string;
  signed_up?: boolean;
}

interface Timesheet {
  id: number;
  shift_id: number;
  hours_worked: number;
  task_description: string;
  status: string;
  submitted_at: string;
  shift_title?: string;
  project_name?: string;
  receipt_url?: string;
}

interface AssignedProject {
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
  fund_name?: string;
  assigned_at: string;
}

interface ProjectProgressLog {
  log_id: number;
  update_type: string;
  update_title: string;
  update_body?: string;
  progress_percent: number;
  status_snapshot?: string;
  happened_at: string;
  created_at?: string;
}

interface ProjectExpenseUpdate {
  expense_id: string;
  amount_spent: number;
  vendor_name?: string;
  purpose?: string;
  status: string;
  spent_timestamp: string;
  created_at: string;
  approved_at?: string | null;
  update_title?: string | null;
  update_details?: string | null;
  voucher_url?: string | null;
  cash_memo_url?: string | null;
  photo_urls?: string[];
}

function Shifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<number | null>(null);

  const load = () => api.get('/volunteers/shifts').then(r => setShifts(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const signup = async (shiftId: number) => {
    setSigning(shiftId);
    try {
      await api.post(`/volunteers/shifts/${shiftId}/signup`);
      setShifts(prev => prev.map(s => s.shift_id === shiftId ? { ...s, signed_up: true, signed_up_count: s.signed_up_count + 1 } : s));
    } catch { alert('Could not sign up for shift.'); }
    setSigning(null);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2"><Star className="text-primary-500" /> Open Shifts</h3>
          <p className="text-sm text-slate-500 mt-0.5">Sign up to volunteer for upcoming campaign activities.</p>
        </div>
      </div>
      {shifts.length === 0 ? (
        <div className="bg-white/50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">No open shifts available at the moment.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shifts.map(s => {
            const available = (s.max_volunteers || 0) - (s.signed_up_count || 0);
            return (
            <div key={s.shift_id} className="glass rounded-xl p-5 border border-slate-200 hover:border-primary-300 transition">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-slate-800">{s.shift_title}</h4>
                {s.signed_up && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle size={10} /> Signed Up</span>}
              </div>
              <p className="text-sm text-slate-500 mb-3">{s.description}</p>
              <div className="text-xs text-slate-400 space-y-1 mb-3">
                <p>📅 Start: {new Date(s.start_datetime).toLocaleString()}</p>
                <p>🏁 End: {new Date(s.end_datetime).toLocaleString()}</p>
                <p>👥 {available > 0 ? `${available} slot${available !== 1 ? 's' : ''} left` : 'Fully booked'}</p>
              </div>
              {!s.signed_up && available > 0 && (
                <button onClick={() => signup(s.shift_id)} disabled={signing === s.shift_id}
                  className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg w-full justify-center disabled:opacity-50">
                  {signing === s.shift_id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Sign Up
                </button>
              )}
              {available <= 0 && !s.signed_up && (
                <p className="text-center text-xs text-red-500 font-medium">Fully booked</p>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

function Timesheets() {
  const [sheets, setSheets] = useState<Timesheet[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [projects, setProjects] = useState<AssignedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ projectId: '', shiftId: '', activityDescription: '', startDatetime: '', endDatetime: '', receiptUrl: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const load = () => Promise.all([
    api.get('/volunteers/timesheets').catch(() => ({ data: { data: [] } })),
    api.get('/volunteers/shifts').catch(() => ({ data: { data: [] } })),
    api.get('/volunteers/my-projects').catch(() => ({ data: { data: [] } })),
  ]).then(([t, s, p]) => {
    setSheets(t.data.data || []);
    setShifts(s.data.data || []);
    setProjects(p.data.data || []);
  }).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const captureGps = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported by your browser.'); return; }
    setGpsLoading(true); setGpsError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGpsLoading(false); },
      err => { setGpsError(`GPS error: ${err.message}`); setGpsLoading(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/volunteers/timesheets', {
        projectId: Number(form.projectId) || undefined,
        shiftId: Number(form.shiftId) || undefined,
        activityDescription: form.activityDescription,
        startDatetime: form.startDatetime,
        endDatetime: form.endDatetime,
        receiptUrl: form.receiptUrl || undefined,
        gpsLat: gps?.lat,
        gpsLon: gps?.lon,
      });
      setShowForm(false);
      setForm({ projectId: '', shiftId: '', activityDescription: '', startDatetime: '', endDatetime: '', receiptUrl: '' });
      setGps(null);
      await load();
    } catch { alert('Could not submit timesheet.'); }
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'volunteer_receipt');

    setUploading(true);
    try {
      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setForm({ ...form, receiptUrl: res.data.data.url });
      }
    } catch {
      alert('Failed to upload receipt. Limits: 10MB, formats: JPEG/PNG/PDF.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const statusColor: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-600' };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center glass rounded-xl p-5">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2"><Edit3 className="text-primary-500" /> My Timesheets</h3>
          <p className="text-sm text-slate-500 mt-0.5">Log and track your volunteer hours.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg">
          <Plus size={14} /> Log Hours
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-xl p-5 border border-primary-200">
          <h4 className="font-semibold text-slate-800 mb-3">Submit Hours</h4>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project (optional)</label>
              <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                <option value="">None / General</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shift (optional)</label>
              <select value={form.shiftId} onChange={e => setForm({ ...form, shiftId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                <option value="">None / General</option>
                {shifts.map(s => <option key={s.shift_id} value={s.shift_id}>{s.shift_title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date/Time</label>
                <input type="datetime-local" value={form.startDatetime} onChange={e => setForm({ ...form, startDatetime: e.target.value })} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date/Time</label>
                <input type="datetime-local" value={form.endDatetime} onChange={e => setForm({ ...form, endDatetime: e.target.value })} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">What did you do?</label>
              <textarea value={form.activityDescription} onChange={e => setForm({ ...form, activityDescription: e.target.value })} required rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none" />
            </div>
            
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">Upload Expense Receipt (Optional)</label>
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <label className="relative cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition outline-none focus-within:ring-2 focus-within:ring-primary-500/50">
                  {uploading ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <UploadCloud size={16} className="text-slate-500" />}
                  {uploading ? 'Uploading...' : 'Choose File'}
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading}/>
                </label>
                {form.receiptUrl && (
                   <span className="flex items-center gap-2 text-sm text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                     <FileImage size={14} /> Attached File
                   </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">Accepted formats: JPG, PNG, PDF (Max 10MB). Used for volunteer mileage or material compensation proof.</p>
              
              {/* GPS capture */}
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700 mb-1.5">Location Verification (Optional)</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={captureGps} disabled={gpsLoading}
                    className="flex items-center gap-2 text-sm bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                    {gpsLoading ? <Loader2 size={14} className="animate-spin"/> : '📍'}
                    {gpsLoading ? 'Getting location…' : 'Capture My GPS Location'}
                  </button>
                  {gps && <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded">📍 {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}</span>}
                  {gpsError && <span className="text-xs text-red-500">{gpsError}</span>}
                </div>
                <p className="text-xs text-slate-400 mt-1">Records your GPS coordinates for expense verification transparency.</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />} Submit
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {sheets.map(t => (
          <div key={t.id} className="glass rounded-xl p-4 flex justify-between items-center border border-slate-200">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{t.project_name || t.shift_title || (t.shift_id ? `Shift #${t.shift_id}` : 'General')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{(t as any).task_description || 'No description'}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(t.submitted_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800">{t.hours_worked}h</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[t.status] || 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
            </div>
          </div>
        ))}
        {sheets.length === 0 && <div className="text-center py-8 text-slate-400">No timesheets submitted yet.</div>}
      </div>
    </div>
  );
}

export default function VolunteerDashboard() {
  const menuItems = [
    { name: 'My Projects', path: '/volunteer/projects', icon: <Briefcase size={20} /> },
    { name: 'Open Shifts', path: '/volunteer/shifts', icon: <Calendar size={20} /> },
    { name: 'My Timesheets', path: '/volunteer/timesheets', icon: <Clock size={20} /> },
    { name: 'Beneficiary Applications', path: '/volunteer/beneficiary-applications', icon: <Edit3 size={20} /> },
  ];

  return (
    <DashboardLayout title="Volunteer Portal" role="Volunteer" menuItems={menuItems}>
      <Routes>
        <Route path="/" element={<Navigate to="projects" replace />} />
        <Route path="projects" element={<MyProjects />} />
        <Route path="projects/:projectId" element={<ProjectWorkspace />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="beneficiary-applications" element={<BeneficiaryApplicationPage />} />
      </Routes>
    </DashboardLayout>
  );
}

function ProjectWorkspace() {
  const { projectId } = useParams();
  const [project, setProject] = useState<(AssignedProject & {
    progress_logs?: ProjectProgressLog[];
    expense_updates?: ProjectExpenseUpdate[];
    latest_progress_percent?: number | null;
    latest_progress_title?: string | null;
    latest_progress_at?: string | null;
  }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [form, setForm] = useState({
    updateTitle: '',
    updateDetails: '',
    amountSpent: '',
    vendorName: '',
    voucherUrl: '',
    cashMemoUrl: '',
    photoUrls: [] as string[],
  });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/volunteers/my-projects/${projectId}`);
      setProject(res.data.data || null);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const uploadProjectFile = async (kind: 'voucher' | 'cash_memo' | 'photo', file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    formData.append('referenceType', 'project_expense_update');

    setUploadingKind(kind);
    try {
      const res = await api.post('/media/project-update-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data?.data?.url || null;
    } catch (err: any) {
      alert(err?.response?.data?.message || `Could not upload ${kind}.`);
      return null;
    } finally {
      setUploadingKind(null);
    }
  };

  const handleSingleFileUpload = async (kind: 'voucher' | 'cash_memo', e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const url = await uploadProjectFile(kind, file);
    if (url) {
      if (kind === 'voucher') setForm(prev => ({ ...prev, voucherUrl: url }));
      if (kind === 'cash_memo') setForm(prev => ({ ...prev, cashMemoUrl: url }));
    }
    e.target.value = '';
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const uploaded: string[] = [];

    for (const file of files) {
      const url = await uploadProjectFile('photo', file);
      if (url) uploaded.push(url);
    }

    if (uploaded.length) {
      setForm(prev => ({ ...prev, photoUrls: [...prev.photoUrls, ...uploaded].slice(0, 10) }));
    }
    e.target.value = '';
  };

  const submitExpenseUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    if (!form.voucherUrl || !form.cashMemoUrl || form.photoUrls.length === 0) {
      alert('Voucher, cash memo, and at least one photo are required.');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/volunteers/my-projects/${projectId}/expense-updates`, {
        amountSpent: Number(form.amountSpent),
        updateTitle: form.updateTitle,
        updateDetails: form.updateDetails || undefined,
        vendorName: form.vendorName || undefined,
        voucherUrl: form.voucherUrl,
        cashMemoUrl: form.cashMemoUrl,
        photoUrls: form.photoUrls,
      });
      setForm({ updateTitle: '', updateDetails: '', amountSpent: '', vendorName: '', voucherUrl: '', cashMemoUrl: '', photoUrls: [] });
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not submit project expense update.');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  if (!project) {
    return (
      <div className="space-y-4">
        <Link to="/volunteer/projects" className="inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800 font-medium">
          <ArrowLeft size={14} /> Back to My Projects
        </Link>
        <div className="bg-white/50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          Project not found, or you are not assigned to this project.
        </div>
      </div>
    );
  }

  const allocated = Number(project.budget_allocated || 0);
  const spent = Number(project.budget_spent || 0);
  const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
  const latestLogs = project.progress_logs || [];
  const expenseUpdates = project.expense_updates || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/volunteer/projects" className="inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800 font-medium">
          <ArrowLeft size={14} /> Back to My Projects
        </Link>
        <Link to="/volunteer/timesheets" className="text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg">Log Hours</Link>
      </div>

      <div className="glass rounded-xl p-5 border border-slate-200 space-y-2">
        <h3 className="text-xl font-bold text-slate-800">{project.project_name}</h3>
        <p className="text-sm text-slate-500">{project.fund_name}{project.location_city ? ` · ${project.location_city}, ${project.location_country}` : ''}</p>
        {project.description && <p className="text-sm text-slate-600">{project.description}</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-500">
          <p>Status: <span className="font-semibold text-slate-700">{project.status}</span></p>
          <p>Assigned: <span className="font-semibold text-slate-700">{new Date(project.assigned_at).toLocaleDateString()}</span></p>
          <p>Latest progress: <span className="font-semibold text-slate-700">{project.latest_progress_percent ?? 0}%</span></p>
        </div>
        {allocated > 0 && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Budget used: {pct}%</span>
              <span>${spent.toLocaleString()} / ${allocated.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-5 border border-primary-200">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-3"><MessageSquare size={16} className="text-primary-500" /> Submit Expense Update (Admin Review)</h4>
        <form onSubmit={submitExpenseUpdate} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Update Title</label>
            <input
              value={form.updateTitle}
              onChange={e => setForm({ ...form, updateTitle: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none"
              placeholder="Example: Completed household survey in Ward-3"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expense Amount</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={form.amountSpent}
                onChange={e => setForm({ ...form, amountSpent: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none"
                placeholder="Enter amount spent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name (optional)</label>
              <input
                value={form.vendorName}
                onChange={e => setForm({ ...form, vendorName: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none"
                placeholder="Vendor / Shop / Supplier"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Update Details</label>
            <textarea
              value={form.updateDetails}
              onChange={e => setForm({ ...form, updateDetails: e.target.value })}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none"
              placeholder="Write what was done, blockers, and next plan."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Voucher (required)</label>
              <label className="relative cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition outline-none focus-within:ring-2 focus-within:ring-primary-500/50">
                {uploadingKind === 'voucher' ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <UploadCloud size={16} className="text-slate-500" />}
                {uploadingKind === 'voucher' ? 'Uploading...' : 'Upload Voucher'}
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => handleSingleFileUpload('voucher', e)} accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploadingKind !== null} />
              </label>
              {form.voucherUrl && <a href={form.voucherUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline mt-1 inline-block">View uploaded voucher</a>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cash Memo (required)</label>
              <label className="relative cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition outline-none focus-within:ring-2 focus-within:ring-primary-500/50">
                {uploadingKind === 'cash_memo' ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <UploadCloud size={16} className="text-slate-500" />}
                {uploadingKind === 'cash_memo' ? 'Uploading...' : 'Upload Cash Memo'}
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => handleSingleFileUpload('cash_memo', e)} accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploadingKind !== null} />
              </label>
              {form.cashMemoUrl && <a href={form.cashMemoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline mt-1 inline-block">View uploaded cash memo</a>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Execution Photos (required, one or more)</label>
            <label className="relative cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition outline-none focus-within:ring-2 focus-within:ring-primary-500/50 w-fit">
              {uploadingKind === 'photo' ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <UploadCloud size={16} className="text-slate-500" />}
              {uploadingKind === 'photo' ? 'Uploading...' : 'Upload Photos'}
              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handlePhotoUpload} accept="image/jpeg,image/png,image/webp" disabled={uploadingKind !== null} multiple />
            </label>
            {form.photoUrls.length > 0 && (
              <div className="mt-2 text-xs text-slate-600">{form.photoUrls.length} photo(s) uploaded</div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit for Review
            </button>
          </div>
        </form>
      </div>

      <div className="glass rounded-xl p-5 border border-slate-200">
        <h4 className="font-semibold text-slate-800 mb-3">Submitted Expense Updates</h4>
        {expenseUpdates.length === 0 ? (
          <div className="text-sm text-slate-500">No expense updates submitted yet.</div>
        ) : (
          <div className="space-y-3">
            {expenseUpdates.map((row) => (
              <div key={row.expense_id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-800 text-sm">{row.update_title || row.purpose || 'Expense Update'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${row.status === 'Approved' ? 'bg-green-100 text-green-700' : row.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{row.status}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Amount: ${Number(row.amount_spent || 0).toLocaleString()} · Submitted: {new Date(row.created_at).toLocaleString()}</div>
                {row.update_details && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{row.update_details}</p>}
                <div className="text-xs text-slate-500 mt-2">
                  {(row.voucher_url || row.cash_memo_url || (row.photo_urls && row.photo_urls.length > 0)) ? (
                    <>
                      {row.voucher_url && <a href={row.voucher_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Voucher</a>}
                      {row.cash_memo_url && <span>{row.voucher_url ? ' · ' : ''}<a href={row.cash_memo_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Cash Memo</a></span>}
                      {row.photo_urls && row.photo_urls.length > 0 && (
                        <span>
                          {(row.voucher_url || row.cash_memo_url) ? ' · ' : ''}
                          Photos: {row.photo_urls.slice(0, 3).map((url, idx) => (
                            <span key={`${row.expense_id}-photo-${idx}`}>{idx > 0 ? ' ' : ''}<a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">#{idx + 1}</a></span>
                          ))}
                        </span>
                      )}
                    </>
                  ) : 'No files attached'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-5 border border-slate-200">
        <h4 className="font-semibold text-slate-800 mb-3">Project Progress Logs</h4>
        {latestLogs.length === 0 ? (
          <div className="text-sm text-slate-500">No logs yet.</div>
        ) : (
          <div className="space-y-3">
            {latestLogs.map(log => (
              <div key={log.log_id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-800 text-sm">{log.update_title}</p>
                  <span className="text-xs text-slate-500">{new Date(log.happened_at).toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{log.update_type} · Progress {Number(log.progress_percent || 0)}%</div>
                {log.update_body && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{log.update_body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MyProjects() {
  const [projects, setProjects] = useState<AssignedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/volunteers/my-projects')
      .then(r => setProjects(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    planning: 'bg-primary-100 text-primary-800',
    active: 'bg-green-100 text-green-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-slate-100 text-slate-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5">
        <h3 className="text-xl font-bold flex items-center gap-2"><Briefcase className="text-primary-500" /> My Assigned Projects</h3>
        <p className="text-sm text-slate-500 mt-0.5">Projects you have been assigned to work on.</p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white/50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          You are not assigned to any active projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p: any) => {
            const allocated = Number(p.budget_allocated || 0);
            const spent = Number(p.budget_spent || 0);
            const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
            const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';
            return (
              <Link
                key={p.project_id}
                to={`/volunteer/projects/${p.project_id}`}
                className="glass rounded-xl p-5 border border-slate-200 hover:border-primary-300 transition space-y-3 block"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-800">{p.project_name}</h4>
                    <p className="text-xs text-slate-500">{p.fund_name}{p.location_city ? ` · ${p.location_city}, ${p.location_country}` : ''}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] || 'bg-slate-100 text-slate-800'}`}>{p.status}</span>
                </div>

                {p.description && <p className="text-sm text-slate-600">{p.description.slice(0, 120)}{p.description.length > 120 ? '…' : ''}</p>}

                {allocated > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Budget used: {pct}%</span>
                      <span>${spent.toLocaleString()} / ${allocated.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-400 space-y-0.5">
                  {p.start_date && <p>📅 Start: {new Date(p.start_date).toLocaleDateString()}</p>}
                  {p.target_completion_date && <p>🏁 Target: {new Date(p.target_completion_date).toLocaleDateString()}</p>}
                  <p>👤 Assigned: {new Date(p.assigned_at).toLocaleDateString()}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
