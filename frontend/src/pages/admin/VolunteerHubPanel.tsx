import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import VolunteersAdminPanel from './VolunteersAdminPanel';
import VolunteerApplicationsPanel from './VolunteerApplicationsPanel';
import VolunteerRecordsPanel from './VolunteerRecordsPanel';

type HubTab = 'people' | 'applications' | 'records';

const tabLabels: Array<{ key: HubTab; label: string; hint: string }> = [
  { key: 'people', label: 'Volunteer Directory', hint: 'Profile and lifecycle management' },
  { key: 'applications', label: 'Applications', hint: 'Review incoming volunteer applications' },
  { key: 'records', label: 'Records, IDs & Certificates', hint: 'ID cards, certificates, messages and VMS tools' },
];

export default function VolunteerHubPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = String(searchParams.get('tab') || '').toLowerCase();
  const initialTab = requestedTab === 'applications' || requestedTab === 'records' ? (requestedTab as HubTab) : 'people';

  const [tab, setTab] = useState<HubTab>(initialTab);

  useEffect(() => {
    const t = String(searchParams.get('tab') || '').toLowerCase();
    if (t === 'people' || t === 'applications' || t === 'records') {
      setTab(t as HubTab);
      return;
    }
    setSearchParams({ tab: 'people' }, { replace: true });
  }, [searchParams, setSearchParams]);

  const currentHint = useMemo(() => tabLabels.find((item) => item.key === tab)?.hint || '', [tab]);

  const setActiveTab = (nextTab: HubTab) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-6">
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 text-center sm:text-left">Volunteer Hub</h2>
        <p className="text-slate-500 text-sm mt-1">Single management platform for volunteer directory, applications, records, ID cards and certificates</p>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-200 mb-4">
        {tabLabels.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`whitespace-nowrap flex-shrink-0 px-3 py-2.5 sm:px-5 sm:py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === item.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-4 text-xs sm:text-sm text-slate-600">{currentHint}</div>

      {tab === 'people' && <VolunteersAdminPanel />}
      {tab === 'applications' && <VolunteerApplicationsPanel />}
      {tab === 'records' && <VolunteerRecordsPanel />}
    </div>
  );
}