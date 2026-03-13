import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vms_admins', (table) => {
    table.increments('id').primary();
    table.string('username', 80).notNullable().unique();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('role', 40).notNullable().defaultTo('admin');
    table.boolean('status').notNullable().defaultTo(true);
    table.timestamp('last_login_at').nullable();
    table.string('last_login_ip', 64).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('vms_volunteers', (table) => {
    table.increments('id').primary();
    table.string('full_name', 150).notNullable();
    table.string('father_name', 150).nullable();
    table.string('mother_name', 150).nullable();
    table.date('date_of_birth').nullable();
    table.enu('blood_group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable();
    table.string('mobile_number', 30).nullable();
    table.string('nid_or_birth_certificate', 80).nullable();
    table.enu('gender', ['Male', 'Female', 'Other']).nullable();
    table.string('division', 80).nullable();
    table.string('district', 80).nullable();
    table.string('upazila', 80).nullable();
    table.boolean('status').notNullable().defaultTo(true);
    table.string('picture_path', 255).nullable();
    table.timestamps(true, true);

    table.index(['full_name']);
    table.index(['mobile_number']);
    table.index(['status']);
  });

  await knex.schema.createTable('vms_certificates', (table) => {
    table.increments('id').primary();
    table.string('certificate_id', 80).notNullable().unique();
    table.integer('volunteer_id').unsigned().notNullable();
    table.date('issue_date').nullable();
    table.boolean('status').notNullable().defaultTo(true);
    table.string('image_path', 255).nullable();
    table.timestamps(true, true);

    table.foreign('volunteer_id').references('id').inTable('vms_volunteers').onDelete('CASCADE');
    table.unique(['volunteer_id']);
    table.index(['status']);
  });

  await knex.schema.createTable('vms_general_settings', (table) => {
    table.increments('id').primary();
    table.string('site_name', 150).notNullable().defaultTo('CNS Foundation Volunteer Management');
    table.string('home_title', 255).notNullable().defaultTo('Volunteer Certificate Verification');
    table.string('keywords', 255).nullable();
    table.text('description').nullable();
    table.string('recaptcha_site_key', 255).nullable();
    table.string('recaptcha_secret_key', 255).nullable();
    table.string('logo_path', 255).nullable();
    table.string('timezone', 80).notNullable().defaultTo('Asia/Dhaka');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('vms_audit_logs', (table) => {
    table.bigIncrements('id').primary();
    table.integer('actor_admin_id').unsigned().nullable();
    table.string('action_type', 60).notNullable();
    table.string('table_name', 80).notNullable();
    table.string('record_id', 80).nullable();
    table.json('payload').nullable();
    table.string('ip_address', 64).nullable();
    table.timestamps(true, true);

    table.foreign('actor_admin_id').references('id').inTable('vms_admins').onDelete('SET NULL');
    table.index(['action_type']);
  });

  await knex('vms_general_settings').insert({
    site_name: 'CNS Foundation Volunteer Management',
    home_title: 'Volunteer Certificate Verification',
    keywords: 'volunteer,certificate,verification,cns foundation',
    description: 'Verify CNS Foundation volunteer certificates and volunteer profile details.',
    timezone: 'Asia/Dhaka',
  });

  await knex('vms_admins').insert({
    username: 'vmsadmin',
    email: 'vms-admin@example.com',
    password_hash: '$2b$12$kSvVVtDyhDzBrk7LOIXOueVMizAEQzTFqgeUaZ3G9vesLKPcu4eUa',
    role: 'admin',
    status: 1,
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vms_audit_logs');
  await knex.schema.dropTableIfExists('vms_general_settings');
  await knex.schema.dropTableIfExists('vms_certificates');
  await knex.schema.dropTableIfExists('vms_volunteers');
  await knex.schema.dropTableIfExists('vms_admins');
}
