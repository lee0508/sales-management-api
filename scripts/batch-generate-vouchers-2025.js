/**
 * 2025년 1월 1일 ~ 현재까지 회계전표 일괄 생성
 *
 * 실행 방법:
 *   node scripts/batch-generate-vouchers-2025.js
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

async function batchGenerateVouchers() {
  let pool;

  try {
    console.log('📦 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    const 사업장코드 = '01'; // 기본 사업장
    const 작성자코드 = '0687'; // 시스템 관리자

    // 2025-01-01부터 현재까지
    const 시작일자 = '20250101';
    const 현재일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    console.log('========================================');
    console.log('📅 처리 기간:', 시작일자, '~', 현재일자);
    console.log('========================================\n');

    // ==========================================
    // 1. 매입전표 처리 (입출고구분 = 1)
    // ==========================================
    console.log('🔵 매입전표 회계전표 생성 시작...\n');

    const 매입내역 = await pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('시작일자', sql.VarChar(8), 시작일자)
      .input('현재일자', sql.VarChar(8), 현재일자)
      .query(`
        SELECT DISTINCT
          i.거래일자,
          i.거래번호,
          i.매입처코드,
          p.매입처명,
          SUM(i.입고수량 * i.입고단가) AS 공급가액,
          SUM(i.입고부가) AS 부가세액
        FROM 자재입출내역 i
          LEFT JOIN 매입처 p
            ON i.매입처코드 = p.매입처코드
            AND i.사업장코드 = p.사업장코드
        WHERE i.사업장코드 = @사업장코드
          AND i.입출고구분 = 1
          AND i.거래일자 >= @시작일자
          AND i.거래일자 <= @현재일자
          AND i.사용구분 = 0
        GROUP BY i.거래일자, i.거래번호, i.매입처코드, p.매입처명
        ORDER BY i.거래일자, i.거래번호
      `);

    console.log(`📊 매입전표 대상 건수: ${매입내역.recordset.length}건\n`);

    let 매입성공 = 0;
    let 매입실패 = 0;

    for (const row of 매입내역.recordset) {
      try {
        // 이미 생성된 전표가 있는지 확인
        const 기존전표 = await pool.request()
          .input('참조전표', sql.VarChar(50), `${row.거래일자}-${row.거래번호}`)
          .query(`
            SELECT COUNT(*) as cnt
            FROM 회계전표
            WHERE 참조전표 = @참조전표
              AND 사용구분 = 0
          `);

        if (기존전표.recordset[0].cnt > 0) {
          console.log(`⚠️  매입전표 ${row.거래일자}-${row.거래번호} 이미 존재 (건너뜀)`);
          continue;
        }

        // SP 호출
        const result = await pool.request()
          .input('사업장코드', sql.VarChar(2), 사업장코드)
          .input('거래일자', sql.VarChar(8), row.거래일자)
          .input('거래번호', sql.Real, row.거래번호)
          .input('매입처코드', sql.VarChar(8), row.매입처코드)
          .input('매입처명', sql.NVarChar(100), row.매입처명 || '미확인')
          .input('공급가액', sql.Money, row.공급가액 || 0)
          .input('부가세액', sql.Money, row.부가세액 || 0)
          .input('작성자코드', sql.VarChar(4), 작성자코드)
          .input('적요', sql.NVarChar(200), null)
          .execute('sp_매입전표_회계전표_자동생성');

        console.log(`✅ 매입전표 ${row.거래일자}-${row.거래번호} 생성 완료 (전표번호: ${result.recordset[0].전표번호})`);
        매입성공++;
      } catch (err) {
        console.error(`❌ 매입전표 ${row.거래일자}-${row.거래번호} 생성 실패:`, err.message);
        매입실패++;
      }
    }

    console.log(`\n✅ 매입전표 처리 완료: 성공 ${매입성공}건, 실패 ${매입실패}건\n`);

    // ==========================================
    // 2. 거래명세서 처리 (입출고구분 = 2)
    // ==========================================
    console.log('🟢 거래명세서 회계전표 생성 시작...\n');

    const 매출내역 = await pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('시작일자', sql.VarChar(8), 시작일자)
      .input('현재일자', sql.VarChar(8), 현재일자)
      .query(`
        SELECT DISTINCT
          i.거래일자,
          i.거래번호,
          i.매출처코드,
          c.매출처명,
          SUM(i.출고수량 * i.출고단가) AS 공급가액,
          SUM(i.출고부가) AS 부가세액
        FROM 자재입출내역 i
          LEFT JOIN 매출처 c
            ON i.매출처코드 = c.매출처코드
            AND i.사업장코드 = c.사업장코드
        WHERE i.사업장코드 = @사업장코드
          AND i.입출고구분 = 2
          AND i.거래일자 >= @시작일자
          AND i.거래일자 <= @현재일자
          AND i.사용구분 = 0
        GROUP BY i.거래일자, i.거래번호, i.매출처코드, c.매출처명
        ORDER BY i.거래일자, i.거래번호
      `);

    console.log(`📊 거래명세서 대상 건수: ${매출내역.recordset.length}건\n`);

    let 매출성공 = 0;
    let 매출실패 = 0;

    for (const row of 매출내역.recordset) {
      try {
        // 이미 생성된 전표가 있는지 확인
        const 기존전표 = await pool.request()
          .input('참조전표', sql.VarChar(50), `${row.거래일자}-${row.거래번호}`)
          .query(`
            SELECT COUNT(*) as cnt
            FROM 회계전표
            WHERE 참조전표 = @참조전표
              AND 사용구분 = 0
          `);

        if (기존전표.recordset[0].cnt > 0) {
          console.log(`⚠️  거래명세서 ${row.거래일자}-${row.거래번호} 이미 존재 (건너뜀)`);
          continue;
        }

        // SP 호출
        const result = await pool.request()
          .input('사업장코드', sql.VarChar(2), 사업장코드)
          .input('거래일자', sql.VarChar(8), row.거래일자)
          .input('거래번호', sql.Real, row.거래번호)
          .input('매출처코드', sql.VarChar(8), row.매출처코드)
          .input('매출처명', sql.NVarChar(100), row.매출처명 || '미확인')
          .input('공급가액', sql.Money, row.공급가액 || 0)
          .input('부가세액', sql.Money, row.부가세액 || 0)
          .input('작성자코드', sql.VarChar(4), 작성자코드)
          .input('적요', sql.NVarChar(200), null)
          .execute('sp_거래명세서_회계전표_자동생성');

        console.log(`✅ 거래명세서 ${row.거래일자}-${row.거래번호} 생성 완료 (전표번호: ${result.recordset[0].전표번호})`);
        매출성공++;
      } catch (err) {
        console.error(`❌ 거래명세서 ${row.거래일자}-${row.거래번호} 생성 실패:`, err.message);
        매출실패++;
      }
    }

    console.log(`\n✅ 거래명세서 처리 완료: 성공 ${매출성공}건, 실패 ${매출실패}건\n`);

    // ==========================================
    // 최종 요약
    // ==========================================
    console.log('========================================');
    console.log('✅ 회계전표 일괄 생성 완료!');
    console.log('========================================');
    console.log(`📅 처리 기간: ${시작일자} ~ ${현재일자}`);
    console.log(`🔵 매입전표: ${매입성공}건 생성, ${매입실패}건 실패`);
    console.log(`🟢 거래명세서: ${매출성공}건 생성, ${매출실패}건 실패`);
    console.log(`📊 총 ${매입성공 + 매출성공}건 생성, ${매입실패 + 매출실패}건 실패`);
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

batchGenerateVouchers();
