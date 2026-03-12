import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

interface Volunteer {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  badge_number: string;
  status: string;
  skills?: string;
  city?: string;
  country?: string;
  created_at: string;
}

export default function VolunteerVerify() {
  const { badgeNumber }           = useParams<{ badgeNumber: string }>();
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);

  useEffect(() => {
    if (!badgeNumber) return;
    api.get(`/public/volunteers/verify/${badgeNumber}`)
      .then(r => setVolunteer(r.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [badgeNumber]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-300 hover:text-white text-sm mb-6 transition-colors">
            ← Back to Home
          </Link>
        </div>

        {notFound ? (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Not Verified</h2>
            <p className="text-slate-300 text-sm">Badge #{badgeNumber} was not found or this volunteer is no longer active.</p>
            <p className="text-slate-400 text-xs">If you believe this is an error, please contact the organization.</p>
          </div>
        ) : volunteer ? (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500/30 to-primary-500/30 border-b border-white/10 p-6 text-center">
              <div className="w-16 h-16 bg-green-500/20 border-2 border-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 text-green-300 px-3 py-1 rounded-full text-xs font-medium mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                VERIFIED ACTIVE VOLUNTEER
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-white">{volunteer.first_name} {volunteer.last_name}</h2>
                <p className="text-slate-400 text-sm mt-1">Badge #{volunteer.badge_number}</p>
              </div>

              <div className="space-y-3">
                {volunteer.city && (
                  <div className="flex items-center gap-3 text-sm">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="text-slate-300">{volunteer.city}{volunteer.country && `, ${volunteer.country}`}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-slate-300">Member since {new Date(volunteer.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                </div>
                {volunteer.skills && (
                  <div className="pt-2">
                    <p className="text-slate-400 text-xs mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(typeof volunteer.skills === 'string' ? volunteer.skills.split(',') : []).map((s: string, i: number) => (
                        <span key={i} className="bg-primary-500/20 text-primary-300 text-xs px-2 py-0.5 rounded-full">{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-4 text-center">
                <p className="text-slate-500 text-xs">Verified by DFB Donor Management System</p>
                <p className="text-slate-600 text-xs mt-0.5">Scan or share: /verify/{volunteer.badge_number}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
