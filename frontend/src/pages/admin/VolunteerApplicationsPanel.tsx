import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface Application {
  application_id: number;
  applicant_name: string;
  applicant_email: string;
  city?: string;
  country?: string;
  status: string;
  motivation_statement?: string;
  skills?: string;
  availability?: string;
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  waitlisted: 'bg-purple-100 text-purple-800',
};

export default function VolunteerApplicationsPanel() {
  const [apps, setApps]           = useState<Application[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected]   = useState<Application | null>(null);
  const [reviewStatus, setReviewStatus] = useState('approved');
  const [reviewNotes, setReviewNotes]   = useState('');
  const [reviewing, setReviewing]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/api/v1/volunteer-applications${params}`);
      setApps(res.data.data ?? []);
    } catch { setError('Failed to load applications'); }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async () => {
    if (!selected) return;
    setReviewing(true);
    try {
      await api.patch(`/api/v1/volunteer-applications/${selected.application_id}/review`, {
        status: reviewStatus, reviewNotes,
      });
      setSelected(null); setReviewNotes('');
      load();
    } catch { setError('Failed to submit review'); }
    setReviewing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Volunteer Applications</h2>
        <span className="text-sm text-gray-500">{apps.length} record(s)</span>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      <div className="flex gap-2 flex-wrap">
        {['','pending','under_review','approved','rejected','waitlisted'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">Review Application — {selected.applicant_name}</h3>
            <div className="text-sm space-y-2 bg-gray-50 rounded-lg p-3">
              <p><strong>Email:</strong> {selected.applicant_email}</p>
              <p><strong>Location:</strong> {selected.city}{selected.country && `, ${selected.country}`}</p>
              {selected.motivation_statement && <p><strong>Motivation:</strong> {selected.motivation_statement}</p>}
              {selected.skills && <p><strong>Skills:</strong> {selected.skills}</p>}
              {selected.availability && <p><strong>Availability:</strong> {selected.availability}</p>}
            </div>
            <select value={reviewStatus} onChange={e => setReviewStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="under_review">Mark Under Review</option>
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
              <option value="waitlisted">Waitlist</option>
            </select>
            <textarea placeholder="Review notes (optional)" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSelected(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleReview} disabled={reviewing} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {reviewing ? 'Saving...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600">Applicant</th>
                <th className="px-4 py-3 text-left text-gray-600">Location</th>
                <th className="px-4 py-3 text-left text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-gray-600">Submitted</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {apps.map(a => (
                <tr key={a.application_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{a.applicant_name}</div>
                    <div className="text-gray-500 text-xs">{a.applicant_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.city}{a.country && `, ${a.country}`}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[a.status] || 'bg-gray-100 text-gray-800'}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(a.submitted_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setSelected(a); setReviewStatus('approved'); setReviewNotes(a.review_notes || ''); }}
                      className="text-blue-600 hover:underline text-xs">Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {apps.length === 0 && <div className="text-center py-12 text-gray-500">No applications found.</div>}
        </div>
      )}
    </div>
  );
}
