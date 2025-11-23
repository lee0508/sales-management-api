const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

(async () => {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    console.log('========================================');
    console.log('🔧 자재입출내역 데이터 정리');
    console.log('========================================\n');

    console.log('⚠️  주의: 다음 작업을 수행합니다:');
    console.log('  1. 비정상 일자(1900년 이전, 2100년 이후) 데이터만 사용안함 처리');
    console.log('  2. 단가=0 데이터는 나중에 수정할 수 있으므로 처리하지 않음');
    console.log('\n계속하려면 5초 기다립니다...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 1. 비정상 일자 데이터를 사용안함으로 처리
    console.log('1️⃣ 비정상 일자 데이터를 사용안함으로 처리 중...');
    const result1 = await pool.request().query(`
      UPDATE 자재입출내역
      SET 사용구분 = 1
      WHERE (
        거래일자 < '19000101'
        OR 거래일자 > '21001231'
        OR 입출고일자 < '19000101'
        OR 입출고일자 > '21001231'
        OR LEN(거래일자) != 8
        OR LEN(입출고일자) != 8
      )
      AND 사용구분 = 0
    `);
    console.log(`  ✓ 처리 완료: ${result1.rowsAffected[0]}건\n`);

    // 3. 처리 후 상태 확인
    console.log('3️⃣ 처리 후 상태 확인...\n');

    const summary = await pool.request().query(`
      SELECT
        COUNT(*) AS 전체건수,
        SUM(CASE WHEN 입출고구분 = 1 THEN 1 ELSE 0 END) AS 매입전표건수,
        SUM(CASE WHEN 입출고구분 = 2 THEN 1 ELSE 0 END) AS 거래명세서건수,
        SUM(CASE
          WHEN 입출고구분 = 1 AND (매입처코드 IS NULL OR 매입처코드 = '') THEN 1
          WHEN 입출고구분 = 2 AND (매출처코드 IS NULL OR 매출처코드 = '') THEN 1
          ELSE 0
        END) AS 거래처누락건수,
        SUM(CASE
          WHEN 거래일자 < '19000101' OR 거래일자 > '21001231' THEN 1
          ELSE 0
        END) AS 거래일자오류건수,
        SUM(CASE
          WHEN 입출고일자 < '19000101' OR 입출고일자 > '21001231' THEN 1
          ELSE 0
        END) AS 입출고일자오류건수
      FROM 자재입출내역
      WHERE 사용구분 = 0
        AND 거래일자 >= '20251101'
    `);

    console.log('📊 처리 후 상태 (20251101 이후):');
    console.table(summary.recordset);

    // 4. 남아있는 문제 데이터 확인
    console.log('\n4️⃣ 남아있는 문제 데이터 확인...\n');

    // 매입처코드 누락 (단가>0인 실제 거래만)
    const check1 = await pool.request().query(`
      SELECT COUNT(*) AS 건수
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (매입처코드 IS NULL OR 매입처코드 = '')
        AND 입고수량 > 0
        AND 입고단가 > 0
        AND 사용구분 = 0
        AND 거래일자 >= '20251101'
    `);
    console.log(`  • 매입처코드 누락 (실제 거래): ${check1.recordset[0].건수}건`);

    // 매출처코드 누락 (단가>0인 실제 거래만)
    const check2 = await pool.request().query(`
      SELECT COUNT(*) AS 건수
      FROM 자재입출내역
      WHERE 입출고구분 = 2
        AND (매출처코드 IS NULL OR 매출처코드 = '')
        AND 출고수량 > 0
        AND 출고단가 > 0
        AND 사용구분 = 0
        AND 거래일자 >= '20251101'
    `);
    console.log(`  • 매출처코드 누락 (실제 거래): ${check2.recordset[0].건수}건`);

    // 입고단가=0인 실제 거래
    const check3 = await pool.request().query(`
      SELECT COUNT(*) AS 건수
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND 입고수량 > 0
        AND (입고단가 = 0 OR 입고단가 IS NULL)
        AND 사용구분 = 0
        AND 거래일자 >= '20251101'
    `);
    console.log(`  • 입고단가=0 (수량>0): ${check3.recordset[0].건수}건`);

    // 출고단가=0인 실제 거래
    const check4 = await pool.request().query(`
      SELECT COUNT(*) AS 건수
      FROM 자재입출내역
      WHERE 입출고구분 = 2
        AND 출고수량 > 0
        AND (출고단가 = 0 OR 출고단가 IS NULL)
        AND 사용구분 = 0
        AND 거래일자 >= '20251101'
    `);
    console.log(`  • 출고단가=0 (수량>0): ${check4.recordset[0].건수}건`);

    console.log('\n========================================');
    console.log('✅ 데이터 정리 완료!');
    console.log('========================================\n');

    console.log('📝 추가 조치 필요:');
    console.log('  1. 매입처/매출처 코드가 누락된 데이터는 수동으로 확인하여 업데이트하세요.');
    console.log('  2. 단가=0인 데이터는 나중에 실제 단가로 수정 가능하므로 유지합니다.');
    console.log('  3. 정기적으로 데이터 검증 스크립트를 실행하여 데이터 품질을 유지하세요.');
    console.log('\n💡 참고:');
    console.log('  • 매입전표는 발생 시 단가=0으로 등록 후 나중에 단가를 수정할 수 있습니다.');
    console.log('  • 거래명세서도 마찬가지로 단가를 나중에 입력할 수 있습니다.');

    await pool.close();
  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    console.error(err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
})();
