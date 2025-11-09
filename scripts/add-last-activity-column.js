require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

async function addLastActivityColumn() {
  try {
    console.log('데이터베이스 연결 중...');
    await sql.connect(config);
    console.log('✅ 연결 성공');

    // Check if column already exists
    console.log('\n컬럼 존재 여부 확인 중...');
    const checkResult = await sql.query`
      SELECT COUNT(*) as cnt
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = N'사용자'
        AND COLUMN_NAME = N'마지막활동시간'
    `;

    if (checkResult.recordset[0].cnt > 0) {
      console.log('⚠️  마지막활동시간 컬럼이 이미 존재합니다. 마이그레이션을 건너뜁니다.');
      await sql.close();
      return;
    }

    console.log('✅ 컬럼이 존재하지 않음. 추가를 시작합니다.\n');

    // Add column
    console.log('마지막활동시간 컬럼 추가 중...');
    await sql.query`
      ALTER TABLE 사용자
      ADD 마지막활동시간 VARCHAR(17) NULL
    `;
    console.log('✅ 컬럼 추가 완료');

    // Set default value for existing logged-in users
    console.log('\n로그인 중인 사용자의 마지막활동시간 초기화 중...');
    const updateResult = await sql.query`
      UPDATE 사용자
      SET 마지막활동시간 = 시작일시
      WHERE 로그인여부 = 'Y'
        AND 마지막활동시간 IS NULL
    `;
    console.log(`✅ ${updateResult.rowsAffected[0]}명의 사용자 초기화 완료`);

    console.log('\n='.repeat(80));
    console.log('✅ 마이그레이션 완료!');
    console.log('='.repeat(80));

    await sql.close();
  } catch (err) {
    console.error('\n❌ 오류 발생:', err);
    process.exit(1);
  }
}

addLastActivityColumn();
