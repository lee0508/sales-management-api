// 자재입출내역 테이블 스키마 확인 스크립트
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
  },
  port: parseInt(process.env.DB_PORT) || 1433,
};

async function checkSchema() {
  try {
    console.log('📊 데이터베이스 연결 중...');
    const pool = await sql.connect(config);
    console.log('✅ 연결 성공\n');

    // 1. 자재입출내역 테이블 스키마 확인
    console.log('📋 자재입출내역 테이블 구조:');
    console.log('='.repeat(80));
    const schemaResult = await pool.request().query(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '자재입출내역'
      ORDER BY ORDINAL_POSITION
    `);

    schemaResult.recordset.forEach((col) => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const def = col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : '';
      console.log(`  ${col.COLUMN_NAME.padEnd(20)} ${col.DATA_TYPE}${length.padEnd(10)} ${nullable.padEnd(10)} ${def}`);
    });

    // 2. 입출고번호 컬럼의 실제 데이터 타입 확인
    console.log('\n📌 입출고번호 컬럼 상세 정보:');
    console.log('='.repeat(80));
    const columnDetail = await pool.request().query(`
      SELECT
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        t.name AS SQL_TYPE_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN sys.columns sc ON sc.name = c.COLUMN_NAME
      JOIN sys.types t ON sc.user_type_id = t.user_type_id
      WHERE c.TABLE_NAME = '자재입출내역' AND c.COLUMN_NAME = '입출고번호'
    `);

    if (columnDetail.recordset.length > 0) {
      const col = columnDetail.recordset[0];
      console.log(`  컬럼명: ${col.COLUMN_NAME}`);
      console.log(`  데이터 타입: ${col.DATA_TYPE}`);
      console.log(`  SQL 타입: ${col.SQL_TYPE_NAME}`);
      console.log(`  정밀도: ${col.NUMERIC_PRECISION || 'N/A'}`);
      console.log(`  스케일: ${col.NUMERIC_SCALE || 'N/A'}`);
    }

    // 3. 샘플 데이터 조회
    console.log('\n📊 샘플 데이터 (최근 5건):');
    console.log('='.repeat(80));
    const sampleData = await pool.request().query(`
      SELECT TOP 5
        입출고일자,
        입출고번호,
        매출처코드,
        분류코드,
        세부코드,
        출고수량,
        출고단가
      FROM 자재입출내역
      ORDER BY 입출고일자 DESC, 입출고번호 DESC
    `);

    sampleData.recordset.forEach((row) => {
      console.log(`  일자: ${row.입출고일자}, 번호: ${row.입출고번호} (타입: ${typeof row.입출고번호}), 매출처: ${row.매출처코드}`);
    });

    // 4. 특정 거래명세서 조회 테스트
    console.log('\n🔍 거래명세서 20251020-1 조회 테스트:');
    console.log('='.repeat(80));

    try {
      // Int 타입으로 시도
      const testResult1 = await pool.request()
        .input('입출고일자', sql.VarChar(8), '20251020')
        .input('입출고번호', sql.Int, 1)
        .query(`
          SELECT COUNT(*) as cnt
          FROM 자재입출내역
          WHERE 입출고일자 = @입출고일자 AND 입출고번호 = @입출고번호
        `);
      console.log(`  ✅ sql.Int 사용 성공: ${testResult1.recordset[0].cnt}건 발견`);
    } catch (err) {
      console.log(`  ❌ sql.Int 사용 실패: ${err.message}`);

      // Real 타입으로 재시도
      try {
        const testResult2 = await pool.request()
          .input('입출고일자', sql.VarChar(8), '20251020')
          .input('입출고번호', sql.Real, 1)
          .query(`
            SELECT COUNT(*) as cnt
            FROM 자재입출내역
            WHERE 입출고일자 = @입출고일자 AND 입출고번호 = @입출고번호
          `);
        console.log(`  ✅ sql.Real 사용 성공: ${testResult2.recordset[0].cnt}건 발견`);
      } catch (err2) {
        console.log(`  ❌ sql.Real 사용 실패: ${err2.message}`);
      }
    }

    await pool.close();
    console.log('\n✅ 스키마 확인 완료');
  } catch (err) {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
  }
}

checkSchema();
