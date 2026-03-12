import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

interface Campaign {
  campaign_id: number;
  title: string;
  slug: string;
  description?: string;
  cover_image_url?: string;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  start_date?: string;
  end_date?: string;
  status: string;
  meta_title?: string;
  meta_description?: string;
  fund_name?: string;
}

export default function CampaignPage() {
  const { slug }                = useParams<{ slug: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!slug) return;
    api.get(`/public/campaigns/${slug}`)
      .then(r => setCampaign(r.data.data))
      .catch(() => setError('Campaign not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );

  if (error || !campaign) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold text-slate-700">Campaign Not Found</h1>
      <p className="text-slate-500">This campaign may have ended or been removed.</p>
      <Link to="/" className="text-primary-600 hover:underline">← Back to Home</Link>
    </div>
  );

  const pct = campaign.goal_amount > 0 ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100)) : 0;
  const daysLeft = campaign.end_date ? Math.max(0, Math.ceil((new Date(campaign.end_date).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-primary-900 to-primary-700 text-white">
        {campaign.cover_image_url && (
          <img src={campaign.cover_image_url} alt={campaign.title} className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-200 hover:text-white text-sm mb-6 transition-colors">
            ← Back to Home
          </Link>
          <div className="inline-block bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-4">
            {campaign.fund_name}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{campaign.title}</h1>
          {campaign.description && <p className="text-primary-100 text-lg max-w-2xl">{campaign.description}</p>}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
        {/* Campaign description */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <h2 className="text-lg font-bold text-slate-900 mb-3">About This Campaign</h2>
            <p className="text-slate-600 leading-relaxed">{campaign.description || 'No additional details provided.'}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Campaign Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-slate-500">Campaign Status</p>
                <p className="font-semibold text-slate-900 mt-1 capitalize">{campaign.status}</p>
              </div>
              {campaign.start_date && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-slate-500">Start Date</p>
                  <p className="font-semibold text-slate-900 mt-1">{new Date(campaign.start_date).toLocaleDateString()}</p>
                </div>
              )}
              {campaign.end_date && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-slate-500">End Date</p>
                  <p className="font-semibold text-slate-900 mt-1">{new Date(campaign.end_date).toLocaleDateString()}</p>
                </div>
              )}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-slate-500">Total Donors</p>
                <p className="font-semibold text-slate-900 mt-1">{Number(campaign.donor_count||0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — fundraising progress */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border sticky top-6">
            <div className="text-3xl font-bold text-slate-900">${Number(campaign.raised_amount||0).toLocaleString()}</div>
            <p className="text-sm text-slate-500 mt-1">raised of <strong>${Number(campaign.goal_amount||0).toLocaleString()}</strong> goal</p>

            {/* Thermometer */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{pct}% funded</span>
                {daysLeft !== null && <span>{daysLeft} days left</span>}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full bg-gradient-to-r from-primary-500 to-green-500 transition-all duration-1000"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{Number(campaign.donor_count||0).toLocaleString()} donors</span>
                <span>{100 - pct}% remaining</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Link
                to="/register"
                className="block w-full bg-primary-600 hover:bg-primary-700 text-white text-center font-semibold py-3 rounded-xl transition-colors"
              >
                Donate Now
              </Link>
              <button
                onClick={() => navigator.share?.({ title: campaign.title, url: window.location.href })}
                className="block w-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-center font-medium py-3 rounded-xl transition-colors text-sm"
              >
                Share Campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
