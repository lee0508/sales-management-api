/**
 * 모든 사용자의 로그인 상태를 초기화하는 스크립트
 *
 * 사용법: node scripts/reset-login-status.js
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'YmhDB',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function resetLoginStatus() {
  let pool;

  try {
    console.log('📡 SQL Server 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ SQL Server 연결 성공\n');

    // 로그인 상태 초기화
    console.log('🔄 모든 사용자의 로그인 상태 초기화 중...');
    const result = await pool.request().query(`
      UPDATE 사용자
      SET 로그인여부 = 'N'
      WHERE 로그인여부 = 'Y'
    `);

    console.log(`✅ 로그인 상태 초기화 완료: ${result.rowsAffected[0]}명의 사용자 업데이트됨\n`);

    // 결과 확인
    const checkResult = await pool.request().query(`
      SELECT 사용자코드, 사용자명, 로그인여부, 시작일시
      FROM 사용자
      WHERE 사용구분 = 0
      ORDER BY 사용자코드
    `);

    console.log('📋 현재 사용자 로그인 상태:');
    console.table(checkResult.recordset);

  } catch (err) {
    console.error('❌ 에러 발생:', err.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n✅ 데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
resetLoginStatus()
  .then(() => {
    console.log('\n✅ 작업 완료!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 실행 실패:', err);
    process.exit(1);
  });
