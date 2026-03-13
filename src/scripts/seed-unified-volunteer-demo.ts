import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

function hashCertificate(certificateId: string, volunteerRef: string | number, issueDate: Date): string {
  return createHash('sha256').update(`${certificateId}|${volunteerRef}|${issueDate.toISOString()}`).digest('hex');
}

async function seedVmsDemoData() {
  const hasVmsVolunteers = await db.schema.hasTable('vms_volunteers');
  const hasVmsCertificates = await db.schema.hasTable('vms_certificates');
  if (!hasVmsVolunteers || !hasVmsCertificates) return { vmsVolunteers: 0, vmsCertificates: 0 };

  const demoVolunteers = [
    {
      full_name: 'Demo Volunteer Ayesha Rahman',
      father_name: 'Mofizur Rahman',
      mother_name: 'Sultana Begum',
      blood_group: 'A+',
      mobile_number: '01700000001',
      gender: 'Female',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Dhanmondi',
      skills_json: JSON.stringify(['first-aid', 'community-outreach']),
      availability_notes: 'Weekend afternoons available',
      hours_completed: 48,
      status: 1,
    },
    {
      full_name: 'Demo Volunteer Hasan Karim',
      father_name: 'Abdul Karim',
      mother_name: 'Rokeya Khatun',
      blood_group: 'O+',
      mobile_number: '01700000002',
      gender: 'Male',
      division: 'Chattogram',
      district: 'Chattogram',
      upazila: 'Panchlaish',
      skills_json: JSON.stringify(['logistics', 'event-support']),
      availability_notes: 'Available weekdays after 6PM',
      hours_completed: 71,
      status: 1,
    },
    {
      full_name: 'Demo Volunteer Nabila Islam',
      father_name: 'Rafiqul Islam',
      mother_name: 'Nasima Akter',
      blood_group: 'B+',
      mobile_number: '01700000003',
      gender: 'Female',
      division: 'Rajshahi',
      district: 'Rajshahi',
      upazila: 'Boalia',
      skills_json: JSON.stringify(['data-entry', 'field-survey']),
      availability_notes: 'Flexible schedule',
      hours_completed: 32,
      status: 1,
    },
  ];

  let createdVolunteers = 0;
  let createdCertificates = 0;

  for (const volunteer of demoVolunteers) {
    let row = await db('vms_volunteers').where({ mobile_number: volunteer.mobile_number }).first('id', 'full_name');
    if (!row) {
      const [id] = await db('vms_volunteers').insert({
        ...volunteer,
        created_at: new Date(),
        updated_at: new Date(),
      });
      createdVolunteers += 1;
      row = { id, full_name: volunteer.full_name } as any;
    }

    const existingCert = await db('vms_certificates').where({ volunteer_id: row.id }).first('id');
    if (!existingCert) {
      const issueDate = new Date();
      const certificateId = `VMS-DEMO-${row.id}-${Date.now().toString().slice(-5)}`;
      await db('vms_certificates').insert({
        volunteer_id: row.id,
        certificate_id: certificateId,
        issue_date: issueDate,
        expires_at: new Date(issueDate.getFullYear() + 1, issueDate.getMonth(), issueDate.getDate()),
        status: 1,
        verification_url: `/vms/certificate/${encodeURIComponent(certificateId)}`,
        certificate_hash: hashCertificate(certificateId, row.id, issueDate),
        created_at: new Date(),
        updated_at: new Date(),
      });
      createdCertificates += 1;
    }
  }

  return { vmsVolunteers: createdVolunteers, vmsCertificates: createdCertificates };
}

async function seedDfbDemoData() {
  const hasVolunteers = await db.schema.hasTable('dfb_volunteers');
  const hasTemplates = await db.schema.hasTable('dfb_certificate_templates');
  const hasAwards = await db.schema.hasTable('dfb_certificate_awards');
  if (!hasVolunteers || !hasTemplates || !hasAwards) return { dfbCertificates: 0 };

  let template = await db('dfb_certificate_templates').where({ template_name: 'Unified Demo Certificate Template' }).first('cert_template_id');
  if (!template) {
    const firstAdmin = await db('dfb_users').orderBy('created_at', 'asc').first('user_id');
    const [certTemplateId] = await db('dfb_certificate_templates').insert({
      template_name: 'Unified Demo Certificate Template',
      title_text: 'Certificate of Service Excellence',
      body_template: '<div style="text-align:center"><h2>{{title_text}}</h2><p>{{volunteer_name}}</p><p>{{issue_date}}</p><p>{{verification_code}}</p></div>',
      primary_color: '#0f766e',
      is_active: 1,
      created_by: firstAdmin?.user_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    template = { cert_template_id: certTemplateId } as any;
  }

  const volunteers = await db('dfb_volunteers').orderBy('volunteer_id', 'asc').limit(3).select('volunteer_id');
  if (!volunteers.length) return { dfbCertificates: 0 };

  const firstIssuer = await db('dfb_users').orderBy('created_at', 'asc').first('user_id');
  let created = 0;

  for (const v of volunteers) {
    const existing = await db('dfb_certificate_awards').where({ volunteer_id: v.volunteer_id }).first('award_id');
    if (existing) continue;

    const issueDate = new Date();
    const verificationCode = `DFB-DEMO-${String(v.volunteer_id).padStart(4, '0')}`;
    await db('dfb_certificate_awards').insert({
      award_id: uuidv4(),
      cert_template_id: template.cert_template_id,
      volunteer_id: v.volunteer_id,
      custom_note: 'Demo seeded certificate for unified volunteer system testing',
      hours_served: 20,
      issue_date: issueDate,
      expires_at: new Date(issueDate.getFullYear() + 1, issueDate.getMonth(), issueDate.getDate()),
      verification_code: verificationCode,
      verification_url: `/vms/certificate/${encodeURIComponent(verificationCode)}`,
      certificate_hash: hashCertificate(verificationCode, v.volunteer_id, issueDate),
      issued_by: firstIssuer?.user_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    created += 1;
  }

  return { dfbCertificates: created };
}

async function main() {
  try {
    const vmsResult = await seedVmsDemoData();
    const dfbResult = await seedDfbDemoData();

    console.log('✅ Unified volunteer demo seed complete');
    console.log({
      ...vmsResult,
      ...dfbResult,
    });
  } catch (error) {
    console.error('❌ Unified volunteer demo seed failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();
