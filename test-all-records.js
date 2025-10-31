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

    console.log('=== All records for 20251031 ===\n');

    const result = await pool.request().query(`
      SELECT [입출고구분], [거래일자], [거래번호], [매출처코드], [사용구분], COUNT(*) as count
      FROM [YmhDB].[dbo].[자재입출내역]
      WHERE [거래일자] = '20251031'
      GROUP BY [입출고구분], [거래일자], [거래번호], [매출처코드], [사용구분]
      ORDER BY [입출고구분], [거래번호]
    `);

    console.log(`Found ${result.recordset.length} grouped records:`);
    result.recordset.forEach((rec, index) => {
      const type = rec.입출고구분 === 1 ? '입고(매입)' : '출고(거래명세서)';
      console.log(`${index + 1}. ${type}, 거래번호=${rec.거래번호}, 매출처=${rec.매출처코드}, 사용구분=${rec.사용구분}, count=${rec.count}`);
    });

    console.log('\n=== Filtering for 입출고구분=2 (출고/거래명세서) ===\n');

    const result2 = await pool.request().query(`
      SELECT *
      FROM [YmhDB].[dbo].[자재입출내역]
      WHERE [거래일자] = '20251031'
        AND [입출고구분] = 2
        AND [사용구분] = 0
    `);

    console.log(`Found ${result2.recordset.length} records for 거래명세서`);
    if (result2.recordset.length > 0) {
      console.log('\nFirst record:');
      console.log(result2.recordset[0]);
    }

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testQuery();
