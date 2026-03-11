import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Calendar, Clock, Star, Edit3, Loader2, CheckCircle, Plus, UploadCloud, FileImage } from 'lucide-react';
import api from '../../services/api';

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
  receipt_url?: string;
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ shiftId: '', activityDescription: '', startDatetime: '', endDatetime: '', receiptUrl: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/volunteers/timesheets').catch(() => ({ data: { data: [] } })),
      api.get('/volunteers/shifts').catch(() => ({ data: { data: [] } })),
    ]).then(([t, s]) => {
      setSheets(t.data.data || []);
      setShifts(s.data.data || []);
    }).finally(() => setLoading(false));
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
      const r = await api.post('/volunteers/timesheets', {
        shiftId: Number(form.shiftId) || undefined,
        activityDescription: form.activityDescription,
        startDatetime: form.startDatetime,
        endDatetime: form.endDatetime,
        receiptUrl: form.receiptUrl || undefined,
        gpsLat: gps?.lat,
        gpsLon: gps?.lon,
      });
      setSheets(prev => [r.data.data, ...prev]);
      setShowForm(false);
      setForm({ shiftId: '', activityDescription: '', startDatetime: '', endDatetime: '', receiptUrl: '' });
      setGps(null);
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
              <p className="font-semibold text-slate-800 text-sm">{(t as any).shift_title || `Shift #${t.shift_id}` || 'General'}</p>
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
    { name: 'Open Shifts', path: '/volunteer/shifts', icon: <Calendar size={20} /> },
    { name: 'My Timesheets', path: '/volunteer/timesheets', icon: <Clock size={20} /> },
  ];

  return (
    <DashboardLayout title="Volunteer Portal" role="Volunteer" menuItems={menuItems}>
      <Routes>
        <Route path="/" element={<Navigate to="shifts" replace />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="timesheets" element={<Timesheets />} />
      </Routes>
    </DashboardLayout>
  );
}
