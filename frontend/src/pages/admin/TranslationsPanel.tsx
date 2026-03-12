import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface Translation {
  translation_id: number;
  locale: string;
  namespace: string;
  key: string;
  value: string;
  updated_at: string;
}

export default function TranslationsPanel() {
  const [rows, setRows]           = useState<Translation[]>([]);
  const [locales, setLocales]     = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // Filters
  const [filterLocale, setFilterLocale]       = useState('');
  const [filterNamespace, setFilterNamespace] = useState('');
  const [search, setSearch]                   = useState('');
  const [page, setPage]                       = useState(1);
  const [total, setTotal]                     = useState(0);
  const PAGE_SIZE = 50;

  // Edit modal
  const [editing, setEditing]   = useState<Translation | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving]     = useState(false);

  // Add/import panel
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState({ locale: '', namespace: '', key: '', value: '' });

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importLocale, setImportLocale]     = useState('');
  const [importNamespace, setImportNamespace] = useState('');
  const [importJson, setImportJson]         = useState('');
  const [importing, setImporting]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/translations', {
        params: { locale: filterLocale || undefined, namespace: filterNamespace || undefined, search: search || undefined, page, limit: PAGE_SIZE },
      });
      setRows(res.data.data);
      setTotal(res.data.total);
      setLocales(res.data.locales || []);
      setNamespaces(res.data.namespaces || []);
    } catch { setError('Failed to load translations'); }
    setLoading(false);
  }, [filterLocale, filterNamespace, search, page]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (t: Translation) => { setEditing(t); setEditValue(t.value); };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/translations/${editing.translation_id}`, { value: editValue });
      setRows(r => r.map(x => x.translation_id === editing.translation_id ? { ...x, value: editValue } : x));
      setEditing(null);
      setSuccess('Translation saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to save'); }
    setSaving(false);
  };

  const deleteRow = async (id: number) => {
    if (!window.confirm('Delete this translation?')) return;
    try {
      await api.delete(`/translations/${id}`);
      setRows(r => r.filter(x => x.translation_id !== id));
      setTotal(t => t - 1);
    } catch { setError('Failed to delete'); }
  };

  const addTranslation = async () => {
    const { locale, namespace, key, value } = addForm;
    if (!locale || !namespace || !key || !value) return;
    try {
      await api.post('/translations', { locale, namespace, key, value });
      setShowAdd(false);
      setAddForm({ locale: '', namespace: '', key: '', value: '' });
      setSuccess('Translation added');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add');
    }
  };

  const bulkImport = async () => {
    if (!importLocale || !importNamespace || !importJson) return;
    let parsed: any;
    try { parsed = JSON.parse(importJson); } catch { setError('Invalid JSON'); return; }
    setImporting(true);
    try {
      const res = await api.post('/translations/bulk-import', {
        locale: importLocale,
        namespace: importNamespace,
        translations: parsed,
      });
      setShowImport(false);
      setImportJson('');
      setSuccess(`Imported ${res.data.upserted} translations`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch { setError('Import failed'); }
    setImporting(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Translations Manager</h2>
          <p className="text-slate-500 text-sm mt-1">{total} entries across {locales.length} locale(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            Bulk Import JSON
          </button>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            + Add Translation
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filterLocale} onChange={e => { setFilterLocale(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">All Locales</option>
          {locales.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterNamespace} onChange={e => { setFilterNamespace(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">All Namespaces</option>
          {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input type="text" placeholder="Search key or value…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Locale', 'Namespace', 'Key', 'Value', 'Updated', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No translations found</td></tr>
              ) : rows.map(t => (
                <tr key={t.translation_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><span className="bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-0.5 rounded">{t.locale}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{t.namespace}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800 max-w-[200px] break-all">{t.key}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-[300px] truncate">{t.value}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(t.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(t)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">Edit</button>
                      <button onClick={() => deleteRow(t.translation_id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-1 text-slate-800">Edit Translation</h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">[{editing.locale}] {editing.namespace} / {editing.key}</p>
            <textarea rows={5} value={editValue} onChange={e => setEditValue(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Add Translation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Locale</label>
                <input value={addForm.locale} onChange={e => setAddForm(f => ({ ...f, locale: e.target.value }))}
                  placeholder="e.g. en, bn, ar" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Namespace</label>
                <input value={addForm.namespace} onChange={e => setAddForm(f => ({ ...f, namespace: e.target.value }))}
                  placeholder="e.g. common, forms" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">Key</label>
              <input value={addForm.key} onChange={e => setAddForm(f => ({ ...f, key: e.target.value }))}
                placeholder="e.g. donate.button.label" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">Value</label>
              <textarea rows={3} value={addForm.value} onChange={e => setAddForm(f => ({ ...f, value: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={addTranslation} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Bulk Import Translations (JSON)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Locale</label>
                <input value={importLocale} onChange={e => setImportLocale(e.target.value)}
                  placeholder="e.g. bn" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Namespace</label>
                <input value={importNamespace} onChange={e => setImportNamespace(e.target.value)}
                  placeholder="e.g. common" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">JSON (object of key → value strings)</label>
              <textarea rows={10} value={importJson} onChange={e => setImportJson(e.target.value)}
                placeholder={'{\n  "donate.button.label": "Donate Now",\n  "nav.home": "Home"\n}'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={bulkImport} disabled={importing} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
