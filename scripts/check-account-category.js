// 계정과목 계정구분 확인 스크립트
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '1234',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'YmhDB',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true,
  },
};

async function checkAccounts() {
  let pool;
  try {
    console.log('🔌 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 계정구분별 건수
    console.log('📊 계정구분별 건수:');
    const countResult = await pool.request().query(`
      SELECT
        계정구분,
        CASE 계정구분
          WHEN 'A' THEN '자산'
          WHEN 'L' THEN '부채'
          WHEN 'C' THEN '자본'
          WHEN 'R' THEN '수익'
          WHEN 'E' THEN '비용'
          ELSE '기타'
        END AS 구분명,
        COUNT(*) AS 건수
      FROM 계정과목
      WHERE 사용구분 = 0
      GROUP BY 계정구분
      ORDER BY 계정구분
    `);
    console.table(countResult.recordset);

    // 2. 주요 계정과목 샘플
    console.log('\n📋 주요 계정과목 샘플 (상위 30개):');
    const sampleResult = await pool.request().query(`
      SELECT TOP 30
        계정코드,
        계정명,
        계정구분,
        CASE 계정구분
          WHEN 'A' THEN '자산 (차변↑)'
          WHEN 'L' THEN '부채 (대변↑)'
          WHEN 'C' THEN '자본 (대변↑)'
          WHEN 'R' THEN '수익 (대변↑)'
          WHEN 'E' THEN '비용 (차변↑)'
          ELSE '기타'
        END AS 계정성격
      FROM 계정과목
      WHERE 사용구분 = 0
      ORDER BY 계정코드
    `);
    console.table(sampleResult.recordset);

    console.log('\n✅ 계정과목 확인 완료!');

  } catch (err) {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 데이터베이스 연결 종료');
    }
  }
}

checkAccounts();
