import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('dfb_id_card_templates')) {
    const hasLayoutJson = await knex.schema.hasColumn('dfb_id_card_templates', 'layout_json');
    const hasDynamicFields = await knex.schema.hasColumn('dfb_id_card_templates', 'dynamic_fields_json');
    const hasTextBlocks = await knex.schema.hasColumn('dfb_id_card_templates', 'text_blocks_json');
    const hasLogoPos = await knex.schema.hasColumn('dfb_id_card_templates', 'logo_position_json');
    const hasSignaturePos = await knex.schema.hasColumn('dfb_id_card_templates', 'signature_position_json');

    await knex.schema.alterTable('dfb_id_card_templates', (table) => {
      if (!hasLayoutJson) table.text('layout_json', 'longtext').nullable();
      if (!hasDynamicFields) table.text('dynamic_fields_json', 'longtext').nullable();
      if (!hasTextBlocks) table.text('text_blocks_json', 'longtext').nullable();
      if (!hasLogoPos) table.text('logo_position_json', 'longtext').nullable();
      if (!hasSignaturePos) table.text('signature_position_json', 'longtext').nullable();
    });
  }

  if (await knex.schema.hasTable('dfb_volunteer_id_cards')) {
    const hasQrValue = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'qr_code_value');
    const hasQrData = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'qr_code_data_url');
    const hasTemplateSnapshot = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'template_snapshot_json');
    const hasRenderPayload = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'render_payload_json');
    const hasRenderedHtml = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'rendered_html');

    await knex.schema.alterTable('dfb_volunteer_id_cards', (table) => {
      if (!hasQrValue) table.string('qr_code_value', 255).nullable();
      if (!hasQrData) table.text('qr_code_data_url', 'longtext').nullable();
      if (!hasTemplateSnapshot) table.text('template_snapshot_json', 'longtext').nullable();
      if (!hasRenderPayload) table.text('render_payload_json', 'longtext').nullable();
      if (!hasRenderedHtml) table.text('rendered_html', 'longtext').nullable();
    });
  }

  if (await knex.schema.hasTable('dfb_certificate_templates')) {
    const hasLayoutJson = await knex.schema.hasColumn('dfb_certificate_templates', 'layout_json');
    const hasDynamicFields = await knex.schema.hasColumn('dfb_certificate_templates', 'dynamic_fields_json');
    const hasTextBlocks = await knex.schema.hasColumn('dfb_certificate_templates', 'text_blocks_json');

    await knex.schema.alterTable('dfb_certificate_templates', (table) => {
      if (!hasLayoutJson) table.text('layout_json', 'longtext').nullable();
      if (!hasDynamicFields) table.text('dynamic_fields_json', 'longtext').nullable();
      if (!hasTextBlocks) table.text('text_blocks_json', 'longtext').nullable();
    });
  }

  if (await knex.schema.hasTable('dfb_certificate_awards')) {
    const hasQrValue = await knex.schema.hasColumn('dfb_certificate_awards', 'qr_code_value');
    const hasQrData = await knex.schema.hasColumn('dfb_certificate_awards', 'qr_code_data_url');
    const hasTemplateSnapshot = await knex.schema.hasColumn('dfb_certificate_awards', 'template_snapshot_json');
    const hasRenderPayload = await knex.schema.hasColumn('dfb_certificate_awards', 'render_payload_json');
    const hasRenderedHtml = await knex.schema.hasColumn('dfb_certificate_awards', 'rendered_html');

    await knex.schema.alterTable('dfb_certificate_awards', (table) => {
      if (!hasQrValue) table.string('qr_code_value', 255).nullable();
      if (!hasQrData) table.text('qr_code_data_url', 'longtext').nullable();
      if (!hasTemplateSnapshot) table.text('template_snapshot_json', 'longtext').nullable();
      if (!hasRenderPayload) table.text('render_payload_json', 'longtext').nullable();
      if (!hasRenderedHtml) table.text('rendered_html', 'longtext').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('dfb_certificate_awards')) {
    const hasQrValue = await knex.schema.hasColumn('dfb_certificate_awards', 'qr_code_value');
    const hasQrData = await knex.schema.hasColumn('dfb_certificate_awards', 'qr_code_data_url');
    const hasTemplateSnapshot = await knex.schema.hasColumn('dfb_certificate_awards', 'template_snapshot_json');
    const hasRenderPayload = await knex.schema.hasColumn('dfb_certificate_awards', 'render_payload_json');
    const hasRenderedHtml = await knex.schema.hasColumn('dfb_certificate_awards', 'rendered_html');

    await knex.schema.alterTable('dfb_certificate_awards', (table) => {
      if (hasQrValue) table.dropColumn('qr_code_value');
      if (hasQrData) table.dropColumn('qr_code_data_url');
      if (hasTemplateSnapshot) table.dropColumn('template_snapshot_json');
      if (hasRenderPayload) table.dropColumn('render_payload_json');
      if (hasRenderedHtml) table.dropColumn('rendered_html');
    });
  }

  if (await knex.schema.hasTable('dfb_certificate_templates')) {
    const hasLayoutJson = await knex.schema.hasColumn('dfb_certificate_templates', 'layout_json');
    const hasDynamicFields = await knex.schema.hasColumn('dfb_certificate_templates', 'dynamic_fields_json');
    const hasTextBlocks = await knex.schema.hasColumn('dfb_certificate_templates', 'text_blocks_json');

    await knex.schema.alterTable('dfb_certificate_templates', (table) => {
      if (hasLayoutJson) table.dropColumn('layout_json');
      if (hasDynamicFields) table.dropColumn('dynamic_fields_json');
      if (hasTextBlocks) table.dropColumn('text_blocks_json');
    });
  }

  if (await knex.schema.hasTable('dfb_volunteer_id_cards')) {
    const hasQrValue = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'qr_code_value');
    const hasQrData = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'qr_code_data_url');
    const hasTemplateSnapshot = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'template_snapshot_json');
    const hasRenderPayload = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'render_payload_json');
    const hasRenderedHtml = await knex.schema.hasColumn('dfb_volunteer_id_cards', 'rendered_html');

    await knex.schema.alterTable('dfb_volunteer_id_cards', (table) => {
      if (hasQrValue) table.dropColumn('qr_code_value');
      if (hasQrData) table.dropColumn('qr_code_data_url');
      if (hasTemplateSnapshot) table.dropColumn('template_snapshot_json');
      if (hasRenderPayload) table.dropColumn('render_payload_json');
      if (hasRenderedHtml) table.dropColumn('rendered_html');
    });
  }

  if (await knex.schema.hasTable('dfb_id_card_templates')) {
    const hasLayoutJson = await knex.schema.hasColumn('dfb_id_card_templates', 'layout_json');
    const hasDynamicFields = await knex.schema.hasColumn('dfb_id_card_templates', 'dynamic_fields_json');
    const hasTextBlocks = await knex.schema.hasColumn('dfb_id_card_templates', 'text_blocks_json');
    const hasLogoPos = await knex.schema.hasColumn('dfb_id_card_templates', 'logo_position_json');
    const hasSignaturePos = await knex.schema.hasColumn('dfb_id_card_templates', 'signature_position_json');

    await knex.schema.alterTable('dfb_id_card_templates', (table) => {
      if (hasLayoutJson) table.dropColumn('layout_json');
      if (hasDynamicFields) table.dropColumn('dynamic_fields_json');
      if (hasTextBlocks) table.dropColumn('text_blocks_json');
      if (hasLogoPos) table.dropColumn('logo_position_json');
      if (hasSignaturePos) table.dropColumn('signature_position_json');
    });
  }
}
