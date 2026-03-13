import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

type Tab = 'id-cards' | 'certificates' | 'messages';

interface DonorOption {
  donor_id: number;
  first_name: string;
  last_name: string;
  country?: string;
  profession?: string;
}

interface IdTemplate {
  template_id: number;
  template_name: string;
  orientation: string;
  org_name?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  is_active: number | boolean;
}

interface IssuedIdCard {
  card_id: string;
  donor_id: number;
  first_name: string;
  last_name: string;
  issue_date: string;
  expiry_date: string | null;
  status: string;
  template_name: string;
}

interface CertTemplate {
  cert_template_id: number;
  template_name: string;
  title_text: string;
  primary_color?: string | null;
  is_active: number | boolean;
}

interface IssuedCert {
  award_id: string;
  donor_id: number;
  first_name: string;
  last_name: string;
  issue_date: string;
  expires_at: string | null;
  verification_code: string;
  template_name: string;
}

interface DonorMessage {
  message_id: string;
  first_name: string;
  last_name: string;
  subject: string;
  body: string;
  channel: string;
  is_read: number | boolean;
  sent_at: string;
}

const today = () => new Date().toISOString().split('T')[0];
const nextYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

export default function DonorRecordsPanel() {
  const [tab, setTab] = useState<Tab>('id-cards');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [donors, setDonors] = useState<DonorOption[]>([]);

  const [idTemplates, setIdTemplates] = useState<IdTemplate[]>([]);
  const [issuedIdCards, setIssuedIdCards] = useState<IssuedIdCard[]>([]);
  const [certTemplates, setCertTemplates] = useState<CertTemplate[]>([]);
  const [issuedCerts, setIssuedCerts] = useState<IssuedCert[]>([]);
  const [messages, setMessages] = useState<DonorMessage[]>([]);

  const [loading, setLoading] = useState(false);

  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState({
    templateName: '',
    orientation: 'horizontal',
    orgName: '',
    tagline: '',
    backgroundColor: '#ffffff',
    accentColor: '#2563eb',
    textColor: '#0f172a',
    footerText: '',
    fontFamily: 'Inter, Arial, sans-serif',
    qrBaseUrl: '/donor/records/id/{{card_id}}',
    dynamicFieldsJson: '[]',
    textBlocksJson: '[]',
    layoutJson: '{}',
    validityDurationMonths: 12,
    isActive: true,
  });

  const [showIssueIdForm, setShowIssueIdForm] = useState(false);
  const [issueIdForm, setIssueIdForm] = useState({
    donorId: '',
    templateId: '',
    issueDate: today(),
    expiryDate: nextYear(),
    dynamicValuesJson: '{}',
  });

  const [showCertTemplateForm, setShowCertTemplateForm] = useState(false);
  const [editCertTemplateId, setEditCertTemplateId] = useState<number | null>(null);
  const [certTemplateForm, setCertTemplateForm] = useState({
    templateName: '',
    titleText: '',
    bodyTemplate: '<div style="text-align:center;padding:40px;font-family:Georgia,serif"><h1>{{title_text}}</h1><p>Awarded to</p><h2>{{donor_name}}</h2><p>{{custom_note}}</p><p>Code: {{verification_code}}</p></div>',
    primaryColor: '#2563eb',
    dynamicFieldsJson: '[]',
    textBlocksJson: '[]',
    layoutJson: '{}',
    isActive: true,
  });

  const [showIssueCertForm, setShowIssueCertForm] = useState(false);
  const [issueCertForm, setIssueCertForm] = useState({
    donorId: '',
    certTemplateId: '',
    issueDate: today(),
    customNote: '',
    expiresAt: '',
    dynamicValuesJson: '{}',
  });

  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageForm, setMessageForm] = useState({
    recipientDonorId: '',
    subject: '',
    body: '',
    channel: 'in_app',
  });

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const parseJson = (value: string, field: string) => {
    if (!value.trim()) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      setError(`${field} must be valid JSON`);
      return null;
    }
  };

  const loadDonors = useCallback(async () => {
    try {
      const res = await api.get('/donors?limit=500');
      setDonors(res.data?.data || []);
    } catch {
      setDonors([]);
    }
  }, []);

  const loadCurrentTab = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'id-cards') {
        const [templatesRes, cardsRes] = await Promise.all([
          api.get('/donor-records/id-card-templates'),
          api.get('/donor-records/id-cards'),
        ]);
        setIdTemplates(templatesRes.data?.data || []);
        setIssuedIdCards(cardsRes.data?.data || []);
      }

      if (tab === 'certificates') {
        const [templatesRes, certsRes] = await Promise.all([
          api.get('/donor-records/certificate-templates'),
          api.get('/donor-records/certificates'),
        ]);
        setCertTemplates(templatesRes.data?.data || []);
        setIssuedCerts(certsRes.data?.data || []);
      }

      if (tab === 'messages') {
        const messagesRes = await api.get('/donor-records/messages');
        setMessages(messagesRes.data?.data || []);
      }
    } catch {
      setError('Failed to load donor records data');
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    loadDonors();
  }, [loadDonors]);

  useEffect(() => {
    loadCurrentTab();
  }, [loadCurrentTab]);

  const openHtml = (html: string, title: string) => {
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Please allow popups to view render previews');
      return;
    }
    popup.document.write(`<html><head><title>${title}</title></head><body style="margin:0;padding:16px;background:#f8fafc;">${html}</body></html>`);
    popup.document.close();
  };

  const submitTemplate = async () => {
    if (!templateForm.templateName.trim()) {
      setError('Template name is required');
      return;
    }

    const dynamicFields = parseJson(templateForm.dynamicFieldsJson, 'ID dynamic fields JSON');
    if (dynamicFields === null) return;
    const textBlocks = parseJson(templateForm.textBlocksJson, 'ID text blocks JSON');
    if (textBlocks === null) return;
    const layout = parseJson(templateForm.layoutJson, 'ID layout JSON');
    if (layout === null) return;

    const payload = {
      templateName: templateForm.templateName,
      orientation: templateForm.orientation,
      orgName: templateForm.orgName || undefined,
      tagline: templateForm.tagline || undefined,
      backgroundColor: templateForm.backgroundColor,
      accentColor: templateForm.accentColor,
      textColor: templateForm.textColor,
      footerText: templateForm.footerText || undefined,
      fontFamily: templateForm.fontFamily,
      qrBaseUrl: templateForm.qrBaseUrl,
      dynamicFieldsJson: dynamicFields,
      textBlocksJson: textBlocks,
      layoutJson: layout,
      validityDurationMonths: templateForm.validityDurationMonths,
      isActive: templateForm.isActive,
    };

    try {
      if (editTemplateId) {
        await api.put(`/donor-records/id-card-templates/${editTemplateId}`, payload);
      } else {
        await api.post('/donor-records/id-card-templates', payload);
      }
      flash(editTemplateId ? 'ID template updated' : 'ID template created');
      setShowTemplateForm(false);
      setEditTemplateId(null);
      setTemplateForm({
        templateName: '', orientation: 'horizontal', orgName: '', tagline: '',
        backgroundColor: '#ffffff', accentColor: '#2563eb', textColor: '#0f172a',
        footerText: '', fontFamily: 'Inter, Arial, sans-serif', qrBaseUrl: '/donor/records/id/{{card_id}}',
        dynamicFieldsJson: '[]', textBlocksJson: '[]', layoutJson: '{}', validityDurationMonths: 12, isActive: true,
      });
      loadCurrentTab();
    } catch {
      setError('Failed to save ID template');
    }
  };

  const previewIdTemplate = async (templateId: number) => {
    try {
      const res = await api.post(`/donor-records/id-card-templates/${templateId}/preview`, {});
      const html = res.data?.data?.rendered_html;
      if (html) openHtml(html, 'Donor ID Preview');
    } catch {
      setError('Failed to preview ID template');
    }
  };

  const deleteIdTemplate = async (templateId: number) => {
    if (!window.confirm('Delete this ID template?')) return;
    try {
      await api.delete(`/donor-records/id-card-templates/${templateId}`);
      flash('ID template deleted');
      loadCurrentTab();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete template');
    }
  };

  const issueIdCard = async () => {
    if (!issueIdForm.donorId || !issueIdForm.templateId || !issueIdForm.issueDate) {
      setError('Donor, template, and issue date are required');
      return;
    }
    const dynamicValues = parseJson(issueIdForm.dynamicValuesJson, 'ID dynamic values JSON');
    if (dynamicValues === null) return;

    try {
      await api.post('/donor-records/id-cards', {
        donorId: Number(issueIdForm.donorId),
        templateId: Number(issueIdForm.templateId),
        issueDate: issueIdForm.issueDate,
        expiryDate: issueIdForm.expiryDate || undefined,
        dynamicValues,
      });
      flash('Donor ID card issued');
      setShowIssueIdForm(false);
      setIssueIdForm({ donorId: '', templateId: '', issueDate: today(), expiryDate: nextYear(), dynamicValuesJson: '{}' });
      loadCurrentTab();
    } catch {
      setError('Failed to issue donor ID card');
    }
  };

  const viewIdRender = async (cardId: string) => {
    try {
      const res = await api.get(`/donor-records/id-cards/${cardId}/render`);
      const html = res.data?.data?.rendered_html;
      if (html) openHtml(html, 'Issued Donor ID');
    } catch {
      setError('Failed to load card render');
    }
  };

  const revokeIdCard = async (cardId: string) => {
    if (!window.confirm('Revoke this card?')) return;
    try {
      await api.patch(`/donor-records/id-cards/${cardId}/revoke`);
      flash('Donor ID card revoked');
      loadCurrentTab();
    } catch {
      setError('Failed to revoke card');
    }
  };

  const submitCertTemplate = async () => {
    if (!certTemplateForm.templateName.trim() || !certTemplateForm.titleText.trim() || !certTemplateForm.bodyTemplate.trim()) {
      setError('Template name, title and body are required');
      return;
    }

    const dynamicFields = parseJson(certTemplateForm.dynamicFieldsJson, 'Certificate dynamic fields JSON');
    if (dynamicFields === null) return;
    const textBlocks = parseJson(certTemplateForm.textBlocksJson, 'Certificate text blocks JSON');
    if (textBlocks === null) return;
    const layout = parseJson(certTemplateForm.layoutJson, 'Certificate layout JSON');
    if (layout === null) return;

    const payload = {
      templateName: certTemplateForm.templateName,
      titleText: certTemplateForm.titleText,
      bodyTemplate: certTemplateForm.bodyTemplate,
      primaryColor: certTemplateForm.primaryColor,
      dynamicFieldsJson: dynamicFields,
      textBlocksJson: textBlocks,
      layoutJson: layout,
      isActive: certTemplateForm.isActive,
    };

    try {
      if (editCertTemplateId) {
        await api.put(`/donor-records/certificate-templates/${editCertTemplateId}`, payload);
      } else {
        await api.post('/donor-records/certificate-templates', payload);
      }
      flash(editCertTemplateId ? 'Certificate template updated' : 'Certificate template created');
      setShowCertTemplateForm(false);
      setEditCertTemplateId(null);
      setCertTemplateForm({
        templateName: '', titleText: '',
        bodyTemplate: '<div style="text-align:center;padding:40px;font-family:Georgia,serif"><h1>{{title_text}}</h1><p>Awarded to</p><h2>{{donor_name}}</h2><p>{{custom_note}}</p><p>Code: {{verification_code}}</p></div>',
        primaryColor: '#2563eb', dynamicFieldsJson: '[]', textBlocksJson: '[]', layoutJson: '{}', isActive: true,
      });
      loadCurrentTab();
    } catch {
      setError('Failed to save certificate template');
    }
  };

  const previewCertTemplate = async (templateId: number) => {
    try {
      const res = await api.post(`/donor-records/certificate-templates/${templateId}/preview`, {});
      const html = res.data?.data?.rendered_html;
      if (html) openHtml(html, 'Donor Certificate Preview');
    } catch {
      setError('Failed to preview certificate template');
    }
  };

  const deleteCertTemplate = async (templateId: number) => {
    if (!window.confirm('Delete this certificate template?')) return;
    try {
      await api.delete(`/donor-records/certificate-templates/${templateId}`);
      flash('Certificate template deleted');
      loadCurrentTab();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete certificate template');
    }
  };

  const issueCertificate = async () => {
    if (!issueCertForm.donorId || !issueCertForm.certTemplateId || !issueCertForm.issueDate) {
      setError('Donor, template and issue date are required');
      return;
    }
    const dynamicValues = parseJson(issueCertForm.dynamicValuesJson, 'Certificate dynamic values JSON');
    if (dynamicValues === null) return;

    try {
      await api.post('/donor-records/certificates', {
        donorId: Number(issueCertForm.donorId),
        certTemplateId: Number(issueCertForm.certTemplateId),
        issueDate: issueCertForm.issueDate,
        customNote: issueCertForm.customNote || undefined,
        expiresAt: issueCertForm.expiresAt || undefined,
        dynamicValues,
      });
      flash('Certificate issued to donor');
      setShowIssueCertForm(false);
      setIssueCertForm({ donorId: '', certTemplateId: '', issueDate: today(), customNote: '', expiresAt: '', dynamicValuesJson: '{}' });
      loadCurrentTab();
    } catch {
      setError('Failed to issue certificate');
    }
  };

  const viewCertRender = async (awardId: string) => {
    try {
      const res = await api.get(`/donor-records/certificates/${awardId}/render`);
      const html = res.data?.data?.rendered_html;
      if (html) openHtml(html, 'Issued Donor Certificate');
    } catch {
      setError('Failed to load certificate render');
    }
  };

  const sendMessage = async () => {
    if (!messageForm.recipientDonorId || !messageForm.subject.trim() || !messageForm.body.trim()) {
      setError('Recipient, subject and body are required');
      return;
    }

    try {
      await api.post('/donor-records/messages', {
        recipientDonorId: Number(messageForm.recipientDonorId),
        subject: messageForm.subject,
        body: messageForm.body,
        channel: messageForm.channel,
      });
      flash('Message sent to donor');
      setShowMessageForm(false);
      setMessageForm({ recipientDonorId: '', subject: '', body: '', channel: 'in_app' });
      loadCurrentTab();
    } catch {
      setError('Failed to send message');
    }
  };

  return (
    <div className="space-y-5">
      {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {success && <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

      <div className="flex flex-wrap gap-2">
        {([
          { key: 'id-cards', label: 'Donor ID Cards' },
          { key: 'certificates', label: 'Donor Certificates' },
          { key: 'messages', label: 'Donor Messages' },
        ] as Array<{ key: Tab; label: string }>).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${tab === item.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'id-cards' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setShowTemplateForm(v => !v); setEditTemplateId(null); }} className="px-3 py-2 rounded-lg text-sm bg-slate-900 text-white">{showTemplateForm ? 'Close Template Form' : 'New ID Template'}</button>
            <button onClick={() => setShowIssueIdForm(v => !v)} className="px-3 py-2 rounded-lg text-sm bg-primary-600 text-white">{showIssueIdForm ? 'Close Issue Form' : 'Issue Donor ID'}</button>
          </div>

          {showTemplateForm && (
            <div className="border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Template Name" value={templateForm.templateName} onChange={e => setTemplateForm(f => ({ ...f, templateName: e.target.value }))} />
              <select className="border rounded-lg px-3 py-2 text-sm" value={templateForm.orientation} onChange={e => setTemplateForm(f => ({ ...f, orientation: e.target.value }))}>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Org Name" value={templateForm.orgName} onChange={e => setTemplateForm(f => ({ ...f, orgName: e.target.value }))} />
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Tagline" value={templateForm.tagline} onChange={e => setTemplateForm(f => ({ ...f, tagline: e.target.value }))} />
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Background Color" value={templateForm.backgroundColor} onChange={e => setTemplateForm(f => ({ ...f, backgroundColor: e.target.value }))} />
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Accent Color" value={templateForm.accentColor} onChange={e => setTemplateForm(f => ({ ...f, accentColor: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Dynamic Fields JSON" value={templateForm.dynamicFieldsJson} onChange={e => setTemplateForm(f => ({ ...f, dynamicFieldsJson: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Text Blocks JSON" value={templateForm.textBlocksJson} onChange={e => setTemplateForm(f => ({ ...f, textBlocksJson: e.target.value }))} />
              <div className="md:col-span-2 flex justify-end">
                <button onClick={submitTemplate} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white">{editTemplateId ? 'Update Template' : 'Create Template'}</button>
              </div>
            </div>
          )}

          {showIssueIdForm && (
            <div className="border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="border rounded-lg px-3 py-2 text-sm" value={issueIdForm.donorId} onChange={e => setIssueIdForm(f => ({ ...f, donorId: e.target.value }))}>
                <option value="">Select Donor</option>
                {donors.map(d => <option key={d.donor_id} value={d.donor_id}>{d.first_name} {d.last_name}</option>)}
              </select>
              <select className="border rounded-lg px-3 py-2 text-sm" value={issueIdForm.templateId} onChange={e => setIssueIdForm(f => ({ ...f, templateId: e.target.value }))}>
                <option value="">Select ID Template</option>
                {idTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.template_name}</option>)}
              </select>
              <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={issueIdForm.issueDate} onChange={e => setIssueIdForm(f => ({ ...f, issueDate: e.target.value }))} />
              <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={issueIdForm.expiryDate} onChange={e => setIssueIdForm(f => ({ ...f, expiryDate: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Dynamic Values JSON" value={issueIdForm.dynamicValuesJson} onChange={e => setIssueIdForm(f => ({ ...f, dynamicValuesJson: e.target.value }))} />
              <div className="md:col-span-2 flex justify-end">
                <button onClick={issueIdCard} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white">Issue ID</button>
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {idTemplates.map(t => (
                  <tr key={t.template_id} className="border-t">
                    <td className="px-3 py-2">{t.template_name}</td>
                    <td className="px-3 py-2">{Boolean(t.is_active) ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-2 space-x-2">
                      <button onClick={() => previewIdTemplate(t.template_id)} className="text-primary-600">Preview</button>
                      <button onClick={() => { setEditTemplateId(t.template_id); setShowTemplateForm(true); setTemplateForm(f => ({ ...f, templateName: t.template_name, orientation: t.orientation || 'horizontal', orgName: t.org_name || '', backgroundColor: t.background_color || '#ffffff', accentColor: t.accent_color || '#2563eb', isActive: Boolean(t.is_active) })); }} className="text-amber-600">Edit</button>
                      <button onClick={() => deleteIdTemplate(t.template_id)} className="text-red-600">Delete</button>
                    </td>
                  </tr>
                ))}
                {idTemplates.length === 0 && <tr><td className="px-3 py-4 text-slate-400" colSpan={3}>No templates yet</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Donor</th>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-left">Issue</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {issuedIdCards.map(c => (
                  <tr key={c.card_id} className="border-t">
                    <td className="px-3 py-2">{c.first_name} {c.last_name}</td>
                    <td className="px-3 py-2">{c.template_name}</td>
                    <td className="px-3 py-2">{new Date(c.issue_date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{c.status}</td>
                    <td className="px-3 py-2 space-x-2">
                      <button onClick={() => viewIdRender(c.card_id)} className="text-primary-600">Render</button>
                      {c.status === 'active' && <button onClick={() => revokeIdCard(c.card_id)} className="text-red-600">Revoke</button>}
                    </td>
                  </tr>
                ))}
                {issuedIdCards.length === 0 && <tr><td className="px-3 py-4 text-slate-400" colSpan={5}>No cards issued yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'certificates' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setShowCertTemplateForm(v => !v); setEditCertTemplateId(null); }} className="px-3 py-2 rounded-lg text-sm bg-slate-900 text-white">{showCertTemplateForm ? 'Close Template Form' : 'New Certificate Template'}</button>
            <button onClick={() => setShowIssueCertForm(v => !v)} className="px-3 py-2 rounded-lg text-sm bg-primary-600 text-white">{showIssueCertForm ? 'Close Issue Form' : 'Issue Donor Certificate'}</button>
          </div>

          {showCertTemplateForm && (
            <div className="border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Template Name" value={certTemplateForm.templateName} onChange={e => setCertTemplateForm(f => ({ ...f, templateName: e.target.value }))} />
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Title Text" value={certTemplateForm.titleText} onChange={e => setCertTemplateForm(f => ({ ...f, titleText: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={5} placeholder="Body Template (HTML with {{variables}})" value={certTemplateForm.bodyTemplate} onChange={e => setCertTemplateForm(f => ({ ...f, bodyTemplate: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Dynamic Fields JSON" value={certTemplateForm.dynamicFieldsJson} onChange={e => setCertTemplateForm(f => ({ ...f, dynamicFieldsJson: e.target.value }))} />
              <div className="md:col-span-2 flex justify-end">
                <button onClick={submitCertTemplate} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white">{editCertTemplateId ? 'Update Template' : 'Create Template'}</button>
              </div>
            </div>
          )}

          {showIssueCertForm && (
            <div className="border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="border rounded-lg px-3 py-2 text-sm" value={issueCertForm.donorId} onChange={e => setIssueCertForm(f => ({ ...f, donorId: e.target.value }))}>
                <option value="">Select Donor</option>
                {donors.map(d => <option key={d.donor_id} value={d.donor_id}>{d.first_name} {d.last_name}</option>)}
              </select>
              <select className="border rounded-lg px-3 py-2 text-sm" value={issueCertForm.certTemplateId} onChange={e => setIssueCertForm(f => ({ ...f, certTemplateId: e.target.value }))}>
                <option value="">Select Certificate Template</option>
                {certTemplates.map(t => <option key={t.cert_template_id} value={t.cert_template_id}>{t.template_name}</option>)}
              </select>
              <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={issueCertForm.issueDate} onChange={e => setIssueCertForm(f => ({ ...f, issueDate: e.target.value }))} />
              <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={issueCertForm.expiresAt} onChange={e => setIssueCertForm(f => ({ ...f, expiresAt: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Custom Note" value={issueCertForm.customNote} onChange={e => setIssueCertForm(f => ({ ...f, customNote: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Dynamic Values JSON" value={issueCertForm.dynamicValuesJson} onChange={e => setIssueCertForm(f => ({ ...f, dynamicValuesJson: e.target.value }))} />
              <div className="md:col-span-2 flex justify-end">
                <button onClick={issueCertificate} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white">Issue Certificate</button>
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certTemplates.map(t => (
                  <tr key={t.cert_template_id} className="border-t">
                    <td className="px-3 py-2">{t.template_name}</td>
                    <td className="px-3 py-2">{t.title_text}</td>
                    <td className="px-3 py-2 space-x-2">
                      <button onClick={() => previewCertTemplate(t.cert_template_id)} className="text-primary-600">Preview</button>
                      <button onClick={() => { setEditCertTemplateId(t.cert_template_id); setShowCertTemplateForm(true); setCertTemplateForm(f => ({ ...f, templateName: t.template_name, titleText: t.title_text, primaryColor: t.primary_color || '#2563eb', isActive: Boolean(t.is_active) })); }} className="text-amber-600">Edit</button>
                      <button onClick={() => deleteCertTemplate(t.cert_template_id)} className="text-red-600">Delete</button>
                    </td>
                  </tr>
                ))}
                {certTemplates.length === 0 && <tr><td className="px-3 py-4 text-slate-400" colSpan={3}>No certificate templates yet</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Donor</th>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-left">Issued</th>
                  <th className="px-3 py-2 text-left">Verification</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {issuedCerts.map(c => (
                  <tr key={c.award_id} className="border-t">
                    <td className="px-3 py-2">{c.first_name} {c.last_name}</td>
                    <td className="px-3 py-2">{c.template_name}</td>
                    <td className="px-3 py-2">{new Date(c.issue_date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs">{c.verification_code}</td>
                    <td className="px-3 py-2"><button onClick={() => viewCertRender(c.award_id)} className="text-primary-600">Render</button></td>
                  </tr>
                ))}
                {issuedCerts.length === 0 && <tr><td className="px-3 py-4 text-slate-400" colSpan={5}>No certificates issued yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="space-y-4">
          <button onClick={() => setShowMessageForm(v => !v)} className="px-3 py-2 rounded-lg text-sm bg-primary-600 text-white">{showMessageForm ? 'Close Message Form' : 'Send Message to Donor'}</button>

          {showMessageForm && (
            <div className="border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="border rounded-lg px-3 py-2 text-sm" value={messageForm.recipientDonorId} onChange={e => setMessageForm(f => ({ ...f, recipientDonorId: e.target.value }))}>
                <option value="">Select Donor</option>
                {donors.map(d => <option key={d.donor_id} value={d.donor_id}>{d.first_name} {d.last_name}</option>)}
              </select>
              <select className="border rounded-lg px-3 py-2 text-sm" value={messageForm.channel} onChange={e => setMessageForm(f => ({ ...f, channel: e.target.value }))}>
                <option value="in_app">In App</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
              <input className="border rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Subject" value={messageForm.subject} onChange={e => setMessageForm(f => ({ ...f, subject: e.target.value }))} />
              <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2" rows={4} placeholder="Message" value={messageForm.body} onChange={e => setMessageForm(f => ({ ...f, body: e.target.value }))} />
              <div className="md:col-span-2 flex justify-end"><button onClick={sendMessage} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white">Send Message</button></div>
            </div>
          )}

          <div className="space-y-2">
            {loading && <div className="text-sm text-slate-500">Loading messages...</div>}
            {!loading && messages.map(m => (
              <div key={m.message_id} className={`border rounded-xl p-4 ${m.is_read ? 'bg-slate-50 border-slate-200' : 'bg-primary-50 border-primary-200'}`}>
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">{m.subject}</div>
                    <div className="text-xs text-slate-500">To: {m.first_name} {m.last_name} • {m.channel}</div>
                  </div>
                  <div className="text-xs text-slate-400">{new Date(m.sent_at).toLocaleString()}</div>
                </div>
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
            {!loading && messages.length === 0 && <div className="text-sm text-slate-400">No donor messages yet</div>}
          </div>
        </div>
      )}
    </div>
  );
}
