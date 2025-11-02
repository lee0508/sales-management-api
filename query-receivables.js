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

async function query() {
  const pool = await sql.connect(config);

  console.log('='.repeat(80));
  console.log('미수금내역 테이블 구조:');
  console.log('='.repeat(80));
  const columns = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '미수금내역'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(columns.recordset);

  console.log('\n미수금내역 샘플 데이터:');
  const data = await pool.request().query(`SELECT TOP 5 * FROM 미수금내역`);
  console.log(JSON.stringify(data.recordset, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('미수금원장 테이블 구조:');
  console.log('='.repeat(80));
  const ledgerCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '미수금원장'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(ledgerCols.recordset);

  console.log('\n미수금원장 샘플 데이터:');
  const ledgerData = await pool.request().query(`SELECT TOP 5 * FROM 미수금원장`);
  console.log(JSON.stringify(ledgerData.recordset, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('미수금원장마감 테이블 구조:');
  console.log('='.repeat(80));
  const closingCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '미수금원장마감'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(closingCols.recordset);

  console.log('\n미수금원장마감 샘플 데이터:');
  const closingData = await pool.request().query(`SELECT TOP 5 * FROM 미수금원장마감`);
  console.log(JSON.stringify(closingData.recordset, null, 2));

  await pool.close();
  process.exit(0);
}

query().catch(err => { console.error(err); process.exit(1); });