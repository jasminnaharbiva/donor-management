# Volunteer Management System (VMS) Add-on — Master Implementation Plan

## 1) Objective

Build a **new Volunteer Management System module** that is functionally equivalent to the legacy `previous_vms.md` system, while using the **current software stack** already used in this repository.

This new VMS must:
- Provide the same volunteer + certificate verification workflows as the old system.
- Run in parallel with the current donor-management system.
- Use separate ports for local/runtime isolation.
- Avoid breaking or removing any existing features.

---

## 2) Non-Destructive Integration Rules

1. Existing donor-management backend/frontend remain untouched in behavior.
2. New VMS code is added as an isolated module namespace.
3. New VMS database objects use dedicated table names/prefixes.
4. No route collisions with existing `/api/v1/*` business APIs.
5. Rollout will be feature-flagged to allow safe enable/disable.

---

## 3) Target Stack (Aligned to Current Software)

### Backend
- Node.js + Express + TypeScript
- Knex.js (MySQL driver)
- JWT/session-compatible auth middleware patterns already used in this repo
- Existing logging, error handling, validation patterns

### Frontend
- React + TypeScript + Vite
- Existing UI patterns/components used by current app
- Existing API client/interceptor behavior

### Database
- MySQL/MariaDB (same engine family used by current software)
- Same server/credentials style as existing environment
- New dedicated VMS tables in same database (safe prefix strategy)

### Infrastructure
- PM2-managed process (same operational style)
- Reverse proxy integration identical to current deployment model

### Language Policy (Code + UI)
- **Programming language parity with current software**: TypeScript for backend and frontend
- **No PHP/CodeIgniter code for the new module** (legacy behavior recreated in modern stack)
- **Product locale support**: English-first with Bangla-ready labels/content using existing translation approach

---

## 4) Port & Runtime Isolation Plan

To keep this module separate from the existing running app:

- **Existing backend**: keep as-is (currently production backend port remains unchanged)
- **New VMS backend port**: `3012`
- **New VMS frontend dev port**: `3011`

Production options:
1. Route by subpath (recommended):
   - API: `/api/v1/vms/*` proxied to backend `3012`
   - UI: `/vms/*` proxied to frontend/static build
2. Route by subdomain:
   - `vms.<domain>` for UI
   - `vms-api.<domain>` for API

---

## 5) Functional Parity Scope (Must Match Legacy System)

## 5.1 Public Side
1. Certificate verification landing page
2. Search by unique certificate ID
3. Certificate found view with volunteer details:
   - Full name
   - Father name
   - Mother name
   - Date of birth
   - Blood group
   - Mobile
   - NID/Birth certificate number
   - Gender
   - Division / District / Upazila
   - Volunteer profile image
   - Certificate image
   - Verification status
4. Certificate not found page
5. 404 behavior for unknown routes

## 5.2 Admin Side
1. Admin authentication (login/logout)
2. Dashboard counters:
   - Volunteer count
   - Certificate count
3. Volunteer CRUD:
   - Add / Edit / List / Delete
   - Status toggle active/inactive
   - Profile image upload
4. Certificate CRUD:
   - Add / Edit / List / Delete
   - Unique certificate ID
   - Verified/unverified status
   - Certificate image upload
5. General settings:
   - Site name, home title, meta keywords/description
   - reCAPTCHA keys
   - Timezone
   - Logo upload
6. Admin change password

## 5.3 Security/Validation Parity
1. Input validation on all forms
2. Secure password hashing (`bcrypt`)
3. CSRF protection equivalent
4. Upload restrictions (jpg/jpeg/png only)
5. SQL injection prevention (Knex parameterized queries)
6. XSS-safe rendering and sanitization

---

## 6) New Module Architecture in This Repository

## 6.1 Backend Structure Proposal

```txt
src/
  modules/
    vms/
      controllers/
        vms-public.controller.ts
        vms-auth.controller.ts
        vms-admin-dashboard.controller.ts
        vms-admin-volunteers.controller.ts
        vms-admin-certificates.controller.ts
        vms-admin-settings.controller.ts
      services/
        vms-auth.service.ts
        vms-volunteer.service.ts
        vms-certificate.service.ts
        vms-settings.service.ts
        vms-upload.service.ts
      repositories/
        vms-admin.repository.ts
        vms-volunteer.repository.ts
        vms-certificate.repository.ts
        vms-settings.repository.ts
      middleware/
        vms-auth.middleware.ts
        vms-csrf.middleware.ts
        vms-upload.middleware.ts
      validators/
        vms-auth.validators.ts
        vms-volunteer.validators.ts
        vms-certificate.validators.ts
        vms-settings.validators.ts
      routes/
        vms-public.routes.ts
        vms-auth.routes.ts
        vms-admin.routes.ts
```

## 6.2 Frontend Structure Proposal

```txt
frontend/src/
  modules/
    vms/
      pages/
        VmsHomePage.tsx
        VmsCertificateResultPage.tsx
        VmsCertificateNotFoundPage.tsx
        VmsAdminLoginPage.tsx
        VmsAdminDashboardPage.tsx
        VmsVolunteerListPage.tsx
        VmsVolunteerFormPage.tsx
        VmsCertificateListPage.tsx
        VmsCertificateFormPage.tsx
        VmsSettingsPage.tsx
        VmsChangePasswordPage.tsx
      components/
        VmsLayout.tsx
        VmsNavbar.tsx
        VmsSidebar.tsx
        VmsDataTable.tsx
        VmsStatusBadge.tsx
        VmsImageUploader.tsx
      services/
        vmsApi.ts
      types/
        vms.ts
      utils/
        vmsFormatters.ts
```

## 6.3 Route Namespace

- Public API: `/api/v1/vms/public/*`
- Auth API: `/api/v1/vms/auth/*`
- Admin API: `/api/v1/vms/admin/*`
- Public UI: `/vms`
- Admin UI: `/vms/admin`

---

## 7) Database Plan (MySQL, Isolated Tables)

Use same DB server, add dedicated VMS tables (no overwrite of existing tables):

1. `vms_admins`
   - `id`, `username`, `email`, `password_hash`, `role`, `status`, timestamps

2. `vms_volunteers`
   - `id`, `full_name`, `father_name`, `mother_name`, `date_of_birth`, `blood_group`, `mobile_number`,
   - `nid_or_birth_certificate`, `gender`, `division`, `district`, `upazila`,
   - `status`, `picture_path`, timestamps

3. `vms_certificates`
   - `id`, `certificate_id` (unique), `volunteer_id` (FK), `issue_date`,
   - `status`, `image_path`, timestamps

4. `vms_general_settings`
   - `id` (single-row pattern), `site_name`, `home_title`, `keywords`, `description`,
   - `recaptcha_site_key`, `recaptcha_secret_key`, `logo_path`, `timezone`, timestamps

5. `vms_sessions` (if DB-backed session strategy is selected)

### Relationship Rules
- One volunteer can have at most one active certificate (enforced by unique index on `volunteer_id` if required by business rules).
- `vms_certificates.volunteer_id` references `vms_volunteers.id`.

---

## 8) File Storage Plan

New dedicated storage directories (no overlap with existing uploads):

- `uploads/vms/volunteers/`
- `uploads/vms/certificates/`
- `uploads/vms/logo/`

Controls:
- MIME allow-list: `image/jpeg`, `image/png`
- Size limit per file (e.g., 2MB default)
- Randomized filename strategy
- Safe deletion during record removal/replacement

---

## 9) API Contract Plan (Feature Complete)

## 9.1 Public
- `POST /api/v1/vms/public/verify-certificate`
- `GET /api/v1/vms/public/certificate/:certificateId`

## 9.2 Auth
- `POST /api/v1/vms/auth/login`
- `POST /api/v1/vms/auth/logout`
- `GET /api/v1/vms/auth/me`
- `POST /api/v1/vms/auth/change-password`

## 9.3 Admin Volunteers
- `GET /api/v1/vms/admin/volunteers`
- `POST /api/v1/vms/admin/volunteers`
- `GET /api/v1/vms/admin/volunteers/:id`
- `PUT /api/v1/vms/admin/volunteers/:id`
- `DELETE /api/v1/vms/admin/volunteers/:id`
- `PATCH /api/v1/vms/admin/volunteers/:id/status`

## 9.4 Admin Certificates
- `GET /api/v1/vms/admin/certificates`
- `POST /api/v1/vms/admin/certificates`
- `GET /api/v1/vms/admin/certificates/:id`
- `PUT /api/v1/vms/admin/certificates/:id`
- `DELETE /api/v1/vms/admin/certificates/:id`
- `PATCH /api/v1/vms/admin/certificates/:id/status`

## 9.5 Settings + Dashboard
- `GET /api/v1/vms/admin/dashboard/stats`
- `GET /api/v1/vms/admin/settings`
- `PUT /api/v1/vms/admin/settings`
- `POST /api/v1/vms/admin/settings/logo`

---

## 10) UI/UX Parity Plan

Preserve legacy flow while using modern current-stack implementation:

1. Public verification page first
2. Certificate result page with all identity fields
3. Certificate-not-found page
4. Admin login page
5. Admin dashboard with quick stats
6. Volunteers DataTable (search/sort/pagination)
7. Certificates DataTable (search/sort/pagination)
8. Add/Edit forms with inline validation
9. Settings and password pages
10. Success/error feedback via current app notification pattern

Theme direction:
- Keep CNS-style green emphasis for VMS branding compatibility.
- Use current design tokens/components where possible.

---

## 11) Security & Compliance Checklist

1. Bcrypt hashing for all VMS admin passwords
2. CSRF token validation for mutating endpoints
3. XSS protection in rendered fields and server-side sanitization
4. Strict validation for all form/API inputs
5. Upload hardening (type, extension, size, filename, storage path)
6. Rate limiting on login and verification endpoints
7. Audit log table for admin actions (create/update/delete/status/password)
8. Optional IP/device metadata capture for admin login history

---

## 12) Implementation Phases

## Phase 0 — Foundation
- Create module scaffolding and route namespaces
- Add env config for VMS ports and paths
- Add empty feature-flag gate for VMS module

## Phase 1 — Database + Migrations
- Create `vms_*` migrations
- Add seed data for default settings and initial admin
- Add indices and constraints

## Phase 2 — Backend Core
- Public verify APIs
- Admin auth APIs
- Volunteer CRUD APIs
- Certificate CRUD APIs
- Settings + dashboard APIs

## Phase 3 — Frontend VMS
- Public pages (verify / result / not-found)
- Admin login + dashboard
- Volunteers + certificates list/forms
- Settings + change password

## Phase 4 — Hardening
- Validation tightening
- Rate limiting
- CSRF integration
- Upload security checks
- Audit logging

## Phase 5 — QA/UAT
- Functional parity test cases (legacy checklist)
- Cross-role manual testing
- Regression testing to ensure donor-management is unaffected

## Phase 6 — Deployment
- Build + deploy VMS backend/frontend
- Configure reverse proxy routes
- Smoke test and production sign-off

---

## 13) Testing Plan (Must Pass Before Go-Live)

## 13.1 Backend Tests
- API contract tests (all endpoints)
- Validation tests (invalid payloads)
- Auth/permission tests
- Upload tests
- SQL integrity tests (FK, uniqueness)

## 13.2 Frontend Tests
- Public verification flow
- Admin login flow
- CRUD form behavior
- Not-found and validation states

## 13.3 Integration Tests
- End-to-end certificate issue + verify scenario
- Delete volunteer/certificate with file cleanup
- Settings update reflected on public page

## 13.4 Regression Safety
- Existing `/api/v1/*` donor-management routes must remain unchanged
- Existing frontend dashboards must remain unchanged

---

## 14) Rollback & Safety Plan

1. Deploy behind feature flag first
2. Keep existing app as primary path
3. If issue occurs:
   - disable VMS route flag
   - keep DB tables (no destructive rollback)
   - investigate and patch

---

## 15) Deliverables

1. New VMS backend module (isolated namespace)
2. New VMS frontend module/pages
3. SQL migrations + seeds for `vms_*` tables
4. Upload directory structure for VMS assets
5. Environment and PM2 configuration for new ports
6. QA checklist proving legacy parity + no regression
7. Deployment runbook

---

## 16) Final Acceptance Criteria

This plan is accepted only when:
1. All legacy VMS features from `previous_vms.md` are available in the new module.
2. New module runs with separate ports (`3012` backend, `3011` frontend dev) without conflict.
3. Existing donor-management functionality remains intact.
4. Security and validation controls are implemented.
5. Public certificate verification and full admin operations pass QA.

---

## 17) Suggested Next Execution Order

1. Approve this plan
2. Generate migration files for `vms_*` tables
3. Scaffold backend VMS routes/controllers/services
4. Scaffold frontend VMS pages/components
5. Implement API + UI feature parity in iterative milestones
6. Perform parity QA and deploy behind feature flag
