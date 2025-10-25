// DB 연결 테스트 스크립트
require('dotenv').config();
const sql = require('mssql');

async function testConnection() {
  console.log('================================================================================');
  console.log('데이터베이스 연결 테스트');
  console.log('================================================================================\n');

  console.log('환경 변수 확인:');
  console.log(`  DB_USER: ${process.env.DB_USER || '(설정안됨)'}`);
  console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '****' : '(설정안됨)'}`);
  console.log(`  DB_SERVER: ${process.env.DB_SERVER || '(설정안됨)'}`);
  console.log(`  DB_DATABASE: ${process.env.DB_DATABASE || '(설정안됨)'}`);
  console.log(`  DB_PORT: ${process.env.DB_PORT || '1433'}\n`);

  // 필수 환경변수 체크
  if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_SERVER) {
    console.error('❌ 필수 환경변수가 설정되지 않았습니다!');
    console.error('   .env 파일에 DB_USER, DB_PASSWORD, DB_SERVER를 설정해주세요.\n');
    process.exit(1);
  }

  const config = {
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

  console.log('연결 시도 중...');

  try {
    const pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공!\n');

    // 테스트 쿼리 실행
    console.log('테스트 쿼리 실행 중...');
    const result = await pool.request().query('SELECT @@VERSION AS Version');
    console.log('✅ 쿼리 실행 성공!');
    console.log(`   SQL Server 버전: ${result.recordset[0].Version.split('\n')[0]}\n`);

    // 주요 테이블 존재 여부 확인
    console.log('주요 테이블 확인 중...');
    const tables = ['견적', '견적내역', '매출처', '매입처', '자재', '사용자'];

    for (const table of tables) {
      const checkResult = await pool.request()
        .input('tableName', sql.VarChar, table)
        .query(`
          SELECT COUNT(*) AS cnt
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_NAME = @tableName
        `);

      if (checkResult.recordset[0].cnt > 0) {
        console.log(`   ✓ ${table} 테이블 존재`);
      } else {
        console.log(`   ✗ ${table} 테이블 없음`);
      }
    }

    await pool.close();

    console.log('\n================================================================================');
    console.log('테스트 완료! 데이터베이스 연결이 정상적으로 작동합니다.');
    console.log('================================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ 연결 실패!\n');
    console.error('오류 메시지:', err.message);

    if (err.message.includes('Login failed')) {
      console.error('\n💡 해결 방법: DB_USER 또는 DB_PASSWORD가 올바른지 확인하세요.');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.error('\n💡 해결 방법: DB_SERVER 주소와 포트가 올바른지 확인하세요.');
      console.error('   SQL Server가 실행 중인지 확인하세요.');
    } else if (err.message.includes('database')) {
      console.error('\n💡 해결 방법: DB_DATABASE 이름이 올바른지 확인하세요.');
    }

    console.error('\n');
    process.exit(1);
  }
}

testConnection();
