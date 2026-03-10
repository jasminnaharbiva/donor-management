import { db } from './src/config/database';
import bcrypt from 'bcrypt';
import { encrypt } from './src/utils/crypto';

async function testLogin() {
  const email = 'admin@donor-management.nokshaojibon.com';
  const password = 'SuperSecretPassword2026!';

  console.log(`Testing Login Flow:`);
  console.log(`Email provided: ${email}`);
  
  const encryptedEmail = encrypt(email);
  console.log(`Encrypted email: ${encryptedEmail}`);

  let user = await db('dfb_users').where({ email: encryptedEmail }).first();
  console.log(`User lookup by encrypted email: ${user ? 'FOUND' : 'NOT FOUND'}`);

  if (!user) {
    console.log(`Checking all users...`);
    const allUsers = await db('dfb_users').select('email', 'password_hash', 'deleted_at', 'status', 'locked_until', 'failed_login_attempts');
    console.log(`All users:`, allUsers);

    // Let's try comparing encrypted email manually
    console.log(`Comparing against all users:`);
    for (const u of allUsers) {
      if (u.email === encryptedEmail) {
        console.log(`Wait, email matched in iteration but not query!`);
      }
    }
    process.exit(1);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  console.log(`Password validation against hash [${user.password_hash}]: ${valid ? 'PASSED' : 'FAILED'}`);

  console.log(`Deleted at: ${user.deleted_at}`);
  console.log(`Status: ${user.status}`);
  console.log(`Failed attempts: ${user.failed_login_attempts}`);
  console.log(`Locked until: ${user.locked_until}`);

  process.exit(0);
}

testLogin().catch(err => {
  console.error(err);
  process.exit(1);
});
