import { Knex } from 'knex';

async function hasIndex(knex: Knex, table: string, indexName: string): Promise<boolean> {
  const result: any = await knex.raw(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  return Array.isArray(rows) && rows.length > 0;
}

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('vms_volunteers')) {
    const hasSkills = await knex.schema.hasColumn('vms_volunteers', 'skills_json');
    const hasAvailability = await knex.schema.hasColumn('vms_volunteers', 'availability_notes');
    const hasHoursCompleted = await knex.schema.hasColumn('vms_volunteers', 'hours_completed');

    await knex.schema.alterTable('vms_volunteers', (table) => {
      if (!hasSkills) table.text('skills_json').nullable();
      if (!hasAvailability) table.text('availability_notes').nullable();
      if (!hasHoursCompleted) table.integer('hours_completed').notNullable().defaultTo(0);
    });
  }

  if (await knex.schema.hasTable('vms_certificates')) {
    const hasExpiresAt = await knex.schema.hasColumn('vms_certificates', 'expires_at');
    const hasRevokedAt = await knex.schema.hasColumn('vms_certificates', 'revoked_at');
    const hasRevokedReason = await knex.schema.hasColumn('vms_certificates', 'revoked_reason');
    const hasVerificationUrl = await knex.schema.hasColumn('vms_certificates', 'verification_url');
    const hasCertificateHash = await knex.schema.hasColumn('vms_certificates', 'certificate_hash');

    await knex.schema.alterTable('vms_certificates', (table) => {
      if (!hasExpiresAt) table.date('expires_at').nullable();
      if (!hasRevokedAt) table.timestamp('revoked_at').nullable();
      if (!hasRevokedReason) table.string('revoked_reason', 500).nullable();
      if (!hasVerificationUrl) table.string('verification_url', 255).nullable();
      if (!hasCertificateHash) table.string('certificate_hash', 128).nullable();
    });

    if (!(await hasIndex(knex, 'vms_certificates', 'vms_certificates_volunteer_id_idx'))) {
      await knex.schema.alterTable('vms_certificates', (table) => {
        table.index(['volunteer_id'], 'vms_certificates_volunteer_id_idx');
      });
    }
    if (!(await hasIndex(knex, 'vms_certificates', 'vms_certificates_certificate_hash_idx'))) {
      await knex.schema.alterTable('vms_certificates', (table) => {
        table.index(['certificate_hash'], 'vms_certificates_certificate_hash_idx');
      });
    }
  }

  if (await knex.schema.hasTable('dfb_certificate_awards')) {
    const hasExpiresAt = await knex.schema.hasColumn('dfb_certificate_awards', 'expires_at');
    const hasRevokedAt = await knex.schema.hasColumn('dfb_certificate_awards', 'revoked_at');
    const hasRevokedReason = await knex.schema.hasColumn('dfb_certificate_awards', 'revoked_reason');
    const hasVerificationUrl = await knex.schema.hasColumn('dfb_certificate_awards', 'verification_url');
    const hasCertificateHash = await knex.schema.hasColumn('dfb_certificate_awards', 'certificate_hash');
    const hasCreatedAt = await knex.schema.hasColumn('dfb_certificate_awards', 'created_at');
    const hasUpdatedAt = await knex.schema.hasColumn('dfb_certificate_awards', 'updated_at');

    await knex.schema.alterTable('dfb_certificate_awards', (table) => {
      if (!hasExpiresAt) table.date('expires_at').nullable();
      if (!hasRevokedAt) table.timestamp('revoked_at').nullable();
      if (!hasRevokedReason) table.string('revoked_reason', 500).nullable();
      if (!hasVerificationUrl) table.string('verification_url', 255).nullable();
      if (!hasCertificateHash) table.string('certificate_hash', 128).nullable();
      if (!hasCreatedAt) table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      if (!hasUpdatedAt) table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });

    if (!(await hasIndex(knex, 'dfb_certificate_awards', 'dfb_certificate_awards_verification_code_idx'))) {
      await knex.schema.alterTable('dfb_certificate_awards', (table) => {
        table.index(['verification_code'], 'dfb_certificate_awards_verification_code_idx');
      });
    }
    if (!(await hasIndex(knex, 'dfb_certificate_awards', 'dfb_certificate_awards_certificate_hash_idx'))) {
      await knex.schema.alterTable('dfb_certificate_awards', (table) => {
        table.index(['certificate_hash'], 'dfb_certificate_awards_certificate_hash_idx');
      });
    }
  }

  const hasVerificationLogs = await knex.schema.hasTable('dfb_certificate_verification_logs');
  if (!hasVerificationLogs) {
    await knex.schema.createTable('dfb_certificate_verification_logs', (table) => {
      table.bigIncrements('id').primary();
      table.string('certificate_identifier', 100).notNullable();
      table.enu('source_system', ['vms', 'dfb', 'unknown']).notNullable().defaultTo('unknown');
      table.enu('verification_status', ['verified', 'not_found', 'revoked', 'expired']).notNullable();
      table.string('volunteer_ref', 100).nullable();
      table.string('ip_address', 64).nullable();
      table.string('user_agent', 500).nullable();
      table.timestamp('verified_at').notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index(['certificate_identifier'], 'dfb_cert_verify_identifier_idx');
      table.index(['source_system'], 'dfb_cert_verify_source_idx');
      table.index(['verification_status'], 'dfb_cert_verify_status_idx');
      table.index(['verified_at'], 'dfb_cert_verify_verified_at_idx');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('dfb_certificate_verification_logs')) {
    await knex.schema.dropTable('dfb_certificate_verification_logs');
  }

  if (await knex.schema.hasTable('vms_certificates')) {
    const hasExpiresAt = await knex.schema.hasColumn('vms_certificates', 'expires_at');
    const hasRevokedAt = await knex.schema.hasColumn('vms_certificates', 'revoked_at');
    const hasRevokedReason = await knex.schema.hasColumn('vms_certificates', 'revoked_reason');
    const hasVerificationUrl = await knex.schema.hasColumn('vms_certificates', 'verification_url');
    const hasCertificateHash = await knex.schema.hasColumn('vms_certificates', 'certificate_hash');

    await knex.schema.alterTable('vms_certificates', (table) => {
      if (hasExpiresAt) table.dropColumn('expires_at');
      if (hasRevokedAt) table.dropColumn('revoked_at');
      if (hasRevokedReason) table.dropColumn('revoked_reason');
      if (hasVerificationUrl) table.dropColumn('verification_url');
      if (hasCertificateHash) table.dropColumn('certificate_hash');
    });
  }

  if (await knex.schema.hasTable('vms_volunteers')) {
    const hasSkills = await knex.schema.hasColumn('vms_volunteers', 'skills_json');
    const hasAvailability = await knex.schema.hasColumn('vms_volunteers', 'availability_notes');
    const hasHours = await knex.schema.hasColumn('vms_volunteers', 'hours_completed');

    await knex.schema.alterTable('vms_volunteers', (table) => {
      if (hasSkills) table.dropColumn('skills_json');
      if (hasAvailability) table.dropColumn('availability_notes');
      if (hasHours) table.dropColumn('hours_completed');
    });
  }

  if (await knex.schema.hasTable('dfb_certificate_awards')) {
    const hasExpiresAt = await knex.schema.hasColumn('dfb_certificate_awards', 'expires_at');
    const hasRevokedAt = await knex.schema.hasColumn('dfb_certificate_awards', 'revoked_at');
    const hasRevokedReason = await knex.schema.hasColumn('dfb_certificate_awards', 'revoked_reason');
    const hasVerificationUrl = await knex.schema.hasColumn('dfb_certificate_awards', 'verification_url');
    const hasCertificateHash = await knex.schema.hasColumn('dfb_certificate_awards', 'certificate_hash');

    await knex.schema.alterTable('dfb_certificate_awards', (table) => {
      if (hasExpiresAt) table.dropColumn('expires_at');
      if (hasRevokedAt) table.dropColumn('revoked_at');
      if (hasRevokedReason) table.dropColumn('revoked_reason');
      if (hasVerificationUrl) table.dropColumn('verification_url');
      if (hasCertificateHash) table.dropColumn('certificate_hash');
    });
  }
}
