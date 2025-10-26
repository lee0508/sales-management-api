/**
 * 기존 사용자 비밀번호를 bcrypt 해시로 마이그레이션
 *
 * 실행 전 주의사항:
 * 1. DB 백업 필수!
 * 2. 사용자 테이블의 로그인비밀번호 컬럼을 VARCHAR(100) 이상으로 변경:
 *    ALTER TABLE 사용자 ALTER COLUMN 로그인비밀번호 VARCHAR(100);
 *
 * 사용법:
 * node scripts/migrate-passwords.js
 */

require('dotenv').config();
const sql = require('mssql');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// DB 설정 (server.js와 동일)
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
  },
};

async function migratePasswords() {
  let pool;

  try {
    console.log('🔄 데이터베이스 연결 중...\n');
    pool = await sql.connect(dbConfig);
    console.log('✅ 연결 성공!\n');

    // 평문 비밀번호를 가진 모든 사용자 조회
    const result = await pool.request().query(`
      SELECT 사용자코드, 로그인비밀번호
      FROM 사용자
      WHERE 사용구분 = 0
      AND 로그인비밀번호 IS NOT NULL
      AND LEN(로그인비밀번호) < 50
    `);

    const users = result.recordset;

    if (users.length === 0) {
      console.log('ℹ️  마이그레이션이 필요한 사용자가 없습니다.');
      return;
    }

    console.log(`📋 ${users.length}명의 사용자 비밀번호를 마이그레이션합니다...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        const plainPassword = user.로그인비밀번호;
        const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

        await pool
          .request()
          .input('사용자코드', sql.VarChar(4), user.사용자코드)
          .input('해시비밀번호', sql.VarChar(100), hashedPassword)
          .query(`
            UPDATE 사용자
            SET 로그인비밀번호 = @해시비밀번호
            WHERE 사용자코드 = @사용자코드
          `);

        console.log(`✅ 사용자 ${user.사용자코드} - 마이그레이션 완료`);
        successCount++;
      } catch (err) {
        console.error(`❌ 사용자 ${user.사용자코드} - 실패:`, err.message);
        failCount++;
      }
    }

    console.log('\n📊 마이그레이션 결과:');
    console.log(`   성공: ${successCount}명`);
    console.log(`   실패: ${failCount}명`);

    if (successCount > 0) {
      console.log('\n✅ 비밀번호 마이그레이션이 완료되었습니다!');
      console.log('⚠️  기존 평문 비밀번호로는 더 이상 로그인할 수 없습니다.');
    }

  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error.message);
    console.error('상세 오류:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 데이터베이스 연결 종료');
    }
  }
}

// 실행 확인
console.log('⚠️  경고: 이 스크립트는 모든 사용자의 비밀번호를 해시로 변환합니다.');
console.log('⚠️  반드시 데이터베이스를 백업한 후 실행하세요!');
console.log('⚠️  사용자 테이블의 로그인비밀번호 컬럼을 VARCHAR(100) 이상으로 변경했는지 확인하세요!\n');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question('계속 진행하시겠습니까? (yes/no): ', (answer) => {
  readline.close();

  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    migratePasswords();
  } else {
    console.log('❌ 마이그레이션이 취소되었습니다.');
    process.exit(0);
  }
});
