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

    const result = await pool.request()
      .input('사업장코드', sql.VarChar(2), '01')
      .input('거래일자', sql.VarChar(8), '20251112')
      .input('거래번호', sql.Real, 3)
      .query(`
        SELECT
          i.*,
          자재.자재명,
          자재.규격,
          자재.단위,
          매입처.매입처명
        FROM 자재입출내역 i
          LEFT JOIN 자재
            ON i.분류코드 = 자재.분류코드
            AND i.세부코드 = 자재.세부코드
          LEFT JOIN 매입처
            ON i.매입처코드 = 매입처.매입처코드
            AND i.사업장코드 = 매입처.사업장코드
        WHERE i.사업장코드 = @사업장코드
          AND i.거래일자 = @거래일자
          AND i.거래번호 = @거래번호
          AND i.사용구분 = 0
      `);

    console.log('✅ 조회 성공!');
    console.table(result.recordset.map(r => ({
      입출고구분: r.입출고구분,
      자재명: r.자재명,
      규격: r.규격,
      단위: r.단위,
      입고수량: r.입고수량,
      입고단가: r.입고단가,
      입고부가: r.입고부가,
      매입처명: r.매입처명
    })));

    await pool.close();
  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
