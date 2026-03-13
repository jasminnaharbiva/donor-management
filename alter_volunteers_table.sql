-- Add additional fields to dfb_volunteers table for enhanced search functionality
-- These fields are copied from volunteer applications when approved

ALTER TABLE `dfb_volunteers`
ADD COLUMN `father_name` VARCHAR(160) AFTER `last_name`,
ADD COLUMN `date_of_birth` DATE AFTER `father_name`,
ADD COLUMN `blood_group` VARCHAR(10) AFTER `date_of_birth`,
ADD COLUMN `education_level` VARCHAR(100) AFTER `blood_group`,
ADD COLUMN `mobile_number` VARCHAR(20) AFTER `phone`,
ADD COLUMN `nid_or_birth_certificate_no` VARCHAR(120) AFTER `national_id_hash`,
ADD COLUMN `full_address` TEXT AFTER `address`,
ADD COLUMN `division` VARCHAR(80) AFTER `full_address`,
ADD COLUMN `district` VARCHAR(80) AFTER `division`,
ADD COLUMN `upazila` VARCHAR(80) AFTER `district`,
ADD COLUMN `passport_photo_url` VARCHAR(500) AFTER `profile_photo_url`,
ADD COLUMN `motivation_statement` LONGTEXT AFTER `id_document_url`,
ADD COLUMN `skills` JSON AFTER `motivation_statement`,
ADD COLUMN `availability` JSON AFTER `skills`,
ADD COLUMN `reference_name` VARCHAR(160) AFTER `availability`,
ADD COLUMN `reference_phone` VARBINARY(512) AFTER `reference_name`,
ADD COLUMN `emergency_contact_name` VARCHAR(160) AFTER `reference_phone`,
ADD COLUMN `emergency_contact_phone` VARBINARY(512) AFTER `emergency_contact_name`,
ADD COLUMN `document_urls` JSON AFTER `emergency_contact_phone`;

-- Add indexes for searchable fields
ALTER TABLE `dfb_volunteers`
ADD INDEX `idx_volunteer_district` (`district`),
ADD INDEX `idx_volunteer_upazila` (`upazila`),
ADD INDEX `idx_volunteer_division` (`division`),
ADD INDEX `idx_volunteer_education` (`education_level`),
ADD INDEX `idx_volunteer_father_name` (`father_name`),
ADD INDEX `idx_volunteer_blood_group` (`blood_group`);