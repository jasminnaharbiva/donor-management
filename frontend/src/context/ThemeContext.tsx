import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import api from '../services/api';

export interface UiSettings {
  // Brand colors
  'ui.primary_color': string;
  'ui.secondary_color': string;
  'ui.background_color': string;
  'ui.surface_color': string;
  'ui.text_primary_color': string;
  'ui.text_secondary_color': string;
  'ui.success_color': string;
  'ui.warning_color': string;
  'ui.danger_color': string;
  // Buttons
  'ui.btn_primary_bg': string;
  'ui.btn_primary_text': string;
  'ui.btn_primary_hover_bg': string;
  'ui.btn_secondary_bg': string;
  'ui.btn_secondary_text': string;
  'ui.btn_border_radius': string;
  'ui.btn_font_weight': string;
  'ui.btn_alignment': string;
  // Typography
  'ui.font_family_body': string;
  'ui.font_family_heading': string;
  'ui.body_font_size': string;
  'ui.h1_size': string;
  'ui.h1_weight': string;
  'ui.h1_color': string;
  'ui.h2_size': string;
  'ui.h2_weight': string;
  'ui.h2_color': string;
  'ui.admin_h2_size': string;
  'ui.admin_h2_weight': string;
  'ui.h3_size': string;
  'ui.h3_weight': string;
  'ui.h3_color': string;
  'ui.h4_size': string;
  'ui.h4_weight': string;
  'ui.h4_color': string;
  'ui.heading_alignment': string;
  // Layout
  'ui.card_border_radius': string;
  'ui.shadow_intensity': string;
  // Sidebar
  'ui.sidebar_bg': string;
  'ui.sidebar_text': string;
  'ui.sidebar_active_bg': string;
  'ui.sidebar_active_text': string;
  // Table
  'ui.table_header_bg': string;
  'ui.table_row_hover_bg': string;
  // Inputs
  'ui.input_border_color': string;
  'ui.input_focus_color': string;
}

const DEFAULTS: UiSettings = {
  'ui.primary_color':         '#0284c7',
  'ui.secondary_color':       '#7c3aed',
  'ui.background_color':      '#f8fafc',
  'ui.surface_color':         '#ffffff',
  'ui.text_primary_color':    '#111827',
  'ui.text_secondary_color':  '#6b7280',
  'ui.success_color':         '#16a34a',
  'ui.warning_color':         '#d97706',
  'ui.danger_color':          '#dc2626',
  'ui.btn_primary_bg':        '#0284c7',
  'ui.btn_primary_text':      '#ffffff',
  'ui.btn_primary_hover_bg':  '#0369a1',
  'ui.btn_secondary_bg':      '#f1f5f9',
  'ui.btn_secondary_text':    '#334155',
  'ui.btn_border_radius':     '8px',
  'ui.btn_font_weight':       '600',
  'ui.btn_alignment':         'center',
  'ui.font_family_body':      "'Inter', sans-serif",
  'ui.font_family_heading':   "'Inter', sans-serif",
  'ui.body_font_size':        '1rem',
  'ui.h1_size':               '2rem',
  'ui.h1_weight':             '700',
  'ui.h1_color':              '#0f172a',
  'ui.h2_size':               '1.5rem',
  'ui.h2_weight':             '700',
  'ui.h2_color':              '#1e293b',
  'ui.admin_h2_size':         '1rem',
  'ui.admin_h2_weight':       '600',
  'ui.h3_size':               '1.25rem',
  'ui.h3_weight':             '600',
  'ui.h3_color':              '#334155',
  'ui.h4_size':               '1rem',
  'ui.h4_weight':             '600',
  'ui.h4_color':              '#475569',
  'ui.heading_alignment':     'left',
  'ui.card_border_radius':    '12px',
  'ui.shadow_intensity':      'md',
  'ui.sidebar_bg':            '#ffffff',
  'ui.sidebar_text':          '#334155',
  'ui.sidebar_active_bg':     '#eff6ff',
  'ui.sidebar_active_text':   '#0284c7',
  'ui.table_header_bg':       '#f8fafc',
  'ui.table_row_hover_bg':    '#f0f9ff',
  'ui.input_border_color':    '#cbd5e1',
  'ui.input_focus_color':     '#0284c7',
};

interface ThemeContextType {
  settings: UiSettings;
  applyTheme: (s: Partial<UiSettings>) => void;
  refetch: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  settings: DEFAULTS,
  applyTheme: () => {},
  refetch: async () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ---- Google Fonts map -------------------------------------------------------
const GFONTS: Record<string, string> = {
  "'Inter', sans-serif":          'Inter',
  "'Poppins', sans-serif":        'Poppins',
  "'Roboto', sans-serif":         'Roboto',
  "'Open Sans', sans-serif":      'Open+Sans',
  "'Lato', sans-serif":           'Lato',
  "'Montserrat', sans-serif":     'Montserrat',
  "'Nunito', sans-serif":         'Nunito',
  "'Raleway', sans-serif":        'Raleway',
  "'Plus Jakarta Sans', sans-serif": 'Plus+Jakarta+Sans',
  "'Merriweather', serif":        'Merriweather',
  "'Playfair Display', serif":    'Playfair+Display',
};

function injectGoogleFont(family: string) {
  const gName = GFONTS[family];
  if (!gName) return;
  const id = `gfont-${gName}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${gName}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

// ---- CSS generation --------------------------------------------------------
function buildCss(s: UiSettings): string {
  // Derive lighter shades for the primary palette used by Tailwind v4
  const p6 = s['ui.primary_color'];
  const p7 = s['ui.btn_primary_hover_bg'];
  const p5 = s['ui.btn_primary_bg'];
  const shadows: Record<string, string> = {
    none: 'none',
    sm:   '0 1px 2px 0 rgb(0 0 0/0.05)',
    md:   '0 4px 6px -1px rgb(0 0 0/0.1),0 2px 4px -2px rgb(0 0 0/0.1)',
    lg:   '0 10px 15px -3px rgb(0 0 0/0.1),0 4px 6px -4px rgb(0 0 0/0.1)',
    xl:   '0 20px 25px -5px rgb(0 0 0/0.1),0 8px 10px -6px rgb(0 0 0/0.1)',
  };
  const shadow = shadows[s['ui.shadow_intensity']] ?? shadows.md;

  return `
/* === DFB Theme Override (auto-generated) === */
:root {
  /* Primary palette overrides for Tailwind v4 */
  --color-primary-500: ${p5};
  --color-primary-600: ${p6};
  --color-primary-700: ${p7};
  --color-background-light: ${s['ui.background_color']};

  /* DFB custom vars */
  --dfb-btn-bg: ${s['ui.btn_primary_bg']};
  --dfb-btn-text: ${s['ui.btn_primary_text']};
  --dfb-btn-hover-bg: ${s['ui.btn_primary_hover_bg']};
  --dfb-btn-2-bg: ${s['ui.btn_secondary_bg']};
  --dfb-btn-2-text: ${s['ui.btn_secondary_text']};
  --dfb-btn-radius: ${s['ui.btn_border_radius']};
  --dfb-btn-weight: ${s['ui.btn_font_weight']};
  --dfb-btn-align: ${s['ui.btn_alignment']};
  --dfb-h1-size: ${s['ui.h1_size']};
  --dfb-h1-weight: ${s['ui.h1_weight']};
  --dfb-h1-color: ${s['ui.h1_color']};
  --dfb-h2-size: ${s['ui.h2_size']};
  --dfb-h2-weight: ${s['ui.h2_weight']};
  --dfb-h2-color: ${s['ui.h2_color']};
  --dfb-admin-h2-size: ${s['ui.admin_h2_size']};
  --dfb-admin-h2-weight: ${s['ui.admin_h2_weight']};
  --dfb-h3-size: ${s['ui.h3_size']};
  --dfb-h3-weight: ${s['ui.h3_weight']};
  --dfb-h3-color: ${s['ui.h3_color']};
  --dfb-h4-size: ${s['ui.h4_size']};
  --dfb-h4-weight: ${s['ui.h4_weight']};
  --dfb-h4-color: ${s['ui.h4_color']};
  --dfb-heading-align: ${s['ui.heading_alignment']};
  --dfb-font-body: ${s['ui.font_family_body']};
  --dfb-font-heading: ${s['ui.font_family_heading']};
  --dfb-body-size: ${s['ui.body_font_size']};
  --dfb-card-radius: ${s['ui.card_border_radius']};
  --dfb-shadow: ${shadow};
  --dfb-sidebar-bg: ${s['ui.sidebar_bg']};
  --dfb-sidebar-text: ${s['ui.sidebar_text']};
  --dfb-sidebar-active-bg: ${s['ui.sidebar_active_bg']};
  --dfb-sidebar-active-text: ${s['ui.sidebar_active_text']};
  --dfb-table-hdr: ${s['ui.table_header_bg']};
  --dfb-table-hover: ${s['ui.table_row_hover_bg']};
  --dfb-input-border: ${s['ui.input_border_color']};
  --dfb-input-focus: ${s['ui.input_focus_color']};
  --dfb-success: ${s['ui.success_color']};
  --dfb-warning: ${s['ui.warning_color']};
  --dfb-danger: ${s['ui.danger_color']};
}

/* Body */
body {
  font-family: var(--dfb-font-body);
  font-size: var(--dfb-body-size);
  background-color: var(--dfb-bg, ${s['ui.background_color']});
}

/* Headings — only apply global theme values when a heading doesn't already use Tailwind text utilities */
#root h1:not([class*="text-"]) { font-size: var(--dfb-h1-size); font-weight: var(--dfb-h1-weight); color: var(--dfb-h1-color); font-family: var(--dfb-font-heading); text-align: var(--dfb-heading-align); }
#root h2:not([class*="text-"]) { font-size: var(--dfb-h2-size); font-weight: var(--dfb-h2-weight); color: var(--dfb-h2-color); font-family: var(--dfb-font-heading); text-align: var(--dfb-heading-align); }
#root h3:not([class*="text-"]) { font-size: var(--dfb-h3-size); font-weight: var(--dfb-h3-weight); color: var(--dfb-h3-color); font-family: var(--dfb-font-heading); text-align: var(--dfb-heading-align); }
#root h4:not([class*="text-"]) { font-size: var(--dfb-h4-size); font-weight: var(--dfb-h4-weight); color: var(--dfb-h4-color); font-family: var(--dfb-font-heading); text-align: var(--dfb-heading-align); }

/* Admin panel section headings (explicitly configurable from UI Design panel) */
#root .dfb-admin-panel h2 {
  font-size: var(--dfb-admin-h2-size) !important;
  font-weight: var(--dfb-admin-h2-weight) !important;
}

/* Cards / panels */
#root .glass,
#root [class*="rounded-xl"],
#root [class*="rounded-2xl"] { border-radius: var(--dfb-card-radius); }
`;
}

// ---- Provider ---------------------------------------------------------------
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UiSettings>(DEFAULTS);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  function applyTheme(partial: Partial<UiSettings>) {
    const merged = { ...settings, ...partial } as UiSettings;
    setSettings(merged);
    inject(merged);
  }

  function inject(s: UiSettings) {
    injectGoogleFont(s['ui.font_family_body']);
    injectGoogleFont(s['ui.font_family_heading']);

    if (!styleRef.current) {
      const el = document.createElement('style');
      el.id = 'dfb-theme-override';
      document.head.appendChild(el);
      styleRef.current = el;
    }
    styleRef.current.textContent = buildCss(s);
  }

  const refetch = async () => {
    try {
      const res = await api.get('/public/settings');
      const raw = res.data?.data ?? {};
      const merged: UiSettings = { ...DEFAULTS };
      (Object.keys(DEFAULTS) as Array<keyof UiSettings>).forEach((k) => {
        if (typeof raw[k] === 'string') (merged as unknown as Record<string, string>)[k] = raw[k];
      });
      setSettings(merged);
      inject(merged);
    } catch {
      inject(DEFAULTS);
    }
  };

  useEffect(() => {
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, applyTheme, refetch }}>
      {children}
    </ThemeContext.Provider>
  );
}
