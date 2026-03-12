-- =============================================================================
-- DFB Real-Time Donor & Donation Management System
-- Complete MySQL Schema — All Tables (Phase 1-5)
-- Database: donor_management | Engine: InnoDB | Charset: utf8mb4
-- =============================================================================

USE donor_management;

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';

-- =============================================================================
-- SECTION 1: RBAC & CONFIGURATION TABLES (created first — referenced by others)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_roles` (
  `role_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `role_name`     VARCHAR(60)     NOT NULL,
  `description`   TEXT,
  `is_system_role` BOOLEAN        NOT NULL DEFAULT FALSE,
  `created_by`    INT UNSIGNED,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_permissions` (
  `permission_id` INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `role_id`       INT UNSIGNED,
  `user_id`       CHAR(36),
  `resource`      VARCHAR(60)     NOT NULL,
  `action`        ENUM('view','create','update','delete','approve','reject','export','impersonate') NOT NULL,
  `conditions`    JSON,
  PRIMARY KEY (`permission_id`),
  KEY `idx_perm_role` (`role_id`, `resource`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_users` (
  `user_id`                  CHAR(36)        NOT NULL,
  `email`                    VARCHAR(255)    NOT NULL COMMENT 'AES-256 encrypted at rest',
  `password_hash`            VARCHAR(255)    NOT NULL COMMENT 'bcrypt 12 rounds',
  `role_id`                  INT UNSIGNED,
  `donor_id`                 INT UNSIGNED,
  `volunteer_id`             INT UNSIGNED,
  `status`                   ENUM('active','pending','suspended','deleted') NOT NULL DEFAULT 'pending',
  `email_verified_at`        DATETIME,
  `two_fa_secret`            VARCHAR(64)     COMMENT 'TOTP base32 secret, AES-256 encrypted',
  `two_fa_enabled`           BOOLEAN         NOT NULL DEFAULT FALSE,
  `two_fa_method`            ENUM('totp','sms'),
  `password_reset_token`     VARCHAR(64)     COMMENT 'SHA-256 hashed',
  `password_reset_expires_at` DATETIME,
  `refresh_token_hash`       VARCHAR(64),
  `last_login_at`            DATETIME,
  `last_login_ip`            VARCHAR(45),
  `failed_login_attempts`    INT             NOT NULL DEFAULT 0,
  `locked_until`             DATETIME,
  `created_at`               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`               DATETIME        COMMENT 'Soft delete',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_user_email` (`email`),
  KEY `idx_user_role` (`role_id`),
  KEY `idx_user_status` (`status`),
  KEY `idx_user_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_system_settings` (
  `setting_id`    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(100)    NOT NULL COMMENT 'dot-namespaced e.g. payment.min_amount',
  `setting_value` TEXT,
  `value_type`    ENUM('string','integer','decimal','boolean','json','color','url','encrypted') NOT NULL DEFAULT 'string',
  `category`      ENUM('general','payment','email','security','ui','integration','limits','legal') NOT NULL DEFAULT 'general',
  `is_public`     BOOLEAN         NOT NULL DEFAULT FALSE,
  `description`   TEXT,
  `updated_by`    CHAR(36),
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `uq_setting_key` (`setting_key`),
  KEY `idx_setting_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_feature_flags` (
  `flag_id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `flag_name`         VARCHAR(60)     NOT NULL,
  `is_enabled`        BOOLEAN         NOT NULL DEFAULT FALSE,
  `enabled_for_roles` JSON            COMMENT 'NULL means all roles',
  `description`       TEXT,
  `updated_by`        CHAR(36),
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`flag_id`),
  UNIQUE KEY `uq_flag_name` (`flag_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_custom_fields` (
  `field_id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `entity_type`           ENUM('donor','expense','campaign','volunteer','beneficiary') NOT NULL,
  `field_name`            VARCHAR(60)     NOT NULL,
  `field_label`           VARCHAR(120)    NOT NULL,
  `field_type`            ENUM('text','textarea','number','date','boolean','select','multi_select','file','phone','url') NOT NULL,
  `options`               JSON,
  `is_required`           BOOLEAN         NOT NULL DEFAULT FALSE,
  `is_visible_to_donor`   BOOLEAN         NOT NULL DEFAULT FALSE,
  `is_visible_to_volunteer` BOOLEAN       NOT NULL DEFAULT FALSE,
  `display_order`         INT             NOT NULL DEFAULT 0,
  `validation_regex`      VARCHAR(255),
  `created_by`            CHAR(36),
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_custom_field_values` (
  `value_id`   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `field_id`   INT UNSIGNED  NOT NULL,
  `entity_id`  VARCHAR(40)   NOT NULL,
  `value_text` TEXT,
  `value_json` JSON,
  PRIMARY KEY (`value_id`),
  KEY `idx_cfv_field_entity` (`field_id`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_form_schemas` (
  `schema_id`   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `form_type`   ENUM('donation','registration','expense','campaign','beneficiary_intake','volunteer_application') NOT NULL,
  `schema_json` JSON          NOT NULL,
  `is_active`   BOOLEAN       NOT NULL DEFAULT FALSE,
  `created_by`  CHAR(36),
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`schema_id`),
  KEY `idx_form_type_active` (`form_type`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_email_templates` (
  `template_id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `template_slug`       VARCHAR(60)   NOT NULL,
  `locale`              VARCHAR(10)   NOT NULL DEFAULT 'en',
  `subject_template`    VARCHAR(255)  NOT NULL,
  `html_body`           LONGTEXT      NOT NULL,
  `available_variables` JSON,
  `is_active`           BOOLEAN       NOT NULL DEFAULT TRUE,
  `updated_by`          CHAR(36),
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`),
  UNIQUE KEY `uq_template_slug_locale` (`template_slug`, `locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_translations` (
  `translation_id` INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `locale`         VARCHAR(10)   NOT NULL,
  `namespace`      VARCHAR(40)   NOT NULL,
  `key`            VARCHAR(100)  NOT NULL,
  `value`          TEXT          NOT NULL,
  `updated_by`     CHAR(36),
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`translation_id`),
  UNIQUE KEY `uq_trans_locale_ns_key` (`locale`, `namespace`, `key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_dashboard_layouts` (
  `layout_id`   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `role_id`     INT UNSIGNED  NOT NULL,
  `widget_type` ENUM('donation_counter','fund_balance','live_feed','expense_queue','donor_map','variance_chart','volunteer_status','queue_health','alert_banner','custom_iframe') NOT NULL,
  `position_x`  INT           NOT NULL DEFAULT 0,
  `position_y`  INT           NOT NULL DEFAULT 0,
  `width`       INT           NOT NULL DEFAULT 4,
  `height`      INT           NOT NULL DEFAULT 2,
  `config_json` JSON,
  `is_visible`  BOOLEAN       NOT NULL DEFAULT TRUE,
  `updated_by`  CHAR(36),
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`layout_id`),
  KEY `idx_layout_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 2: CORE FINANCIAL TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_donors` (
  `donor_id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `first_name`              VARCHAR(80)     NOT NULL,
  `last_name`               VARCHAR(80)     NOT NULL,
  `email`                   VARBINARY(512)  NOT NULL COMMENT 'AES_ENCRYPT(email, key)',
  `phone`                   VARBINARY(512)  COMMENT 'AES_ENCRYPT(phone, key)',
  `national_id_hash`        CHAR(64)        COMMENT 'SHA-256 of NID — never stored plain',
  `lifetime_value`          DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `last_donation_date`      DATE,
  `donor_type`              ENUM('Individual','Corporate','Anonymous') NOT NULL DEFAULT 'Individual',
  `wealth_screening_consent` BOOLEAN        NOT NULL DEFAULT FALSE COMMENT 'MUST be TRUE before AI profiling',
  `engagement_score`        INT             NOT NULL DEFAULT 0,
  `created_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`              DATETIME        COMMENT 'Soft delete / GDPR erasure',
  PRIMARY KEY (`donor_id`),
  KEY `idx_donor_type` (`donor_type`),
  KEY `idx_donor_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_funds` (
  `fund_id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `fund_name`        VARCHAR(120)    NOT NULL,
  `fund_category`    ENUM('Zakat','Sadaqah','Waqf','General','Restricted','Emergency') NOT NULL DEFAULT 'General',
  `target_goal`      DECIMAL(15,2)   DEFAULT 0.00,
  `current_balance`  DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `is_restricted`    BOOLEAN         NOT NULL DEFAULT FALSE,
  `restriction_note` VARCHAR(500),
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fund_id`),
  KEY `idx_fund_category` (`fund_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Integrity hash table (referenced by financial records)
CREATE TABLE IF NOT EXISTS `dfb_integrity_hashes` (
  `hash_id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `record_type`          ENUM('transaction','allocation','expense') NOT NULL,
  `record_id`            CHAR(36)        NOT NULL,
  `hash_input_payload`   JSON            NOT NULL,
  `sha256_hash`          CHAR(64)        NOT NULL,
  `previous_hash_id`     INT UNSIGNED    COMMENT 'FK to self — blockchain-style chain',
  `created_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`hash_id`),
  KEY `idx_ih_record` (`record_type`, `record_id`),
  KEY `idx_ih_hash` (`sha256_hash`),
  CONSTRAINT `fk_ih_previous` FOREIGN KEY (`previous_hash_id`) REFERENCES `dfb_integrity_hashes` (`hash_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TRIGGER: Prevent any UPDATE or DELETE on integrity_hashes (APPEND-ONLY)
DROP TRIGGER IF EXISTS `trg_integrity_hashes_no_update`;
CREATE TRIGGER `trg_integrity_hashes_no_update`
BEFORE UPDATE ON `dfb_integrity_hashes`
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'dfb_integrity_hashes is APPEND-ONLY: UPDATE not permitted';

DROP TRIGGER IF EXISTS `trg_integrity_hashes_no_delete`;
CREATE TRIGGER `trg_integrity_hashes_no_delete`
BEFORE DELETE ON `dfb_integrity_hashes`
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'dfb_integrity_hashes is APPEND-ONLY: DELETE not permitted';

CREATE TABLE IF NOT EXISTS `dfb_transactions` (
  `transaction_id`          CHAR(36)        NOT NULL COMMENT 'UUID',
  `donor_id`                INT UNSIGNED,
  `amount`                  DECIMAL(15,2)   NOT NULL,
  `currency`                VARCHAR(3)      NOT NULL DEFAULT 'BDT' COMMENT 'ISO 4217',
  `currency_type`           ENUM('fiat','crypto') NOT NULL DEFAULT 'fiat',
  `crypto_asset`            VARCHAR(10)     COMMENT 'BTC/ETH/USDC; NULL for fiat',
  `wallet_address`          VARCHAR(100),
  `gas_fee`                 DECIMAL(15,8),
  `fiat_equivalent_at_time` DECIMAL(15,2),
  `payment_method`          ENUM('card','paypal','bkash','sslcommerz','nagad','rocket','apple_pay','google_pay','crypto','bank_transfer','cash','check','in_kind','daf') NOT NULL,
  `gateway_txn_id`          VARCHAR(255),
  `gateway_fee`             DECIMAL(15,4)   DEFAULT 0.0000,
  `net_amount`              DECIMAL(15,2)   NOT NULL,
  `status`                  ENUM('Pending','Completed','Failed','Refunded','Chargeback','Flagged') NOT NULL DEFAULT 'Pending',
  `ipn_timestamp`           DATETIME,
  `settled_at`              DATETIME,
  `integrity_hash_id`       INT UNSIGNED,
  `created_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  KEY `idx_txn_donor` (`donor_id`),
  KEY `idx_txn_status` (`status`),
  KEY `idx_txn_created` (`created_at`),
  KEY `idx_txn_gateway` (`gateway_txn_id`),
  CONSTRAINT `fk_txn_donor` FOREIGN KEY (`donor_id`) REFERENCES `dfb_donors` (`donor_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_txn_integrity` FOREIGN KEY (`integrity_hash_id`) REFERENCES `dfb_integrity_hashes` (`hash_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_allocations` (
  `allocation_id`   INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `transaction_id`  CHAR(36)        NOT NULL,
  `fund_id`         INT UNSIGNED    NOT NULL,
  `allocated_amount` DECIMAL(15,2)  NOT NULL,
  `allocated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'CRITICAL for FIFO ordering',
  `is_spent`        BOOLEAN         NOT NULL DEFAULT FALSE,
  `expense_id`      CHAR(36)        COMMENT 'FK to dfb_expenses — set when consumed',
  `integrity_hash_id` INT UNSIGNED,
  PRIMARY KEY (`allocation_id`),
  -- Compound index enabling O(log n) FIFO queries
  KEY `idx_alloc_fifo` (`fund_id`, `allocated_at`, `is_spent`),
  KEY `idx_alloc_transaction` (`transaction_id`),
  CONSTRAINT `fk_alloc_transaction` FOREIGN KEY (`transaction_id`) REFERENCES `dfb_transactions` (`transaction_id`),
  CONSTRAINT `fk_alloc_fund` FOREIGN KEY (`fund_id`) REFERENCES `dfb_funds` (`fund_id`),
  CONSTRAINT `fk_alloc_integrity` FOREIGN KEY (`integrity_hash_id`) REFERENCES `dfb_integrity_hashes` (`hash_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_expenses` (
  `expense_id`              CHAR(36)        NOT NULL COMMENT 'UUID',
  `fund_id`                 INT UNSIGNED    NOT NULL,
  `project_id`              INT UNSIGNED,
  `amount_spent`            DECIMAL(15,2)   NOT NULL,
  `vendor_name`             VARCHAR(120),
  `purpose`                 TEXT,
  `receipt_url`             VARCHAR(500),
  `gps_lat`                 DECIMAL(10,8)   COMMENT 'Volunteer GPS at submission',
  `gps_lon`                 DECIMAL(11,8),
  `spent_timestamp`         DATETIME,
  `submitted_by_volunteer_id` INT UNSIGNED,
  `approved_by`             CHAR(36)        COMMENT 'Admin User ID',
  `approved_at`             DATETIME,
  `proof_of_execution_urls` JSON            COMMENT 'Array of media URLs',
  `status`                  ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  `integrity_hash_id`       INT UNSIGNED,
  `created_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`              DATETIME        COMMENT 'Soft delete',
  PRIMARY KEY (`expense_id`),
  KEY `idx_expense_fund` (`fund_id`),
  KEY `idx_expense_project` (`project_id`),
  KEY `idx_expense_status` (`status`),
  KEY `idx_expense_volunteer` (`submitted_by_volunteer_id`),
  CONSTRAINT `fk_expense_fund` FOREIGN KEY (`fund_id`) REFERENCES `dfb_funds` (`fund_id`),
  CONSTRAINT `fk_expense_project` FOREIGN KEY (`project_id`) REFERENCES `dfb_projects` (`project_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expense_integrity` FOREIGN KEY (`integrity_hash_id`) REFERENCES `dfb_integrity_hashes` (`hash_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link allocation to expense (set after FIFO consumption)
ALTER TABLE `dfb_allocations`
  ADD CONSTRAINT `fk_alloc_expense` FOREIGN KEY (`expense_id`) REFERENCES `dfb_expenses` (`expense_id`) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS `dfb_donation_queue` (
  `queue_id`        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `gateway_source`  ENUM('stripe','paypal','bkash','sslcommerz','crypto','nagad','rocket') NOT NULL,
  `gateway_payload` JSON            NOT NULL COMMENT 'Raw unparsed webhook body',
  `hmac_signature`  TEXT            COMMENT 'Raw gateway signature header for deferred verification',
  `status`          ENUM('Pending','Processing','Processed','Failed') NOT NULL DEFAULT 'Pending',
  `retry_count`     INT             NOT NULL DEFAULT 0,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at`    DATETIME,
  PRIMARY KEY (`queue_id`),
  KEY `idx_queue_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 3: AUDIT TABLE (APPEND-ONLY)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_audit_logs` (
  `log_id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `table_affected` VARCHAR(60),
  `record_id`     VARCHAR(40),
  `action_type`   ENUM('INSERT','UPDATE','DELETE','LOGIN','EXPORT','APPROVE','REJECT','REFUND','GDPR_ERASE','LOGOUT','2FA_ENABLE','IMPERSONATE') NOT NULL,
  `old_payload`   JSON,
  `new_payload`   JSON,
  `actor_id`      CHAR(36),
  `actor_role`    VARCHAR(60),
  `ip_address`    VARCHAR(45),
  `user_agent`    TEXT,
  `timestamp`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_table` (`table_affected`, `record_id`),
  KEY `idx_audit_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TRIGGER: Prevent UPDATE/DELETE on audit_logs (APPEND-ONLY)
DROP TRIGGER IF EXISTS `trg_audit_logs_no_update`;
CREATE TRIGGER `trg_audit_logs_no_update`
BEFORE UPDATE ON `dfb_audit_logs`
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'dfb_audit_logs is APPEND-ONLY: UPDATE not permitted';

DROP TRIGGER IF EXISTS `trg_audit_logs_no_delete`;
CREATE TRIGGER `trg_audit_logs_no_delete`
BEFORE DELETE ON `dfb_audit_logs`
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'dfb_audit_logs is APPEND-ONLY: DELETE not permitted';

-- =============================================================================
-- SECTION 4: CAMPAIGN & PROJECT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_campaigns` (
  `campaign_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `fund_id`           INT UNSIGNED,
  `title`             VARCHAR(200)    NOT NULL,
  `slug`              VARCHAR(120)    NOT NULL,
  `description`       LONGTEXT,
  `cover_image_url`   VARCHAR(500),
  `goal_amount`       DECIMAL(15,2)   DEFAULT 0.00,
  `raised_amount`     DECIMAL(15,2)   NOT NULL DEFAULT 0.00 COMMENT 'Denormalized for O(1) reads',
  `donor_count`       INT             NOT NULL DEFAULT 0 COMMENT 'Denormalized',
  `start_date`        DATE,
  `end_date`          DATE,
  `status`            ENUM('draft','active','paused','completed','archived') NOT NULL DEFAULT 'draft',
  `is_public`         BOOLEAN         NOT NULL DEFAULT FALSE,
  `allow_anonymous`   BOOLEAN         NOT NULL DEFAULT TRUE,
  `default_amounts`   JSON            COMMENT 'e.g. [500, 1000, 2500, 5000]',
  `video_url`         VARCHAR(500),
  `meta_title`        VARCHAR(70),
  `meta_description`  VARCHAR(160),
  `og_image_url`      VARCHAR(255),
  `created_by`        CHAR(36),
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`campaign_id`),
  UNIQUE KEY `uq_campaign_slug` (`slug`),
  KEY `idx_campaign_status` (`status`, `is_public`),
  CONSTRAINT `fk_campaign_fund` FOREIGN KEY (`fund_id`) REFERENCES `dfb_funds` (`fund_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_projects` (
  `project_id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `campaign_id`             INT UNSIGNED,
  `fund_id`                 INT UNSIGNED    NOT NULL,
  `project_name`            VARCHAR(200)    NOT NULL,
  `description`             TEXT,
  `budget_allocated`        DECIMAL(15,2)   DEFAULT 0.00,
  `budget_spent`            DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `budget_remaining`        DECIMAL(15,2)   GENERATED ALWAYS AS (`budget_allocated` - `budget_spent`) STORED,
  `location_country`        VARCHAR(60),
  `location_city`           VARCHAR(60),
  `start_date`              DATE,
  `target_completion_date`  DATE,
  `actual_completion_date`  DATE,
  `status`                  ENUM('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
  `created_by`              CHAR(36),
  `created_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`),
  CONSTRAINT `fk_project_fund` FOREIGN KEY (`fund_id`) REFERENCES `dfb_funds` (`fund_id`),
  CONSTRAINT `fk_project_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `dfb_campaigns` (`campaign_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_p2p_campaigns` (
  `p2p_id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `parent_campaign_id`  INT UNSIGNED    NOT NULL,
  `creator_user_id`     CHAR(36)        NOT NULL,
  `title`               VARCHAR(200)    NOT NULL,
  `slug`                VARCHAR(120)    NOT NULL,
  `personal_story`      LONGTEXT,
  `cover_image_url`     VARCHAR(500),
  `goal_amount`         DECIMAL(15,2)   DEFAULT 0.00,
  `raised_amount`       DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `status`              ENUM('draft','active','completed','rejected') NOT NULL DEFAULT 'draft',
  `approved_by`         CHAR(36),
  `approved_at`         DATETIME,
  `end_date`            DATE,
  `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`p2p_id`),
  UNIQUE KEY `uq_p2p_slug` (`slug`),
  CONSTRAINT `fk_p2p_campaign` FOREIGN KEY (`parent_campaign_id`) REFERENCES `dfb_campaigns` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 5: VOLUNTEER MANAGEMENT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_volunteers` (
  `volunteer_id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`                 CHAR(36),
  `first_name`              VARCHAR(80)     NOT NULL,
  `last_name`               VARCHAR(80)     NOT NULL,
  `phone`                   VARBINARY(512)  COMMENT 'AES-256 encrypted',
  `national_id_hash`        CHAR(64),
  `address`                 TEXT,
  `city`                    VARCHAR(80),
  `country`                 VARCHAR(60)     DEFAULT 'Bangladesh',
  `profile_photo_url`       VARCHAR(500),
  `id_document_url`         VARCHAR(500)    COMMENT 'AES-256 encrypted storage path — KYC',
  `background_check_status` ENUM('not_submitted','pending','cleared','failed') NOT NULL DEFAULT 'not_submitted',
  `badge_number`            VARCHAR(20)     COMMENT 'e.g. VLN-2026-00042',
  `badge_qr_url`            VARCHAR(500),
  `spending_limit_default`  DECIMAL(15,2)   DEFAULT 0.00,
  `status`                  ENUM('pending_approval','active','suspended','retired') NOT NULL DEFAULT 'pending_approval',
  `approved_by`             CHAR(36),
  `approved_at`             DATETIME,
  `created_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`volunteer_id`),
  UNIQUE KEY `uq_badge_number` (`badge_number`),
  KEY `idx_volunteer_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_volunteer_applications` (
  `application_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `applicant_name`       VARCHAR(160)    NOT NULL,
  `applicant_email`      VARCHAR(255)    NOT NULL,
  `father_name`          VARCHAR(160),
  `date_of_birth`        DATE,
  `blood_group`          VARCHAR(10),
  `education_level`      VARCHAR(100),
  `phone`                VARBINARY(512),
  `mobile_number`        VARCHAR(20),
  `national_id_hash`     CHAR(64),
  `nid_or_birth_certificate_no` VARCHAR(120),
  `address`              TEXT,
  `full_address`         TEXT,
  `division`             VARCHAR(80),
  `district`             VARCHAR(80),
  `upazila`              VARCHAR(80),
  `city`                 VARCHAR(80),
  `country`              VARCHAR(60),
  `passport_photo_url`   VARCHAR(500),
  `identity_document_url` VARCHAR(500),
  `motivation_statement` LONGTEXT,
  `skills`               JSON,
  `availability`         JSON,
  `reference_name`       VARCHAR(160),
  `reference_phone`      VARBINARY(512),
  `emergency_contact_name`  VARCHAR(160),
  `emergency_contact_phone` VARBINARY(512),
  `document_urls`        JSON,
  `consent_given`        BOOLEAN         NOT NULL DEFAULT FALSE,
  `consent_text`         TEXT,
  `consent_given_at`     DATETIME,
  `form_payload`         JSON,
  `status`               ENUM('pending','under_review','approved','rejected','waitlisted') NOT NULL DEFAULT 'pending',
  `review_notes`         TEXT,
  `reviewed_by`          CHAR(36),
  `reviewed_at`          DATETIME,
  `user_id_created`      CHAR(36),
  `submitted_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`application_id`),
  KEY `idx_va_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_project_assignments` (
  `assignment_id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `volunteer_id`            INT UNSIGNED    NOT NULL,
  `project_id`              INT UNSIGNED    NOT NULL,
  `spending_limit_override` DECIMAL(15,2),
  `assigned_by`             CHAR(36),
  `assigned_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`                  ENUM('active','completed','removed') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`assignment_id`),
  KEY `idx_pa_volunteer` (`volunteer_id`),
  KEY `idx_pa_project` (`project_id`),
  CONSTRAINT `fk_pa_volunteer` FOREIGN KEY (`volunteer_id`) REFERENCES `dfb_volunteers` (`volunteer_id`),
  CONSTRAINT `fk_pa_project` FOREIGN KEY (`project_id`) REFERENCES `dfb_projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_project_progress_logs` (
  `log_id`               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `project_id`           INT UNSIGNED    NOT NULL,
  `update_type`          ENUM('field_update','milestone','issue','note') NOT NULL DEFAULT 'field_update',
  `update_title`         VARCHAR(160)    NOT NULL,
  `update_body`          TEXT,
  `progress_percent`     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `status_snapshot`      ENUM('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
  `logged_by`            CHAR(36),
  `happened_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_pp_log_project` (`project_id`),
  KEY `idx_pp_log_happened` (`happened_at`),
  CONSTRAINT `fk_pp_log_project` FOREIGN KEY (`project_id`) REFERENCES `dfb_projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_expense_approval_steps` (
  `step_id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `expense_id`       CHAR(36)        NOT NULL,
  `step_number`      INT             NOT NULL,
  `required_role_id` INT UNSIGNED,
  `approver_user_id` CHAR(36),
  `action`           ENUM('pending','approved','rejected','info_requested') NOT NULL DEFAULT 'pending',
  `notes`            TEXT,
  `acted_at`         DATETIME,
  `notified_at`      DATETIME,
  PRIMARY KEY (`step_id`),
  KEY `idx_eas_expense` (`expense_id`),
  CONSTRAINT `fk_eas_expense` FOREIGN KEY (`expense_id`) REFERENCES `dfb_expenses` (`expense_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_shifts` (
  `shift_id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `project_id`        INT UNSIGNED,
  `campaign_id`       INT UNSIGNED,
  `shift_title`       VARCHAR(120)    NOT NULL,
  `description`       TEXT,
  `location_name`     VARCHAR(120),
  `location_lat`      DECIMAL(10,7),
  `location_lng`      DECIMAL(10,7),
  `start_datetime`    DATETIME        NOT NULL,
  `end_datetime`      DATETIME        NOT NULL,
  `max_volunteers`    INT             DEFAULT 0,
  `signed_up_count`   INT             NOT NULL DEFAULT 0,
  `skills_required`   JSON,
  `status`            ENUM('open','full','completed','cancelled') NOT NULL DEFAULT 'open',
  `created_by`        CHAR(36),
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`shift_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_shift_signups` (
  `signup_id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `shift_id`               INT UNSIGNED    NOT NULL,
  `volunteer_id`           INT UNSIGNED    NOT NULL,
  `status`                 ENUM('confirmed','waitlisted','cancelled','attended','no_show') NOT NULL DEFAULT 'confirmed',
  `signed_up_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reminder_sent_24h`      BOOLEAN         NOT NULL DEFAULT FALSE,
  `reminder_sent_1h`       BOOLEAN         NOT NULL DEFAULT FALSE,
  `attendance_marked_by`   CHAR(36),
  `attendance_marked_at`   DATETIME,
  PRIMARY KEY (`signup_id`),
  UNIQUE KEY `uq_shift_volunteer` (`shift_id`, `volunteer_id`),
  CONSTRAINT `fk_ss_shift` FOREIGN KEY (`shift_id`) REFERENCES `dfb_shifts` (`shift_id`),
  CONSTRAINT `fk_ss_volunteer` FOREIGN KEY (`volunteer_id`) REFERENCES `dfb_volunteers` (`volunteer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_timesheets` (
  `timesheet_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `volunteer_id`       INT UNSIGNED    NOT NULL,
  `project_id`         INT UNSIGNED,
  `shift_id`           INT UNSIGNED,
  `activity_description` TEXT,
  `start_datetime`     DATETIME        NOT NULL,
  `end_datetime`       DATETIME        NOT NULL,
  `duration_minutes`   INT             GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, `start_datetime`, `end_datetime`)) STORED,
  `status`             ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_notes`        TEXT,
  `reviewed_by`        CHAR(36),
  `reviewed_at`        DATETIME,
  `submitted_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`timesheet_id`),
  CONSTRAINT `fk_ts_volunteer` FOREIGN KEY (`volunteer_id`) REFERENCES `dfb_volunteers` (`volunteer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_id_card_templates` (
  `template_id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `template_name`          VARCHAR(80)     NOT NULL,
  `orientation`            ENUM('horizontal','vertical') NOT NULL DEFAULT 'horizontal',
  `background_color`       VARCHAR(7)      DEFAULT '#ffffff',
  `accent_color`           VARCHAR(7)      DEFAULT '#2563eb',
  `text_color`             VARCHAR(7)      DEFAULT '#111827',
  `org_logo_url`           VARCHAR(500),
  `org_name`               VARCHAR(120),
  `tagline`                VARCHAR(80),
  `show_photo`             BOOLEAN         NOT NULL DEFAULT TRUE,
  `show_badge_number`      BOOLEAN         NOT NULL DEFAULT TRUE,
  `show_designation`       BOOLEAN         NOT NULL DEFAULT TRUE,
  `show_project_name`      BOOLEAN         NOT NULL DEFAULT FALSE,
  `show_validity_date`     BOOLEAN         NOT NULL DEFAULT TRUE,
  `show_qr_code`           BOOLEAN         NOT NULL DEFAULT TRUE,
  `qr_base_url`            VARCHAR(255),
  `validity_duration_months` INT           DEFAULT 12,
  `admin_signature_url`    VARCHAR(500),
  `admin_signature_name`   VARCHAR(80),
  `admin_signature_title`  VARCHAR(80),
  `footer_text`            VARCHAR(255),
  `font_family`            VARCHAR(60)     DEFAULT 'Inter, sans-serif',
  `is_active`              BOOLEAN         NOT NULL DEFAULT FALSE,
  `created_by`             CHAR(36),
  `created_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_volunteer_id_cards` (
  `card_id`         CHAR(36)        NOT NULL COMMENT 'UUID',
  `volunteer_id`    INT UNSIGNED    NOT NULL,
  `template_id`     INT UNSIGNED    NOT NULL,
  `badge_number`    VARCHAR(20),
  `issue_date`      DATE            NOT NULL,
  `expiry_date`     DATE,
  `status`          ENUM('active','expired','revoked') NOT NULL DEFAULT 'active',
  `revoked_reason`  TEXT,
  `revoked_by`      CHAR(36),
  `revoked_at`      DATETIME,
  `pdf_url`         VARCHAR(500),
  `generated_at`    DATETIME,
  `generated_by`    CHAR(36),
  PRIMARY KEY (`card_id`),
  CONSTRAINT `fk_vic_volunteer` FOREIGN KEY (`volunteer_id`) REFERENCES `dfb_volunteers` (`volunteer_id`),
  CONSTRAINT `fk_vic_template` FOREIGN KEY (`template_id`) REFERENCES `dfb_id_card_templates` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_certificate_templates` (
  `cert_template_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `template_name`          VARCHAR(80)     NOT NULL,
  `title_text`             VARCHAR(120)    NOT NULL,
  `body_template`          LONGTEXT        NOT NULL,
  `background_image_url`   VARCHAR(500),
  `org_logo_url`           VARCHAR(500),
  `primary_color`          VARCHAR(7),
  `admin_signature_1_url`  VARCHAR(500),
  `admin_signature_1_name` VARCHAR(80),
  `admin_signature_1_title` VARCHAR(80),
  `admin_signature_2_url`  VARCHAR(500),
  `admin_signature_2_name` VARCHAR(80),
  `admin_signature_2_title` VARCHAR(80),
  `is_active`              BOOLEAN         NOT NULL DEFAULT FALSE,
  `created_by`             CHAR(36),
  `created_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cert_template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_certificate_awards` (
  `award_id`          CHAR(36)        NOT NULL COMMENT 'UUID',
  `cert_template_id`  INT UNSIGNED    NOT NULL,
  `volunteer_id`      INT UNSIGNED    NOT NULL,
  `project_id`        INT UNSIGNED,
  `custom_note`       TEXT,
  `hours_served`      INT,
  `service_start_date` DATE,
  `service_end_date`  DATE,
  `issue_date`        DATE            NOT NULL,
  `verification_code` VARCHAR(16)     NOT NULL COMMENT 'Unique alphanumeric for public verification',
  `pdf_url`           VARCHAR(500),
  `issued_by`         CHAR(36),
  `issued_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`award_id`),
  UNIQUE KEY `uq_cert_verification` (`verification_code`),
  CONSTRAINT `fk_ca_template` FOREIGN KEY (`cert_template_id`) REFERENCES `dfb_certificate_templates` (`cert_template_id`),
  CONSTRAINT `fk_ca_volunteer` FOREIGN KEY (`volunteer_id`) REFERENCES `dfb_volunteers` (`volunteer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_volunteer_messages` (
  `message_id`            CHAR(36)        NOT NULL COMMENT 'UUID',
  `sender_user_id`        CHAR(36)        NOT NULL,
  `recipient_volunteer_id` INT UNSIGNED   NOT NULL,
  `subject`               VARCHAR(150)    NOT NULL,
  `body`                  TEXT            NOT NULL,
  `channel`               ENUM('in_app','email','both') NOT NULL DEFAULT 'in_app',
  `is_read`               BOOLEAN         NOT NULL DEFAULT FALSE,
  `read_at`               DATETIME,
  `sent_at`               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `parent_message_id`     CHAR(36)        COMMENT 'Self-reference for threading',
  PRIMARY KEY (`message_id`),
  KEY `idx_vm_recipient` (`recipient_volunteer_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 6: DONOR ENGAGEMENT & GIVING TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_pledges` (
  `pledge_id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `donor_id`              INT UNSIGNED    NOT NULL,
  `campaign_id`           INT UNSIGNED,
  `fund_id`               INT UNSIGNED,
  `total_pledge_amount`   DECIMAL(15,2)   NOT NULL,
  `amount_fulfilled`      DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `installment_count`     INT             NOT NULL,
  `installments_paid`     INT             NOT NULL DEFAULT 0,
  `frequency`             ENUM('one_time','monthly','quarterly','annually') NOT NULL,
  `start_date`            DATE,
  `end_date`              DATE,
  `status`                ENUM('active','completed','defaulted','cancelled') NOT NULL DEFAULT 'active',
  `reminder_sent_at`      DATETIME,
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pledge_id`),
  CONSTRAINT `fk_pledge_donor` FOREIGN KEY (`donor_id`) REFERENCES `dfb_donors` (`donor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_recurring_subscriptions` (
  `subscription_id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `donor_id`                INT UNSIGNED    NOT NULL,
  `fund_id`                 INT UNSIGNED,
  `campaign_id`             INT UNSIGNED,
  `amount`                  DECIMAL(15,2)   NOT NULL,
  `currency`                VARCHAR(3)      NOT NULL DEFAULT 'BDT',
  `frequency`               ENUM('weekly','monthly','quarterly','annually') NOT NULL,
  `gateway`                 ENUM('stripe','paypal') NOT NULL,
  `gateway_subscription_id` VARCHAR(120),
  `status`                  ENUM('active','paused','past_due','cancelled') NOT NULL DEFAULT 'active',
  `next_billing_date`       DATE,
  `failure_count`           INT             NOT NULL DEFAULT 0,
  `cancelled_at`            DATETIME,
  `created_at`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`subscription_id`),
  CONSTRAINT `fk_rs_donor` FOREIGN KEY (`donor_id`) REFERENCES `dfb_donors` (`donor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_badges` (
  `badge_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `badge_name`     VARCHAR(80)     NOT NULL,
  `description`    TEXT,
  `icon_url`       VARCHAR(500),
  `criteria_type`  ENUM('donation_count','donation_amount_lifetime','first_donation','campaign_funded','streak_months','p2p_raised','referral_count') NOT NULL,
  `criteria_value` DECIMAL(15,2)   NOT NULL,
  `is_active`      BOOLEAN         NOT NULL DEFAULT TRUE,
  `created_by`     CHAR(36),
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`badge_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_user_badges` (
  `award_id`   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`    CHAR(36)      NOT NULL,
  `badge_id`   INT UNSIGNED  NOT NULL,
  `awarded_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`award_id`),
  UNIQUE KEY `uq_user_badge` (`user_id`, `badge_id`),
  CONSTRAINT `fk_ub_badge` FOREIGN KEY (`badge_id`) REFERENCES `dfb_badges` (`badge_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 7: NOTIFICATIONS, MEDIA, BENEFICIARIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_notifications` (
  `notification_id` CHAR(36)        NOT NULL COMMENT 'UUID',
  `user_id`         CHAR(36)        NOT NULL,
  `type`            ENUM('donation_received','expense_approved','expense_rejected','fund_low','milestone_reached','expense_submitted','assignment_created','system_alert','announcement') NOT NULL,
  `title`           VARCHAR(120)    NOT NULL,
  `body`            TEXT,
  `action_url`      VARCHAR(255),
  `channel`         ENUM('in_app','email','sms','all') NOT NULL DEFAULT 'in_app',
  `is_read`         BOOLEAN         NOT NULL DEFAULT FALSE,
  `read_at`         DATETIME,
  `sent_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_type`  VARCHAR(40),
  `reference_id`    VARCHAR(40),
  PRIMARY KEY (`notification_id`),
  KEY `idx_notif_user_unread` (`user_id`, `is_read`, `sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_media` (
  `media_id`          CHAR(36)        NOT NULL COMMENT 'UUID',
  `uploader_user_id`  CHAR(36),
  `file_name`         VARCHAR(255)    NOT NULL,
  `file_path`         VARCHAR(500)    NOT NULL,
  `mime_type`         VARCHAR(80)     NOT NULL,
  `file_size_bytes`   BIGINT          NOT NULL,
  `purpose`           ENUM('receipt','proof_of_execution','kyc_document','campaign_cover','logo','email_asset','other') NOT NULL DEFAULT 'other',
  `reference_type`    VARCHAR(40),
  `reference_id`      VARCHAR(40),
  `is_public`         BOOLEAN         NOT NULL DEFAULT FALSE,
  `cdn_url`           VARCHAR(500),
  `storage_provider`  ENUM('local','s3','backblaze_b2') NOT NULL DEFAULT 'local',
  `virus_scan_status` ENUM('pending','clean','infected') NOT NULL DEFAULT 'pending',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`media_id`),
  KEY `idx_media_reference` (`reference_type`, `reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_beneficiaries` (
  `beneficiary_id`      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `full_name`           VARCHAR(160)    NOT NULL,
  `national_id_hash`    CHAR(64),
  `phone`               VARBINARY(512),
  `address`             TEXT,
  `city`                VARCHAR(80),
  `welfare_category`    ENUM('food','shelter','medical','education','cash_aid','other') NOT NULL,
  `status`              ENUM('active','completed','ineligible') NOT NULL DEFAULT 'active',
  `intake_date`         DATE,
  `documents_url`       JSON,
  `assigned_volunteer_id` INT UNSIGNED,
  `case_notes`          LONGTEXT,
  `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`beneficiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_announcements` (
  `announcement_id`  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `title`            VARCHAR(120)    NOT NULL,
  `body`             TEXT,
  `type`             ENUM('info','warning','success','urgent') NOT NULL DEFAULT 'info',
  `target_audience`  ENUM('public','donors','volunteers','admins','all') NOT NULL DEFAULT 'all',
  `display_locations` JSON,
  `is_dismissible`   BOOLEAN         NOT NULL DEFAULT TRUE,
  `show_from`        DATETIME,
  `show_until`       DATETIME,
  `is_active`        BOOLEAN         NOT NULL DEFAULT TRUE,
  `created_by`       CHAR(36),
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`announcement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 8: SEO & PUBLIC PAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_public_pages` (
  `page_id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `page_slug`        VARCHAR(80)     NOT NULL,
  `page_title`       VARCHAR(120)    NOT NULL,
  `meta_title`       VARCHAR(70),
  `meta_description` VARCHAR(160),
  `og_image_url`     VARCHAR(255),
  `sections_json`    JSON,
  `is_published`     BOOLEAN         NOT NULL DEFAULT FALSE,
  `is_indexed`       BOOLEAN         NOT NULL DEFAULT TRUE,
  `custom_css`       TEXT,
  `updated_by`       CHAR(36),
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`page_id`),
  UNIQUE KEY `uq_page_slug` (`page_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dfb_seo_settings` (
  `seo_id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `entity_type`           ENUM('global','public_page','campaign','p2p_campaign','fund','project','volunteer_verify','certificate_verify','donation_form','donor_portal','volunteer_portal','login','register','zakat_calculator','error_404','error_403','sitemap','custom') NOT NULL DEFAULT 'global',
  `entity_id`             VARCHAR(40)     COMMENT 'UUID/INT of linked record; NULL for global',
  `meta_title`            VARCHAR(70),
  `meta_description`      VARCHAR(160),
  `meta_keywords`         VARCHAR(255),
  `canonical_url`         VARCHAR(500),
  `og_title`              VARCHAR(70),
  `og_description`        VARCHAR(200),
  `og_image_url`          VARCHAR(500),
  `og_type`               ENUM('website','article','profile') NOT NULL DEFAULT 'website',
  `twitter_card_type`     ENUM('summary','summary_large_image') NOT NULL DEFAULT 'summary_large_image',
  `twitter_site_handle`   VARCHAR(60),
  `twitter_creator_handle` VARCHAR(60),
  `robots_directive`      ENUM('index_follow','index_nofollow','noindex_follow','noindex_nofollow') NOT NULL DEFAULT 'index_follow',
  `structured_data_json`  JSON,
  `structured_data_auto`  BOOLEAN         NOT NULL DEFAULT TRUE,
  `hreflang_json`         JSON,
  `updated_by`            CHAR(36),
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`seo_id`),
  UNIQUE KEY `uq_seo_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 9: API KEYS
-- =============================================================================

CREATE TABLE IF NOT EXISTS `dfb_api_keys` (
  `key_id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `key_name`       VARCHAR(80)     NOT NULL,
  `key_hash`       CHAR(64)        NOT NULL COMMENT 'SHA-256 hash — never stored plain',
  `key_prefix`     VARCHAR(8)      NOT NULL COMMENT 'First 8 chars for display',
  `role_id`        INT UNSIGNED,
  `granted_to`     CHAR(36)        COMMENT 'User who owns this key',
  `ip_allowlist`   JSON            COMMENT 'CIDR notation array',
  `rate_limit_override` INT,
  `expires_at`     DATETIME,
  `last_used_at`   DATETIME,
  `total_requests` BIGINT          NOT NULL DEFAULT 0,
  `is_active`      BOOLEAN         NOT NULL DEFAULT TRUE,
  `created_by`     CHAR(36),
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at`     DATETIME,
  PRIMARY KEY (`key_id`),
  UNIQUE KEY `uq_key_hash` (`key_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SECTION 10: SEED DATA — DEFAULT ROLES, SETTINGS, PAGES, FEATURE FLAGS
-- =============================================================================

-- Default system roles
INSERT IGNORE INTO `dfb_roles` (`role_id`, `role_name`, `description`, `is_system_role`) VALUES
(1, 'Super Admin',  'Full system access — all resources and actions', TRUE),
(2, 'Admin',        'Operational admin — manage donors, expenses, volunteers, campaigns', TRUE),
(3, 'Finance',      'Finance team — view/approve expenses, generate reports', TRUE),
(4, 'Volunteer',    'Field volunteer — submit expenses, view own assignments', TRUE),
(5, 'Donor',        'Registered donor — view own impact dashboard', TRUE),
(6, 'Viewer',       'Read-only access to reports and dashboards', TRUE);

-- Default funds
INSERT IGNORE INTO `dfb_funds` (`fund_name`, `fund_category`, `is_restricted`, `restriction_note`) VALUES
('General Fund',           'General',   FALSE, NULL),
('Zakat Fund',             'Zakat',     TRUE,  'Restricted to Zakat-eligible beneficiaries per Islamic jurisprudence'),
('Sadaqah Fund',           'Sadaqah',   FALSE, NULL),
('Emergency Relief Fund',  'Emergency', FALSE, NULL),
('IT Infrastructure Fund', 'Restricted',TRUE,  'Restricted to technology and infrastructure expenses only');

-- Default feature flags
INSERT IGNORE INTO `dfb_feature_flags` (`flag_name`, `is_enabled`, `description`) VALUES
('feature.bkash_payments',        TRUE,  'bKash payment gateway'),
('feature.sslcommerz_payments',   TRUE,  'SSLCommerz payment gateway'),
('feature.crypto_payments',       FALSE, 'Coinbase Commerce crypto donations'),
('feature.apple_google_pay',      TRUE,  'Apple Pay / Google Pay (via Stripe)'),
('feature.donor_registration',    TRUE,  'New donor self-registration'),
('feature.donor_portal',          TRUE,  'Donor impact dashboard and login'),
('feature.volunteer_portal',      TRUE,  'Volunteer dashboard and expense submission'),
('feature.peer_to_peer',          FALSE, 'P2P supporter fundraising sub-pages'),
('feature.gamification',          FALSE, 'Donor badge system and leaderboards'),
('feature.ai_wealth_screening',   FALSE, 'AI donor profiling (requires opt-in consent)'),
('feature.qr_vendor_payments',    FALSE, 'QR code direct vendor payment links'),
('feature.public_impact_dashboard',TRUE, 'Public /impact transparency page'),
('feature.corporate_matching',    FALSE, 'Double the Donation API integration'),
('feature.offline_pwa',           TRUE,  'Service worker and IndexedDB offline mode'),
('feature.blockchain_verification',TRUE, 'Public SHA-256 hash verification page'),
('feature.maintenance_mode',      FALSE, 'Returns HTTP 503 for all donor-facing endpoints');

-- Default system settings
INSERT IGNORE INTO `dfb_system_settings` (`setting_key`, `setting_value`, `value_type`, `category`, `is_public`, `description`) VALUES
('payment.min_amount',          '10',           'integer',  'limits',   FALSE, 'Minimum donation amount in base currency'),
('payment.max_amount',          '500000',       'integer',  'limits',   FALSE, 'Maximum single donation amount'),
('payment.accepted_currencies', '["BDT","USD","GBP"]', 'json', 'payment', TRUE, 'Currencies shown on donation form'),
('security.velocity_limit_cards','10',          'integer',  'security', FALSE, 'Max card attempts per IP per 5 min'),
('security.max_login_attempts', '5',            'integer',  'security', FALSE, 'Failed logins before account lockout'),
('security.lockout_duration_minutes','30',      'integer',  'security', FALSE, 'Lockout duration in minutes'),
('security.access_token_ttl_minutes','60',      'integer',  'security', FALSE, 'JWT access token lifetime'),
('security.refresh_token_ttl_days','30',        'integer',  'security', FALSE, 'JWT refresh token lifetime'),
('ui.org_name',                 'Donation Management System', 'string', 'ui', TRUE, 'Organization name'),
('ui.primary_color',            '#2563eb',      'color',    'ui',       TRUE,  'Primary brand color'),
('ui.secondary_color',          '#7c3aed',      'color',    'ui',       TRUE,  'Secondary accent color'),
('ui.background_color',         '#f9fafb',      'color',    'ui',       TRUE,  'Page background color'),
('ui.surface_color',            '#ffffff',      'color',    'ui',       TRUE,  'Card surface color'),
('ui.text_primary_color',       '#111827',      'color',    'ui',       TRUE,  'Primary text color'),
('ui.text_secondary_color',     '#6b7280',      'color',    'ui',       TRUE,  'Secondary/muted text color'),
('ui.success_color',            '#16a34a',      'color',    'ui',       TRUE,  'Success state color'),
('ui.warning_color',            '#d97706',      'color',    'ui',       TRUE,  'Warning state color'),
('ui.danger_color',             '#dc2626',      'color',    'ui',       TRUE,  'Danger/error color'),
('ui.button_border_radius',     '8px',          'string',   'ui',       TRUE,  'Button border radius'),
('ui.font_family_body',         "'Inter', sans-serif", 'string', 'ui',  TRUE,  'Body font family'),
('ui.dark_mode_enabled',        'false',        'boolean',  'ui',       TRUE,  'Enable dark mode'),
('ui.default_locale',           'en',           'string',   'ui',       TRUE,  'Default UI language'),
('email.from_name',             'Donor Management',   'string', 'email', FALSE, 'Outbound email sender name'),
('email.from_address',          'noreply@donor-management.nokshaojibon.com', 'string', 'email', FALSE, 'Outbound email from address'),
('legal.receipt_footer',        'This receipt is issued by Donor Management System. Tax ID applies per local regulations.', 'string', 'legal', FALSE, 'Receipt legal footer'),
('legal.gdpr_consent_text',     'We process your data to manage donations per our Privacy Policy. You may request deletion at any time.', 'string', 'legal', TRUE, 'GDPR consent text'),
('legal.volunteer_application_consent_text', 'I consent to data processing for volunteer application and verification.', 'string', 'legal', TRUE, 'Volunteer application consent text'),
('general.app_version',         '1.0.0',        'string',   'general',  FALSE, 'Current application version');

-- Default public impact page
INSERT IGNORE INTO `dfb_public_pages` (`page_slug`, `page_title`, `meta_title`, `meta_description`, `is_published`, `sections_json`) VALUES
('impact', 'Live Impact Dashboard', 'Real-Time Impact - Donor Management', 'See exactly where every donated dollar goes in real time.', TRUE,
 JSON_ARRAY(
   JSON_OBJECT('type','hero','headline','Transparent. Accountable. Real-Time.','subheadline','Every donation tracked from receipt to impact.'),
   JSON_OBJECT('type','stats_counter','stats',JSON_ARRAY('total_donations','total_donors','active_projects','active_volunteers')),
   JSON_OBJECT('type','campaign_grid','columns',3,'show_thermometer',true),
   JSON_OBJECT('type','live_ledger_ticker','scroll_speed','normal','anonymize','initials')
 )
);

-- Default global SEO
INSERT IGNORE INTO `dfb_seo_settings` (`entity_type`, `meta_title`, `meta_description`, `og_type`, `structured_data_auto`) VALUES
('global', 'Donor Management System', 'Real-time transparent donor and donation management with full fund traceability.', 'website', TRUE);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 
  COUNT(*) AS total_tables,
  'Schema created successfully — all tables, triggers, seeds installed.' AS status
FROM information_schema.tables 
WHERE table_schema = 'donor_management';
