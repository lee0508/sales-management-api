/**
 * 매입처코드 누락 데이터 수정 스크립트
 *
 * 목적: 매입처코드가 누락된 레코드를 사용구분=9로 처리 (Soft Delete)
 */

require('dotenv').config();
const sql = require('mssql');
const readline = require('readline');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function fixMissingSupplierCode() {
  let pool;

  try {
    console.log('✅ 데이터베이스 연결 중...\n');
    pool = await sql.connect(config);

    console.log('========================================');
    console.log('🔍 매입처코드 누락 레코드 조회');
    console.log('========================================\n');

    // 1. 매입처코드 누락 건 조회
    const missingQuery = `
      SELECT
        거래일자, 거래번호, 입출고일자,
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

    const missingRecords = await pool.request().query(missingQuery);
    const totalCount = missingRecords.recordset.length;

    console.log(`📋 매입처코드 누락 총 건수: ${totalCount}건\n`);

    if (totalCount === 0) {
      console.log('✅ 수정할 데이터가 없습니다.\n');
      rl.close();
      return;
    }

    // 2. 즉시 수정 필요한 건 (수량>0, 단가>0)
    const urgentRecords = missingRecords.recordset.filter(
      r => r.입고수량 > 0 && r.입고단가 > 0
    );

    console.log('🚨 즉시 수정 필요 (수량>0, 단가>0):');
    console.log(`   건수: ${urgentRecords.length}건\n`);

    if (urgentRecords.length > 0) {
      console.log('   상세 내역:');
      urgentRecords.forEach((record, index) => {
        console.log(`\n   [${index + 1}] 거래일자: ${record.거래일자}, 거래번호: ${record.거래번호}`);
        console.log(`       자재: ${record.분류코드}${record.세부코드}`);
        console.log(`       입고수량: ${record.입고수량.toLocaleString()}개`);
        console.log(`       입고단가: ${record.입고단가.toLocaleString()}원`);
        console.log(`       공급가액: ${record.공급가액.toLocaleString()}원`);
      });
    }

    // 3. 단가=0 건 (나중에 수정 예정)
    const zeroRecords = missingRecords.recordset.filter(
      r => r.입고단가 === 0
    );

    console.log('\n\n⚠️  단가=0 (나중에 수정 예정):');
    console.log(`   건수: ${zeroRecords.length}건\n`);

    // 4. 사용자 확인
    console.log('\n========================================');
    console.log('❓ 수정 옵션');
    console.log('========================================\n');
    console.log('1. 즉시 수정 필요한 건만 처리 (수량>0, 단가>0): ' + urgentRecords.length + '건');
    console.log('2. 모든 누락 건 처리: ' + totalCount + '건');
    console.log('3. 취소\n');

    const choice = await question('선택 (1/2/3): ');

    if (choice === '3') {
      console.log('\n❌ 작업을 취소했습니다.\n');
      rl.close();
      return;
    }

    let recordsToFix = [];
    if (choice === '1') {
      recordsToFix = urgentRecords;
    } else if (choice === '2') {
      recordsToFix = missingRecords.recordset;
    } else {
      console.log('\n❌ 잘못된 선택입니다.\n');
      rl.close();
      return;
    }

    if (recordsToFix.length === 0) {
      console.log('\n✅ 수정할 데이터가 없습니다.\n');
      rl.close();
      return;
    }

    // 5. 최종 확인
    console.log(`\n📋 총 ${recordsToFix.length}건의 레코드를 사용구분=9로 변경합니다.`);
    console.log('⚠️  이 작업은 되돌릴 수 없습니다!\n');

    const confirm = await question('계속하시겠습니까? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ 작업을 취소했습니다.\n');
      rl.close();
      return;
    }

    // 6. 데이터 수정
    console.log('\n========================================');
    console.log('🔧 데이터 수정 중...');
    console.log('========================================\n');

    let successCount = 0;
    let failCount = 0;

    for (const record of recordsToFix) {
      try {
        await pool.request()
          .input('거래일자', sql.VarChar(8), record.거래일자)
          .input('거래번호', sql.Real, record.거래번호)
          .input('입출고일자', sql.VarChar(8), record.입출고일자)
          .input('분류코드', sql.VarChar(2), record.분류코드)
          .input('세부코드', sql.VarChar(16), record.세부코드)
          .query(`
            UPDATE 자재입출내역
            SET 사용구분 = 9
            WHERE 거래일자 = @거래일자
              AND 거래번호 = @거래번호
              AND 입출고일자 = @입출고일자
              AND 분류코드 = @분류코드
              AND 세부코드 = @세부코드
              AND 입출고구분 = 1
          `);

        successCount++;
        console.log(`✅ [${successCount}/${recordsToFix.length}] ${record.거래일자}-${record.거래번호} (${record.분류코드}${record.세부코드})`);
      } catch (err) {
        failCount++;
        console.error(`❌ 오류: ${record.거래일자}-${record.거래번호} - ${err.message}`);
      }
    }

    // 7. 결과 요약
    console.log('\n========================================');
    console.log('📊 수정 완료');
    console.log('========================================\n');
    console.log(`✅ 성공: ${successCount}건`);
    console.log(`❌ 실패: ${failCount}건\n`);

    // 8. 검증
    console.log('========================================');
    console.log('🔍 수정 후 검증');
    console.log('========================================\n');

    const verifyQuery = `
      SELECT COUNT(*) as 건수
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (매입처코드 IS NULL OR 매입처코드 = '' OR LTRIM(RTRIM(매입처코드)) = '')
        AND 사용구분 = 0
    `;

    const verifyResult = await pool.request().query(verifyQuery);
    const remainingCount = verifyResult.recordset[0].건수;

    console.log(`📋 남은 매입처코드 누락 건수: ${remainingCount}건\n`);

    if (remainingCount === 0) {
      console.log('✅ 모든 매입처코드 누락 건이 처리되었습니다!\n');
    } else {
      console.log('⚠️  아직 처리되지 않은 건이 있습니다.\n');
      console.log('💡 validate-core-fields.js 스크립트를 실행하여 확인하세요.\n');
    }

    rl.close();

  } catch (err) {
    console.error('❌ 오류 발생:', err);
    rl.close();
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

fixMissingSupplierCode();
