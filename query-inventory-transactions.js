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
  console.log('자재입출내역 테이블 구조:');
  console.log('='.repeat(80));
  const columns = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '자재입출내역'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(columns.recordset);

  console.log('\n자재입출내역 샘플 데이터 (입출고구분=1, 매입):');
  const purchase = await pool.request().query(`
    SELECT TOP 3 * FROM 자재입출내역
    WHERE 입출고구분 = 1 AND 사용구분 = 0
    ORDER BY 거래일자 DESC
  `);
  console.log(JSON.stringify(purchase.recordset, null, 2));

  console.log('\n자재입출내역 샘플 데이터 (입출고구분=2, 매출):');
  const sales = await pool.request().query(`
    SELECT TOP 3 * FROM 자재입출내역
    WHERE 입출고구분 = 2 AND 사용구분 = 0
    ORDER BY 거래일자 DESC
  `);
  console.log(JSON.stringify(sales.recordset, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('분류코드 분포 확인:');
  console.log('='.repeat(80));
  const categories = await pool.request().query(`
    SELECT DISTINCT 분류코드, COUNT(*) as 건수
    FROM 자재입출내역
    WHERE 사용구분 = 0
    GROUP BY 분류코드
    ORDER BY 분류코드
  `);
  console.log(categories.recordset);

  console.log('\n' + '='.repeat(80));
  console.log('자재분류 테이블과의 관계 확인:');
  console.log('='.repeat(80));
  const relation = await pool.request().query(`
    SELECT
      c.분류코드,
      c.분류명,
      COUNT(t.거래일자) as 거래건수
    FROM 자재분류 c
    LEFT JOIN 자재입출내역 t ON c.분류코드 = t.분류코드 AND t.사용구분 = 0
    WHERE c.사용구분 = 0
    GROUP BY c.분류코드, c.분류명
    ORDER BY c.분류코드
  `);
  console.log(relation.recordset);

  await pool.close();
  process.exit(0);
}

query().catch(err => { console.error(err); process.exit(1); });