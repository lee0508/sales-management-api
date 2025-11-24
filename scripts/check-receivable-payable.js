/**
 * 미수금/미지급금 내역 테이블 조회
 */

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

(async () => {
  try {
    console.log('데이터베이스 연결 중...\n');
    await sql.connect(config);

    // 1. 미지급금내역 조회
    console.log('========================================');
    console.log('📋 미지급금내역 테이블 (최근 10건)');
    console.log('========================================\n');

    const payableQuery = `
      SELECT TOP 10
        사업장코드, 매입처코드,
        미지급금지급일자, 미지급금지급시간,
        미지급금지급금액, 결제방법,
        만기일자, 어음번호, 적요
      FROM 미지급금내역
      ORDER BY 미지급금지급일자 DESC, 미지급금지급시간 DESC
    `;

    const payable = await sql.query(payableQuery);

    if (payable.recordset.length > 0) {
      console.table(payable.recordset);
    } else {
      console.log('⚠️ 데이터 없음\n');
    }

    // 2. 미수금내역 조회
    console.log('\n========================================');
    console.log('📋 미수금내역 테이블 (최근 10건)');
    console.log('========================================\n');

    const receivableQuery = `
      SELECT TOP 10
        사업장코드, 매출처코드,
        미수금입금일자, 미수금입금시간,
        미수금입금금액, 결제방법,
        만기일자, 어음번호, 적요
      FROM 미수금내역
      ORDER BY 미수금입금일자 DESC, 미수금입금시간 DESC
    `;

    const receivable = await sql.query(receivableQuery);

    if (receivable.recordset.length > 0) {
      console.table(receivable.recordset);
    } else {
      console.log('⚠️ 데이터 없음\n');
    }

    // 3. 통계 정보
    console.log('\n========================================');
    console.log('📊 통계 정보');
    console.log('========================================\n');

    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM 미지급금내역) AS 미지급금내역_총건수,
        (SELECT COUNT(*) FROM 미수금내역) AS 미수금내역_총건수
    `;

    const stats = await sql.query(statsQuery);
    console.table(stats.recordset);

    // 4. 최근 매입전표와 미지급금 비교
    console.log('\n========================================');
    console.log('🔍 최근 매입전표 vs 미지급금내역 비교');
    console.log('========================================\n');

    const compareQuery = `
      SELECT TOP 5
        입출고일자 AS 거래일자,
        입출고번호 AS 거래번호,
        매입처코드,
        SUM((입고수량 * 입고단가) + 입고부가) AS 매입금액,
        '자재입출내역' AS 출처
      FROM 자재입출내역
      WHERE 입출고구분 = 1 AND 사용구분 = 0
      GROUP BY 입출고일자, 입출고번호, 매입처코드
      ORDER BY 입출고일자 DESC, 입출고번호 DESC
    `;

    const comparison = await sql.query(compareQuery);
    console.log('최근 매입전표 (자재입출내역):');
    console.table(comparison.recordset);

    // 5. 결제방법별 통계
    console.log('\n========================================');
    console.log('💰 결제방법별 통계');
    console.log('========================================\n');

    const paymentStatsQuery = `
      SELECT
        CASE 결제방법
          WHEN 0 THEN '현금'
          WHEN 1 THEN '수표'
          WHEN 2 THEN '어음'
          ELSE '기타'
        END AS 결제방법,
        COUNT(*) AS 건수,
        SUM(미지급금지급금액) AS 총지급액
      FROM 미지급금내역
      GROUP BY 결제방법

      UNION ALL

      SELECT
        CASE 결제방법
          WHEN 0 THEN '현금'
          WHEN 1 THEN '수표'
          WHEN 2 THEN '어음'
          ELSE '기타'
        END AS 결제방법,
        COUNT(*) AS 건수,
        SUM(미수금입금금액) AS 총입금액
      FROM 미수금내역
      GROUP BY 결제방법

      ORDER BY 결제방법
    `;

    const paymentStats = await sql.query(paymentStatsQuery);
    if (paymentStats.recordset.length > 0) {
      console.table(paymentStats.recordset);
    } else {
      console.log('⚠️ 데이터 없음\n');
    }

    await sql.close();
    console.log('\n✅ 조회 완료\n');

  } catch (err) {
    console.error('❌ 오류 발생:', err);
  }
})();
