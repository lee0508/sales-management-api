// 회계전표 일괄 생성 스크립트
// 25-11-01부터 오늘까지의 매입전표와 거래명세서를 회계전표로 변환
require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

async function batchCreateVouchers() {
  let pool;
  try {
    console.log('🔌 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. SP 파일 읽기 및 생성
    const sqlFilePath = path.join(__dirname, '../sql/sp_회계전표_일괄생성.sql');
    console.log(`📄 SP 파일 읽기: ${sqlFilePath}`);

    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

    // GO 구문으로 분리
    const batches = sqlScript
      .split(/\r?\n\s*GO\s*\r?\n/i)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0 && !batch.startsWith('--') && !batch.startsWith('/*'));

    console.log(`📦 SP 생성 중... (${batches.length}개 배치)\n`);

    for (let i = 0; i < batches.length; i++) {
      try {
        await pool.request().query(batches[i]);
      } catch (err) {
        // PRINT 문 등은 무시
        if (!err.message.includes('PRINT')) {
          console.error(`배치 ${i + 1} 실행 오류:`, err.message);
        }
      }
    }

    console.log('✅ SP 생성 완료\n');

    // 2. SP 실행
    const 사업장코드 = '01';
    const 시작일자 = '20251101';
    const 종료일자 = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 오늘 날짜 (YYYYMMDD)
    const 작성자코드 = '0687';

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 회계전표 일괄 생성 실행');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`사업장코드: ${사업장코드}`);
    console.log(`시작일자:   ${시작일자} (2025-11-01)`);
    console.log(`종료일자:   ${종료일자} (오늘)`);
    console.log(`작성자코드: ${작성자코드}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const result = await pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('시작일자', sql.VarChar(8), 시작일자)
      .input('종료일자', sql.VarChar(8), 종료일자)
      .input('작성자코드', sql.VarChar(4), 작성자코드)
      .execute('sp_회계전표_일괄생성');

    // PRINT 메시지 출력
    if (result.output) {
      console.log('PRINT 출력:', result.output);
    }

    // 결과 출력
    if (result.recordset && result.recordset.length > 0) {
      console.log('\n📊 최종 결과:');
      console.table(result.recordset);
    }

    console.log('\n🎉 회계전표 일괄 생성 완료!');

  } catch (err) {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 데이터베이스 연결 종료');
    }
  }
}

batchCreateVouchers();
