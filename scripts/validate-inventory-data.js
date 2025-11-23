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
    console.log('📊 자재입출내역 데이터 검증');
    console.log('========================================\n');

    // 1. 매입전표(입출고구분=1)인데 매입처코드가 없는 경우
    console.log('1️⃣ 매입전표(입출고구분=1) 중 매입처코드 누락 데이터:');
    const result1 = await pool.request().query(`
      SELECT
        COUNT(*) AS 누락건수,
        MIN(거래일자) AS 최초일자,
        MAX(거래일자) AS 최종일자
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (매입처코드 IS NULL OR 매입처코드 = '')
        AND 사용구분 = 0
    `);
    console.table(result1.recordset);

    if (result1.recordset[0].누락건수 > 0) {
      console.log('\n  📋 샘플 데이터 (최근 10건):');
      const sample1 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 분류코드, 세부코드,
          입고수량, 입고단가, 입고부가, 매입처코드
        FROM 자재입출내역
        WHERE 입출고구분 = 1
          AND (매입처코드 IS NULL OR 매입처코드 = '')
          AND 사용구분 = 0
        ORDER BY 거래일자 DESC, 거래번호 DESC
      `);
      console.table(sample1.recordset);
    }

    // 2. 거래명세서(입출고구분=2)인데 매출처코드가 없는 경우
    console.log('\n2️⃣ 거래명세서(입출고구분=2) 중 매출처코드 누락 데이터:');
    const result2 = await pool.request().query(`
      SELECT
        COUNT(*) AS 누락건수,
        MIN(거래일자) AS 최초일자,
        MAX(거래일자) AS 최종일자
      FROM 자재입출내역
      WHERE 입출고구분 = 2
        AND (매출처코드 IS NULL OR 매출처코드 = '')
        AND 사용구분 = 0
    `);
    console.table(result2.recordset);

    if (result2.recordset[0].누락건수 > 0) {
      console.log('\n  📋 샘플 데이터 (최근 10건):');
      const sample2 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 분류코드, 세부코드,
          출고수량, 출고단가, 출고부가, 매출처코드
        FROM 자재입출내역
        WHERE 입출고구분 = 2
          AND (매출처코드 IS NULL OR 매출처코드 = '')
          AND 사용구분 = 0
        ORDER BY 거래일자 DESC, 거래번호 DESC
      `);
      console.table(sample2.recordset);
    }

    // 3. 입출고일자 검증 (1900~2100년 범위 벗어남)
    console.log('\n3️⃣ 입출고일자가 정상 범위(19000101~21001231)를 벗어나는 데이터:');
    const result3 = await pool.request().query(`
      SELECT
        COUNT(*) AS 비정상건수,
        MIN(입출고일자) AS 최소일자,
        MAX(입출고일자) AS 최대일자
      FROM 자재입출내역
      WHERE (
        입출고일자 < '19000101'
        OR 입출고일자 > '21001231'
        OR LEN(입출고일자) != 8
        OR ISNUMERIC(입출고일자) = 0
      )
      AND 사용구분 = 0
    `);
    console.table(result3.recordset);

    if (result3.recordset[0].비정상건수 > 0) {
      console.log('\n  📋 샘플 데이터 (최근 10건):');
      const sample3 = await pool.request().query(`
        SELECT TOP 10
          입출고일자, 거래일자, 거래번호, 입출고구분,
          LEN(입출고일자) AS 일자길이,
          CASE
            WHEN 입출고일자 < '19000101' THEN '너무 과거'
            WHEN 입출고일자 > '21001231' THEN '너무 미래'
            WHEN LEN(입출고일자) != 8 THEN '길이오류'
            WHEN ISNUMERIC(입출고일자) = 0 THEN '숫자아님'
            ELSE '기타'
          END AS 오류유형
        FROM 자재입출내역
        WHERE (
          입출고일자 < '19000101'
          OR 입출고일자 > '21001231'
          OR LEN(입출고일자) != 8
          OR ISNUMERIC(입출고일자) = 0
        )
        AND 사용구분 = 0
        ORDER BY 거래일자 DESC
      `);
      console.table(sample3.recordset);
    }

    // 4. 거래일자 검증 (1900~2100년 범위 벗어남)
    console.log('\n4️⃣ 거래일자가 정상 범위(19000101~21001231)를 벗어나는 데이터:');
    const result4 = await pool.request().query(`
      SELECT
        COUNT(*) AS 비정상건수,
        MIN(거래일자) AS 최소일자,
        MAX(거래일자) AS 최대일자
      FROM 자재입출내역
      WHERE (
        거래일자 < '19000101'
        OR 거래일자 > '21001231'
        OR LEN(거래일자) != 8
        OR ISNUMERIC(거래일자) = 0
      )
      AND 사용구분 = 0
    `);
    console.table(result4.recordset);

    if (result4.recordset[0].비정상건수 > 0) {
      console.log('\n  📋 샘플 데이터 (최근 10건):');
      const sample4 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 입출고일자, 거래번호, 입출고구분,
          LEN(거래일자) AS 일자길이,
          CASE
            WHEN 거래일자 < '19000101' THEN '너무 과거'
            WHEN 거래일자 > '21001231' THEN '너무 미래'
            WHEN LEN(거래일자) != 8 THEN '길이오류'
            WHEN ISNUMERIC(거래일자) = 0 THEN '숫자아님'
            ELSE '기타'
          END AS 오류유형
        FROM 자재입출내역
        WHERE (
          거래일자 < '19000101'
          OR 거래일자 > '21001231'
          OR LEN(거래일자) != 8
          OR ISNUMERIC(거래일자) = 0
        )
        AND 사용구분 = 0
        ORDER BY 입출고일자 DESC
      `);
      console.table(sample4.recordset);
    }

    // 5. 매입전표(입출고구분=1)인데 입고단가가 0이거나 음수인 경우
    console.log('\n5️⃣ 매입전표(입출고구분=1) 중 입고단가가 0 이하인 데이터:');
    const result5 = await pool.request().query(`
      SELECT
        COUNT(*) AS 비정상건수,
        MIN(거래일자) AS 최초일자,
        MAX(거래일자) AS 최종일자
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (입고단가 <= 0 OR 입고단가 IS NULL)
        AND (입고수량 > 0)
        AND 사용구분 = 0
    `);
    console.table(result5.recordset);

    if (result5.recordset[0].비정상건수 > 0) {
      console.log('\n  📋 샘플 데이터 (최근 10건):');
      const sample5 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 분류코드, 세부코드,
          입고수량, 입고단가, 입고부가, 매입처코드
        FROM 자재입출내역
        WHERE 입출고구분 = 1
          AND (입고단가 <= 0 OR 입고단가 IS NULL)
          AND (입고수량 > 0)
          AND 사용구분 = 0
        ORDER BY 거래일자 DESC, 거래번호 DESC
      `);
      console.table(sample5.recordset);
    }

    // 6. 거래명세서(입출고구분=2)인데 출고단가가 0이거나 음수인 경우
    console.log('\n6️⃣ 거래명세서(입출고구분=2) 중 출고단가가 0 이하인 데이터:');
    const result6 = await pool.request().query(`
      SELECT
        COUNT(*) AS 비정상건수,
        MIN(거래일자) AS 최초일자,
        MAX(거래일자) AS 최종일자
      FROM 자재입출내역
      WHERE 입출고구분 = 2
        AND (출고단가 <= 0 OR 출고단가 IS NULL)
        AND (출고수량 > 0)
        AND 사용구분 = 0
    `);
    console.table(result6.recordset);

    if (result6.recordset[0].비정상건수 > 0) {
      console.log('\n  📋 샘플 데이터 (최근 10건):');
      const sample6 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 분류코드, 세부코드,
          출고수량, 출고단가, 출고부가, 매출처코드
        FROM 자재입출내역
        WHERE 입출고구분 = 2
          AND (출고단가 <= 0 OR 출고단가 IS NULL)
          AND (출고수량 > 0)
          AND 사용구분 = 0
        ORDER BY 거래일자 DESC, 거래번호 DESC
      `);
      console.table(sample6.recordset);
    }

    // 7. 전체 요약
    console.log('\n========================================');
    console.log('📊 검증 요약');
    console.log('========================================');

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
    console.table(summary.recordset);

    console.log('\n✅ 데이터 검증 완료!');
    console.log('\n⚠️  권장사항:');
    console.log('  1. 거래처 누락 데이터는 해당 거래의 매입처/매출처 정보를 확인하여 업데이트하세요.');
    console.log('  2. 일자 오류 데이터는 올바른 날짜로 수정하거나 사용구분=1로 처리하세요.');
    console.log('  3. 단가 0 이하 데이터는 실제 단가를 확인하여 업데이트하세요.');

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
