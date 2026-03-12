import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface PublicPage {
  page_id: number;
  page_slug: string;
  page_title: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  is_published: boolean;
  is_indexed: boolean;
  updated_at: string;
}

interface PageDetail extends PublicPage {
  sections_json: string | null;
  custom_css: string | null;
}

const EMPTY_FORM = {
  page_slug: '',
  page_title: '',
  meta_title: '',
  meta_description: '',
  og_image_url: '',
  is_published: false,
  is_indexed: true,
  sections_json: '[]',
  custom_css: '',
};

export default function PublicPagesPanel() {
  const [pages, setPages]       = useState<PublicPage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // Edit/create modal
  const [selected, setSelected] = useState<PageDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);

  // Active content tab in editor
  const [activeTab, setActiveTab] = useState<'meta' | 'sections' | 'css'>('meta');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/public-pages');
      setPages(res.data);
    } catch { setError('Failed to load pages'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPage = async (p: PublicPage) => {
    setError('');
    try {
      const res = await api.get(`/public-pages/${p.page_id}`);
      const detail: PageDetail = res.data;
      setSelected(detail);
      setIsCreating(false);
      setForm({
        page_slug:        detail.page_slug,
        page_title:       detail.page_title,
        meta_title:       detail.meta_title || '',
        meta_description: detail.meta_description || '',
        og_image_url:     detail.og_image_url || '',
        is_published:     Boolean(detail.is_published),
        is_indexed:       Boolean(detail.is_indexed),
        sections_json:    detail.sections_json || '[]',
        custom_css:       detail.custom_css || '',
      });
      setActiveTab('meta');
    } catch { setError('Failed to load page details'); }
  };

  const openCreate = () => {
    setSelected(null);
    setIsCreating(true);
    setForm(EMPTY_FORM);
    setActiveTab('meta');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // Validate sections_json
      if (form.sections_json) {
        try { JSON.parse(form.sections_json); } catch { setError('sections_json is not valid JSON'); setSaving(false); return; }
      }

      const payload = {
        page_slug:        form.page_slug,
        page_title:       form.page_title,
        meta_title:       form.meta_title || undefined,
        meta_description: form.meta_description || undefined,
        og_image_url:     form.og_image_url || undefined,
        is_published:     form.is_published,
        is_indexed:       form.is_indexed,
        sections_json:    form.sections_json || undefined,
        custom_css:       form.custom_css || undefined,
      };

      if (isCreating) {
        await api.post('/public-pages', payload);
        setSuccess('Page created');
      } else if (selected) {
        await api.put(`/public-pages/${selected.page_id}`, payload);
        setSuccess('Page saved');
      }

      setTimeout(() => setSuccess(''), 3000);
      setSelected(null);
      setIsCreating(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  };

  const deletePage = async (id: number, title: string) => {
    if (!window.confirm(`Delete page "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/public-pages/${id}`);
      setPages(p => p.filter(x => x.page_id !== id));
      setSuccess('Page deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to delete page'); }
  };

  const togglePublish = async (p: PublicPage) => {
    try {
      await api.put(`/public-pages/${p.page_id}`, { is_published: !p.is_published });
      setPages(ps => ps.map(x => x.page_id === p.page_id ? { ...x, is_published: !p.is_published } : x));
    } catch { setError('Failed to update status'); }
  };

  const showPanel = isCreating || selected !== null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Public Pages</h2>
          <p className="text-slate-500 text-sm mt-1">Manage website pages with SEO metadata and content sections</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          + Create Page
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Pages list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Slug', 'Title', 'Status', 'Indexed', 'Updated', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>
            ) : pages.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">No pages yet. Create one.</td></tr>
            ) : pages.map(p => (
              <tr key={p.page_id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">/{p.page_slug}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.page_title}</td>
                <td className="px-4 py-3">
                  <button onClick={() => togglePublish(p)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${p.is_published ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                    {p.is_published ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${p.is_indexed ? 'text-green-600' : 'text-slate-400'}`}>{p.is_indexed ? 'Yes' : 'No'}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{new Date(p.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openPage(p)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">Edit</button>
                    <a href={`/${p.page_slug}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-700 text-xs font-medium">View</a>
                    <button onClick={() => deletePage(p.page_id, p.page_title)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Edit/Create Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-slate-800">{isCreating ? 'Create New Page' : `Edit: ${selected?.page_title}`}</h3>
              <button onClick={() => { setSelected(null); setIsCreating(false); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b bg-slate-50">
              {(['meta', 'sections', 'css'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {tab === 'meta' ? 'Meta & Settings' : tab === 'sections' ? 'Content (JSON)' : 'Custom CSS'}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {activeTab === 'meta' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Page Slug *</label>
                      <input value={form.page_slug} onChange={e => setForm(f => ({ ...f, page_slug: e.target.value }))}
                        placeholder="about-us" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Page Title *</label>
                      <input value={form.page_title} onChange={e => setForm(f => ({ ...f, page_title: e.target.value }))}
                        placeholder="About Us" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Meta Title (max 70 chars)</label>
                    <input value={form.meta_title} onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                      maxLength={70} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
                    <p className="text-xs text-slate-400 mt-1">{form.meta_title.length}/70</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Meta Description (max 160 chars)</label>
                    <textarea rows={2} value={form.meta_description} onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                      maxLength={160} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
                    <p className="text-xs text-slate-400 mt-1">{form.meta_description.length}/160</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">OG Image URL</label>
                    <input value={form.og_image_url} onChange={e => setForm(f => ({ ...f, og_image_url: e.target.value }))}
                      placeholder="https://..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="rounded" />
                      <span className="text-sm font-medium text-slate-700">Published</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.is_indexed} onChange={e => setForm(f => ({ ...f, is_indexed: e.target.checked }))} className="rounded" />
                      <span className="text-sm font-medium text-slate-700">Allow indexing (robots)</span>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'sections' && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Sections are stored as JSON array. Each section can have type, heading, body, and other custom fields.</p>
                  <textarea rows={18} value={form.sections_json} onChange={e => setForm(f => ({ ...f, sections_json: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                    placeholder='[{"type":"hero","heading":"Welcome","body":"Our mission is..."}]' />
                </div>
              )}

              {activeTab === 'css' && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Custom CSS applied only to this page (scoped). Use .page-wrapper as the root selector.</p>
                  <textarea rows={18} value={form.custom_css} onChange={e => setForm(f => ({ ...f, custom_css: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                    placeholder=".page-wrapper h1 { color: #1a73e8; }" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button onClick={() => { setSelected(null); setIsCreating(false); }} className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50">
                {saving ? 'Saving…' : isCreating ? 'Create Page' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
