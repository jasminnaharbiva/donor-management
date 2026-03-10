# Database Credentials Template

> **Copy this file to `DATABASE.md` and fill in your actual values.**
> `DATABASE.md` is gitignored and never committed — credentials stay on the server only.

---

## MariaDB (MySQL)

| Setting       | Value                       |
|---------------|-----------------------------|
| Host          | `127.0.0.1`                 |
| Port          | `3306`                      |
| Database      | `donor_management`          |
| Root User     | `root`                      |
| Root Password | `<MYSQL_ROOT_PASSWORD>`     |
| App User      | `dfb_user`                  |
| App Password  | `<APP_DB_PASSWORD>`         |
| Socket        | `/var/run/mysqld/mysqld.sock` |

### Connect as app user:
```bash
mysql -u dfb_user -p donor_management
```

---

## Redis

| Setting  | Value         |
|----------|---------------|
| Host     | `127.0.0.1`   |
| Port     | `6379`        |
| Password | *(set in .env)* |

---

## JWT & Encryption Secrets  *(stored in `.env` only — never committed)*

| Key                    | How to generate                                    |
|------------------------|----------------------------------------------------|
| `JWT_ACCESS_SECRET`    | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET`   | same as above                                      |
| `AES_ENCRYPTION_KEY`   | Must be exactly 32 bytes (256 bits)               |

---

## Application

| Setting     | Value                                            |
|-------------|--------------------------------------------------|
| API Port    | `3001`                                           |
| App URL     | `https://donor-management.nokshaojibon.com`      |
| PM2 App     | `dfb-api` (cluster mode)                         |
| Public Dir  | `/home/donor-management.nokshaojibon.com/public_html/` |

---

## GitHub

| Setting    | Value                              |
|------------|------------------------------------|
| Account    | `jasminnaharbiva`                  |
| Repository | `jasminnaharbiva/donor-management` |
| Branch     | `main`                             |
