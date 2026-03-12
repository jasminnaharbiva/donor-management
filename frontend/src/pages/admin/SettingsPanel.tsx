import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Save, Loader2 } from 'lucide-react';

interface Setting {
  setting_key: string;
  setting_value: string;
  description: string;
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data.data);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (key: string, value: string) => {
    setSaving(key);
    try {
      await api.put(`/admin/settings/${key}`, { value });
      setSettings(settings.map(s => s.setting_key === key ? { ...s, setting_value: value } : s));
    } catch (err) {
      console.error('Failed to update setting', err);
      alert('Failed to update setting');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-4">Global System Configurations</h2>
        
        <div className="space-y-6">
          {settings.map((setting) => (
            <div key={setting.setting_key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 transition-all hover:border-primary-200">
              <div className="flex-1">
                <label className="text-sm font-bold text-slate-700 block mb-1">{setting.setting_key}</label>
                <p className="text-xs text-slate-500">{setting.description}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none w-full sm:w-64"
                  defaultValue={setting.setting_value}
                  onBlur={(e) => {
                    if (e.target.value !== setting.setting_value) {
                      handleUpdate(setting.setting_key, e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       handleUpdate(setting.setting_key, e.currentTarget.value);
                       e.currentTarget.blur();
                    }
                  }}
                />
                <button 
                  className="text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 p-2 rounded-lg transition-colors"
                  title="Save change"
                >
                  {saving === setting.setting_key ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
