import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';

interface Setting {
  setting_key: string;
  setting_value: string;
  description: string;
}

type VisibilityMenuItem = { key: string; label?: string; enabled?: boolean };
type VisibilityImpactSection = { id: string; title?: string; enabled?: boolean };
type VisibilityUpdateFields = {
  showProjectLocation?: boolean;
  showNarrative?: boolean;
  showDetails?: boolean;
  showPhotos?: boolean;
};

type DonorVisibilityPayload = {
  menuItems: VisibilityMenuItem[];
  impactSections: VisibilityImpactSection[];
  updateFields: VisibilityUpdateFields;
};

type ExpenseWorkflowPayload = {
  volunteerFormFields: {
    showAmountSpent?: boolean;
    amountRequired?: boolean;
    showUpdateTitle?: boolean;
    titleRequired?: boolean;
    showUpdateDetails?: boolean;
    showVendorName?: boolean;
    showVoucher?: boolean;
    voucherRequired?: boolean;
    showCashMemo?: boolean;
    cashMemoRequired?: boolean;
    showPhotos?: boolean;
    photosRequired?: boolean;
    showProgressLogs?: boolean;
    allowEditPending?: boolean;
    allowWithdrawPending?: boolean;
  };
  adminReviewFields: {
    defaultStatusFilter?: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'All';
    showVendorPurpose?: boolean;
    showAmount?: boolean;
    showFund?: boolean;
    showVolunteer?: boolean;
    showEvidence?: boolean;
    showDate?: boolean;
    showStatus?: boolean;
    showProject?: boolean;
    showApproveReject?: boolean;
  };
};

const DEFAULT_DONOR_VISIBILITY: DonorVisibilityPayload = {
  menuItems: [
    { key: 'overview', label: 'Overview', enabled: true },
    { key: 'impact', label: 'My Impact', enabled: true },
    { key: 'history', label: 'Donation History', enabled: true },
    { key: 'subscriptions', label: 'Subscriptions', enabled: true },
    { key: 'p2p', label: 'P2P Fundraiser', enabled: true },
    { key: 'records', label: 'My Records', enabled: true },
    { key: 'notifications', label: 'Notifications', enabled: true },
  ],
  impactSections: [
    { id: 'summary', title: 'Summary Cards', enabled: true },
    { id: 'allocation_breakdown', title: 'Allocation Breakdown', enabled: true },
    { id: 'approved_updates', title: 'Approved Field Updates', enabled: true },
  ],
  updateFields: {
    showProjectLocation: true,
    showNarrative: true,
    showDetails: true,
    showPhotos: true,
  },
};

const DEFAULT_EXPENSE_WORKFLOW: ExpenseWorkflowPayload = {
  volunteerFormFields: {
    showAmountSpent: true,
    amountRequired: true,
    showUpdateTitle: true,
    titleRequired: true,
    showUpdateDetails: true,
    showVendorName: true,
    showVoucher: true,
    voucherRequired: false,
    showCashMemo: true,
    cashMemoRequired: false,
    showPhotos: true,
    photosRequired: false,
    showProgressLogs: true,
    allowEditPending: true,
    allowWithdrawPending: true,
  },
  adminReviewFields: {
    defaultStatusFilter: 'Pending',
    showVendorPurpose: true,
    showAmount: true,
    showFund: true,
    showVolunteer: true,
    showEvidence: true,
    showDate: true,
    showStatus: true,
    showProject: true,
    showApproveReject: true,
  },
};

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<DonorVisibilityPayload>(DEFAULT_DONOR_VISIBILITY);
  const [visibilityLoading, setVisibilityLoading] = useState(true);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [expenseWorkflow, setExpenseWorkflow] = useState<ExpenseWorkflowPayload>(DEFAULT_EXPENSE_WORKFLOW);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [workflowSaving, setWorkflowSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [settingsRes, visibilityRes, workflowRes] = await Promise.all([
        api.get('/admin/settings'),
        api.get('/admin/donor-visibility').catch(() => ({ data: { data: DEFAULT_DONOR_VISIBILITY } })),
        api.get('/admin/expense-workflow-settings').catch(() => ({ data: { data: DEFAULT_EXPENSE_WORKFLOW } })),
      ]);

      const loadedSettings = settingsRes.data.data || [];
      setSettings(loadedSettings);
      setSettingDrafts(
        loadedSettings.reduce((acc: Record<string, string>, row: Setting) => {
          acc[row.setting_key] = row.setting_value ?? '';
          return acc;
        }, {})
      );

      const payload = visibilityRes.data?.data || DEFAULT_DONOR_VISIBILITY;
      setVisibility({
        menuItems: Array.isArray(payload.menuItems) ? payload.menuItems : DEFAULT_DONOR_VISIBILITY.menuItems,
        impactSections: Array.isArray(payload.impactSections) ? payload.impactSections : DEFAULT_DONOR_VISIBILITY.impactSections,
        updateFields: { ...DEFAULT_DONOR_VISIBILITY.updateFields, ...(payload.updateFields || {}) },
      });

      const workflowPayload = workflowRes.data?.data || DEFAULT_EXPENSE_WORKFLOW;
      setExpenseWorkflow({
        volunteerFormFields: {
          ...DEFAULT_EXPENSE_WORKFLOW.volunteerFormFields,
          ...(workflowPayload.volunteerFormFields || {}),
        },
        adminReviewFields: {
          ...DEFAULT_EXPENSE_WORKFLOW.adminReviewFields,
          ...(workflowPayload.adminReviewFields || {}),
        },
      });
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
      setVisibilityLoading(false);
      setWorkflowLoading(false);
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

  const setSettingDraft = (key: string, value: string) => {
    setSettingDrafts(prev => ({ ...prev, [key]: value }));
  };

  const updateMenuItem = (index: number, patch: Partial<VisibilityMenuItem>) => {
    setVisibility(prev => {
      const menuItems = [...prev.menuItems];
      menuItems[index] = { ...menuItems[index], ...patch };
      return { ...prev, menuItems };
    });
  };

  const updateImpactSection = (index: number, patch: Partial<VisibilityImpactSection>) => {
    setVisibility(prev => {
      const impactSections = [...prev.impactSections];
      impactSections[index] = { ...impactSections[index], ...patch };
      return { ...prev, impactSections };
    });
  };

  const saveVisibility = async () => {
    setVisibilitySaving(true);
    try {
      const payload: DonorVisibilityPayload = {
        menuItems: visibility.menuItems
          .map((row) => ({
            key: String(row.key || '').trim(),
            label: String(row.label || '').trim(),
            enabled: row.enabled !== false,
          }))
          .filter((row) => row.key),
        impactSections: visibility.impactSections
          .map((row) => ({
            id: String(row.id || '').trim(),
            title: String(row.title || '').trim(),
            enabled: row.enabled !== false,
          }))
          .filter((row) => row.id),
        updateFields: {
          showProjectLocation: visibility.updateFields.showProjectLocation !== false,
          showNarrative: visibility.updateFields.showNarrative !== false,
          showDetails: visibility.updateFields.showDetails !== false,
          showPhotos: visibility.updateFields.showPhotos !== false,
        },
      };

      await api.put('/admin/donor-visibility', payload);
      setVisibility(payload);
      alert('Donor visibility settings saved.');
    } catch (err) {
      console.error('Failed to save donor visibility settings', err);
      alert('Failed to save donor visibility settings');
    } finally {
      setVisibilitySaving(false);
    }
  };

  const saveExpenseWorkflow = async () => {
    setWorkflowSaving(true);
    try {
      const payload: ExpenseWorkflowPayload = {
        volunteerFormFields: {
          ...DEFAULT_EXPENSE_WORKFLOW.volunteerFormFields,
          ...(expenseWorkflow.volunteerFormFields || {}),
        },
        adminReviewFields: {
          ...DEFAULT_EXPENSE_WORKFLOW.adminReviewFields,
          ...(expenseWorkflow.adminReviewFields || {}),
        },
      };

      await api.put('/admin/expense-workflow-settings', payload);
      setExpenseWorkflow(payload);
      alert('Expense workflow settings saved.');
    } catch (err) {
      console.error('Failed to save expense workflow settings', err);
      alert('Failed to save expense workflow settings');
    } finally {
      setWorkflowSaving(false);
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
                  value={settingDrafts[setting.setting_key] ?? ''}
                  onChange={(e) => setSettingDraft(setting.setting_key, e.target.value)}
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
                  onClick={() => handleUpdate(setting.setting_key, settingDrafts[setting.setting_key] ?? '')}
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

      <div className="glass rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b border-slate-200 pb-4">
          <h2 className="text-sm sm:text-base font-semibold text-slate-800">Expense Workflow Controls</h2>
          <button
            onClick={saveExpenseWorkflow}
            disabled={workflowLoading || workflowSaving}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {workflowSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Workflow
          </button>
        </div>

        {workflowLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary-500" size={28} /></div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Volunteer Expense Form Fields</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showAmountSpent !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showAmountSpent: e.target.checked } }))} /> Show amount</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.amountRequired !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, amountRequired: e.target.checked } }))} /> Amount required</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showUpdateTitle !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showUpdateTitle: e.target.checked } }))} /> Show update title</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.titleRequired !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, titleRequired: e.target.checked } }))} /> Title required</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showUpdateDetails !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showUpdateDetails: e.target.checked } }))} /> Show details</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showVendorName !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showVendorName: e.target.checked } }))} /> Show vendor</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showVoucher !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showVoucher: e.target.checked } }))} /> Show voucher</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.voucherRequired === true} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, voucherRequired: e.target.checked } }))} /> Voucher required</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showCashMemo !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showCashMemo: e.target.checked } }))} /> Show cash memo</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.cashMemoRequired === true} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, cashMemoRequired: e.target.checked } }))} /> Cash memo required</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showPhotos !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showPhotos: e.target.checked } }))} /> Show photos</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.photosRequired === true} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, photosRequired: e.target.checked } }))} /> Photos required</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.allowEditPending !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, allowEditPending: e.target.checked } }))} /> Allow edit pending</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.allowWithdrawPending !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, allowWithdrawPending: e.target.checked } }))} /> Allow withdraw pending</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.volunteerFormFields.showProgressLogs !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, volunteerFormFields: { ...prev.volunteerFormFields, showProgressLogs: e.target.checked } }))} /> Show progress logs</label>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Admin Expense Review Fields</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">Default status
                  <select
                    className="ml-2 border border-slate-300 rounded px-2 py-1 text-xs"
                    value={expenseWorkflow.adminReviewFields.defaultStatusFilter || 'Pending'}
                    onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, defaultStatusFilter: e.target.value as any } }))}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="All">All</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showVendorPurpose !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showVendorPurpose: e.target.checked } }))} /> Show vendor/purpose</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showAmount !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showAmount: e.target.checked } }))} /> Show amount</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showFund !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showFund: e.target.checked } }))} /> Show fund</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showVolunteer !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showVolunteer: e.target.checked } }))} /> Show volunteer</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showProject !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showProject: e.target.checked } }))} /> Show project</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showEvidence !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showEvidence: e.target.checked } }))} /> Show evidence</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showDate !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showDate: e.target.checked } }))} /> Show date</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showStatus !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showStatus: e.target.checked } }))} /> Show status</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={expenseWorkflow.adminReviewFields.showApproveReject !== false} onChange={(e) => setExpenseWorkflow(prev => ({ ...prev, adminReviewFields: { ...prev.adminReviewFields, showApproveReject: e.target.checked } }))} /> Show approve/reject actions</label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b border-slate-200 pb-4">
          <h2 className="text-sm sm:text-base font-semibold text-slate-800">Donor Visibility Controls</h2>
          <button
            onClick={saveVisibility}
            disabled={visibilityLoading || visibilitySaving}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {visibilitySaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Visibility
          </button>
        </div>

        {visibilityLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary-500" size={28} /></div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Donor Dashboard Menu Items</h3>
                <button
                  onClick={() => setVisibility(prev => ({ ...prev, menuItems: [...prev.menuItems, { key: '', label: '', enabled: true }] }))}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100"
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>
              <div className="space-y-2">
                {visibility.menuItems.map((item, index) => (
                  <div key={`menu-item-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                    <input
                      value={item.key || ''}
                      onChange={(e) => updateMenuItem(index, { key: e.target.value })}
                      placeholder="menu key"
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <input
                      value={item.label || ''}
                      onChange={(e) => updateMenuItem(index, { label: e.target.value })}
                      placeholder="label"
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.enabled !== false}
                        onChange={(e) => updateMenuItem(index, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                    <button
                      onClick={() => setVisibility(prev => ({ ...prev, menuItems: prev.menuItems.filter((_, i) => i !== index) }))}
                      className="inline-flex items-center justify-center px-2 py-2 rounded border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                      title="Delete item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Impact Page Sections</h3>
                <button
                  onClick={() => setVisibility(prev => ({ ...prev, impactSections: [...prev.impactSections, { id: '', title: '', enabled: true }] }))}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100"
                >
                  <Plus size={12} /> Add Section
                </button>
              </div>
              <div className="space-y-2">
                {visibility.impactSections.map((item, index) => (
                  <div key={`impact-section-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                    <input
                      value={item.id || ''}
                      onChange={(e) => updateImpactSection(index, { id: e.target.value })}
                      placeholder="section id"
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <input
                      value={item.title || ''}
                      onChange={(e) => updateImpactSection(index, { title: e.target.value })}
                      placeholder="title"
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.enabled !== false}
                        onChange={(e) => updateImpactSection(index, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                    <button
                      onClick={() => setVisibility(prev => ({ ...prev, impactSections: prev.impactSections.filter((_, i) => i !== index) }))}
                      className="inline-flex items-center justify-center px-2 py-2 rounded border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                      title="Delete section"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Approved Update Fields</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={visibility.updateFields.showProjectLocation !== false} onChange={(e) => setVisibility(prev => ({ ...prev, updateFields: { ...prev.updateFields, showProjectLocation: e.target.checked } }))} /> Show project location</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={visibility.updateFields.showNarrative !== false} onChange={(e) => setVisibility(prev => ({ ...prev, updateFields: { ...prev.updateFields, showNarrative: e.target.checked } }))} /> Show narrative</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={visibility.updateFields.showDetails !== false} onChange={(e) => setVisibility(prev => ({ ...prev, updateFields: { ...prev.updateFields, showDetails: e.target.checked } }))} /> Show detailed notes</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={visibility.updateFields.showPhotos !== false} onChange={(e) => setVisibility(prev => ({ ...prev, updateFields: { ...prev.updateFields, showPhotos: e.target.checked } }))} /> Show photos</label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
