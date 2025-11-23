/**
 * 회계전표 자동생성 Stored Procedure 재생성 (부가세 분리 버전)
 *
 * 실행 방법:
 *   node scripts/create-accounting-voucher-sp-v2.js
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function createStoredProcedures() {
  let pool;

  try {
    console.log('📦 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 매입전표 SP 실행
    console.log('📄 매입전표 SP 생성 중...');
    const purchaseSPPath = path.join(__dirname, '../sql/sp_매입전표_회계전표_자동생성_v2.sql');
    const purchaseSQL = fs.readFileSync(purchaseSPPath, 'utf8');

    // GO 구분자로 분리하여 실행
    const purchaseBatches = purchaseSQL.split(/\r?\nGO\r?\n/i).filter(batch => batch.trim());

    for (const batch of purchaseBatches) {
      if (batch.trim()) {
        await pool.request().query(batch);
      }
    }
    console.log('✅ sp_매입전표_회계전표_자동생성 생성 완료\n');

    // 2. 거래명세서 SP 실행
    console.log('📄 거래명세서 SP 생성 중...');
    const salesSPPath = path.join(__dirname, '../sql/sp_거래명세서_회계전표_자동생성_v2.sql');
    const salesSQL = fs.readFileSync(salesSPPath, 'utf8');

    const salesBatches = salesSQL.split(/\r?\nGO\r?\n/i).filter(batch => batch.trim());

    for (const batch of salesBatches) {
      if (batch.trim()) {
        await pool.request().query(batch);
      }
    }
    console.log('✅ sp_거래명세서_회계전표_자동생성 생성 완료\n');

    console.log('========================================');
    console.log('✅ 모든 Stored Procedure 재생성 완료!');
    console.log('========================================\n');

    console.log('📝 변경 사항:');
    console.log('  1. 매입전표: 공급가액과 부가세를 별도 계정으로 분리');
    console.log('     - 차변: 501 (상품매입) - 공급가액');
    console.log('     - 차변: 136 (부가세대급금) - 부가세');
    console.log('     - 대변: 252 (미지급금) - 합계\n');

    console.log('  2. 거래명세서: 공급가액과 부가세를 별도 계정으로 분리');
    console.log('     - 차변: 132 (미수금) - 합계');
    console.log('     - 대변: 401 (상품매출) - 공급가액');
    console.log('     - 대변: 237 (부가세예수금) - 부가세\n');

  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n📦 데이터베이스 연결 종료');
    }
  }
}

createStoredProcedures();
