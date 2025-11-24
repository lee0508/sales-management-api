/**
 * 매입전표 매입처코드 저장 확인
 */

require('dotenv').config();
const sql = require('mssql');

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

(async () => {
  try {
    console.log('🔌 데이터베이스 연결 중...\n');
    const pool = await sql.connect(config);

    console.log('========================================');
    console.log('최근 매입전표 매입처코드 확인');
    console.log('========================================\n');

    const result = await pool.request().query(`
      SELECT TOP 10
        거래일자, 거래번호,
        매입처코드,
        입출고구분,
        적요,
        입고수량, 입고단가, 입고부가
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND 사용구분 = 0
      ORDER BY 거래일자 DESC, 거래번호 DESC, 입출고시간 DESC
    `);

    console.table(result.recordset);

    if (result.recordset.length === 0) {
      console.log('\n⚠️ 매입전표 데이터가 없습니다.');
    } else {
      let emptyCount = 0;
      let validCount = 0;

      for (const row of result.recordset) {
        if (!row.매입처코드 || row.매입처코드.trim() === '') {
          emptyCount++;
          console.log(`\n⚠️ 빈 매입처코드 발견: 거래일자=${row.거래일자}, 거래번호=${row.거래번호}`);
        } else {
          validCount++;
        }
      }

      console.log(`\n========================================`);
      console.log(`총 ${result.recordset.length}건 중:`);
      console.log(`  ✅ 매입처코드 있음: ${validCount}건`);
      console.log(`  ⚠️ 매입처코드 없음: ${emptyCount}건`);
      console.log(`========================================\n`);
    }

    // 매입처 테이블 확인
    console.log('========================================');
    console.log('매입처 테이블 확인');
    console.log('========================================\n');

    const suppliers = await pool.request().query(`
      SELECT TOP 5 매입처코드, 매입처명
      FROM 매입처
      WHERE 사용구분 = 0
      ORDER BY 매입처코드
    `);

    console.table(suppliers.recordset);

    await pool.close();
    console.log('\n✅ 검사 완료\n');
  } catch (err) {
    console.error('❌ 오류:', err);
  }
})();
