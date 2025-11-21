// ✅ 합계잔액시산표 스크립트 (trial-balance.js)
document.addEventListener('DOMContentLoaded', () => {
  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadTrialBalance = loadTrialBalance;
  window.filterTrialBalance = filterTrialBalance;
  window.printTrialBalance = printTrialBalance;
  window.exportTrialBalanceToExcel = exportTrialBalanceToExcel;
  window.viewTrialBalanceDetail = viewTrialBalanceDetail;
  window.closeTrialBalanceDetailModal = closeTrialBalanceDetailModal;
  window.editTrialBalance = editTrialBalance;
  window.deleteTrialBalance = deleteTrialBalance;
});

// ✅ 합계잔액시산표 목록 불러오기
async function loadTrialBalance() {
  // 페이지가 표시될 때마다 날짜 초기화
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const startDateInput = document.getElementById('trialBalanceStartDate');
  const endDateInput = document.getElementById('trialBalanceEndDate');

  if (startDateInput && !startDateInput.value) {
    startDateInput.value = todayStr;
  }
  if (endDateInput && !endDateInput.value) {
    endDateInput.value = todayStr;
  }

  try {
    // 조회 날짜 가져오기 (종료일 기준으로 조회)
    const endDate = endDateInput.value;
    if (!endDate) {
      alert('조회일자를 선택해주세요.');
      return;
    }

    // YYYY-MM-DD -> YYYYMMDD 변환
    const dateStr = endDate.replace(/-/g, '');

    // API 호출
    const response = await fetch(`/api/trial-balance?date=${dateStr}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || '합계잔액시산표 조회에 실패했습니다.');
      return;
    }

    const tableData = result.data || [];

    // 합계 계산 및 검증
    let total차변누계 = 0;
    let total대변누계 = 0;

    tableData.forEach((row) => {
      total차변누계 += row.차변누계 || 0;
      total대변누계 += row.대변누계 || 0;
    });

    // 차변/대변 일치 여부 검증 (소수점 오차 고려)
    const difference = Math.abs(total차변누계 - total대변누계);
    const isBalanced = difference < 0.01; // 1원 미만 차이는 허용

    // 기간 정보 및 검증 결과 표시
    const year = endDate.substring(0, 4);
    const month = endDate.substring(5, 7);
    const day = endDate.substring(8, 10);

    let periodInfoHtml = `${year}년 ${month}월 ${day}일 기준 | `;
    if (isBalanced) {
      periodInfoHtml += `<span style="color: #28a745; font-weight: bold;">✅ 차변합계 = 대변합계 (정상)</span>`;
    } else {
      periodInfoHtml += `<span style="color: #dc3545; font-weight: bold;">❌ 차변합계 ≠ 대변합계 (차이: ${difference.toLocaleString()}원 - 확인 필요)</span>`;
    }

    document.getElementById('trialBalancePeriodInfo').innerHTML = periodInfoHtml;

    // ✅ 기존 DataTable 있으면 destroy
    if (window.trialBalanceTableInstance) {
      window.trialBalanceTableInstance.destroy();
    }

    // ✅ DataTable 초기화
    window.trialBalanceTableInstance = $('#trialBalanceTable').DataTable({
      data: tableData,
      columns: [
        {
          data: null,
          render: (data, type, row, meta) =>
            `<input type="checkbox" class="trialBalanceCheckbox" data-code="${row.계정코드}" data-row-index="${meta.row}">`,
          orderable: false,
        },
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
          defaultContent: '-',
        },
        { data: '계정코드', defaultContent: '-' },
        { data: '계정명', defaultContent: '-' },
        {
          data: '차변당월',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '차변누계',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '대변당월',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '대변누계',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '차변잔액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '대변잔액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: null,
          orderable: false,
          render: (data, type, row, meta) => {
            return `
              <div class="action-buttons" id="trial-balance-actions-${meta.row}">
                <button class="btn-icon btn-view" onclick="viewTrialBalanceDetail('${row.계정코드}', '${row.계정명}')">상세</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editTrialBalance('${row.계정코드}')">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="deleteTrialBalance('${row.계정코드}')">삭제</button>
              </div>
            `;
          },
        },
      ],
      language: {
        emptyTable: '데이터가 없습니다',
        info: '_START_ - _END_ / _TOTAL_건',
        infoEmpty: '0건',
        infoFiltered: '(전체 _MAX_건 중 검색결과)',
        lengthMenu: '_MENU_ 개씩 보기',
        search: '검색:',
        paginate: {
          first: '처음',
          last: '마지막',
          next: '다음',
          previous: '이전',
        },
      },
      pageLength: 25,
      ordering: true,
      searching: true,
    });
  } catch (error) {
    console.error('❌ 합계잔액시산표 로드 오류:', error);
  }
}

// ✅ 필터링 함수
function filterTrialBalance() {
  loadTrialBalance();
}

// ✅ 출력 함수
async function printTrialBalance() {
  try {
    const endDateInput = document.getElementById('trialBalanceEndDate');
    const endDate = endDateInput.value;

    if (!endDate) {
      alert('조회일자를 선택해주세요.');
      return;
    }

    // YYYY-MM-DD -> YYYYMMDD 변환
    const dateStr = endDate.replace(/-/g, '');

    // API 호출
    const response = await fetch(`/api/trial-balance?date=${dateStr}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || '합계잔액시산표 조회에 실패했습니다.');
      return;
    }

    const data = result.data || [];

    // 날짜 표시 형식
    const year = endDate.substring(0, 4);
    const month = endDate.substring(5, 7);
    const day = endDate.substring(8, 10);
    const dateDisplay = `${year}년 ${month}월 ${day}일`;

    // 합계 계산
    let total차변당월 = 0;
    let total차변누계 = 0;
    let total대변당월 = 0;
    let total대변누계 = 0;
    let total차변잔액 = 0;
    let total대변잔액 = 0;

    data.forEach((row) => {
      total차변당월 += row.차변당월 || 0;
      total차변누계 += row.차변누계 || 0;
      total대변당월 += row.대변당월 || 0;
      total대변누계 += row.대변누계 || 0;
      total차변잔액 += row.차변잔액 || 0;
      total대변잔액 += row.대변잔액 || 0;
    });

    // 차변/대변 일치 여부 검증
    const difference = Math.abs(total차변누계 - total대변누계);
    const isBalanced = difference < 0.01; // 1원 미만 차이는 허용

    let validationMessage = '';
    let validationColor = '';
    if (isBalanced) {
      validationMessage = '✅ 차변합계 = 대변합계 (정상)';
      validationColor = '#28a745';
    } else {
      validationMessage = `❌ 차변합계 ≠ 대변합계 (차이: ${difference.toLocaleString()}원 - 확인 필요)`;
      validationColor = '#dc3545';
    }

    // HTML 생성
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>합계잔액시산표</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: 'Malgun Gothic', sans-serif;
            font-size: 10pt;
            margin: 0;
            padding: 20px;
          }
          .title {
            text-align: center;
            font-size: 20pt;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .date {
            text-align: center;
            font-size: 12pt;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #000;
            padding: 6px 8px;
            text-align: center;
            font-size: 9pt;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .text-left {
            text-align: left;
          }
          .text-right {
            text-align: right;
          }
          .total-row {
            background-color: #fff3cd;
            font-weight: bold;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="title">합계잔액시산표</div>
        <div class="date">${dateDisplay} 기준</div>
        <div style="text-align: center; margin-bottom: 15px; padding: 8px; background-color: ${isBalanced ? '#d4edda' : '#f8d7da'}; border: 1px solid ${validationColor}; border-radius: 4px;">
          <span style="color: ${validationColor}; font-weight: bold; font-size: 11pt;">${validationMessage}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">순번</th>
              <th style="width: 80px;">계정코드</th>
              <th style="width: 120px;">계정명</th>
              <th style="width: 100px;">차변당월</th>
              <th style="width: 100px;">차변누계</th>
              <th style="width: 100px;">대변당월</th>
              <th style="width: 100px;">대변누계</th>
              <th style="width: 100px;">차변잔액</th>
              <th style="width: 100px;">대변잔액</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${row.계정코드 || '-'}</td>
                <td class="text-left">${row.계정명 || '-'}</td>
                <td class="text-right">${(row.차변당월 || 0).toLocaleString()}</td>
                <td class="text-right">${(row.차변누계 || 0).toLocaleString()}</td>
                <td class="text-right">${(row.대변당월 || 0).toLocaleString()}</td>
                <td class="text-right">${(row.대변누계 || 0).toLocaleString()}</td>
                <td class="text-right">${(row.차변잔액 || 0).toLocaleString()}</td>
                <td class="text-right">${(row.대변잔액 || 0).toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
            <tr class="total-row">
              <td colspan="3">합  계</td>
              <td class="text-right">${total차변당월.toLocaleString()}</td>
              <td class="text-right">${total차변누계.toLocaleString()}</td>
              <td class="text-right">${total대변당월.toLocaleString()}</td>
              <td class="text-right">${total대변누계.toLocaleString()}</td>
              <td class="text-right">${total차변잔액.toLocaleString()}</td>
              <td class="text-right">${total대변잔액.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    // 새 창에서 출력
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  } catch (error) {
    console.error('❌ 합계잔액시산표 출력 오류:', error);
    alert('출력 중 오류가 발생했습니다.');
  }
}

// ✅ Google Sheets로 내보내기 (CSV 형식)
function exportTrialBalanceToExcel() {
  try {
    // DataTable 인스턴스 확인
    if (!window.trialBalanceTableInstance) {
      alert('내보낼 데이터가 없습니다. 먼저 조회 버튼을 클릭하여 데이터를 조회하세요.');
      return;
    }

    // 날짜 정보 가져오기
    const endDateInput = document.getElementById('trialBalanceEndDate');
    const endDate = endDateInput.value;

    if (!endDate) {
      alert('조회일자를 선택해주세요.');
      return;
    }

    // 날짜 표시 형식
    const year = endDate.substring(0, 4);
    const month = endDate.substring(5, 7);
    const day = endDate.substring(8, 10);
    const dateDisplay = `${year}년 ${month}월 ${day}일`;

    // DataTable에서 모든 데이터 가져오기
    const tableData = window.trialBalanceTableInstance.rows().data().toArray();

    if (tableData.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // 합계 계산
    let total차변당월 = 0;
    let total차변누계 = 0;
    let total대변당월 = 0;
    let total대변누계 = 0;
    let total차변잔액 = 0;
    let total대변잔액 = 0;

    tableData.forEach((row) => {
      total차변당월 += row.차변당월 || 0;
      total차변누계 += row.차변누계 || 0;
      total대변당월 += row.대변당월 || 0;
      total대변누계 += row.대변누계 || 0;
      total차변잔액 += row.차변잔액 || 0;
      total대변잔액 += row.대변잔액 || 0;
    });

    // CSV 데이터 생성 (합계 행 포함)
    const csvRows = [
      // 헤더 행 1: 제목
      [`합계잔액시산표 - ${dateDisplay} 기준`],
      // 빈 행
      [],
      // 헤더 행 2: 컬럼명
      [
        '순번',
        '계정코드',
        '계정명',
        '차변당월',
        '차변누계',
        '대변당월',
        '대변누계',
        '차변잔액',
        '대변잔액',
      ],
      // 데이터 행
      ...tableData.map((row, index) => [
        index + 1,
        row.계정코드 || '',
        row.계정명 || '',
        row.차변당월 || 0,
        row.차변누계 || 0,
        row.대변당월 || 0,
        row.대변누계 || 0,
        row.차변잔액 || 0,
        row.대변잔액 || 0,
      ]),
      // 합계 행
      [
        '합계',
        '',
        '',
        total차변당월,
        total차변누계,
        total대변당월,
        total대변누계,
        total차변잔액,
        total대변잔액,
      ],
    ];

    // CSV 문자열 생성
    const csvContent = csvRows
      .map((row) =>
        row
          .map((cell) => {
            // 숫자인 경우 그대로, 문자열인 경우 따옴표로 감싸기
            if (typeof cell === 'number') {
              return cell;
            }
            // 쉼표나 따옴표가 포함된 경우 이스케이프 처리
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(',')
      )
      .join('\n');

    // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const csvData = BOM + csvContent;

    // Blob 생성 및 다운로드
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    // 파일명 생성 (예: 합계잔액시산표_20251117.csv)
    const fileName = `합계잔액시산표_${year}${month}${day}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ 합계잔액시산표 CSV 내보내기 완료:', fileName);
  } catch (error) {
    console.error('❌ CSV 내보내기 오류:', error);
    alert('CSV 내보내기 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 상세보기 - 계정과목별 거래내역 조회
async function viewTrialBalanceDetail(code, accountName) {
  try {
    console.log('합계잔액시산표 상세보기:', { code, accountName });

    // 조회 날짜 가져오기
    const endDateInput = document.getElementById('trialBalanceEndDate');
    const startDateInput = document.getElementById('trialBalanceStartDate');
    const endDate = endDateInput.value;
    const startDate = startDateInput.value;

    if (!endDate) {
      alert('조회일자를 선택해주세요.');
      return;
    }

    // 날짜 변환 (YYYY-MM-DD -> YYYYMMDD)
    // 시작일이 없으면 해당 월의 1일부터 조회
    let startDateStr;
    if (startDate) {
      startDateStr = startDate.replace(/-/g, '');
    } else {
      // 종료일 기준으로 해당 월의 1일 설정
      const year = endDate.substring(0, 4);
      const month = endDate.substring(5, 7);
      startDateStr = `${year}${month}01`;
    }
    const endDateStr = endDate.replace(/-/g, '');

    // 합계잔액시산표에서 해당 계정과목 데이터 찾기
    const tableData = window.trialBalanceTableInstance.rows().data().toArray();
    // 계정코드가 비어있으면 계정명으로 찾기 (매입, 매출의 경우)
    const accountData = code
      ? tableData.find((row) => row.계정코드 === code)
      : tableData.find((row) => row.계정명 && row.계정명.trim() === accountName.trim());

    if (!accountData) {
      alert('계정과목 정보를 찾을 수 없습니다.');
      return;
    }

    // 모달 제목 정보 설정
    document.getElementById('trialBalanceDetailAccountCode').textContent = accountData.계정코드;
    document.getElementById('trialBalanceDetailAccountName').textContent = accountData.계정명;

    // 기간 표시 형식 (YYYYMMDD -> YYYY년 MM월 DD일)
    const formatDate = (dateStr) => {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}년 ${month}월 ${day}일`;
    };

    document.getElementById('trialBalanceDetailPeriod').textContent = `${formatDate(startDateStr)} ~ ${formatDate(endDateStr)}`;

    // 요약 정보 표시
    document.getElementById('detailDebitMonth').textContent = (accountData.차변당월 || 0).toLocaleString() + '원';
    document.getElementById('detailDebitTotal').textContent = (accountData.차변누계 || 0).toLocaleString() + '원';
    document.getElementById('detailCreditMonth').textContent = (accountData.대변당월 || 0).toLocaleString() + '원';
    document.getElementById('detailCreditTotal').textContent = (accountData.대변누계 || 0).toLocaleString() + '원';

    // 계정과목명에 따라 다른 API 호출
    let apiUrl;
    let transactions = [];

    // 매입/매출 계정은 자재입출내역에서 조회 (공백 제거 후 비교)
    const 계정명Normalized = (accountData.계정명 || '').replace(/\s+/g, '');
    if (계정명Normalized.includes('매입') || 계정명Normalized.includes('매출')) {
      // 자재입출내역 조회 API
      const 입출구분 = 계정명Normalized.includes('매입') ? 1 : 2; // 1=매입, 2=매출
      apiUrl = `/api/material-transactions?startDate=${startDateStr}&endDate=${endDateStr}&입출구분=${입출구분}`;

      console.log('📞 자재입출내역 API 호출:', {
        계정명: accountData.계정명,
        계정명Normalized: 계정명Normalized,
        입출구분: 입출구분,
        입출구분타입: typeof 입출구분,
        입출구분표시: 입출구분 === 1 ? '매입' : '매출',
        startDate: startDateStr,
        endDate: endDateStr,
        url: apiUrl,
      });

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      console.log('📥 자재입출내역 API 응답:', {
        success: result.success,
        total: result.total,
        dataLength: result.data?.length,
      });

      if (!result.success) {
        alert(result.message || '거래내역 조회에 실패했습니다.');
        return;
      }

      transactions = result.data || [];
    } else {
      // 기타 계정(현금, 보통예금 등)은 현금출납내역에서 조회
      apiUrl = `/api/cash-history?startDate=${startDateStr}&endDate=${endDateStr}&계정코드=${code}`;

      console.log('📞 현금출납내역 API 호출:', {
        계정코드: code,
        계정명: accountData.계정명,
        startDate: startDateStr,
        endDate: endDateStr,
        url: apiUrl,
      });

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      console.log('📥 현금출납내역 API 응답:', {
        success: result.success,
        total: result.total,
        dataLength: result.data?.length,
      });

      if (!result.success) {
        alert(result.message || '거래내역 조회에 실패했습니다.');
        return;
      }

      transactions = result.data || [];
    }

    console.log('📋 거래내역 데이터:', transactions);

    // 기존 DataTable이 있으면 제거
    if (window.trialBalanceDetailTableInstance) {
      window.trialBalanceDetailTableInstance.destroy();
    }

    // 거래내역 DataTable 초기화 (매입/매출 vs 현금출납 구분)
    const isMaterialTransaction = 계정명Normalized.includes('매입') || 계정명Normalized.includes('매출');

    // 테이블 헤더 변경
    const tableTitle = document.getElementById('trialBalanceDetailTableTitle');
    const tableHead = document.getElementById('trialBalanceDetailTableHead');

    if (isMaterialTransaction) {
      // 매입/매출: 자재입출내역 테이블
      tableTitle.innerHTML = '📋 거래내역 (자재입출내역)';
      tableHead.innerHTML = `
        <tr>
          <th>순번</th>
          <th>거래일자</th>
          <th>입출고구분</th>
          <th>거래처명</th>
          <th>자재명</th>
          <th>수량</th>
          <th>단가</th>
          <th>금액</th>
        </tr>
      `;
    } else {
      // 현금출납: 회계전표내역 테이블
      tableTitle.innerHTML = '📋 거래내역 (현금출납내역)';
      tableHead.innerHTML = `
        <tr>
          <th>순번</th>
          <th>작성일자</th>
          <th>입출구분</th>
          <th>계정명</th>
          <th>입금금액</th>
          <th>출금금액</th>
          <th>적요</th>
          <th>작성자</th>
        </tr>
      `;
    }

    let columns;
    if (isMaterialTransaction) {
      // 매입/매출: 자재입출내역 컬럼
      columns = [
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
        },
        {
          data: '거래일자',
          render: (d) => {
            if (!d) return '-';
            // YYYYMMDD -> YYYY-MM-DD
            return d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
          },
        },
        {
          data: '입출고구분',
          render: (d) => {
            if (d === 1) return '<span style="color: #28a745;">매입(입고)</span>';
            if (d === 2) return '<span style="color: #dc3545;">매출(출고)</span>';
            return '-';
          },
        },
        {
          data: '거래처명',
          defaultContent: '-',
          render: (d, type, row) => {
            // 매입처명 또는 매출처명
            return row.매입처명 || row.매출처명 || '-';
          },
        },
        { data: '자재명', defaultContent: '-' },
        {
          data: '수량',
          render: (d, type, row) => {
            const qty = row.입고수량 || row.출고수량 || 0;
            return qty ? qty.toLocaleString() : '-';
          },
          className: 'dt-right',
        },
        {
          data: '단가',
          render: (d, type, row) => {
            const price = row.입고단가 || row.출고단가 || 0;
            return price ? price.toLocaleString() + '원' : '-';
          },
          className: 'dt-right',
        },
        {
          data: '금액',
          render: (d, type, row) => {
            const qty = row.입고수량 || row.출고수량 || 0;
            const price = row.입고단가 || row.출고단가 || 0;
            const amount = qty * price;
            return amount ? amount.toLocaleString() + '원' : '-';
          },
          className: 'dt-right',
        },
      ];
    } else {
      // 현금출납: 회계전표내역 컬럼
      columns = [
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
        },
        {
          data: '작성일자',
          render: (d) => {
            if (!d) return '-';
            // YYYYMMDD -> YYYY-MM-DD
            return d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
          },
        },
        {
          data: '입출구분',
          render: (d) => {
            if (d === 1) return '<span style="color: #28a745;">입금</span>';
            if (d === 2) return '<span style="color: #dc3545;">출금</span>';
            return '-';
          },
        },
        { data: '계정명', defaultContent: '-' },
        {
          data: '입금금액',
          render: (d) => (d ? d.toLocaleString() + '원' : '-'),
          className: 'dt-right',
        },
        {
          data: '출금금액',
          render: (d) => (d ? d.toLocaleString() + '원' : '-'),
          className: 'dt-right',
        },
        { data: '적요', defaultContent: '-' },
        { data: '사용자명', defaultContent: '-' },
      ];
    }

    window.trialBalanceDetailTableInstance = $('#trialBalanceDetailTable').DataTable({
      data: transactions,
      columns: columns,
      language: {
        emptyTable: '거래내역이 없습니다',
        info: '_START_ - _END_ / _TOTAL_건',
        infoEmpty: '0건',
        infoFiltered: '(전체 _MAX_건 중 검색결과)',
        lengthMenu: '_MENU_ 개씩 보기',
        search: '검색:',
        paginate: {
          first: '처음',
          last: '마지막',
          next: '다음',
          previous: '이전',
        },
      },
      pageLength: 10,
      ordering: true,
      searching: true,
      order: [[1, 'desc']], // 작성일자 내림차순
    });

    // 모달 표시
    const modal = document.getElementById('trialBalanceDetailModal');
    modal.style.display = 'flex';

    console.log('✅ 합계잔액시산표 상세보기 완료:', code, transactions.length, '건');
  } catch (error) {
    console.error('❌ 합계잔액시산표 상세보기 오류:', error);
    alert('상세보기 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 상세보기 모달 닫기
function closeTrialBalanceDetailModal() {
  const modal = document.getElementById('trialBalanceDetailModal');
  modal.style.display = 'none';

  // DataTable 정리
  if (window.trialBalanceDetailTableInstance) {
    window.trialBalanceDetailTableInstance.destroy();
    window.trialBalanceDetailTableInstance = null;
  }
}

// ✅ 수정
function editTrialBalance(code) {
  console.log('합계잔액시산표 수정:', code);
  alert('수정 기능은 추후 구현 예정입니다.');
}

// ✅ 삭제
function deleteTrialBalance(code) {
  console.log('합계잔액시산표 삭제:', code);
  alert('삭제 기능은 추후 구현 예정입니다.');
}

// ✅ 체크박스 이벤트
$(document).on('change', '#selectAllTrialBalance', function () {
  const isChecked = $(this).prop('checked');
  $('.trialBalanceCheckbox').prop('checked', isChecked).trigger('change');
});

$(document).on('change', '.trialBalanceCheckbox', function () {
  const totalCheckboxes = $('.trialBalanceCheckbox').length;
  const checkedCheckboxes = $('.trialBalanceCheckbox:checked').length;
  $('#selectAllTrialBalance').prop('checked', totalCheckboxes === checkedCheckboxes);

  const rowIndex = $(this).data('row-index');
  const isChecked = $(this).prop('checked');
  const actionDiv = $('#trial-balance-actions-' + rowIndex);

  if (isChecked) {
    actionDiv.find('.btn-view').hide();
    actionDiv.find('.btn-edit').show();
    actionDiv.find('.btn-delete').show();
  } else {
    actionDiv.find('.btn-view').show();
    actionDiv.find('.btn-edit').hide();
    actionDiv.find('.btn-delete').hide();
  }
});

console.log('✅ trial-balance.js 로드 완료');
