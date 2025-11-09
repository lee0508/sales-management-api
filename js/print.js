/**
 * 프린트 기능 모듈
 * 견적서, 발주서, 거래명세서, 매입전표 출력 기능 제공
 */

// ===========================
// 유틸리티 함수
// ===========================

/**
 * 날짜 포맷 변환 (YYYYMMDD → YYYY-MM-DD)
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return '';
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

/**
 * 숫자를 금액 형식으로 포맷 (천단위 쉼표)
 */
function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0';
  return Number(amount).toLocaleString('ko-KR');
}

/**
 * 사업자번호 포맷 (123-45-67890)
 */
function formatBusinessNumber(num) {
  if (!num) return '';
  const cleaned = num.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 5)}-${cleaned.substring(5, 10)}`;
  }
  return num;
}

/**
 * 전화번호 포맷
 */
function formatPhoneNumber(num) {
  if (!num) return '';
  const cleaned = num.replace(/[^0-9]/g, '');

  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 7)}-${cleaned.substring(7, 11)}`;
  } else if (cleaned.length === 10) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  } else if (cleaned.length === 9 && cleaned.startsWith('02')) {
    return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 5)}-${cleaned.substring(5, 9)}`;
  }

  return num;
}

// ===========================
// 견적서 프린트
// ===========================

/**
 * 견적서 프린트 함수
 * @param {string} 견적일자 - YYYYMMDD 형식
 * @param {number} 견적번호 - 견적 번호
 */
async function printQuotation(견적일자, 견적번호) {
  try {
    // API에서 견적서 데이터 가져오기
    const response = await fetch(`/api/quotations/${견적일자}/${견적번호}`);

    if (!response.ok) {
      throw new Error('견적서 데이터를 가져오는데 실패했습니다.');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || '견적서 데이터를 가져오는데 실패했습니다.');
    }

    // 프린트 HTML 생성
    const printHTML = generateQuotationPrintHTML(data.data);

    // 프린트 미리보기 모달 표시
    showPrintPreview(printHTML, '견적서');

  } catch (error) {
    console.error('견적서 프린트 오류:', error);
    alert('견적서 출력 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 견적서 프린트 HTML 생성
 */
function generateQuotationPrintHTML(data) {
  const master = data.master;
  const details = data.details || [];

  // 합계 계산
  let 공급가액합계 = 0;
  let 부가세합계 = 0;

  details.forEach(item => {
    const 공급가액 = item.견적수량 * item.견적단가;
    const 부가세 = Math.round(공급가액 * 0.1);
    공급가액합계 += 공급가액;
    부가세합계 += 부가세;
  });

  const 합계금액 = 공급가액합계 + 부가세합계;

  // 상세 품목 테이블 생성
  let detailsHTML = '';
  details.forEach((item, index) => {
    const 공급가액 = item.견적수량 * item.견적단가;
    const 부가세 = Math.round(공급가액 * 0.1);
    const 합계 = 공급가액 + 부가세;

    detailsHTML += `
      <tr>
        <td>${index + 1}</td>
        <td class="align-left">${item.자재명 || ''}</td>
        <td class="align-left">${item.규격 || ''}</td>
        <td>${item.단위 || ''}</td>
        <td class="print-amount">${formatCurrency(item.견적수량)}</td>
        <td class="print-amount">${formatCurrency(item.견적단가)}</td>
        <td class="print-amount">${formatCurrency(공급가액)}</td>
        <td class="print-amount">${formatCurrency(부가세)}</td>
        <td class="print-amount">${formatCurrency(합계)}</td>
        <td class="align-left">${item.비고 || ''}</td>
      </tr>
    `;
  });

  // 빈 행 추가 (최소 10행)
  const remainingRows = Math.max(0, 10 - details.length);
  for (let i = 0; i < remainingRows; i++) {
    detailsHTML += `
      <tr>
        <td>&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td>&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
      </tr>
    `;
  }

  return `
    <div class="print-document active">
      <!-- 문서 헤더 -->
      <div class="print-header">
        <div class="print-title">견 적 서</div>
        <div class="print-subtitle">QUOTATION</div>
      </div>

      <!-- 문서 정보 -->
      <div class="print-info-section">
        <div class="print-info-box">
          <div class="print-info-title">수신처 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">상호 (회사명)</span>
            <span class="print-info-value">${master.매출처명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">대표자</span>
            <span class="print-info-value">${master.대표자 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">사업자등록번호</span>
            <span class="print-info-value">${formatBusinessNumber(master.사업자번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">연락처</span>
            <span class="print-info-value">${formatPhoneNumber(master.전화번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">주소</span>
            <span class="print-info-value">${master.주소1 || ''} ${master.주소2 || ''}</span>
          </div>
        </div>

        <div class="print-info-box">
          <div class="print-info-title">견적 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">견적일자</span>
            <span class="print-info-value">${formatDate(master.견적일자)}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">견적번호</span>
            <span class="print-info-value">${master.견적일자}-${master.견적번호}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">납기일자</span>
            <span class="print-info-value">${master.납기일자 ? formatDate(master.납기일자) : ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">작성자</span>
            <span class="print-info-value">${master.사용자명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">상태</span>
            <span class="print-info-value">${master.상태코드 === '1' ? '임시저장' : master.상태코드 === '2' ? '발송완료' : master.상태코드 === '3' ? '승인' : master.상태코드 === '4' ? '거절' : '미확인'}</span>
          </div>
        </div>
      </div>

      <!-- 품목 테이블 -->
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 40px;">No</th>
            <th style="width: 180px;">품목명</th>
            <th style="width: 140px;">규격</th>
            <th style="width: 50px;">단위</th>
            <th style="width: 70px;">수량</th>
            <th style="width: 90px;">단가</th>
            <th style="width: 100px;">공급가액</th>
            <th style="width: 80px;">부가세</th>
            <th style="width: 100px;">합계</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          ${detailsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align: right; font-weight: bold;">합계</td>
            <td class="print-amount">${formatCurrency(공급가액합계)}</td>
            <td class="print-amount">${formatCurrency(부가세합계)}</td>
            <td class="print-amount">${formatCurrency(합계금액)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- 합계 금액 -->
      <div class="print-summary">
        <div class="print-summary-box">
          <div class="print-summary-row">
            <span class="print-summary-label">공급가액</span>
            <span class="print-summary-value">${formatCurrency(공급가액합계)} 원</span>
          </div>
          <div class="print-summary-row">
            <span class="print-summary-label">부가세 (10%)</span>
            <span class="print-summary-value">${formatCurrency(부가세합계)} 원</span>
          </div>
          <div class="print-summary-row total">
            <span class="print-summary-label">총 견적금액</span>
            <span class="print-summary-value">${formatCurrency(합계금액)} 원</span>
          </div>
        </div>
      </div>

      <!-- 비고 -->
      ${master.비고 ? `
      <div class="print-notes">
        <div class="print-notes-title">비고</div>
        <div>${master.비고}</div>
      </div>
      ` : ''}

      <!-- 서명 -->
      <div class="print-signature">
        <div class="print-signature-box">
          <div class="print-signature-label">공급자</div>
          <div class="print-signature-line">(인)</div>
        </div>
        <div class="print-signature-box">
          <div class="print-signature-label">수신처 확인</div>
          <div class="print-signature-line">(인)</div>
        </div>
      </div>

      <!-- 푸터 -->
      <div class="print-footer">
        <div>본 견적서는 ${formatDate(master.견적일자)} 기준으로 작성되었습니다.</div>
        <div>문의사항은 담당자에게 연락 주시기 바랍니다.</div>
      </div>
    </div>
  `;
}

// ===========================
// 발주서 프린트
// ===========================

/**
 * 발주서 프린트 함수
 */
async function printOrder(발주일자, 발주번호) {
  try {
    const response = await fetch(`/api/orders/${발주일자}/${발주번호}`);

    if (!response.ok) {
      throw new Error('발주서 데이터를 가져오는데 실패했습니다.');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || '발주서 데이터를 가져오는데 실패했습니다.');
    }

    const printHTML = generateOrderPrintHTML(data.data);
    showPrintPreview(printHTML, '발주서');

  } catch (error) {
    console.error('발주서 프린트 오류:', error);
    alert('발주서 출력 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 발주서 프린트 HTML 생성
 */
function generateOrderPrintHTML(data) {
  const master = data.master;
  const details = data.details || [];

  // 합계 계산
  let 공급가액합계 = 0;
  let 부가세합계 = 0;

  details.forEach(item => {
    const 공급가액 = item.발주수량 * item.발주단가;
    const 부가세 = Math.round(공급가액 * 0.1);
    공급가액합계 += 공급가액;
    부가세합계 += 부가세;
  });

  const 합계금액 = 공급가액합계 + 부가세합계;

  // 상세 품목 테이블 생성
  let detailsHTML = '';
  details.forEach((item, index) => {
    const 공급가액 = item.발주수량 * item.발주단가;
    const 부가세 = Math.round(공급가액 * 0.1);
    const 합계 = 공급가액 + 부가세;

    detailsHTML += `
      <tr>
        <td>${index + 1}</td>
        <td class="align-left">${item.자재명 || ''}</td>
        <td class="align-left">${item.규격 || ''}</td>
        <td>${item.단위 || ''}</td>
        <td class="print-amount">${formatCurrency(item.발주수량)}</td>
        <td class="print-amount">${formatCurrency(item.발주단가)}</td>
        <td class="print-amount">${formatCurrency(공급가액)}</td>
        <td class="print-amount">${formatCurrency(부가세)}</td>
        <td class="print-amount">${formatCurrency(합계)}</td>
        <td class="align-left">${item.비고 || ''}</td>
      </tr>
    `;
  });

  // 빈 행 추가
  const remainingRows = Math.max(0, 10 - details.length);
  for (let i = 0; i < remainingRows; i++) {
    detailsHTML += `
      <tr>
        <td>&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td>&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
      </tr>
    `;
  }

  return `
    <div class="print-document active">
      <div class="print-header">
        <div class="print-title">발 주 서</div>
        <div class="print-subtitle">PURCHASE ORDER</div>
      </div>

      <div class="print-info-section">
        <div class="print-info-box">
          <div class="print-info-title">공급업체 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">상호 (회사명)</span>
            <span class="print-info-value">${master.매입처명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">대표자</span>
            <span class="print-info-value">${master.대표자 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">사업자등록번호</span>
            <span class="print-info-value">${formatBusinessNumber(master.사업자번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">연락처</span>
            <span class="print-info-value">${formatPhoneNumber(master.전화번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">주소</span>
            <span class="print-info-value">${master.주소1 || ''} ${master.주소2 || ''}</span>
          </div>
        </div>

        <div class="print-info-box">
          <div class="print-info-title">발주 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">발주일자</span>
            <span class="print-info-value">${formatDate(master.발주일자)}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">발주번호</span>
            <span class="print-info-value">${master.발주일자}-${master.발주번호}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">납기일자</span>
            <span class="print-info-value">${master.납기일자 ? formatDate(master.납기일자) : ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">작성자</span>
            <span class="print-info-value">${master.사용자명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">상태</span>
            <span class="print-info-value">${master.상태코드 === '1' ? '임시저장' : master.상태코드 === '2' ? '발주완료' : master.상태코드 === '3' ? '입고완료' : master.상태코드 === '4' ? '취소' : '미확인'}</span>
          </div>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 40px;">No</th>
            <th style="width: 180px;">품목명</th>
            <th style="width: 140px;">규격</th>
            <th style="width: 50px;">단위</th>
            <th style="width: 70px;">수량</th>
            <th style="width: 90px;">단가</th>
            <th style="width: 100px;">공급가액</th>
            <th style="width: 80px;">부가세</th>
            <th style="width: 100px;">합계</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          ${detailsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align: right; font-weight: bold;">합계</td>
            <td class="print-amount">${formatCurrency(공급가액합계)}</td>
            <td class="print-amount">${formatCurrency(부가세합계)}</td>
            <td class="print-amount">${formatCurrency(합계금액)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div class="print-summary">
        <div class="print-summary-box">
          <div class="print-summary-row">
            <span class="print-summary-label">공급가액</span>
            <span class="print-summary-value">${formatCurrency(공급가액합계)} 원</span>
          </div>
          <div class="print-summary-row">
            <span class="print-summary-label">부가세 (10%)</span>
            <span class="print-summary-value">${formatCurrency(부가세합계)} 원</span>
          </div>
          <div class="print-summary-row total">
            <span class="print-summary-label">총 발주금액</span>
            <span class="print-summary-value">${formatCurrency(합계금액)} 원</span>
          </div>
        </div>
      </div>

      ${master.비고 ? `
      <div class="print-notes">
        <div class="print-notes-title">비고</div>
        <div>${master.비고}</div>
      </div>
      ` : ''}

      <div class="print-signature">
        <div class="print-signature-box">
          <div class="print-signature-label">발주처</div>
          <div class="print-signature-line">(인)</div>
        </div>
        <div class="print-signature-box">
          <div class="print-signature-label">공급업체 확인</div>
          <div class="print-signature-line">(인)</div>
        </div>
      </div>

      <div class="print-footer">
        <div>본 발주서는 ${formatDate(master.발주일자)} 기준으로 작성되었습니다.</div>
        <div>납기일을 엄수하여 주시기 바랍니다.</div>
      </div>
    </div>
  `;
}

// ===========================
// 거래명세서 프린트
// ===========================

/**
 * 거래명세서 프린트 함수
 */
async function printTransaction(거래일자, 거래번호) {
  try {
    const response = await fetch(`/api/transactions/${거래일자}/${거래번호}`);

    if (!response.ok) {
      throw new Error('거래명세서 데이터를 가져오는데 실패했습니다.');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || '거래명세서 데이터를 가져오는데 실패했습니다.');
    }

    const printHTML = generateTransactionPrintHTML(data.data);
    showPrintPreview(printHTML, '거래명세서');

  } catch (error) {
    console.error('거래명세서 프린트 오류:', error);
    alert('거래명세서 출력 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 거래명세서 프린트 HTML 생성
 */
function generateTransactionPrintHTML(items) {
  if (!items || items.length === 0) {
    return '<div class="print-document active"><p>데이터가 없습니다.</p></div>';
  }

  const firstItem = items[0];

  // 합계 계산
  let 공급가액합계 = 0;
  let 부가세합계 = 0;

  items.forEach(item => {
    const 공급가액 = item.출고수량 * item.출고단가;
    const 부가세 = item.출고부가 || Math.round(공급가액 * 0.1);
    공급가액합계 += 공급가액;
    부가세합계 += 부가세;
  });

  const 합계금액 = 공급가액합계 + 부가세합계;

  // 상세 품목 테이블 생성
  let detailsHTML = '';
  items.forEach((item, index) => {
    const 공급가액 = item.출고수량 * item.출고단가;
    const 부가세 = item.출고부가 || Math.round(공급가액 * 0.1);
    const 합계 = 공급가액 + 부가세;

    detailsHTML += `
      <tr>
        <td>${index + 1}</td>
        <td class="align-left">${item.자재명 || ''}</td>
        <td class="align-left">${item.규격 || ''}</td>
        <td>${item.단위 || ''}</td>
        <td class="print-amount">${formatCurrency(item.출고수량)}</td>
        <td class="print-amount">${formatCurrency(item.출고단가)}</td>
        <td class="print-amount">${formatCurrency(공급가액)}</td>
        <td class="print-amount">${formatCurrency(부가세)}</td>
        <td class="print-amount">${formatCurrency(합계)}</td>
        <td class="align-left">${item.비고 || ''}</td>
      </tr>
    `;
  });

  // 빈 행 추가
  const remainingRows = Math.max(0, 10 - items.length);
  for (let i = 0; i < remainingRows; i++) {
    detailsHTML += `
      <tr>
        <td>&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td>&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
      </tr>
    `;
  }

  return `
    <div class="print-document active">
      <div class="print-header">
        <div class="print-title">거 래 명 세 서</div>
        <div class="print-subtitle">TRANSACTION STATEMENT</div>
      </div>

      <div class="print-info-section">
        <div class="print-info-box">
          <div class="print-info-title">거래처 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">상호 (회사명)</span>
            <span class="print-info-value">${firstItem.매출처명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">대표자</span>
            <span class="print-info-value">${firstItem.대표자 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">사업자등록번호</span>
            <span class="print-info-value">${formatBusinessNumber(firstItem.사업자번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">연락처</span>
            <span class="print-info-value">${formatPhoneNumber(firstItem.전화번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">주소</span>
            <span class="print-info-value">${firstItem.주소1 || ''} ${firstItem.주소2 || ''}</span>
          </div>
        </div>

        <div class="print-info-box">
          <div class="print-info-title">거래 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">거래일자</span>
            <span class="print-info-value">${formatDate(firstItem.거래일자)}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">거래번호</span>
            <span class="print-info-value">${firstItem.거래일자}-${firstItem.거래번호}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">작성자</span>
            <span class="print-info-value">${firstItem.사용자명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">거래유형</span>
            <span class="print-info-value">출고 (매출)</span>
          </div>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 40px;">No</th>
            <th style="width: 180px;">품목명</th>
            <th style="width: 140px;">규격</th>
            <th style="width: 50px;">단위</th>
            <th style="width: 70px;">출고수량</th>
            <th style="width: 90px;">출고단가</th>
            <th style="width: 100px;">공급가액</th>
            <th style="width: 80px;">부가세</th>
            <th style="width: 100px;">합계</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          ${detailsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align: right; font-weight: bold;">합계</td>
            <td class="print-amount">${formatCurrency(공급가액합계)}</td>
            <td class="print-amount">${formatCurrency(부가세합계)}</td>
            <td class="print-amount">${formatCurrency(합계금액)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div class="print-summary">
        <div class="print-summary-box">
          <div class="print-summary-row">
            <span class="print-summary-label">공급가액</span>
            <span class="print-summary-value">${formatCurrency(공급가액합계)} 원</span>
          </div>
          <div class="print-summary-row">
            <span class="print-summary-label">부가세 (10%)</span>
            <span class="print-summary-value">${formatCurrency(부가세합계)} 원</span>
          </div>
          <div class="print-summary-row total">
            <span class="print-summary-label">총 거래금액</span>
            <span class="print-summary-value">${formatCurrency(합계금액)} 원</span>
          </div>
        </div>
      </div>

      <div class="print-signature">
        <div class="print-signature-box">
          <div class="print-signature-label">공급자</div>
          <div class="print-signature-line">(인)</div>
        </div>
        <div class="print-signature-box">
          <div class="print-signature-label">거래처 확인</div>
          <div class="print-signature-line">(인)</div>
        </div>
      </div>

      <div class="print-footer">
        <div>본 거래명세서는 ${formatDate(firstItem.거래일자)} 기준으로 작성되었습니다.</div>
        <div>문의사항은 담당자에게 연락 주시기 바랍니다.</div>
      </div>
    </div>
  `;
}

// ===========================
// 매입전표 프린트
// ===========================

/**
 * 매입전표 프린트 함수
 */
async function printPurchaseStatement(거래일자, 거래번호) {
  try {
    const response = await fetch(`/api/purchase-statements/${거래일자}/${거래번호}`);

    if (!response.ok) {
      throw new Error('매입전표 데이터를 가져오는데 실패했습니다.');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || '매입전표 데이터를 가져오는데 실패했습니다.');
    }

    const printHTML = generatePurchaseStatementPrintHTML(data.data);
    showPrintPreview(printHTML, '매입전표');

  } catch (error) {
    console.error('매입전표 프린트 오류:', error);
    alert('매입전표 출력 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 매입전표 프린트 HTML 생성
 */
function generatePurchaseStatementPrintHTML(items) {
  if (!items || items.length === 0) {
    return '<div class="print-document active"><p>데이터가 없습니다.</p></div>';
  }

  const firstItem = items[0];

  // 합계 계산
  let 공급가액합계 = 0;
  let 부가세합계 = 0;

  items.forEach(item => {
    const 공급가액 = item.입고수량 * item.입고단가;
    const 부가세 = item.입고부가 || Math.round(공급가액 * 0.1);
    공급가액합계 += 공급가액;
    부가세합계 += 부가세;
  });

  const 합계금액 = 공급가액합계 + 부가세합계;

  // 상세 품목 테이블 생성
  let detailsHTML = '';
  items.forEach((item, index) => {
    const 공급가액 = item.입고수량 * item.입고단가;
    const 부가세 = item.입고부가 || Math.round(공급가액 * 0.1);
    const 합계 = 공급가액 + 부가세;

    detailsHTML += `
      <tr>
        <td>${index + 1}</td>
        <td class="align-left">${item.자재명 || ''}</td>
        <td class="align-left">${item.규격 || ''}</td>
        <td>${item.단위 || ''}</td>
        <td class="print-amount">${formatCurrency(item.입고수량)}</td>
        <td class="print-amount">${formatCurrency(item.입고단가)}</td>
        <td class="print-amount">${formatCurrency(공급가액)}</td>
        <td class="print-amount">${formatCurrency(부가세)}</td>
        <td class="print-amount">${formatCurrency(합계)}</td>
        <td class="align-left">${item.비고 || ''}</td>
      </tr>
    `;
  });

  // 빈 행 추가
  const remainingRows = Math.max(0, 10 - items.length);
  for (let i = 0; i < remainingRows; i++) {
    detailsHTML += `
      <tr>
        <td>&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
        <td>&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="print-amount">&nbsp;</td>
        <td class="align-left">&nbsp;</td>
      </tr>
    `;
  }

  return `
    <div class="print-document active">
      <div class="print-header">
        <div class="print-title">매 입 전 표</div>
        <div class="print-subtitle">PURCHASE STATEMENT</div>
      </div>

      <div class="print-info-section">
        <div class="print-info-box">
          <div class="print-info-title">공급업체 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">상호 (회사명)</span>
            <span class="print-info-value">${firstItem.매입처명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">대표자</span>
            <span class="print-info-value">${firstItem.대표자 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">사업자등록번호</span>
            <span class="print-info-value">${formatBusinessNumber(firstItem.사업자번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">연락처</span>
            <span class="print-info-value">${formatPhoneNumber(firstItem.전화번호 || '')}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">주소</span>
            <span class="print-info-value">${firstItem.주소1 || ''} ${firstItem.주소2 || ''}</span>
          </div>
        </div>

        <div class="print-info-box">
          <div class="print-info-title">매입 정보</div>
          <div class="print-info-row">
            <span class="print-info-label">매입일자</span>
            <span class="print-info-value">${formatDate(firstItem.거래일자)}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">전표번호</span>
            <span class="print-info-value">${firstItem.거래일자}-${firstItem.거래번호}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">작성자</span>
            <span class="print-info-value">${firstItem.사용자명 || ''}</span>
          </div>
          <div class="print-info-row">
            <span class="print-info-label">거래유형</span>
            <span class="print-info-value">입고 (매입)</span>
          </div>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 40px;">No</th>
            <th style="width: 180px;">품목명</th>
            <th style="width: 140px;">규격</th>
            <th style="width: 50px;">단위</th>
            <th style="width: 70px;">입고수량</th>
            <th style="width: 90px;">입고단가</th>
            <th style="width: 100px;">공급가액</th>
            <th style="width: 80px;">부가세</th>
            <th style="width: 100px;">합계</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          ${detailsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align: right; font-weight: bold;">합계</td>
            <td class="print-amount">${formatCurrency(공급가액합계)}</td>
            <td class="print-amount">${formatCurrency(부가세합계)}</td>
            <td class="print-amount">${formatCurrency(합계금액)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div class="print-summary">
        <div class="print-summary-box">
          <div class="print-summary-row">
            <span class="print-summary-label">공급가액</span>
            <span class="print-summary-value">${formatCurrency(공급가액합계)} 원</span>
          </div>
          <div class="print-summary-row">
            <span class="print-summary-label">부가세 (10%)</span>
            <span class="print-summary-value">${formatCurrency(부가세합계)} 원</span>
          </div>
          <div class="print-summary-row total">
            <span class="print-summary-label">총 매입금액</span>
            <span class="print-summary-value">${formatCurrency(합계금액)} 원</span>
          </div>
        </div>
      </div>

      <div class="print-signature">
        <div class="print-signature-box">
          <div class="print-signature-label">매입처</div>
          <div class="print-signature-line">(인)</div>
        </div>
        <div class="print-signature-box">
          <div class="print-signature-label">공급업체 확인</div>
          <div class="print-signature-line">(인)</div>
        </div>
      </div>

      <div class="print-footer">
        <div>본 매입전표는 ${formatDate(firstItem.거래일자)} 기준으로 작성되었습니다.</div>
        <div>문의사항은 담당자에게 연락 주시기 바랍니다.</div>
      </div>
    </div>
  `;
}

// ===========================
// 프린트 미리보기 & 실행
// ===========================

/**
 * 프린트 미리보기 모달 표시
 */
function showPrintPreview(htmlContent, documentType) {
  // 기존 모달이 있으면 제거
  let modal = document.getElementById('printPreviewModal');
  if (modal) {
    modal.remove();
  }

  // 새 모달 생성
  modal = document.createElement('div');
  modal.id = 'printPreviewModal';
  modal.className = 'print-preview-modal active';

  modal.innerHTML = `
    <div class="print-preview-content">
      <div class="print-preview-toolbar no-print">
        <div>
          <strong>${documentType} 미리보기</strong>
        </div>
        <div>
          <button class="btn-preview-print" onclick="executePrint()">인쇄하기</button>
          <button class="btn-preview-close" onclick="closePrintPreview()">닫기</button>
        </div>
      </div>
      <div id="printPreviewContent" style="padding: 20mm;">
        ${htmlContent}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

/**
 * 프린트 미리보기 닫기
 */
function closePrintPreview() {
  const modal = document.getElementById('printPreviewModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * 프린트 실행
 */
function executePrint() {
  window.print();
}

// Window 전역 함수로 export
window.printQuotation = printQuotation;
window.printOrder = printOrder;
window.printTransaction = printTransaction;
window.printPurchaseStatement = printPurchaseStatement;
window.closePrintPreview = closePrintPreview;
window.executePrint = executePrint;
