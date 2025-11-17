// ✅ 합계잔액시산표 스크립트 (trial-balance.js)
document.addEventListener('DOMContentLoaded', () => {
  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadTrialBalance = loadTrialBalance;
  window.filterTrialBalance = filterTrialBalance;
  window.printTrialBalance = printTrialBalance;
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
            `<input type="checkbox" class="trialBalanceCheckbox" data-code="${row.계정코드}">`,
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
          render: (data, type, row) => {
            return `
              <div class="action-buttons" id="trial-balance-actions-${row.계정코드}">
                <button class="btn-icon btn-view" onclick="viewTrialBalanceDetail('${row.계정코드}')">상세</button>
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

// ✅ Excel 내보내기
function exportTrialBalanceToExcel() {
  console.log('Excel 내보내기 - 구현 예정');
  alert('Excel 내보내기 기능은 추후 구현 예정입니다.');
}

// ✅ 상세보기
function viewTrialBalanceDetail(code) {
  console.log('합계잔액시산표 상세보기:', code);
  alert('상세보기 기능은 추후 구현 예정입니다.');
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

  const accountCode = $(this).data('code');
  const isChecked = $(this).prop('checked');
  const actionDiv = $('#trial-balance-actions-' + accountCode);

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
