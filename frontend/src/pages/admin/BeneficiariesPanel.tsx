import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { Loader2, Users, AlertCircle, RefreshCw, Search } from 'lucide-react';

type Tab = 'applications' | 'beneficiaries';

interface Beneficiary {
  beneficiary_id: number;
  full_name: string;
  welfare_category: string;
  city: string;
  status: string;
  intake_date: string;
}

interface Application {
  application_id: number;
  full_name: string;
  project_type: string;
  project_amount_taka: string;
  district: string;
  upazila: string;
  status: string;
  review_notes: string | null;
  assigned_volunteer_id: number | null;
  tagged_donor_id: number | null;
  linked_project_id: number | null;
  allow_interested_donors: number | boolean;
  fundraiser_required: number | boolean;
  created_beneficiary_id: number | null;
  created_at: string;
}

interface VolunteerOption {
  volunteer_id: number;
  first_name: string;
  last_name: string;
}

interface DonorOption {
  donor_id: number;
  first_name: string;
  last_name: string;
}

interface ProjectOption {
  project_id: number;
  project_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-primary-100 text-primary-700',
  ineligible: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-primary-100 text-primary-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  needs_changes: 'bg-orange-100 text-orange-700',
};

export default function BeneficiariesPanel() {
  const [tab, setTab] = useState<Tab>('applications');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiariesTotal, setBeneficiariesTotal] = useState(0);

  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsTotal, setApplicationsTotal] = useState(0);

  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [detailPayload, setDetailPayload] = useState<Record<string, unknown> | null>(null);
  const [reviewStatus, setReviewStatus] = useState('under_review');
  const [reviewNotes, setReviewNotes] = useState('');
  const [assignedVolunteerId, setAssignedVolunteerId] = useState('');
  const [taggedDonorId, setTaggedDonorId] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [allowInterestedDonors, setAllowInterestedDonors] = useState(false);
  const [fundraiserRequired, setFundraiserRequired] = useState(false);
  const [createBeneficiaryOnApprove, setCreateBeneficiaryOnApprove] = useState(true);
  const [savingReview, setSavingReview] = useState(false);

  const [volunteers, setVolunteers] = useState<VolunteerOption[]>([]);
  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const clearFlash = () => {
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);
  };

  const loadSelectors = async () => {
    const [volRes, donorRes, projectRes] = await Promise.allSettled([
      api.get('/volunteers'),
      api.get('/donors?limit=200'),
      api.get('/projects?limit=200'),
    ]);

    if (volRes.status === 'fulfilled') setVolunteers(volRes.value.data?.data || []);
    if (donorRes.status === 'fulfilled') setDonors(donorRes.value.data?.data || []);
    if (projectRes.status === 'fulfilled') setProjects(projectRes.value.data?.data || []);
  };

  const loadBeneficiaries = async () => {
    const statusParam = ['active', 'completed', 'ineligible'].includes(status) ? status : 'active';
    const res = await api.get(`/beneficiaries?status=${statusParam}&page=${page}&limit=20`);
    setBeneficiaries(res.data?.data || []);
    setBeneficiariesTotal(Number(res.data?.meta?.total || 0));
  };

  const loadApplications = async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.append('status', status);
    if (search.trim()) params.append('search', search.trim());
    const res = await api.get(`/beneficiary-applications?${params.toString()}`);
    setApplications(res.data?.data || []);
    setApplicationsTotal(Number(res.data?.meta?.total || 0));
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'beneficiaries') await loadBeneficiaries();
      else await loadApplications();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load beneficiary data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSelectors(); }, []);
  useEffect(() => { fetchData(); }, [tab, status, page]);

  const filteredBeneficiaries = useMemo(() => {
    const term = search.toLowerCase();
    return beneficiaries.filter((row) =>
      row.full_name?.toLowerCase().includes(term) ||
      row.city?.toLowerCase().includes(term) ||
      row.welfare_category?.toLowerCase().includes(term)
    );
  }, [beneficiaries, search]);

  const openReview = async (app: Application) => {
    setSelectedApplication(app);
    setReviewStatus(app.status || 'under_review');
    setReviewNotes(app.review_notes || '');
    setAssignedVolunteerId(app.assigned_volunteer_id ? String(app.assigned_volunteer_id) : '');
    setTaggedDonorId(app.tagged_donor_id ? String(app.tagged_donor_id) : '');
    setLinkedProjectId(app.linked_project_id ? String(app.linked_project_id) : '');
    setAllowInterestedDonors(Boolean(app.allow_interested_donors));
    setFundraiserRequired(Boolean(app.fundraiser_required));
    setCreateBeneficiaryOnApprove(!app.created_beneficiary_id);

    try {
      const res = await api.get(`/beneficiary-applications/${app.application_id}`);
      const payloadRaw = res.data?.data?.form_payload;
      if (typeof payloadRaw === 'string') {
        try { setDetailPayload(JSON.parse(payloadRaw)); } catch { setDetailPayload(null); }
      } else {
        setDetailPayload(payloadRaw || null);
      }
    } catch {
      setDetailPayload(null);
    }
  };

  const submitReview = async () => {
    if (!selectedApplication) return;
    setSavingReview(true);
    setError('');
    try {
      await api.patch(`/beneficiary-applications/${selectedApplication.application_id}/review`, {
        status: reviewStatus,
        reviewNotes,
        assignedVolunteerId: assignedVolunteerId ? Number(assignedVolunteerId) : null,
        taggedDonorId: taggedDonorId ? Number(taggedDonorId) : null,
        linkedProjectId: linkedProjectId ? Number(linkedProjectId) : null,
        allowInterestedDonors,
        fundraiserRequired,
        createBeneficiaryOnApprove,
      });
      setSuccess('Application review saved successfully');
      setSelectedApplication(null);
      setDetailPayload(null);
      await fetchData();
      clearFlash();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to save review');
    } finally {
      setSavingReview(false);
    }
  };

  const total = tab === 'beneficiaries' ? beneficiariesTotal : applicationsTotal;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center gap-2"><Users size={20} className="text-primary-600" /> Beneficiary Management</h2>
          <p className="text-sm text-slate-500 mt-1">{total} total records in current view</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('applications'); setStatus('pending'); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-sm border ${tab === 'applications' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            Applications
          </button>
          <button
            onClick={() => { setTab('beneficiaries'); setStatus('active'); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-sm border ${tab === 'beneficiaries' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            Beneficiaries
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={tab === 'applications' ? 'Search by name, project type, district, upazila…' : 'Search by name, city, or category…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            {tab === 'applications' ? (
              <>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="needs_changes">Needs Changes</option>
                <option value="rejected">Rejected</option>
              </>
            ) : (
              <>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="ineligible">Ineligible</option>
              </>
            )}
          </select>
          <button onClick={fetchData} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">{success}</div>}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : tab === 'beneficiaries' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Category</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">City</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Intake Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBeneficiaries.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400">No beneficiaries found</td></tr>
                ) : filteredBeneficiaries.map((row) => (
                  <tr key={row.beneficiary_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.full_name}</td>
                    <td className="px-5 py-3 text-slate-600">{row.welfare_category}</td>
                    <td className="px-5 py-3 text-slate-600">{row.city || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{row.intake_date ? new Date(row.intake_date).toLocaleDateString() : '—'}</td>
                    <td className="px-5 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-600'}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Beneficiary</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Project</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Location</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">No applications found</td></tr>
                ) : applications.map((app) => (
                  <tr key={app.application_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{app.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{app.project_type || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{[app.upazila, app.district].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{app.project_amount_taka ? `৳${Number(app.project_amount_taka).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-600'}`}>{app.status}</span></td>
                    <td className="px-4 py-3"><button onClick={() => openReview(app)} className="text-primary-600 hover:text-primary-700 font-medium text-xs">Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between px-2 py-1 text-sm text-slate-500">
          <span>Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {selectedApplication && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Review Beneficiary Application #{selectedApplication.application_id}</h3>
              <button onClick={() => { setSelectedApplication(null); setDetailPayload(null); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Submitted Fields</h4>
                {detailPayload ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(detailPayload).map(([key, value]) => (
                      <div key={key} className="text-sm border border-slate-200 rounded-lg px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{key.replace(/_/g, ' ')}</div>
                        <div className="text-slate-800 break-words">
                          {typeof value === 'string' && /^https?:\/\//.test(value)
                            ? <a href={value} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Open document</a>
                            : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No structured form payload found.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Review Status</label>
                  <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="needs_changes">Needs Changes</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Volunteer</label>
                  <select value={assignedVolunteerId} onChange={(e) => setAssignedVolunteerId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">None</option>
                    {volunteers.map((v) => <option key={v.volunteer_id} value={v.volunteer_id}>{v.first_name} {v.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tagged Donor</label>
                  <select value={taggedDonorId} onChange={(e) => setTaggedDonorId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">None</option>
                    {donors.map((d) => <option key={d.donor_id} value={d.donor_id}>{d.first_name} {d.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Linked Project</label>
                  <select value={linkedProjectId} onChange={(e) => setLinkedProjectId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">None</option>
                    {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={allowInterestedDonors} onChange={(e) => setAllowInterestedDonors(e.target.checked)} /> Allow interested donors to view full details</label>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={fundraiserRequired} onChange={(e) => setFundraiserRequired(e.target.checked)} /> Mark fundraiser required</label>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={createBeneficiaryOnApprove} onChange={(e) => setCreateBeneficiaryOnApprove(e.target.checked)} /> Create beneficiary record on approval</label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Review Notes</label>
                <textarea rows={4} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Write admin review notes or requested changes" />
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => { setSelectedApplication(null); setDetailPayload(null); }} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
              <button onClick={submitReview} disabled={savingReview} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 inline-flex items-center gap-2">
                {savingReview && <Loader2 size={14} className="animate-spin" />} Save Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
