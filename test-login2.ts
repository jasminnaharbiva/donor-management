import { db } from './src/config/database';
import bcrypt from 'bcryptjs';
import { encrypt, sha256Hash } from './src/utils/crypto';

async function testLoginExact() {
  const email = 'admin@donor-management.nokshaojibon.com';
  const password = 'SuperSecretPassword2026!';

  console.log(`Email provided: ${email}`);
  const emailHash = sha256Hash(email.toLowerCase());

  console.log(`Computed Hash: ${emailHash}`);

  let user = await db('dfb_users').where({ email_hash: emailHash }).whereNull('deleted_at').first();
  console.log(`User query exact match: ${user ? 'FOUND' : 'NOT FOUND'}`);

  if (!user) {
    const all = await db('dfb_users').select('email_hash', 'deleted_at');
    console.log(all);
    process.exit(1);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  console.log(`Password Match Validation: ${valid ? 'PASSED' : 'FAILED'}`);

  console.log(`User Status:`, user.status);
  console.log(`Locked Until:`, user.locked_until);
  process.exit(0);
}

testLoginExact().catch(err => {
  console.error(err);
  process.exit(1);
});
