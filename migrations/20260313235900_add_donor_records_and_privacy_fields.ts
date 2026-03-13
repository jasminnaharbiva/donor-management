import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('dfb_donors')) {
    const hasCountry = await knex.schema.hasColumn('dfb_donors', 'country');
    const hasProfession = await knex.schema.hasColumn('dfb_donors', 'profession');

    await knex.schema.alterTable('dfb_donors', (table) => {
      if (!hasCountry) table.string('country', 60).nullable();
      if (!hasProfession) table.string('profession', 100).nullable();
    });
  }

  if (!(await knex.schema.hasTable('dfb_donor_id_card_templates'))) {
    await knex.schema.createTable('dfb_donor_id_card_templates', (table) => {
      table.increments('template_id').unsigned().primary();
      table.string('template_name', 80).notNullable();
      table.enu('orientation', ['horizontal', 'vertical']).notNullable().defaultTo('horizontal');
      table.string('background_color', 7).nullable().defaultTo('#ffffff');
      table.string('accent_color', 7).nullable().defaultTo('#2563eb');
      table.string('text_color', 7).nullable().defaultTo('#111827');
      table.string('org_logo_url', 500).nullable();
      table.string('org_name', 120).nullable();
      table.string('tagline', 80).nullable();
      table.boolean('show_photo').notNullable().defaultTo(true);
      table.boolean('show_donor_id').notNullable().defaultTo(true);
      table.boolean('show_profession').notNullable().defaultTo(true);
      table.boolean('show_country').notNullable().defaultTo(true);
      table.boolean('show_validity_date').notNullable().defaultTo(true);
      table.boolean('show_qr_code').notNullable().defaultTo(true);
      table.string('qr_base_url', 255).nullable();
      table.integer('validity_duration_months').nullable().defaultTo(12);
      table.string('admin_signature_url', 500).nullable();
      table.string('admin_signature_name', 80).nullable();
      table.string('admin_signature_title', 80).nullable();
      table.string('footer_text', 255).nullable();
      table.string('font_family', 60).nullable().defaultTo('Inter, sans-serif');
      table.boolean('is_active').notNullable().defaultTo(false);
      table.string('created_by', 36).nullable();
      table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
      table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
      table.text('layout_json', 'longtext').nullable();
      table.text('dynamic_fields_json', 'longtext').nullable();
      table.text('text_blocks_json', 'longtext').nullable();
      table.text('logo_position_json', 'longtext').nullable();
      table.text('signature_position_json', 'longtext').nullable();
    });
  }

  if (!(await knex.schema.hasTable('dfb_donor_id_cards'))) {
    await knex.schema.createTable('dfb_donor_id_cards', (table) => {
      table.string('card_id', 36).primary();
      table.integer('donor_id').unsigned().notNullable().index();
      table.integer('template_id').unsigned().notNullable().index();
      table.string('donor_ref', 32).nullable();
      table.date('issue_date').notNullable();
      table.date('expiry_date').nullable();
      table.enu('status', ['active', 'expired', 'revoked']).notNullable().defaultTo('active');
      table.text('revoked_reason').nullable();
      table.string('revoked_by', 36).nullable();
      table.dateTime('revoked_at').nullable();
      table.string('pdf_url', 500).nullable();
      table.dateTime('generated_at').nullable();
      table.string('generated_by', 36).nullable();
      table.string('qr_code_value', 255).nullable();
      table.text('qr_code_data_url', 'longtext').nullable();
      table.text('template_snapshot_json', 'longtext').nullable();
      table.text('render_payload_json', 'longtext').nullable();
      table.text('rendered_html', 'longtext').nullable();

      table.foreign('donor_id').references('donor_id').inTable('dfb_donors').onDelete('CASCADE');
      table.foreign('template_id').references('template_id').inTable('dfb_donor_id_card_templates').onDelete('RESTRICT');
    });
  }

  if (!(await knex.schema.hasTable('dfb_donor_certificate_templates'))) {
    await knex.schema.createTable('dfb_donor_certificate_templates', (table) => {
      table.increments('cert_template_id').unsigned().primary();
      table.string('template_name', 80).notNullable();
      table.string('title_text', 120).notNullable();
      table.text('body_template', 'longtext').notNullable();
      table.string('background_image_url', 500).nullable();
      table.string('org_logo_url', 500).nullable();
      table.string('primary_color', 7).nullable();
      table.string('admin_signature_1_url', 500).nullable();
      table.string('admin_signature_1_name', 80).nullable();
      table.string('admin_signature_1_title', 80).nullable();
      table.string('admin_signature_2_url', 500).nullable();
      table.string('admin_signature_2_name', 80).nullable();
      table.string('admin_signature_2_title', 80).nullable();
      table.boolean('is_active').notNullable().defaultTo(false);
      table.string('created_by', 36).nullable();
      table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
      table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
      table.text('layout_json', 'longtext').nullable();
      table.text('dynamic_fields_json', 'longtext').nullable();
      table.text('text_blocks_json', 'longtext').nullable();
    });
  }

  if (!(await knex.schema.hasTable('dfb_donor_certificate_awards'))) {
    await knex.schema.createTable('dfb_donor_certificate_awards', (table) => {
      table.string('award_id', 36).primary();
      table.integer('cert_template_id').unsigned().notNullable().index();
      table.integer('donor_id').unsigned().notNullable().index();
      table.integer('project_id').unsigned().nullable();
      table.text('custom_note').nullable();
      table.integer('impact_units').nullable();
      table.date('issue_date').notNullable();
      table.string('verification_code', 32).notNullable().unique();
      table.string('pdf_url', 500).nullable();
      table.string('issued_by', 36).nullable();
      table.dateTime('issued_at').notNullable().defaultTo(knex.fn.now());
      table.date('expires_at').nullable();
      table.dateTime('revoked_at').nullable();
      table.string('revoked_reason', 500).nullable();
      table.string('verification_url', 255).nullable();
      table.string('certificate_hash', 128).nullable().index();
      table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
      table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
      table.string('qr_code_value', 255).nullable();
      table.text('qr_code_data_url', 'longtext').nullable();
      table.text('template_snapshot_json', 'longtext').nullable();
      table.text('render_payload_json', 'longtext').nullable();
      table.text('rendered_html', 'longtext').nullable();

      table.foreign('cert_template_id').references('cert_template_id').inTable('dfb_donor_certificate_templates').onDelete('RESTRICT');
      table.foreign('donor_id').references('donor_id').inTable('dfb_donors').onDelete('CASCADE');
      table.foreign('project_id').references('project_id').inTable('dfb_projects').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('dfb_donor_messages'))) {
    await knex.schema.createTable('dfb_donor_messages', (table) => {
      table.string('message_id', 36).primary();
      table.string('sender_user_id', 36).notNullable();
      table.integer('recipient_donor_id').unsigned().notNullable().index();
      table.string('subject', 150).notNullable();
      table.text('body').notNullable();
      table.enu('channel', ['in_app', 'email', 'both']).notNullable().defaultTo('in_app');
      table.boolean('is_read').notNullable().defaultTo(false);
      table.dateTime('read_at').nullable();
      table.dateTime('sent_at').notNullable().defaultTo(knex.fn.now());
      table.string('parent_message_id', 36).nullable();

      table.foreign('recipient_donor_id').references('donor_id').inTable('dfb_donors').onDelete('CASCADE');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('dfb_donor_messages')) {
    await knex.schema.dropTable('dfb_donor_messages');
  }

  if (await knex.schema.hasTable('dfb_donor_certificate_awards')) {
    await knex.schema.dropTable('dfb_donor_certificate_awards');
  }

  if (await knex.schema.hasTable('dfb_donor_certificate_templates')) {
    await knex.schema.dropTable('dfb_donor_certificate_templates');
  }

  if (await knex.schema.hasTable('dfb_donor_id_cards')) {
    await knex.schema.dropTable('dfb_donor_id_cards');
  }

  if (await knex.schema.hasTable('dfb_donor_id_card_templates')) {
    await knex.schema.dropTable('dfb_donor_id_card_templates');
  }

  if (await knex.schema.hasTable('dfb_donors')) {
    const hasCountry = await knex.schema.hasColumn('dfb_donors', 'country');
    const hasProfession = await knex.schema.hasColumn('dfb_donors', 'profession');

    await knex.schema.alterTable('dfb_donors', (table) => {
      if (hasCountry) table.dropColumn('country');
      if (hasProfession) table.dropColumn('profession');
    });
  }
}
