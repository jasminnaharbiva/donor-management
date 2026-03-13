import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

type VmsVolunteer = {
  id: number;
  source_system?: 'vms' | 'dfb';
  full_name: string;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_birth?: string | null;
  blood_group?: string | null;
  mobile_number?: string | null;
  nid_or_birth_certificate?: string | null;
  gender?: string | null;
  division?: string | null;
  district?: string | null;
  upazila?: string | null;
  status: number | boolean;
  picture_path?: string | null;
  certificate_id?: string | null;
  certificate_status?: number | boolean | null;
};

type VmsCertificate = {
  id: number | string;
  unified_id?: string;
  source_system?: 'vms' | 'dfb';
  volunteer_id: number;
  certificate_id: string;
  issue_date?: string | null;
  expires_at?: string | null;
  status: number | boolean;
  image_path?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  verification_url?: string | null;
  certificate_hash?: string | null;
  full_name?: string;
  mobile_number?: string;
};

type VmsSettings = {
  site_name: string;
  home_title: string;
  keywords?: string | null;
  description?: string | null;
  recaptcha_site_key?: string | null;
  recaptcha_secret_key?: string | null;
  logo_path?: string | null;
  timezone: string;
};

type VmsStats = {
  volunteers: number;
  certificates: number;
  verifiedCertificates: number;
};

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genders = ['Male', 'Female', 'Other'];

export default function VmsPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'volunteers' | 'certificates' | 'settings'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [stats, setStats] = useState<VmsStats>({ volunteers: 0, certificates: 0, verifiedCertificates: 0 });
  const [settings, setSettings] = useState<VmsSettings>({
    site_name: '',
    home_title: '',
    keywords: '',
    description: '',
    recaptcha_site_key: '',
    recaptcha_secret_key: '',
    logo_path: '',
    timezone: 'Asia/Dhaka',
  });

  const [volunteers, setVolunteers] = useState<VmsVolunteer[]>([]);
  const [volSearch, setVolSearch] = useState('');
  const [volStatus, setVolStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [certificates, setCertificates] = useState<VmsCertificate[]>([]);
  const [certSearch, setCertSearch] = useState('');
  const [certStatus, setCertStatus] = useState<'all' | 'verified' | 'unverified'>('all');
  const [sourceMode, setSourceMode] = useState<'all' | 'vms' | 'dfb'>('all');
  const [allVolunteerOptions, setAllVolunteerOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<number[]>([]);

  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VmsVolunteer | null>(null);
  const [volunteerForm, setVolunteerForm] = useState({
    full_name: '',
    father_name: '',
    mother_name: '',
    date_of_birth: '',
    blood_group: '',
    mobile_number: '',
    nid_or_birth_certificate: '',
    gender: '',
    division: '',
    district: '',
    upazila: '',
    status: true,
    picture_path: '',
  });

  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<VmsCertificate | null>(null);
  const [certificateForm, setCertificateForm] = useState({
    volunteer_id: 0,
    certificate_id: '',
    issue_date: '',
    expires_at: '',
    status: true,
    image_path: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const loadStats = async () => {
    const res = await api.get('/vms/admin/dashboard/stats');
    setStats(res.data.data);
  };

  const loadSettings = async () => {
    const res = await api.get('/vms/admin/settings');
    if (res.data.data) {
      setSettings({
        site_name: res.data.data.site_name || '',
        home_title: res.data.data.home_title || '',
        keywords: res.data.data.keywords || '',
        description: res.data.data.description || '',
        recaptcha_site_key: res.data.data.recaptcha_site_key || '',
        recaptcha_secret_key: res.data.data.recaptcha_secret_key || '',
        logo_path: res.data.data.logo_path || '',
        timezone: res.data.data.timezone || 'Asia/Dhaka',
      });
    }
  };

  const loadVolunteers = async () => {
    const params = new URLSearchParams();
    if (volSearch.trim()) params.set('search', volSearch.trim());
    if (volStatus !== 'all') params.set('status', volStatus);

    params.set('source', sourceMode);
    const res = await api.get(`/vms/admin/unified/volunteers${params.toString() ? `?${params}` : ''}`);
    setVolunteers(res.data.data || []);
  };

  const loadCertificates = async () => {
    const params = new URLSearchParams();
    if (certSearch.trim()) params.set('search', certSearch.trim());
    if (certStatus !== 'all') params.set('status', certStatus);

    params.set('source', sourceMode);
    const res = await api.get(`/vms/admin/unified/certificates${params.toString() ? `?${params}` : ''}`);
    setCertificates(res.data.data || []);
  };

  const loadVolunteerOptions = async () => {
    const res = await api.get('/vms/admin/unified/volunteers?source=vms');
    const rows: VmsVolunteer[] = res.data.data || [];
    setAllVolunteerOptions(rows.map((v) => ({ id: Number(v.id), name: `[${v.source_system || 'vms'}] ${v.full_name}` })));
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadStats(), loadSettings(), loadVolunteers(), loadCertificates(), loadVolunteerOptions()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load VMS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadVolunteers().catch(() => undefined);
  }, [volSearch, volStatus, sourceMode]);

  useEffect(() => {
    loadCertificates().catch(() => undefined);
  }, [certSearch, certStatus, sourceMode]);

  const volunteerOptions = useMemo(() => allVolunteerOptions, [allVolunteerOptions]);

  const toNullable = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const uploadImage = async (file: File, category: 'volunteers' | 'certificates' | 'logo'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/vms/admin/upload/${category}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.path;
  };

  const openCreateVolunteer = () => {
    setEditingVolunteer(null);
    setVolunteerForm({
      full_name: '', father_name: '', mother_name: '', date_of_birth: '', blood_group: '',
      mobile_number: '', nid_or_birth_certificate: '', gender: '', division: '', district: '', upazila: '',
      status: true, picture_path: '',
    });
    setShowVolunteerModal(true);
  };

  const openEditVolunteer = (v: VmsVolunteer) => {
    setEditingVolunteer(v);
    setVolunteerForm({
      full_name: v.full_name || '',
      father_name: v.father_name || '',
      mother_name: v.mother_name || '',
      date_of_birth: v.date_of_birth ? String(v.date_of_birth).slice(0, 10) : '',
      blood_group: v.blood_group || '',
      mobile_number: v.mobile_number || '',
      nid_or_birth_certificate: v.nid_or_birth_certificate || '',
      gender: v.gender || '',
      division: v.division || '',
      district: v.district || '',
      upazila: v.upazila || '',
      status: Boolean(v.status),
      picture_path: v.picture_path || '',
    });
    setShowVolunteerModal(true);
  };

  const saveVolunteer = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        full_name: volunteerForm.full_name.trim(),
        father_name: toNullable(volunteerForm.father_name),
        mother_name: toNullable(volunteerForm.mother_name),
        date_of_birth: volunteerForm.date_of_birth || null,
        blood_group: volunteerForm.blood_group || null,
        mobile_number: toNullable(volunteerForm.mobile_number),
        nid_or_birth_certificate: toNullable(volunteerForm.nid_or_birth_certificate),
        gender: volunteerForm.gender || null,
        division: toNullable(volunteerForm.division),
        district: toNullable(volunteerForm.district),
        upazila: toNullable(volunteerForm.upazila),
        status: Boolean(volunteerForm.status),
        picture_path: volunteerForm.picture_path || null,
      };

      if (!payload.full_name) {
        setError('Full name is required');
        setSubmitting(false);
        return;
      }

      if (editingVolunteer) {
        await api.put(`/vms/admin/volunteers/${editingVolunteer.id}`, payload);
      } else {
        await api.post('/vms/admin/volunteers', payload);
      }
      setShowVolunteerModal(false);
      await Promise.all([loadVolunteers(), loadVolunteerOptions(), loadStats()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save volunteer');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteVolunteer = async (id: number) => {
    if (!confirm('Delete this volunteer? This also removes linked certificate.')) return;
    setError('');
    try {
      await api.delete(`/vms/admin/volunteers/${id}`);
      await Promise.all([loadVolunteers(), loadVolunteerOptions(), loadCertificates(), loadStats()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete volunteer');
    }
  };

  const toggleVolunteerStatus = async (id: number, nextStatus: boolean) => {
    try {
      await api.patch(`/vms/admin/volunteers/${id}/status`, { status: nextStatus });
      await loadVolunteers();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update volunteer status');
    }
  };

  const openCreateCertificate = () => {
    setEditingCertificate(null);
    setCertificateForm({ volunteer_id: allVolunteerOptions[0]?.id || 0, certificate_id: '', issue_date: '', expires_at: '', status: true, image_path: '' });
    setShowCertificateModal(true);
  };

  const openEditCertificate = (c: VmsCertificate) => {
    setEditingCertificate(c);
    setCertificateForm({
      volunteer_id: c.volunteer_id,
      certificate_id: c.certificate_id || '',
      issue_date: c.issue_date ? String(c.issue_date).slice(0, 10) : '',
      expires_at: c.expires_at ? String(c.expires_at).slice(0, 10) : '',
      status: Boolean(c.status),
      image_path: c.image_path || '',
    });
    setShowCertificateModal(true);
  };

  const saveCertificate = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (!certificateForm.volunteer_id) {
        setError('Please select a volunteer');
        setSubmitting(false);
        return;
      }

      if (editingCertificate && !certificateForm.certificate_id.trim()) {
        setError('Certificate ID is required when editing');
        setSubmitting(false);
        return;
      }

      const payload: Record<string, unknown> = {
        volunteer_id: certificateForm.volunteer_id,
        status: Boolean(certificateForm.status),
        image_path: certificateForm.image_path || null,
      };

      if (certificateForm.certificate_id.trim()) payload.certificate_id = certificateForm.certificate_id.trim();
      if (certificateForm.issue_date) payload.issue_date = certificateForm.issue_date;
      if (certificateForm.expires_at) payload.expires_at = certificateForm.expires_at;

      if (editingCertificate) {
        await api.put(`/vms/admin/certificates/${editingCertificate.id}`, payload);
      } else {
        await api.post('/vms/admin/certificates', payload);
      }
      setShowCertificateModal(false);
      await Promise.all([loadCertificates(), loadVolunteers(), loadStats()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save certificate');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCertificate = async (id: number) => {
    if (!confirm('Delete this certificate?')) return;
    setError('');
    try {
      await api.delete(`/vms/admin/certificates/${id}`);
      await Promise.all([loadCertificates(), loadVolunteers(), loadStats()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete certificate');
    }
  };

  const bulkIssueCertificates = async () => {
    setError('');
    if (!selectedVolunteerIds.length) {
      setError('Select at least one volunteer for bulk issuance');
      return;
    }

    const selectedRows = volunteers.filter((v) => selectedVolunteerIds.includes(Number(v.id)));
    const sources = Array.from(new Set(selectedRows.map((v) => v.source_system || 'vms')));
    if (sources.length !== 1) {
      setError('Please select volunteers from the same source system for bulk issuance');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/vms/admin/unified/certificates/bulk', {
        source_system: sources[0],
        volunteer_ids: selectedVolunteerIds,
        status: true,
      });
      setSelectedVolunteerIds([]);
      await Promise.all([loadCertificates(), loadVolunteers(), loadStats()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Bulk issuance failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCertificateStatus = async (id: number, nextStatus: boolean) => {
    try {
      await api.patch(`/vms/admin/certificates/${id}/status`, { status: nextStatus });
      await loadCertificates();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update certificate status');
    }
  };

  const saveSettings = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.put('/vms/admin/settings', settings);
      await loadSettings();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update settings');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">VMS Module</h2>
        <div className="text-xs text-slate-500">Legacy-equivalent volunteer certificate management</div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'volunteers', label: 'Volunteers' },
          { key: 'certificates', label: 'Certificates' },
          { key: 'settings', label: 'Settings' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === t.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading VMS...</div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-slate-500 text-xs">Total Volunteers</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{stats.volunteers}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-slate-500 text-xs">Total Certificates</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{stats.certificates}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-slate-500 text-xs">Verified Certificates</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{stats.verifiedCertificates}</div>
              </div>
            </div>
          )}

          {activeTab === 'volunteers' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={volSearch}
                    onChange={(e) => setVolSearch(e.target.value)}
                    placeholder="Search name/mobile/certificate"
                    className="border rounded-lg px-3 py-2 text-sm min-w-[240px]"
                  />
                  <select value={sourceMode} onChange={(e) => setSourceMode(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
                    <option value="all">All Sources</option>
                    <option value="vms">VMS</option>
                    <option value="dfb">DFB</option>
                  </select>
                  <select value={volStatus} onChange={(e) => setVolStatus(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={bulkIssueCertificates} disabled={submitting} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-60">Bulk Issue</button>
                  <button onClick={openCreateVolunteer} className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm">Add Volunteer</button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Select</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Source</th>
                      <th className="px-4 py-3 text-left">Mobile</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th className="px-4 py-3 text-left">Certificate</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {volunteers.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedVolunteerIds.includes(Number(v.id))}
                            onChange={(e) => {
                              const id = Number(v.id);
                              setSelectedVolunteerIds((prev) => e.target.checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id));
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{v.full_name}</div>
                          <div className="text-xs text-slate-500">{v.blood_group || '-'} {v.gender ? `• ${v.gender}` : ''}</div>
                        </td>
                        <td className="px-4 py-3 text-xs uppercase text-slate-600">{v.source_system || 'vms'}</td>
                        <td className="px-4 py-3 text-slate-700">{v.mobile_number || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{[v.division, v.district, v.upazila].filter(Boolean).join(', ') || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{v.certificate_id || '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            disabled={(v.source_system || 'vms') !== 'vms'}
                            onClick={() => toggleVolunteerStatus(v.id, !Boolean(v.status))}
                            className={`px-2 py-1 rounded-full text-xs ${(v.source_system || 'vms') !== 'vms' ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500' : (Boolean(v.status) ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700')}`}
                          >
                            {Boolean(v.status) ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button disabled={(v.source_system || 'vms') !== 'vms'} onClick={() => openEditVolunteer(v)} className="text-primary-700 text-xs px-2 py-1 rounded hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed">Edit</button>
                          <button disabled={(v.source_system || 'vms') !== 'vms'} onClick={() => deleteVolunteer(v.id)} className="text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {volunteers.length === 0 && (
                      <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={8}>No volunteers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'certificates' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={certSearch}
                    onChange={(e) => setCertSearch(e.target.value)}
                    placeholder="Search certificate/name/mobile"
                    className="border rounded-lg px-3 py-2 text-sm min-w-[240px]"
                  />
                  <select value={sourceMode} onChange={(e) => setSourceMode(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
                    <option value="all">All Sources</option>
                    <option value="vms">VMS</option>
                    <option value="dfb">DFB</option>
                  </select>
                  <select value={certStatus} onChange={(e) => setCertStatus(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
                    <option value="all">All</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>
                <button onClick={openCreateCertificate} className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm">Issue Certificate</button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Certificate ID</th>
                      <th className="px-4 py-3 text-left">Source</th>
                      <th className="px-4 py-3 text-left">Volunteer</th>
                      <th className="px-4 py-3 text-left">Issue Date</th>
                      <th className="px-4 py-3 text-left">Expiry</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {certificates.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{c.certificate_id}</td>
                        <td className="px-4 py-3 text-xs uppercase text-slate-600">{c.source_system || 'vms'}</td>
                        <td className="px-4 py-3 text-slate-700">{c.full_name || `#${c.volunteer_id}`}</td>
                        <td className="px-4 py-3 text-slate-700">{c.issue_date ? new Date(c.issue_date).toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            disabled={(c.source_system || 'vms') !== 'vms'}
                            onClick={() => toggleCertificateStatus(Number(c.id), !Boolean(c.status))}
                            className={`px-2 py-1 rounded-full text-xs ${(c.source_system || 'vms') !== 'vms' ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500' : (Boolean(c.status) ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700')}`}
                          >
                            {Boolean(c.status) ? 'Verified' : 'Unverified'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button disabled={(c.source_system || 'vms') !== 'vms'} onClick={() => openEditCertificate(c)} className="text-primary-700 text-xs px-2 py-1 rounded hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed">Edit</button>
                          <button disabled={(c.source_system || 'vms') !== 'vms'} onClick={() => deleteCertificate(Number(c.id))} className="text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {certificates.length === 0 && (
                      <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No certificates found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} placeholder="Site Name" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={settings.home_title} onChange={(e) => setSettings({ ...settings, home_title: e.target.value })} placeholder="Home Title" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={settings.keywords || ''} onChange={(e) => setSettings({ ...settings, keywords: e.target.value })} placeholder="Keywords" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} placeholder="Timezone" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={settings.recaptcha_site_key || ''} onChange={(e) => setSettings({ ...settings, recaptcha_site_key: e.target.value })} placeholder="reCAPTCHA Site Key" className="border rounded-lg px-3 py-2 text-sm" />
                <input value={settings.recaptcha_secret_key || ''} onChange={(e) => setSettings({ ...settings, recaptcha_secret_key: e.target.value })} placeholder="reCAPTCHA Secret Key" className="border rounded-lg px-3 py-2 text-sm" />
              </div>

              <textarea value={settings.description || ''} onChange={(e) => setSettings({ ...settings, description: e.target.value })} placeholder="Description" rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" />

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Logo</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const path = await uploadImage(file, 'logo');
                      setSettings((prev) => ({ ...prev, logo_path: path }));
                    } catch {
                      setError('Logo upload failed');
                    }
                  }}
                  className="block w-full text-sm"
                />
                {settings.logo_path && (
                  <img src={settings.logo_path} alt="logo" className="h-16 w-auto rounded border" />
                )}
              </div>

              <div className="flex justify-end">
                <button onClick={saveSettings} disabled={submitting} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60">
                  {submitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showVolunteerModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-3 max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold">{editingVolunteer ? 'Edit Volunteer' : 'Add Volunteer'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={volunteerForm.full_name} onChange={(e) => setVolunteerForm({ ...volunteerForm, full_name: e.target.value })} placeholder="Full Name *" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={volunteerForm.mobile_number} onChange={(e) => setVolunteerForm({ ...volunteerForm, mobile_number: e.target.value })} placeholder="Mobile Number" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={volunteerForm.father_name} onChange={(e) => setVolunteerForm({ ...volunteerForm, father_name: e.target.value })} placeholder="Father Name" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={volunteerForm.mother_name} onChange={(e) => setVolunteerForm({ ...volunteerForm, mother_name: e.target.value })} placeholder="Mother Name" className="border rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={volunteerForm.date_of_birth} onChange={(e) => setVolunteerForm({ ...volunteerForm, date_of_birth: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
              <select value={volunteerForm.blood_group} onChange={(e) => setVolunteerForm({ ...volunteerForm, blood_group: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">Blood Group</option>
                {bloodGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={volunteerForm.gender} onChange={(e) => setVolunteerForm({ ...volunteerForm, gender: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">Gender</option>
                {genders.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <input value={volunteerForm.nid_or_birth_certificate} onChange={(e) => setVolunteerForm({ ...volunteerForm, nid_or_birth_certificate: e.target.value })} placeholder="NID/Birth Certificate" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={volunteerForm.division} onChange={(e) => setVolunteerForm({ ...volunteerForm, division: e.target.value })} placeholder="Division" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={volunteerForm.district} onChange={(e) => setVolunteerForm({ ...volunteerForm, district: e.target.value })} placeholder="District" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={volunteerForm.upazila} onChange={(e) => setVolunteerForm({ ...volunteerForm, upazila: e.target.value })} placeholder="Upazila" className="border rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={volunteerForm.status} onChange={(e) => setVolunteerForm({ ...volunteerForm, status: e.target.checked })} /> Active
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Profile Picture</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const imagePath = await uploadImage(file, 'volunteers');
                    setVolunteerForm((prev) => ({ ...prev, picture_path: imagePath }));
                  } catch {
                    setError('Volunteer image upload failed');
                  }
                }}
                className="block w-full text-sm"
              />
              {volunteerForm.picture_path && <img src={volunteerForm.picture_path} alt="volunteer" className="h-20 w-20 rounded-full object-cover border" />}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowVolunteerModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={saveVolunteer} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-60">{submitting ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showCertificateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl p-5 space-y-3 max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold">{editingCertificate ? 'Edit Certificate' : 'Issue Certificate'}</h3>

            <div className="grid grid-cols-1 gap-3">
              <select value={certificateForm.volunteer_id} onChange={(e) => setCertificateForm({ ...certificateForm, volunteer_id: Number(e.target.value) })} className="border rounded-lg px-3 py-2 text-sm">
                <option value={0}>Select Volunteer</option>
                {volunteerOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input value={certificateForm.certificate_id} onChange={(e) => setCertificateForm({ ...certificateForm, certificate_id: e.target.value })} placeholder="Certificate ID (optional for auto-gen)" className="border rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={certificateForm.issue_date} onChange={(e) => setCertificateForm({ ...certificateForm, issue_date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={certificateForm.expires_at} onChange={(e) => setCertificateForm({ ...certificateForm, expires_at: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={certificateForm.status} onChange={(e) => setCertificateForm({ ...certificateForm, status: e.target.checked })} /> Verified
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Certificate Image</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const imagePath = await uploadImage(file, 'certificates');
                    setCertificateForm((prev) => ({ ...prev, image_path: imagePath }));
                  } catch {
                    setError('Certificate image upload failed');
                  }
                }}
                className="block w-full text-sm"
              />
              {certificateForm.image_path && <img src={certificateForm.image_path} alt="certificate" className="h-28 w-auto rounded border" />}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCertificateModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={saveCertificate} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-60">{submitting ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
