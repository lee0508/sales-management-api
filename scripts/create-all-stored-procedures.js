const sql = require('mssql');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

const spFiles = [
  'sp_매입전표_회계전표_자동생성.sql',
  'sp_거래명세서_회계전표_자동생성.sql',
  'sp_세금계산서_회계전표_자동생성.sql',
  'sp_현금출납_회계전표_자동생성.sql',
];

async function createStoredProcedures() {
  try {
    console.log('🔌 SQL Server 연결 중...\n');
    const pool = await sql.connect(config);

    for (const spFile of spFiles) {
      const filePath = path.join(__dirname, '..', 'sql', spFile);
      const sqlScript = fs.readFileSync(filePath, 'utf8');

      console.log(`📄 실행 중: ${spFile}`);

      // GO 명령으로 분리된 배치 실행
      const batches = sqlScript.split(/^\s*GO\s*$/im).filter((batch) => batch.trim());

      for (const batch of batches) {
        if (batch.trim()) {
          await pool.request().query(batch);
        }
      }

      console.log(`   ✅ 완료: ${spFile}\n`);
    }

    console.log('═══════════════════════════════════════════════');
    console.log('✅ 모든 Stored Procedure 생성 완료!');
    console.log('═══════════════════════════════════════════════\n');

    // 생성된 SP 목록 확인
    const result = await pool.request().query(`
      SELECT
        ROUTINE_NAME AS SP명,
        CREATED AS 생성일시,
        LAST_ALTERED AS 최종수정일시
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_TYPE = 'PROCEDURE'
        AND ROUTINE_NAME LIKE 'sp_%회계전표%'
      ORDER BY ROUTINE_NAME
    `);

    console.log('📋 생성된 Stored Procedures:');
    console.table(result.recordset);

    await pool.close();
  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    console.error(err);
    process.exit(1);
  }
}

createStoredProcedures();
