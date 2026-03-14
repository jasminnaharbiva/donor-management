import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, UploadCloud, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { divisions_en, districts_en, upazilas_en, type LocationItem } from 'bangladesh-location-data';
import api from '../../services/api';

type FieldType = 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'bd_division' | 'bd_district' | 'bd_upazila' | 'bd_village';

type SchemaField = {
  name: string;
  label?: string;
  type?: FieldType | string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<string | { label?: string; title?: string; value?: string | number }>;
  maxSizeKb?: number;
  uploadKind?: 'identity' | 'passport' | 'nationality' | 'additional';
};

type FormValues = Record<string, string | boolean | number>;

type ApplicationRow = {
  application_id: number;
  full_name: string;
  project_type: string;
  project_amount_taka: string;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_beneficiary_id: number | null;
  created_at: string;
};

const DEFAULT_SCHEMA: SchemaField[] = [
  { name: 'full_name', label: 'Full Name', type: 'text', required: true },
  { name: 'father_name', label: "Father's Name", type: 'text', required: true },
  { name: 'mother_name', label: "Mother's Name", type: 'text', required: true },
  { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
  { name: 'nid_or_birth_certificate_no', label: 'NID / Birth Certificate Number', type: 'text', required: true },
  { name: 'mobile_number', label: 'Mobile Number', type: 'tel', required: true },
  { name: 'division', label: 'Division', type: 'bd_division', required: true },
  { name: 'district', label: 'District', type: 'bd_district', required: true },
  { name: 'upazila', label: 'Upazila', type: 'bd_upazila', required: true },
  { name: 'village', label: 'Village', type: 'bd_village', required: true },
  { name: 'full_address', label: 'Full Address', type: 'textarea', required: true },
  { name: 'identity_document_url', label: 'NID/Birth Certificate Copy (max 500KB)', type: 'file', required: true, maxSizeKb: 500, uploadKind: 'identity' },
  { name: 'passport_photo_url', label: 'Passport Photo (max 500KB)', type: 'file', required: true, maxSizeKb: 500, uploadKind: 'passport' },
  { name: 'nationality_certificate_url', label: 'Nationality Certificate (optional)', type: 'file', required: false, maxSizeKb: 500, uploadKind: 'nationality' },
  {
    name: 'project_type',
    label: 'Project Type',
    type: 'select',
    required: true,
    options: ['water', 'health', 'education', 'food', 'shelter', 'cash_support', 'other'],
  },
  { name: 'project_amount_taka', label: 'Application Project Amount (BDT)', type: 'number', required: true, min: 0 },
  { name: 'case_description', label: 'Full Case Description', type: 'textarea', required: true },
  { name: 'additional_document_url', label: 'Additional Document (max 5MB)', type: 'file', required: false, maxSizeKb: 5120, uploadKind: 'additional' },
];

function isDivisionField(field: SchemaField): boolean {
  const name = field.name.toLowerCase();
  return name === 'division' || name.includes('division') || field.type === 'bd_division';
}

function isDistrictField(field: SchemaField): boolean {
  const name = field.name.toLowerCase();
  return name === 'district' || name.includes('district') || field.type === 'bd_district';
}

function isUpazilaField(field: SchemaField): boolean {
  const name = field.name.toLowerCase();
  return name === 'upazila' || name.includes('upazila') || field.type === 'bd_upazila';
}

function isVillageField(field: SchemaField): boolean {
  const name = field.name.toLowerCase();
  return name === 'village' || name.includes('village') || field.type === 'bd_village';
}

function getFieldLabel(field: SchemaField): string {
  if (field.label && field.label.trim()) return field.label.trim();
  return field.name.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
}

function parseSelectOptions(field: SchemaField): Array<{ label: string; value: string }> {
  const options = Array.isArray(field.options)
    ? field.options
        .map((opt) => {
          if (typeof opt === 'string') return { label: opt, value: opt };
          const label = String(opt.label || opt.title || opt.value || '').trim();
          const value = String(opt.value ?? label).trim();
          if (!label || !value) return null;
          return { label, value };
        })
        .filter((x): x is { label: string; value: string } => Boolean(x))
    : [];
  return options;
}

function getInitialValues(fields: SchemaField[]): FormValues {
  const initial: FormValues = {};
  fields.forEach((field) => {
    if (field.type === 'checkbox') {
      initial[field.name] = false;
    } else {
      initial[field.name] = '';
    }
  });
  return initial;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  under_review: 'bg-primary-100 text-primary-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  needs_changes: 'bg-orange-100 text-orange-700',
};

export default function BeneficiaryApplicationPage() {
  const [schema, setSchema] = useState<SchemaField[]>(DEFAULT_SCHEMA);
  const [form, setForm] = useState<FormValues>(() => getInitialValues(DEFAULT_SCHEMA));
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);

  const [villagesByUpazila, setVillagesByUpazila] = useState<Record<string, string[]>>({});

  const loadMyApplications = async () => {
    setRowsLoading(true);
    try {
      const res = await api.get('/beneficiary-applications/my');
      setRows(res.data?.data || []);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  };

  useEffect(() => {
    const loadBoot = async () => {
      setBootLoading(true);
      try {
        const [schemaRes, settingsRes] = await Promise.allSettled([
          api.get('/form-schemas/type/beneficiary_application'),
          api.get('/public/settings'),
        ]);

        let nextSchema = DEFAULT_SCHEMA;
        if (schemaRes.status === 'fulfilled') {
          const raw = schemaRes.value?.data?.schema_json;
          if (Array.isArray(raw) && raw.length > 0) nextSchema = raw as SchemaField[];
        }
        setSchema(nextSchema);
        setForm(getInitialValues(nextSchema));

        if (settingsRes.status === 'fulfilled') {
          const settings = settingsRes.value?.data?.data || {};
          const villagesMap = settings['beneficiary_application.villages_by_upazila'];
          if (villagesMap && typeof villagesMap === 'object') {
            setVillagesByUpazila(villagesMap as Record<string, string[]>);
          }
        }
      } catch {
        setSchema(DEFAULT_SCHEMA);
        setForm(getInitialValues(DEFAULT_SCHEMA));
      } finally {
        setBootLoading(false);
      }
    };

    loadBoot();
    loadMyApplications();
  }, []);

  const divisionFieldName = useMemo(() => schema.find(isDivisionField)?.name || 'division', [schema]);
  const districtFieldName = useMemo(() => schema.find(isDistrictField)?.name || 'district', [schema]);
  const upazilaFieldName = useMemo(() => schema.find(isUpazilaField)?.name || 'upazila', [schema]);
  const villageFieldName = useMemo(() => schema.find(isVillageField)?.name || 'village', [schema]);

  const selectedDivision = useMemo(() => {
    const divisionTitle = String(form[divisionFieldName] || '').trim();
    return divisions_en.find((item) => item.title === divisionTitle) || null;
  }, [form, divisionFieldName]);

  const districtOptions = useMemo(() => {
    if (!selectedDivision) return [] as LocationItem[];
    return districts_en[String(selectedDivision.value)] || [];
  }, [selectedDivision]);

  const selectedDistrict = useMemo(() => {
    const districtTitle = String(form[districtFieldName] || '').trim();
    return districtOptions.find((item) => item.title === districtTitle) || null;
  }, [districtOptions, form, districtFieldName]);

  const upazilaOptions = useMemo(() => {
    if (!selectedDistrict) return [] as LocationItem[];
    return upazilas_en[String(selectedDistrict.value)] || [];
  }, [selectedDistrict]);

  const selectedUpazilaTitle = useMemo(() => String(form[upazilaFieldName] || '').trim(), [form, upazilaFieldName]);

  const villageOptions = useMemo(() => {
    const fromSettings = villagesByUpazila[selectedUpazilaTitle] || [];
    if (fromSettings.length > 0) return fromSettings;

    const villageField = schema.find((field) => field.name === villageFieldName);
    const fromSchema = villageField ? parseSelectOptions(villageField).map((opt) => opt.value) : [];
    return fromSchema;
  }, [villagesByUpazila, selectedUpazilaTitle, schema, villageFieldName]);

  useEffect(() => {
    const districtVal = String(form[districtFieldName] || '');
    if (!districtVal) return;
    const stillValid = districtOptions.some((d) => d.title === districtVal);
    if (!stillValid) {
      setForm((prev) => ({ ...prev, [districtFieldName]: '', [upazilaFieldName]: '', [villageFieldName]: '' }));
    }
  }, [districtOptions, form, districtFieldName, upazilaFieldName, villageFieldName]);

  useEffect(() => {
    const upazilaVal = String(form[upazilaFieldName] || '');
    if (!upazilaVal) return;
    const stillValid = upazilaOptions.some((u) => u.title === upazilaVal);
    if (!stillValid) {
      setForm((prev) => ({ ...prev, [upazilaFieldName]: '', [villageFieldName]: '' }));
    }
  }, [upazilaOptions, form, upazilaFieldName, villageFieldName]);

  useEffect(() => {
    const villageVal = String(form[villageFieldName] || '').trim();
    if (!villageVal) return;
    if (villageOptions.length > 0 && !villageOptions.includes(villageVal)) {
      setForm((prev) => ({ ...prev, [villageFieldName]: '' }));
    }
  }, [form, villageFieldName, villageOptions]);

  const setText =
    (key: string) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const nextValue = e.target.value;
      setForm((prev) => {
        const next: FormValues = { ...prev, [key]: nextValue };
        if (key === divisionFieldName) {
          next[districtFieldName] = '';
          next[upazilaFieldName] = '';
          next[villageFieldName] = '';
        } else if (key === districtFieldName) {
          next[upazilaFieldName] = '';
          next[villageFieldName] = '';
        } else if (key === upazilaFieldName) {
          next[villageFieldName] = '';
        }
        return next;
      });
    };

  const setChecked = (key: string) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.checked }));
  };

  const resolveUploadKind = (field: SchemaField): 'identity' | 'passport' | 'nationality' | 'additional' => {
    if (field.uploadKind) return field.uploadKind;
    const name = field.name.toLowerCase();
    if (name.includes('passport')) return 'passport';
    if (name.includes('nationality')) return 'nationality';
    if (name.includes('additional')) return 'additional';
    return 'identity';
  };

  const onUploadFile = (field: SchemaField) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadKind = resolveUploadKind(field);
    const maxSizeKb = field.maxSizeKb || (uploadKind === 'additional' ? 5120 : 500);
    const maxSizeBytes = maxSizeKb * 1024;

    if (file.size > maxSizeBytes) {
      setError(`${getFieldLabel(field)} must be less than ${maxSizeKb >= 1024 ? `${Math.round(maxSizeKb / 1024)}MB` : `${maxSizeKb}KB`}.`);
      e.target.value = '';
      return;
    }

    setError('');
    setUploadingField(field.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', uploadKind);

      const res = await api.post('/media/beneficiary-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = String(res.data?.data?.url || '').trim();
      if (!uploadedUrl) throw new Error('Upload failed. Please try again.');

      setForm((prev) => ({ ...prev, [field.name]: uploadedUrl }));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'File upload failed.');
      setForm((prev) => ({ ...prev, [field.name]: '' }));
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  const validateBeforeSubmit = (): string | null => {
    for (const field of schema) {
      if (!field.required) continue;
      const value = form[field.name];
      if (field.type === 'checkbox') {
        if (value !== true) return `${getFieldLabel(field)} is required.`;
      } else if (String(value || '').trim().length === 0) {
        return `${getFieldLabel(field)} is required.`;
      }
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await api.post('/beneficiary-applications', { fields: form });
      setSuccess('Beneficiary application submitted successfully.');
      setForm(getInitialValues(schema));
      await loadMyApplications();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit application.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: SchemaField) => {
    const value = form[field.name];
    const label = getFieldLabel(field);
    const required = Boolean(field.required);

    if (isDivisionField(field)) {
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">Select division</option>
            {divisions_en.map((division) => (
              <option key={division.value} value={division.title}>{division.title}</option>
            ))}
          </select>
        </div>
      );
    }

    if (isDistrictField(field)) {
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            disabled={!selectedDivision}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-slate-100"
          >
            <option value="">{selectedDivision ? 'Select district' : 'Select division first'}</option>
            {districtOptions.map((district) => (
              <option key={district.value} value={district.title}>{district.title}</option>
            ))}
          </select>
        </div>
      );
    }

    if (isUpazilaField(field)) {
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            disabled={!selectedDistrict}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-slate-100"
          >
            <option value="">{selectedDistrict ? 'Select upazila' : 'Select district first'}</option>
            {upazilaOptions.map((upazila) => (
              <option key={upazila.value} value={upazila.title}>{upazila.title}</option>
            ))}
          </select>
        </div>
      );
    }

    if (isVillageField(field)) {
      if (villageOptions.length > 0) {
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
            <select
              required={required}
              value={String(value || '')}
              onChange={setText(field.name)}
              disabled={!selectedUpazilaTitle}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-slate-100"
            >
              <option value="">{selectedUpazilaTitle ? 'Select village' : 'Select upazila first'}</option>
              {villageOptions.map((village) => (
                <option key={`${field.name}-${village}`} value={village}>{village}</option>
              ))}
            </select>
          </div>
        );
      }

      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
          <input
            type="text"
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
            placeholder={field.placeholder || 'Enter village name'}
          />
          <p className="text-xs text-slate-500 mt-1">Village auto-dropdown appears when admin configures villages for selected upazila.</p>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
          <textarea
            required={required}
            rows={4}
            value={String(value || '')}
            onChange={setText(field.name)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
            placeholder={field.placeholder || `Enter ${label.toLowerCase()}`}
          />
        </div>
      );
    }

    if (field.type === 'select') {
      const options = parseSelectOptions(field);
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">Select {label.toLowerCase()}</option>
            {options.map((option) => (
              <option key={`${field.name}-${option.value}`} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <label key={field.name} className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={Boolean(value)} onChange={setChecked(field.name)} required={required} />
          {label}
        </label>
      );
    }

    if (field.type === 'file') {
      const maxSizeKb = field.maxSizeKb || (resolveUploadKind(field) === 'additional' ? 5120 : 500);
      const hasValue = String(value || '').trim().length > 0;
      return (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
          <label className="flex items-center gap-2 px-3 py-2.5 border border-slate-300 rounded-xl text-sm cursor-pointer hover:bg-slate-50">
            {uploadingField === field.name ? <Loader2 size={16} className="animate-spin text-slate-500" /> : <UploadCloud size={16} className="text-slate-500" />}
            <span>{uploadingField === field.name ? 'Uploading…' : 'Choose file'}</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={onUploadFile(field)}
              className="hidden"
            />
          </label>
          <p className="text-xs text-slate-500 mt-1">Allowed: JPG, PNG, WEBP, PDF. Max size: {maxSizeKb >= 1024 ? `${Math.round(maxSizeKb / 1024)}MB` : `${maxSizeKb}KB`}.</p>
          {hasValue && uploadingField !== field.name && <p className="text-xs text-green-600 mt-1">File uploaded successfully.</p>}
        </div>
      );
    }

    const htmlType = field.type === 'email' || field.type === 'tel' || field.type === 'number' || field.type === 'date' ? field.type : 'text';
    return (
      <div key={field.name}>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required ? ' *' : ''}</label>
        <input
          type={htmlType}
          required={required}
          value={String(value || '')}
          onChange={setText(field.name)}
          min={field.min}
          max={field.max}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
          placeholder={field.placeholder || `Enter ${label.toLowerCase()}`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Beneficiary Project Application</h3>
          <p className="text-sm text-slate-500 mt-1">Only volunteers can submit. Admin reviews and decides next actions (assign, tag donor, project/fundraising workflow).</p>
        </div>
        <button
          type="button"
          onClick={loadMyApplications}
          className="shrink-0 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {bootLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
          <Loader2 size={22} className="animate-spin mx-auto mb-2 text-primary-500" />
          Loading beneficiary application form…
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          {schema.map((field) => renderField(field))}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || Boolean(uploadingField)}
              className="px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Submit Beneficiary Application'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-800">My Submitted Applications</h4>
        </div>

        {rowsLoading ? (
          <div className="p-8 text-center text-slate-500">
            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-primary-500" />
            Loading applications…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No beneficiary applications submitted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Project Type</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.application_id} className="border-t">
                    <td className="px-4 py-3 text-slate-800 font-medium">{row.full_name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.project_type || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.project_amount_taka ? `৳${Number(row.project_amount_taka).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs px-2 py-1 rounded-full font-medium ${STATUS_CLASS[row.status] || 'bg-slate-100 text-slate-700'}`}>
                        {row.status}
                      </span>
                      {row.review_notes && <p className="text-xs text-slate-500 mt-1 max-w-sm">{row.review_notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
