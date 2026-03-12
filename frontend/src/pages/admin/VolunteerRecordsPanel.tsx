import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

type ActiveTab = 'id-cards' | 'certificates' | 'messages';

// Matches GET /volunteer-records/id-card-templates
interface IdCardTemplate {
  template_id: number;
  template_name: string;
  orientation: string;
  org_name: string | null;
  tagline: string | null;
  accent_color: string;
  is_active: boolean | number;
  created_at: string;
}

// Matches GET /volunteer-records/id-cards (joined with volunteers + templates)
interface IssuedCard {
  card_id: string;
  volunteer_id: number;
  first_name: string;
  last_name: string;
  template_id: number;
  template_name: string;
  badge_number: string;
  issue_date: string;
  expiry_date: string | null;
  status: string;           // 'active' | 'revoked' (computed from revoked_at)
  revoked_at: string | null;
  revoked_reason: string | null;
}

// Matches GET /volunteer-records/certificate-templates
interface CertificateTemplate {
  cert_template_id: number;
  template_name: string;
  title_text: string;
  body_template: string;
  primary_color: string;
  is_active: boolean | number;
  created_at: string;
}

// Matches GET /volunteer-records/certificates (joined)
interface IssuedCertificate {
  award_id: string;
  cert_template_id: number;
  volunteer_id: number;
  first_name: string;
  last_name: string;
  badge_number: string;
  template_name: string;
  title_text: string;
  custom_note: string | null;
  hours_served: number | null;
  issue_date: string;
  verification_code: string;
}

// Matches GET /volunteer-records/messages (joined)
interface VolunteerMessage {
  message_id: string;
  recipient_volunteer_id: number;
  first_name: string;
  last_name: string;
  badge_number: string;
  subject: string;
  body: string;
  channel: string;
  is_read: boolean | number;
  sent_at: string;
}

// Matches GET /volunteers (list endpoint)
interface Volunteer {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  badge_number: string;
  status: string;
}

const today = () => new Date().toISOString().split('T')[0];
const nextYear = () => {
  const d = new Date(); d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

export default function VolunteerRecordsPanel() {
  const [tab, setTab] = useState<ActiveTab>('id-cards');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // --- ID Cards State ---
  const [idTemplates, setIdTemplates]   = useState<IdCardTemplate[]>([]);
  const [issuedCards, setIssuedCards]   = useState<IssuedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [showNewIdTemplate, setShowNewIdTemplate] = useState(false);
  const [idTemplateForm, setIdTemplateForm] = useState({
    templateName: '', orgName: '', tagline: '',
    backgroundColor: '#dbeafe', accentColor: '#1a56db',
    validityDurationMonths: 12, isActive: true,
  });
  const [showIssueCard, setShowIssueCard] = useState(false);
  const [issueCardForm, setIssueCardForm] = useState({
    volunteerId: '', templateId: '', issueDate: today(), expiryDate: nextYear(),
  });

  // --- Certificates State ---
  const [certTemplates, setCertTemplates]   = useState<CertificateTemplate[]>([]);
  const [issuedCerts, setIssuedCerts]       = useState<IssuedCertificate[]>([]);
  const [loadingCerts, setLoadingCerts]     = useState(false);
  const [showNewCertTemplate, setShowNewCertTemplate] = useState(false);
  const [certTemplateForm, setCertTemplateForm] = useState({
    templateName: '', titleText: '',
    bodyTemplate: '<div style="text-align:center;padding:40px;font-family:Georgia,serif">\n  <h1>{{org_name}}</h1>\n  <h2>{{title_text}}</h2>\n  <p>Awarded to</p>\n  <h3>{{volunteer_name}}</h3>\n  <p>{{custom_note}}</p>\n  <p>Verification: {{verification_code}} | Date: {{issue_date}}</p>\n</div>',
    primaryColor: '#2563eb', isActive: true,
  });
  const [showIssueCert, setShowIssueCert]   = useState(false);
  const [issueCertForm, setIssueCertForm]   = useState({
    volunteerId: '', certTemplateId: '', issueDate: today(),
    hoursServed: '', customNote: '',
  });

  // --- Messages State ---
  const [messages, setMessages]         = useState<VolunteerMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [msgForm, setMsgForm]           = useState({
    recipientVolunteerId: '', subject: '', body: '', channel: 'in_app',
  });
  const [sending, setSending]           = useState(false);

  // Volunteer list for dropdowns
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);

  const loadVolunteers = useCallback(async () => {
    try {
      const res = await api.get('/volunteers');
      setVolunteers(res.data?.data ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadVolunteers(); }, [loadVolunteers]);

  // Load ID Cards data
  const loadCards = useCallback(async () => {
    if (tab !== 'id-cards') return;
    setLoadingCards(true);
    try {
      const [tmplRes, cardsRes] = await Promise.all([
        api.get('/volunteer-records/id-card-templates'),
        api.get('/volunteer-records/id-cards'),
      ]);
      setIdTemplates(tmplRes.data?.data ?? []);
      setIssuedCards(cardsRes.data?.data ?? []);
    } catch { setError('Failed to load ID card data'); }
    setLoadingCards(false);
  }, [tab]);

  // Load Certificate data
  const loadCerts = useCallback(async () => {
    if (tab !== 'certificates') return;
    setLoadingCerts(true);
    try {
      const [tmplRes, certsRes] = await Promise.all([
        api.get('/volunteer-records/certificate-templates'),
        api.get('/volunteer-records/certificates'),
      ]);
      setCertTemplates(tmplRes.data?.data ?? []);
      setIssuedCerts(certsRes.data?.data ?? []);
    } catch { setError('Failed to load certificate data'); }
    setLoadingCerts(false);
  }, [tab]);

  // Load Messages
  const loadMessages = useCallback(async () => {
    if (tab !== 'messages') return;
    setLoadingMsgs(true);
    try {
      const res = await api.get('/volunteer-records/messages');
      setMessages(res.data?.data ?? []);
    } catch { setError('Failed to load messages'); }
    setLoadingMsgs(false);
  }, [tab]);

  useEffect(() => {
    setError('');
    if (tab === 'id-cards') loadCards();
    else if (tab === 'certificates') loadCerts();
    else if (tab === 'messages') loadMessages();
  }, [tab, loadCards, loadCerts, loadMessages]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  // ID Card actions
  const createIdTemplate = async () => {
    if (!idTemplateForm.templateName.trim()) { setError('Template name is required'); return; }
    try {
      await api.post('/volunteer-records/id-card-templates', idTemplateForm);
      setShowNewIdTemplate(false);
      setIdTemplateForm({ templateName: '', orgName: '', tagline: '', backgroundColor: '#dbeafe', accentColor: '#1a56db', validityDurationMonths: 12, isActive: true });
      flash('ID card template created');
      loadCards();
    } catch { setError('Failed to create ID card template'); }
  };

  const issueIdCard = async () => {
    if (!issueCardForm.volunteerId || !issueCardForm.templateId || !issueCardForm.issueDate) {
      setError('Select volunteer, template, and issue date');
      return;
    }
    try {
      await api.post('/volunteer-records/id-cards', {
        volunteerId: Number(issueCardForm.volunteerId),
        templateId:  Number(issueCardForm.templateId),
        issueDate:   issueCardForm.issueDate,
        expiryDate:  issueCardForm.expiryDate || undefined,
      });
      setShowIssueCard(false);
      setIssueCardForm({ volunteerId: '', templateId: '', issueDate: today(), expiryDate: nextYear() });
      flash('ID card issued successfully');
      loadCards();
    } catch { setError('Failed to issue ID card'); }
  };

  const revokeCard = async (cardId: string) => {
    if (!window.confirm('Revoke this ID card? This cannot be undone.')) return;
    try {
      await api.patch(`/volunteer-records/id-cards/${cardId}/revoke`);
      setIssuedCards(cs => cs.map(c => c.card_id === cardId ? { ...c, status: 'revoked', revoked_at: new Date().toISOString() } : c));
      flash('ID card revoked');
    } catch { setError('Failed to revoke card'); }
  };

  // Certificate actions
  const createCertTemplate = async () => {
    if (!certTemplateForm.templateName.trim() || !certTemplateForm.titleText.trim() || !certTemplateForm.bodyTemplate.trim()) {
      setError('Template name, title and body are required');
      return;
    }
    try {
      await api.post('/volunteer-records/certificate-templates', {
        templateName:  certTemplateForm.templateName,
        titleText:     certTemplateForm.titleText,
        bodyTemplate:  certTemplateForm.bodyTemplate,
        primaryColor:  certTemplateForm.primaryColor,
      });
      setShowNewCertTemplate(false);
      setCertTemplateForm({ templateName: '', titleText: '', bodyTemplate: '<div style="text-align:center;padding:40px;font-family:Georgia,serif">\n  <h1>{{org_name}}</h1>\n  <h2>{{title_text}}</h2>\n  <p>Awarded to</p>\n  <h3>{{volunteer_name}}</h3>\n  <p>{{custom_note}}</p>\n  <p>Verification: {{verification_code}} | Date: {{issue_date}}</p>\n</div>', primaryColor: '#2563eb', isActive: true });
      flash('Certificate template created');
      loadCerts();
    } catch { setError('Failed to create certificate template'); }
  };

  const issueCertificate = async () => {
    if (!issueCertForm.volunteerId || !issueCertForm.certTemplateId || !issueCertForm.issueDate) {
      setError('Select volunteer, template, and issue date');
      return;
    }
    try {
      await api.post('/volunteer-records/certificates', {
        volunteerId:    Number(issueCertForm.volunteerId),
        certTemplateId: Number(issueCertForm.certTemplateId),
        issueDate:      issueCertForm.issueDate,
        hoursServed:    issueCertForm.hoursServed ? Number(issueCertForm.hoursServed) : undefined,
        customNote:     issueCertForm.customNote || undefined,
      });
      setShowIssueCert(false);
      setIssueCertForm({ volunteerId: '', certTemplateId: '', issueDate: today(), hoursServed: '', customNote: '' });
      flash('Certificate awarded successfully');
      loadCerts();
    } catch { setError('Failed to award certificate'); }
  };

  // Message actions
  const sendMessage = async () => {
    if (!msgForm.recipientVolunteerId || !msgForm.subject || !msgForm.body) {
      setError('Select a volunteer and fill subject and body');
      return;
    }
    setSending(true);
    try {
      await api.post('/volunteer-records/messages', {
        recipientVolunteerId: Number(msgForm.recipientVolunteerId),
        subject: msgForm.subject,
        body:    msgForm.body,
        channel: msgForm.channel,
      });
      setShowSendMessage(false);
      setMsgForm({ recipientVolunteerId: '', subject: '', body: '', channel: 'in_app' });
      flash('Message sent');
      loadMessages();
    } catch { setError('Failed to send message'); }
    setSending(false);
  };

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'id-cards', label: 'ID Cards' },
    { key: 'certificates', label: 'Certificates' },
    { key: 'messages', label: 'Volunteer Messages' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Volunteer Records</h2>
        <p className="text-slate-500 text-sm mt-1">Manage ID cards, certificates, and direct messages for volunteers</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 font-bold text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
      )}

      {/* Tab Nav */}
      <div className="flex border-b border-slate-200 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* =================== ID CARDS TAB =================== */}
      {tab === 'id-cards' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">ID Card Templates</h3>
            <button onClick={() => setShowNewIdTemplate(true)} className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              + New Template
            </button>
          </div>

          {loadingCards ? (
            <div className="text-slate-400 py-8 text-center">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {idTemplates.length === 0 ? (
                <div className="col-span-3 text-slate-400 text-sm py-8 text-center">No templates yet. Create one to issue ID cards.</div>
              ) : idTemplates.map(t => (
                <div key={t.template_id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{t.template_name}</p>
                      {t.org_name && <p className="text-xs text-slate-500 mt-0.5">{t.org_name}</p>}
                      {t.tagline && <p className="text-xs text-slate-400 italic mt-0.5">{t.tagline}</p>}
                      <p className="text-xs text-slate-400 mt-1 capitalize">{t.orientation}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.accent_color }} />
                    <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Issued ID Cards</h3>
            <button onClick={() => setShowIssueCard(true)} className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Issue Card
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Volunteer', 'Badge #', 'Template', 'Issue Date', 'Expiry', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issuedCards.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">No cards issued yet</td></tr>
                ) : issuedCards.map(c => (
                  <tr key={c.card_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{c.badge_number}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.template_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(c.issue_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === 'revoked' || c.revoked_at ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {c.status === 'revoked' || c.revoked_at ? 'Revoked' : 'Valid'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!(c.status === 'revoked' || c.revoked_at) && (
                        <button onClick={() => revokeCard(c.card_id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* =================== CERTIFICATES TAB =================== */}
      {tab === 'certificates' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Certificate Templates</h3>
            <button onClick={() => setShowNewCertTemplate(true)} className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              + New Template
            </button>
          </div>

          {loadingCerts ? (
            <div className="text-slate-400 py-8 text-center">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {certTemplates.length === 0 ? (
                <div className="col-span-3 text-slate-400 text-sm py-8 text-center">No templates yet. Create one to award certificates.</div>
              ) : certTemplates.map(t => (
                <div key={t.cert_template_id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-slate-800 text-sm">{t.template_name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 italic">{t.title_text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.primary_color }} />
                    <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Awarded Certificates</h3>
            <button onClick={() => setShowIssueCert(true)} className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Award Certificate
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Volunteer', 'Template', 'Note', 'Hours', 'Issue Date', 'Verification Code'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issuedCerts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">No certificates awarded yet</td></tr>
                ) : issuedCerts.map(c => (
                  <tr key={c.award_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.template_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{c.custom_note ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.hours_served != null ? `${c.hours_served}h` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(c.issue_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary-700 bg-primary-50 rounded">{c.verification_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* =================== MESSAGES TAB =================== */}
      {tab === 'messages' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">Sent Messages to Volunteers</h3>
            <button onClick={() => setShowSendMessage(true)} className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              Send Message
            </button>
          </div>

          {loadingMsgs ? (
            <div className="text-slate-400 py-8 text-center">Loading…</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    {['Volunteer', 'Subject', 'Body', 'Channel', 'Read', 'Sent At'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {messages.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">No messages sent yet</td></tr>
                  ) : messages.map(m => (
                    <tr key={m.message_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">{m.first_name} {m.last_name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{m.subject}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[250px] truncate">{m.body}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 capitalize">{m.channel.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.is_read ? 'bg-primary-100 text-primary-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {m.is_read ? 'Read' : 'Unread'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(m.sent_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== MODALS =================== */}

      {/* New ID Card Template Modal */}
      {showNewIdTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
            <h3 className="text-lg font-bold mb-4">New ID Card Template</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Template Name *</label>
                <input value={idTemplateForm.templateName}
                  onChange={e => setIdTemplateForm(f => ({ ...f, templateName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Standard Volunteer Card" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organisation Name</label>
                <input value={idTemplateForm.orgName}
                  onChange={e => setIdTemplateForm(f => ({ ...f, orgName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="DFB Foundation" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
                <input value={idTemplateForm.tagline}
                  onChange={e => setIdTemplateForm(f => ({ ...f, tagline: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="Serving Humanity" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Background Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={idTemplateForm.backgroundColor}
                    onChange={e => setIdTemplateForm(f => ({ ...f, backgroundColor: e.target.value }))}
                    className="h-9 w-12 rounded border border-slate-300 cursor-pointer" />
                  <span className="text-xs text-slate-500">{idTemplateForm.backgroundColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Accent Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={idTemplateForm.accentColor}
                    onChange={e => setIdTemplateForm(f => ({ ...f, accentColor: e.target.value }))}
                    className="h-9 w-12 rounded border border-slate-300 cursor-pointer" />
                  <span className="text-xs text-slate-500">{idTemplateForm.accentColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Validity (months)</label>
                <input type="number" min={1} max={120} value={idTemplateForm.validityDurationMonths}
                  onChange={e => setIdTemplateForm(f => ({ ...f, validityDurationMonths: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={idTemplateForm.isActive}
                onChange={e => setIdTemplateForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <span className="text-sm text-slate-700">Set as Active</span>
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNewIdTemplate(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={createIdTemplate} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Create Template</button>
            </div>
          </div>
        </div>
      )}

      {/* Issue ID Card Modal */}
      {showIssueCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Issue ID Card</h3>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volunteer *</label>
              <select value={issueCardForm.volunteerId}
                onChange={e => setIssueCardForm(f => ({ ...f, volunteerId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                <option value="">Select volunteer…</option>
                {volunteers.map(v => (
                  <option key={v.volunteer_id} value={v.volunteer_id}>
                    {v.first_name} {v.last_name} ({v.badge_number})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Template *</label>
              <select value={issueCardForm.templateId}
                onChange={e => setIssueCardForm(f => ({ ...f, templateId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                <option value="">Select template…</option>
                {idTemplates.filter(t => t.is_active).map(t => (
                  <option key={t.template_id} value={t.template_id}>{t.template_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Date *</label>
                <input type="date" value={issueCardForm.issueDate}
                  onChange={e => setIssueCardForm(f => ({ ...f, issueDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date</label>
                <input type="date" value={issueCardForm.expiryDate}
                  onChange={e => setIssueCardForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowIssueCard(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={issueIdCard} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Issue Card</button>
            </div>
          </div>
        </div>
      )}

      {/* New Certificate Template Modal */}
      {showNewCertTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-bold mb-4">New Certificate Template</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Template Name *</label>
                <input value={certTemplateForm.templateName}
                  onChange={e => setCertTemplateForm(f => ({ ...f, templateName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Volunteer Appreciation Certificate" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Certificate Title *</label>
                <input value={certTemplateForm.titleText}
                  onChange={e => setCertTemplateForm(f => ({ ...f, titleText: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Certificate of Appreciation" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                HTML Body Template
                <span className="ml-2 font-normal text-slate-400">Variables: {'{{volunteer_name}}'}, {'{{issue_date}}'}, {'{{verification_code}}'}, {'{{custom_note}}'}</span>
              </label>
              <textarea rows={10} value={certTemplateForm.bodyTemplate}
                onChange={e => setCertTemplateForm(f => ({ ...f, bodyTemplate: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={certTemplateForm.primaryColor}
                    onChange={e => setCertTemplateForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="h-9 w-12 rounded border border-slate-300 cursor-pointer" />
                  <span className="text-xs text-slate-500">{certTemplateForm.primaryColor}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNewCertTemplate(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={createCertTemplate} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Create Template</button>
            </div>
          </div>
        </div>
      )}

      {/* Award Certificate Modal */}
      {showIssueCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Award Certificate</h3>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volunteer *</label>
              <select value={issueCertForm.volunteerId}
                onChange={e => setIssueCertForm(f => ({ ...f, volunteerId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                <option value="">Select volunteer…</option>
                {volunteers.map(v => (
                  <option key={v.volunteer_id} value={v.volunteer_id}>
                    {v.first_name} {v.last_name} ({v.badge_number})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Certificate Template *</label>
              <select value={issueCertForm.certTemplateId}
                onChange={e => setIssueCertForm(f => ({ ...f, certTemplateId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                <option value="">Select template…</option>
                {certTemplates.filter(t => t.is_active).map(t => (
                  <option key={t.cert_template_id} value={t.cert_template_id}>{t.template_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Date *</label>
                <input type="date" value={issueCertForm.issueDate}
                  onChange={e => setIssueCertForm(f => ({ ...f, issueDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hours Served</label>
                <input type="number" min={0} value={issueCertForm.hoursServed}
                  onChange={e => setIssueCertForm(f => ({ ...f, hoursServed: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. 40" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Note / Award Reason</label>
              <input value={issueCertForm.customNote}
                onChange={e => setIssueCertForm(f => ({ ...f, customNote: e.target.value }))}
                placeholder="e.g. For outstanding service during Ramadan Drive 2026"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowIssueCert(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={issueCertificate} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Award</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {showSendMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">Send Message to Volunteer</h3>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volunteer *</label>
              <select value={msgForm.recipientVolunteerId}
                onChange={e => setMsgForm(f => ({ ...f, recipientVolunteerId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                <option value="">Select volunteer…</option>
                {volunteers.map(v => (
                  <option key={v.volunteer_id} value={v.volunteer_id}>
                    {v.first_name} {v.last_name} ({v.badge_number})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Channel</label>
              <select value={msgForm.channel}
                onChange={e => setMsgForm(f => ({ ...f, channel: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                <option value="in_app">In-App Only</option>
                <option value="email">Email Only</option>
                <option value="both">In-App + Email</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <input value={msgForm.subject}
                onChange={e => setMsgForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Shift Confirmation — March 15th" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Body *</label>
              <textarea rows={5} value={msgForm.body}
                onChange={e => setMsgForm(f => ({ ...f, body: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSendMessage(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={sendMessage} disabled={sending}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {sending ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
