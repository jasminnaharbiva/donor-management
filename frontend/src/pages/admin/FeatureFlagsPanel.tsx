import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Flag {
  flag_id: number;
  flag_name: string;
  is_enabled: boolean;
  description?: string;
  updated_at: string;
}

export default function FeatureFlagsPanel() {
  const [flags, setFlags]   = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/feature-flags');
      setFlags(res.data.data);
    } catch { setError('Failed to load feature flags'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (flag: Flag) => {
    setSaving(flag.flag_name);
    try {
      await api.patch(`/feature-flags/${flag.flag_name}`, { isEnabled: !flag.is_enabled });
      setFlags(fs => fs.map(f => f.flag_name === flag.flag_name ? { ...f, is_enabled: !flag.is_enabled } : f));
    } catch { setError('Failed to update flag'); }
    setSaving(null);
  };

  const grouped = flags.reduce<Record<string, Flag[]>>((acc, f) => {
    const group = f.flag_name.includes('payment') ? 'Payments' :
                  f.flag_name.includes('portal') || f.flag_name.includes('registration') ? 'User Access' :
                  f.flag_name.includes('ai') || f.flag_name.includes('blockchain') || f.flag_name.includes('matching') ? 'Advanced' :
                  'Features';
    if (!acc[group]) acc[group] = [];
    acc[group].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Feature Flags</h2>
        <p className="text-sm text-slate-500">Changes take effect within 30 seconds across all clients.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupFlags]) => (
            <div key={group} className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b">
                <h3 className="font-semibold text-slate-800">{group}</h3>
              </div>
              <div className="divide-y">
                {groupFlags.map(flag => (
                  <div key={flag.flag_id} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="font-medium text-slate-900 font-mono text-sm">{flag.flag_name}</p>
                      {flag.description && <p className="text-sm text-slate-500 mt-0.5">{flag.description}</p>}
                    </div>
                    <button
                      onClick={() => toggle(flag)}
                      disabled={saving === flag.flag_name}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${flag.is_enabled ? 'bg-green-500' : 'bg-slate-300'} ${saving === flag.flag_name ? 'opacity-50' : ''}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flag.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {flags.length === 0 && <div className="text-center py-12 text-slate-500">No feature flags found.</div>}
        </div>
      )}
    </div>
  );
}
