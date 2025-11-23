/**
 * 부가세 분리 회계전표 SP 테스트
 *
 * 실행 방법:
 *   node scripts/test-voucher-sp-v2.js
 */

const sql = require('mssql');
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

async function testVoucherSP() {
  let pool;

  try {
    console.log('📦 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    // ==========================================
    // 테스트 1: 매입전표 회계전표 생성
    // ==========================================
    console.log('========================================');
    console.log('테스트 1: 매입전표 회계전표 생성');
    console.log('========================================\n');

    const 공급가액_매입 = 500000;
    const 부가세액_매입 = 50000;

    console.log('📝 입력 데이터:');
    console.log(`  공급가액: ${공급가액_매입.toLocaleString()}원`);
    console.log(`  부가세액: ${부가세액_매입.toLocaleString()}원`);
    console.log(`  합계금액: ${(공급가액_매입 + 부가세액_매입).toLocaleString()}원\n`);

    const purchaseResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), '01')
      .input('거래일자', sql.VarChar(8), '20251122')
      .input('거래번호', sql.Real, 999)
      .input('매입처코드', sql.VarChar(8), 'TEST001')
      .input('매입처명', sql.NVarChar(100), '테스트공급업체')
      .input('공급가액', sql.Money, 공급가액_매입)
      .input('부가세액', sql.Money, 부가세액_매입)
      .input('작성자코드', sql.VarChar(4), '0687')
      .input('적요', sql.NVarChar(200), 'SP 테스트 - 매입')
      .execute('sp_매입전표_회계전표_자동생성');

    console.log('✅ 매입전표 회계전표 생성 결과:');
    console.log(purchaseResult.recordset[0]);

    // 생성된 전표 조회
    const 전표번호_매입 = purchaseResult.recordset[0].전표번호;
    const voucherDetails_매입 = await pool.request().query(`
      SELECT
        v.전표순번, v.계정코드, c.계정명,
        차대구분 = CASE WHEN v.차대구분 = 'D' THEN '차변' ELSE '대변' END,
        v.금액
      FROM 회계전표 v
      LEFT JOIN 계정과목 c ON v.계정코드 = c.계정코드
      WHERE v.전표번호 = '${전표번호_매입}'
      ORDER BY v.전표순번
    `);

    console.log('\n📊 생성된 회계전표 내역:');
    console.table(voucherDetails_매입.recordset);

    // 차변/대변 검증
    const 차변합계_매입 = voucherDetails_매입.recordset
      .filter(r => r.차대구분 === '차변')
      .reduce((sum, r) => sum + r.금액, 0);
    const 대변합계_매입 = voucherDetails_매입.recordset
      .filter(r => r.차대구분 === '대변')
      .reduce((sum, r) => sum + r.금액, 0);

    console.log('\n✅ 차대 균형 검증:');
    console.log(`  차변 합계: ${차변합계_매입.toLocaleString()}원`);
    console.log(`  대변 합계: ${대변합계_매입.toLocaleString()}원`);
    console.log(`  균형 여부: ${차변합계_매입 === 대변합계_매입 ? '✅ 일치' : '❌ 불일치'}\n`);

    // ==========================================
    // 테스트 2: 거래명세서 회계전표 생성
    // ==========================================
    console.log('========================================');
    console.log('테스트 2: 거래명세서 회계전표 생성');
    console.log('========================================\n');

    const 공급가액_매출 = 800000;
    const 부가세액_매출 = 80000;

    console.log('📝 입력 데이터:');
    console.log(`  공급가액: ${공급가액_매출.toLocaleString()}원`);
    console.log(`  부가세액: ${부가세액_매출.toLocaleString()}원`);
    console.log(`  합계금액: ${(공급가액_매출 + 부가세액_매출).toLocaleString()}원\n`);

    const salesResult = await pool
      .request()
      .input('사업장코드', sql.VarChar(2), '01')
      .input('거래일자', sql.VarChar(8), '20251122')
      .input('거래번호', sql.Real, 888)
      .input('매출처코드', sql.VarChar(8), 'TEST002')
      .input('매출처명', sql.NVarChar(100), '테스트고객사')
      .input('공급가액', sql.Money, 공급가액_매출)
      .input('부가세액', sql.Money, 부가세액_매출)
      .input('작성자코드', sql.VarChar(4), '0687')
      .input('적요', sql.NVarChar(200), 'SP 테스트 - 매출')
      .execute('sp_거래명세서_회계전표_자동생성');

    console.log('✅ 거래명세서 회계전표 생성 결과:');
    console.log(salesResult.recordset[0]);

    // 생성된 전표 조회
    const 전표번호_매출 = salesResult.recordset[0].전표번호;
    const voucherDetails_매출 = await pool.request().query(`
      SELECT
        v.전표순번, v.계정코드, c.계정명,
        차대구분 = CASE WHEN v.차대구분 = 'D' THEN '차변' ELSE '대변' END,
        v.금액
      FROM 회계전표 v
      LEFT JOIN 계정과목 c ON v.계정코드 = c.계정코드
      WHERE v.전표번호 = '${전표번호_매출}'
      ORDER BY v.전표순번
    `);

    console.log('\n📊 생성된 회계전표 내역:');
    console.table(voucherDetails_매출.recordset);

    // 차변/대변 검증
    const 차변합계_매출 = voucherDetails_매출.recordset
      .filter(r => r.차대구분 === '차변')
      .reduce((sum, r) => sum + r.금액, 0);
    const 대변합계_매출 = voucherDetails_매출.recordset
      .filter(r => r.차대구분 === '대변')
      .reduce((sum, r) => sum + r.금액, 0);

    console.log('\n✅ 차대 균형 검증:');
    console.log(`  차변 합계: ${차변합계_매출.toLocaleString()}원`);
    console.log(`  대변 합계: ${대변합계_매출.toLocaleString()}원`);
    console.log(`  균형 여부: ${차변합계_매출 === 대변합계_매출 ? '✅ 일치' : '❌ 불일치'}\n`);

    // ==========================================
    // 테스트 완료 - 테스트 데이터 삭제
    // ==========================================
    console.log('========================================');
    console.log('테스트 데이터 정리');
    console.log('========================================\n');

    await pool.request().query(`
      DELETE FROM 회계전표
      WHERE 전표번호 IN ('${전표번호_매입}', '${전표번호_매출}')
    `);

    console.log('✅ 테스트 데이터 삭제 완료\n');

    console.log('========================================');
    console.log('✅ 모든 테스트 완료!');
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('📦 데이터베이스 연결 종료');
    }
  }
}

testVoucherSP();
