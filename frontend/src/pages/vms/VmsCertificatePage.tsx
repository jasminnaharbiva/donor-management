import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

type VmsCertificate = {
  certificate_id: string;
  issue_date?: string;
  expires_at?: string;
  certificate_status: number | boolean;
  image_path?: string;
  source_system?: 'vms' | 'dfb';
  certificate_hash?: string;
  verification_url?: string;
  full_name: string;
  father_name?: string;
  mother_name?: string;
  date_of_birth?: string;
  blood_group?: string;
  mobile_number?: string;
  nid_or_birth_certificate?: string;
  gender?: string;
  division?: string;
  district?: string;
  upazila?: string;
  volunteer_status: number | boolean;
  picture_path?: string;
};

export default function VmsCertificatePage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [searchParams] = useSearchParams();
  const forceNotFound = searchParams.get('notfound') === '1';
  const [data, setData] = useState<VmsCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(forceNotFound);

  useEffect(() => {
    if (!certificateId || forceNotFound) {
      setLoading(false);
      return;
    }

    api.get(`/vms/public/certificate/${encodeURIComponent(certificateId)}`)
      .then((res) => setData(res.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [certificateId, forceNotFound]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border rounded-xl p-8 text-center max-w-lg w-full">
          <h2 className="text-2xl font-bold text-red-600">Certificate Not Found</h2>
          <p className="text-slate-600 mt-2">No volunteer certificate matched this certificate ID.</p>
          <Link to="/vms" className="inline-block mt-4 text-primary-700 hover:text-primary-900">Back to verification</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="bg-green-700 text-white p-6">
          <h1 className="text-2xl font-bold">Volunteer Certificate Verification</h1>
          <p className="text-green-100 text-sm mt-1">Certificate ID: {data.certificate_id}</p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <img
              src={data.picture_path || 'https://placehold.co/300x300?text=Volunteer'}
              alt="volunteer"
              className="w-full aspect-square object-cover rounded-lg border"
            />
            {data.image_path && (
              <img
                src={data.image_path}
                alt="certificate"
                className="w-full mt-3 rounded-lg border"
              />
            )}
          </div>

          <div className="md:col-span-2 space-y-2 text-sm">
            <div><span className="font-semibold">Full Name:</span> {data.full_name}</div>
            <div><span className="font-semibold">Father Name:</span> {data.father_name || '-'}</div>
            <div><span className="font-semibold">Mother Name:</span> {data.mother_name || '-'}</div>
            <div><span className="font-semibold">Date of Birth:</span> {data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString() : '-'}</div>
            <div><span className="font-semibold">Blood Group:</span> {data.blood_group || '-'}</div>
            <div><span className="font-semibold">Mobile:</span> {data.mobile_number || '-'}</div>
            <div><span className="font-semibold">NID/Birth Certificate:</span> {data.nid_or_birth_certificate || '-'}</div>
            <div><span className="font-semibold">Gender:</span> {data.gender || '-'}</div>
            <div><span className="font-semibold">Division:</span> {data.division || '-'}</div>
            <div><span className="font-semibold">District:</span> {data.district || '-'}</div>
            <div><span className="font-semibold">Upazila:</span> {data.upazila || '-'}</div>
            <div><span className="font-semibold">Issue Date:</span> {data.issue_date ? new Date(data.issue_date).toLocaleDateString() : '-'}</div>
            <div><span className="font-semibold">Expiry Date:</span> {data.expires_at ? new Date(data.expires_at).toLocaleDateString() : 'No expiry'}</div>
            <div><span className="font-semibold">Source System:</span> {(data.source_system || 'vms').toUpperCase()}</div>
            <div>
              <span className="font-semibold">Certificate Status:</span>{' '}
              <span className={`${Boolean(data.certificate_status) ? 'text-green-700' : 'text-red-700'} font-semibold`}>
                {Boolean(data.certificate_status) ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <div><span className="font-semibold">Certificate Hash:</span> {data.certificate_hash || '-'}</div>
            <div><span className="font-semibold">Verification URL:</span> {data.verification_url || '-'}</div>
            <div>
              <span className="font-semibold">Volunteer Status:</span>{' '}
              <span className={`${Boolean(data.volunteer_status) ? 'text-green-700' : 'text-red-700'} font-semibold`}>
                {Boolean(data.volunteer_status) ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <Link to="/vms" className="text-primary-700 hover:text-primary-900 text-sm">← Verify another certificate</Link>
        </div>
      </div>
    </div>
  );
}
