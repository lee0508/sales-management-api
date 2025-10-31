require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function testQuery() {
  try {
    const pool = await sql.connect(config);

    console.log('=== Testing transaction query ===\n');

    // Test 1: Check column names in 자재입출내역 table
    console.log('1. Checking column names:');
    const columnResult = await pool.request().query(`
      SELECT TOP 1 *
      FROM 자재입출내역
      WHERE 입출고구분 = 2
    `);

    if (columnResult.recordset.length > 0) {
      console.log('Available columns:', Object.keys(columnResult.recordset[0]).join(', '));
      console.log('\nSample data:');
      console.log(columnResult.recordset[0]);
    }

    // Test 2: Query with 거래일자 (current server.js approach)
    console.log('\n2. Query with 거래일자:');
    const query1 = await pool.request().query(`
      SELECT
        t.사업장코드,
        t.거래일자,
        t.거래번호,
        t.입출고구분,
        t.매출처코드,
        c.매출처명,
        SUM(ISNULL(t.출고수량,0) * ISNULL(t.출고단가,0)) AS 출고금액,
        SUM(ISNULL(t.출고부가,0)) AS 출고부가세
      FROM 자재입출내역 t
      LEFT JOIN 매출처 c ON t.매출처코드 = c.매출처코드
      WHERE t.사용구분 = 0
        AND t.입출고구분 = 2
        AND t.거래일자 = '20251031'
      GROUP BY t.사업장코드, t.거래일자, t.거래번호, t.입출고구분, t.매출처코드, c.매출처명
    `);

    console.log(`Found ${query1.recordset.length} records`);
    if (query1.recordset.length > 0) {
      console.log('Sample:', query1.recordset[0]);
    }

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testQuery();
