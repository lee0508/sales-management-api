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
  try {
    const pool = await sql.connect(config);

    // 자재입출내역에서 분류코드, 세부코드 확인
    const inventory = await pool.request().query(`
      SELECT TOP 1 사업장코드, 분류코드, 세부코드
      FROM 자재입출내역
      WHERE 거래일자 = '20251112' AND 거래번호 = 3
    `);

    console.log('자재입출내역 데이터:');
    console.table(inventory.recordset);

    if (inventory.recordset.length > 0) {
      const 분류코드 = inventory.recordset[0].분류코드;
      const 세부코드 = inventory.recordset[0].세부코드;
      const 사업장코드 = inventory.recordset[0].사업장코드;

      console.log('\n검색 조건:');
      console.log('분류코드:', 분류코드);
      console.log('세부코드:', 세부코드);
      console.log('사업장코드:', 사업장코드);
      console.log('사업장코드 + 세부코드:', 사업장코드 + 세부코드);

      // 자재 테이블에서 매칭되는 데이터 검색
      const material1 = await pool.request().query(`
        SELECT 분류코드, 세부코드, 자재명, 규격, 단위,
               LEN(세부코드) as 세부코드길이
        FROM 자재
        WHERE 분류코드 = '${분류코드}'
      `);

      console.log('\n자재 테이블 (같은 분류코드):');
      console.table(material1.recordset);
    }

    await pool.close();
  } catch (err) {
    console.error('오류:', err.message);
  }
})();
