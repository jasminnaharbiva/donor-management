import { db } from './src/config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function createAdmin() {
  const plainPassword = 'SuperSecretPassword2026!';
  const hashedPassword = await bcrypt.hash(plainPassword, 12);
  const userId = uuidv4();

  await db('dfb_users').insert({
    user_id: userId,
    email: 'admin@donor-management.nokshaojibon.com',
    password_hash: hashedPassword,
    role_id: 1, // Super Admin
    status: 'active',
    failed_login_attempts: 0,
    two_fa_enabled: 0
  });

  console.log(`\n✅ Super Admin created successfully!`);
  console.log(`Email: admin@donor-management.nokshaojibon.com`);
  console.log(`Password: ${plainPassword}`);
  process.exit(0);
}

createAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
