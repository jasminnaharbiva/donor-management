import { Knex } from 'knex';

const FORM_TYPE_ENUM_WITH_BENEFICIARY = "ENUM('donation','registration','expense','campaign','beneficiary_intake','volunteer_application','beneficiary_application')";
const FORM_TYPE_ENUM_BASE = "ENUM('donation','registration','expense','campaign','beneficiary_intake','volunteer_application')";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE dfb_form_schemas MODIFY COLUMN form_type ${FORM_TYPE_ENUM_WITH_BENEFICIARY} NOT NULL`);

  if (!(await knex.schema.hasTable('dfb_beneficiary_applications'))) {
    await knex.schema.createTable('dfb_beneficiary_applications', (table) => {
      table.increments('application_id').unsigned().primary();

      table.string('applicant_user_id', 36).notNullable().index();
      table.integer('volunteer_id').unsigned().notNullable().index();

      table.string('full_name', 160).notNullable();
      table.string('father_name', 160).nullable();
      table.string('mother_name', 160).nullable();
      table.date('date_of_birth').nullable();
      table.string('nid_or_birth_certificate_no', 120).nullable();
      table.string('mobile_number', 20).nullable();
      table.string('division', 80).nullable();
      table.string('district', 80).nullable();
      table.string('upazila', 80).nullable();
      table.string('village', 120).nullable();
      table.text('full_address').nullable();

      table.string('identity_document_url', 500).nullable();
      table.string('passport_photo_url', 500).nullable();
      table.string('nationality_certificate_url', 500).nullable();
      table.string('additional_document_url', 500).nullable();

      table.string('project_type', 100).nullable();
      table.decimal('project_amount_taka', 15, 2).nullable();
      table.text('case_description').nullable();

      table
        .enu('status', ['pending', 'under_review', 'approved', 'rejected', 'needs_changes'])
        .notNullable()
        .defaultTo('pending')
        .index();

      table.text('review_notes').nullable();
      table.string('reviewed_by', 36).nullable();
      table.dateTime('reviewed_at').nullable();

      table.integer('assigned_volunteer_id').unsigned().nullable();
      table.integer('tagged_donor_id').unsigned().nullable();
      table.boolean('allow_interested_donors').notNullable().defaultTo(false);
      table.integer('linked_project_id').unsigned().nullable();
      table.boolean('fundraiser_required').notNullable().defaultTo(false);

      table.integer('created_beneficiary_id').unsigned().nullable().index();

      table.text('form_payload', 'longtext').notNullable();
      table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
      table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());

      table.foreign('volunteer_id').references('volunteer_id').inTable('dfb_volunteers').onDelete('CASCADE');
      table.foreign('assigned_volunteer_id').references('volunteer_id').inTable('dfb_volunteers').onDelete('SET NULL');
      table.foreign('tagged_donor_id').references('donor_id').inTable('dfb_donors').onDelete('SET NULL');
      table.foreign('linked_project_id').references('project_id').inTable('dfb_projects').onDelete('SET NULL');
      table.foreign('created_beneficiary_id').references('beneficiary_id').inTable('dfb_beneficiaries').onDelete('SET NULL');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('dfb_beneficiary_applications')) {
    await knex.schema.dropTable('dfb_beneficiary_applications');
  }

  await knex('dfb_form_schemas').where({ form_type: 'beneficiary_application' }).delete();
  await knex.schema.raw(`ALTER TABLE dfb_form_schemas MODIFY COLUMN form_type ${FORM_TYPE_ENUM_BASE} NOT NULL`);
}
