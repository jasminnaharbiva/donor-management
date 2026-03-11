import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface CustomField {
  field_id: number;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  display_order: number;
  validation_regex?: string;
  options?: string;
  is_visible_to_donor: boolean;
  is_visible_to_volunteer: boolean;
  created_at: string;
}

const ENTITY_TYPES = ['donor','expense','campaign','volunteer','beneficiary'];
const FIELD_TYPES  = ['text','textarea','number','date','boolean','select','multi_select','file','phone','url'];

export default function CustomFieldsPanel() {
  const [fields, setFields]       = useState<CustomField[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [form, setForm] = useState({
    entityType: 'donor', fieldName: '', fieldLabel: '', fieldType: 'text',
    isRequired: false, displayOrder: '0', validationRegex: '',
    options: '', isVisibleToDonor: false, isVisibleToVolunteer: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = entityFilter ? `?entityType=${entityFilter}` : '';
      const res = await api.get(`/api/v1/custom-fields${params}`);
      setFields(res.data.data);
    } catch { setError('Failed to load custom fields'); }
    setLoading(false);
  }, [entityFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        entityType: form.entityType, fieldName: form.fieldName, fieldLabel: form.fieldLabel,
        fieldType: form.fieldType, isRequired: form.isRequired,
        displayOrder: Number(form.displayOrder),
        validationRegex: form.validationRegex || undefined,
        options: form.options ? form.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        isVisibleToDonor: form.isVisibleToDonor, isVisibleToVolunteer: form.isVisibleToVolunteer,
      };
      if (editId) {
        await api.patch(`/api/v1/custom-fields/${editId}`, payload);
      } else {
        await api.post('/api/v1/custom-fields', payload);
      }
      setShowForm(false); setEditId(null);
      setForm({ entityType:'donor',fieldName:'',fieldLabel:'',fieldType:'text',isRequired:false,displayOrder:'0',validationRegex:'',options:'',isVisibleToDonor:false,isVisibleToVolunteer:false });
      load();
    } catch { setError('Failed to save custom field'); }
  };

  const openEdit = (f: CustomField) => {
    setEditId(f.field_id);
    setForm({
      entityType: f.entity_type, fieldName: f.field_name, fieldLabel: f.field_label,
      fieldType: f.field_type, isRequired: Boolean(f.is_required), displayOrder: String(f.display_order),
      validationRegex: f.validation_regex || '',
      options: f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options).join(', ') : '',
      isVisibleToDonor: Boolean(f.is_visible_to_donor), isVisibleToVolunteer: Boolean(f.is_visible_to_volunteer),
    });
    setShowForm(true);
  };

  const deleteField = async (id: number) => {
    if (!confirm('Delete this custom field? All collected data for this field will also be deleted.')) return;
    await api.delete(`/api/v1/custom-fields/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Custom Fields</h2>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Add Field
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setEntityFilter('')} className={`px-3 py-1 rounded-full text-sm ${entityFilter === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>All Entities</button>
        {ENTITY_TYPES.map(e => (
          <button key={e} onClick={() => setEntityFilter(e)} className={`px-3 py-1 rounded-full text-sm ${entityFilter === e ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">{editId ? 'Edit' : 'New'} Custom Field</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <select value={form.entityType} onChange={e => setForm(f => ({...f, entityType: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={!!editId}>
                {ENTITY_TYPES.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
              <input required placeholder="Field Name (snake_case)" value={form.fieldName} onChange={e => setForm(f => ({...f, fieldName: e.target.value.toLowerCase().replace(/\s+/g,'_')}))}
                className="w-full border rounded-lg px-3 py-2 text-sm" disabled={!!editId} />
              <input required placeholder="Field Label (shown to user)" value={form.fieldLabel} onChange={e => setForm(f => ({...f, fieldLabel: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <select value={form.fieldType} onChange={e => setForm(f => ({...f, fieldType: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {(form.fieldType === 'select' || form.fieldType === 'multi_select') && (
                <input placeholder="Options (comma-separated)" value={form.options} onChange={e => setForm(f => ({...f, options: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              )}
              <input placeholder="Validation Regex (optional)" value={form.validationRegex} onChange={e => setForm(f => ({...f, validationRegex: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="number" placeholder="Display Order" value={form.displayOrder} onChange={e => setForm(f => ({...f, displayOrder: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isRequired} onChange={e => setForm(f => ({...f, isRequired: e.target.checked}))} /> Required field
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isVisibleToDonor} onChange={e => setForm(f => ({...f, isVisibleToDonor: e.target.checked}))} /> Visible to donors
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isVisibleToVolunteer} onChange={e => setForm(f => ({...f, isVisibleToVolunteer: e.target.checked}))} /> Visible to volunteers
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600">Field</th>
                <th className="px-4 py-3 text-left text-gray-600">Entity</th>
                <th className="px-4 py-3 text-left text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-gray-600">Required</th>
                <th className="px-4 py-3 text-left text-gray-600">Visibility</th>
                <th className="px-4 py-3 text-left text-gray-600">Order</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map(f => (
                <tr key={f.field_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{f.field_label}</p>
                    <p className="text-xs text-gray-500 font-mono">{f.field_name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.entity_type}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{f.field_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.is_required ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 space-x-1">
                    {f.is_visible_to_donor    && <span className="bg-blue-100 text-blue-700 px-1 rounded">donor</span>}
                    {f.is_visible_to_volunteer && <span className="bg-purple-100 text-purple-700 px-1 rounded">volunteer</span>}
                    <span className="bg-gray-100 text-gray-600 px-1 rounded">admin</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.display_order}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(f)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => deleteField(f.field_id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {fields.length === 0 && <div className="text-center py-12 text-gray-500">No custom fields defined.</div>}
        </div>
      )}
    </div>
  );
}
