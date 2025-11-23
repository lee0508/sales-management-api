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

    // 자재입출내역에서 샘플 데이터 조회
    const inventory = await pool.request().query(`
      SELECT TOP 1 사업장코드, 분류코드, 세부코드
      FROM 자재입출내역
      WHERE 거래일자 = '20251112' AND 거래번호 = 3
    `);

    console.log('📦 자재입출내역 데이터:');
    console.table(inventory.recordset);

    if (inventory.recordset.length > 0) {
      const inv = inventory.recordset[0];
      console.log('\n🔍 검색 조건:');
      console.log('  사업장코드:', inv.사업장코드);
      console.log('  분류코드:', inv.분류코드);
      console.log('  세부코드:', inv.세부코드);
      console.log('  사업장코드 + 세부코드:', inv.사업장코드 + inv.세부코드);

      // 방법 1: 사업장코드 + 세부코드로 검색
      const result1 = await pool.request().query(`
        SELECT 분류코드, 세부코드, 자재명
        FROM 자재
        WHERE 분류코드 = '${inv.분류코드}'
          AND 세부코드 = '${inv.사업장코드 + inv.세부코드}'
      `);

      console.log('\n✅ 방법 1 - 세부코드 = 사업장코드 + 세부코드:');
      console.table(result1.recordset);

      // 방법 2: 세부코드로만 검색
      const result2 = await pool.request().query(`
        SELECT 분류코드, 세부코드, 자재명
        FROM 자재
        WHERE 분류코드 = '${inv.분류코드}'
          AND 세부코드 = '${inv.세부코드}'
      `);

      console.log('\n✅ 방법 2 - 세부코드만:');
      console.table(result2.recordset);

      // 방법 3: 세부코드 끝부분이 일치하는 것 검색
      const result3 = await pool.request().query(`
        SELECT 분류코드, 세부코드, 자재명,
               LEN(세부코드) as 세부코드길이,
               RIGHT(세부코드, LEN('${inv.세부코드}')) as 끝부분
        FROM 자재
        WHERE 분류코드 = '${inv.분류코드}'
          AND RIGHT(세부코드, LEN('${inv.세부코드}')) = '${inv.세부코드}'
      `);

      console.log('\n✅ 방법 3 - 세부코드 끝부분 일치:');
      console.table(result3.recordset);

      // 방법 4: 세부코드 LIKE 검색
      const result4 = await pool.request().query(`
        SELECT 분류코드, 세부코드, 자재명
        FROM 자재
        WHERE 분류코드 = '${inv.분류코드}'
          AND 세부코드 LIKE '%${inv.세부코드}%'
      `);

      console.log('\n✅ 방법 4 - LIKE 검색:');
      console.table(result4.recordset);
    }

    await pool.close();
  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
