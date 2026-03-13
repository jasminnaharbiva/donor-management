import { db } from '../config/database';
import { logger } from '../utils/logger';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

export async function generateBadgeNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // Find highest badge number for the year to increment
  const lastVolunteer = await db('dfb_volunteers')
    .where('badge_number', 'like', `VLN-${year}-%`)
    .orderBy('badge_number', 'desc')
    .first('badge_number');

  let seq = 1;
  if (lastVolunteer && lastVolunteer.badge_number) {
    const parts = lastVolunteer.badge_number.split('-');
    seq = parseInt(parts[2], 10) + 1;
  }
  
  return `VLN-${year}-${String(seq).padStart(5, '0')}`;
}

export async function approveVolunteerApplication(applicationId: number, adminUserId: string, reqIp: string): Promise<number | null> {
  const application = await db('dfb_volunteer_applications').where({ application_id: applicationId }).first();
  if (!application) throw new Error('Application not found');
  if (application.status !== 'pending' && application.status !== 'under_review') {
    throw new Error('Application must be pending or under review to approve');
  }

  let newVolunteerId: number | null = null;

  await db.transaction(async (trx) => {
    // 1. Mark Application as Approved
    await trx('dfb_volunteer_applications').where({ application_id: applicationId }).update({
      status: 'approved',
      reviewed_by: adminUserId,
      reviewed_at: new Date(),
      updated_at: new Date()
    });

    // 2. See if the user already exists by Email
    let user = await trx('dfb_users').where({ email: application.applicant_email }).first();
    let userId = user?.user_id;

    // 3. Create User if none
    if (!user) {
      userId = uuidv4();
      
      const volunteerRole = await trx('dfb_roles').where({ role_name: 'Volunteer' }).first('role_id');
      const tempPasswordHash = await bcrypt.hash(uuidv4(), 12); // Temporary random password
      
      await trx('dfb_users').insert({
        user_id: userId,
        email: application.applicant_email,
        password_hash: tempPasswordHash,
        role_id: volunteerRole?.role_id,
        status: 'active',
        created_at: new Date()
      });
    }

    // 4. Generate Badge Number
    const badgeNumber = await generateBadgeNumber();

    // 5. Create Volunteer Record
    const [insertedVolunteerId] = await trx('dfb_volunteers').insert({
      user_id: userId,
      first_name: application.applicant_name?.split(' ')[0] || '',
      last_name: application.applicant_name?.split(' ').slice(1).join(' ') || '',
      father_name: application.father_name,
      date_of_birth: application.date_of_birth,
      blood_group: application.blood_group,
      education_level: application.education_level,
      phone: application.phone,
      mobile_number: application.mobile_number,
      national_id_hash: application.national_id_hash,
      nid_or_birth_certificate_no: application.nid_or_birth_certificate_no,
      address: application.address,
      full_address: application.full_address,
      division: application.division,
      district: application.district,
      upazila: application.upazila,
      city: application.city,
      country: application.country,
      passport_photo_url: application.passport_photo_url,
      profile_photo_url: application.passport_photo_url, // Use passport photo as profile photo
      id_document_url: application.identity_document_url,
      motivation_statement: application.motivation_statement,
      skills: application.skills,
      availability: application.availability,
      reference_name: application.reference_name,
      reference_phone: application.reference_phone,
      emergency_contact_name: application.emergency_contact_name,
      emergency_contact_phone: application.emergency_contact_phone,
      document_urls: application.document_urls,
      background_check_status: 'cleared', // simplified for now
      badge_number: badgeNumber,
      status: 'active',
      approved_by: adminUserId,
      approved_at: new Date(),
      created_at: new Date()
    });
    
    newVolunteerId = insertedVolunteerId;

    // 6. Link volunteer ID back to User Record if it didn't have one
    await trx('dfb_users').where({ user_id: userId }).update({ volunteer_id: newVolunteerId });

    // 7. Store the created User ID on the application for reference
    await trx('dfb_volunteer_applications').where({ application_id: applicationId }).update({
      user_id_created: userId
    });

  });

  if (newVolunteerId) {
    await writeAuditLog({
      tableAffected: 'dfb_volunteers',
      recordId: String(newVolunteerId),
      actionType: 'APPROVE',
      newPayload: { applicationId },
      actorId: adminUserId,
      ipAddress: reqIp
    });
  }

  return newVolunteerId;
}
