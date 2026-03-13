# VMS Implementation Manifest

This file tracks where the implemented VMS module lives in the current software.

## Implemented Source Files

## Backend
- `src/routes/vms.routes.ts`
- `migrations/20260313180000_create_vms_core_tables.ts`
- `migrations/20260313210000_unify_volunteer_systems_and_modernize_certificates.ts`
- `src/scripts/seed-unified-volunteer-demo.ts`
- `src/index.ts` (VMS route + uploads static mount)

## Frontend
- `frontend/src/pages/admin/VmsPanel.tsx`
- `frontend/src/pages/vms/VmsHome.tsx`
- `frontend/src/pages/vms/VmsCertificatePage.tsx`
- `frontend/src/pages/admin/AdminDashboard.tsx` (menu + route integration)
- `frontend/src/App.tsx` (public `/vms` routing)

## URL Map
- Public VMS UI: `/vms`
- Public Certificate View: `/vms/certificate/:certificateId`
- API Base: `/api/v1/vms`
- Admin integration panel: `/admin/vms`

## Unified API Additions (DFB + VMS)
- `GET /api/v1/vms/admin/unified/volunteers`
- `GET /api/v1/vms/admin/unified/certificates`
- `POST /api/v1/vms/admin/unified/certificates/bulk`
- `PATCH /api/v1/vms/admin/unified/certificates/:source/:id/revoke`
- `GET /api/v1/vms/admin/unified/certificates/verification-analytics`
- Public certificate lookup now checks both systems via:
	- `POST /api/v1/vms/public/verify-certificate`
	- `GET /api/v1/vms/public/certificate/:certificateId`

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

## Smoke Test Endpoints
- `GET /api/v1/vms/public/settings`
- `POST /api/v1/vms/public/verify-certificate`
- `GET /api/v1/vms/admin/dashboard/stats` (requires main admin token)
