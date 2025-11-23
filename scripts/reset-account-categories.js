/**
 * 계정과목 테이블 초기화 및 표준 계정과목 등록
 *
 * 실행 방법:
 *   node scripts/reset-account-categories.js
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

async function resetAccountCategories() {
  let pool;

  try {
    console.log('📦 데이터베이스 연결 중...');
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공\n');

    console.log('⚠️  주의: 기존 계정과목 데이터를 모두 삭제하고 표준 계정과목으로 교체합니다.');
    console.log('계속하려면 5초 기다립니다...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 1. 기존 데이터를 사용안함으로 표시 (삭제 불가능 - Foreign Key 제약)
    console.log('🔄 기존 계정과목을 사용안함으로 표시 중...');
    await pool.request().query('UPDATE 계정과목 SET 사용구분 = 1');
    console.log('✅ 기존 계정과목 사용안함 처리 완료\n');

    // 2. 표준 계정과목 등록 (MERGE 방식)
    console.log('📝 표준 계정과목 등록 중...');

    const accounts = [
      // 자산 계정
      { code: '1010', name: '보통예금', type: 'A' },
      { code: '1100', name: '외상매출금', type: 'A' },
      { code: '1300', name: '부가세대급금', type: 'A' },
      { code: '1500', name: '상품', type: 'A' },
      // 부채 계정
      { code: '2100', name: '부가세예수금', type: 'L' },
      { code: '2200', name: '외상매입금', type: 'L' },
      // 수익 계정
      { code: '4000', name: '매출', type: 'R' },
      // 비용 계정
      { code: '5000', name: '매출원가', type: 'E' },
    ];

    for (const account of accounts) {
      await pool.request()
        .input('계정코드', sql.VarChar(10), account.code)
        .input('계정명', sql.NVarChar(50), account.name)
        .input('계정구분', sql.Char(1), account.type)
        .query(`
          MERGE INTO 계정과목 AS target
          USING (SELECT @계정코드 AS 계정코드) AS source
          ON target.계정코드 = source.계정코드
          WHEN MATCHED THEN
            UPDATE SET
              계정명 = @계정명,
              계정구분 = @계정구분,
              사용구분 = 0
          WHEN NOT MATCHED THEN
            INSERT (계정코드, 계정명, 계정구분, 사용구분)
            VALUES (@계정코드, @계정명, @계정구분, 0);
        `);
    }

    console.log('✅ 표준 계정과목 등록 완료');

    console.log('\n========================================');
    console.log('✅ 계정과목 초기화 완료!');
    console.log('========================================\n');

    // 결과 조회 (사용 중인 계정만)
    const result = await pool.request().query(`
      SELECT
        계정코드, 계정명,
        계정구분 = CASE
          WHEN 계정구분 = 'A' THEN '자산'
          WHEN 계정구분 = 'L' THEN '부채'
          WHEN 계정구분 = 'C' THEN '자본'
          WHEN 계정구분 = 'R' THEN '수익'
          WHEN 계정구분 = 'E' THEN '비용'
          ELSE '미분류'
        END
      FROM 계정과목
      WHERE 사용구분 = 0
      ORDER BY 계정코드
    `);

    console.log('📊 등록된 계정과목 (총 ' + result.recordset.length + '개):');
    console.table(result.recordset);

    console.log('\n📝 계정 구분:');
    console.log('  A = 자산 (Asset)');
    console.log('  L = 부채 (Liability)');
    console.log('  C = 자본 (Capital)');
    console.log('  R = 수익 (Revenue)');
    console.log('  E = 비용 (Expense)\n');

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

resetAccountCategories();
