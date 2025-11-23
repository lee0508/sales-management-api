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
    console.log('🔍 핵심 필수 필드 검증');
    console.log('========================================\n');
    console.log('📋 검증 대상 필드:');
    console.log('  • 입출고일자 (Transaction Date)');
    console.log('  • 입출고시간 (Transaction Time)');
    console.log('  • 거래일자 (Business Date)');
    console.log('  • 매입처코드 (Supplier Code - 입출고구분=1)');
    console.log('  • 매출처코드 (Customer Code - 입출고구분=2)\n');

    // ========================================
    // 1. 입출고일자 검증
    // ========================================
    console.log('1️⃣ 입출고일자 검증 (NULL 또는 비정상 범위):\n');

    const check1 = await pool.request().query(`
      SELECT
        COUNT(*) AS 문제건수,
        SUM(CASE WHEN 입출고일자 IS NULL OR 입출고일자 = '' THEN 1 ELSE 0 END) AS NULL건수,
        SUM(CASE WHEN 입출고일자 < '19000101' OR 입출고일자 > '21001231' THEN 1 ELSE 0 END) AS 범위오류건수,
        SUM(CASE WHEN LEN(입출고일자) != 8 THEN 1 ELSE 0 END) AS 길이오류건수
      FROM 자재입출내역
      WHERE (
        입출고일자 IS NULL
        OR 입출고일자 = ''
        OR 입출고일자 < '19000101'
        OR 입출고일자 > '21001231'
        OR LEN(입출고일자) != 8
      )
      AND 사용구분 = 0
    `);
    console.table(check1.recordset);

    if (check1.recordset[0].문제건수 > 0) {
      console.log('  📋 샘플 데이터 (최근 10건):');
      const sample1 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 입출고일자, 입출고구분,
          CASE
            WHEN 입출고일자 IS NULL THEN 'NULL'
            WHEN 입출고일자 = '' THEN '빈문자열'
            WHEN 입출고일자 < '19000101' THEN '너무과거'
            WHEN 입출고일자 > '21001231' THEN '너무미래'
            WHEN LEN(입출고일자) != 8 THEN '길이오류'
            ELSE '기타'
          END AS 오류유형,
          CASE WHEN 입출고구분 = 1 THEN 매입처코드 ELSE 매출처코드 END AS 거래처코드
        FROM 자재입출내역
        WHERE (
          입출고일자 IS NULL
          OR 입출고일자 = ''
          OR 입출고일자 < '19000101'
          OR 입출고일자 > '21001231'
          OR LEN(입출고일자) != 8
        )
        AND 사용구분 = 0
        ORDER BY 거래일자 DESC
      `);
      console.table(sample1.recordset);
    }

    // ========================================
    // 2. 입출고시간 검증
    // ========================================
    console.log('\n2️⃣ 입출고시간 검증 (NULL 또는 비정상 형식):\n');

    const check2 = await pool.request().query(`
      SELECT
        COUNT(*) AS 문제건수,
        SUM(CASE WHEN 입출고시간 IS NULL OR 입출고시간 = '' THEN 1 ELSE 0 END) AS NULL건수,
        SUM(CASE WHEN LEN(입출고시간) < 6 THEN 1 ELSE 0 END) AS 길이오류건수
      FROM 자재입출내역
      WHERE (
        입출고시간 IS NULL
        OR 입출고시간 = ''
        OR LEN(입출고시간) < 6
      )
      AND 사용구분 = 0
    `);
    console.table(check2.recordset);

    if (check2.recordset[0].문제건수 > 0) {
      console.log('  📋 샘플 데이터 (최근 10건):');
      const sample2 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 입출고일자, 입출고시간, 입출고구분,
          LEN(ISNULL(입출고시간, '')) AS 시간길이,
          CASE
            WHEN 입출고시간 IS NULL THEN 'NULL'
            WHEN 입출고시간 = '' THEN '빈문자열'
            WHEN LEN(입출고시간) < 6 THEN '길이오류'
            ELSE '기타'
          END AS 오류유형,
          CASE WHEN 입출고구분 = 1 THEN 매입처코드 ELSE 매출처코드 END AS 거래처코드
        FROM 자재입출내역
        WHERE (
          입출고시간 IS NULL
          OR 입출고시간 = ''
          OR LEN(입출고시간) < 6
        )
        AND 사용구분 = 0
        ORDER BY 거래일자 DESC
      `);
      console.table(sample2.recordset);
    }

    // ========================================
    // 3. 거래일자 검증
    // ========================================
    console.log('\n3️⃣ 거래일자 검증 (NULL 또는 비정상 범위):\n');

    const check3 = await pool.request().query(`
      SELECT
        COUNT(*) AS 문제건수,
        SUM(CASE WHEN 거래일자 IS NULL OR 거래일자 = '' THEN 1 ELSE 0 END) AS NULL건수,
        SUM(CASE WHEN 거래일자 < '19000101' OR 거래일자 > '21001231' THEN 1 ELSE 0 END) AS 범위오류건수,
        SUM(CASE WHEN LEN(거래일자) != 8 THEN 1 ELSE 0 END) AS 길이오류건수
      FROM 자재입출내역
      WHERE (
        거래일자 IS NULL
        OR 거래일자 = ''
        OR 거래일자 < '19000101'
        OR 거래일자 > '21001231'
        OR LEN(거래일자) != 8
      )
      AND 사용구분 = 0
    `);
    console.table(check3.recordset);

    if (check3.recordset[0].문제건수 > 0) {
      console.log('  📋 샘플 데이터 (최근 10건):');
      const sample3 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 입출고일자, 입출고구분,
          CASE
            WHEN 거래일자 IS NULL THEN 'NULL'
            WHEN 거래일자 = '' THEN '빈문자열'
            WHEN 거래일자 < '19000101' THEN '너무과거'
            WHEN 거래일자 > '21001231' THEN '너무미래'
            WHEN LEN(거래일자) != 8 THEN '길이오류'
            ELSE '기타'
          END AS 오류유형,
          CASE WHEN 입출고구분 = 1 THEN 매입처코드 ELSE 매출처코드 END AS 거래처코드
        FROM 자재입출내역
        WHERE (
          거래일자 IS NULL
          OR 거래일자 = ''
          OR 거래일자 < '19000101'
          OR 거래일자 > '21001231'
          OR LEN(거래일자) != 8
        )
        AND 사용구분 = 0
        ORDER BY 거래일자 DESC
      `);
      console.table(sample3.recordset);
    }

    // ========================================
    // 4. 매입처코드 검증 (입출고구분=1)
    // ========================================
    console.log('\n4️⃣ 매입처코드 검증 (입출고구분=1 매입전표):\n');

    const check4 = await pool.request().query(`
      SELECT
        COUNT(*) AS 문제건수,
        MIN(거래일자) AS 최초일자,
        MAX(거래일자) AS 최종일자
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (매입처코드 IS NULL OR 매입처코드 = '')
        AND 사용구분 = 0
    `);
    console.table(check4.recordset);

    if (check4.recordset[0].문제건수 > 0) {
      console.log('  📋 샘플 데이터 (최근 10건):');
      const sample4 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 입출고일자, 분류코드, 세부코드,
          입고수량, 입고단가, 매입처코드,
          CASE
            WHEN 매입처코드 IS NULL THEN 'NULL'
            WHEN 매입처코드 = '' THEN '빈문자열'
            ELSE '기타'
          END AS 오류유형
        FROM 자재입출내역
        WHERE 입출고구분 = 1
          AND (매입처코드 IS NULL OR 매입처코드 = '')
          AND 사용구분 = 0
        ORDER BY 거래일자 DESC, 거래번호 DESC
      `);
      console.table(sample4.recordset);
    }

    // ========================================
    // 5. 매출처코드 검증 (입출고구분=2)
    // ========================================
    console.log('\n5️⃣ 매출처코드 검증 (입출고구분=2 거래명세서):\n');

    const check5 = await pool.request().query(`
      SELECT
        COUNT(*) AS 문제건수,
        MIN(거래일자) AS 최초일자,
        MAX(거래일자) AS 최종일자
      FROM 자재입출내역
      WHERE 입출고구분 = 2
        AND (매출처코드 IS NULL OR 매출처코드 = '')
        AND 사용구분 = 0
    `);
    console.table(check5.recordset);

    if (check5.recordset[0].문제건수 > 0) {
      console.log('  📋 샘플 데이터 (최근 10건):');
      const sample5 = await pool.request().query(`
        SELECT TOP 10
          거래일자, 거래번호, 입출고일자, 분류코드, 세부코드,
          출고수량, 출고단가, 매출처코드,
          CASE
            WHEN 매출처코드 IS NULL THEN 'NULL'
            WHEN 매출처코드 = '' THEN '빈문자열'
            ELSE '기타'
          END AS 오류유형
        FROM 자재입출내역
        WHERE 입출고구분 = 2
          AND (매출처코드 IS NULL OR 매출처코드 = '')
          AND 사용구분 = 0
        ORDER BY 거래일자 DESC, 거래번호 DESC
      `);
      console.table(sample5.recordset);
    }

    // ========================================
    // 전체 요약
    // ========================================
    console.log('\n========================================');
    console.log('📊 핵심 필드 검증 요약');
    console.log('========================================\n');

    const summary = await pool.request().query(`
      SELECT
        COUNT(*) AS 전체레코드수,
        SUM(CASE WHEN 입출고일자 IS NULL OR 입출고일자 = '' OR 입출고일자 < '19000101' OR 입출고일자 > '21001231' OR LEN(입출고일자) != 8 THEN 1 ELSE 0 END) AS 입출고일자문제,
        SUM(CASE WHEN 입출고시간 IS NULL OR 입출고시간 = '' OR LEN(입출고시간) < 6 THEN 1 ELSE 0 END) AS 입출고시간문제,
        SUM(CASE WHEN 거래일자 IS NULL OR 거래일자 = '' OR 거래일자 < '19000101' OR 거래일자 > '21001231' OR LEN(거래일자) != 8 THEN 1 ELSE 0 END) AS 거래일자문제,
        SUM(CASE WHEN 입출고구분 = 1 AND (매입처코드 IS NULL OR 매입처코드 = '') THEN 1 ELSE 0 END) AS 매입처코드문제,
        SUM(CASE WHEN 입출고구분 = 2 AND (매출처코드 IS NULL OR 매출처코드 = '') THEN 1 ELSE 0 END) AS 매출처코드문제
      FROM 자재입출내역
      WHERE 사용구분 = 0
    `);
    console.table(summary.recordset);

    console.log('\n✅ 핵심 필드 검증 완료!\n');

    console.log('📋 처리 방안:\n');
    console.log('  🔧 자동 수정 가능:');
    console.log('    • 입출고일자/거래일자 범위 오류 → 사용구분=1로 처리 (fix-inventory-data.js 실행)');
    console.log('');
    console.log('  ⚠️  수동 수정 필요:');
    console.log('    • 입출고시간 NULL/빈값 → 실제 시간 확인 후 업데이트');
    console.log('    • 매입처코드/매출처코드 NULL/빈값 → 거래처 확인 후 업데이트');
    console.log('');
    console.log('  💡 참고:');
    console.log('    • 단가=0인 데이터는 나중에 수정 가능하므로 문제 없음');
    console.log('    • 핵심 필드(일자, 시간, 거래처코드)만 우선 수정하세요');

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
