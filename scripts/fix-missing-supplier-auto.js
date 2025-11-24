/**
 * 매입처코드 누락 데이터 자동 수정 스크립트
 *
 * 목적: 매입처코드가 누락된 레코드 중 즉시 수정 필요한 건(수량>0, 단가>0)을
 *       자동으로 사용구분=9로 처리
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

async function fixMissingSupplierCodeAuto() {
  let pool;

  try {
    console.log('✅ 데이터베이스 연결 중...\n');
    pool = await sql.connect(config);

    console.log('========================================');
    console.log('🔍 매입처코드 누락 레코드 조회');
    console.log('========================================\n');

    // 1. 즉시 수정 필요한 건만 조회 (수량>0, 단가>0)
    const urgentQuery = `
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
        AND 입고수량 > 0
        AND 입고단가 > 0
      ORDER BY 거래일자 DESC, 거래번호 DESC
    `;

    const urgentRecords = await pool.request().query(urgentQuery);
    const totalCount = urgentRecords.recordset.length;

    console.log(`📋 즉시 수정 필요한 건수: ${totalCount}건\n`);

    if (totalCount === 0) {
      console.log('✅ 수정할 데이터가 없습니다.\n');
      return;
    }

    // 2. 상세 내역 출력
    console.log('🚨 수정 대상 레코드:\n');
    urgentRecords.recordset.forEach((record, index) => {
      console.log(`[${index + 1}] 거래일자: ${record.거래일자}, 거래번호: ${record.거래번호}`);
      console.log(`    자재: ${record.분류코드}${record.세부코드}`);
      console.log(`    입고수량: ${record.입고수량.toLocaleString()}개`);
      console.log(`    입고단가: ${record.입고단가.toLocaleString()}원`);
      console.log(`    공급가액: ${record.공급가액.toLocaleString()}원\n`);
    });

    // 3. 데이터 수정
    console.log('========================================');
    console.log('🔧 데이터 수정 중...');
    console.log('========================================\n');

    let successCount = 0;
    let failCount = 0;

    for (const record of urgentRecords.recordset) {
      try {
        const result = await pool.request()
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
        console.log(`✅ [${successCount}/${totalCount}] ${record.거래일자}-${record.거래번호} (${record.분류코드}${record.세부코드}) - ${result.rowsAffected[0]}건 수정`);
      } catch (err) {
        failCount++;
        console.error(`❌ 오류: ${record.거래일자}-${record.거래번호} - ${err.message}`);
      }
    }

    // 4. 결과 요약
    console.log('\n========================================');
    console.log('📊 수정 완료');
    console.log('========================================\n');
    console.log(`✅ 성공: ${successCount}건`);
    console.log(`❌ 실패: ${failCount}건\n`);

    // 5. 검증 - 즉시 수정 필요한 건
    console.log('========================================');
    console.log('🔍 수정 후 검증 (즉시 수정 필요한 건)');
    console.log('========================================\n');

    const verifyUrgentQuery = `
      SELECT COUNT(*) as 건수
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (매입처코드 IS NULL OR 매입처코드 = '' OR LTRIM(RTRIM(매입처코드)) = '')
        AND 사용구분 = 0
        AND 입고수량 > 0
        AND 입고단가 > 0
    `;

    const verifyUrgent = await pool.request().query(verifyUrgentQuery);
    const remainingUrgent = verifyUrgent.recordset[0].건수;

    console.log(`📋 남은 즉시 수정 필요 건수: ${remainingUrgent}건\n`);

    if (remainingUrgent === 0) {
      console.log('✅ 모든 즉시 수정 필요 건이 처리되었습니다!\n');
    } else {
      console.log('⚠️  아직 처리되지 않은 건이 있습니다.\n');
    }

    // 6. 전체 매입처코드 누락 건 확인
    const verifyAllQuery = `
      SELECT COUNT(*) as 건수
      FROM 자재입출내역
      WHERE 입출고구분 = 1
        AND (매입처코드 IS NULL OR 매입처코드 = '' OR LTRIM(RTRIM(매입처코드)) = '')
        AND 사용구분 = 0
    `;

    const verifyAll = await pool.request().query(verifyAllQuery);
    const remainingAll = verifyAll.recordset[0].건수;

    console.log('========================================');
    console.log('📋 전체 매입처코드 누락 현황');
    console.log('========================================\n');
    console.log(`총 남은 건수: ${remainingAll}건`);
    console.log(`  - 즉시 수정 필요 (수량>0, 단가>0): ${remainingUrgent}건`);
    console.log(`  - 단가=0 (나중에 수정 예정): ${remainingAll - remainingUrgent}건\n`);

    if (remainingAll - remainingUrgent > 0) {
      console.log('💡 단가=0인 건들은 테스트 데이터로 추정됩니다.');
      console.log('   필요시 수동으로 확인 후 처리하세요.\n');
    }

  } catch (err) {
    console.error('❌ 오류 발생:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

fixMissingSupplierCodeAuto();
