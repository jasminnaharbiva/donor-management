import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

type FormType = 'donation' | 'registration' | 'expense' | 'campaign' | 'beneficiary_intake';
const FORM_TYPES: FormType[] = ['donation', 'registration', 'expense', 'campaign', 'beneficiary_intake'];

interface FormSchema {
  schema_id: number;
  form_type: FormType;
  is_active: boolean;
  created_by: string | null;
  updated_at: string;
}

interface FormSchemaDetail extends FormSchema {
  schema_json: any;
}

const SAMPLE_SCHEMA = JSON.stringify([
  {
    "name": "amount",
    "label": "Donation Amount",
    "type": "number",
    "required": true,
    "min": 1,
    "placeholder": "Enter amount"
  },
  {
    "name": "message",
    "label": "Personal Message",
    "type": "textarea",
    "required": false,
    "placeholder": "Your message (optional)"
  }
], null, 2);

export default function FormSchemasPanel() {
  const [schemas, setSchemas]   = useState<FormSchema[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [selected, setSelected] = useState<FormSchemaDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm]         = useState({ form_type: 'donation' as FormType, schema_json: SAMPLE_SCHEMA, is_active: false });
  const [saving, setSaving]     = useState(false);
  const [jsonError, setJsonError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/form-schemas');
      setSchemas(res.data);
    } catch { setError('Failed to load form schemas'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openSchema = async (s: FormSchema) => {
    try {
      const res = await api.get(`/form-schemas/${s.schema_id}`);
      const detail: FormSchemaDetail = res.data;
      setSelected(detail);
      setIsCreating(false);
      setForm({
        form_type: detail.form_type,
        schema_json: typeof detail.schema_json === 'string' ? detail.schema_json : JSON.stringify(detail.schema_json, null, 2),
        is_active: Boolean(detail.is_active),
      });
      setJsonError('');
    } catch { setError('Failed to load schema details'); }
  };

  const openCreate = () => {
    setSelected(null);
    setIsCreating(true);
    setForm({ form_type: 'donation', schema_json: SAMPLE_SCHEMA, is_active: false });
    setJsonError('');
  };

  const validateJson = (val: string) => {
    try { JSON.parse(val); setJsonError(''); return true; } catch (e: any) { setJsonError(`JSON Error: ${e.message}`); return false; }
  };

  const save = async () => {
    if (!validateJson(form.schema_json)) return;
    setSaving(true);
    setError('');
    try {
      if (isCreating) {
        await api.post('/form-schemas', { form_type: form.form_type, schema_json: form.schema_json, is_active: form.is_active });
        setSuccess('Schema created');
      } else if (selected) {
        await api.put(`/form-schemas/${selected.schema_id}`, { schema_json: form.schema_json, is_active: form.is_active });
        setSuccess('Schema saved');
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

  const deleteSchema = async (id: number) => {
    if (!window.confirm('Delete this form schema? This cannot be undone.')) return;
    try {
      await api.delete(`/form-schemas/${id}`);
      setSchemas(s => s.filter(x => x.schema_id !== id));
      setSuccess('Schema deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to delete'); }
  };

  const toggleActive = async (s: FormSchema) => {
    try {
      await api.put(`/form-schemas/${s.schema_id}`, { is_active: !s.is_active });
      setSchemas(ss => ss.map(x => {
        if (x.form_type === s.form_type) return { ...x, is_active: x.schema_id === s.schema_id ? !s.is_active : false };
        return x;
      }));
    } catch { setError('Failed to update'); }
  };

  const FORM_TYPE_LABELS: Record<FormType, string> = {
    donation: 'Donation Form',
    registration: 'Registration Form',
    expense: 'Expense Form',
    campaign: 'Campaign Form',
    beneficiary_intake: 'Beneficiary Intake',
  };

  const showPanel = isCreating || selected !== null;

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 text-center sm:text-left">Form Schemas</h2>
          <p className="text-slate-500 text-sm mt-1">Customize fields for donation, registration, expense, and other forms</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          + New Schema
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Group by form type */}
      <div className="grid grid-cols-1 gap-4">
        {FORM_TYPES.map(ft => {
          const typeSchemas = schemas.filter(s => s.form_type === ft);
          return (
            <div key={ft} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b">
                <h4 className="font-semibold text-slate-700 text-sm">{FORM_TYPE_LABELS[ft]}</h4>
                <p className="text-xs text-slate-400">{typeSchemas.length} schema(s) — only one can be active</p>
              </div>
              {typeSchemas.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-400 text-center">No schemas — click "+ New Schema" to create one</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">ID</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Updated</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {typeSchemas.map(s => (
                      <tr key={s.schema_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-600">#{s.schema_id}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleActive(s)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(s.updated_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openSchema(s)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">Edit</button>
                            <button onClick={() => deleteSchema(s.schema_id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="text-center py-8 text-slate-400">Loading schemas…</div>
        )}
      </div>

      {/* Edit/Create Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-slate-800">{isCreating ? 'Create Form Schema' : `Edit Schema #${selected?.schema_id}`}</h3>
              <button onClick={() => { setSelected(null); setIsCreating(false); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isCreating && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Form Type</label>
                  <select value={form.form_type} onChange={e => setForm(f => ({ ...f, form_type: e.target.value as FormType }))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                    {FORM_TYPES.map(ft => <option key={ft} value={ft}>{FORM_TYPE_LABELS[ft]}</option>)}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                  <span className="text-sm font-medium text-slate-700">Set as Active schema for {FORM_TYPE_LABELS[form.form_type]}</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Schema JSON</label>
                <p className="text-xs text-slate-500 mb-2">Array of field definitions. Each field: name, label, type (text/number/email/textarea/select/checkbox/date), required, placeholder, options (for select).</p>
                <textarea rows={22} value={form.schema_json}
                  onChange={e => { setForm(f => ({ ...f, schema_json: e.target.value })); validateJson(e.target.value); }}
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500 ${jsonError ? 'border-red-400' : 'border-slate-300'}`} />
                {jsonError && <p className="text-red-600 text-xs mt-1">{jsonError}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button onClick={() => { setSelected(null); setIsCreating(false); }} className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100">Cancel</button>
              <button onClick={save} disabled={saving || !!jsonError} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50">
                {saving ? 'Saving…' : isCreating ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
