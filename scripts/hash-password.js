/**
 * 비밀번호 해싱 유틸리티
 *
 * 사용법:
 * node scripts/hash-password.js [비밀번호]
 *
 * 예시:
 * node scripts/hash-password.js 1234
 */

require('dotenv').config();
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10; // bcrypt salt rounds (10은 권장값)

async function hashPassword(plainPassword) {
  try {
    console.log('비밀번호 해싱 중...\n');

    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    console.log('✅ 해싱 완료!\n');
    console.log('평문 비밀번호:', plainPassword);
    console.log('해시된 비밀번호:', hashedPassword);
    console.log('\n데이터베이스 업데이트 SQL 예시:');
    console.log(`UPDATE 사용자 SET 로그인비밀번호 = '${hashedPassword}' WHERE 사용자코드 = '0001';`);
    console.log('\n⚠️  주의: 해시된 비밀번호는 60자 이상이므로 DB 컬럼 크기를 VARCHAR(100) 이상으로 변경해야 합니다.');

  } catch (error) {
    console.error('❌ 해싱 실패:', error.message);
    process.exit(1);
  }
}

// 커맨드라인 인자 처리
const password = process.argv[2];

if (!password) {
  console.error('❌ 비밀번호를 입력해주세요.');
  console.log('\n사용법: node scripts/hash-password.js [비밀번호]');
  console.log('예시: node scripts/hash-password.js 1234');
  process.exit(1);
}

hashPassword(password);
