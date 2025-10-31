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

async function checkTable() {
  try {
    const pool = await sql.connect(config);

    console.log('=== 미수금내역 테이블 구조 ===\n');

    const schema = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '미수금내역'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('Columns:');
    schema.recordset.forEach(col => {
      const type = col.DATA_TYPE;
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`- ${col.COLUMN_NAME}: ${type}${length}`);
    });

    console.log('\n=== 샘플 데이터 ===\n');
    const sample = await pool.request().query(`
      SELECT TOP 5 * FROM 미수금내역
      ORDER BY 미수금입금일자 DESC
    `);

    if (sample.recordset.length > 0) {
      console.log('Sample record:');
      console.log(sample.recordset[0]);
    } else {
      console.log('No data in table');
    }

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkTable();
