// ✅ 대차대조표 스크립트 (balance-sheet.js)
document.addEventListener('DOMContentLoaded', () => {
  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadBalanceSheet = loadBalanceSheet;
});

// ✅ 대차대조표 목록 불러오기
async function loadBalanceSheet() {
  // 페이지가 표시될 때마다 날짜 초기화
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const dateInput = document.getElementById('balanceSheetDate');

  if (dateInput && !dateInput.value) {
    dateInput.value = todayStr;
  }

  try {
    // TODO: API 연동 구현
    console.log('대차대조표 로드 - API 연동 예정');

    // 임시 데이터로 DataTable 초기화
    const tableData = [];
    document.getElementById('balanceSheetDateInfo').textContent = '-';

    // ✅ 기존 DataTable 있으면 destroy
    if (window.balanceSheetTableInstance) {
      window.balanceSheetTableInstance.destroy();
    }

    // ✅ DataTable 초기화
    window.balanceSheetTableInstance = $('#balanceSheetTable').DataTable({
      data: tableData,
      columns: [
        {
          data: null,
          render: (data, type, row, meta) =>
            `<input type="checkbox" class="balanceSheetCheckbox" data-code="${row.계정과목코드}">`,
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
          data: '자산',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '부채',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '자본',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: null,
          orderable: false,
          render: (data, type, row) => {
            return `
              <div class="action-buttons" id="balance-sheet-actions-${row.계정과목코드}">
                <button class="btn-icon btn-view" onclick="viewBalanceSheetDetail('${row.계정과목코드}')">상세</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editBalanceSheet('${row.계정과목코드}')">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="deleteBalanceSheet('${row.계정과목코드}')">삭제</button>
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
    console.error('❌ 대차대조표 로드 오류:', error);
  }
}

// ✅ 필터링 함수
function filterBalanceSheet() {
  console.log('대차대조표 필터링 - 구현 예정');
  loadBalanceSheet();
}

// ✅ Excel 내보내기
function exportBalanceSheetToExcel() {
  console.log('Excel 내보내기 - 구현 예정');
  alert('Excel 내보내기 기능은 추후 구현 예정입니다.');
}

// ✅ 상세보기
function viewBalanceSheetDetail(code) {
  console.log('대차대조표 상세보기:', code);
  alert('상세보기 기능은 추후 구현 예정입니다.');
}

// ✅ 수정
function editBalanceSheet(code) {
  console.log('대차대조표 수정:', code);
  alert('수정 기능은 추후 구현 예정입니다.');
}

// ✅ 삭제
function deleteBalanceSheet(code) {
  console.log('대차대조표 삭제:', code);
  alert('삭제 기능은 추후 구현 예정입니다.');
}

// ✅ 체크박스 이벤트
$(document).on('change', '#selectAllBalanceSheet', function () {
  const isChecked = $(this).prop('checked');
  $('.balanceSheetCheckbox').prop('checked', isChecked).trigger('change');
});

$(document).on('change', '.balanceSheetCheckbox', function () {
  const totalCheckboxes = $('.balanceSheetCheckbox').length;
  const checkedCheckboxes = $('.balanceSheetCheckbox:checked').length;
  $('#selectAllBalanceSheet').prop('checked', totalCheckboxes === checkedCheckboxes);

  const accountCode = $(this).data('code');
  const isChecked = $(this).prop('checked');
  const actionDiv = $('#balance-sheet-actions-' + accountCode);

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

console.log('✅ balance-sheet.js 로드 완료');
