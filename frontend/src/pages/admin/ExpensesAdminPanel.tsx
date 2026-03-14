import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, BarChart3, CheckCircle, XCircle, Search, Download, RefreshCw, Plus, X } from 'lucide-react';

interface Expense {
  expense_id: string;
  vendor_name: string;
  purpose: string;
  amount_spent: number;
  fund_name: string;
  volunteer_name: string;
  status: string;
  spent_timestamp: string;
  approved_at: string;
  receipt_url: string;
  project_name?: string;
  proof_of_execution_urls?: any;
}

interface Fund {
  fund_id: number;
  fund_name: string;
}

interface Project {
  project_id: number;
  project_name: string;
  fund_id: number;
}

type ExpenseWorkflowConfig = {
  defaultStatusFilter?: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'All';
  showVendorPurpose?: boolean;
  showAmount?: boolean;
  showFund?: boolean;
  showVolunteer?: boolean;
  showProject?: boolean;
  showEvidence?: boolean;
  showDate?: boolean;
  showStatus?: boolean;
  showApproveReject?: boolean;
};

const DEFAULT_WORKFLOW: ExpenseWorkflowConfig = {
  defaultStatusFilter: 'Pending',
  showVendorPurpose: true,
  showAmount: true,
  showFund: true,
  showVolunteer: true,
  showProject: true,
  showEvidence: true,
  showDate: true,
  showStatus: true,
  showApproveReject: true,
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-slate-100 text-slate-700',
};

function parseEvidence(raw: unknown): { updateTitle: string | null; updateDetails: string | null; voucherUrl: string | null; cashMemoUrl: string | null; photos: string[] } {
  if (!raw) return { updateTitle: null, updateDetails: null, voucherUrl: null, cashMemoUrl: null, photos: [] };

  let parsed: any = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') return { updateTitle: null, updateDetails: null, voucherUrl: null, cashMemoUrl: null, photos: [] };

  const photos = Array.isArray(parsed.photos)
    ? parsed.photos.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    updateTitle: parsed.update_title ? String(parsed.update_title) : null,
    updateDetails: parsed.update_details ? String(parsed.update_details) : null,
    voucherUrl: parsed.voucher_url ? String(parsed.voucher_url) : null,
    cashMemoUrl: parsed.cash_memo_url ? String(parsed.cash_memo_url) : null,
    photos,
  };
}

export default function ExpensesAdminPanel() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'All'>('Pending');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 });
  const [workflow, setWorkflow] = useState<ExpenseWorkflowConfig>(DEFAULT_WORKFLOW);
  
  // Create expense form state
  const [showForm, setShowForm] = useState(false);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    vendorName: '',
    purpose: '',
    amountSpent: '',
    fundId: '',
    projectId: '',
    receiptUrl: '',
  });

  useEffect(() => {
    api.get('/admin/expense-workflow-settings')
      .then((res) => {
        const incoming = res.data?.data?.adminReviewFields || {};
        const merged = { ...DEFAULT_WORKFLOW, ...incoming };
        setWorkflow(merged);
        setStatusFilter((merged.defaultStatusFilter as any) || 'Pending');
      })
      .catch(() => setWorkflow(DEFAULT_WORKFLOW));
  }, []);

  const load = async (s = statusFilter) => {
    setLoading(true);
    try {
      const queryStatus = s === 'All' ? '' : `status=${s}&`;
      const res = await api.get(`/expenses?${queryStatus}includeCounts=true&limit=50`);
      setExpenses(res.data.data || []);
      setStatusCounts(res.data?.meta?.statusCounts || { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 });
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const approve = async (id: string) => {
    setActingOn(id);
    try {
      await api.post(`/expenses/${id}/approve`);
      await load();
    } catch (e: any) { alert(e.response?.data?.message || 'Approve failed'); }
    setActingOn(null);
  };

  const reject = async (id: string) => {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    setActingOn(id);
    try {
      await api.post(`/expenses/${id}/reject`, { reason });
      await load();
    } catch { alert('Reject failed'); }
    setActingOn(null);
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/reports/expenses?format=csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `expenses_${Date.now()}.csv`; a.click();
    } catch { alert('Export failed'); }
  };

  const openCreateForm = async () => {
    setFormLoading(true);
    try {
      const [fRes, pRes] = await Promise.all([
        api.get('/funds'),
        api.get('/projects'),
      ]);
      setFunds(fRes.data.data || []);
      setProjects(pRes.data.data || []);
    } catch (e) {
      alert('Failed to load funds/projects');
    }
    setFormLoading(false);
    setShowForm(true);
  };

  const closeCreateForm = () => {
    setShowForm(false);
    setExpenseForm({ vendorName: '', purpose: '', amountSpent: '', fundId: '', projectId: '', receiptUrl: '' });
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.fundId || !expenseForm.vendorName || !expenseForm.amountSpent) {
      alert('Please fill in required fields');
      return;
    }
    try {
      await api.post('/expenses', {
        vendorName: expenseForm.vendorName,
        purpose: expenseForm.purpose,
        amountSpent: Number(expenseForm.amountSpent),
        fundId: Number(expenseForm.fundId),
        projectId: expenseForm.projectId ? Number(expenseForm.projectId) : undefined,
        receiptUrl: expenseForm.receiptUrl || undefined,
      });
      await load();
      closeCreateForm();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create expense');
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';

  const filtered = expenses.filter(e =>
    `${e.vendor_name} ${e.purpose} ${e.fund_name} ${e.volunteer_name}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center justify-center sm:justify-start gap-2"><BarChart3 className="text-primary-500" /> Expense Approval</h2>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button onClick={openCreateForm} className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg">
            <Plus size={14} /> New Expense
          </button>
          <button onClick={() => load()} className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {['Pending', 'Approved', 'Rejected', 'Cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`text-left rounded-lg border px-3 py-2 ${statusFilter === status ? 'border-primary-300 bg-primary-50' : 'border-slate-200 bg-white'}`}
            >
              <p className="text-xs text-slate-500">{status}</p>
              <p className="text-base font-semibold text-slate-800">{statusCounts[status] || 0}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
            <option value="All">All</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {workflow.showVendorPurpose !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Vendor / Purpose</th>}
                {workflow.showAmount !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Amount</th>}
                {workflow.showFund !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Fund</th>}
                {workflow.showVolunteer !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Volunteer</th>}
                {workflow.showProject !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Project</th>}
                {workflow.showEvidence !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Evidence</th>}
                {workflow.showDate !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Date</th>}
                {workflow.showStatus !== false && <th className="text-left py-3 px-3 font-semibold text-slate-600">Status</th>}
                {workflow.showApproveReject !== false && <th className="py-3 px-3 font-semibold text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(e => {
                const evidence = parseEvidence(e.proof_of_execution_urls);
                return (
                <tr key={e.expense_id} className="hover:bg-slate-50 align-top">
                  {workflow.showVendorPurpose !== false && <td className="py-3 px-3">
                    <div className="font-medium text-slate-800">{evidence.updateTitle || e.vendor_name || 'Expense Update'}</div>
                    <div className="text-xs text-slate-400 truncate max-w-48">{e.purpose}</div>
                    {(evidence.voucherUrl || e.receipt_url) && (
                      <a href={evidence.voucherUrl || e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">View Receipt</a>
                    )}
                  </td>}
                  {workflow.showAmount !== false && <td className="py-3 px-3 font-bold text-slate-800">{fmt(e.amount_spent)}</td>}
                  {workflow.showFund !== false && <td className="py-3 px-3 text-slate-600 text-xs">{e.fund_name}</td>}
                  {workflow.showVolunteer !== false && <td className="py-3 px-3 text-slate-600 text-sm">{e.volunteer_name || '—'}</td>}
                  {workflow.showProject !== false && <td className="py-3 px-3 text-slate-600 text-sm">{e.project_name || '—'}</td>}
                  {workflow.showEvidence !== false && <td className="py-3 px-3 text-xs text-slate-600 space-y-1 min-w-[180px]">
                    {(evidence.voucherUrl || e.receipt_url) && (
                      <div><a href={evidence.voucherUrl || e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Voucher</a></div>
                    )}
                    {evidence.cashMemoUrl && (
                      <div><a href={evidence.cashMemoUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Cash Memo</a></div>
                    )}
                    {evidence.photos.length > 0 && (
                      <div className="text-slate-500">Photos: {evidence.photos.slice(0, 3).map((url, idx) => (
                        <span key={`${e.expense_id}-photo-${idx}`}>{idx > 0 ? ' · ' : ''}<a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">#{idx + 1}</a></span>
                      ))}</div>
                    )}
                    {!((evidence.voucherUrl || e.receipt_url) || evidence.cashMemoUrl || evidence.photos.length) && <span className="text-slate-400">—</span>}
                  </td>}
                  {workflow.showDate !== false && <td className="py-3 px-3 text-slate-500 text-xs">{fmtDate(e.spent_timestamp)}</td>}
                  {workflow.showStatus !== false && <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[e.status] || 'bg-slate-100 text-slate-700'}`}>{e.status}</span>
                  </td>}
                  {workflow.showApproveReject !== false && (
                    <td className="py-3 px-3">
                      <div className="flex gap-2">
                        <button onClick={() => approve(e.expense_id)} disabled={actingOn === e.expense_id || e.status !== 'Pending'}
                          className="flex items-center gap-1 text-green-700 hover:text-green-800 text-xs px-2 py-1 border border-green-200 rounded bg-green-50 disabled:opacity-40"
                          title={e.status === 'Pending' ? 'Approve expense' : 'Only pending expenses can be approved'}>
                          {actingOn === e.expense_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Approve
                        </button>
                        <button onClick={() => reject(e.expense_id)} disabled={actingOn === e.expense_id || e.status !== 'Pending'}
                          className="flex items-center gap-1 text-red-700 hover:text-red-800 text-xs px-2 py-1 border border-red-200 rounded bg-red-50 disabled:opacity-40"
                          title={e.status === 'Pending' ? 'Reject expense' : 'Only pending expenses can be rejected'}>
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );})}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">No expenses found for "{statusFilter}" status</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">New Expense</h3>
              <button onClick={closeCreateForm} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <input required placeholder="Vendor Name" value={expenseForm.vendorName}
                onChange={e => setExpenseForm(f => ({...f, vendorName: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              
              <textarea placeholder="Purpose / Description" value={expenseForm.purpose}
                onChange={e => setExpenseForm(f => ({...f, purpose: e.target.value}))}
                rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
              
              <input type="number" required step="0.01" placeholder="Amount Spent ($)" value={expenseForm.amountSpent}
                onChange={e => setExpenseForm(f => ({...f, amountSpent: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />

              <select required value={expenseForm.fundId}
                onChange={e => setExpenseForm(f => ({...f, fundId: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Fund</option>
                {funds.map(f => <option key={f.fund_id} value={f.fund_id}>{f.fund_name}</option>)}
              </select>

              <select value={expenseForm.projectId}
                onChange={e => setExpenseForm(f => ({...f, projectId: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Project (Optional)</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
              </select>

              <input type="url" placeholder="Receipt URL (Optional)" value={expenseForm.receiptUrl}
                onChange={e => setExpenseForm(f => ({...f, receiptUrl: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={closeCreateForm} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                  {formLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
