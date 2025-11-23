// 계정과목 테이블에 계정구분 필드 추가 스크립트
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

async function executeScript() {
  let pool;
  try {
    console.log('🔌 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    const sqlFilePath = path.join(__dirname, '../sql/alter_계정과목_add_계정구분.sql');
    console.log(`📄 SQL 파일 읽기: ${sqlFilePath}`);

    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

    // GO 구문으로 분리
    const batches = sqlScript
      .split(/\nGO\n/i)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);

    console.log(`📦 총 ${batches.length}개의 배치 실행 예정\n`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // 주석만 있는 배치는 건너뛰기
      if (batch.startsWith('--') || batch.startsWith('/*')) {
        continue;
      }

      try {
        console.log(`⚙️  배치 ${i + 1}/${batches.length} 실행 중...`);
        const result = await pool.request().query(batch);

        // PRINT 문 출력
        if (result.recordset && result.recordset.length > 0) {
          console.log('📊 결과:');
          console.table(result.recordset);
        }

        console.log(`✅ 배치 ${i + 1} 완료\n`);
      } catch (err) {
        console.error(`❌ 배치 ${i + 1} 실행 오류:`, err.message);
        throw err;
      }
    }

    console.log('🎉 계정과목 테이블 수정 완료!');

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
