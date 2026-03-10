import { db } from './src/config/database';
import { encrypt, sha256Hash } from './src/utils/crypto';

async function updateAdminBlindIndex() {
  const plainEmail = 'admin@donor-management.nokshaojibon.com';
  const emailHash = sha256Hash(plainEmail.toLowerCase());

  await db('dfb_users')
    .where('role_id', 1)
    .update({
      email_hash: emailHash,
    });

  console.log(`\n✅ Blind Index hashed and stored!`);
  process.exit(0);
}

updateAdminBlindIndex().catch(err => {
  console.error(err);
  process.exit(1);
});
