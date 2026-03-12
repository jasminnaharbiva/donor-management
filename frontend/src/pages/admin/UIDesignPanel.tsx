import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Palette, Type, Square, Layout, Sidebar, Table2, AlignLeft, AlignCenter, AlignRight, Save, RotateCcw, Eye, Loader2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { useTheme, UiSettings } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type SettingRow = { setting_key: string; setting_value: string; value_type: string; description: string; };

const FONT_OPTIONS = [
  { label: 'Inter (Default)',          value: "'Inter', sans-serif" },
  { label: 'Poppins',                  value: "'Poppins', sans-serif" },
  { label: 'Roboto',                   value: "'Roboto', sans-serif" },
  { label: 'Open Sans',                value: "'Open Sans', sans-serif" },
  { label: 'Lato',                     value: "'Lato', sans-serif" },
  { label: 'Montserrat',               value: "'Montserrat', sans-serif" },
  { label: 'Nunito',                   value: "'Nunito', sans-serif" },
  { label: 'Raleway',                  value: "'Raleway', sans-serif" },
  { label: 'Plus Jakarta Sans',        value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Merriweather (Serif)',     value: "'Merriweather', serif" },
  { label: 'Playfair Display (Serif)', value: "'Playfair Display', serif" },
];
const WEIGHT_OPTIONS = ['300','400','500','600','700','800'];
const RADIUS_PRESETS = [
  { label: 'None (0px)',    value: '0px' },
  { label: 'Sharp (2px)',   value: '2px' },
  { label: 'Slight (4px)',  value: '4px' },
  { label: 'Rounded (8px)', value: '8px' },
  { label: 'More (12px)',   value: '12px' },
  { label: 'Large (16px)',  value: '16px' },
  { label: 'Pill (9999px)', value: '9999px' },
];
const SHADOW_OPTS = ['none','sm','md','lg','xl'];
const ALIGN_OPTS: Array<{ v: string; icon: ReactNode }> = [
  { v: 'left',   icon: <AlignLeft size={16} /> },
  { v: 'center', icon: <AlignCenter size={16} /> },
  { v: 'right',  icon: <AlignRight size={16} /> },
];

// ─── helpers ─────────────────────────────────────────────────────────────────
function ColorPicker({ label, settingKey, value, onChange }: { label: string; settingKey: string; value: string; onChange: (k: string, v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={e => onChange(settingKey, e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-slate-200 p-0.5 bg-white" />
        <input type="text" value={value || ''} onChange={e => onChange(settingKey, e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white focus:ring-2 focus:ring-primary-400 outline-none" />
      </div>
    </div>
  );
}

function SelectPicker({ label, settingKey, value, options, onChange }: { label: string; settingKey: string; value: string; options: Array<{ label: string; value: string }>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <select value={value} onChange={e => onChange(settingKey, e.target.value)}
        className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-400 outline-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextPicker({ label, settingKey, value, onChange, placeholder }: { label: string; settingKey: string; value: string; onChange: (k: string, v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input type="text" value={value || ''} placeholder={placeholder}
        onChange={e => onChange(settingKey, e.target.value)}
        className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-400 outline-none" />
    </div>
  );
}

function AlignPicker({ label, settingKey, value, onChange }: { label: string; settingKey: string; value: string; onChange: (k: string, v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="flex gap-1">
        {ALIGN_OPTS.map(a => (
          <button key={a.v} onClick={() => onChange(settingKey, a.v)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border transition-colors text-sm ${value === a.v ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-slate-200 text-slate-600 hover:border-primary-400'}`}>
            {a.icon}<span className="capitalize hidden sm:inline">{a.v}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          {icon}<span>{title}</span>
        </div>
        {open ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
      </button>
      {open && <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{children}</div>}
    </div>
  );
}

// ─── Preview Banner ───────────────────────────────────────────────────────────
function PreviewBanner({ vals }: { vals: Record<string, string> }) {
  const bg = vals['ui.btn_primary_bg'] || '#0284c7';
  const txt = vals['ui.btn_primary_text'] || '#ffffff';
  const radius = vals['ui.btn_border_radius'] || '8px';
  const hover = vals['ui.btn_primary_hover_bg'] || '#0369a1';
  const [hov, setHov] = useState(false);

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
        <Eye size={16} /><span>Live Preview</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Button preview */}
        <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl">
          <span className="text-xs text-slate-500 mb-1">Primary Button</span>
          <button
            style={{ backgroundColor: hov ? hover : bg, color: txt, borderRadius: radius, fontWeight: vals['ui.btn_font_weight'] || '600', padding: '8px 20px' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            className="transition-all duration-200 text-sm shadow">
            Save Changes
          </button>
        </div>
        {/* H1 preview */}
        <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl">
          <span className="text-xs text-slate-500">H1 / H2</span>
          <p style={{ fontSize: 'clamp(1rem,2vw,1.25rem)', fontWeight: vals['ui.h1_weight'] || '700', color: vals['ui.h1_color'] || '#0f172a', fontFamily: vals['ui.font_family_heading'] || 'inherit', textAlign: (vals['ui.heading_alignment'] as 'left'|'center'|'right') || 'left' }}>
            Dashboard Header
          </p>
          <p style={{ fontSize: '0.95rem', fontWeight: vals['ui.h2_weight'] || '700', color: vals['ui.h2_color'] || '#1e293b', fontFamily: vals['ui.font_family_heading'] || 'inherit', textAlign: (vals['ui.heading_alignment'] as 'left'|'center'|'right') || 'left' }}>
            Section Title
          </p>
        </div>
        {/* Card preview */}
        <div className="p-4 bg-slate-50 rounded-xl">
          <span className="text-xs text-slate-500 block mb-2">Card / Panel</span>
          <div style={{ borderRadius: vals['ui.card_border_radius'] || '12px', backgroundColor: vals['ui.surface_color'] || '#ffffff', boxShadow: vals['ui.shadow_intensity'] === 'none' ? 'none' : '0 2px 8px rgb(0 0 0/0.08)', padding: '10px 14px', border: `1px solid ${vals['ui.input_border_color'] || '#cbd5e1'}` }}>
            <p className="text-xs text-slate-600" style={{ fontFamily: vals['ui.font_family_body'] || 'inherit' }}>Card content goes here</p>
          </div>
        </div>
        {/* Input preview */}
        <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl">
          <span className="text-xs text-slate-500">Form Input</span>
          <input type="text" defaultValue="Search..." readOnly
            style={{ borderRadius: vals['ui.btn_border_radius'] || '8px', borderColor: vals['ui.input_border_color'] || '#cbd5e1', fontFamily: vals['ui.font_family_body'] || 'inherit', fontSize: vals['ui.body_font_size'] || '1rem' }}
            className="px-3 py-1.5 text-sm border bg-white outline-none" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UIDesignPanel() {
  const { applyTheme, refetch } = useTheme();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings?category=ui');
      const rows: SettingRow[] = res.data.data;
      const m: Record<string, string> = {};
      rows.forEach(r => { m[r.setting_key] = r.setting_value; });
      setVals(m);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const change = (key: string, val: string) => {
    setVals(prev => {
      const next = { ...prev, [key]: val };
      // Live preview via ThemeContext
      applyTheme(next as Partial<UiSettings>);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(vals).map(([key, value]) => ({ key, value }));
      await api.put('/admin/settings', { updates });
      await refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all UI design settings to defaults?')) return;
    const defaults: Record<string, string> = {
      'ui.primary_color': '#0284c7', 'ui.secondary_color': '#7c3aed',
      'ui.background_color': '#f8fafc', 'ui.surface_color': '#ffffff',
      'ui.text_primary_color': '#111827', 'ui.text_secondary_color': '#6b7280',
      'ui.success_color': '#16a34a', 'ui.warning_color': '#d97706', 'ui.danger_color': '#dc2626',
      'ui.btn_primary_bg': '#0284c7', 'ui.btn_primary_text': '#ffffff',
      'ui.btn_primary_hover_bg': '#0369a1', 'ui.btn_secondary_bg': '#f1f5f9', 'ui.btn_secondary_text': '#334155',
      'ui.btn_border_radius': '8px', 'ui.btn_font_weight': '600', 'ui.btn_alignment': 'center',
      'ui.font_family_body': "'Inter', sans-serif", 'ui.font_family_heading': "'Inter', sans-serif",
      'ui.body_font_size': '1rem',
      'ui.h1_size': '2rem', 'ui.h1_weight': '700', 'ui.h1_color': '#0f172a',
      'ui.h2_size': '1.5rem', 'ui.h2_weight': '700', 'ui.h2_color': '#1e293b',
      'ui.admin_h2_size': '1rem', 'ui.admin_h2_weight': '600',
      'ui.h3_size': '1.25rem', 'ui.h3_weight': '600', 'ui.h3_color': '#334155',
      'ui.h4_size': '1rem', 'ui.h4_weight': '600', 'ui.h4_color': '#475569',
      'ui.heading_alignment': 'left',
      'ui.card_border_radius': '12px', 'ui.shadow_intensity': 'md',
      'ui.sidebar_bg': '#ffffff', 'ui.sidebar_text': '#334155',
      'ui.sidebar_active_bg': '#eff6ff', 'ui.sidebar_active_text': '#0284c7',
      'ui.table_header_bg': '#f8fafc', 'ui.table_row_hover_bg': '#f0f9ff',
      'ui.input_border_color': '#cbd5e1', 'ui.input_focus_color': '#0284c7',
    };
    setVals(prev => ({ ...prev, ...defaults }));
    applyTheme(defaults as Partial<UiSettings>);
  };

  const g = (key: string, fallback = '') => vals[key] ?? fallback;

  if (loading) {
    return <div className="flex justify-center p-16"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center justify-center sm:justify-start gap-2">
          <Palette className="text-primary-500" /> UI Design Studio
        </h2>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button onClick={reset} className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-sm">
            <RotateCcw size={16} /> Reset Defaults
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center justify-center sm:justify-start gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <PreviewBanner vals={vals} />

      {/* Brand Colors */}
      <Section title="Brand Colors" icon={<Palette size={18} className="text-primary-500" />}>
        <ColorPicker label="Primary Color" settingKey="ui.primary_color" value={g('ui.primary_color')} onChange={change} />
        <ColorPicker label="Secondary Color" settingKey="ui.secondary_color" value={g('ui.secondary_color')} onChange={change} />
        <ColorPicker label="Page Background" settingKey="ui.background_color" value={g('ui.background_color')} onChange={change} />
        <ColorPicker label="Surface / Card BG" settingKey="ui.surface_color" value={g('ui.surface_color')} onChange={change} />
        <ColorPicker label="Text Primary" settingKey="ui.text_primary_color" value={g('ui.text_primary_color')} onChange={change} />
        <ColorPicker label="Text Secondary" settingKey="ui.text_secondary_color" value={g('ui.text_secondary_color')} onChange={change} />
        <ColorPicker label="Success Color" settingKey="ui.success_color" value={g('ui.success_color')} onChange={change} />
        <ColorPicker label="Warning Color" settingKey="ui.warning_color" value={g('ui.warning_color')} onChange={change} />
        <ColorPicker label="Danger / Error Color" settingKey="ui.danger_color" value={g('ui.danger_color')} onChange={change} />
      </Section>

      {/* Buttons */}
      <Section title="Button Styles" icon={<Square size={18} className="text-emerald-500" />}>
        <ColorPicker label="Primary BG Color" settingKey="ui.btn_primary_bg" value={g('ui.btn_primary_bg')} onChange={change} />
        <ColorPicker label="Primary Text Color" settingKey="ui.btn_primary_text" value={g('ui.btn_primary_text')} onChange={change} />
        <ColorPicker label="Primary Hover BG" settingKey="ui.btn_primary_hover_bg" value={g('ui.btn_primary_hover_bg')} onChange={change} />
        <ColorPicker label="Secondary BG Color" settingKey="ui.btn_secondary_bg" value={g('ui.btn_secondary_bg')} onChange={change} />
        <ColorPicker label="Secondary Text Color" settingKey="ui.btn_secondary_text" value={g('ui.btn_secondary_text')} onChange={change} />
        <SelectPicker label="Border Radius" settingKey="ui.btn_border_radius" value={g('ui.btn_border_radius', '8px')} onChange={change}
          options={RADIUS_PRESETS} />
        <SelectPicker label="Font Weight" settingKey="ui.btn_font_weight" value={g('ui.btn_font_weight','600')} onChange={change}
          options={WEIGHT_OPTIONS.map(w => ({ label: w, value: w }))} />
        <AlignPicker label="Button Alignment" settingKey="ui.btn_alignment" value={g('ui.btn_alignment','center')} onChange={change} />
      </Section>

      {/* Typography */}
      <Section title="Typography" icon={<Type size={18} className="text-violet-500" />}>
        <SelectPicker label="Body Font Family" settingKey="ui.font_family_body" value={g('ui.font_family_body')} onChange={change}
          options={FONT_OPTIONS} />
        <SelectPicker label="Heading Font Family" settingKey="ui.font_family_heading" value={g('ui.font_family_heading')} onChange={change}
          options={FONT_OPTIONS} />
        <TextPicker label="Body Font Size" settingKey="ui.body_font_size" value={g('ui.body_font_size')} onChange={change} placeholder="1rem" />
        <AlignPicker label="Heading Alignment" settingKey="ui.heading_alignment" value={g('ui.heading_alignment','left')} onChange={change} />

        {/* H1 */}
        <div className="col-span-full"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">H1 Style</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextPicker label="H1 Size" settingKey="ui.h1_size" value={g('ui.h1_size')} onChange={change} placeholder="2rem" />
            <SelectPicker label="H1 Weight" settingKey="ui.h1_weight" value={g('ui.h1_weight','700')} onChange={change}
              options={WEIGHT_OPTIONS.map(w => ({ label: w, value: w }))} />
            <ColorPicker label="H1 Color" settingKey="ui.h1_color" value={g('ui.h1_color')} onChange={change} />
          </div>
        </div>
        {/* H2 */}
        <div className="col-span-full"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">H2 Style</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextPicker label="H2 Size" settingKey="ui.h2_size" value={g('ui.h2_size')} onChange={change} placeholder="1.5rem" />
            <SelectPicker label="H2 Weight" settingKey="ui.h2_weight" value={g('ui.h2_weight','700')} onChange={change}
              options={WEIGHT_OPTIONS.map(w => ({ label: w, value: w }))} />
            <ColorPicker label="H2 Color" settingKey="ui.h2_color" value={g('ui.h2_color')} onChange={change} />
          </div>
        </div>
        {/* Admin H2 */}
        <div className="col-span-full"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Admin Section Heading (H2)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextPicker label="Admin H2 Size" settingKey="ui.admin_h2_size" value={g('ui.admin_h2_size','1rem')} onChange={change} placeholder="1rem" />
            <SelectPicker label="Admin H2 Weight" settingKey="ui.admin_h2_weight" value={g('ui.admin_h2_weight','600')} onChange={change}
              options={WEIGHT_OPTIONS.map(w => ({ label: w, value: w }))} />
          </div>
        </div>
        {/* H3 */}
        <div className="col-span-full"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">H3 Style</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextPicker label="H3 Size" settingKey="ui.h3_size" value={g('ui.h3_size')} onChange={change} placeholder="1.25rem" />
            <SelectPicker label="H3 Weight" settingKey="ui.h3_weight" value={g('ui.h3_weight','600')} onChange={change}
              options={WEIGHT_OPTIONS.map(w => ({ label: w, value: w }))} />
            <ColorPicker label="H3 Color" settingKey="ui.h3_color" value={g('ui.h3_color')} onChange={change} />
          </div>
        </div>
        {/* H4 */}
        <div className="col-span-full"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">H4 Style</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextPicker label="H4 Size" settingKey="ui.h4_size" value={g('ui.h4_size')} onChange={change} placeholder="1rem" />
            <SelectPicker label="H4 Weight" settingKey="ui.h4_weight" value={g('ui.h4_weight','600')} onChange={change}
              options={WEIGHT_OPTIONS.map(w => ({ label: w, value: w }))} />
            <ColorPicker label="H4 Color" settingKey="ui.h4_color" value={g('ui.h4_color')} onChange={change} />
          </div>
        </div>
      </Section>

      {/* Layout */}
      <Section title="Cards & Layout" icon={<Layout size={18} className="text-amber-500" />}>
        <SelectPicker label="Card Border Radius" settingKey="ui.card_border_radius" value={g('ui.card_border_radius','12px')} onChange={change}
          options={RADIUS_PRESETS} />
        <SelectPicker label="Shadow Intensity" settingKey="ui.shadow_intensity" value={g('ui.shadow_intensity','md')} onChange={change}
          options={SHADOW_OPTS.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))} />
        <ColorPicker label="Input Border Color" settingKey="ui.input_border_color" value={g('ui.input_border_color')} onChange={change} />
        <ColorPicker label="Input Focus Ring" settingKey="ui.input_focus_color" value={g('ui.input_focus_color')} onChange={change} />
      </Section>

      {/* Sidebar */}
      <Section title="Sidebar Colors" icon={<Sidebar size={18} className="text-sky-500" />} defaultOpen={false}>
        <ColorPicker label="Sidebar Background" settingKey="ui.sidebar_bg" value={g('ui.sidebar_bg')} onChange={change} />
        <ColorPicker label="Sidebar Text" settingKey="ui.sidebar_text" value={g('ui.sidebar_text')} onChange={change} />
        <ColorPicker label="Active Item BG" settingKey="ui.sidebar_active_bg" value={g('ui.sidebar_active_bg')} onChange={change} />
        <ColorPicker label="Active Item Text" settingKey="ui.sidebar_active_text" value={g('ui.sidebar_active_text')} onChange={change} />
      </Section>

      {/* Tables */}
      <Section title="Table Colors" icon={<Table2 size={18} className="text-teal-500" />} defaultOpen={false}>
        <ColorPicker label="Table Header BG" settingKey="ui.table_header_bg" value={g('ui.table_header_bg')} onChange={change} />
        <ColorPicker label="Row Hover BG" settingKey="ui.table_row_hover_bg" value={g('ui.table_row_hover_bg')} onChange={change} />
      </Section>

      {/* Save footer */}
      <div className="flex justify-end gap-3 pb-6">
        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-sm">
          <RotateCcw size={16} /> Reset
        </button>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
