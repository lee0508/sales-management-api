// ✅ 현금출납내역관리 스크립트 (cash-history.js)
document.addEventListener('DOMContentLoaded', () => {
  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadCashHistory = loadCashHistory;
});

// ✅ 현금출납내역 목록 불러오기
async function loadCashHistory() {
  // 페이지가 표시될 때마다 날짜 초기화
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const startDateInput = document.getElementById('cashStartDate');
  const endDateInput = document.getElementById('cashEndDate');

  if (startDateInput && !startDateInput.value) {
    startDateInput.value = todayStr;
  }
  if (endDateInput && !endDateInput.value) {
    endDateInput.value = todayStr;
  }

  try {
    // TODO: API 연동 구현
    console.log('현금출납내역 로드 - API 연동 예정');

    // 임시 데이터로 DataTable 초기화
    const tableData = [];
    document.getElementById('cashCount').textContent = tableData.length;

    // ✅ 기존 DataTable 있으면 destroy
    if (window.cashHistoryTableInstance) {
      window.cashHistoryTableInstance.destroy();
    }

    // ✅ DataTable 초기화
    window.cashHistoryTableInstance = $('#cashHistoryTable').DataTable({
      data: tableData,
      columns: [
        {
          data: null,
          render: (data, type, row, meta) =>
            `<input type="checkbox" class="cashCheckbox" data-id="${row.출납번호}">`,
          orderable: false,
        },
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
          defaultContent: '-',
        },
        { data: '출납번호', defaultContent: '-' },
        {
          data: '출납일자',
          render: (data) => (data ? data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'),
        },
        {
          data: '구분',
          render: (data) => {
            if (data === 1) return '<span class="status-badge status-active">입금</span>';
            if (data === 2) return '<span class="status-badge status-pending">출금</span>';
            return '-';
          },
        },
        {
          data: '입금액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '출금액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '잔액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        { data: '거래처명', defaultContent: '-' },
        { data: '적요', defaultContent: '-' },
        { data: '작성자', defaultContent: '-' },
        {
          data: null,
          orderable: false,
          render: (data, type, row) => {
            return `
              <div class="action-buttons" id="cash-actions-${row.출납번호}">
                <button class="btn-icon btn-view" onclick="viewCashDetail('${row.출납번호}')">상세</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editCash('${row.출납번호}')">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="deleteCash('${row.출납번호}')">삭제</button>
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
    console.error('❌ 현금출납내역 로드 오류:', error);
  }
}

// ✅ 필터링 함수
function filterCashHistory() {
  console.log('현금출납내역 필터링 - 구현 예정');
  loadCashHistory();
}

// ✅ 현금출납 등록 모달 열기
function openNewCashModal() {
  console.log('현금출납 등록 모달 - 구현 예정');
  alert('현금출납 등록 기능은 추후 구현 예정입니다.');
}

// ✅ Excel 내보내기
function exportCashToExcel() {
  console.log('Excel 내보내기 - 구현 예정');
  alert('Excel 내보내기 기능은 추후 구현 예정입니다.');
}

// ✅ 상세보기
function viewCashDetail(id) {
  console.log('현금출납 상세보기:', id);
  alert('상세보기 기능은 추후 구현 예정입니다.');
}

// ✅ 수정
function editCash(id) {
  console.log('현금출납 수정:', id);
  alert('수정 기능은 추후 구현 예정입니다.');
}

// ✅ 삭제
function deleteCash(id) {
  console.log('현금출납 삭제:', id);
  alert('삭제 기능은 추후 구현 예정입니다.');
}

// ✅ 체크박스 이벤트
$(document).on('change', '#selectAllCash', function () {
  const isChecked = $(this).prop('checked');
  $('.cashCheckbox').prop('checked', isChecked).trigger('change');
});

$(document).on('change', '.cashCheckbox', function () {
  const totalCheckboxes = $('.cashCheckbox').length;
  const checkedCheckboxes = $('.cashCheckbox:checked').length;
  $('#selectAllCash').prop('checked', totalCheckboxes === checkedCheckboxes);

  const cashId = $(this).data('id');
  const isChecked = $(this).prop('checked');
  const actionDiv = $('#cash-actions-' + cashId);

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

console.log('✅ cash-history.js 로드 완료');
