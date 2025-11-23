// 계정과목 테이블에 계정구분 필드 추가 스크립트 (개선 버전)
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
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function executeScript() {
  let pool;
  try {
    console.log('🔌 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 계정구분 컬럼 추가
    console.log('📝 Step 1: 계정구분 컬럼 추가 중...');
    try {
      await pool.request().query(`
        ALTER TABLE 계정과목
        ADD 계정구분 CHAR(1) NULL
      `);
      console.log('✅ 계정구분 컬럼이 추가되었습니다.\n');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('이미 있습니다')) {
        console.log('⚠️  계정구분 컬럼이 이미 존재합니다.\n');
      } else {
        throw err;
      }
    }

    // 2. 기존 데이터에 계정구분 값 설정
    console.log('📝 Step 2: 기존 데이터에 계정구분 설정 중...');
    const updateResult = await pool.request().query(`
      UPDATE 계정과목
      SET 계정구분 = CASE
        WHEN LEFT(계정코드, 1) = '1' THEN 'A'  -- 1xx = 자산
        WHEN LEFT(계정코드, 1) = '2' THEN 'L'  -- 2xx = 부채
        WHEN LEFT(계정코드, 1) = '3' THEN 'C'  -- 3xx = 자본
        WHEN LEFT(계정코드, 1) = '4' THEN 'R'  -- 4xx = 수익
        WHEN LEFT(계정코드, 1) = '5' THEN 'E'  -- 5xx = 비용
        WHEN LEFT(계정코드, 1) = '6' THEN 'E'  -- 6xx = 비용 (제조원가 등)
        WHEN LEFT(계정코드, 1) = '7' THEN 'E'  -- 7xx = 비용 (영업외비용)
        WHEN LEFT(계정코드, 1) = '8' THEN 'R'  -- 8xx = 수익 (영업외수익)
        ELSE 'A'  -- 기본값: 자산
      END
      WHERE 계정구분 IS NULL OR 계정구분 = ''
    `);
    console.log(`✅ ${updateResult.rowsAffected[0]}건의 계정과목에 계정구분이 설정되었습니다.\n`);

    // 3. 계정구분별 건수 확인
    console.log('📊 Step 3: 계정구분별 건수 확인 중...');
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

    // 4. 주요 계정과목 샘플
    console.log('\n📋 Step 4: 주요 계정과목 확인 (상위 20개)');
    const sampleResult = await pool.request().query(`
      SELECT TOP 20
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

    console.log('\n🎉 계정과목 테이블 수정 완료!');

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

executeScript();
