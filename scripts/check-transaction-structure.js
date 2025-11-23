const sql = require('mssql');
const dotenv = require('dotenv');
dotenv.config();

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

async function checkStructure() {
  try {
    const pool = await sql.connect(config);

    console.log('=== 거래명세서 (자재입출내역 - 출고) 구조 확인 ===\n');

    // 거래명세서 샘플 조회
    const 거래명세서 = await pool.request().query(`
      SELECT TOP 3
        사업장코드, 거래일자, 거래번호, 입출고구분, 매출처코드,
        분류코드, 세부코드, 출고수량, 출고단가, 출고부가
      FROM 자재입출내역
      WHERE 입출고구분 = 2 AND 사용구분 = 0
      ORDER BY 거래일자 DESC, 거래번호 DESC
    `);

    console.log('📋 거래명세서 샘플 (입출고구분=2):');
    console.table(거래명세서.recordset);

    console.log('\n=== 매입전표 (자재입출내역 - 입고) 구조 확인 ===\n');

    // 매입전표 샘플 조회
    const 매입전표 = await pool.request().query(`
      SELECT TOP 3
        사업장코드, 거래일자, 거래번호, 입출고구분, 매입처코드,
        분류코드, 세부코드, 입고수량, 입고단가, 입고부가
      FROM 자재입출내역
      WHERE 입출고구분 = 1 AND 사용구분 = 0
      ORDER BY 거래일자 DESC, 거래번호 DESC
    `);

    console.log('📋 매입전표 샘플 (입출고구분=1):');
    console.table(매입전표.recordset);

    console.log('\n=== 번호 체계 분석 ===\n');
    console.log('✅ 거래명세서 번호 구성:');
    console.log('   - PK: 사업장코드 + 거래일자 + 거래번호 + 거래시간');
    console.log('   - 표시 형식: "거래일자-거래번호" (예: 20251109-1)');
    console.log('');
    console.log('✅ 매입전표 번호 구성:');
    console.log('   - PK: 사업장코드 + 거래일자 + 거래번호 + 거래시간');
    console.log('   - 표시 형식: "거래일자-거래번호" (예: 20251109-3)');
    console.log('');
    console.log('📝 회계전표 참조전표 형식 제안:');
    console.log('   ┌─────────────────────────────────────────────┐');
    console.log('   │ 거래명세서: "출고-YYYYMMDD-번호"             │');
    console.log('   │   예: 출고-20251109-1                       │');
    console.log('   ├─────────────────────────────────────────────┤');
    console.log('   │ 매입전표: "매입-YYYYMMDD-번호"               │');
    console.log('   │   예: 매입-20251109-3                       │');
    console.log('   └─────────────────────────────────────────────┘');
    console.log('');
    console.log('💡 참조전표로 역추적 가능:');
    console.log('   - "출고-20251109-1" → 자재입출내역 WHERE 입출고구분=2 AND 거래일자=20251109 AND 거래번호=1');
    console.log('   - "매입-20251109-3" → 자재입출내역 WHERE 입출고구분=1 AND 거래일자=20251109 AND 거래번호=3');

    await pool.close();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkStructure();
