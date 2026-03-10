# DFB Donor Management — Credentials & Access Reference

> **KEEP PRIVATE** — Do not commit this file to any public repository.

---

## Live URLs

| Resource | URL |
|---|---|
| **Public Home** | https://donor-management.nokshaojibon.com |
| **Admin Dashboard** | https://donor-management.nokshaojibon.com/admin |
| **Donor Portal** | https://donor-management.nokshaojibon.com/donor |
| **Volunteer Portal** | https://donor-management.nokshaojibon.com/volunteer |
| **Register** | https://donor-management.nokshaojibon.com/register |
| **API Base** | https://donor-management.nokshaojibon.com/api/v1 |
| **API (local)** | http://localhost:3002/api/v1 |

---

## Login Accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| **Super Admin** | admin@dfb.org | Admin@2026 | Full access to all admin panels |
| **Volunteer** | volunteer@dfb.org | Volunteer@2026 | Access volunteer portal |
| **Donor** | donor@dfb.org | Donor@1234 | Access donor portal |

---

## Database

| Item | Value |
|---|---|
| **Database type** | MariaDB 10.11.15 |
| **Database name** | donor_management |
| **Host** | localhost |
| **Port** | 3306 |
| **Root user** | root |
| **Root password** | DonorMgmt_2026 |
| **App user** | dfb_user |
| **App password** | DFB_Secure_2026_db |

### Connect via CLI
```bash
mysql -u root -p'DonorMgmt_2026' donor_management
# or as app user:
mysql -u dfb_user -p'DFB_Secure_2026_db' donor_management
```

### Key Tables (45 total)
- `dfb_users` — all system users
- `dfb_donors` — donor profiles (encrypted email/phone)
- `dfb_volunteers` — volunteer profiles
- `dfb_funds` — fund accounts with current_balance
- `dfb_campaigns` — fundraising campaigns
- `dfb_transactions` — all donation transactions
- `dfb_allocations` — fund allocation records
- `dfb_expenses` — volunteer expense claims
- `dfb_timesheets` — volunteer hours
- `dfb_shifts` — volunteer shift schedules
- `dfb_pledges` — donation pledges
- `dfb_recurring_donations` — recurring subscriptions
- `dfb_notifications` — user notifications
- `dfb_announcements` — system announcements
- `dfb_beneficiaries` — aid recipients
- `dfb_audit_logs` — audit trail
- `dfb_integrity_hashes` — tamper detection
- `dfb_roles`, `dfb_permissions`, `dfb_role_permissions` — RBAC

---

## Server Infrastructure

| Item | Value |
|---|---|
| **Server OS** | Linux (VPS) |
| **Web server** | LiteSpeed (80/443 → proxies to Node :3002) |
| **Process manager** | PM2 6.0.14, cluster mode, 4 instances |
| **PM2 app name** | dfb-api |
| **API port** | 3002 |
| **Node.js** | Latest LTS |

### PM2 Commands
```bash
pm2 status           # View all processes
pm2 logs dfb-api     # View live logs
pm2 restart dfb-api  # Restart API
pm2 reload dfb-api   # Zero-downtime reload
```

---

## Deployment

### Backend
```bash
cd /home/donor-management.nokshaojibon.com/public_html
npx tsc              # Compile TypeScript → dist/
pm2 restart dfb-api  # Apply changes
```

### Frontend
```bash
cd /home/donor-management.nokshaojibon.com/public_html/frontend
npm run build        # Build React → dist/ (served as static files)
```

---

## GitHub

| Item | Value |
|---|---|
| **Repository** | jasminnaharbiva/donor-management |
| **Branch** | main |
| **SSH key** | ~/.ssh/github |

### Git Push
```bash
cd /home/donor-management.nokshaojibon.com/public_html
git add .
git commit -m "your message"
GIT_SSH_COMMAND="ssh -i ~/.ssh/github" git push origin main
```

---

## Security

| Item | Value |
|---|---|
| **JWT access token TTL** | 15 minutes |
| **JWT refresh token TTL** | 30 days |
| **Token storage** | localStorage (`token`, `refreshToken`) |
| **Encryption** | AES-256-GCM for PII (email, phone) |
| **AES key** | See `.env` file — 32-byte key |
| **Password hashing** | bcrypt, cost factor 12 |

---

## Email (Notifications)

- **Development**: Ethereal test SMTP (auto-created, preview at https://ethereal.email)
- **Production**: Configure SMTP in `.env`:
  ```
  EMAIL_HOST=smtp.example.com
  EMAIL_PORT=587
  EMAIL_USER=your@email.com
  EMAIL_PASS=yourpassword
  EMAIL_FROM_NAME=DFB Foundation
  EMAIL_FROM_ADDRESS=noreply@yourdomain.com
  ```

---

## File Paths

| Resource | Path |
|---|---|
| **Project root** | /home/donor-management.nokshaojibon.com/public_html/ |
| **Backend source** | public_html/src/ |
| **Backend compiled** | public_html/dist/ |
| **Frontend source** | public_html/frontend/src/ |
| **Frontend built** | public_html/frontend/dist/ |
| **Static files served** | public_html/ (index.html + assets) |
