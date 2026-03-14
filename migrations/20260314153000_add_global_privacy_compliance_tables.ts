import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('dfb_data_subject_requests'))) {
    await knex.schema.createTable('dfb_data_subject_requests', (table) => {
      table.increments('request_id').unsigned().primary();
      table.specificType('user_id', 'char(36)').notNullable().index();
      table.enu('subject_type', ['donor', 'volunteer', 'beneficiary', 'staff', 'unknown']).notNullable().defaultTo('unknown');
      table.enu('request_type', [
        'access',
        'portability',
        'erasure',
        'rectification',
        'restriction',
        'objection',
        'opt_out_marketing',
        'opt_out_sale',
      ]).notNullable();
      table.enu('status', ['pending', 'in_progress', 'completed', 'rejected']).notNullable().defaultTo('pending');
      table.text('details_json', 'longtext').nullable();
      table.text('resolution_notes').nullable();
      table.string('resolved_by', 36).nullable();
      table.dateTime('resolved_at').nullable();
      table.string('request_ip', 64).nullable();
      table.string('request_user_agent', 255).nullable();
      table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
      table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());

      table.index(['user_id', 'status']);
      table.index(['request_type', 'status']);
      table.index(['created_at']);
    });
  }

  if (!(await knex.schema.hasTable('dfb_consent_events'))) {
    await knex.schema.createTable('dfb_consent_events', (table) => {
      table.increments('consent_event_id').unsigned().primary();
      table.specificType('user_id', 'char(36)').notNullable().index();
      table.string('consent_type', 100).notNullable().index();
      table.enu('status', ['granted', 'withdrawn']).notNullable().defaultTo('granted');
      table.enu('lawful_basis', [
        'consent',
        'contract',
        'legal_obligation',
        'vital_interest',
        'public_task',
        'legitimate_interest',
      ]).notNullable().defaultTo('consent');
      table.string('channel', 40).nullable();
      table.string('subject_email_hash', 128).nullable().index();
      table.text('evidence_json', 'longtext').nullable();
      table.string('captured_ip', 64).nullable();
      table.string('captured_user_agent', 255).nullable();
      table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());

      table.index(['user_id', 'consent_type', 'status']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('dfb_consent_events')) {
    await knex.schema.dropTable('dfb_consent_events');
  }

  if (await knex.schema.hasTable('dfb_data_subject_requests')) {
    await knex.schema.dropTable('dfb_data_subject_requests');
  }
}
