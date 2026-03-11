import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface Shift {
  shift_id: number;
  shift_title: string;
  description?: string;
  start_datetime: string;
  end_datetime: string;
  max_volunteers: number;
  signed_up_count: number;
  location_name?: string;
  status: string;
  project_name?: string;
  campaign_title?: string;
  created_at: string;
}

interface Timesheet {
  timesheet_id: number;
  volunteer_id: number;
  first_name: string;
  last_name: string;
  activity_description?: string;
  start_datetime: string;
  end_datetime: string;
  duration_minutes?: number;
  status: string;
  admin_notes?: string;
  project_name?: string;
  shift_title?: string;
  receipt_url?: string;
  submitted_at: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  full: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

interface Project { project_id: number; project_name: string; }

export default function ShiftsPanel() {
  const [tab, setTab]           = useState<'shifts'|'timesheets'>('shifts');
  const [shifts, setShifts]     = useState<Shift[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tsFilter, setTsFilter] = useState('pending');
  const [reviewTs, setReviewTs] = useState<Timesheet | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [form, setForm] = useState({
    shiftTitle: '', startDatetime: '', endDatetime: '', maxVolunteers: '0',
    locationName: '', description: '', status: 'open', projectId: '',
  });

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([api.get('/api/v1/shifts'), api.get('/api/v1/projects')]);
      setShifts(sRes.data.data);
      setProjects(pRes.data.data || []);
    } catch { setError('Failed to load shifts'); }
    setLoading(false);
  }, []);

  const loadTimesheets = useCallback(async () => {
    setLoading(true);
    try {
      const params = tsFilter ? `?status=${tsFilter}` : '';
      const res = await api.get(`/api/v1/shifts/timesheets${params}`);
      setTimesheets(res.data.data);
    } catch { setError('Failed to load timesheets'); }
    setLoading(false);
  }, [tsFilter]);

  useEffect(() => { if (tab === 'shifts') loadShifts(); else loadTimesheets(); }, [tab, loadShifts, loadTimesheets]);

  const createShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/shifts', {
        shiftTitle: form.shiftTitle, startDatetime: form.startDatetime, endDatetime: form.endDatetime,
        maxVolunteers: Number(form.maxVolunteers), locationName: form.locationName || undefined,
        description: form.description || undefined, status: form.status,
        projectId: form.projectId ? Number(form.projectId) : undefined,
      });
      setShowForm(false);
      setForm({ shiftTitle:'',startDatetime:'',endDatetime:'',maxVolunteers:'0',locationName:'',description:'',status:'open',projectId:'' });
      loadShifts();
    } catch { setError('Failed to create shift'); }
  };

  const deleteShift = async (id: number) => {
    if (!confirm('Delete shift?')) return;
    await api.delete(`/api/v1/shifts/${id}`);
    loadShifts();
  };

  const reviewTimesheet = async (status: 'approved'|'rejected') => {
    if (!reviewTs) return;
    await api.patch(`/api/v1/shifts/timesheets/${reviewTs.timesheet_id}/review`, { status, adminNotes });
    setReviewTs(null); setAdminNotes('');
    loadTimesheets();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Shifts & Timesheets</h2>
        {tab === 'shifts' && (
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            + New Shift
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      <div className="flex gap-2 border-b">
        {(['shifts','timesheets'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Create Shift Modal */}
      {showForm && tab === 'shifts' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">New Shift</h3>
            <form onSubmit={createShift} className="space-y-3">
              <input required placeholder="Shift Title" value={form.shiftTitle} onChange={e => setForm(f => ({...f, shiftTitle: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500">Start</label><input required type="datetime-local" value={form.startDatetime} onChange={e => setForm(f => ({...f, startDatetime: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500">End</label><input required type="datetime-local" value={form.endDatetime} onChange={e => setForm(f => ({...f, endDatetime: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <input type="number" placeholder="Max Volunteers (0 = unlimited)" value={form.maxVolunteers} onChange={e => setForm(f => ({...f, maxVolunteers: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Location" value={form.locationName} onChange={e => setForm(f => ({...f, locationName: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <select value={form.projectId} onChange={e => setForm(f => ({...f, projectId: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">No Project (optional)</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
              </select>
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timesheet Review Modal */}
      {reviewTs && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">Review Timesheet — {reviewTs.first_name} {reviewTs.last_name}</h3>
            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
              <p><strong>Activity:</strong> {reviewTs.activity_description || '—'}</p>
              <p><strong>Start:</strong> {new Date(reviewTs.start_datetime).toLocaleString()}</p>
              <p><strong>End:</strong> {new Date(reviewTs.end_datetime).toLocaleString()}</p>
              <p><strong>Duration:</strong> {reviewTs.duration_minutes ? `${Math.round(reviewTs.duration_minutes/60)}h ${reviewTs.duration_minutes%60}m` : '—'}</p>
              {reviewTs.project_name && <p><strong>Project:</strong> {reviewTs.project_name}</p>}
              {reviewTs.receipt_url && (
                <p>
                  <strong>Attachment:</strong>{' '}
                  <a href={reviewTs.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    View Receipt
                  </a>
                </p>
              )}
            </div>
            <textarea placeholder="Admin notes (optional)" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReviewTs(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={() => reviewTimesheet('rejected')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Reject</button>
              <button onClick={() => reviewTimesheet('approved')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Approve</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : tab === 'shifts' ? (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600">Shift</th>
                <th className="px-4 py-3 text-left text-gray-600">When</th>
                <th className="px-4 py-3 text-left text-gray-600">Location</th>
                <th className="px-4 py-3 text-left text-gray-600">Volunteers</th>
                <th className="px-4 py-3 text-left text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shifts.map(s => (
                <tr key={s.shift_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.shift_title}</div>
                    {s.project_name && <div className="text-xs text-gray-500">{s.project_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(s.start_datetime).toLocaleString()}<br/>→ {new Date(s.end_datetime).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.location_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.signed_up_count} / {s.max_volunteers || '∞'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[s.status] || ''}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteShift(s.shift_id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shifts.length === 0 && <div className="text-center py-12 text-gray-500">No shifts found.</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['','pending','approved','rejected'].map(s => (
              <button key={s} onClick={() => setTsFilter(s)}
                className={`px-3 py-1 rounded-full text-sm ${tsFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600">Volunteer</th>
                  <th className="px-4 py-3 text-left text-gray-600">Activity</th>
                  <th className="px-4 py-3 text-left text-gray-600">Duration</th>
                  <th className="px-4 py-3 text-left text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-gray-600">Submitted</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {timesheets.map(t => (
                  <tr key={t.timesheet_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.first_name} {t.last_name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.activity_description?.slice(0,40) || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{t.duration_minutes ? `${Math.round(t.duration_minutes/60)}h ${t.duration_minutes%60}m` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[t.status] || ''}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.submitted_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {t.status === 'pending' && (
                        <button onClick={() => { setReviewTs(t); setAdminNotes(''); }} className="text-blue-600 hover:underline text-xs">Review</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {timesheets.length === 0 && <div className="text-center py-12 text-gray-500">No timesheets found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
