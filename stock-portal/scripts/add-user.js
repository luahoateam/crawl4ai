const crypto = require('crypto');

function sha256(message) {
  return crypto.createHash('sha256').update(message).digest('hex');
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('\n❌ Thiếu tham số!');
  console.log('Sử dụng: node add-user.js <username> <password>\n');
  process.exit(1);
}

const username = args[0];
const password = args[1];
const passwordHash = sha256(password);

const userObject = {
  id: `user-${Date.now()}`,
  username: username,
  passwordHash: passwordHash,
  role: 'member',
  createdAt: new Date().toISOString()
};

const userString = JSON.stringify(userObject).replace(/"/g, '\\"');

console.log('\n==================================================');
console.log('🔑 THÀNH CÔNG: ĐÃ TẠO HASH TÀI KHOẢN HỘI VIÊN');
console.log('==================================================');
console.log(`Username:      ${username}`);
console.log(`Password:      ${password}`);
console.log(`Password Hash: ${passwordHash}`);
console.log('==================================================\n');
console.log('👉 LỆNH THÊM VÀO CLOUDFLARE KV (PRODUCTION):');
console.log(`wrangler kv:key put --binding=USER_STORE "user:${username}" "${userString}"\n`);
console.log('👉 LỆNH THÊM VÀO CLOUDFLARE KV (LOCAL DEV):');
console.log(`wrangler kv:key put --binding=USER_STORE --local "user:${username}" "${userString}"\n`);
console.log('==================================================\n');
