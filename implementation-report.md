# DFB Donor Management — Implementation Report

**Date**: March 14, 2026  
**Report Coverage**: through current working tree (pending commit) on `main`  
**Live URL**: https://donor-management.nokshaojibon.com  
**GitHub**: jasminnaharbiva/donor-management

---

## Summary

This report tracks all implemented features against the `real_time_donation_planning.md` specification, plus all bugs fixed and improvements made across this session.

---

## Phase 5 — Governance + Fund Management Hardening (March 14, 2026)

### Volunteer Project Workspace Workflow ✅
- Volunteer project cards now open a full project workspace in the volunteer dashboard.
- Volunteers can submit project updates with required evidence: voucher, cash memo, photos, title/details.
- Volunteers can edit or withdraw only their own pending submissions.
- Project update submissions are routed through admin approval (no direct public/donor exposure).

### Admin Review + Evidence Controls ✅
- Admin expense approval panel now surfaces voucher/cash memo/photo evidence more clearly.
- Pending-state action rendering fixed for approve/reject controls.
- Approval flow stability fixes:
  - Prevent generated-column write attempts on `budget_remaining`.
  - Handle insufficient allocation scenarios with explicit business errors.

### Donor/Public Data Safety + Dynamic Visibility ✅
- Added donor-approved project updates API with strict sanitization (no voucher/cash memo/expense leakage).
- Added public approved updates API with narrative/photos only.
- Added dynamic donor visibility settings in admin APIs:
  - `GET /api/v1/admin/donor-visibility`
  - `PUT /api/v1/admin/donor-visibility`
- Added donor visibility runtime endpoint:
  - `GET /api/v1/donors/me/visibility`
- Donor dashboard now respects admin-configured menu visibility and impact section visibility.
- Donor impact UI hardened to handle hidden sections gracefully (no null-summary crash).
- Public approved updates API now also enforces admin visibility toggles.

### Permission System Integration (Runtime Enforcement) ✅
- Added dynamic `requirePermission(resource, action, fallbackRoles)` middleware.
- Permission checks now include role-name and custom-permission cache paths (Redis + safe fallback).
- Integrated permission enforcement into key project-workspace and donor-visibility routes.

### Complete Fund Management Expansion ✅

#### Backend (`src/routes/funds.routes.ts`)
- New secured management endpoints:
  - `GET /api/v1/funds/admin-summary`
  - `POST /api/v1/funds`
  - `PATCH /api/v1/funds/:id`
  - `POST /api/v1/funds/transfer`
  - `POST /api/v1/funds/:id/reconcile`
  - `GET /api/v1/funds/:id/ledger`
- Transfer workflow now records full ledger trail:
  - source allocation consumption
  - approved transfer expense record
  - target transaction + allocation
  - source/target balance mutation in one DB transaction
- Reconciliation endpoint supports both discrepancy check and optional balance correction.
- All fund-management actions write audit entries.

#### Frontend Admin UX
- New `Funds` panel in admin dashboard:
  - real-time fund summary and discrepancy view
  - create fund form
  - edit fund profile form
  - inter-fund transfer form
  - per-fund reconcile check/fix actions
  - per-fund ledger preview
- Settings panel now includes full donor-visibility editor:
  - add/edit/delete/hide donor menu items
  - add/edit/delete/hide impact sections
  - toggle approved update fields (location/narrative/details/photos)

### Verification ✅
- Backend TypeScript build: pass (`npm run build`)
- Frontend build: pass (`cd frontend && npm run build`)

---

## Phase 1 — Prior Sessions (Completed Before This Session)

### Backend Infrastructure ✅
- Node.js + TypeScript API server on port 3002
- Express router with version prefix `/api/v1/`
- PM2 cluster mode (4 instances) for production reliability
- LiteSpeed reverse proxy for 80/443 → 3002
- MariaDB 10.11.15 with 45 tables, 4 triggers
- Role-Based Access Control (RBAC): 5 roles, permissions table
- JWT authentication (access token 15min, refresh token 30d)
- AES-256-GCM encryption for all PII fields (email, phone, national ID)
- SHA-256 email hashing for secure lookups
- Audit logging on all sensitive operations
- Integrity hashing for tamper detection
- bcrypt password hashing (cost 12)

### API Routes (7 new routes) ✅
- `POST/GET /api/v1/campaigns` — Campaign CRUD with status management
- `GET/POST/PATCH /api/v1/beneficiaries` — Beneficiary management
- `GET/POST/PUT/DELETE /api/v1/announcements` — Announcement board
- `GET/PATCH /api/v1/notifications` — Notification read/unread
- `GET/POST /api/v1/pledges` — Pledge management
- `GET/POST/PATCH /api/v1/recurring` — Recurring subscriptions
- `GET /api/v1/reports/ledger` — Financial ledger with fund breakdown

### Frontend (12 Admin Panels) ✅
- AdminDashboard with sidebar navigation
- DashboardStats — KPI overview
- CampaignsPanel — CRUD + status toggle + progress bars
- DonorsPanel — Donor directory with search
- DonationsPanel — Transaction list with filters
- ExpensesAdminPanel — Approve/reject workflow
- VolunteersAdminPanel — Volunteer directory
- AnnouncementsPanel — Post & manage announcements
- ReportsPanel — Financial reports
- SettingsPanel — System settings
- AuditLogs — Full audit trail
- RolesPanel — Role & permission management

### Dashboards ✅
- **Donor Portal**: Overview, donation history, recurring subscriptions, notifications
- **Volunteer Portal**: Open shifts signup, timesheet submission
- **Public Home**: Live impact stats, active campaigns, hero section

---

## Phase 3 — Latest Session Implementations (March 10, 2026)

### UI: Dashboard Dropdown Menu ✅
**Commit**: `a1e01fa`  
**File**: `frontend/src/layouts/DashboardLayout.tsx` — Complete rewrite

Replaced the broken person-icon button with a full user dropdown:
- Initials avatar (colored circle, derived from email)
- User name + role shown inline in the top bar
- Bell notification icon
- Dropdown menu with: user info header card, **My Profile** button, **Sign Out** button
- Click-outside-to-close behavior via `useRef` + `mousedown` listener
- Sidebar user info section (initials + email + role)
- Mobile-responsive sidebar overlay with hamburger toggle

### New Page: My Profile (`/profile`) ✅
**File**: `frontend/src/pages/ProfilePage.tsx`

- Accessible to all roles (Super Admin, Admin, Donor, Volunteer)
- Displays account info: email, role, first name, last name (when available)
- **Change Password form**: current password → new password → confirm, with client-side validation (8+ chars, match check)
- Calls `POST /api/v1/auth/change-password`
- Success / error feedback inline
- Sign Out button + ← Back navigation
- "My Profile" in the dropdown now navigates to `/profile`

### New Backend Route: Change Password ✅
**File**: `src/routes/auth.routes.ts`  
**Endpoint**: `POST /api/v1/auth/change-password`

- Protected by `authenticate` middleware
- Validates `currentPassword` (not empty) and `newPassword` (min 8 chars)
- Fetches user from DB, runs `bcrypt.compare()` against stored hash
- Returns `401` if current password is wrong
- Hashes new password with bcrypt cost 12 and persists
- Writes audit log entry (`action: password_changed`)

### New Admin Panel: SEO Manager (`/admin/seo`) ✅
**File**: `frontend/src/pages/admin/SeoPanel.tsx`

4 collapsible setting groups:

| Group | Fields |
|---|---|
| Basic SEO | Site title, meta description, org name, canonical URL, OG image URL, Twitter/X handle |
| Analytics & Tracking | Google Analytics 4 ID, Search Console verification, Facebook Pixel ID, GTM ID |
| Robots & Sitemap | robots.txt content (textarea editor), include campaigns in sitemap (boolean toggle) |
| Legal & Compliance | Privacy policy URL, Terms of service URL |

Features:
- Per-field save with ✓ saved indicator
- External tool links: Google Search Console, PageSpeed Insights, SSL Labs
- Contextual tips below each field (e.g., GA4 format `G-XXXXXXXXXX`)
- Boolean fields rendered as toggle switches
- Fetches from `GET /api/v1/admin/settings`, saves to `PUT /api/v1/admin/settings/:key`

**14 SEO settings seeded in `dfb_system_settings`**:
`seo.site_title`, `seo.site_description`, `seo.org_name`, `seo.org_url`, `seo.og_image_url`, `seo.twitter_handle`, `seo.google_analytics_id`, `seo.google_site_verification`, `seo.facebook_pixel_id`, `seo.google_tag_manager_id`, `seo.robots_txt_content`, `seo.sitemap_include_campaigns`, `legal.privacy_policy_url`, `legal.terms_url`

### New Admin Panel: Beneficiaries (`/admin/beneficiaries`) ✅
**File**: `frontend/src/pages/admin/BeneficiariesPanel.tsx`

- Table view: name, welfare category, city, intake date, status
- Status filter dropdown: Active / Pending / Served / Inactive
- Client-side search (name, city, category)
- Paginated (20 per page) — calls `GET /api/v1/beneficiaries`
- Color-coded status badges

### New Admin Panel: Pledges (`/admin/pledges`) ✅
**File**: `frontend/src/pages/admin/PledgesPanel.tsx`

- Table view: donor, campaign, pledged amount, fulfilled amount, due date, status
- Status filter: All / Pending / Partially Fulfilled / Fulfilled / Overdue / Cancelled
- Client-side search (donor name, campaign title)
- Currency formatted with `Intl.NumberFormat`
- Paginated — calls `GET /api/v1/pledges`

### New Admin Panel: Recurring Donations (`/admin/recurring`) ✅
**File**: `frontend/src/pages/admin/RecurringPanel.tsx`

- Table view: donor, campaign, amount, frequency label, total paid, next payment date, status
- Status filter: All / Active / Paused / Cancelled / Completed
- Frequency labels (daily → annually)
- Paginated — calls `GET /api/v1/recurring`

### New Admin Panel: Notifications (`/admin/notifications`) ✅
**File**: `frontend/src/pages/admin/NotificationsAdminPanel.tsx`

- Notification log table: title, recipient, type badge, created date, status badge
- Status filter: All / Pending / Sent / Read / Failed
- Client-side search (title, recipient name/email)
- **Broadcast form**: send a notification to All Users, Donors Only, or Volunteers Only
  - Title + message body fields
  - Target audience selector
  - Posts to `POST /api/v1/notifications/broadcast`
- Paginated — calls `GET /api/v1/notifications`

### AdminDashboard Updated ✅
**File**: `frontend/src/pages/admin/AdminDashboard.tsx`

5 new sidebar menu items added:
- Beneficiaries → `/admin/beneficiaries`
- Pledges → `/admin/pledges`
- Recurring → `/admin/recurring`
- Notifications → `/admin/notifications`
- SEO Manager → `/admin/seo`

5 new `<Route>` entries wired to matching panel components.

### App.tsx Updated ✅
**File**: `frontend/src/App.tsx`

Added `/profile` route inside a `ProtectedRoute` that allows all 4 roles:
```tsx
<Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Donor', 'Volunteer']} />}>
  <Route path="/profile" element={<ProfilePage />} />
</Route>
```

---

## Phase 2 — Prior Session Implementations

### Bug Fixes

#### Login 401 Error ✅ FIXED
**Root cause**: Axios interceptor was globally catching ALL 401 responses, including failed login attempts, causing an infinite redirect loop.

**Fix**: Complete rewrite of `frontend/src/services/api.ts`:
- Interceptor now **skips** `/auth/login` and `/auth/register` routes — these are handled by the login form directly
- Added automatic JWT refresh on 401: tries `POST /api/v1/auth/refresh` with stored refreshToken
- Queue-based retry system prevents multiple simultaneous refresh calls
- On refresh failure: clears both tokens and redirects to `/login?expired=1`
- Uses `_retry` flag to prevent infinite loops

#### Registration Status ✅ FIXED
**Root cause**: New donors were registered with `status: 'pending'`, preventing immediate login.

**Fix**: Changed `auth.routes.ts` to set `status: 'active'` and `email_verified_at: new Date()` on registration, so new donors can log in immediately.

### New Features

#### Email Notification Service ✅
**File**: `src/services/email.service.ts`

6 email template functions:
1. `sendDonationReceipt()` — Formatted receipt with amount, transaction ID, fund/campaign
2. `sendWelcomeEmail()` — Role-aware welcome email after registration
3. `sendExpenseApproved()` — Green approval email to volunteer with amount
4. `sendExpenseRejected()` — Red rejection email with admin reason
5. `sendHighValueDonationAlert()` — Admin alert for donations ≥ $10,000
6. `sendPasswordReset()` — Password reset link email

**Development fallback**: Auto-creates Ethereal test account if no SMTP configured (preview URLs logged).

**Integration points**:
- Registration → `sendWelcomeEmail()` (via `auth.routes.ts`)
- Expense approve → `sendExpenseApproved()` (via `expenses.routes.ts`)
- Expense reject → `sendExpenseRejected()` (via `expenses.routes.ts`)
- Donation created → `sendDonationReceipt()` + `sendHighValueDonationAlert()` (via `donations.routes.ts`)

All email sends are non-blocking (`.catch()` handled internally, never crash the request).

#### Register Page ✅
**Route**: `/register`  
**File**: `frontend/src/pages/Register.tsx`

Features:
- Dark gradient design matching Login page
- First name + last name fields
- Email + optional phone field
- Password with real-time strength validation (4 checks: 8+ chars, uppercase, number, special)
- Matching confirm password with visual mismatch indicator
- Success screen with redirect to login
- Links back to `/login`

#### Token Auto-Refresh ✅
- On 401, frontend queues failed requests, refreshes token, retries all queued requests
- Users no longer get kicked out mid-session — stay logged in across multiple 15-minute token windows
- Session expiry banner appears at login when redirected with `?expired=1`

#### Login Page Improvements ✅
- New dark gradient design
- Session expired amber banner (from `?expired=1` URL parameter)
- Demo credentials auto-fill buttons (Admin + Volunteer)
- "Register" link for new donors
- Stores refreshToken in localStorage on successful login

#### Demo Accounts ✅
| Email | Password | Role |
|---|---|---|
| volunteer@dfb.org | Volunteer@2026 | Volunteer |
| donor@dfb.org | Donor@1234 | Donor |

#### Admin Dashboard Charts (recharts) ✅
**File**: `frontend/src/pages/admin/DashboardStats.tsx` — Complete rewrite

New features:
- 8 KPI stat cards with color-coded left borders and trend labels
- **AreaChart**: Monthly donation trend (last 12 months)
- **PieChart**: Fund distribution with legend
- **BarChart**: Donation count per month
- Fund balance progress bars
- Loading skeleton states (no spinner flash)
- `fmt()` helper: compact currency display ($1.2M, $450K)
- Custom tooltip component

Packages installed: `recharts`, `date-fns`

#### Donor Dashboard Improvements ✅
**File**: `frontend/src/pages/donor/DonorDashboard.tsx`

New features in the Overview page:
- **Giving History AreaChart**: Monthly donation amounts (last 6 months)
- **Quick Donate form**: Amount input with $25/$50/$100 preset buttons, fund selector, payment method dropdown
- Donation success feedback without page reload
- Chart refreshes after donation submission

---

## Phase 4 — Full Feature Completion (March 11, 2026)

**Commit**: `03b4d4e`  
25 files changed, 2,589 insertions. All remaining features from `real_time_donation_planning.md` are now implemented.

### New Backend Routes (8 new route files)

#### Password Reset Flow ✅
**File**: `src/routes/auth.routes.ts` (extended)

- `POST /api/v1/auth/forgot-password` — generates 32-byte cryptographic token, stores SHA-256 hash in `password_reset_token` column, emails reset link (`/reset-password?token=...`), expires in 1 hour. Always returns 200 (prevents user enumeration).
- `POST /api/v1/auth/reset-password` — verifies token hash, checks expiry, sets new bcrypt-hashed password, clears token fields.

#### Projects (`src/routes/projects.routes.ts`) ✅
Full CRUD for the `dfb_projects` table:
- `GET /api/v1/projects` — list with fund/campaign JOINs, status filter
- `GET /api/v1/projects/:id`
- `POST /api/v1/projects` — admin only
- `PATCH /api/v1/projects/:id` — admin only
- `DELETE /api/v1/projects/:id` — admin only

Fields: `project_name`, `fund_id`, `campaign_id`, `budget_allocated`, `status` (planning/active/on_hold/completed/cancelled), `start_date`, `target_completion_date`, `location_country`, `location_city`, `description`.

#### Feature Flags (`src/routes/feature-flags.routes.ts`) ✅
- `GET /api/v1/feature-flags` — all flags (auth required)
- `GET /api/v1/feature-flags/public` — enabled flags only, **Redis-cached 30 seconds** (no auth)
- `PATCH /api/v1/feature-flags/:flagName` — toggle, invalidates Redis cache

16 default flags auto-seeded on first run: `bkash_payments`, `stripe_payments`, `donor_portal`, `volunteer_portal`, `volunteer_registration`, `peer_to_peer`, `gamification`, `ai_matching`, `blockchain_receipts`, `offline_mode`, `two_factor_auth`, `gdpr_tools`, `advanced_reporting`, `multi_currency`, `sms_notifications`, `api_webhooks`.

#### Volunteer Applications (`src/routes/volunteer-applications.routes.ts`) ✅
- `GET /api/v1/volunteer-applications` — admin only, status filter
- `GET /api/v1/volunteer-applications/:id` — admin only
- `POST /api/v1/volunteer-applications` — **PUBLIC** (no auth required for application form)
- `PATCH /api/v1/volunteer-applications/:id/review` — status: `under_review` / `approved` / `rejected` / `waitlisted`. On approval, **auto-creates a `dfb_volunteers` record** if the email is not already in the volunteers table.

#### Shifts & Timesheets (`src/routes/shifts.routes.ts`) ✅
- Shifts: `GET /api/v1/shifts`, `POST /`, `PATCH /:id`, `DELETE /:id`
- Timesheets: `GET /api/v1/shifts/timesheets` (status filter), `POST /shifts/timesheets` (volunteer submission), `PATCH /shifts/timesheets/:id/review` (approve/reject with admin notes)
- JOINs `dfb_projects`, `dfb_campaigns`, `dfb_volunteers`

#### Peer-to-Peer Campaigns (`src/routes/p2p.routes.ts`) ✅
- `GET /api/v1/p2p` — auth, status filter
- `GET /api/v1/p2p/:id` — auth
- `GET /api/v1/p2p/by-slug/:slug` — **PUBLIC**
- `POST /api/v1/p2p` — donor creates P2P campaign (starts as `draft`)
- `PATCH /api/v1/p2p/:id/approve` — admin sets status to `active` or `rejected`

#### Email Templates (`src/routes/email-templates.routes.ts`) ✅
- `GET /api/v1/email-templates` — admin
- `GET /api/v1/email-templates/:slug` — admin
- `PATCH /api/v1/email-templates/:slug` — updates subject, html_body, is_active
- `POST /api/v1/email-templates/:slug/test` — sends a live test email to specified address

#### Custom Fields (`src/routes/custom-fields.routes.ts`) ✅
- `GET /api/v1/custom-fields?entityType=donor` — optional entity type filter
- `POST /api/v1/custom-fields` — admin: create field with full validation
- `PATCH /api/v1/custom-fields/:id` — admin: update label, visibility, order
- `DELETE /api/v1/custom-fields/:id` — Super Admin only: cascades into `dfb_custom_field_values`

Entity types: `donor`, `expense`, `campaign`, `volunteer`, `beneficiary`.

#### Public Endpoints Extended (`src/routes/public.routes.ts`) ✅
- `GET /api/v1/public/campaigns/:slug` — public campaign detail (requires `is_public = true`)
- `GET /api/v1/public/volunteers/verify/:badgeNumber` — volunteer badge verification (requires `status = 'active'`)

#### SEO Automation (`src/index.ts`) ✅
- `GET /robots.txt` — reads `seo.robots_txt_content` from `dfb_system_settings`, falls back to safe default
- `GET /sitemap.xml` — dynamically generates XML from all active, public campaigns

---

### New Frontend Admin Panels (7 panels)

#### Projects Panel (`/admin/projects`) ✅
**File**: `frontend/src/pages/admin/ProjectsPanel.tsx`

- Responsive card grid: name, status badge, fund/campaign links, budget
- Status color badges: planning (blue), active (green), on_hold (yellow), completed (gray), cancelled (red)
- Create/Edit modal: fund selector, optional campaign selector, date fields, location fields
- Status filter pills, delete with confirm dialog

#### Feature Flags Panel (`/admin/feature-flags`) ✅
**File**: `frontend/src/pages/admin/FeatureFlagsPanel.tsx`

- Pure CSS toggle switches (no extra dependency)
- Flags auto-grouped into: Payments, User Access, Advanced, Features
- Instant toggle with saving state
- Redis cache invalidated on every change (takes effect within 30s)

#### Volunteer Applications Panel (`/admin/vol-applications`) ✅
**File**: `frontend/src/pages/admin/VolunteerApplicationsPanel.tsx`

- Table with status filter
- Review modal with full application detail: motivation statement, skills, availability
- Action buttons: Mark Under Review, Approve, Reject, Waitlist
- Approve auto-creates a volunteer record

#### Shifts & Timesheets Panel (`/admin/shifts`) ✅
**File**: `frontend/src/pages/admin/ShiftsPanel.tsx`

Two-tab interface:
- **Shifts tab**: table with location, volunteer count, status; Create Shift form modal
- **Timesheets tab**: status filter, duration display (Xh Ym), Review modal with approve/reject + admin notes field

#### P2P Campaigns Panel (`/admin/p2p`) ✅
**File**: `frontend/src/pages/admin/P2PPanel.tsx`

- Cards with thermometer progress bar, creator info, parent campaign
- Approve/Reject buttons shown only for `draft` status

#### Email Templates Panel (`/admin/email-templates`) ✅
**File**: `frontend/src/pages/admin/EmailTemplatesPanel.tsx`

- Card list with active/inactive badge per template
- Full-screen edit modal: subject field, HTML body (monospace textarea), active toggle
- Available template variables reference panel
- Send test email with delivery confirmation

#### Custom Fields Panel (`/admin/custom-fields`) ✅
**File**: `frontend/src/pages/admin/CustomFieldsPanel.tsx`

- Entity type filter pills
- Table: field name, entity, type badges, visibility tags (show_in_form, show_in_list)
- Create/Edit modal: field type selector, options (comma-separated for select/checkbox), validation regex, visibility checkboxes

---

### New Public Pages (4 pages)

#### Forgot Password (`/forgot-password`) ✅
**File**: `frontend/src/pages/ForgotPassword.tsx`

- Dark gradient design matching Login page
- Email input → API call → success state showing the submitted email
- Always shows success (prevents email enumeration)
- Link back to `/login`

#### Reset Password (`/reset-password`) ✅
**File**: `frontend/src/pages/ResetPassword.tsx`

- Reads `?token=` from URL params; sent via email link
- 4-bar color gradient password strength meter (weak → strong)
- Confirm password match validation
- Success state → auto-redirects to `/login` after 3 seconds

#### Public Campaign Page (`/campaigns/:slug`) ✅
**File**: `frontend/src/pages/CampaignPage.tsx`

- Hero section with cover image overlay
- Thermometer progress bar with percentage raised
- "Days left" counter
- Details grid: status, dates, donor count
- Sticky sidebar: "Donate Now" (→ /register) + "Share Campaign" (Web Share API)

#### Volunteer Badge Verification (`/verify/:badgeNumber`) ✅
**File**: `frontend/src/pages/VolunteerVerify.tsx`

- Public verification page for physical badge QR codes
- Shows: name, badge number, location, member since, skills tags
- Green "VERIFIED ACTIVE VOLUNTEER" badge on success
- Red "Not Verified" state if badge not found or volunteer inactive

---

### AdminDashboard Updated ✅
**File**: `frontend/src/pages/admin/AdminDashboard.tsx`

7 new sidebar menu items (total: 24 items):

| Menu Item | Route | Icon |
|---|---|---|
| Projects | `/admin/projects` | FolderOpen |
| Vol. Applications | `/admin/vol-applications` | ClipboardList |
| Shifts & Timesheets | `/admin/shifts` | Clock |
| P2P Campaigns | `/admin/p2p` | Network |
| Email Templates | `/admin/email-templates` | Mail |
| Custom Fields | `/admin/custom-fields` | Sliders |
| Feature Flags | `/admin/feature-flags` | ToggleLeft |

### App.tsx & Login.tsx Updated ✅

**App.tsx** — 4 new public routes added:
```tsx
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
<Route path="/campaigns/:slug" element={<CampaignPage />} />
<Route path="/verify/:badgeNumber" element={<VolunteerVerify />} />
```

**Login.tsx** — "Forgot password?" link added above the Sign In button, links to `/forgot-password`.

---

## API Test Results (All Passing)

```
POST /api/v1/auth/login (admin)          ✅ 200, token returned
POST /api/v1/auth/login (volunteer)      ✅ 200, role: Volunteer
POST /api/v1/auth/login (donor)          ✅ 200, role: Donor
POST /api/v1/auth/change-password        ✅ 200, bcrypt verified
POST /api/v1/auth/forgot-password        ✅ 200, always succeeds
POST /api/v1/auth/reset-password        ✅ 200, token verified
GET  /api/v1/dashboard/stats             ✅ 200, keys OK
GET  /api/v1/campaigns                   ✅ 200
GET  /api/v1/funds                       ✅ 200
GET  /api/v1/reports/ledger              ✅ 200, summary keys OK
GET  /api/v1/beneficiaries               ✅ 200
GET  /api/v1/pledges                     ✅ 200
GET  /api/v1/recurring                   ✅ 200
GET  /api/v1/notifications               ✅ 200
GET  /api/v1/announcements               ✅ 200
GET  /api/v1/admin/settings              ✅ 200, SEO settings included
GET  /api/v1/public/impact               ✅ 200 (no auth required)
GET  /api/v1/projects                    ✅ 200
GET  /api/v1/feature-flags/public        ✅ 200 (cached, no auth)
GET  /api/v1/volunteer-applications      ✅ 200
GET  /api/v1/shifts                      ✅ 200
GET  /api/v1/shifts/timesheets           ✅ 200
GET  /api/v1/p2p                         ✅ 200
GET  /api/v1/email-templates             ✅ 200
GET  /api/v1/custom-fields               ✅ 200
GET  /robots.txt                         ✅ 200 (dynamic from DB)
GET  /sitemap.xml                        ✅ 200 (dynamic from campaigns)
```

---

## Build Status

| Component | Status |
|---|---|
| Backend TypeScript (`npx tsc`) | ✅ 0 errors |
| Frontend (`npm run build`) | ✅ Built in 18.92s — 841KB bundle |
| PM2 cluster (4 instances) | ✅ Online |
| GitHub push | ✅ `238f4b0` on main |

---

## Database Summary

- **45 tables** with full relational integrity
- **4 triggers** for automated fund balance updates
- **Seed data**: Roles, permissions, funds, default admin account
- **Demo accounts** added directly via SQL (inactive status fixed to active)
- **Email architecture**: All emails stored as AES-256-GCM encrypted, looked up via SHA-256 hash

---

## Phase 6 & 7 — Enterprise Completion (March 11, 2026)

**Commit**: `0851c2a`
Implemented all remaining enterprise-grade requirements:
- **Two-Factor Authentication (2FA)**: Full TOTP flow using Authy/Google Authenticator (`/auth/2fa/generate`, `/auth/2fa/verify`, `/auth/2fa/login`) with frontend integrated into `ProfilePage.tsx` and `Login.tsx`.
- **Media Uploads API**: Image/Receipt uploads via `multer` to `public/uploads` (`/api/v1/media/upload`), integrated into timesheets.
- **Zakat Calculator**: Client-side interactive widget in the Donor Dashboard.
- **WebSockets / Real-Time**: `useSocket.ts` hook seamlessly connecting via `socket.io-client` with automatic global event listeners.
- **Dynamic SEO Scripts**: Injection of Google Analytics (GTM) and JSON-LD structured data directly into the application head via `<script>` injection.
- **SMTP**: Verified live SMTP environment variables config in `.env`.
- **Donor Pledges**: Donor-facing pledge creation UI integrated natively to `/api/v1/pledges`.
- **Campaign Images**: Integrated `cover_image_url` onto public campaign pages.

---

## Remaining / Future Work

| Feature | Status | Notes |
|---|---|---|
| Real SMTP configuration | ✅ Done | Included in `.env` config with live SMTP host options |
| Password reset flow (UI) | ✅ Done | `/forgot-password` + `/reset-password` pages + backend token routes |
| Donor pledge creation UI | ✅ Done | Integrated natively inside `DonorDashboard.tsx` |
| Admin create donations | Working | Via admin panel form |
| File upload for receipts | ✅ Done | Timesheet backend supports media upload via new `/media` endpoint |
| Two-factor authentication | ✅ Done | Live natively within Profile settings |
| Real-time Socket.IO push | ✅ Done | Hooked up globally via `useSocket.ts` |
| Campaign thumbnail images | ✅ Done | Hero cover images fully implemented |
| Mobile app / PWA | Not built | Future roadmap |
| robots.txt dynamic serving | ✅ Done | `GET /robots.txt` reads `seo.robots_txt_content` from DB |
| sitemap.xml dynamic serving | ✅ Done | `GET /sitemap.xml` generates XML from active campaigns |
| JSON-LD structured data | ✅ Done | Injected dynamically on frontend load in `App.tsx` |
| Google Analytics / GTM injection | ✅ Done | Injected natively on App mount based on configuration |

---

## Key File Locations

| File | Purpose |
|---|---|
| `src/services/email.service.ts` | All email templates and SMTP logic |
| `src/routes/auth.routes.ts` | Login, register, refresh, logout, /me, change-password |
| `src/routes/donations.routes.ts` | Donation CRUD + email receipt |
| `src/routes/expenses.routes.ts` | Expense CRUD + approval emails |
| `src/routes/beneficiaries.routes.ts` | Beneficiary CRUD |
| `src/routes/pledges.routes.ts` | Pledge management |
| `src/routes/recurring.routes.ts` | Recurring donation subscriptions |
| `src/routes/notifications.routes.ts` | Notification log + broadcast |
| `frontend/src/services/api.ts` | Axios instance + 401 refresh logic |
| `frontend/src/layouts/DashboardLayout.tsx` | Shared layout with dropdown, sidebar, nav |
| `frontend/src/pages/Login.tsx` | Login + session expired + demo creds |
| `frontend/src/pages/Register.tsx` | New user registration |
| `frontend/src/pages/ProfilePage.tsx` | User profile + change password |
| `frontend/src/pages/admin/AdminDashboard.tsx` | Admin router + sidebar menu |
| `frontend/src/pages/admin/DashboardStats.tsx` | recharts admin overview |
| `frontend/src/pages/admin/SeoPanel.tsx` | SEO & analytics settings panel |
| `frontend/src/pages/admin/BeneficiariesPanel.tsx` | Beneficiary management table |
| `frontend/src/pages/admin/PledgesPanel.tsx` | Pledge tracking table |
| `frontend/src/pages/admin/RecurringPanel.tsx` | Recurring donations table |
| `frontend/src/pages/admin/NotificationsAdminPanel.tsx` | Notification log + broadcast |
| `frontend/src/pages/donor/DonorDashboard.tsx` | Donor portal with chart + donate |
| `database.md` | All credentials (keep private) |

### Phase 4 New Files

| File | Purpose |
|---|---|
| `src/routes/projects.routes.ts` | Projects CRUD |
| `src/routes/feature-flags.routes.ts` | Feature flag toggle + Redis cache |
| `src/routes/volunteer-applications.routes.ts` | Application workflow + auto-volunteer creation |
| `src/routes/shifts.routes.ts` | Shifts + timesheet approval |
| `src/routes/p2p.routes.ts` | Peer-to-peer campaigns |
| `src/routes/email-templates.routes.ts` | Email template CRUD + test send |
| `src/routes/custom-fields.routes.ts` | Custom field CRUD per entity type |
| `frontend/src/pages/admin/ProjectsPanel.tsx` | Projects admin panel |
| `frontend/src/pages/admin/FeatureFlagsPanel.tsx` | Feature flag toggles |
| `frontend/src/pages/admin/VolunteerApplicationsPanel.tsx` | Application review workflow |
| `frontend/src/pages/admin/ShiftsPanel.tsx` | Shifts + timesheets tabs |
| `frontend/src/pages/admin/P2PPanel.tsx` | P2P campaign approve/reject |
| `frontend/src/pages/admin/EmailTemplatesPanel.tsx` | Template editor + test email |
| `frontend/src/pages/admin/CustomFieldsPanel.tsx` | Custom field management |
| `frontend/src/pages/ForgotPassword.tsx` | Password reset request page |
| `frontend/src/pages/ResetPassword.tsx` | Password reset form (token-based) |
| `frontend/src/pages/CampaignPage.tsx` | Public campaign detail page |
| `frontend/src/pages/VolunteerVerify.tsx` | Public volunteer badge verification |

---

## Phase 8 — Enterprise Final Completion (March 11, 2026)

**Commit**: `9563c7c`

### New Backend Routes

| Route File | Endpoints | Description |
|---|---|---|
| `src/routes/translations.routes.ts` | GET/POST/PUT/DELETE + bulk-import | i18n translation strings CRUD — locale/namespace/key/value with bulk JSON import |
| `src/routes/public-pages.routes.ts` | GET/POST/PUT/DELETE + `/slug/:slug` public | CMS public pages with SEO metadata, sections_json, custom CSS |
| `src/routes/form-schemas.routes.ts` | GET/POST/PUT/DELETE + `/type/:type` public | Dynamic form schema management (donation/registration/expense/campaign/beneficiary_intake) |
| `src/routes/volunteer-records.routes.ts` | ID cards, certificates, messages | Volunteer ID card issuance, certificate awarding, direct messaging |

### New Admin Panels (frontend)

| Panel File | Features |
|---|---|
| `frontend/src/pages/admin/TranslationsPanel.tsx` | Filter by locale/namespace/search, inline edit, delete, add, bulk JSON import |
| `frontend/src/pages/admin/PublicPagesPanel.tsx` | CMS with toggle publish, SEO meta editor (70/160 char counters), JSON content editor, custom CSS tab |
| `frontend/src/pages/admin/FormSchemasPanel.tsx` | Schema editor by form type, JSON validation, active toggle auto-deactivates siblings |
| `frontend/src/pages/admin/VolunteerRecordsPanel.tsx` | 3-tab panel: ID Cards (issue/revoke), Certificates (award/track), Messages (compose/send) |

### Bug Fixes & Infrastructure

| Fix | Details |
|---|---|
| Redis startup crash | Wrapped `redis.connect()` in try-catch; ignores "already connecting/connected" error from `rate-limit-redis` triggering early connection on `lazyConnect` client |
| `GDPR_EXPORT` audit type | Added to `audit.service.ts` union type |
| robots.txt static file | Created `frontend/public/robots.txt` + `frontend/dist/robots.txt`; added `context /robots.txt` static block in LiteSpeed vhost config |
| sitemap.xml proxy | Added `context /sitemap.xml` proxy block in LiteSpeed vhost config routing to Node API |
| LiteSpeed vhost config | Added explicit static context for `robots.txt` and proxy context for `sitemap.xml` |

### Deployment Status

| Step | Result |
|---|---|
| TypeScript compile (`npx tsc`) | ✅ Exit 0 — clean |
| Frontend build (`npm run build`) | ✅ Built — 2525 modules |
| PM2 restart (4 instances) | ✅ All online, stable |
| Health endpoint | ✅ `{"status":"ok","version":"1.0.0"}` |
| Translations API auth | ✅ HTTP 401 (correct — auth required) |
| robots.txt serving | ✅ `text/plain` (Cloudflare cache TTL expiry pending) |
| GitHub push | ✅ `9563c7c` on main |

---

## Phase 9 — Bug Fixes & Stability (March 11, 2026)

**Commit**: `fa2053d`

### Root Cause Analysis & Bug Fixes

#### White Screen on Page Refresh ✅ FIXED
**File**: `frontend/src/context/AuthContext.tsx`

**Root cause**: `GET /auth/me` returns snake_case fields (`user_id`, `role_name`) while `POST /auth/login` returns camelCase (`userId`, `role`). On fresh login, `AuthContext` stored `user.role` correctly from the login response. On page refresh, the app re-fetched `/auth/me` and stored the raw response — `user.role` became `undefined` because the field is named `role_name` on that endpoint. `ProtectedRoute` checked `user.role` for every route, found it undefined, and redirected to `/login`. The redirect itself loaded a protected route, causing an infinite redirect loop → blank white screen.

**Fix**: Normalize the `/auth/me` response in `AuthContext.useEffect`:

```typescript
api.get('/auth/me').then(res => {
  const d = res.data.data;
  setUser({
    userId:    d.userId    || d.user_id,
    email:     d.email,
    role:      d.role      || d.role_name,
    firstName: d.firstName || d.first_name,
    lastName:  d.lastName  || d.last_name,
  });
});
```

**API response shapes confirmed:**
- `POST /auth/login` → `{ userId, email, role: "Super Admin" }` (camelCase)
- `GET /auth/me` → `{ user_id, email, role_name: "Super Admin" }` (snake_case)

---

#### `toFixed is not a function` Crash ✅ FIXED
**File**: `frontend/src/pages/admin/DashboardStats.tsx`

**Root cause**: MariaDB returns `DECIMAL` / `NUMERIC` columns as JavaScript strings (e.g., `"47500.00"`), not numbers. The `fmt()` and `fmtFull()` helpers were typed as `(n: number)` and called `.toFixed()` directly on the value — crashing at runtime when a string arrived.

**Fix**: Accept `number | string | null | undefined`, coerce with `Number()`:

```typescript
// BEFORE (crashes on strings)
function fmt(n: number) { return '$' + (n / 1000).toFixed(0) + 'K'; }

// AFTER (safe — handles DB strings)
function fmt(n: number | string | null | undefined) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return '$' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return '$' + (num / 1_000).toFixed(0) + 'K';
  return '$' + num.toFixed(0);
}
function fmtFull(n: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(Number(n) || 0);
}
```

---

#### Blank Screen with No Error Message ✅ FIXED
**File**: `frontend/src/components/ErrorBoundary.tsx` (new file)
**File**: `frontend/src/App.tsx` (modified)

**Root cause**: Any unhandled React render error produced a completely blank white screen with no feedback to the user or developers.

**Fix**: Created a React class component Error Boundary. Catches all render-phase errors via `componentDidCatch`, displays an error panel with the error message and a Reload button instead of a blank screen.

```tsx
// App.tsx — wraps entire app tree
<ErrorBoundary>
  <AuthProvider>
    <BrowserRouter>...</BrowserRouter>
  </AuthProvider>
</ErrorBoundary>
```

---

#### Browser Cache Serving Stale JS After Build ✅ FIXED
**Files**: `frontend/public/.htaccess`, LiteSpeed vhost config

**Root cause (two separate issues)**:
1. LiteSpeed vhost had a `context /index.html` block with no-cache headers — this ONLY matched direct requests for `/index.html`, not SPA rewrites (e.g., `/admin/dashboard` rewritten to `index.html`). So HTML served via SPA rewrite had no cache headers.
2. The `/assets/` context in LiteSpeed AND `.htaccess` both set `Cache-Control` on assets — two conflicting headers caused Cloudflare to set `cf-cache-status: BYPASS` and serve stale bundles.

**Fix 1 — `.htaccess` uses `Header always set`**:
```apache
# Applies to ALL .html responses including SPA rewrites
<FilesMatch "\.html$">
  Header always set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
  Header always set Pragma "no-cache"
  Header always set Expires "0"
</FilesMatch>
<FilesMatch "\.(js|css|woff2?|ttf|eot|svg|png|jpg|webp|ico)$">
  Header always set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
```

**Fix 2 — LiteSpeed vhost config** (`/usr/local/lsws/conf/vhosts/donor-management.nokshaojibon.com/vhconf.conf`):
- Root context `/` — SPA rewrite rules only, NO extra cache headers (prevents double-header conflict)
- `/assets/` context — `Cache-Control: public, max-age=31536000, immutable` (one source of truth)

---

#### VolunteerRecordsPanel Complete Rewrite ✅
**File**: `frontend/src/pages/admin/VolunteerRecordsPanel.tsx` (813 lines)

**Root cause**: Previous implementation had incorrect field names, missing interface definitions, and wrong API response access patterns (`res.data` instead of `res.data.data`), causing the panel to silently fail or display empty data.

**Rewrite includes**:
- Correct TypeScript interfaces matching DB column names (`volunteer_id`, `badge_number`, `issue_date`, `expiry_date`, `card_status`, etc.)
- All API calls using `res.data?.data` access pattern
- Tab 1 — ID Cards: issue new card form, badge number auto-generation, revoke with confirm, card status badges
- Tab 2 — Certificates: award certificate form, certificate type selector, expiry date, revoke action
- Tab 3 — Messages: compose form with recipient volunteer selector, subject+body fields, message history table

---

#### Missing `GET /api/v1/volunteers` Route ✅ FIXED
**File**: `src/routes/volunteers.routes.ts`

Added root `GET /` endpoint returning volunteer list:
```typescript
router.get('/', authenticate, async (req, res) => {
  const volunteers = await db('dfb_volunteers as v')
    .select('v.volunteer_id', 'u.first_name', 'u.last_name', 'v.badge_number', 'v.status')
    .join('dfb_users as u', 'u.user_id', 'v.user_id')
    .where('v.status', 'active')
    .orderBy('u.last_name');
  res.json({ success: true, data: volunteers });
});
```

---

#### `volunteer-records` orderBy Field Error ✅ FIXED
**File**: `src/routes/volunteer-records.routes.ts`

**Root cause**: Query used `.orderBy('a.issued_at')` but the actual DB column is `issue_date`.

**Fix**: Changed to `.orderBy('a.issue_date', 'desc')`.

---

#### App.tsx Settings URL Fix ✅ FIXED
**File**: `frontend/src/App.tsx`

**Root cause**: App was fetching `/api/v1/settings/public` on load — this route does not exist. The correct route is `/api/v1/public/settings`.

**Fix**: Changed fetch URL to `/api/v1/public/settings` and fixed response access to `res.data.data` (was `res.data`).

---

### Summary of All Changes

| File | Change |
|---|---|
| `frontend/src/context/AuthContext.tsx` | Normalize `/auth/me` snake_case → camelCase fields |
| `frontend/src/pages/admin/DashboardStats.tsx` | Fix `toFixed` crash — DECIMAL strings from MariaDB |
| `frontend/src/components/ErrorBoundary.tsx` | New: React Error Boundary class component |
| `frontend/src/App.tsx` | Wrap with `<ErrorBoundary>`, fix settings URL + response parsing |
| `frontend/src/pages/admin/VolunteerRecordsPanel.tsx` | Complete rewrite (813 lines) — correct field names and API access |
| `src/routes/volunteers.routes.ts` | Add `GET /` volunteer list endpoint |
| `src/routes/volunteer-records.routes.ts` | Fix `orderBy('a.issued_at')` → `orderBy('a.issue_date')` |
| `frontend/public/.htaccess` | Use `Header always set` for HTML no-cache (covers SPA rewrites) |
| LiteSpeed vhost config | Remove double Cache-Control headers — root context rewrite only, assets context for immutable cache |

### Deployment Status

| Step | Result |
|---|---|
| TypeScript compile (`npx tsc`) | ✅ Exit 0 — clean |
| Frontend build (`npm run build`) | ✅ Built successfully |
| Current JS bundle | `index-DhqGanM0.js` |
| Current CSS bundle | `index-CBK6a0Zn.css` |
| PM2 restart (4 instances) | ✅ All online, stable |
| LiteSpeed graceful restart | ✅ Applied |
| Cloudflare cache purge | ✅ Assets purged after build |
| GitHub push | ✅ `fa2053d` on main |

---

## Phase 10 — UX/Access Refinements & Panel-Separated Auth (March 12, 2026)

**Commits**: `d1306d3` (+ follow-up hotfixes)

### UI Visibility & Typography Fixes ✅

- Fixed low-contrast "DFB Portal" login text visibility issue.
- Fixed oversized admin headings across devices by resolving root CSS specificity conflict in theme overrides.
- Added admin-manageable heading controls (size/weight) through UI settings.
- Stabilized notification popup rendering on mobile with fixed top panel behavior.
- Repaired landing page layout breakage: responsive hero overflow, navbar spacing, and mobile text scaling.

### Authentication Flow Separation ✅

- Added panel selection gateway page for clearer role-based login/registration.
- Implemented panel-aware login behavior with role mismatch handling.
- Implemented panel-aware register behavior:
  - donor self-registration allowed,
  - admin self-register blocked,
  - volunteer redirected to dedicated application flow.
- Added dedicated volunteer application route and landing page CTA wiring.

### Files Added / Updated (Key)

- `frontend/src/pages/AuthPortal.tsx`
- `frontend/src/pages/VolunteerApply.tsx` (initial version)
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/PublicHome.tsx`
- `frontend/src/context/ThemeContext.tsx`
- `frontend/src/components/NotificationBell.tsx`

---

## Phase 11 — Dynamic Volunteer Onboarding Platform (March 12, 2026)

**Commits**: `ab076d0`, `41783cd`

### Dynamic Volunteer Form & Storage ✅

- Extended dynamic form schema support with `volunteer_application` form type.
- Volunteer form now loads active schema dynamically and renders fields from schema JSON.
- Added strict required-field validation against active schema.
- Full submission payload stored in DB for future schema evolution compatibility.

### Required Volunteer Data Coverage ✅

Implemented capture and storage for:
- name, father's name, date of birth,
- blood group,
- education level,
- mobile number,
- email,
- NID/Birth Certificate number,
- division, district, upazila,
- full address,
- passport photo URL,
- identity document URL,
- consent status + consent text + consent timestamp.

### Bangladesh Cascading Location Dropdowns ✅

- Integrated `bangladesh-location-data`.
- Added division → district → upazila automatic cascading behavior.
- Added resilient field-name matching so dynamic schema variants still map location fields correctly.

### File Upload & KYC Constraints ✅

- Added public upload endpoint for volunteer onboarding:
  - `POST /api/v1/media/public-upload`
  - 500KB max file size
  - allowed types: JPEG, PNG, WEBP, PDF
- Added client-side 500KB validation before upload.

### Dynamic Consent Text ✅

- Added `legal.volunteer_application_consent_text` system setting.
- Volunteer form now loads consent text dynamically from public settings.
- Fallback to `legal.gdpr_consent_text` if volunteer-specific text is not set.

### Admin Form Preset Productivity ✅

- Added one-click preset button in Form Schemas admin editor to auto-load default volunteer schema JSON.
- Button label: **Load Volunteer Default Preset**.

### API Error & Stability Fixes ✅

- Fixed public schema 404 for volunteer form type by returning a default schema when no active volunteer schema exists.
- Seeded default active volunteer schema in SQL and in live DB where missing.
- Reduced Socket.IO timeout noise by:
  - connecting only when auth token exists,
  - using stable polling transport configuration,
  - lowering repeated hard-error logging.

### Volunteer Form UI Contrast Fix ✅

- Fixed dropdown option text visibility issue on `/volunteer-apply` where option text appeared white/invisible on light native dropdown backgrounds.
- Enforced high-contrast select styling (`bg-white` + dark text) and explicit option text color for:
  - blood group,
  - education level,
  - division,
  - district,
  - upazila,
  - other dynamic select fields.

**File updated**: `frontend/src/pages/VolunteerApply.tsx`

### Database Alignment ✅

Updated schema and live DB columns to support dynamic volunteer workflow:
- `dfb_form_schemas.form_type` includes `volunteer_application`
- `dfb_volunteer_applications` new fields:
  `father_name`, `date_of_birth`, `blood_group`, `education_level`,
  `mobile_number`, `nid_or_birth_certificate_no`, `full_address`,
  `division`, `district`, `upazila`,
  `passport_photo_url`, `identity_document_url`,
  `consent_given`, `consent_text`, `consent_given_at`, `form_payload`
- Seeded setting: `legal.volunteer_application_consent_text`
- Seeded default active volunteer schema row

### Key Files Updated in Phase 11

- `src/routes/volunteer-applications.routes.ts`
- `src/routes/form-schemas.routes.ts`
- `src/routes/media.routes.ts`
- `src/routes/admin.routes.ts`
- `database/schema.sql`
- `frontend/src/pages/VolunteerApply.tsx`
- `frontend/src/pages/admin/FormSchemasPanel.tsx`
- `frontend/src/hooks/useSocket.ts`

---

## Phase 12 — Commit Traceability Addendum (March 12, 2026)

This section closes gaps between implemented fixes and documentation by mapping major hotfix commits to delivered outcomes.

### UX + Admin Visual Tuning Chain ✅

| Commit | Scope | Outcome |
|---|---|---|
| `b97c8b1` | Admin UI Design Studio | Introduced admin-driven theme customization capability |
| `535e7ed` | Admin headings | Reduced oversized heading scale in admin panels |
| `eaeb2ab`, `e48c95c`, `8b427e5` | Typography normalization | Deep heading-size normalization across panels/devices |
| `f40f6bf` | UI settings | Added admin-manageable heading size/weight controls |
| `a72ce5d` | Notifications | Fixed mobile notification popup layout/positioning |
| `ec7ad63` | Public landing | Fixed hero overflow and mobile layout breakage |

### Auth & Panel Routing Chain ✅

| Commit | Scope | Outcome |
|---|---|---|
| `d1306d3` | Auth routing | Panel-specific login/registration flow from landing |
| `d1306d3` | Volunteer path | Dedicated volunteer application flow entry |

### Volunteer Platform Chain ✅

| Commit | Scope | Outcome |
|---|---|---|
| `ab076d0` | Backend + frontend + DB | Implemented schema-driven volunteer application architecture |
| `41783cd` | SQL seed | Added default active volunteer schema seed |
| `da9ad0e` | Reliability pass | Added schema fallback response, dropdown robustness, report update |
| `b43ef25` | UI contrast | Fixed unreadable dropdown option text in volunteer form |

---

## Phase 13 — Real-Time Transport Hardening & Runtime Topology (March 12, 2026)

**Commits**: `48e92bb`, `612224b`, `b43ef25`

### Socket.IO 400 Polling Session Errors — Root Cause & Fix ✅

**Observed issue**
- Browser console showed repeated polling `400 Bad Request` errors on `/socket.io` (`xhr post error`, `xhr poll error`, `transport error`).

**Root cause**
- Session-oriented polling traffic (`sid`) became unstable under multi-instance PM2 cluster routing without sticky affinity.
- Duplicate socket initializations from multiple frontend consumers increased reconnect churn.

**Implemented fix set**
- Refactored socket client hook to a shared singleton connection pool per namespace.
- Kept auth-gated socket connect behavior (no token => no socket attempt).
- Finalized client transport order to `polling` then `websocket` for reliable connect and optional upgrade.
- Kept server transports enabled as `websocket` + `polling`.
- Updated PM2 app topology to single `dfb-api` instance to remove cross-worker polling sid mismatch.

### Runtime & Validation Status ✅

- Build status: backend + frontend compile successful after transport/topology updates.
- Runtime status: `pm2` running `dfb-api` with 1 instance (stable mode).
- Health check: `GET /health` returns OK.
- Socket probe: production client handshake/connect succeeds using configured transport order.

### Files Updated in Phase 13

- `frontend/src/hooks/useSocket.ts`
- `src/index.ts`
- `ecosystem.config.js`
- `frontend/src/pages/VolunteerApply.tsx`
- `implementation-report.md`

---

## Phase 14 — Volunteer Platform Consolidation, Dynamic Document Engine, and Release Verification (March 13, 2026)

**Release commit**: `0d7efc1`

### Volunteer Navigation Consolidation ✅

- Replaced fragmented volunteer sidebar entries with a single **Volunteer Hub** entry.
- Added unified tabbed platform for:
  - Volunteer Directory,
  - Applications,
  - Records / IDs / Certificates.
- Added backward-compatible redirects:
  - `/admin/volunteers` → `/admin/volunteer-hub?tab=people`
  - `/admin/vol-applications` → `/admin/volunteer-hub?tab=applications`
  - `/admin/vol-records` and `/admin/vms` → `/admin/volunteer-hub?tab=records`

### Advanced ID Card + Certificate Engine (2026-grade) ✅

Implemented dynamic generation pipeline end-to-end:

- Template-level dynamic JSON fields and layout metadata.
- Auto QR generation per issued ID card and certificate.
- Issuance-time render payload snapshots.
- Stored rendered HTML snapshots for audit and re-open/view workflows.
- Template preview endpoints and issued render retrieval endpoints.
- Template update/delete with in-use delete guards.

### Schema Expansion & Compatibility ✅

Confirmed migration chain and active DB state:

- `20260313180000_create_vms_core_tables.ts`
- `20260313210000_unify_volunteer_systems_and_modernize_certificates.ts`
- `20260313224000_add_dynamic_generation_fields_to_volunteer_records.ts`

All listed migrations are applied and no pending migration remains.

### Tooling Reliability Hardening ✅

Fixed a migration tooling runtime issue in `knexfile.ts`:

- Replaced `__dirname`-based `.env` resolution with `process.cwd()` path resolution.
- Result: `npx knex migrate:status --knexfile knexfile.ts` now works reliably in this runtime.

### Verification Matrix (Executed) ✅

1) **Static and build checks**
- Backend build: pass
- Frontend build: pass
- IDE/runtime problems scan: no errors

2) **Runtime and route smoke checks**
- `/health` returns `200`
- Public VMS settings endpoint returns `200`
- Protected endpoints return `401` without token (expected)
- Auth login returns `200` and access token

3) **Authenticated E2E API checks (volunteer records)**
- ID template create/update/preview: pass
- ID card issue/render: pass
- Certificate template create/update/preview: pass
- Certificate issue/render: pass
- Delete used template guard (`409`): pass
- Delete unused template (`200`): pass

### Deployment Status ✅

- Branch: `main`
- Remote: `origin` (`jasminnaharbiva/donor-management`)
- Pushed successfully to GitHub main:
  - `b20b1c6..0d7efc1  main -> main`
- Post-push working tree: clean

---

## Phase 15 — Donor Records, Privacy Boundaries, and Access-Control Verification (March 13, 2026)

### Donor Records Module (Admin + Donor) ✅

Implemented a dedicated donor-records system with full admin issuance and donor self-service visibility.

- New backend route module: `src/routes/donor-records.routes.ts`
  - Donor ID template CRUD, preview, issue, render, revoke
  - Donor certificate template CRUD, preview, issue, render
  - Admin-to-donor messaging
  - Donor self endpoints under `/api/v1/donor-records/my/*`
- New migration: `20260313235900_add_donor_records_and_privacy_fields.ts`
  - Added donor profile fields: `country`, `profession`
  - Added donor record tables:
    - `dfb_donor_id_card_templates`
    - `dfb_donor_id_cards`
    - `dfb_donor_certificate_templates`
    - `dfb_donor_certificate_awards`
    - `dfb_donor_messages`
- API mounted in `src/index.ts` at `/api/v1/donor-records`.

### Frontend Integration ✅

- New admin panel: `frontend/src/pages/admin/DonorRecordsPanel.tsx`
  - Template management, issuance workflows, render previews, donor messaging.
- New donor page: `frontend/src/pages/donor/DonorRecordsPage.tsx`
  - “My ID Cards”, “My Certificates”, “My Messages”.
- Dashboard wiring:
  - `frontend/src/pages/admin/AdminDashboard.tsx` → new `Donor Records` route/menu.
  - `frontend/src/pages/donor/DonorDashboard.tsx` → new `My Records` route/menu.

### Registration & Volunteer Flow Correction ✅

Per user requirement, volunteer onboarding remains unchanged from prior approved flow.

- Donor registration enhancements:
  - `frontend/src/pages/Register.tsx` now submits donor-only registration payload (`role: Donor`) with optional country/profession dropdowns.
  - `src/routes/auth.routes.ts` supports optional donor `phone`, `country`, `profession`.
- Volunteer registration guard:
  - `src/routes/auth.routes.ts` now rejects `role=Volunteer` on `/auth/register` with `403`, preserving volunteer application-and-approval onboarding.
- Public registration option seeds added in `src/routes/admin.routes.ts`:
  - `registration.country_options`
  - `registration.profession_options`

### Access-Control & Privacy Hardening ✅

- Enforced stricter admin-only protection on global endpoints (`projects`, `campaigns`, selected dashboard and timesheet list endpoints).
- Donor-facing self endpoints added for scope-safe reads:
  - `/api/v1/donors/me/projects`
  - `/api/v1/donors/me/impact`
  - `/api/v1/donations/my`
- Corrected donor self record route usage to `/donor-records/my/*` in frontend.

### Verification Matrix (Executed) ✅

1) **Build + migration**
- `npm run migrate`: pass (`Batch 4 run: 1 migrations`)
- Backend build: pass
- Frontend build: pass

2) **Runtime authorization matrix**
- `donor -> /api/v1/donor-records/id-card-templates` = `403` (expected)
- `admin -> /api/v1/donor-records/id-card-templates` = `200` (expected)
- `donor -> /api/v1/projects` = `403` (expected)
- `donor -> /api/v1/donors/me/projects` = `200` (expected)

3) **Donor-record lifecycle checks**
- Issue donor ID card = `201`
- Issue donor certificate = `201`
- Donor self ID cards (`/my/id-cards`) = `200`
- Donor self certificates (`/my/certificates`) = `200`
- Donor self messages (`/my/messages`) = `200`

---

## Phase 16 — Beneficiary Application Workflow (Volunteer → Admin Review → Donor Funding View) (March 14, 2026)

### End-to-End Workflow Delivered ✅

Implemented a full beneficiary application system where:

1. **Volunteer submits** a detailed beneficiary case application.
2. **Admin reviews** and can approve/reject/request changes.
3. On approval, admin can:
   - assign a volunteer,
   - tag a donor,
   - enable interested-donor visibility,
   - link/create project workflow metadata,
   - create beneficiary master record from the approved application.
4. **Donor can view** approved applications when tagged or when marked as open to interested donors.

### Backend Additions ✅

- New migration: `20260314102000_add_beneficiary_application_workflow.ts`
  - Adds `dfb_beneficiary_applications` table.
  - Extends `dfb_form_schemas.form_type` enum with `beneficiary_application`.
- New route module: `src/routes/beneficiary-applications.routes.ts`
  - `GET /api/v1/beneficiary-applications/my` (volunteer own submissions)
  - `GET /api/v1/beneficiary-applications` (admin list/filter)
  - `GET /api/v1/beneficiary-applications/:id` (role-scoped detail)
  - `POST /api/v1/beneficiary-applications` (volunteer submit)
  - `PATCH /api/v1/beneficiary-applications/:id/review` (admin review actions)
  - `GET /api/v1/beneficiary-applications/for-funding` (donor funding visibility)
- Router mounted in `src/index.ts` at `/api/v1/beneficiary-applications`.

### Dynamic Form & Admin Flexibility ✅

- Extended dynamic form schema support:
  - `src/routes/form-schemas.routes.ts` supports `beneficiary_application` form type.
  - Provides fallback default schema when no active schema exists.
- Admin schema editor updated:
  - `frontend/src/pages/admin/FormSchemasPanel.tsx` includes `beneficiary_application` in form types.
  - Added one-click “Load Beneficiary Default Preset” for fast initialization.

### Volunteer Form UI ✅

- New volunteer page: `frontend/src/pages/volunteer/BeneficiaryApplicationPage.tsx`
  - Dynamic schema-driven field rendering.
  - Bangladesh location cascade (division → district → upazila) + village support.
  - Per-file upload constraints by document kind.
  - Submission history visible to volunteer.
- Volunteer dashboard integration:
  - `frontend/src/pages/volunteer/VolunteerDashboard.tsx` adds menu + route:
    - `/volunteer/beneficiary-applications`

### File Upload Security & Limits ✅

- Added authenticated upload endpoint:
  - `POST /api/v1/media/beneficiary-upload`
- Validation policy:
  - Identity/passport/nationality docs: **max 500KB**
  - Additional document: **max 5MB**
  - Allowed mime types: JPEG, PNG, WEBP, PDF
- Implemented in: `src/routes/media.routes.ts`

### Admin Review Panel Upgrade ✅

- Upgraded `frontend/src/pages/admin/BeneficiariesPanel.tsx` to dual-mode operations:
  - **Applications tab** (review queue with action modal)
  - **Beneficiaries tab** (existing beneficiary records view)
- Admin can update status + review notes and apply approval linkage metadata:
  - assigned volunteer, tagged donor, linked project,
  - open-to-interested-donors flag,
  - fundraiser-required flag,
  - create-beneficiary-on-approve flag.

### Access-Control Hardening ✅

- Restricted direct beneficiary creation endpoint:
  - `POST /api/v1/beneficiaries` now admin-only.
  - Volunteers must use `/api/v1/beneficiary-applications` workflow.

### Configuration Seeds ✅

Added public/admin-manageable settings in `src/routes/admin.routes.ts`:

- `beneficiary_application.project_type_options`
- `beneficiary_application.villages_by_upazila`

### Verification Matrix (Re-Executed) ✅

1) **Build + migration**
- `npm run migrate` → up to date after applying Batch 5 migration.
- Backend build (`tsc`) → pass.
- Frontend build (`tsc -b && vite build`) → pass.

2) **Runtime workflow smoke**
- Health endpoint `/health` = `200`.
- Volunteer submit beneficiary application = `201`.
- Donor submit beneficiary application = `403` (expected).
- Admin approve review action = `200`.
- Donor funding list endpoint = `200` and includes approved application.
- Donor approved-application detail view = `200`.
- Volunteer direct create `/api/v1/beneficiaries` = `403` (expected).

3) **Upload rule smoke**
- 2-byte identity PDF upload = success.
- 600KB identity PDF upload = rejected (`max 500KB` enforced).
- 600KB additional PDF upload = success (`<=5MB` enforced).


