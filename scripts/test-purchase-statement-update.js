/**
 * 매입전표 수정 기능 테스트 스크립트
 *
 * 테스트 시나리오:
 * 1. 테스트용 매입전표 생성
 * 2. 생성된 데이터 확인 (자재입출내역, 미지급금내역, 회계전표내역)
 * 3. 매입전표 수정
 * 4. 수정된 데이터 확인
 * 5. 금액 일치 여부 검증
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

async function testPurchaseStatementUpdate() {
  let pool;

  try {
    console.log('🔌 데이터베이스 연결 중...\n');
    pool = await sql.connect(config);

    const 거래일자 = '20251123';
    const 사업장코드 = '01';
    const 매입처코드 = '00000001';
    const 사용자코드 = '8080';

    // 1️⃣ 테스트용 매입전표 조회 (오늘 날짜 기준 첫 번째 매입전표)
    console.log('========================================');
    console.log('1️⃣ 테스트 대상 매입전표 조회');
    console.log('========================================\n');

    const purchaseResult = await pool.request().input('거래일자', sql.VarChar(8), 거래일자).query(`
        SELECT TOP 1
          거래일자, 거래번호, 매입처코드,
          SUM((입고수량 * 입고단가) + 입고부가) AS 총금액,
          COUNT(*) AS 품목수
        FROM 자재입출내역
        WHERE 거래일자 = @거래일자
          AND 입출고구분 = 1
          AND 사용구분 = 0
        GROUP BY 거래일자, 거래번호, 매입처코드
        ORDER BY 거래번호 DESC
      `);

    if (purchaseResult.recordset.length === 0) {
      console.log('⚠️ 테스트 대상 매입전표가 없습니다.');
      console.log('💡 먼저 POST /api/purchase-statements 로 매입전표를 생성하세요.\n');
      return;
    }

    const { 거래번호, 총금액, 품목수 } = purchaseResult.recordset[0];
    console.log(`✅ 테스트 대상: ${거래일자}-${거래번호}`);
    console.log(`   매입처코드: ${매입처코드}`);
    console.log(`   총금액: ${총금액.toLocaleString()}원`);
    console.log(`   품목수: ${품목수}개\n`);

    // 2️⃣ 수정 전 데이터 확인
    console.log('========================================');
    console.log('2️⃣ 수정 전 데이터 확인');
    console.log('========================================\n');

    // 자재입출내역
    const inventoryBefore = await pool
      .request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, 거래번호).query(`
        SELECT 분류코드, 세부코드, 입고수량, 입고단가, 입고부가
        FROM 자재입출내역
        WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호
      `);

    console.log('📦 자재입출내역 (수정 전):');
    console.table(inventoryBefore.recordset);

    // 미지급금내역
    const payableBefore = await pool
      .request()
      .input('적요', sql.VarChar(50), `매입전표 ${거래일자}-${거래번호}`).query(`
        SELECT 미지급금지급일자, 미지급금지급금액, 적요
        FROM 미지급금내역
        WHERE 적요 = @적요
      `);

    console.log('\n💰 미지급금내역 (수정 전):');
    console.table(payableBefore.recordset);

    // 회계전표내역
    const accountingBefore = await pool
      .request()
      .input('전표일자', sql.VarChar(8), 거래일자)
      .input('적요패턴', sql.NVarChar(100), `%매입전표 ${거래일자}-${거래번호}%`).query(`
        SELECT 전표번호, 차대구분, 계정과목코드, 금액, 적요
        FROM 회계전표내역
        WHERE 전표일자 = @전표일자 AND 적요 LIKE @적요패턴
      `);

    console.log('\n📋 회계전표내역 (수정 전):');
    console.table(accountingBefore.recordset);

    // 3️⃣ 시뮬레이션: 수정 로직 (실제 API 호출 대신 SQL 직접 실행)
    console.log('\n========================================');
    console.log('3️⃣ 수정 시뮬레이션 (트랜잭션)');
    console.log('========================================\n');

    console.log('⚠️  이 스크립트는 실제로 데이터를 수정하지 않습니다.');
    console.log('💡 실제 수정은 PUT /api/purchase-statements/:date/:no 를 호출하세요.\n');

    // 수정할 데이터 예시
    const 수정데이터 = {
      details: [
        {
          자재코드: inventoryBefore.recordset[0]?.분류코드 + inventoryBefore.recordset[0]?.세부코드,
          수량: 200, // 변경
          단가: 6000, // 변경
        },
      ],
    };

    console.log('📝 수정 예시 데이터:');
    console.log(JSON.stringify(수정데이터, null, 2));
    console.log('');

    // 4️⃣ 삭제/재생성 시뮬레이션 (실제 실행 안 함)
    console.log('🔄 수정 프로세스 (시뮬레이션):');
    console.log('   1. DELETE 자재입출내역 (거래일자 + 거래번호)');
    console.log('   2. DELETE 미지급금내역 (적요 매칭)');
    console.log('   3. DELETE 회계전표내역 (적요 LIKE 패턴)');
    console.log('   4. 합계 재계산: 200 × 6,000 × 1.1 = 1,320,000원');
    console.log('   5. INSERT 새로운 자재입출내역');
    console.log('   6. INSERT 새로운 미지급금내역');
    console.log('   7. EXEC sp_매입전표_회계전표_자동생성\n');

    // 5️⃣ 데이터 무결성 검증
    console.log('========================================');
    console.log('5️⃣ 데이터 무결성 검증');
    console.log('========================================\n');

    const integrityCheck = await pool
      .request()
      .input('거래일자', sql.VarChar(8), 거래일자)
      .input('거래번호', sql.Real, 거래번호)
      .input('적요', sql.VarChar(50), `매입전표 ${거래일자}-${거래번호}`).query(`
        SELECT
          (SELECT SUM((입고수량 * 입고단가) + 입고부가)
           FROM 자재입출내역
           WHERE 거래일자 = @거래일자 AND 거래번호 = @거래번호) AS 자재입출총액,
          (SELECT 미지급금지급금액
           FROM 미지급금내역
           WHERE 적요 = @적요) AS 미지급금액
      `);

    const { 자재입출총액, 미지급금액 } = integrityCheck.recordset[0];

    console.log('💵 금액 일치 확인:');
    console.log(`   자재입출총액: ${자재입출총액?.toLocaleString() || '0'}원`);
    console.log(`   미지급금액:   ${미지급금액?.toLocaleString() || '0'}원`);

    if (자재입출총액 === 미지급금액) {
      console.log('   ✅ 금액 일치!\n');
    } else {
      console.log('   ❌ 금액 불일치! (데이터 무결성 오류)\n');
    }

    // 6️⃣ API 호출 예시
    console.log('========================================');
    console.log('6️⃣ API 호출 예시');
    console.log('========================================\n');

    console.log('cURL 명령어:');
    console.log(`curl -X PUT http://localhost:3000/api/purchase-statements/${거래일자}/${거래번호} \\
  -H "Content-Type: application/json" \\
  -H "Cookie: connect.sid=<your_session_id>" \\
  -d '{
    "입출고구분": 1,
    "매입처코드": "${매입처코드}",
    "적요": "원자재 매입 (수정)",
    "details": [
      {
        "자재코드": "${inventoryBefore.recordset[0]?.분류코드 + inventoryBefore.recordset[0]?.세부코드}",
        "수량": 200,
        "단가": 6000
      }
    ]
  }'
`);

    console.log('\n✅ 테스트 완료\n');
  } catch (err) {
    console.error('❌ 오류 발생:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// 스크립트 실행
(async () => {
  await testPurchaseStatementUpdate();
})();
