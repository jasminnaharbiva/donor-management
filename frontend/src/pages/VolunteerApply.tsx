import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { divisions_en, districts_en, upazilas_en, type LocationItem } from 'bangladesh-location-data';
import api from '../services/api';

type FieldType = 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'consent' | 'bd_division' | 'bd_district' | 'bd_upazila';

type SchemaField = {
  name: string;
  label?: string;
  type?: FieldType | string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<string | { label?: string; title?: string; value?: string | number }>;
};

type FormValues = Record<string, string | boolean | number>;

const DEFAULT_SCHEMA: SchemaField[] = [
  { name: 'full_name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your full name' },
  { name: 'father_name', label: "Father's Name", type: 'text', required: true, placeholder: "Enter your father's name" },
  { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
  { name: 'blood_group', label: 'Blood Group', type: 'select', required: true, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  { name: 'education_level', label: 'Education Level', type: 'select', required: true, options: ['Primary', 'Secondary', 'SSC', 'HSC', 'Diploma', 'Graduate', 'Post Graduate', 'Other'] },
  { name: 'mobile_number', label: 'Mobile Number', type: 'tel', required: true, placeholder: '01XXXXXXXXX' },
  { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
  { name: 'nid_or_birth_certificate_no', label: 'NID/Birth Certificate Number', type: 'text', required: true, placeholder: 'NID or Birth Certificate Number' },
  { name: 'division', label: 'Division', type: 'bd_division', required: true },
  { name: 'district', label: 'District', type: 'bd_district', required: true },
  { name: 'upazila', label: 'Upazila', type: 'bd_upazila', required: true },
  { name: 'full_address', label: 'Full Address', type: 'textarea', required: true, placeholder: 'Village/Road, Post Office, Thana/Upazila, District' },
  { name: 'passport_photo_url', label: 'Passport Size Photo (max 500KB)', type: 'file', required: true },
  { name: 'identity_document_url', label: 'NID/Birth Certificate Copy (max 500KB)', type: 'file', required: true },
  { name: 'consent', label: 'Consent', type: 'consent', required: true },
];

function isDivisionField(field: SchemaField): boolean {
  return field.name === 'division' || field.type === 'bd_division';
}

function isDistrictField(field: SchemaField): boolean {
  return field.name === 'district' || field.type === 'bd_district';
}

function isUpazilaField(field: SchemaField): boolean {
  return field.name === 'upazila' || field.type === 'bd_upazila';
}

function getFieldLabel(field: SchemaField): string {
  if (field.label && field.label.trim()) return field.label.trim();
  return field.name.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
}

function getInitialValues(fields: SchemaField[]): FormValues {
  const initial: FormValues = {};
  fields.forEach((field) => {
    if (field.type === 'checkbox' || field.type === 'consent' || field.name === 'consent') {
      initial[field.name] = false;
    } else {
      initial[field.name] = '';
    }
  });
  return initial;
}

function parseSelectOptions(field: SchemaField): Array<{ label: string; value: string }> {
  if (!Array.isArray(field.options)) return [];
  return field.options
    .map((opt) => {
      if (typeof opt === 'string') return { label: opt, value: opt };
      const label = String(opt.label || opt.title || opt.value || '').trim();
      const value = String(opt.value ?? label).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((x): x is { label: string; value: string } => Boolean(x));
}

export default function VolunteerApply() {
  const [schema, setSchema] = useState<SchemaField[]>(DEFAULT_SCHEMA);
  const [form, setForm] = useState<FormValues>(() => getInitialValues(DEFAULT_SCHEMA));
  const [consentText, setConsentText] = useState('I consent to data processing for volunteer application and verification.');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadMeta = async () => {
      setBootLoading(true);
      try {
        const [schemaRes, settingsRes] = await Promise.allSettled([
          api.get('/form-schemas/type/volunteer_application'),
          api.get('/public/settings'),
        ]);

        let nextSchema = DEFAULT_SCHEMA;
        if (schemaRes.status === 'fulfilled') {
          const raw = schemaRes.value?.data?.schema_json;
          if (Array.isArray(raw) && raw.length > 0) {
            nextSchema = raw as SchemaField[];
          }
        }
        setSchema(nextSchema);
        setForm(getInitialValues(nextSchema));

        if (settingsRes.status === 'fulfilled') {
          const settings = settingsRes.value?.data?.data || {};
          const dynamicConsent = String(
            settings['legal.volunteer_application_consent_text'] ||
            settings['legal.gdpr_consent_text'] ||
            ''
          ).trim();
          if (dynamicConsent) setConsentText(dynamicConsent);
        }
      } catch {
        setSchema(DEFAULT_SCHEMA);
        setForm(getInitialValues(DEFAULT_SCHEMA));
      } finally {
        setBootLoading(false);
      }
    };

    loadMeta();
  }, []);

  const selectedDivision = useMemo(() => {
    const divisionTitle = String(form.division || '').trim();
    return divisions_en.find((item) => item.title === divisionTitle) || null;
  }, [form.division]);

  const districtOptions = useMemo(() => {
    if (!selectedDivision) return [] as LocationItem[];
    return districts_en[String(selectedDivision.value)] || [];
  }, [selectedDivision]);

  const selectedDistrict = useMemo(() => {
    const districtTitle = String(form.district || '').trim();
    return districtOptions.find((item) => item.title === districtTitle) || null;
  }, [districtOptions, form.district]);

  const upazilaOptions = useMemo(() => {
    if (!selectedDistrict) return [] as LocationItem[];
    return upazilas_en[String(selectedDistrict.value)] || [];
  }, [selectedDistrict]);

  useEffect(() => {
    if (!form.district) return;
    const stillValid = districtOptions.some((d) => d.title === form.district);
    if (!stillValid) {
      setForm((prev) => ({ ...prev, district: '', upazila: '' }));
    }
  }, [districtOptions, form.district]);

  useEffect(() => {
    if (!form.upazila) return;
    const stillValid = upazilaOptions.some((u) => u.title === form.upazila);
    if (!stillValid) {
      setForm((prev) => ({ ...prev, upazila: '' }));
    }
  }, [upazilaOptions, form.upazila]);

  const setText =
    (key: string) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const setChecked = (key: string) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.checked }));
  };

  const onUploadFile = (key: string) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setError('Each uploaded file must be less than 500KB.');
      e.target.value = '';
      return;
    }

    setError('');
    setUploadingField(key);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'kyc_document');
      formData.append('referenceType', 'volunteer_application');

      const res = await api.post('/media/public-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = String(res.data?.data?.url || '').trim();
      if (!uploadedUrl) throw new Error('Upload failed. Please try again.');

      setForm((prev) => ({ ...prev, [key]: uploadedUrl }));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'File upload failed.');
      setForm((prev) => ({ ...prev, [key]: '' }));
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  const validateBeforeSubmit = (): string | null => {
    for (const field of schema) {
      if (!field.required) continue;
      const val = form[field.name];

      if (field.type === 'checkbox' || field.type === 'consent' || field.name === 'consent') {
        if (val !== true) return `${getFieldLabel(field)} is required.`;
        continue;
      }

      if (String(val || '').trim().length === 0) {
        return `${getFieldLabel(field)} is required.`;
      }
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await api.post('/volunteer-applications', {
        fields: {
          ...form,
          email: String(form.email || '').trim().toLowerCase(),
          consent: Boolean(form.consent),
        },
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit application.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 text-center shadow-2xl">
          <CheckCircle className="mx-auto text-green-500 mb-3" size={42} />
          <h1 className="text-xl font-bold text-slate-800">Application Submitted</h1>
          <p className="text-slate-600 mt-2 text-sm">
            Your volunteer application has been submitted successfully. After approval, you can log in to the volunteer panel.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/login?panel=volunteer" className="bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-semibold">Volunteer Login</Link>
            <Link to="/" className="text-slate-600 hover:text-slate-800 text-sm">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (bootLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4 flex items-center justify-center">
        <div className="w-full max-w-md bg-white/10 border border-white/20 rounded-2xl p-8 text-center text-white">
          <Loader2 className="mx-auto mb-3 animate-spin" size={24} />
          <p className="text-sm text-slate-200">Loading volunteer application form…</p>
        </div>
      </div>
    );
  }

  const renderField = (field: SchemaField) => {
    const value = form[field.name];
    const label = getFieldLabel(field);
    const required = Boolean(field.required);

    if (field.type === 'consent' || field.name === 'consent') {
      return (
        <label key={field.name} className="flex items-start gap-3 p-3 rounded-xl border border-white/20 bg-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={setChecked(field.name)}
            className="mt-1"
            required={required}
          />
          <span className="text-sm text-slate-100">{consentText}</span>
        </label>
      );
    }

    if (isDivisionField(field)) {
      return (
        <div key={field.name}>
          <label className="block text-sm mb-1.5 text-slate-200">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
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
          <label className="block text-sm mb-1.5 text-slate-200">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            disabled={!selectedDivision}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-60"
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
          <label className="block text-sm mb-1.5 text-slate-200">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            disabled={!selectedDistrict}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-60"
          >
            <option value="">{selectedDistrict ? 'Select upazila' : 'Select district first'}</option>
            {upazilaOptions.map((upazila) => (
              <option key={upazila.value} value={upazila.title}>{upazila.title}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.name}>
          <label className="block text-sm mb-1.5 text-slate-200">{label}{required ? ' *' : ''}</label>
          <textarea
            required={required}
            rows={4}
            value={String(value || '')}
            onChange={setText(field.name)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
            placeholder={field.placeholder || `Enter ${label.toLowerCase()}`}
          />
        </div>
      );
    }

    if (field.type === 'select') {
      const options = parseSelectOptions(field);
      return (
        <div key={field.name}>
          <label className="block text-sm mb-1.5 text-slate-200">{label}{required ? ' *' : ''}</label>
          <select
            required={required}
            value={String(value || '')}
            onChange={setText(field.name)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
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
        <label key={field.name} className="flex items-center gap-2 text-sm text-slate-100">
          <input type="checkbox" checked={Boolean(value)} onChange={setChecked(field.name)} required={required} />
          {label}
        </label>
      );
    }

    if (field.type === 'file') {
      const hasValue = String(value || '').trim().length > 0;
      return (
        <div key={field.name}>
          <label className="block text-sm mb-1.5 text-slate-200">{label}{required ? ' *' : ''}</label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={onUploadFile(field.name)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
          />
          <p className="text-xs text-slate-300 mt-1">Allowed: JPG, PNG, WEBP, PDF. Max file size: 500KB.</p>
          {uploadingField === field.name && (
            <p className="text-xs text-primary-200 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading...</p>
          )}
          {hasValue && uploadingField !== field.name && (
            <p className="text-xs text-green-300 mt-1">File uploaded successfully.</p>
          )}
        </div>
      );
    }

    const htmlType = field.type === 'email' || field.type === 'tel' || field.type === 'number' || field.type === 'date'
      ? field.type
      : 'text';

    return (
      <div key={field.name}>
        <label className="block text-sm mb-1.5 text-slate-200">{label}{required ? ' *' : ''}</label>
        <input
          type={htmlType}
          required={required}
          value={String(value || '')}
          onChange={setText(field.name)}
          min={field.min}
          max={field.max}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-400"
          placeholder={field.placeholder || `Enter ${label.toLowerCase()}`}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white/10 border border-white/20 rounded-2xl p-6 sm:p-8 shadow-2xl text-white">
        <h1 className="text-xl sm:text-2xl font-bold">Volunteer Registration</h1>
        <p className="text-slate-300 text-sm mt-1 mb-5">Apply to join the volunteer panel. Fields can be updated by admin dynamically.</p>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {schema.map((field) => renderField(field))}

          <button
            type="submit"
            disabled={loading || Boolean(uploadingField)}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit Application'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          <Link to="/auth?mode=login" className="text-slate-300 hover:text-white">Choose another panel</Link>
        </div>
      </div>
    </div>
  );
}
