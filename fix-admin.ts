import { db } from './src/config/database';
import { encrypt } from './src/utils/crypto';
import bcrypt from 'bcryptjs';

async function fixAdmin() {
  const plainEmail = 'admin@donor-management.nokshaojibon.com';
  const encryptedEmail = encrypt(plainEmail);

  await db('dfb_users')
    .where('role_id', 1)
    .update({
      email: encryptedEmail,
      failed_login_attempts: 0,
      locked_until: null
    });

  console.log(`\n✅ Admin email cleanly encrypted internally!`);
  process.exit(0);
}

fixAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
