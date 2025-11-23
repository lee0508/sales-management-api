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

    // 최근 거래명세서(입출고구분=2, 출고) 조회 - 자재명이 있는 것만
    const result = await pool.request().query(`
      SELECT TOP 5 i.거래일자, i.거래번호, i.분류코드, i.세부코드,
             i.출고수량, i.출고단가, i.출고부가,
             자재.자재명, 자재.규격, 자재.단위
      FROM 자재입출내역 i
      LEFT JOIN 자재
        ON i.분류코드 = 자재.분류코드
        AND (i.사업장코드 + i.세부코드) = 자재.세부코드
      WHERE i.입출고구분 = 2
        AND i.사용구분 = 0
        AND 자재.자재명 IS NOT NULL
      ORDER BY i.거래일자 DESC, i.거래번호 DESC
    `);

    console.log('✅ 자재명이 있는 최근 거래명세서:');
    console.table(result.recordset);

    if (result.recordset.length > 0) {
      const 거래일자 = result.recordset[0].거래일자;
      const 거래번호 = result.recordset[0].거래번호;

      console.log(`\n📝 테스트할 거래: ${거래일자}-${거래번호}`);

      // 해당 거래의 회계전표 조회
      const voucher = await pool.request().query(`
        SELECT 전표번호, 전표일자, 참조전표
        FROM 회계전표
        WHERE 참조전표 = '${거래일자}-${거래번호}'
          AND 사용구분 = 0
      `);

      console.log('\n✅ 해당 거래의 회계전표:');
      console.table(voucher.recordset);
    }

    await pool.close();
  } catch (err) {
    console.error('오류:', err.message);
  }
})();
