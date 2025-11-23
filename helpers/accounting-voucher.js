const sql = require('mssql');

/**
 * 자동전표 생성 헬퍼 모듈
 *
 * 거래명세서, 매입전표 작성 시 자동으로 회계전표를 생성합니다.
 */

/**
 * 전표번호 생성 함수
 * @param {object} transaction - SQL 트랜잭션 객체
 * @param {string} 사업장코드 - 사업장 코드
 * @param {string} 전표일자 - 전표일자 (YYYYMMDD)
 * @returns {Promise<string>} 생성된 전표번호 (예: "20251109-1")
 */
async function generate전표번호(transaction, 사업장코드, 전표일자) {
  const 베이스코드 = 사업장코드 + 전표일자;

  // 로그 테이블에서 최종번호 조회
  const logResult = await new sql.Request(transaction)
    .input('테이블명', sql.VarChar(50), '회계전표')
    .input('베이스코드', sql.VarChar(50), 베이스코드)
    .query(`
      SELECT 최종로그 FROM 로그
      WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
    `);

  let 전표번호 = 1;
  if (logResult.recordset.length > 0) {
    전표번호 = logResult.recordset[0].최종로그 + 1;
  }

  // 로그 테이블 업데이트
  const 수정일자 = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (logResult.recordset.length > 0) {
    await new sql.Request(transaction)
      .input('테이블명', sql.VarChar(50), '회계전표')
      .input('베이스코드', sql.VarChar(50), 베이스코드)
      .input('최종로그', sql.Real, 전표번호)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .query(`
        UPDATE 로그
        SET 최종로그 = @최종로그, 수정일자 = @수정일자
        WHERE 테이블명 = @테이블명 AND 베이스코드 = @베이스코드
      `);
  } else {
    await new sql.Request(transaction)
      .input('테이블명', sql.VarChar(50), '회계전표')
      .input('베이스코드', sql.VarChar(50), 베이스코드)
      .input('최종로그', sql.Real, 전표번호)
      .input('수정일자', sql.VarChar(8), 수정일자)
      .query(`
        INSERT INTO 로그 (테이블명, 베이스코드, 최종로그, 수정일자)
        VALUES (@테이블명, @베이스코드, @최종로그, @수정일자)
      `);
  }

  return `${전표일자}-${전표번호}`;
}

/**
 * 매입전표 자동 회계전표 생성
 *
 * 매입전표 작성 시 자동으로 복식부기 전표 생성:
 * - 차변: 매입 (상품/원재료 등)
 * - 대변: 미지급금 (매입처에 대한 채무)
 *
 * @param {object} transaction - SQL 트랜잭션 객체
 * @param {object} params - 매입전표 정보
 * @param {string} params.사업장코드 - 사업장 코드
 * @param {string} params.거래일자 - 거래일자 (YYYYMMDD)
 * @param {number} params.거래번호 - 거래번호
 * @param {string} params.매입처코드 - 매입처 코드
 * @param {string} params.매입처명 - 매입처명
 * @param {number} params.총매입금액 - 총 매입금액 (공급가액 + 부가세)
 * @param {string} params.작성자코드 - 작성자 코드
 * @param {string} params.적요 - 적요 (옵션)
 * @returns {Promise<string>} 생성된 전표번호
 */
async function create매입전표회계전표(transaction, params) {
  const {
    사업장코드,
    거래일자,
    거래번호,
    매입처코드,
    매입처명,
    총매입금액,
    작성자코드,
    적요 = '',
  } = params;

  // 전표번호 생성
  const 전표번호 = await generate전표번호(transaction, 사업장코드, 거래일자);
  const 전표시간 = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const 참조전표 = `매입-${거래일자}-${거래번호}`;

  // 1. 차변: 매입 (501 계정 - 상품매입)
  await new sql.Request(transaction)
    .input('전표번호', sql.VarChar(20), 전표번호)
    .input('전표순번', sql.Int, 1)
    .input('사업장코드', sql.VarChar(2), 사업장코드)
    .input('전표일자', sql.VarChar(8), 거래일자)
    .input('전표시간', sql.VarChar(6), 전표시간)
    .input('계정코드', sql.VarChar(4), '501') // 상품매입
    .input('차대구분', sql.Char(1), 'D') // 차변
    .input('금액', sql.Money, 총매입금액)
    .input('적요', sql.VarChar(200), 적요 || `${매입처명} 매입`)
    .input('참조전표', sql.VarChar(20), 참조전표)
    .input('작성자코드', sql.VarChar(4), 작성자코드)
    .query(`
      INSERT INTO 회계전표 (
        전표번호, 전표순번, 사업장코드, 전표일자, 전표시간,
        계정코드, 차대구분, 금액, 적요, 참조전표, 작성자코드, 사용구분
      ) VALUES (
        @전표번호, @전표순번, @사업장코드, @전표일자, @전표시간,
        @계정코드, @차대구분, @금액, @적요, @참조전표, @작성자코드, 0
      )
    `);

  // 2. 대변: 미지급금 (252 계정)
  await new sql.Request(transaction)
    .input('전표번호', sql.VarChar(20), 전표번호)
    .input('전표순번', sql.Int, 2)
    .input('사업장코드', sql.VarChar(2), 사업장코드)
    .input('전표일자', sql.VarChar(8), 거래일자)
    .input('전표시간', sql.VarChar(6), 전표시간)
    .input('계정코드', sql.VarChar(4), '252') // 미지급금
    .input('차대구분', sql.Char(1), 'C') // 대변
    .input('금액', sql.Money, 총매입금액)
    .input('적요', sql.VarChar(200), 적요 || `${매입처명} 미지급`)
    .input('참조전표', sql.VarChar(20), 참조전표)
    .input('작성자코드', sql.VarChar(4), 작성자코드)
    .query(`
      INSERT INTO 회계전표 (
        전표번호, 전표순번, 사업장코드, 전표일자, 전표시간,
        계정코드, 차대구분, 금액, 적요, 참조전표, 작성자코드, 사용구분
      ) VALUES (
        @전표번호, @전표순번, @사업장코드, @전표일자, @전표시간,
        @계정코드, @차대구분, @금액, @적요, @참조전표, @작성자코드, 0
      )
    `);

  console.log(`✅ 매입전표 회계전표 생성: ${전표번호} (참조: ${참조전표}, 금액: ${총매입금액}원)`);
  return 전표번호;
}

/**
 * 거래명세서 자동 회계전표 생성
 *
 * 거래명세서 작성 시 자동으로 복식부기 전표 생성:
 * - 차변: 미수금 (매출처에 대한 채권)
 * - 대변: 매출 (상품매출)
 *
 * @param {object} transaction - SQL 트랜잭션 객체
 * @param {object} params - 거래명세서 정보
 * @param {string} params.사업장코드 - 사업장 코드
 * @param {string} params.거래일자 - 거래일자 (YYYYMMDD)
 * @param {number} params.거래번호 - 거래번호
 * @param {string} params.매출처코드 - 매출처 코드
 * @param {string} params.매출처명 - 매출처명
 * @param {number} params.총매출금액 - 총 매출금액 (공급가액 + 부가세)
 * @param {string} params.작성자코드 - 작성자 코드
 * @param {string} params.적요 - 적요 (옵션)
 * @returns {Promise<string>} 생성된 전표번호
 */
async function create거래명세서회계전표(transaction, params) {
  const {
    사업장코드,
    거래일자,
    거래번호,
    매출처코드,
    매출처명,
    총매출금액,
    작성자코드,
    적요 = '',
  } = params;

  // 전표번호 생성
  const 전표번호 = await generate전표번호(transaction, 사업장코드, 거래일자);
  const 전표시간 = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const 참조전표 = `출고-${거래일자}-${거래번호}`;

  // 1. 차변: 미수금 (132 계정)
  await new sql.Request(transaction)
    .input('전표번호', sql.VarChar(20), 전표번호)
    .input('전표순번', sql.Int, 1)
    .input('사업장코드', sql.VarChar(2), 사업장코드)
    .input('전표일자', sql.VarChar(8), 거래일자)
    .input('전표시간', sql.VarChar(6), 전표시간)
    .input('계정코드', sql.VarChar(4), '132') // 미수금
    .input('차대구분', sql.Char(1), 'D') // 차변
    .input('금액', sql.Money, 총매출금액)
    .input('적요', sql.VarChar(200), 적요 || `${매출처명} 미수`)
    .input('참조전표', sql.VarChar(20), 참조전표)
    .input('작성자코드', sql.VarChar(4), 작성자코드)
    .query(`
      INSERT INTO 회계전표 (
        전표번호, 전표순번, 사업장코드, 전표일자, 전표시간,
        계정코드, 차대구분, 금액, 적요, 참조전표, 작성자코드, 사용구분
      ) VALUES (
        @전표번호, @전표순번, @사업장코드, @전표일자, @전표시간,
        @계정코드, @차대구분, @금액, @적요, @참조전표, @작성자코드, 0
      )
    `);

  // 2. 대변: 매출 (401 계정 - 상품매출)
  await new sql.Request(transaction)
    .input('전표번호', sql.VarChar(20), 전표번호)
    .input('전표순번', sql.Int, 2)
    .input('사업장코드', sql.VarChar(2), 사업장코드)
    .input('전표일자', sql.VarChar(8), 거래일자)
    .input('전표시간', sql.VarChar(6), 전표시간)
    .input('계정코드', sql.VarChar(4), '401') // 상품매출
    .input('차대구분', sql.Char(1), 'C') // 대변
    .input('금액', sql.Money, 총매출금액)
    .input('적요', sql.VarChar(200), 적요 || `${매출처명} 매출`)
    .input('참조전표', sql.VarChar(20), 참조전표)
    .input('작성자코드', sql.VarChar(4), 작성자코드)
    .query(`
      INSERT INTO 회계전표 (
        전표번호, 전표순번, 사업장코드, 전표일자, 전표시간,
        계정코드, 차대구분, 금액, 적요, 참조전표, 작성자코드, 사용구분
      ) VALUES (
        @전표번호, @전표순번, @사업장코드, @전표일자, @전표시간,
        @계정코드, @차대구분, @금액, @적요, @참조전표, @작성자코드, 0
      )
    `);

  console.log(`✅ 거래명세서 회계전표 생성: ${전표번호} (참조: ${참조전표}, 금액: ${총매출금액}원)`);
  return 전표번호;
}

/**
 * 회계전표 삭제 (사용구분 업데이트)
 *
 * 원천 거래 삭제 시 연관된 회계전표도 삭제 처리
 *
 * @param {object} transaction - SQL 트랜잭션 객체
 * @param {string} 참조전표 - 참조전표 번호 (예: "매입-20251109-1")
 * @param {string} 수정자코드 - 수정자 코드
 * @returns {Promise<number>} 삭제된 전표 수
 */
async function delete회계전표(transaction, 참조전표, 수정자코드) {
  const result = await new sql.Request(transaction)
    .input('참조전표', sql.VarChar(20), 참조전표)
    .input('수정자코드', sql.VarChar(4), 수정자코드)
    .query(`
      UPDATE 회계전표
      SET 사용구분 = 1, 수정자코드 = @수정자코드, 수정일시 = GETDATE()
      WHERE 참조전표 = @참조전표 AND 사용구분 = 0
    `);

  console.log(`✅ 회계전표 삭제: ${참조전표} (${result.rowsAffected[0]}건)`);
  return result.rowsAffected[0];
}

module.exports = {
  generate전표번호,
  create매입전표회계전표,
  create거래명세서회계전표,
  delete회계전표,
};
