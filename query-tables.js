const sql = require('mssql');
require('dotenv').config();

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

async function queryTables() {
  try {
    const pool = await sql.connect(config);

    console.log('='.repeat(80));
    console.log('1. 모든 테이블 목록');
    console.log('='.repeat(80));
    const tables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    console.log(tables.recordset.map(t => t.TABLE_NAME).join('\n'));

    console.log('\n' + '='.repeat(80));
    console.log('2. 미수금내역 테이블 구조');
    console.log('='.repeat(80));
    try {
      const receivable = await pool.request().query(`
        SELECT TOP 5 * FROM 미수금내역 ORDER BY 미수금발생일자 DESC
      `);
      if (receivable.recordset.length > 0) {
        console.log('컬럼:', Object.keys(receivable.recordset[0]).join(', '));
        console.log('\n샘플 데이터:');
        receivable.recordset.forEach((row, index) => {
          console.log(`\n--- 레코드 ${index + 1} ---`);
          console.log(JSON.stringify(row, null, 2));
        });
      } else {
        console.log('데이터 없음');
      }
    } catch (err) {
      console.log('테이블 없음 또는 에러:', err.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('3. 미지급금내역 테이블 구조');
    console.log('='.repeat(80));
    const payable = await pool.request().query(`
      SELECT TOP 5 * FROM 미지급금내역 ORDER BY 미지급금지급일자 DESC
    `);
    if (payable.recordset.length > 0) {
      console.log('컬럼:', Object.keys(payable.recordset[0]).join(', '));
      console.log('\n샘플 데이터:');
      payable.recordset.forEach((row, index) => {
        console.log(`\n--- 레코드 ${index + 1} ---`);
        console.log(JSON.stringify(row, null, 2));
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('4. 자재분류 테이블 구조');
    console.log('='.repeat(80));
    const category = await pool.request().query(`
      SELECT TOP 5 * FROM 자재분류 WHERE 사용구분 = 0
    `);
    if (category.recordset.length > 0) {
      console.log('컬럼:', Object.keys(category.recordset[0]).join(', '));
      console.log('\n샘플 데이터:');
      category.recordset.forEach((row, index) => {
        console.log(`\n--- 레코드 ${index + 1} ---`);
        console.log(JSON.stringify(row, null, 2));
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('5. 자재원장 테이블 구조');
    console.log('='.repeat(80));
    const ledger = await pool.request().query(`
      SELECT TOP 5 * FROM 자재원장
    `);
    if (ledger.recordset.length > 0) {
      console.log('컬럼:', Object.keys(ledger.recordset[0]).join(', '));
      console.log('\n샘플 데이터:');
      ledger.recordset.forEach((row, index) => {
        console.log(`\n--- 레코드 ${index + 1} ---`);
        console.log(JSON.stringify(row, null, 2));
      });
    }

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('에러:', err);
    process.exit(1);
  }
}

queryTables();