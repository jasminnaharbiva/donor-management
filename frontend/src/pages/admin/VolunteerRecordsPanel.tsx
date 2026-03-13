import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import VmsPanel from './VmsPanel';

type ActiveTab = 'id-cards' | 'certificates' | 'messages' | 'volunteers' | 'unified-vms';

// Matches GET /volunteer-records/id-card-templates
interface IdCardTemplate {
  template_id: number;
  template_name: string;
  orientation: string;
  background_color: string;
  org_name: string | null;
  tagline: string | null;
  accent_color: string;
  text_color?: string | null;
  org_logo_url?: string | null;
  admin_signature_url?: string | null;
  admin_signature_name?: string | null;
  admin_signature_title?: string | null;
  footer_text?: string | null;
  font_family?: string | null;
  qr_base_url?: string | null;
  show_photo?: boolean | number;
  show_badge_number?: boolean | number;
  show_designation?: boolean | number;
  show_project_name?: boolean | number;
  show_validity_date?: boolean | number;
  show_qr_code?: boolean | number;
  validity_duration_months?: number | null;
  layout_json?: string | null;
  dynamic_fields_json?: string | null;
  text_blocks_json?: string | null;
  logo_position_json?: string | null;
  signature_position_json?: string | null;
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
  qr_code_value?: string | null;
  qr_code_data_url?: string | null;
  rendered_html?: string | null;
}

// Matches GET /volunteer-records/certificate-templates
interface CertificateTemplate {
  cert_template_id: number;
  template_name: string;
  title_text: string;
  body_template: string;
  primary_color: string;
  background_image_url?: string | null;
  org_logo_url?: string | null;
  admin_signature_1_url?: string | null;
  admin_signature_1_name?: string | null;
  admin_signature_1_title?: string | null;
  admin_signature_2_url?: string | null;
  admin_signature_2_name?: string | null;
  admin_signature_2_title?: string | null;
  layout_json?: string | null;
  dynamic_fields_json?: string | null;
  text_blocks_json?: string | null;
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
  verification_url?: string | null;
  qr_code_data_url?: string | null;
  rendered_html?: string | null;
  certificate_hash?: string | null;
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

// Matches GET /volunteers/search
interface VolunteerSearchResult {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  father_name: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  education_level: string | null;
  mobile_number: string | null;
  address: string | null;
  full_address: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  city: string | null;
  country: string | null;
  background_check_status: string;
  badge_number: string;
  status: string;
  approved_at: string | null;
  created_at: string;
  email: string | null;
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
  const [editingIdTemplateId, setEditingIdTemplateId] = useState<number | null>(null);
  const [idTemplateForm, setIdTemplateForm] = useState({
    templateName: '', orientation: 'horizontal',
    orgName: '', tagline: '', orgLogoUrl: '',
    backgroundColor: '#dbeafe', accentColor: '#1a56db',
    textColor: '#0f172a',
    footerText: '', fontFamily: 'Inter, Arial, sans-serif',
    adminSignatureUrl: '', adminSignatureName: '', adminSignatureTitle: '',
    qrBaseUrl: '/verify/{{badge_number}}?card={{card_id}}',
    showPhoto: true, showBadgeNumber: true, showDesignation: true, showProjectName: true, showValidityDate: true, showQrCode: true,
    dynamicFieldsJson: '[]', textBlocksJson: '[]', layoutJson: '{}',
    validityDurationMonths: 12, isActive: true,
  });
  const [showIssueCard, setShowIssueCard] = useState(false);
  const [issueCardForm, setIssueCardForm] = useState({
    volunteerId: '', templateId: '', issueDate: today(), expiryDate: nextYear(), dynamicValuesJson: '{}',
  });

  // --- Certificates State ---
  const [certTemplates, setCertTemplates]   = useState<CertificateTemplate[]>([]);
  const [issuedCerts, setIssuedCerts]       = useState<IssuedCertificate[]>([]);
  const [loadingCerts, setLoadingCerts]     = useState(false);
  const [showNewCertTemplate, setShowNewCertTemplate] = useState(false);
  const [editingCertTemplateId, setEditingCertTemplateId] = useState<number | null>(null);
  const [certTemplateForm, setCertTemplateForm] = useState({
    templateName: '', titleText: '',
    bodyTemplate: '<div style="text-align:center;padding:40px;font-family:Georgia,serif">\n  <h1>{{org_name}}</h1>\n  <h2>{{title_text}}</h2>\n  <p>Awarded to</p>\n  <h3>{{volunteer_name}}</h3>\n  <p>{{custom_note}}</p>\n  <p>Verification: {{verification_code}} | Date: {{issue_date}}</p>\n</div>',
    primaryColor: '#2563eb', isActive: true,
    backgroundImageUrl: '', orgLogoUrl: '',
    adminSignature1Url: '', adminSignature1Name: '', adminSignature1Title: '',
    adminSignature2Url: '', adminSignature2Name: '', adminSignature2Title: '',
    dynamicFieldsJson: '[]', textBlocksJson: '[]', layoutJson: '{}',
  });
  const [showIssueCert, setShowIssueCert]   = useState(false);
  const [issueCertForm, setIssueCertForm]   = useState({
    volunteerId: '', certTemplateId: '', issueDate: today(),
    hoursServed: '', customNote: '', serviceStartDate: '', serviceEndDate: '', expiresAt: '', dynamicValuesJson: '{}',
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

  // --- Volunteer Search State ---
  const [volunteerSearchResults, setVolunteerSearchResults] = useState<VolunteerSearchResult[]>([]);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [volunteerFilters, setVolunteerFilters] = useState({
    search: '',
    status: '',
    city: '',
    country: '',
    background_check_status: '',
    badge_number: '',
    approved_after: '',
    approved_before: '',
    father_name: '',
    district: '',
    upazila: '',
    division: '',
    education_level: '',
    blood_group: '',
    sort_by: 'first_name',
    sort_order: 'asc',
    page: 1,
    limit: 20
  });
  const [volunteerPagination, setVolunteerPagination] = useState({
    total: 0,
    total_pages: 0,
    page: 1,
    limit: 20
  });

  const loadVolunteers = useCallback(async () => {
    try {
      const res = await api.get('/volunteers');
      setVolunteers(res.data?.data ?? []);
    } catch {}
  }, []);

  // Load Volunteer Search Results
  const loadVolunteerSearch = useCallback(async () => {
    if (tab !== 'volunteers') return;
    setLoadingVolunteers(true);
    try {
      const params = new URLSearchParams();
      Object.entries(volunteerFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });
      const res = await api.get(`/volunteers/search?${params}`);
      setVolunteerSearchResults(res.data?.data ?? []);
      setVolunteerPagination(res.data?.pagination ?? { total: 0, total_pages: 0, page: 1, limit: 20 });
    } catch { setError('Failed to load volunteer search results'); }
    setLoadingVolunteers(false);
  }, [tab, volunteerFilters]);

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
    if (tab === 'volunteers') loadVolunteerSearch();
    else if (tab === 'id-cards') loadCards();
    else if (tab === 'certificates') loadCerts();
    else if (tab === 'messages') loadMessages();
  }, [tab, loadVolunteerSearch, loadCards, loadCerts, loadMessages]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  const parseJsonInput = (value: string, fieldName: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      setError(`${fieldName} must be valid JSON`);
      return null;
    }
  };

  const openHtmlPreview = (html: string, title: string) => {
    const preview = window.open('', '_blank');
    if (!preview) {
      setError('Please allow popups to open template preview');
      return;
    }
    preview.document.write(`<html><head><title>${title}</title></head><body style="margin:0;padding:16px;background:#f8fafc;">${html}</body></html>`);
    preview.document.close();
  };

  // ID Card actions
  const createIdTemplate = async () => {
    if (!idTemplateForm.templateName.trim()) { setError('Template name is required'); return; }

    const dynamicFields = parseJsonInput(idTemplateForm.dynamicFieldsJson, 'ID dynamic fields JSON');
    if (dynamicFields === null) return;
    const textBlocks = parseJsonInput(idTemplateForm.textBlocksJson, 'ID text blocks JSON');
    if (textBlocks === null) return;
    const layout = parseJsonInput(idTemplateForm.layoutJson, 'ID layout JSON');
    if (layout === null) return;

    const payload = {
      templateName: idTemplateForm.templateName,
      orientation: idTemplateForm.orientation,
      orgName: idTemplateForm.orgName || undefined,
      tagline: idTemplateForm.tagline || undefined,
      orgLogoUrl: idTemplateForm.orgLogoUrl || undefined,
      backgroundColor: idTemplateForm.backgroundColor,
      accentColor: idTemplateForm.accentColor,
      textColor: idTemplateForm.textColor,
      footerText: idTemplateForm.footerText || undefined,
      fontFamily: idTemplateForm.fontFamily || undefined,
      adminSignatureUrl: idTemplateForm.adminSignatureUrl || undefined,
      adminSignatureName: idTemplateForm.adminSignatureName || undefined,
      adminSignatureTitle: idTemplateForm.adminSignatureTitle || undefined,
      qrBaseUrl: idTemplateForm.qrBaseUrl || undefined,
      showPhoto: idTemplateForm.showPhoto,
      showBadgeNumber: idTemplateForm.showBadgeNumber,
      showDesignation: idTemplateForm.showDesignation,
      showProjectName: idTemplateForm.showProjectName,
      showValidityDate: idTemplateForm.showValidityDate,
      showQrCode: idTemplateForm.showQrCode,
      dynamicFieldsJson: dynamicFields,
      textBlocksJson: textBlocks,
      layoutJson: layout,
      validityDurationMonths: idTemplateForm.validityDurationMonths,
      isActive: idTemplateForm.isActive,
    };

    try {
      if (editingIdTemplateId) {
        await api.put(`/volunteer-records/id-card-templates/${editingIdTemplateId}`, payload);
      } else {
        await api.post('/volunteer-records/id-card-templates', payload);
      }
      setShowNewIdTemplate(false);
      setEditingIdTemplateId(null);
      setIdTemplateForm({
        templateName: '', orientation: 'horizontal', orgName: '', tagline: '', orgLogoUrl: '',
        backgroundColor: '#dbeafe', accentColor: '#1a56db', textColor: '#0f172a',
        footerText: '', fontFamily: 'Inter, Arial, sans-serif',
        adminSignatureUrl: '', adminSignatureName: '', adminSignatureTitle: '',
        qrBaseUrl: '/verify/{{badge_number}}?card={{card_id}}',
        showPhoto: true, showBadgeNumber: true, showDesignation: true, showProjectName: true, showValidityDate: true, showQrCode: true,
        dynamicFieldsJson: '[]', textBlocksJson: '[]', layoutJson: '{}',
        validityDurationMonths: 12, isActive: true,
      });
      flash(editingIdTemplateId ? 'ID card template updated' : 'ID card template created');
      loadCards();
    } catch { setError('Failed to create ID card template'); }
  };

  const editIdTemplate = (template: IdCardTemplate) => {
    setEditingIdTemplateId(template.template_id);
    setIdTemplateForm({
      templateName: template.template_name || '',
      orientation: template.orientation || 'horizontal',
      orgName: template.org_name || '',
      tagline: template.tagline || '',
      orgLogoUrl: template.org_logo_url || '',
      backgroundColor: template.background_color || '#dbeafe',
      accentColor: template.accent_color || '#1a56db',
      textColor: template.text_color || '#0f172a',
      footerText: template.footer_text || '',
      fontFamily: template.font_family || 'Inter, Arial, sans-serif',
      adminSignatureUrl: template.admin_signature_url || '',
      adminSignatureName: template.admin_signature_name || '',
      adminSignatureTitle: template.admin_signature_title || '',
      qrBaseUrl: template.qr_base_url || '/verify/{{badge_number}}?card={{card_id}}',
      showPhoto: Boolean(template.show_photo ?? true),
      showBadgeNumber: Boolean(template.show_badge_number ?? true),
      showDesignation: Boolean(template.show_designation ?? true),
      showProjectName: Boolean(template.show_project_name ?? true),
      showValidityDate: Boolean(template.show_validity_date ?? true),
      showQrCode: Boolean(template.show_qr_code ?? true),
      dynamicFieldsJson: template.dynamic_fields_json || '[]',
      textBlocksJson: template.text_blocks_json || '[]',
      layoutJson: template.layout_json || '{}',
      validityDurationMonths: template.validity_duration_months || 12,
      isActive: Boolean(template.is_active),
    });
    setShowNewIdTemplate(true);
  };

  const deleteIdTemplate = async (templateId: number) => {
    if (!window.confirm('Delete this ID template? This is blocked if cards are already issued from it.')) return;
    try {
      await api.delete(`/volunteer-records/id-card-templates/${templateId}`);
      flash('ID template deleted');
      loadCards();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete ID template');
    }
  };

  const previewIdTemplate = async (templateId: number) => {
    try {
      const res = await api.post(`/volunteer-records/id-card-templates/${templateId}/preview`, {});
      const html = res.data?.data?.rendered_html;
      if (!html) {
        setError('Preview render was empty');
        return;
      }
      openHtmlPreview(html, 'ID Card Preview');
    } catch {
      setError('Failed to preview ID card template');
    }
  };

  const issueIdCard = async () => {
    if (!issueCardForm.volunteerId || !issueCardForm.templateId || !issueCardForm.issueDate) {
      setError('Select volunteer, template, and issue date');
      return;
    }
    const dynamicValues = parseJsonInput(issueCardForm.dynamicValuesJson, 'ID card dynamic values JSON');
    if (dynamicValues === null) return;
    try {
      await api.post('/volunteer-records/id-cards', {
        volunteerId: Number(issueCardForm.volunteerId),
        templateId:  Number(issueCardForm.templateId),
        issueDate:   issueCardForm.issueDate,
        expiryDate:  issueCardForm.expiryDate || undefined,
        dynamicValues,
      });
      setShowIssueCard(false);
      setIssueCardForm({ volunteerId: '', templateId: '', issueDate: today(), expiryDate: nextYear(), dynamicValuesJson: '{}' });
      flash('ID card issued successfully');
      loadCards();
    } catch { setError('Failed to issue ID card'); }
  };

  const viewIssuedIdCardRender = async (cardId: string) => {
    try {
      const res = await api.get(`/volunteer-records/id-cards/${cardId}/render`);
      const html = res.data?.data?.rendered_html;
      if (!html) {
        setError('Card render output is not available');
        return;
      }
      openHtmlPreview(html, 'Issued ID Card');
    } catch {
      setError('Failed to load card render');
    }
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

    const dynamicFields = parseJsonInput(certTemplateForm.dynamicFieldsJson, 'Certificate dynamic fields JSON');
    if (dynamicFields === null) return;
    const textBlocks = parseJsonInput(certTemplateForm.textBlocksJson, 'Certificate text blocks JSON');
    if (textBlocks === null) return;
    const layout = parseJsonInput(certTemplateForm.layoutJson, 'Certificate layout JSON');
    if (layout === null) return;

    const payload = {
      templateName: certTemplateForm.templateName,
      titleText: certTemplateForm.titleText,
      bodyTemplate: certTemplateForm.bodyTemplate,
      primaryColor: certTemplateForm.primaryColor,
      backgroundImageUrl: certTemplateForm.backgroundImageUrl || undefined,
      orgLogoUrl: certTemplateForm.orgLogoUrl || undefined,
      adminSignature1Url: certTemplateForm.adminSignature1Url || undefined,
      adminSignature1Name: certTemplateForm.adminSignature1Name || undefined,
      adminSignature1Title: certTemplateForm.adminSignature1Title || undefined,
      adminSignature2Url: certTemplateForm.adminSignature2Url || undefined,
      adminSignature2Name: certTemplateForm.adminSignature2Name || undefined,
      adminSignature2Title: certTemplateForm.adminSignature2Title || undefined,
      dynamicFieldsJson: dynamicFields,
      textBlocksJson: textBlocks,
      layoutJson: layout,
      isActive: certTemplateForm.isActive,
    };

    try {
      if (editingCertTemplateId) {
        await api.put(`/volunteer-records/certificate-templates/${editingCertTemplateId}`, payload);
      } else {
        await api.post('/volunteer-records/certificate-templates', payload);
      }
      setShowNewCertTemplate(false);
      setEditingCertTemplateId(null);
      setCertTemplateForm({
        templateName: '', titleText: '', bodyTemplate: '<div style="text-align:center;padding:40px;font-family:Georgia,serif">\n  <h1>{{org_name}}</h1>\n  <h2>{{title_text}}</h2>\n  <p>Awarded to</p>\n  <h3>{{volunteer_name}}</h3>\n  <p>{{custom_note}}</p>\n  <p>Verification: {{verification_code}} | Date: {{issue_date}}</p>\n</div>',
        primaryColor: '#2563eb', isActive: true,
        backgroundImageUrl: '', orgLogoUrl: '',
        adminSignature1Url: '', adminSignature1Name: '', adminSignature1Title: '',
        adminSignature2Url: '', adminSignature2Name: '', adminSignature2Title: '',
        dynamicFieldsJson: '[]', textBlocksJson: '[]', layoutJson: '{}',
      });
      flash(editingCertTemplateId ? 'Certificate template updated' : 'Certificate template created');
      loadCerts();
    } catch { setError('Failed to create certificate template'); }
  };

  const editCertTemplate = (template: CertificateTemplate) => {
    setEditingCertTemplateId(template.cert_template_id);
    setCertTemplateForm({
      templateName: template.template_name || '',
      titleText: template.title_text || '',
      bodyTemplate: template.body_template || '',
      primaryColor: template.primary_color || '#2563eb',
      isActive: Boolean(template.is_active),
      backgroundImageUrl: template.background_image_url || '',
      orgLogoUrl: template.org_logo_url || '',
      adminSignature1Url: template.admin_signature_1_url || '',
      adminSignature1Name: template.admin_signature_1_name || '',
      adminSignature1Title: template.admin_signature_1_title || '',
      adminSignature2Url: template.admin_signature_2_url || '',
      adminSignature2Name: template.admin_signature_2_name || '',
      adminSignature2Title: template.admin_signature_2_title || '',
      dynamicFieldsJson: template.dynamic_fields_json || '[]',
      textBlocksJson: template.text_blocks_json || '[]',
      layoutJson: template.layout_json || '{}',
    });
    setShowNewCertTemplate(true);
  };

  const deleteCertTemplate = async (templateId: number) => {
    if (!window.confirm('Delete this certificate template? This is blocked if certificates are already issued from it.')) return;
    try {
      await api.delete(`/volunteer-records/certificate-templates/${templateId}`);
      flash('Certificate template deleted');
      loadCerts();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete certificate template');
    }
  };

  const previewCertTemplate = async (templateId: number) => {
    try {
      const res = await api.post(`/volunteer-records/certificate-templates/${templateId}/preview`, {});
      const html = res.data?.data?.rendered_html;
      if (!html) {
        setError('Preview render was empty');
        return;
      }
      openHtmlPreview(html, 'Certificate Preview');
    } catch {
      setError('Failed to preview certificate template');
    }
  };

  const issueCertificate = async () => {
    if (!issueCertForm.volunteerId || !issueCertForm.certTemplateId || !issueCertForm.issueDate) {
      setError('Select volunteer, template, and issue date');
      return;
    }
    const dynamicValues = parseJsonInput(issueCertForm.dynamicValuesJson, 'Certificate dynamic values JSON');
    if (dynamicValues === null) return;
    try {
      await api.post('/volunteer-records/certificates', {
        volunteerId:    Number(issueCertForm.volunteerId),
        certTemplateId: Number(issueCertForm.certTemplateId),
        issueDate:      issueCertForm.issueDate,
        hoursServed:    issueCertForm.hoursServed ? Number(issueCertForm.hoursServed) : undefined,
        customNote:     issueCertForm.customNote || undefined,
        serviceStartDate: issueCertForm.serviceStartDate || undefined,
        serviceEndDate: issueCertForm.serviceEndDate || undefined,
        expiresAt: issueCertForm.expiresAt || undefined,
        dynamicValues,
      });
      setShowIssueCert(false);
      setIssueCertForm({ volunteerId: '', certTemplateId: '', issueDate: today(), hoursServed: '', customNote: '', serviceStartDate: '', serviceEndDate: '', expiresAt: '', dynamicValuesJson: '{}' });
      flash('Certificate awarded successfully');
      loadCerts();
    } catch { setError('Failed to award certificate'); }
  };

  const viewIssuedCertificateRender = async (awardId: string) => {
    try {
      const res = await api.get(`/volunteer-records/certificates/${awardId}/render`);
      const html = res.data?.data?.rendered_html;
      if (!html) {
        setError('Certificate render output is not available');
        return;
      }
      openHtmlPreview(html, 'Issued Certificate');
    } catch {
      setError('Failed to load certificate render');
    }
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
    { key: 'unified-vms', label: 'Unified VMS Hub' },
    { key: 'volunteers', label: 'Find Volunteers' },
    { key: 'id-cards', label: 'ID Cards' },
    { key: 'certificates', label: 'Certificates' },
    { key: 'messages', label: 'Volunteer Messages' },
  ];

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-6">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 text-center sm:text-left">Volunteer Records</h2>
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
      <div className="flex overflow-x-auto border-b border-slate-200 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap flex-shrink-0 px-3 py-2.5 sm:px-5 sm:py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* =================== VOLUNTEERS TAB =================== */}
      {tab === 'unified-vms' && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="mb-3 text-xs sm:text-sm text-slate-600">
            Unified mode: VMS certificate management + legacy volunteer records are available in one admin module.
          </div>
          <VmsPanel />
        </div>
      )}

      {/* =================== VOLUNTEERS TAB =================== */}
      {tab === 'volunteers' && (
        <div>
          <div className="mb-4">
            <h3 className="font-semibold text-slate-700 text-center sm:text-left mb-4">Advanced Volunteer Search & Filter</h3>
            
            {/* Filters Form */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={volunteerFilters.search}
                    onChange={e => setVolunteerFilters(f => ({ ...f, search: e.target.value }))}
                    placeholder="Name, email, or badge #"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={volunteerFilters.status}
                    onChange={e => setVolunteerFilters(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={volunteerFilters.city}
                    onChange={e => setVolunteerFilters(f => ({ ...f, city: e.target.value }))}
                    placeholder="City name"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={volunteerFilters.country}
                    onChange={e => setVolunteerFilters(f => ({ ...f, country: e.target.value }))}
                    placeholder="Country"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Background Check</label>
                  <select
                    value={volunteerFilters.background_check_status}
                    onChange={e => setVolunteerFilters(f => ({ ...f, background_check_status: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="not_required">Not Required</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Number</label>
                  <input
                    type="text"
                    value={volunteerFilters.badge_number}
                    onChange={e => setVolunteerFilters(f => ({ ...f, badge_number: e.target.value }))}
                    placeholder="Badge #"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Approved After</label>
                  <input
                    type="date"
                    value={volunteerFilters.approved_after}
                    onChange={e => setVolunteerFilters(f => ({ ...f, approved_after: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Before</label>
                  <input
                    type="date"
                    value={volunteerFilters.approved_before}
                    onChange={e => setVolunteerFilters(f => ({ ...f, approved_before: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Father's Name</label>
                  <input
                    type="text"
                    value={volunteerFilters.father_name || ''}
                    onChange={e => setVolunteerFilters(f => ({ ...f, father_name: e.target.value }))}
                    placeholder="Father's name"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    value={volunteerFilters.district || ''}
                    onChange={e => setVolunteerFilters(f => ({ ...f, district: e.target.value }))}
                    placeholder="District"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Upazila</label>
                  <input
                    type="text"
                    value={volunteerFilters.upazila || ''}
                    onChange={e => setVolunteerFilters(f => ({ ...f, upazila: e.target.value }))}
                    placeholder="Upazila"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Division</label>
                  <input
                    type="text"
                    value={volunteerFilters.division || ''}
                    onChange={e => setVolunteerFilters(f => ({ ...f, division: e.target.value }))}
                    placeholder="Division"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Education Level</label>
                  <input
                    type="text"
                    value={volunteerFilters.education_level || ''}
                    onChange={e => setVolunteerFilters(f => ({ ...f, education_level: e.target.value }))}
                    placeholder="Education level"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={volunteerFilters.blood_group || ''}
                    onChange={e => setVolunteerFilters(f => ({ ...f, blood_group: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Blood Groups</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sort By</label>
                  <div className="flex gap-2">
                    <select
                      value={volunteerFilters.sort_by}
                      onChange={e => setVolunteerFilters(f => ({ ...f, sort_by: e.target.value }))}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="first_name">First Name</option>
                      <option value="last_name">Last Name</option>
                      <option value="badge_number">Badge Number</option>
                      <option value="status">Status</option>
                      <option value="approved_at">Approved Date</option>
                      <option value="created_at">Created Date</option>
                    </select>
                    <select
                      value={volunteerFilters.sort_order}
                      onChange={e => setVolunteerFilters(f => ({ ...f, sort_order: e.target.value }))}
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="asc">Asc</option>
                      <option value="desc">Desc</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => loadVolunteerSearch()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                >
                  Search
                </button>
                <button
                  onClick={() => setVolunteerFilters({
                    search: '',
                    status: '',
                    city: '',
                    country: '',
                    background_check_status: '',
                    badge_number: '',
                    approved_after: '',
                    approved_before: '',
                    father_name: '',
                    district: '',
                    upazila: '',
                    division: '',
                    education_level: '',
                    blood_group: '',
                    sort_by: 'first_name',
                    sort_order: 'asc',
                    page: 1,
                    limit: 20
                  })}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Results */}
            {loadingVolunteers ? (
              <div className="text-slate-400 py-8 text-center">Searching volunteers…</div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Name', 'Badge #', 'Email', 'District', 'Division', 'Education', 'Blood Group', 'Status', 'Approved At'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {volunteerSearchResults.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-slate-400 text-sm">No volunteers found. Try adjusting your filters.</td></tr>
                      ) : volunteerSearchResults.map(v => (
                        <tr key={v.volunteer_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-700 font-medium">{v.first_name} {v.last_name}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-600">{v.badge_number}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.email || '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.district || '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.division || '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.education_level || '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.blood_group || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              v.status === 'active' ? 'bg-green-100 text-green-700' :
                              v.status === 'inactive' ? 'bg-slate-100 text-slate-500' :
                              v.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {v.approved_at ? new Date(v.approved_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {volunteerPagination.total_pages > 1 && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-sm text-slate-700">
                      Showing {((volunteerPagination.page - 1) * volunteerPagination.limit) + 1} to {Math.min(volunteerPagination.page * volunteerPagination.limit, volunteerPagination.total)} of {volunteerPagination.total} results
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVolunteerFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                        disabled={volunteerPagination.page <= 1}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setVolunteerFilters(f => ({ ...f, page: Math.min(volunteerPagination.total_pages, f.page + 1) }))}
                        disabled={volunteerPagination.page >= volunteerPagination.total_pages}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== ID CARDS TAB =================== */}
      {tab === 'id-cards' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h3 className="font-semibold text-slate-700 text-center sm:text-left">ID Card Templates</h3>
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => previewIdTemplate(t.template_id)} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700">Preview</button>
                    <button onClick={() => editIdTemplate(t)} className="text-xs px-2 py-1 rounded bg-primary-50 hover:bg-primary-100 text-primary-700">Edit</button>
                    <button onClick={() => deleteIdTemplate(t.template_id)} className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h3 className="font-semibold text-slate-700 text-center sm:text-left">Issued ID Cards</h3>
            <button onClick={() => setShowIssueCard(true)} className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Issue Card
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Volunteer', 'Badge #', 'Template', 'Issue Date', 'Expiry', 'QR', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issuedCards.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-sm">No cards issued yet</td></tr>
                ) : issuedCards.map(c => (
                  <tr key={c.card_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{c.badge_number}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.template_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(c.issue_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {c.qr_code_data_url ? <img src={c.qr_code_data_url} alt="qr" className="h-10 w-10 border rounded" /> : <span className="text-xs text-slate-400">N/A</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === 'revoked' || c.revoked_at ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {c.status === 'revoked' || c.revoked_at ? 'Revoked' : 'Valid'}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <button onClick={() => viewIssuedIdCardRender(c.card_id)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">View</button>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h3 className="font-semibold text-slate-700 text-center sm:text-left">Certificate Templates</h3>
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => previewCertTemplate(t.cert_template_id)} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700">Preview</button>
                    <button onClick={() => editCertTemplate(t)} className="text-xs px-2 py-1 rounded bg-primary-50 hover:bg-primary-100 text-primary-700">Edit</button>
                    <button onClick={() => deleteCertTemplate(t.cert_template_id)} className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
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
                  {['Volunteer', 'Template', 'Note', 'Hours', 'Issue Date', 'Verification Code', 'QR', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issuedCerts.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-sm">No certificates awarded yet</td></tr>
                ) : issuedCerts.map(c => (
                  <tr key={c.award_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.template_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{c.custom_note ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.hours_served != null ? `${c.hours_served}h` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(c.issue_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary-700 bg-primary-50 rounded">{c.verification_code}</td>
                    <td className="px-4 py-3">
                      {c.qr_code_data_url ? <img src={c.qr_code_data_url} alt="qr" className="h-10 w-10 border rounded" /> : <span className="text-xs text-slate-400">N/A</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => viewIssuedCertificateRender(c.award_id)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">View</button>
                    </td>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="font-semibold text-slate-700 text-center sm:text-left">Sent Messages to Volunteers</h3>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-bold mb-4">{editingIdTemplateId ? 'Edit ID Card Template' : 'New ID Card Template'}</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Template Name *</label>
                <input value={idTemplateForm.templateName}
                  onChange={e => setIdTemplateForm(f => ({ ...f, templateName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Standard Volunteer Card" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Orientation</label>
                <select value={idTemplateForm.orientation}
                  onChange={e => setIdTemplateForm(f => ({ ...f, orientation: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organisation Logo URL</label>
                <input value={idTemplateForm.orgLogoUrl}
                  onChange={e => setIdTemplateForm(f => ({ ...f, orgLogoUrl: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="https://..." />
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Text Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={idTemplateForm.textColor}
                    onChange={e => setIdTemplateForm(f => ({ ...f, textColor: e.target.value }))}
                    className="h-9 w-12 rounded border border-slate-300 cursor-pointer" />
                  <span className="text-xs text-slate-500">{idTemplateForm.textColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Validity (months)</label>
                <input type="number" min={1} max={120} value={idTemplateForm.validityDurationMonths}
                  onChange={e => setIdTemplateForm(f => ({ ...f, validityDurationMonths: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Footer Text</label>
                <input value={idTemplateForm.footerText}
                  onChange={e => setIdTemplateForm(f => ({ ...f, footerText: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="Emergency hotline / legal note" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Font Family</label>
                <input value={idTemplateForm.fontFamily}
                  onChange={e => setIdTemplateForm(f => ({ ...f, fontFamily: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="Inter, Arial, sans-serif" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">QR Base URL Template</label>
                <input value={idTemplateForm.qrBaseUrl}
                  onChange={e => setIdTemplateForm(f => ({ ...f, qrBaseUrl: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="/verify/{{badge_number}}?card={{card_id}}" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Signature URL</label>
                <input value={idTemplateForm.adminSignatureUrl}
                  onChange={e => setIdTemplateForm(f => ({ ...f, adminSignatureUrl: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Signature Name</label>
                <input value={idTemplateForm.adminSignatureName}
                  onChange={e => setIdTemplateForm(f => ({ ...f, adminSignatureName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="Authorized Signatory" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Signature Title</label>
                <input value={idTemplateForm.adminSignatureTitle}
                  onChange={e => setIdTemplateForm(f => ({ ...f, adminSignatureTitle: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="Coordinator / Director" />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2 mt-2">
                {[['showPhoto','Photo'],['showBadgeNumber','Badge #'],['showDesignation','Designation'],['showProjectName','Project'],['showValidityDate','Validity'],['showQrCode','QR']].map(([field,label]) => (
                  <label key={field} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean((idTemplateForm as any)[field])}
                      onChange={e => setIdTemplateForm(f => ({ ...f, [field]: e.target.checked }))}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dynamic Fields JSON</label>
                <textarea rows={4} value={idTemplateForm.dynamicFieldsJson}
                  onChange={e => setIdTemplateForm(f => ({ ...f, dynamicFieldsJson: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                  placeholder='[{"key":"mobile_number","label":"Mobile","enabled":true}]' />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Text Blocks JSON</label>
                <textarea rows={3} value={idTemplateForm.textBlocksJson}
                  onChange={e => setIdTemplateForm(f => ({ ...f, textBlocksJson: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                  placeholder='[{"text":"Access Level: Volunteer"}]' />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Advanced Layout JSON</label>
                <textarea rows={3} value={idTemplateForm.layoutJson}
                  onChange={e => setIdTemplateForm(f => ({ ...f, layoutJson: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                  placeholder='{"version":"2026.1","mode":"auto"}' />
              </div>
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={idTemplateForm.isActive}
                onChange={e => setIdTemplateForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <span className="text-sm text-slate-700">Set as Active</span>
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowNewIdTemplate(false); setEditingIdTemplateId(null); }} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={createIdTemplate} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingIdTemplateId ? 'Update Template' : 'Create Template'}</button>
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
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dynamic Values JSON (optional)</label>
              <textarea rows={4} value={issueCardForm.dynamicValuesJson}
                onChange={e => setIssueCardForm(f => ({ ...f, dynamicValuesJson: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                placeholder='{"custom_title":"Field Supervisor"}' />
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-bold mb-4">{editingCertTemplateId ? 'Edit Certificate Template' : 'New Certificate Template'}</h3>
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Background Image URL</label>
                <input value={certTemplateForm.backgroundImageUrl}
                  onChange={e => setCertTemplateForm(f => ({ ...f, backgroundImageUrl: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Org Logo URL</label>
                <input value={certTemplateForm.orgLogoUrl}
                  onChange={e => setCertTemplateForm(f => ({ ...f, orgLogoUrl: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="https://..." />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input value={certTemplateForm.adminSignature1Url} onChange={e => setCertTemplateForm(f => ({ ...f, adminSignature1Url: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" placeholder="Signature 1 URL" />
              <input value={certTemplateForm.adminSignature2Url} onChange={e => setCertTemplateForm(f => ({ ...f, adminSignature2Url: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" placeholder="Signature 2 URL" />
              <input value={certTemplateForm.adminSignature1Name} onChange={e => setCertTemplateForm(f => ({ ...f, adminSignature1Name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" placeholder="Signature 1 Name" />
              <input value={certTemplateForm.adminSignature2Name} onChange={e => setCertTemplateForm(f => ({ ...f, adminSignature2Name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" placeholder="Signature 2 Name" />
              <input value={certTemplateForm.adminSignature1Title} onChange={e => setCertTemplateForm(f => ({ ...f, adminSignature1Title: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" placeholder="Signature 1 Title" />
              <input value={certTemplateForm.adminSignature2Title} onChange={e => setCertTemplateForm(f => ({ ...f, adminSignature2Title: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" placeholder="Signature 2 Title" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dynamic Fields JSON</label>
              <textarea rows={3} value={certTemplateForm.dynamicFieldsJson}
                onChange={e => setCertTemplateForm(f => ({ ...f, dynamicFieldsJson: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                placeholder='[{"key":"hours_served","label":"Hours Served","enabled":true}]' />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Text Blocks JSON</label>
              <textarea rows={3} value={certTemplateForm.textBlocksJson}
                onChange={e => setCertTemplateForm(f => ({ ...f, textBlocksJson: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                placeholder='[{"text":"Signed digitally and verifiable via QR"}]' />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Advanced Layout JSON</label>
              <textarea rows={3} value={certTemplateForm.layoutJson}
                onChange={e => setCertTemplateForm(f => ({ ...f, layoutJson: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                placeholder='{"version":"2026.1","mode":"smart"}' />
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={certTemplateForm.isActive}
                onChange={e => setCertTemplateForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <span className="text-sm text-slate-700">Set as Active</span>
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowNewCertTemplate(false); setEditingCertTemplateId(null); }} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={createCertTemplate} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingCertTemplateId ? 'Update Template' : 'Create Template'}</button>
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Start</label>
                <input type="date" value={issueCertForm.serviceStartDate}
                  onChange={e => setIssueCertForm(f => ({ ...f, serviceStartDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service End</label>
                <input type="date" value={issueCertForm.serviceEndDate}
                  onChange={e => setIssueCertForm(f => ({ ...f, serviceEndDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Certificate Expiry</label>
                <input type="date" value={issueCertForm.expiresAt}
                  onChange={e => setIssueCertForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Note / Award Reason</label>
              <input value={issueCertForm.customNote}
                onChange={e => setIssueCertForm(f => ({ ...f, customNote: e.target.value }))}
                placeholder="e.g. For outstanding service during Ramadan Drive 2026"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dynamic Values JSON (optional)</label>
              <textarea rows={4} value={issueCertForm.dynamicValuesJson}
                onChange={e => setIssueCertForm(f => ({ ...f, dynamicValuesJson: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-500"
                placeholder='{"program_name":"Relief Drive 2026"}' />
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
