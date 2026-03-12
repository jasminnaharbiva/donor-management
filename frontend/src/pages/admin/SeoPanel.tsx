import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Save, Loader2, Globe, BarChart3, Search, AlertCircle, CheckCircle, FileText, ExternalLink } from 'lucide-react';

interface Setting { setting_key: string; setting_value: string; description: string; }

const SEO_KEYS = [
  'seo.site_title', 'seo.site_description', 'seo.org_name', 'seo.org_url',
  'seo.og_image_url', 'seo.twitter_handle',
  'seo.google_analytics_id', 'seo.google_site_verification',
  'seo.facebook_pixel_id', 'seo.google_tag_manager_id',
  'seo.robots_txt_content', 'seo.sitemap_include_campaigns',
  'legal.privacy_policy_url', 'legal.terms_url',
];

const GROUPS = [
  {
    label: 'Basic SEO',
    icon: <Globe size={16} />,
    color: 'text-primary-600 bg-primary-50',
    keys: ['seo.site_title', 'seo.site_description', 'seo.org_name', 'seo.org_url', 'seo.og_image_url', 'seo.twitter_handle'],
  },
  {
    label: 'Analytics & Tracking',
    icon: <BarChart3 size={16} />,
    color: 'text-purple-600 bg-purple-50',
    keys: ['seo.google_analytics_id', 'seo.google_site_verification', 'seo.facebook_pixel_id', 'seo.google_tag_manager_id'],
  },
  {
    label: 'Robots & Sitemap',
    icon: <Search size={16} />,
    color: 'text-green-600 bg-green-50',
    keys: ['seo.robots_txt_content', 'seo.sitemap_include_campaigns'],
  },
  {
    label: 'Legal & Compliance',
    icon: <FileText size={16} />,
    color: 'text-orange-600 bg-orange-50',
    keys: ['legal.privacy_policy_url', 'legal.terms_url'],
  },
];

const FRIENDLY_NAMES: Record<string, string> = {
  'seo.site_title': 'Site Meta Title',
  'seo.site_description': 'Site Meta Description',
  'seo.org_name': 'Organization Name',
  'seo.org_url': 'Canonical Site URL',
  'seo.og_image_url': 'Default OG Image URL',
  'seo.twitter_handle': 'Twitter / X Handle',
  'seo.google_analytics_id': 'Google Analytics 4 ID',
  'seo.google_site_verification': 'Google Search Console Verification',
  'seo.facebook_pixel_id': 'Facebook Pixel ID',
  'seo.google_tag_manager_id': 'Google Tag Manager ID',
  'seo.robots_txt_content': 'robots.txt Content',
  'seo.sitemap_include_campaigns': 'Include Campaigns in Sitemap',
  'legal.privacy_policy_url': 'Privacy Policy URL',
  'legal.terms_url': 'Terms of Service URL',
};

const TEXTAREA_KEYS = ['seo.robots_txt_content', 'seo.site_description'];
const BOOLEAN_KEYS = ['seo.sitemap_include_campaigns'];

export default function SeoPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      const map: Record<string, string> = {};
      (res.data.data || []).forEach((s: Setting) => {
        if (SEO_KEYS.includes(s.setting_key)) map[s.setting_key] = s.setting_value ?? '';
      });
      SEO_KEYS.forEach(k => { if (!(k in map)) map[k] = ''; });
      setSettings(map);
    } catch { setError('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    setError(null);
    try {
      await api.put(`/admin/settings/${key}`, { value: settings[key] });
      setSaved(key);
      setTimeout(() => setSaved(null), 2500);
    } catch {
      setError(`Failed to save ${FRIENDLY_NAMES[key] || key}`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 text-center sm:text-left">SEO Manager</h2>
          <p className="text-sm text-slate-500 mt-0.5">Control meta tags, structured data, analytics tracking, and search engine visibility</p>
        </div>
        <a
          href={`https://search.google.com/search-console`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
        >
          <ExternalLink size={14} /> Google Search Console
        </a>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {GROUPS.map((group) => (
        <div key={group.label} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Group header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${group.color}`}>
              {group.icon} {group.label}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {group.keys.map((key) => (
              <div key={key} className="px-6 py-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-700">{FRIENDLY_NAMES[key] || key}</label>
                    {saved === key && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle size={12} /> Saved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {settings[key] === undefined || settings[key] === ''
                      ? 'Not configured'
                      : key === 'seo.robots_txt_content' ? 'Edit below' : ''}
                  </p>
                  <div className="flex gap-2 items-start">
                    {BOOLEAN_KEYS.includes(key) ? (
                      <select
                        value={settings[key] || 'true'}
                        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                      >
                        <option value="true">Yes — Include in sitemap</option>
                        <option value="false">No — Exclude from sitemap</option>
                      </select>
                    ) : TEXTAREA_KEYS.includes(key) ? (
                      <textarea
                        rows={key === 'seo.robots_txt_content' ? 8 : 3}
                        value={settings[key] || ''}
                        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono resize-y"
                        placeholder={key === 'seo.robots_txt_content' ? 'User-agent: *\nDisallow: /admin/' : 'Enter description…'}
                      />
                    ) : (
                      <input
                        type="text"
                        value={settings[key] || ''}
                        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                        placeholder={
                          key === 'seo.google_analytics_id' ? 'G-XXXXXXXXXX' :
                          key === 'seo.google_tag_manager_id' ? 'GTM-XXXXXXX' :
                          key === 'seo.twitter_handle' ? '@yourhandle' :
                          key === 'seo.facebook_pixel_id' ? '1234567890' :
                          key.includes('url') ? 'https://' :
                          'Enter value…'
                        }
                      />
                    )}
                    <button
                      onClick={() => handleSave(key)}
                      disabled={saving === key}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {saving === key ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                  </div>

                  {/* Tips */}
                  {key === 'seo.site_title' && (
                    <p className="text-xs text-slate-400">Recommended: 50–70 characters. Shows in browser tab and Google results.</p>
                  )}
                  {key === 'seo.site_description' && (
                    <p className="text-xs text-slate-400">Recommended: 120–160 characters. Shows in Google search snippets.</p>
                  )}
                  {key === 'seo.og_image_url' && (
                    <p className="text-xs text-slate-400">Ideal size: 1200×630px. Shown when pages are shared on social media.</p>
                  )}
                  {key === 'seo.google_analytics_id' && (
                    <p className="text-xs text-slate-400">Find in GA4: Admin → Data Streams → Measurement ID (starts with G-).</p>
                  )}
                  {key === 'seo.google_site_verification' && (
                    <p className="text-xs text-slate-400">From Google Search Console → Verify → HTML tag method → paste the content= value only.</p>
                  )}
                  {key === 'seo.google_tag_manager_id' && (
                    <p className="text-xs text-slate-400">If set, GA4 and Pixel should be managed via GTM tags to avoid duplicate firing.</p>
                  )}
                  {key === 'seo.robots_txt_content' && (
                    <div className="flex items-center gap-3 mt-1">
                      <a
                        href="/robots.txt"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> Preview live robots.txt
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Sitemap links */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Globe size={14} className="text-slate-400" /> Sitemap & Search Engine Tools
        </h3>
        <div className="flex flex-wrap gap-3">
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
            <ExternalLink size={13} /> View sitemap.xml
          </a>
          <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
            <ExternalLink size={13} /> Google Rich Results Test
          </a>
          <a href="https://pagespeed.web.dev/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
            <ExternalLink size={13} /> PageSpeed Insights
          </a>
          <a href="https://www.ssllabs.com/ssltest/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
            <ExternalLink size={13} /> SSL Labs Test
          </a>
        </div>
      </div>
    </div>
  );
}
