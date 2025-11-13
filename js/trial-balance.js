// ✅ 합계잔액시산표 스크립트 (trial-balance.js)
document.addEventListener('DOMContentLoaded', () => {
  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadTrialBalance = loadTrialBalance;
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
    // TODO: API 연동 구현
    console.log('합계잔액시산표 로드 - API 연동 예정');

    // 임시 데이터로 DataTable 초기화
    const tableData = [];
    document.getElementById('trialBalancePeriodInfo').textContent = '-';

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
            `<input type="checkbox" class="trialBalanceCheckbox" data-code="${row.계정과목코드}">`,
          orderable: false,
        },
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
          defaultContent: '-',
        },
        { data: '계정과목코드', defaultContent: '-' },
        { data: '계정과목명', defaultContent: '-' },
        {
          data: '차변합계',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '대변합계',
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
              <div class="action-buttons" id="trial-balance-actions-${row.계정과목코드}">
                <button class="btn-icon btn-view" onclick="viewTrialBalanceDetail('${row.계정과목코드}')">상세</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editTrialBalance('${row.계정과목코드}')">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="deleteTrialBalance('${row.계정과목코드}')">삭제</button>
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
  console.log('합계잔액시산표 필터링 - 구현 예정');
  loadTrialBalance();
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
