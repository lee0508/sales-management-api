/**
 * 매입처코드 누락 데이터 상세 조회 스크립트
 *
 * 목적: 자재입출내역 테이블에서 매입처코드가 누락된 레코드의 상세 정보 조회
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
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

async function checkMissingSupplierCode() {
  let pool;

  try {
    console.log('✅ 데이터베이스 연결 중...\n');
    pool = await sql.connect(config);

    console.log('========================================');
    console.log('🔍 매입처코드 누락 레코드 상세 조회');
    console.log('========================================\n');

    // 1. 전체 매입처코드 누락 건 조회
    const allMissingQuery = `
      SELECT
        거래일자, 거래번호, 입출고일자, 입출고시간,
        사업장코드, 분류코드, 세부코드,
        입고수량, 입고단가, 입고부가,
        (입고수량 * 입고단가) as 공급가액,
        매입처코드, 적요
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (매입처코드 IS NULL OR 매입처코드 = '' OR LTRIM(RTRIM(매입처코드)) = '')
        AND 사용구분 = 0
      ORDER BY 거래일자 DESC, 거래번호 DESC
    `;

    const allMissing = await pool.request().query(allMissingQuery);

    console.log(`📋 매입처코드 누락 총 건수: ${allMissing.recordset.length}건\n`);

    // 2. 즉시 수정 필요한 건 (수량>0, 단가>0)
    const urgentRecords = allMissing.recordset.filter(
      r => r.입고수량 > 0 && r.입고단가 > 0
    );

    console.log('🚨 즉시 수정 필요 (수량>0, 단가>0):');
    console.log(`   건수: ${urgentRecords.length}건\n`);

    if (urgentRecords.length > 0) {
      console.log('   상세 내역:');
      urgentRecords.forEach((record, index) => {
        console.log(`\n   [${index + 1}] 거래일자: ${record.거래일자}, 거래번호: ${record.거래번호}`);
        console.log(`       입출고일자: ${record.입출고일자}, 시간: ${record.입출고시간}`);
        console.log(`       사업장코드: ${record.사업장코드}`);
        console.log(`       자재: ${record.분류코드}${record.세부코드}`);
        console.log(`       입고수량: ${record.입고수량.toLocaleString()}개`);
        console.log(`       입고단가: ${record.입고단가.toLocaleString()}원`);
        console.log(`       입고부가: ${record.입고부가.toLocaleString()}원`);
        console.log(`       공급가액: ${record.공급가액.toLocaleString()}원`);
        console.log(`       적요: ${record.적요 || '(없음)'}`);
      });
    }

    // 3. 단가=0 건 (나중에 수정 예정)
    const zeroRecords = allMissing.recordset.filter(
      r => r.입고단가 === 0
    );

    console.log('\n\n⚠️  단가=0 (나중에 수정 예정):');
    console.log(`   건수: ${zeroRecords.length}건\n`);

    if (zeroRecords.length > 0) {
      console.log('   상세 내역:');
      zeroRecords.slice(0, 5).forEach((record, index) => {
        console.log(`\n   [${index + 1}] 거래일자: ${record.거래일자}, 거래번호: ${record.거래번호}`);
        console.log(`       자재: ${record.분류코드}${record.세부코드}`);
        console.log(`       입고수량: ${record.입고수량}, 입고단가: ${record.입고단가}`);
      });
      if (zeroRecords.length > 5) {
        console.log(`\n   ... 외 ${zeroRecords.length - 5}건`);
      }
    }

    // 4. 20251109 거래번호 2번 건 집중 분석
    console.log('\n\n========================================');
    console.log('🎯 20251109 거래번호 2번 건 집중 분석');
    console.log('========================================\n');

    const targetQuery = `
      SELECT
        거래일자, 거래번호, 입출고일자, 입출고시간,
        사업장코드, 분류코드, 세부코드,
        입고수량, 입고단가, 입고부가,
        (입고수량 * 입고단가) as 공급가액,
        (입고수량 * 입고단가 + 입고부가) as 합계금액,
        매입처코드, 적요, 사용자코드
      FROM 자재입출내역
      WHERE 거래일자 = '20251109'
        AND 거래번호 = 2
        AND 입출고구분 = 1
        AND 사용구분 = 0
      ORDER BY 입출고시간
    `;

    const targetRecords = await pool.request().query(targetQuery);

    if (targetRecords.recordset.length > 0) {
      console.log(`📋 총 ${targetRecords.recordset.length}건의 품목\n`);

      let totalSupply = 0;
      let totalTax = 0;
      let totalAmount = 0;

      targetRecords.recordset.forEach((record, index) => {
        console.log(`[품목 ${index + 1}]`);
        console.log(`  자재코드: ${record.분류코드}${record.세부코드}`);
        console.log(`  입고수량: ${record.입고수량.toLocaleString()}개`);
        console.log(`  입고단가: ${record.입고단가.toLocaleString()}원`);
        console.log(`  공급가액: ${record.공급가액.toLocaleString()}원`);
        console.log(`  부가세: ${record.입고부가.toLocaleString()}원`);
        console.log(`  합계: ${record.합계금액.toLocaleString()}원`);
        console.log(`  사업장코드: ${record.사업장코드}`);
        console.log(`  사용자코드: ${record.사용자코드}`);
        console.log(`  적요: ${record.적요 || '(없음)'}\n`);

        totalSupply += record.공급가액;
        totalTax += record.입고부가;
        totalAmount += record.합계금액;
      });

      console.log('─────────────────────────────────');
      console.log(`총 공급가액: ${totalSupply.toLocaleString()}원`);
      console.log(`총 부가세: ${totalTax.toLocaleString()}원`);
      console.log(`총 합계: ${totalAmount.toLocaleString()}원`);
      console.log('─────────────────────────────────\n');
    } else {
      console.log('❌ 해당 레코드를 찾을 수 없습니다.\n');
    }

    // 5. 가능한 매입처 추측 (같은 날짜, 다른 거래번호에서 매입처코드 확인)
    console.log('========================================');
    console.log('🔍 매입처 추측 (같은 날짜 다른 거래)');
    console.log('========================================\n');

    const relatedQuery = `
      SELECT DISTINCT
        거래일자, 거래번호, 매입처코드,
        COUNT(*) as 품목수
      FROM 자재입출내역
      WHERE 거래일자 = '20251109'
        AND 입출고구분 = 1
        AND 사용구분 = 0
        AND 매입처코드 IS NOT NULL
        AND 매입처코드 != ''
      GROUP BY 거래일자, 거래번호, 매입처코드
      ORDER BY 거래번호
    `;

    const relatedRecords = await pool.request().query(relatedQuery);

    if (relatedRecords.recordset.length > 0) {
      console.log('📋 같은 날짜의 다른 매입전표:\n');
      relatedRecords.recordset.forEach(record => {
        console.log(`  거래번호 ${record.거래번호}: 매입처코드 ${record.매입처코드} (품목 ${record.품목수}개)`);
      });
      console.log('\n💡 위 매입처 중 하나일 가능성이 있습니다.\n');
    } else {
      console.log('📋 같은 날짜에 매입처코드가 있는 다른 거래가 없습니다.\n');
    }

    console.log('========================================');
    console.log('✅ 조회 완료');
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ 오류 발생:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkMissingSupplierCode();
