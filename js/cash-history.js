// ✅ 현금출납내역관리 스크립트 (cash-history.js)
document.addEventListener('DOMContentLoaded', () => {
  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadCashHistory = loadCashHistory;
  window.filterCashHistory = filterCashHistory;
  window.openNewCashModal = openNewCashModal;
  window.closeCashEntryModal = closeCashEntryModal;
  window.saveCashEntry = saveCashEntry;
  window.toggleCashEntryAmounts = toggleCashEntryAmounts;
  window.viewCashDetail = viewCashDetail;
  window.closeCashDetailModal = closeCashDetailModal;
  window.editCash = editCash;
  window.deleteCash = deleteCash;
  window.closeCashDeleteModal = closeCashDeleteModal;
  window.confirmCashDelete = confirmCashDelete;
  window.exportCashToExcel = exportCashToExcel;
});

// 삭제할 현금출납 정보 저장
let cashToDelete = null;

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

  await filterCashHistory();
}

// ✅ 필터링 함수
async function filterCashHistory() {
  try {
    const startDate = document.getElementById('cashStartDate').value.replace(/-/g, '');
    const endDate = document.getElementById('cashEndDate').value.replace(/-/g, '');
    const 입출구분 = document.getElementById('cashStatusFilter').value;

    let url = `/api/cash-history?startDate=${startDate}&endDate=${endDate}`;
    if (입출구분) {
      url += `&입출구분=${입출구분}`;
    }

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      alert('데이터 조회 실패: ' + result.message);
      return;
    }

    const tableData = result.data || [];
    document.getElementById('cashCount').textContent = tableData.length;

    // ✅ 기존 DataTable 있으면 destroy
    if (window.cashHistoryTableInstance) {
      window.cashHistoryTableInstance.destroy();
    }

    // ✅ DataTable 초기화
    window.cashHistoryTableInstance = $('#cashHistoryTable').DataTable({
      data: tableData,
      order: [], // 입력 순서 유지
      columns: [
        {
          data: null,
          render: (data, type, row) =>
            `<input type="checkbox" class="cashCheckbox" data-date="${row.작성일자}" data-time="${row.작성시간}">`,
          orderable: false,
        },
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
        },
        {
          data: null,
          render: (data, type, row) => `${row.작성일자}-${row.작성시간}`,
        },
        {
          data: '작성일자',
          render: (data) => (data ? data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'),
        },
        {
          data: '입출구분',
          render: (data) => {
            if (data === 1) return '<span class="status-badge status-active">입금</span>';
            if (data === 2) return '<span class="status-badge status-pending">출금</span>';
            return '-';
          },
        },
        {
          data: '입금금액',
          render: (d) => (d ? Number(d).toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '출금금액',
          render: (d) => (d ? Number(d).toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: null,
          render: () => '-', // 잔액은 별도 계산 필요 (추후 구현)
          className: 'dt-right',
        },
        { data: '계정명', defaultContent: '-' },
        { data: '적요', defaultContent: '-' },
        { data: '작성자명', defaultContent: '-' },
        {
          data: null,
          orderable: false,
          render: (data, type, row) => {
            return `
              <div class="action-buttons" id="cash-actions-${row.작성일자}-${row.작성시간}">
                <button class="btn-icon btn-view" onclick="viewCashDetail('${row.작성일자}', '${row.작성시간}')">상세</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editCash('${row.작성일자}', '${row.작성시간}')">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="deleteCash('${row.작성일자}', '${row.작성시간}')">삭제</button>
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
    console.error('❌ 현금출납내역 조회 오류:', error);
    alert('현금출납내역 조회 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 현금출납 등록 모달 열기
async function openNewCashModal() {
  try {
    // 모달 초기화
    document.getElementById('cashEntryMode').value = 'new';
    document.getElementById('cashEntryModalTitle').textContent = '현금출납 등록';
    document.getElementById('cashEntryForm').reset();

    // 오늘 날짜 설정
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('cashEntryDate').value = today;

    // 계정과목 로드
    await loadAccountCategories();

    // 모달 표시
    document.getElementById('cashEntryModal').style.display = 'block';
  } catch (error) {
    console.error('❌ 모달 열기 오류:', error);
    alert('모달 열기 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 계정과목 목록 로드
async function loadAccountCategories() {
  try {
    const response = await fetch('/api/account-categories');
    const result = await response.json();

    if (!result.success) {
      alert('계정과목 조회 실패: ' + result.message);
      return;
    }

    const select = document.getElementById('cashEntryAccount');
    select.innerHTML = '<option value="">선택하세요</option>';

    result.data.forEach((account) => {
      const option = document.createElement('option');
      option.value = account.계정코드;
      option.textContent = `${account.계정코드} - ${account.계정명}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('❌ 계정과목 로드 오류:', error);
    alert('계정과목 로드 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 모달 닫기
function closeCashEntryModal() {
  document.getElementById('cashEntryModal').style.display = 'none';
  document.getElementById('cashEntryForm').reset();
}

// ✅ 입출구분에 따른 필드 토글 (필요시 사용)
function toggleCashEntryAmounts() {
  // 현재는 금액 필드 하나만 사용하므로 특별한 처리 불필요
  // 향후 입금액/출금액 필드를 분리할 경우 여기서 처리
}

// ✅ 현금출납내역 저장
async function saveCashEntry(event) {
  event.preventDefault();

  try {
    const mode = document.getElementById('cashEntryMode').value;
    const 작성일자 = document.getElementById('cashEntryDate').value.replace(/-/g, '');
    const 계정코드 = document.getElementById('cashEntryAccount').value;
    const 입출구분 = parseInt(document.getElementById('cashEntryType').value);
    const amount = parseFloat(document.getElementById('cashEntryAmount').value);
    const 적요 = document.getElementById('cashEntryRemark').value;

    // 입출구분에 따라 입금금액/출금금액 설정
    const 입금금액 = 입출구분 === 1 ? amount : 0;
    const 출금금액 = 입출구분 === 2 ? amount : 0;

    const data = {
      작성일자,
      계정코드,
      입출구분,
      입금금액,
      출금금액,
      적요,
    };

    let response;
    if (mode === 'new') {
      // 신규 등록
      response = await fetch('/api/cash-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      // 수정
      const originalDate = document.getElementById('cashEntryOriginalDate').value;
      const originalTime = document.getElementById('cashEntryOriginalTime').value;
      response = await fetch(`/api/cash-history/${originalDate}/${originalTime}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }

    const result = await response.json();

    if (!result.success) {
      alert('저장 실패: ' + result.message);
      return;
    }

    alert(result.message);
    closeCashEntryModal();
    await filterCashHistory();
  } catch (error) {
    console.error('❌ 저장 오류:', error);
    alert('저장 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 상세보기
async function viewCashDetail(date, time) {
  try {
    const response = await fetch(`/api/cash-history/${date}/${time}`);
    const result = await response.json();

    if (!result.success) {
      alert('조회 실패: ' + result.message);
      return;
    }

    const data = result.data;

    // 모달에 데이터 표시
    document.getElementById('cashDetailDate').textContent = data.작성일자.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('cashDetailTime').textContent = data.작성시간;
    document.getElementById('cashDetailAccount').textContent = `${data.계정코드} - ${data.계정명}`;
    document.getElementById('cashDetailType').textContent = data.입출구분 === 1 ? '입금' : '출금';
    document.getElementById('cashDetailInAmount').textContent = Number(data.입금금액).toLocaleString() + '원';
    document.getElementById('cashDetailOutAmount').textContent = Number(data.출금금액).toLocaleString() + '원';
    document.getElementById('cashDetailRemark').textContent = data.적요 || '-';
    document.getElementById('cashDetailCreator').textContent = data.작성자명 || '-';
    document.getElementById('cashDetailModified').textContent = data.수정일자
      ? data.수정일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      : '-';

    // 모달 표시 (flexbox로 중앙 정렬)
    document.getElementById('cashDetailModal').style.display = 'flex';
  } catch (error) {
    console.error('❌ 상세보기 오류:', error);
    alert('상세보기 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 상세보기 모달 닫기
function closeCashDetailModal() {
  const modal = document.getElementById('cashDetailModal');
  const modalContent = document.getElementById('cashDetailModalContent');
  modal.style.display = 'none';
  // 드래그 위치 초기화
  if (modalContent) {
    modalContent.style.transform = 'translate(0px, 0px)';
  }
  // 드래그 상태 초기화
  resetCashDetailModalPosition();
}

// ✅ 모달 드래그 기능 초기화
let cashDetailDragState = {
  isDragging: false,
  currentX: 0,
  currentY: 0,
  initialX: 0,
  initialY: 0,
  xOffset: 0,
  yOffset: 0,
};

function initCashDetailModalDrag() {
  const modal = document.getElementById('cashDetailModalContent');
  const header = document.getElementById('cashDetailModalHeader');

  if (!modal || !header) return;

  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    cashDetailDragState.initialX = e.clientX - cashDetailDragState.xOffset;
    cashDetailDragState.initialY = e.clientY - cashDetailDragState.yOffset;

    if (e.target === header || e.target.closest('#cashDetailModalHeader')) {
      cashDetailDragState.isDragging = true;
    }
  }

  function drag(e) {
    if (cashDetailDragState.isDragging) {
      e.preventDefault();

      cashDetailDragState.currentX = e.clientX - cashDetailDragState.initialX;
      cashDetailDragState.currentY = e.clientY - cashDetailDragState.initialY;

      cashDetailDragState.xOffset = cashDetailDragState.currentX;
      cashDetailDragState.yOffset = cashDetailDragState.currentY;

      setTranslate(cashDetailDragState.currentX, cashDetailDragState.currentY, modal);
    }
  }

  function dragEnd() {
    cashDetailDragState.initialX = cashDetailDragState.currentX;
    cashDetailDragState.initialY = cashDetailDragState.currentY;
    cashDetailDragState.isDragging = false;
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }
}

// 드래그 상태 리셋 함수 추가
function resetCashDetailModalPosition() {
  cashDetailDragState = {
    isDragging: false,
    currentX: 0,
    currentY: 0,
    initialX: 0,
    initialY: 0,
    xOffset: 0,
    yOffset: 0,
  };
}

// DOM 로드 후 드래그 기능 초기화
document.addEventListener('DOMContentLoaded', () => {
  initCashDetailModalDrag();
});

// ✅ 수정
async function editCash(date, time) {
  try {
    const response = await fetch(`/api/cash-history/${date}/${time}`);
    const result = await response.json();

    if (!result.success) {
      alert('조회 실패: ' + result.message);
      return;
    }

    const data = result.data;

    // 모달 초기화 (수정 모드)
    document.getElementById('cashEntryMode').value = 'edit';
    document.getElementById('cashEntryModalTitle').textContent = '현금출납 수정';
    document.getElementById('cashEntryOriginalDate').value = date;
    document.getElementById('cashEntryOriginalTime').value = time;

    // 데이터 설정
    document.getElementById('cashEntryDate').value = data.작성일자.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('cashEntryType').value = data.입출구분;
    document.getElementById('cashEntryAmount').value = data.입출구분 === 1 ? data.입금금액 : data.출금금액;
    document.getElementById('cashEntryRemark').value = data.적요 || '';

    // 계정과목 로드 후 선택
    await loadAccountCategories();
    document.getElementById('cashEntryAccount').value = data.계정코드;

    // 모달 표시
    document.getElementById('cashEntryModal').style.display = 'block';
  } catch (error) {
    console.error('❌ 수정 모달 열기 오류:', error);
    alert('수정 모달 열기 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 삭제 모달 열기
function deleteCash(date, time) {
  // 삭제할 정보 저장
  cashToDelete = { date, time };

  // 날짜 포맷 변환
  const dateFormatted = date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

  // 모달에 정보 표시
  document.getElementById('deleteCashInfo').innerHTML = `
    작성일자: ${dateFormatted}<br>
    작성시간: ${time}
  `;

  // 모달 표시
  const modal = document.getElementById('cashDeleteModal');
  modal.style.display = 'flex';
}

// ✅ 삭제 모달 닫기
function closeCashDeleteModal() {
  document.getElementById('cashDeleteModal').style.display = 'none';
  cashToDelete = null;
}

// ✅ 삭제 확인
async function confirmCashDelete() {
  if (!cashToDelete) {
    return;
  }

  try {
    const { date, time } = cashToDelete;

    const response = await fetch(`/api/cash-history/${date}/${time}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!result.success) {
      alert('삭제 실패: ' + result.message);
      return;
    }

    alert(result.message);
    closeCashDeleteModal();
    await filterCashHistory();
  } catch (error) {
    console.error('❌ 삭제 오류:', error);
    alert('삭제 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ Excel 내보내기
function exportCashToExcel() {
  try {
    if (!window.cashHistoryTableInstance) {
      alert('조회된 데이터가 없습니다.');
      return;
    }

    // DataTable의 모든 데이터 가져오기
    const data = window.cashHistoryTableInstance.rows().data().toArray();

    if (data.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // CSV 생성
    let csv = '작성일자,작성시간,입출구분,계정코드,계정명,입금금액,출금금액,적요,작성자\n';

    data.forEach((row) => {
      const dateStr = row.작성일자 ? row.작성일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '';
      const typeStr = row.입출구분 === 1 ? '입금' : row.입출구분 === 2 ? '출금' : '';
      csv += `${dateStr},${row.작성시간},${typeStr},${row.계정코드},${row.계정명 || ''},${row.입금금액 || 0},${row.출금금액 || 0},"${row.적요 || ''}",${row.작성자명 || ''}\n`;
    });

    // BOM 추가 (한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `현금출납내역_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV 내보내기 완료');
  } catch (error) {
    console.error('❌ Excel 내보내기 오류:', error);
    alert('Excel 내보내기 중 오류가 발생했습니다: ' + error.message);
  }
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

  const date = $(this).data('date');
  const time = $(this).data('time');
  const isChecked = $(this).prop('checked');
  const actionDiv = $(`#cash-actions-${date}-${time}`);

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
