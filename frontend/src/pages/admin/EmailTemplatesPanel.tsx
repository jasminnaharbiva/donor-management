import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Template {
  template_id: number;
  template_slug: string;
  locale: string;
  subject_template: string;
  html_body: string;
  available_variables?: string;
  is_active: boolean;
  updated_at: string;
}

export default function EmailTemplatesPanel() {
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [selected, setSelected]     = useState<Template | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [testEmail, setTestEmail]   = useState('');
  const [testSent, setTestSent]     = useState(false);
  const [error, setError]           = useState('');
  const [editForm, setEditForm]     = useState({ subject_template: '', html_body: '', is_active: true });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/email-templates');
      setTemplates(res.data.data);
    } catch { setError('Failed to load email templates'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openTemplate = (t: Template) => {
    setSelected(t);
    setEditForm({ subject_template: t.subject_template, html_body: t.html_body, is_active: Boolean(t.is_active) });
    setTestSent(false);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/email-templates/${selected.template_slug}`, {
        subjectTemplate: editForm.subject_template,
        htmlBody:        editForm.html_body,
        isActive:        editForm.is_active,
      });
      setTemplates(ts => ts.map(t => t.template_slug === selected.template_slug ? { ...t, ...editForm } : t));
      setSelected(null);
    } catch { setError('Failed to save template'); }
    setSaving(false);
  };

  const sendTest = async () => {
    if (!selected || !testEmail) return;
    try {
      await api.post(`/email-templates/${selected.template_slug}/test`, { to: testEmail });
      setTestSent(true);
    } catch { setError('Failed to send test email'); }
  };

  const slugLabel = (slug: string) => slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Email Templates</h2>
        <p className="text-sm text-slate-500">{templates.length} template(s)</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      {/* Edit modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl my-4 shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">{slugLabel(selected.template_slug)}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              {selected.available_variables && (
                <div className="bg-primary-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-primary-800 mb-1">Available Variables:</p>
                  <code className="text-primary-700">{selected.available_variables}</code>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700">Subject</label>
                <input value={editForm.subject_template} onChange={e => setEditForm(f => ({...f, subject_template: e.target.value}))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">HTML Body</label>
                <textarea value={editForm.html_body} onChange={e => setEditForm(f => ({...f, html_body: e.target.value}))}
                  rows={14} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active-toggle" checked={editForm.is_active} onChange={e => setEditForm(f => ({...f, is_active: e.target.checked}))} />
                <label htmlFor="active-toggle" className="text-sm text-slate-700">Active (used by system)</label>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Send Test Email</p>
                <div className="flex gap-2">
                  <input type="email" placeholder="admin@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                  <button onClick={sendTest} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Send Test</button>
                </div>
                {testSent && <p className="text-green-600 text-xs mt-1">Test email sent!</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setSelected(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-slate-500">Loading...</div> : (
        <div className="grid gap-3">
          {templates.map(t => (
            <div key={t.template_id} className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-primary-300 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">{slugLabel(t.template_slug)}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{t.subject_template}</p>
                <p className="text-xs text-slate-400 mt-0.5">Locale: {t.locale} · Updated: {new Date(t.updated_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => openTemplate(t)} className="text-sm text-primary-600 hover:text-primary-800 px-2 py-1.5 rounded-md hover:bg-primary-50 transition-colors ml-4">Edit</button>
            </div>
          ))}
          {templates.length === 0 && <div className="text-center py-12 text-slate-500">No email templates found.</div>}
        </div>
      )}
    </div>
  );
}
