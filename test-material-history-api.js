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

async function testQuery() {
  const pool = await sql.connect(config);

  const materialCode = '0101CODE04489';
  const 사업장코드 = materialCode.substring(0, 2);  // "01"
  const 분류코드 = materialCode.substring(2, 4);    // "01"
  const 세부코드 = materialCode.substring(4);        // "CODE04489"

  console.log('파라미터:');
  console.log('사업장코드:', 사업장코드);
  console.log('분류코드:', 분류코드);
  console.log('세부코드:', 세부코드);

  let query = `
    SELECT
      t.사업장코드,
      t.분류코드,
      t.세부코드,
      (t.분류코드 + t.세부코드) AS 자재코드,
      m.자재명,
      m.규격,
      m.단위,
      t.입출고구분,
      CASE t.입출고구분
        WHEN 1 THEN '입고'
        WHEN 2 THEN '출고'
        ELSE '기타'
      END AS 입출고구분명,
      t.입출고일자,
      t.거래일자,
      t.거래번호,
      t.입고수량,
      t.입고단가,
      t.입고부가,
      (t.입고수량 * t.입고단가) AS 입고공급가액,
      (t.입고수량 * t.입고단가 + t.입고부가) AS 입고합계,
      t.출고수량,
      t.출고단가,
      t.출고부가,
      (t.출고수량 * t.출고단가) AS 출고공급가액,
      (t.출고수량 * t.출고단가 + t.출고부가) AS 출고합계,
      t.매입처코드,
      s.매입처명,
      t.매출처코드,
      c.매출처명,
      t.적요,
      t.수정일자,
      u.사용자명
    FROM 자재입출내역 t
    LEFT JOIN 자재 m ON t.분류코드 = m.분류코드
      AND t.사업장코드 + t.세부코드 = m.세부코드
    LEFT JOIN 매입처 s ON t.매입처코드 = s.매입처코드
    LEFT JOIN 매출처 c ON t.매출처코드 = c.매출처코드
    LEFT JOIN 사용자 u ON t.사용자코드 = u.사용자코드
    WHERE t.사용구분 = 0
      AND t.사업장코드 = @사업장코드
      AND t.분류코드 = @분류코드
      AND t.세부코드 = @세부코드
    ORDER BY t.입출고일자 DESC, t.거래일자 DESC, t.거래번호 DESC
  `;

  console.log('\n실행 쿼리:\n', query);

  try {
    const result = await pool.request()
      .input('사업장코드', sql.VarChar(2), 사업장코드)
      .input('분류코드', sql.VarChar(2), 분류코드)
      .input('세부코드', sql.VarChar(16), 세부코드)
      .query(query);

    console.log('\n✅ 조회 성공! 결과:', result.recordset.length, '건');
    if (result.recordset.length > 0) {
      console.log('\n첫 번째 레코드:');
      console.log(JSON.stringify(result.recordset[0], null, 2));
    }
  } catch (err) {
    console.error('\n❌ 쿼리 실행 에러:');
    console.error(err);
  }

  await pool.close();
  process.exit(0);
}

testQuery().catch(err => { console.error(err); process.exit(1); });