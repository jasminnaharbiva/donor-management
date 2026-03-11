-- =============================================================================
-- DFB Donor Management — Comprehensive Demo Data (corrected column names)
-- Run: mysql -u root -pDonorMgmt_2026 donor_management < database/demo_data.sql
-- =============================================================================

SET @admin_id = '83000afd-dab0-447d-8565-8b06bb72f321';
SET @volunteer_user_id = '00000000-0000-0000-0000-000000000002';

-- =============================================================================
-- 1. Additional Donors
-- Actual columns: donor_id, first_name, last_name, email (varbinary), email_hash,
--   phone, national_id_hash, lifetime_value, last_donation_date,
--   donor_type ENUM('Individual','Corporate','Anonymous'),
--   wealth_screening_consent, engagement_score
-- NO: city, country, total_donated, donation_count, status
-- =============================================================================
INSERT IGNORE INTO dfb_donors (donor_id, first_name, last_name, email, email_hash, donor_type, lifetime_value, engagement_score, wealth_screening_consent)
VALUES
(2, 'Fatima', 'Rahman',
 AES_ENCRYPT('fatima.rahman@example.com', UNHEX(SHA2('dfb_aes_key_2026',256))),
 SHA2('fatima.rahman@example.com',256), 'Individual', 25000.00, 65, 0),
(3, 'Mohammed', 'Ali',
 AES_ENCRYPT('mohammed.ali@example.com', UNHEX(SHA2('dfb_aes_key_2026',256))),
 SHA2('mohammed.ali@example.com',256), 'Individual', 50000.00, 80, 1),
(4, 'Aisha', 'Begum',
 AES_ENCRYPT('aisha.begum@example.com', UNHEX(SHA2('dfb_aes_key_2026',256))),
 SHA2('aisha.begum@example.com',256), 'Individual', 10000.00, 45, 0),
(5, 'Ibrahim', 'Khan',
 AES_ENCRYPT('ibrahim.khan@example.com', UNHEX(SHA2('dfb_aes_key_2026',256))),
 SHA2('ibrahim.khan@example.com',256), 'Individual', 75000.00, 90, 1),
(6, 'Zainab', 'Hassan',
 AES_ENCRYPT('zainab.hassan@example.com', UNHEX(SHA2('dfb_aes_key_2026',256))),
 SHA2('zainab.hassan@example.com',256), 'Individual', 120000.00, 95, 1),
(7, 'Abdullah', 'Siddiqui',
 AES_ENCRYPT('abdullah.siddiqui@example.com', UNHEX(SHA2('dfb_aes_key_2026',256))),
 SHA2('abdullah.siddiqui@example.com',256), 'Corporate', 200000.00, 98, 1),
(8, 'Maryam', 'Chowdhury',
 AES_ENCRYPT('maryam.chowdhury@example.com', UNHEX(SHA2('dfb_aes_key_2026',256))),
 SHA2('maryam.chowdhury@example.com',256), 'Individual', 8500.00, 55, 0);

-- =============================================================================
-- 2. Campaigns
-- =============================================================================
INSERT IGNORE INTO dfb_campaigns (campaign_id, fund_id, title, slug, description, cover_image_url, goal_amount, raised_amount, donor_count, start_date, end_date, status, is_public, allow_anonymous, default_amounts, created_by)
VALUES
(1, 4, 'Ramadan Emergency Relief 2026', 'ramadan-emergency-relief-2026',
 'Providing essential food packages, iftar boxes and emergency shelter support to 500 families across Bangladesh during Ramadan.',
 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800',
 500000.00, 187500.00, 42, '2026-02-01', '2026-04-10', 'active', 1, 1, '[500,1000,2500,5000]', @admin_id),
(2, 2, 'Zakat Collection Drive 2026', 'zakat-collection-2026',
 'Annual Zakat collection campaign to distribute to eligible recipients across Bangladesh.',
 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
 1000000.00, 345000.00, 85, '2026-01-01', '2026-12-31', 'active', 1, 0, '[2500,5000,10000,25000]', @admin_id),
(3, 1, 'Winter Clothing Drive', 'winter-clothing-drive-2025',
 'Distributing warm clothing to underprivileged families in northern Bangladesh.',
 'https://images.unsplash.com/photo-1559181567-c3190bded457?w=800',
 150000.00, 150000.00, 30, '2025-11-01', '2026-01-31', 'completed', 1, 1, '[1000,2000,5000]', @admin_id),
(4, 3, 'Sadaqah Jariyah — Masjid Build', 'sadaqah-masjid-build-2026',
 'Build a masjid in a remote village with no place of worship. Sadaqah Jariyah — ongoing rewards.',
 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800',
 750000.00, 95000.00, 18, '2026-02-15', '2026-12-31', 'active', 1, 1, '[5000,10000,25000,50000]', @admin_id),
(5, 1, 'Orphan Sponsorship Program', 'orphan-sponsorship-2026',
 'Sponsor an orphan child for education, nutrition and healthcare throughout the year.',
 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
 300000.00, 22500.00, 9, '2026-03-01', '2026-12-31', 'active', 1, 0, '[2500,5000,12500,25000]', @admin_id);

-- =============================================================================
-- 3. Transactions (Donations)
-- =============================================================================
INSERT INTO dfb_transactions (transaction_id, donor_id, amount, currency, payment_method, net_amount, status, settled_at, created_at)
VALUES
(UUID(), 1, 5000.00, 'BDT', 'bkash', 4950.00, 'Completed', '2026-02-10 10:00:00', '2026-02-10 09:55:00'),
(UUID(), 2, 10000.00, 'BDT', 'card', 9800.00, 'Completed', '2026-02-12 11:00:00', '2026-02-12 10:55:00'),
(UUID(), 3, 25000.00, 'BDT', 'bank_transfer', 25000.00, 'Completed', '2026-02-14 09:00:00', '2026-02-14 08:50:00'),
(UUID(), 4, 2500.00, 'BDT', 'nagad', 2475.00, 'Completed', '2026-02-15 14:00:00', '2026-02-15 13:55:00'),
(UUID(), 5, 50000.00, 'BDT', 'bank_transfer', 50000.00, 'Completed', '2026-02-16 10:00:00', '2026-02-16 09:45:00'),
(UUID(), 6, 100000.00, 'GBP', 'bank_transfer', 100000.00, 'Completed', '2026-02-18 14:00:00', '2026-02-18 13:55:00'),
(UUID(), 7, 200000.00, 'BDT', 'bank_transfer', 200000.00, 'Completed', '2026-02-20 09:00:00', '2026-02-20 08:45:00'),
(UUID(), 1, 1000.00, 'BDT', 'bkash', 990.00, 'Completed', '2026-03-01 10:00:00', '2026-03-01 09:55:00'),
(UUID(), 2, 5000.00, 'BDT', 'card', 4900.00, 'Completed', '2026-03-05 11:00:00', '2026-03-05 10:55:00'),
(UUID(), 8, 8500.00, 'BDT', 'rocket', 8415.00, 'Completed', '2026-03-08 15:00:00', '2026-03-08 14:55:00'),
(UUID(), 3, 15000.00, 'BDT', 'sslcommerz', 14700.00, 'Pending', NULL, '2026-03-10 09:00:00'),
(UUID(), 5, 5000.00, 'BDT', 'bkash', 4950.00, 'Failed', NULL, '2026-03-10 12:00:00');

-- =============================================================================
-- 4. Additional Volunteers
-- =============================================================================
INSERT IGNORE INTO dfb_volunteers (volunteer_id, user_id, first_name, last_name, city, country, background_check_status, badge_number, spending_limit_default, status, approved_by, approved_at)
VALUES
(1, @volunteer_user_id, 'Demo', 'Volunteer', 'Dhaka', 'Bangladesh', 'cleared', 'VOL-0001', 10000.00, 'active', @admin_id, '2026-01-15 10:00:00'),
(2, NULL, 'Karim', 'Ahmed', 'Chittagong', 'Bangladesh', 'cleared', 'VOL-0002', 5000.00, 'active', @admin_id, '2026-01-20 10:00:00'),
(3, NULL, 'Nasrin', 'Akter', 'Sylhet', 'Bangladesh', 'pending', 'VOL-0003', 3000.00, 'active', @admin_id, '2026-02-01 10:00:00'),
(4, NULL, 'Rafiq', 'Islam', 'Dhaka', 'Bangladesh', 'cleared', 'VOL-0004', 8000.00, 'active', @admin_id, '2026-02-10 10:00:00'),
(5, NULL, 'Salma', 'Khatun', 'Rajshahi', 'Bangladesh', 'not_submitted', 'VOL-0005', 2000.00, 'pending_approval', NULL, NULL);

-- =============================================================================
-- 5. Volunteer Applications
-- =============================================================================
INSERT IGNORE INTO dfb_volunteer_applications (application_id, applicant_name, applicant_email, city, country, motivation_statement, skills, availability, status, review_notes, reviewed_by, reviewed_at, submitted_at)
VALUES
(1, 'Tanvir Hossain', 'tanvir.hossain@example.com', 'Dhaka', 'Bangladesh',
 'I am passionate about helping underprivileged communities and have 3 years of NGO experience.',
 '["First Aid","Event Management","Fundraising"]', '{"weekdays":true,"weekends":true}',
 'pending', NULL, NULL, NULL, '2026-03-01 10:00:00'),
(2, 'Riya Sharma', 'riya.sharma@example.com', 'Dhaka', 'Bangladesh',
 'Social work graduate with experience in community outreach and women empowerment programs.',
 '["Social Work","Community Outreach","Data Entry"]', '{"weekdays":false,"weekends":true}',
 'under_review', 'Strong candidate — verifying references', @admin_id, '2026-03-05 14:00:00', '2026-02-25 09:00:00'),
(3, 'Omar Faruq', 'omar.faruq@example.com', 'Chittagong', 'Bangladesh',
 'Medical student eager to provide health screening and basic medical support during relief camps.',
 '["Medical","First Aid","Community Health"]', '{"weekdays":false,"weekends":true,"holidays":true}',
 'approved', 'Approved — medical skills highly needed', @admin_id, '2026-03-02 11:00:00', '2026-02-20 08:00:00'),
(4, 'Sadia Islam', 'sadia.islam@example.com', 'Sylhet', 'Bangladesh',
 'IT professional who wants to contribute technical skills to help the organization grow.',
 '["IT Support","Web Design","Data Analysis"]', '{"weekdays":true,"weekends":false}',
 'waitlisted', 'Good profile but IT volunteers quota full for now', @admin_id, '2026-03-06 10:00:00', '2026-02-28 15:00:00'),
(5, 'Jakir Hosen', 'jakir.hosen@example.com', 'Rajshahi', 'Bangladesh',
 'Retired teacher with 25 years of experience. Want to contribute through teaching and mentoring.',
 '["Teaching","Mentoring","Communication"]', '{"weekdays":true,"weekends":true}',
 'rejected', 'Location too remote for current programs', @admin_id, '2026-03-07 09:00:00', '2026-03-01 11:00:00');

-- =============================================================================
-- 6. Projects
-- =============================================================================
INSERT IGNORE INTO dfb_projects (project_id, campaign_id, fund_id, project_name, description, budget_allocated, budget_spent, location_country, location_city, start_date, target_completion_date, status, created_by)
VALUES
(1, 1, 4, 'Ramadan Food Package Distribution — Dhaka',
 'Distributing 2,500-calorie daily food packages to 200 families in Dhaka slum areas during Ramadan.',
 120000.00, 45000.00, 'Bangladesh', 'Dhaka', '2026-03-01', '2026-04-10', 'active', @admin_id),
(2, 1, 4, 'Iftar Box Program — Chittagong',
 'Organizing community iftar events and distributing 300 iftar boxes daily at local masjids.',
 80000.00, 20000.00, 'Bangladesh', 'Chittagong', '2026-03-01', '2026-04-10', 'active', @admin_id),
(3, 2, 2, 'Zakat Distribution — Winter 2026',
 'Identified 300 eligible Zakat recipients across 5 districts for direct cash distribution.',
 200000.00, 150000.00, 'Bangladesh', 'Multiple', '2026-01-15', '2026-02-28', 'completed', @admin_id),
(4, 4, 3, 'Masjid Foundation Construction',
 'Laying the foundation and first floor of the new masjid in Noakhali village.',
 300000.00, 75000.00, 'Bangladesh', 'Noakhali', '2026-02-15', '2026-06-30', 'active', @admin_id),
(5, NULL, 5, 'IT Infrastructure Upgrade',
 'Upgrading office servers, network equipment and donor management software.',
 50000.00, 12000.00, 'Bangladesh', 'Dhaka', '2026-01-01', '2026-03-31', 'on_hold', @admin_id);

-- =============================================================================
-- 7. Shifts
-- =============================================================================
INSERT IGNORE INTO dfb_shifts (shift_id, project_id, campaign_id, shift_title, description, location_name, location_lat, location_lng, start_datetime, end_datetime, max_volunteers, signed_up_count, status, created_by)
VALUES
(1, 1, 1, 'Food Package Assembly — Morning Shift',
 'Assembling and packaging Ramadan food boxes at the warehouse.',
 'DFB Warehouse, Mirpur, Dhaka', 23.8041, 90.3636,
 '2026-03-15 08:00:00', '2026-03-15 13:00:00', 20, 5, 'open', @admin_id),
(2, 1, 1, 'Food Distribution — Korail Slum',
 'Distributing food packages to families in Korail slum area.',
 'Korail Bosti, Dhaka', 23.7785, 90.4118,
 '2026-03-15 14:00:00', '2026-03-15 18:00:00', 15, 8, 'open', @admin_id),
(3, 2, 1, 'Iftar Event Setup — Chittagong Masjid',
 'Setting up tables, serving iftar and cleaning after the event.',
 'Jamia Mosque, Chittagong', 22.3569, 91.7832,
 '2026-03-16 15:00:00', '2026-03-16 21:00:00', 10, 10, 'full', @admin_id),
(4, 4, 4, 'Masjid Construction Support',
 'General support for construction crew — carrying materials, site safety.',
 'Village Masjid Site, Noakhali', 22.8456, 91.0996,
 '2026-03-20 07:00:00', '2026-03-20 16:00:00', 25, 3, 'open', @admin_id),
(5, NULL, 5, 'Orphan Day Event — Photography',
 'Photography and social media coverage of the annual Orphan Day event.',
 'DFB Event Hall, Dhaka', 23.7272, 90.4093,
 '2026-03-25 09:00:00', '2026-03-25 17:00:00', 5, 2, 'open', @admin_id);

-- =============================================================================
-- 8. Shift Signups
-- Actual columns: signup_id (auto), shift_id, volunteer_id,
--   attendance_marked_by, attendance_marked_at
-- NO: signed_up_at, status
-- =============================================================================
INSERT IGNORE INTO dfb_shift_signups (shift_id, volunteer_id)
VALUES
(1, 1), (1, 2), (2, 1), (2, 3), (3, 2), (4, 4), (5, 1), (5, 4);

-- =============================================================================
-- 9. Timesheets
-- Actual cols: volunteer_id, project_id, shift_id, activity_description,
--   start_datetime (NOT NULL), end_datetime (NOT NULL), duration_minutes (generated),
--   status, admin_notes, reviewed_by, reviewed_at, submitted_at
-- NO: hours_worked, gps_lat, gps_lon, approved_by, approved_at
-- =============================================================================
INSERT IGNORE INTO dfb_timesheets (volunteer_id, shift_id, activity_description, start_datetime, end_datetime, status, submitted_at, reviewed_by, reviewed_at)
VALUES
(1, 1, 'Assembled and packed 150 food boxes during morning shift.',
 '2026-03-15 08:00:00', '2026-03-15 13:00:00', 'approved', '2026-03-15 13:30:00', @admin_id, '2026-03-16 10:00:00'),
(2, 1, 'Helped with labeling, sorting and loading boxes into vehicles.',
 '2026-03-15 08:15:00', '2026-03-15 13:00:00', 'approved', '2026-03-15 13:35:00', @admin_id, '2026-03-16 10:05:00'),
(1, 2, 'Distributed 80 food packages to families in Korail area.',
 '2026-03-15 14:00:00', '2026-03-15 18:00:00', 'pending', '2026-03-15 18:30:00', NULL, NULL),
(3, 3, 'Set up tables, served 300 people iftar, cleaned venue.',
 '2026-03-16 15:00:00', '2026-03-16 21:00:00', 'approved', '2026-03-16 21:30:00', @admin_id, '2026-03-17 09:00:00'),
(4, 5, 'Photographed event proceedings and created social media content.',
 '2026-02-25 09:00:00', '2026-02-25 17:00:00', 'pending', '2026-02-25 17:30:00', NULL, NULL);

-- =============================================================================
-- 10. Expenses
-- =============================================================================
INSERT INTO dfb_expenses (expense_id, fund_id, amount_spent, vendor_name, purpose, status, submitted_by_volunteer_id, approved_by, approved_at, spent_timestamp, created_at)
VALUES
(UUID(), 4, 45000.00, 'Dhaka Wholesale Market', 'Purchase of rice, lentils, oil for 200 food packages', 'Approved', 1, @admin_id, '2026-03-06 10:00:00', '2026-03-05 11:00:00', '2026-03-05 14:00:00'),
(UUID(), 4, 12000.00, 'Chittagong Supplies Co.', 'Iftar ingredients — dates, juice, samosa for 3 days', 'Approved', 2, @admin_id, '2026-03-07 09:00:00', '2026-03-06 13:00:00', '2026-03-06 15:00:00'),
(UUID(), 4, 8500.00, 'Packaging Bangladesh Ltd.', '500 food package boxes and printing', 'Pending', 1, NULL, NULL, '2026-03-09 10:00:00', '2026-03-10 08:00:00'),
(UUID(), 3, 25000.00, 'Noakhali Construction Materials', 'Cement, bricks, sand for masjid foundation', 'Approved', 4, @admin_id, '2026-03-08 14:00:00', '2026-03-07 12:00:00', '2026-03-07 16:00:00'),
(UUID(), 5, 15000.00, 'Tech Solutions BD', 'Network router and UPS purchase', 'Rejected', 1, @admin_id, '2026-03-09 11:00:00', '2026-03-08 10:00:00', '2026-03-08 12:00:00'),
(UUID(), 4, 3200.00, 'Dhaka City Vehicles', 'Transport hire for food distribution — 2 pickup trucks', 'Pending', 3, NULL, NULL, '2026-03-11 08:00:00', '2026-03-11 09:00:00');

-- =============================================================================
-- 11. Beneficiaries
-- =============================================================================
INSERT IGNORE INTO dfb_beneficiaries (beneficiary_id, full_name, city, welfare_category, status, intake_date, case_notes, assigned_volunteer_id)
VALUES
(1, 'Amina Begum', 'Dhaka', 'food', 'active', '2026-02-01', 'Widow with 4 children. Monthly food support needed.', 1),
(2, 'Rahim Mia', 'Dhaka', 'shelter', 'active', '2026-02-05', 'Flood victim — homeless. Placed in transitional shelter.', 2),
(3, 'Fatema Khatun', 'Chittagong', 'medical', 'active', '2026-02-10', 'Chronic kidney disease. Requires regular dialysis support.', 3),
(4, 'Masum Hossain', 'Sylhet', 'education', 'active', '2026-02-15', 'Talented student, family too poor for school fees.', 1),
(5, 'Johura Begum', 'Rajshahi', 'cash_aid', 'active', '2026-02-20', 'Elderly widow, sole income lost. Monthly stipend approved.', 4),
(6, 'Nazmul Islam', 'Dhaka', 'food', 'completed', '2025-11-01', 'Completed food aid program after job placement assistance.', 1),
(7, 'Shirin Akter', 'Dhaka', 'medical', 'active', '2026-03-01', 'Post-surgery recovery — medicines and follow-up visits needed.', 2),
(8, 'Khalil Rahman', 'Khulna', 'shelter', 'active', '2026-03-05', 'Cyclone victim, family of 6 displaced.', NULL);

-- =============================================================================
-- 12. Pledges
-- =============================================================================
INSERT IGNORE INTO dfb_pledges (pledge_id, donor_id, campaign_id, fund_id, total_pledge_amount, amount_fulfilled, installment_count, installments_paid, frequency, start_date, end_date, status)
VALUES
(1, 3, 1, 4, 50000.00, 25000.00, 4, 2, 'monthly', '2026-02-01', '2026-05-31', 'active'),
(2, 5, 2, 2, 100000.00, 100000.00, 1, 1, 'one_time', '2026-01-15', '2026-01-15', 'completed'),
(3, 6, 4, 3, 200000.00, 0.00, 8, 0, 'quarterly', '2026-03-01', '2028-03-01', 'active'),
(4, 7, NULL, 1, 500000.00, 200000.00, 12, 4, 'monthly', '2025-12-01', '2026-11-30', 'active'),
(5, 2, 5, 1, 25000.00, 12500.00, 2, 1, 'monthly', '2026-02-15', '2026-03-15', 'active');

-- =============================================================================
-- 13. Recurring Subscriptions
-- gateway ENUM: 'stripe' | 'paypal' ONLY
-- NO: payment_method, status, started_at
-- =============================================================================
INSERT IGNORE INTO dfb_recurring_subscriptions (donor_id, campaign_id, fund_id, amount, frequency, gateway, gateway_subscription_id, next_billing_date)
VALUES
(1, NULL, 1, 1000.00, 'monthly', 'stripe', 'sub_stripe_001', '2026-04-01'),
(3, 1, 4, 5000.00, 'monthly', 'stripe', 'sub_stripe_002', '2026-04-01'),
(5, 2, 2, 10000.00, 'monthly', 'stripe', 'sub_stripe_003', '2026-04-01'),
(6, NULL, 3, 500.00, 'monthly', 'paypal', 'sub_paypal_001', '2026-04-01'),
(2, 5, 1, 2500.00, 'monthly', 'stripe', 'sub_stripe_004', '2026-04-15');

-- =============================================================================
-- 14. P2P Campaigns
-- =============================================================================
INSERT IGNORE INTO dfb_p2p_campaigns (p2p_id, parent_campaign_id, creator_user_id, title, slug, personal_story, cover_image_url, goal_amount, raised_amount, status, approved_by, approved_at, end_date)
VALUES
(1, 1, @volunteer_user_id, 'My Ramadan Challenge — Help 50 Families', 'ramadan-challenge-volunteer-demo',
 'I am running a personal fundraising challenge this Ramadan to help 50 families in my neighbourhood. Every taka counts!',
 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800',
 25000.00, 12500.00, 'active', @admin_id, '2026-03-01 10:00:00', '2026-04-10'),
(2, 2, @volunteer_user_id, 'My Zakat Fundraiser 2026', 'zakat-fundraiser-volunteer-2026',
 'Help me collect Zakat to support eligible families this year. Share and donate!',
 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
 50000.00, 0.00, 'draft', NULL, NULL, '2026-12-31'),
(3, 1, @admin_id, 'Corporate Iftar Drive by DFB Staff', 'corporate-iftar-dfb-staff',
 'Our team is collectively raising funds to sponsor iftar for 100 people every day during Ramadan.',
 NULL, 30000.00, 18000.00, 'active', @admin_id, '2026-02-28 09:00:00', '2026-04-10');

-- =============================================================================
-- 15. Announcements
-- type: ENUM('info','warning','success','urgent')
-- target_audience: ENUM('public','donors','volunteers','admins','all')
-- NO: is_pinned, audience
-- =============================================================================
INSERT IGNORE INTO dfb_announcements (title, body, type, target_audience, is_active, created_by, created_at)
VALUES
('Ramadan Mubarak — Campaign Launch!',
 'Alhamdulillah, our Ramadan Emergency Relief 2026 campaign is now live! Goal: BDT 5,00,000. Please share and donate.',
 'success', 'all', 1, @admin_id, '2026-02-01 08:00:00'),
('New Volunteer Applications Portal',
 'We have launched a new online portal for volunteer applications. Apply at our website. Applications reviewed within 7 days.',
 'info', 'all', 1, @admin_id, '2026-02-15 10:00:00'),
('Volunteer Shift — March 15th Food Distribution',
 'Volunteers! Please confirm your availability for the March 15th food distribution shift in Dhaka. Sign up through the volunteer portal.',
 'info', 'volunteers', 1, @admin_id, '2026-03-08 09:00:00'),
('Donor Tax Receipt Available',
 'Tax receipts for donations made in January-February 2026 are now available for download from your donor portal.',
 'info', 'donors', 1, @admin_id, '2026-03-05 11:00:00'),
('System Maintenance — March 20th',
 'The system will undergo scheduled maintenance on March 20, 2026 from 2:00 AM to 4:00 AM BST.',
 'warning', 'all', 1, @admin_id, '2026-03-10 12:00:00');

-- =============================================================================
-- 16. ID Card Templates
-- NO: html_template — uses structured config fields
-- =============================================================================
INSERT IGNORE INTO dfb_id_card_templates (template_name, orientation, background_color, accent_color, text_color, org_name, tagline, show_photo, show_badge_number, show_designation, show_qr_code, show_validity_date, validity_duration_months, footer_text, is_active, created_by)
VALUES
('Standard Blue Volunteer Card', 'horizontal', '#dbeafe', '#1a56db', '#111827',
 'DFB Foundation', 'Serving Humanity with Compassion', 1, 1, 1, 1, 1, 12, 'Official Volunteer ID — DFB Foundation', 1, @admin_id),
('Senior Gold Volunteer Card', 'horizontal', '#fef3c7', '#d97706', '#111827',
 'DFB Foundation', 'Senior Volunteer Member', 1, 1, 1, 1, 1, 24, 'DFB Foundation — Senior Volunteer', 1, @admin_id),
('Compact Vertical Badge', 'vertical', '#f0fdf4', '#059669', '#111827',
 'DFB Foundation', NULL, 1, 1, 0, 1, 1, 12, 'DFB Foundation', 1, @admin_id);

-- =============================================================================
-- 17. Volunteer ID Cards
-- card_id: char(36), NO status column
-- Revoke uses: revoked_by, revoked_at, revoked_reason
-- =============================================================================
INSERT IGNORE INTO dfb_volunteer_id_cards (card_id, volunteer_id, template_id, badge_number, issue_date, expiry_date, generated_at, generated_by)
SELECT UUID(), 1, t.template_id, 'VOL-0001', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 12 MONTH), NOW(), @admin_id
FROM dfb_id_card_templates t WHERE t.template_name='Standard Blue Volunteer Card' LIMIT 1;

INSERT IGNORE INTO dfb_volunteer_id_cards (card_id, volunteer_id, template_id, badge_number, issue_date, expiry_date, generated_at, generated_by)
SELECT UUID(), 2, t.template_id, 'VOL-0002', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 12 MONTH), NOW(), @admin_id
FROM dfb_id_card_templates t WHERE t.template_name='Standard Blue Volunteer Card' LIMIT 1;

-- =============================================================================
-- 18. Certificate Templates
-- columns: cert_template_id, template_name, title_text, body_template,
--   background_image_url, org_logo_url, primary_color,
--   admin_signature_1_url/name/title, admin_signature_2_url/name/title,
--   is_active, created_by
-- =============================================================================
INSERT IGNORE INTO dfb_certificate_templates (template_name, title_text, body_template, primary_color, is_active, created_by)
VALUES
('Volunteer Appreciation Certificate',
 'Certificate of Appreciation',
 '<div style="text-align:center;padding:40px;font-family:Georgia,serif;border:4px double #2563eb"><h1 style="color:#2563eb">DFB FOUNDATION</h1><h2 style="letter-spacing:3px;font-size:14px;color:#6b7280">CERTIFICATE OF APPRECIATION</h2><p style="margin-top:20px">This is to certify that</p><h2 style="font-size:24px;border-bottom:2px solid #2563eb;padding-bottom:8px">{{volunteer_name}}</h2><p>has demonstrated outstanding dedication and service as a volunteer</p><p style="margin-top:20px;font-size:12px;color:#6b7280">Issued: {{issue_date}} | Code: {{verification_code}}</p></div>',
 '#2563eb', 1, @admin_id),
('Ramadan Service Certificate',
 'Ramadan Relief Service Certificate',
 '<div style="text-align:center;padding:40px;font-family:Arial,sans-serif;border:3px solid #059669;background:#f0fdf4"><h1 style="color:#059669">DFB FOUNDATION</h1><h2 style="letter-spacing:2px;font-size:13px">RAMADAN SERVICE CERTIFICATE</h2><p style="margin-top:20px">Awarded to</p><h2 style="font-size:22px">{{volunteer_name}}</h2><p>For exceptional service during Ramadan Relief Operations 2026</p><p style="font-size:11px;color:#6b7280;margin-top:16px">Verification: {{verification_code}}</p></div>',
 '#059669', 1, @admin_id),
('Training Completion Certificate',
 'Certificate of Training Completion',
 '<div style="text-align:center;padding:40px;font-family:Arial,sans-serif;border:2px solid #7c3aed"><h1 style="color:#7c3aed">DFB FOUNDATION</h1><h2>TRAINING COMPLETION CERTIFICATE</h2><p>This certifies that</p><h2 style="font-size:22px">{{volunteer_name}}</h2><p>has successfully completed the required volunteer training program</p><p style="font-size:11px;margin-top:16px">Code: {{verification_code}} | Date: {{issue_date}}</p></div>',
 '#7c3aed', 1, @admin_id);

-- =============================================================================
-- 19. Certificate Awards
-- award_id: char(36) UUID, cert_template_id (NOT template_id),
-- NO issued_at column, verification_code max 16 chars UNIQUE
-- =============================================================================
INSERT IGNORE INTO dfb_certificate_awards (award_id, cert_template_id, volunteer_id, custom_note, hours_served, issue_date, verification_code, issued_by)
SELECT UUID(), ct.cert_template_id, 1,
 'For outstanding contributions during Ramadan Relief 2026', 40, CURDATE(),
 UPPER(CONV(FLOOR(RAND()*99999999999999),10,36)),
 @admin_id
FROM dfb_certificate_templates ct WHERE ct.template_name='Volunteer Appreciation Certificate' LIMIT 1;

INSERT IGNORE INTO dfb_certificate_awards (award_id, cert_template_id, volunteer_id, custom_note, hours_served, issue_date, verification_code, issued_by)
SELECT UUID(), ct.cert_template_id, 1,
 'For excellent service during Ramadan Relief Operations', 30, CURDATE(),
 UPPER(CONV(FLOOR(RAND()*99999999999999),10,36)),
 @admin_id
FROM dfb_certificate_templates ct WHERE ct.template_name='Ramadan Service Certificate' LIMIT 1;

INSERT IGNORE INTO dfb_certificate_awards (award_id, cert_template_id, volunteer_id, custom_note, hours_served, issue_date, verification_code, issued_by)
SELECT UUID(), ct.cert_template_id, 2,
 'Dedicated volunteer for food distribution program', 20, CURDATE(),
 UPPER(CONV(FLOOR(RAND()*99999999999999),10,36)),
 @admin_id
FROM dfb_certificate_templates ct WHERE ct.template_name='Volunteer Appreciation Certificate' LIMIT 1;

-- =============================================================================
-- 20. Volunteer Messages
-- recipient_volunteer_id (NOT volunteer_id)
-- =============================================================================
INSERT IGNORE INTO dfb_volunteer_messages (message_id, sender_user_id, recipient_volunteer_id, subject, body, channel, is_read, read_at, sent_at)
VALUES
(UUID(), @admin_id, 1, 'March 15th Shift Confirmation',
 'Dear Demo Volunteer, this is to confirm your registration for the March 15th food distribution shift at Korail Bosti, Dhaka. Please arrive by 7:45 AM. JazakAllah Khair!',
 'in_app', 1, '2026-03-10 11:00:00', '2026-03-10 09:00:00'),
(UUID(), @admin_id, 1, 'Your Volunteer ID Card is Ready!',
 'Your DFB volunteer ID card has been issued. Download it from your volunteer portal under My Records. Please carry it during all volunteer activities.',
 'in_app', 0, NULL, '2026-03-08 14:00:00'),
(UUID(), @admin_id, 2, 'Ramadan Appreciation Message',
 'Dear Karim, JazakAllahu Khayran for your dedication during our Ramadan food distribution. Your contribution made a real difference to 80+ families. We are grateful!',
 'in_app', 1, '2026-03-06 15:00:00', '2026-03-06 10:00:00'),
(UUID(), @admin_id, 3, 'Timesheet Approval Notice',
 'Your timesheet for the Iftar Event on March 16th has been approved. 6 hours credited to your volunteer record.',
 'in_app', 1, '2026-03-02 14:00:00', '2026-03-02 09:00:00'),
(UUID(), @admin_id, 4, 'New Shift Available — Masjid Construction',
 'Dear Rafiq, a new volunteer shift has been posted for Masjid construction support in Noakhali on March 20th. Please log in to sign up.',
 'in_app', 0, NULL, '2026-03-12 10:00:00');

-- =============================================================================
-- 21. Translations (i18n)
-- =============================================================================
INSERT IGNORE INTO dfb_translations (locale, namespace, `key`, value, updated_by, updated_at)
VALUES
('en', 'common', 'app.name', 'DFB Foundation', @admin_id, NOW()),
('en', 'common', 'app.tagline', 'Serving Humanity with Compassion', @admin_id, NOW()),
('en', 'common', 'nav.home', 'Home', @admin_id, NOW()),
('en', 'common', 'nav.donate', 'Donate Now', @admin_id, NOW()),
('en', 'common', 'nav.volunteer', 'Volunteer', @admin_id, NOW()),
('en', 'common', 'nav.campaigns', 'Campaigns', @admin_id, NOW()),
('en', 'common', 'nav.about', 'About Us', @admin_id, NOW()),
('en', 'common', 'nav.contact', 'Contact', @admin_id, NOW()),
('en', 'donate', 'page.title', 'Make a Donation', @admin_id, NOW()),
('en', 'donate', 'page.subtitle', 'Your generosity changes lives', @admin_id, NOW()),
('en', 'donate', 'form.amount', 'Donation Amount', @admin_id, NOW()),
('en', 'donate', 'form.name', 'Full Name', @admin_id, NOW()),
('en', 'donate', 'form.email', 'Email Address', @admin_id, NOW()),
('en', 'donate', 'form.fund', 'Select Fund', @admin_id, NOW()),
('en', 'donate', 'button.donate', 'Donate Now', @admin_id, NOW()),
('en', 'donate', 'button.cancel', 'Cancel', @admin_id, NOW()),
('en', 'volunteer', 'page.title', 'Volunteer With Us', @admin_id, NOW()),
('en', 'volunteer', 'page.subtitle', 'Make a difference in your community', @admin_id, NOW()),
('en', 'volunteer', 'form.apply', 'Apply to Volunteer', @admin_id, NOW()),
('bn', 'common', 'app.name', 'ডিএফবি ফাউন্ডেশন', @admin_id, NOW()),
('bn', 'common', 'app.tagline', 'মানবতার সেবায় সহমর্মিতা নিয়ে', @admin_id, NOW()),
('bn', 'common', 'nav.home', 'হোম', @admin_id, NOW()),
('bn', 'common', 'nav.donate', 'এখনই দান করুন', @admin_id, NOW()),
('bn', 'common', 'nav.volunteer', 'স্বেচ্ছাসেবক', @admin_id, NOW()),
('bn', 'common', 'nav.campaigns', 'প্রচারণা', @admin_id, NOW()),
('bn', 'donate', 'page.title', 'দান করুন', @admin_id, NOW()),
('bn', 'donate', 'page.subtitle', 'আপনার উদারতা জীবন পরিবর্তন করে', @admin_id, NOW()),
('bn', 'donate', 'form.amount', 'দানের পরিমাণ', @admin_id, NOW()),
('bn', 'donate', 'button.donate', 'এখনই দান করুন', @admin_id, NOW()),
('ar', 'common', 'app.name', 'مؤسسة دي إف بي', @admin_id, NOW()),
('ar', 'common', 'app.tagline', 'نخدم الإنسانية بتعاطف', @admin_id, NOW()),
('ar', 'common', 'nav.donate', 'تبرع الآن', @admin_id, NOW()),
('ar', 'donate', 'page.title', 'قدم تبرعك', @admin_id, NOW()),
('ar', 'donate', 'button.donate', 'تبرع الآن', @admin_id, NOW());

-- =============================================================================
-- 22. Public Pages (CMS)
-- =============================================================================
INSERT IGNORE INTO dfb_public_pages (page_slug, page_title, meta_title, meta_description, sections_json, is_published, is_indexed, updated_by)
VALUES
('about-us', 'About DFB Foundation', 'About Us — DFB Foundation',
 'Learn about DFB Foundation, our mission, vision, and the work we do.',
 '[{"type":"hero","title":"Our Story","subtitle":"Serving Since 2015"},{"type":"text","content":"DFB Foundation was established in 2015 with a vision to provide dignified humanitarian assistance to underprivileged communities across Bangladesh and beyond."},{"type":"stats","items":[{"label":"Beneficiaries Served","value":"25,000+"},{"label":"Volunteers Active","value":"150+"},{"label":"Campaigns Run","value":"80+"}]}]',
 1, 1, @admin_id),
('contact-us', 'Contact Us', 'Contact DFB Foundation',
 'Get in touch with DFB Foundation.',
 '[{"type":"hero","title":"Get In Touch","subtitle":"We are here to help"},{"type":"contact","email":"info@dfb-foundation.org","phone":"+880-2-12345678","address":"DFB House, Mirpur-1, Dhaka-1216, Bangladesh"}]',
 1, 1, @admin_id),
('zakat-guide', 'Zakat Guide — How to Calculate', 'Zakat Calculator & Guide — DFB Foundation',
 'Learn how to calculate your Zakat correctly.',
 '[{"type":"hero","title":"Understanding Zakat","subtitle":"Your obligation, our guidance"},{"type":"faq","items":[{"q":"What is Nisab?","a":"The minimum wealth threshold — 85g gold or 595g silver."},{"q":"How much is Zakat?","a":"2.5% of total qualifying wealth held for one lunar year."}]}]',
 1, 1, @admin_id),
('privacy-policy', 'Privacy Policy', 'Privacy Policy — DFB Foundation',
 'Read our privacy policy.',
 '[{"type":"text","content":"Last updated: March 2026"},{"type":"text","content":"DFB Foundation is committed to protecting your privacy. We never sell your data."}]',
 1, 1, @admin_id),
('homepage-hero', 'Homepage Hero Content', 'DFB Foundation — Homepage',
 'Draft homepage hero section.',
 '[{"type":"hero","title":"Changing Lives Through Compassion","subtitle":"Join 10,000+ donors making a difference","cta":{"text":"Donate Now","url":"/donate"}}]',
 0, 0, @admin_id);

-- =============================================================================
-- 23. Form Schemas
-- =============================================================================
INSERT IGNORE INTO dfb_form_schemas (form_type, schema_json, is_active, created_by)
VALUES
('donation',
 '{"version":"1.0","fields":[{"name":"amount","type":"currency","label":"Donation Amount","required":true},{"name":"fund_id","type":"select","label":"Donate To","required":true},{"name":"campaign_id","type":"select","label":"Campaign (Optional)","required":false},{"name":"donor_name","type":"text","label":"Full Name","required":true},{"name":"email","type":"email","label":"Email Address","required":true},{"name":"is_anonymous","type":"checkbox","label":"Donate Anonymously","required":false}],"settings":{"showZakatCalculator":true,"allowRecurring":true}}',
 1, @admin_id),
('registration',
 '{"version":"1.0","fields":[{"name":"first_name","type":"text","label":"First Name","required":true},{"name":"last_name","type":"text","label":"Last Name","required":true},{"name":"email","type":"email","label":"Email Address","required":true},{"name":"password","type":"password","label":"Password","required":true},{"name":"phone","type":"tel","label":"Phone Number","required":false},{"name":"accept_terms","type":"checkbox","label":"I agree to Terms","required":true}],"settings":{"requireEmailVerification":true}}',
 1, @admin_id),
('beneficiary_intake',
 '{"version":"1.0","fields":[{"name":"full_name","type":"text","label":"Beneficiary Full Name","required":true},{"name":"address","type":"textarea","label":"Home Address","required":true},{"name":"city","type":"text","label":"City/District","required":true},{"name":"welfare_category","type":"select","label":"Type of Aid Needed","required":true,"options":["food","shelter","medical","education","cash_aid","other"]},{"name":"case_notes","type":"textarea","label":"Case Notes","required":false}],"settings":{"autoAssignVolunteer":true}}',
 1, @admin_id),
('expense',
 '{"version":"1.0","fields":[{"name":"fund_id","type":"select","label":"Fund","required":true},{"name":"amount_spent","type":"currency","label":"Amount Spent","required":true},{"name":"vendor_name","type":"text","label":"Vendor Name","required":true},{"name":"purpose","type":"textarea","label":"Purpose","required":true},{"name":"spent_timestamp","type":"datetime","label":"Date & Time","required":true}],"settings":{"requireApproval":true}}',
 1, @admin_id),
('campaign',
 '{"version":"1.0","fields":[{"name":"title","type":"text","label":"Campaign Title","required":true},{"name":"fund_id","type":"select","label":"Fund","required":true},{"name":"description","type":"richtext","label":"Description","required":true},{"name":"goal_amount","type":"currency","label":"Fundraising Goal","required":false},{"name":"start_date","type":"date","label":"Start Date","required":false},{"name":"end_date","type":"date","label":"End Date","required":false}],"settings":{"requireApproval":false}}',
 1, @admin_id);

-- =============================================================================
-- 24. Project Assignments
-- =============================================================================
INSERT IGNORE INTO dfb_project_assignments (volunteer_id, project_id, spending_limit_override, assigned_by, status)
VALUES
(1, 1, 15000.00, @admin_id, 'active'),
(2, 1, 5000.00, @admin_id, 'active'),
(1, 4, 20000.00, @admin_id, 'active'),
(4, 5, 8000.00, @admin_id, 'active');

-- =============================================================================
-- Summary: row counts per table
-- =============================================================================
SELECT 'donors' AS tbl, COUNT(*) AS cnt FROM dfb_donors
UNION ALL SELECT 'campaigns', COUNT(*) FROM dfb_campaigns
UNION ALL SELECT 'transactions', COUNT(*) FROM dfb_transactions
UNION ALL SELECT 'volunteers', COUNT(*) FROM dfb_volunteers
UNION ALL SELECT 'vol_applications', COUNT(*) FROM dfb_volunteer_applications
UNION ALL SELECT 'projects', COUNT(*) FROM dfb_projects
UNION ALL SELECT 'shifts', COUNT(*) FROM dfb_shifts
UNION ALL SELECT 'shift_signups', COUNT(*) FROM dfb_shift_signups
UNION ALL SELECT 'timesheets', COUNT(*) FROM dfb_timesheets
UNION ALL SELECT 'expenses', COUNT(*) FROM dfb_expenses
UNION ALL SELECT 'beneficiaries', COUNT(*) FROM dfb_beneficiaries
UNION ALL SELECT 'pledges', COUNT(*) FROM dfb_pledges
UNION ALL SELECT 'recurring', COUNT(*) FROM dfb_recurring_subscriptions
UNION ALL SELECT 'p2p_campaigns', COUNT(*) FROM dfb_p2p_campaigns
UNION ALL SELECT 'announcements', COUNT(*) FROM dfb_announcements
UNION ALL SELECT 'id_card_templates', COUNT(*) FROM dfb_id_card_templates
UNION ALL SELECT 'id_cards', COUNT(*) FROM dfb_volunteer_id_cards
UNION ALL SELECT 'cert_templates', COUNT(*) FROM dfb_certificate_templates
UNION ALL SELECT 'cert_awards', COUNT(*) FROM dfb_certificate_awards
UNION ALL SELECT 'vol_messages', COUNT(*) FROM dfb_volunteer_messages
UNION ALL SELECT 'translations', COUNT(*) FROM dfb_translations
UNION ALL SELECT 'public_pages', COUNT(*) FROM dfb_public_pages
UNION ALL SELECT 'form_schemas', COUNT(*) FROM dfb_form_schemas;
