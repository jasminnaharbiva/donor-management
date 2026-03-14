# VMS Implementation Manifest

This file tracks where the implemented VMS module lives in the current software.

## Release Snapshot
- Date: March 14, 2026
- Branch: `main`
- Deployed commit: `55263b9`
- Status: pushed to GitHub `jasminnaharbiva/donor-management`

## Implemented Source Files

## Backend
- `src/routes/vms.routes.ts`
- `migrations/20260313180000_create_vms_core_tables.ts`
- `migrations/20260313210000_unify_volunteer_systems_and_modernize_certificates.ts`
- `migrations/20260313224000_add_dynamic_generation_fields_to_volunteer_records.ts`
- `src/routes/volunteer-records.routes.ts` (advanced dynamic ID/certificate generation endpoints)
- `src/scripts/seed-unified-volunteer-demo.ts`
- `src/index.ts` (VMS route + uploads static mount)
- `knexfile.ts` (runtime-safe `.env` path resolution for Knex tooling)

## Frontend
- `frontend/src/pages/admin/VmsPanel.tsx`
- `frontend/src/pages/admin/VolunteerHubPanel.tsx`
- `frontend/src/pages/admin/VolunteerRecordsPanel.tsx` (dynamic template/preview/render UX)
- `frontend/src/pages/vms/VmsHome.tsx`
- `frontend/src/pages/vms/VmsCertificatePage.tsx`
- `frontend/src/pages/admin/AdminDashboard.tsx` (menu + route integration)
- `frontend/src/App.tsx` (public `/vms` routing)

## URL Map
- Public VMS UI: `/vms`
- Public Certificate View: `/vms/certificate/:certificateId`
- API Base: `/api/v1/vms`
- Admin unified volunteer platform: `/admin/volunteer-hub`
- Legacy path compatibility:
	- `/admin/volunteers` → `/admin/volunteer-hub?tab=people`
	- `/admin/vol-applications` → `/admin/volunteer-hub?tab=applications`
	- `/admin/vol-records` and `/admin/vms` → `/admin/volunteer-hub?tab=records`

## Unified API Additions (DFB + VMS)
- `GET /api/v1/vms/admin/unified/volunteers`
- `GET /api/v1/vms/admin/unified/certificates`
- `POST /api/v1/vms/admin/unified/certificates/bulk`
- `PATCH /api/v1/vms/admin/unified/certificates/:source/:id/revoke`
- `GET /api/v1/vms/admin/unified/certificates/verification-analytics`
- Public certificate lookup now checks both systems via:
	- `POST /api/v1/vms/public/verify-certificate`
	- `GET /api/v1/vms/public/certificate/:certificateId`

## Volunteer Records Advanced API Additions
- `PUT /api/v1/volunteer-records/id-card-templates/:templateId`
- `DELETE /api/v1/volunteer-records/id-card-templates/:templateId`
- `POST /api/v1/volunteer-records/id-card-templates/:templateId/preview`
- `GET /api/v1/volunteer-records/id-cards/:cardId/render`
- `PUT /api/v1/volunteer-records/certificate-templates/:templateId`
- `DELETE /api/v1/volunteer-records/certificate-templates/:templateId`
- `POST /api/v1/volunteer-records/certificate-templates/:templateId/preview`
- `GET /api/v1/volunteer-records/certificates/:awardId/render`

## Database Tables
- `vms_admins`
- `vms_volunteers`
- `vms_certificates`
- `vms_general_settings`
- `vms_audit_logs`

## Seeded Standalone VMS Admin
- Username: `vmsadmin`
- Email: `vms-admin@example.com`
- Password: `ChangeMe@123`

Change this password immediately if used for standalone VMS auth.

## Runtime Commands
- Run migration: `npm run migrate`
- Build backend: `npm run build`
- Build frontend: `cd frontend && npm run build`
- Seed unified demo data: `npm run seed:volunteer-demo`
- Restart app: `pm2 restart dfb-api`
- Migration status: `npx knex migrate:status --knexfile knexfile.ts`

## Smoke Test Endpoints
- `GET /api/v1/vms/public/settings`
- `POST /api/v1/vms/public/verify-certificate`
- `GET /api/v1/vms/admin/dashboard/stats` (requires main admin token)

## Verification Status
- Backend build: pass
- Frontend build: pass
- Migration status: all applied, no pending
- Runtime smoke: pass (`200/401/404` as expected by route type)
- Authenticated volunteer-records E2E (template create/update/preview, issue, render, delete guards): pass

## Related Volunteer Workflow Extensions (March 14, 2026)

Although outside standalone VMS certificate scope, volunteer-side case intake has been expanded in the unified DFB portal:

- New backend route:
	- `src/routes/beneficiary-applications.routes.ts`
	- Mounted in `src/index.ts` as `/api/v1/beneficiary-applications`
- New migration:
	- `migrations/20260314102000_add_beneficiary_application_workflow.ts`
	- Adds `dfb_beneficiary_applications`
	- Extends `dfb_form_schemas.form_type` with `beneficiary_application`
- New volunteer UI:
	- `frontend/src/pages/volunteer/BeneficiaryApplicationPage.tsx`
	- Route wired in `frontend/src/pages/volunteer/VolunteerDashboard.tsx`
- Admin review UI upgrade:
	- `frontend/src/pages/admin/BeneficiariesPanel.tsx` now includes application review queue + approval actions
- Dynamic admin form control:
	- `frontend/src/pages/admin/FormSchemasPanel.tsx` supports `beneficiary_application` + default preset
	- `src/routes/form-schemas.routes.ts` supports backend schema fallback for this type
- Upload policy endpoint:
	- `POST /api/v1/media/beneficiary-upload`
	- 500KB (identity/passport/nationality), 5MB (additional)

These additions preserve the same approval-first governance model used in volunteer onboarding and records issuance.

## Governance + Fund Management Extensions (March 14, 2026)

To support the volunteer-driven project update lifecycle with stronger financial governance and donor/public controls, the following non-VMS core modules were extended:

- Permission middleware upgrade:
	- `src/middleware/auth.middleware.ts`
	- Adds dynamic `requirePermission(resource, action, fallbackRoles)` with cache-assisted permission checks
- Volunteer project workflow hardening:
	- `src/routes/volunteers.routes.ts`
	- Adds pending submission edit/delete endpoints and tighter permission-gated project workspace actions
- Admin dynamic donor visibility control:
	- `src/routes/admin.routes.ts` (`/api/v1/admin/donor-visibility` GET/PUT)
	- `frontend/src/pages/admin/SettingsPanel.tsx` (add/edit/delete/hide visibility UI)
- Donor/public visibility enforcement:
	- `src/routes/donors.routes.ts` (`/api/v1/donors/me/visibility`, `/me/impact`, `/me/project-updates` visibility-aware)
	- `src/routes/public.routes.ts` (`/api/v1/public/project-updates` visibility-aware)
	- `frontend/src/pages/donor/DonorDashboard.tsx` (menu + impact section rendering respects admin settings)
- Fund management expansion:
	- `src/routes/funds.routes.ts` (admin summary, create, update, transfer, reconcile, ledger)
	- `frontend/src/pages/admin/FundsManagementPanel.tsx`
	- `frontend/src/pages/admin/AdminDashboard.tsx` (new `/admin/funds` route + menu)

These updates keep VMS-adjacent volunteer execution traceable from field activity through admin approval and into controlled donor/public transparency.
