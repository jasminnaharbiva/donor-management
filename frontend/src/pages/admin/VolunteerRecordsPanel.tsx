import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

type ActiveTab = 'id-cards' | 'certificates' | 'messages';

interface IdCardTemplate {
  template_id: string;
  template_name: string;
  template_html: string;
  is_active: boolean;
  created_at: string;
}

interface IssuedCard {
  card_id: string;
  volunteer_id: string;
  volunteer_name?: string;
  email?: string;
  template_id: string;
  issued_at: string;
  expires_at: string | null;
  is_revoked: boolean;
}

interface CertificateTemplate {
  template_id: string;
  template_name: string;
  certificate_type: string;
  template_html: string;
  is_active: boolean;
  created_at: string;
}

interface IssuedCertificate {
  certificate_id: string;
  volunteer_id: string;
  volunteer_name?: string;
  email?: string;
  template_id: string;
  certificate_type: string;
  awarded_for: string;
  awarded_at: string;
  verification_code: string;
}

interface VolunteerMessage {
  message_id: string;
  volunteer_id: string;
  volunteer_name?: string;
  subject: string;
  body: string;
  is_read: boolean;
  sent_at: string;
}

interface Volunteer {
  volunteer_id: string;
  full_name: string;
  email: string;
}

export default function VolunteerRecordsPanel() {
  const [tab, setTab] = useState<ActiveTab>('id-cards');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // --- ID Cards State ---
  const [idTemplates, setIdTemplates]   = useState<IdCardTemplate[]>([]);
  const [issuedCards, setIssuedCards]   = useState<IssuedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [showNewIdTemplate, setShowNewIdTemplate] = useState(false);
  const [idTemplateForm, setIdTemplateForm] = useState({ template_name: '', template_html: '<div>{{volunteer_name}}</div>', is_active: true });
  const [showIssueCard, setShowIssueCard] = useState(false);
  const [issueCardForm, setIssueCardForm] = useState({ volunteer_id: '', template_id: '', expires_at: '' });

  // --- Certificates State ---
  const [certTemplates, setCertTemplates]   = useState<CertificateTemplate[]>([]);
  const [issuedCerts, setIssuedCerts]       = useState<IssuedCertificate[]>([]);
  const [loadingCerts, setLoadingCerts]     = useState(false);
  const [showNewCertTemplate, setShowNewCertTemplate] = useState(false);
  const [certTemplateForm, setCertTemplateForm] = useState({ template_name: '', certificate_type: 'participation', template_html: '<div>{{volunteer_name}}</div>', is_active: true });
  const [showIssueCert, setShowIssueCert]   = useState(false);
  const [issueCertForm, setIssueCertForm]   = useState({ volunteer_id: '', template_id: '', awarded_for: '' });

  // --- Messages State ---
  const [messages, setMessages]         = useState<VolunteerMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [msgForm, setMsgForm]           = useState({ volunteer_id: '', subject: '', body: '' });
  const [sending, setSending]           = useState(false);

  // Volunteer list for dropdowns
  const [volunteers, setVolunteers]     = useState<Volunteer[]>([]);

  const loadVolunteers = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/volunteers', { params: { limit: 500 } });
      const data = res.data?.volunteers || res.data?.data || res.data || [];
      setVolunteers(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { loadVolunteers(); }, [loadVolunteers]);

  // Load ID Cards data
  const loadCards = useCallback(async () => {
    if (tab !== 'id-cards') return;
    setLoadingCards(true);
    try {
      const [tmplRes, cardsRes] = await Promise.all([
        api.get('/api/v1/volunteer-records/id-card-templates'),
        api.get('/api/v1/volunteer-records/id-cards'),
      ]);
      setIdTemplates(tmplRes.data || []);
      setIssuedCards(cardsRes.data || []);
    } catch { setError('Failed to load ID card data'); }
    setLoadingCards(false);
  }, [tab]);

  // Load Certificate data
  const loadCerts = useCallback(async () => {
    if (tab !== 'certificates') return;
    setLoadingCerts(true);
    try {
      const [tmplRes, certsRes] = await Promise.all([
        api.get('/api/v1/volunteer-records/certificate-templates'),
        api.get('/api/v1/volunteer-records/certificates'),
      ]);
      setCertTemplates(tmplRes.data || []);
      setIssuedCerts(certsRes.data || []);
    } catch { setError('Failed to load certificate data'); }
    setLoadingCerts(false);
  }, [tab]);

  // Load Messages
  const loadMessages = useCallback(async () => {
    if (tab !== 'messages') return;
    setLoadingMsgs(true);
    try {
      const res = await api.get('/api/v1/volunteer-records/messages');
      setMessages(res.data || []);
    } catch { setError('Failed to load messages'); }
    setLoadingMsgs(false);
  }, [tab]);

  useEffect(() => {
    setError('');
    if (tab === 'id-cards') loadCards();
    else if (tab === 'certificates') loadCerts();
    else if (tab === 'messages') loadMessages();
  }, [tab, loadCards, loadCerts, loadMessages]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  // ID Card actions
  const createIdTemplate = async () => {
    try {
      await api.post('/api/v1/volunteer-records/id-card-templates', idTemplateForm);
      setShowNewIdTemplate(false);
      setIdTemplateForm({ template_name: '', template_html: '<div>{{volunteer_name}}</div>', is_active: true });
      flash('Template created');
      loadCards();
    } catch { setError('Failed to create template'); }
  };

  const issueIdCard = async () => {
    if (!issueCardForm.volunteer_id || !issueCardForm.template_id) { setError('Select volunteer and template'); return; }
    try {
      await api.post('/api/v1/volunteer-records/id-cards', issueCardForm);
      setShowIssueCard(false);
      setIssueCardForm({ volunteer_id: '', template_id: '', expires_at: '' });
      flash('ID card issued');
      loadCards();
    } catch { setError('Failed to issue card'); }
  };

  const revokeCard = async (cardId: string) => {
    if (!window.confirm('Revoke this ID card?')) return;
    try {
      await api.patch(`/api/v1/volunteer-records/id-cards/${cardId}/revoke`);
      setIssuedCards(cs => cs.map(c => c.card_id === cardId ? { ...c, is_revoked: true } : c));
      flash('Card revoked');
    } catch { setError('Failed to revoke card'); }
  };

  // Certificate actions
  const createCertTemplate = async () => {
    try {
      await api.post('/api/v1/volunteer-records/certificate-templates', certTemplateForm);
      setShowNewCertTemplate(false);
      setCertTemplateForm({ template_name: '', certificate_type: 'participation', template_html: '<div>{{volunteer_name}}</div>', is_active: true });
      flash('Certificate template created');
      loadCerts();
    } catch { setError('Failed to create cert template'); }
  };

  const issueCertificate = async () => {
    if (!issueCertForm.volunteer_id || !issueCertForm.template_id || !issueCertForm.awarded_for) { setError('Fill all fields'); return; }
    try {
      await api.post('/api/v1/volunteer-records/certificates', issueCertForm);
      setShowIssueCert(false);
      setIssueCertForm({ volunteer_id: '', template_id: '', awarded_for: '' });
      flash('Certificate awarded');
      loadCerts();
    } catch { setError('Failed to issue certificate'); }
  };

  // Message actions
  const sendMessage = async () => {
    if (!msgForm.volunteer_id || !msgForm.subject || !msgForm.body) { setError('Fill all fields'); return; }
    setSending(true);
    try {
      await api.post('/api/v1/volunteer-records/messages', msgForm);
      setShowSendMessage(false);
      setMsgForm({ volunteer_id: '', subject: '', body: '' });
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
        <h2 className="text-2xl font-bold text-gray-800">Volunteer Records</h2>
        <p className="text-gray-500 text-sm mt-1">Manage ID cards, certificates, and direct messages for volunteers</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error} <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button></div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Tab Nav */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* =================== ID CARDS TAB =================== */}
      {tab === 'id-cards' && (
        <div>
          {/* Templates section */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">ID Card Templates</h3>
            <button onClick={() => setShowNewIdTemplate(true)} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Template</button>
          </div>

          {loadingCards ? <div className="text-gray-400 py-4 text-center">Loading…</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {idTemplates.length === 0 ? (
                <div className="col-span-3 text-gray-400 text-sm py-4 text-center">No templates yet</div>
              ) : idTemplates.map(t => (
                <div key={t.template_id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{t.template_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Issued Cards section */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Issued ID Cards</h3>
            <button onClick={() => setShowIssueCard(true)} className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">Issue Card</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Volunteer', 'Template', 'Issued', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {issuedCards.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-400 text-sm">No cards issued yet</td></tr>
                ) : issuedCards.map(c => (
                  <tr key={c.card_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{c.volunteer_name || c.volunteer_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.template_id.substring(0, 8)}…</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.issued_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.is_revoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {c.is_revoked ? 'Revoked' : 'Valid'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!c.is_revoked && (
                        <button onClick={() => revokeCard(c.card_id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================== CERTIFICATES TAB =================== */}
      {tab === 'certificates' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Certificate Templates</h3>
            <button onClick={() => setShowNewCertTemplate(true)} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Template</button>
          </div>

          {loadingCerts ? <div className="text-gray-400 py-4 text-center">Loading…</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {certTemplates.length === 0 ? (
                <div className="col-span-3 text-gray-400 text-sm py-4 text-center">No templates yet</div>
              ) : certTemplates.map(t => (
                <div key={t.template_id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-gray-800 text-sm">{t.template_name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 capitalize">{t.certificate_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(t.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Awarded Certificates</h3>
            <button onClick={() => setShowIssueCert(true)} className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">Award Certificate</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Volunteer', 'Type', 'Awarded For', 'Date', 'Verification Code'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {issuedCerts.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-sm">No certificates awarded yet</td></tr>
                ) : issuedCerts.map(c => (
                  <tr key={c.certificate_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{c.volunteer_name || c.volunteer_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{c.certificate_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.awarded_for}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.awarded_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-700 bg-indigo-50 rounded">{c.verification_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================== MESSAGES TAB =================== */}
      {tab === 'messages' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Sent Messages to Volunteers</h3>
            <button onClick={() => setShowSendMessage(true)} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Send Message</button>
          </div>

          {loadingMsgs ? <div className="text-gray-400 py-4 text-center">Loading…</div> : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Volunteer', 'Subject', 'Body', 'Read', 'Sent At'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {messages.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-sm">No messages sent yet</td></tr>
                  ) : messages.map(m => (
                    <tr key={m.message_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">{m.volunteer_name || m.volunteer_id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.subject}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[300px] truncate">{m.body}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.is_read ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {m.is_read ? 'Read' : 'Unread'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(m.sent_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================== MODALS =================== */}

      {/* New ID Card Template Modal */}
      {showNewIdTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-bold mb-4">New ID Card Template</h3>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Template Name</label>
              <input value={idTemplateForm.template_name} onChange={e => setIdTemplateForm(f => ({ ...f, template_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">HTML Template (use &#123;&#123;volunteer_name&#125;&#125;, &#123;&#123;card_id&#125;&#125;, &#123;&#123;issued_at&#125;&#125;)</label>
              <textarea rows={8} value={idTemplateForm.template_html} onChange={e => setIdTemplateForm(f => ({ ...f, template_html: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500" />
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={idTemplateForm.is_active} onChange={e => setIdTemplateForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700">Set as Active</span>
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNewIdTemplate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={createIdTemplate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Volunteer</label>
              <select value={issueCardForm.volunteer_id} onChange={e => setIssueCardForm(f => ({ ...f, volunteer_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Select volunteer…</option>
                {volunteers.map(v => <option key={v.volunteer_id} value={v.volunteer_id}>{v.full_name} ({v.email})</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Template</label>
              <select value={issueCardForm.template_id} onChange={e => setIssueCardForm(f => ({ ...f, template_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Select template…</option>
                {idTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.template_name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Expires At (optional)</label>
              <input type="date" value={issueCardForm.expires_at} onChange={e => setIssueCardForm(f => ({ ...f, expires_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowIssueCard(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Template Name</label>
                <input value={certTemplateForm.template_name} onChange={e => setCertTemplateForm(f => ({ ...f, template_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Certificate Type</label>
                <select value={certTemplateForm.certificate_type} onChange={e => setCertTemplateForm(f => ({ ...f, certificate_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  {['participation', 'excellence', 'completion', 'appreciation', 'leadership'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">HTML Template</label>
              <textarea rows={8} value={certTemplateForm.template_html} onChange={e => setCertTemplateForm(f => ({ ...f, template_html: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500" />
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={certTemplateForm.is_active} onChange={e => setCertTemplateForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700">Set as Active</span>
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNewCertTemplate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={createCertTemplate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Certificate Modal */}
      {showIssueCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Award Certificate</h3>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Volunteer</label>
              <select value={issueCertForm.volunteer_id} onChange={e => setIssueCertForm(f => ({ ...f, volunteer_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Select volunteer…</option>
                {volunteers.map(v => <option key={v.volunteer_id} value={v.volunteer_id}>{v.full_name} ({v.email})</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Certificate Template</label>
              <select value={issueCertForm.template_id} onChange={e => setIssueCertForm(f => ({ ...f, template_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Select template…</option>
                {certTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.template_name} ({t.certificate_type})</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Awarded For</label>
              <input value={issueCertForm.awarded_for} onChange={e => setIssueCertForm(f => ({ ...f, awarded_for: e.target.value }))}
                placeholder="e.g. Outstanding service in Ramadan Drive 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowIssueCert(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Volunteer</label>
              <select value={msgForm.volunteer_id} onChange={e => setMsgForm(f => ({ ...f, volunteer_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Select volunteer…</option>
                {volunteers.map(v => <option key={v.volunteer_id} value={v.volunteer_id}>{v.full_name} ({v.email})</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Subject</label>
              <input value={msgForm.subject} onChange={e => setMsgForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Message Body</label>
              <textarea rows={6} value={msgForm.body} onChange={e => setMsgForm(f => ({ ...f, body: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSendMessage(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={sendMessage} disabled={sending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
