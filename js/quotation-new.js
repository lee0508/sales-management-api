/**
 * 견적관리 - CommonTable 사용 버전
 * 설정만 정의하고 나머지는 공통 라이브러리 사용
 */

// ==================== 전역 변수 ====================
let quotationTable = null;

// ==================== 매출처 선택 함수 ====================
window.selectQuotationCustomer = function(customer) {
  try {
    const codeInput = document.getElementById('selectedCustomerCode');
    const nameInput = document.getElementById('selectedCustomerName');

    if (!codeInput || !nameInput) {
      alert('입력 필드를 찾을 수 없습니다.');
      return;
    }

    codeInput.value = customer.매출처코드;
    nameInput.value = customer.매출처명;

    const infoDiv = document.getElementById('selectedCustomerInfo');
    const displaySpan = document.getElementById('selectedCustomerDisplay');

    if (infoDiv && displaySpan) {
      displaySpan.textContent = `[${customer.매출처코드}] ${customer.매출처명}`;
      infoDiv.style.display = 'block';
    }

    window.closeCustomerSearchModal();
  } catch (err) {
    console.error('❌ selectQuotationCustomer 에러:', err);
    alert('매출처 선택 중 오류가 발생했습니다: ' + err.message);
  }
};

window.closeCustomerSearchModal = function() {
  const modal = document.getElementById('customerSearchModal');
  if (modal) modal.style.display = 'none';
};

// ==================== 테이블 초기화 ====================
function initQuotationTable() {
  console.log('✅ 견적관리 테이블 초기화');

  // CommonTable 인스턴스 생성
  quotationTable = new CommonTable('quotationTable', {
    // 컬럼 정의
    columns: [
      {
        field: 'rowNumber',
        label: '순번',
        align: 'center',
        render: (value, row, index) => {
          const totalItems = quotationTable.getFilteredData().length;
          const startIndex = (quotationTable.currentPage - 1) * quotationTable.options.rowsPerPage;
          return totalItems - (startIndex + index);
        }
      },
      {
        field: '견적번호',
        label: '견적번호',
        align: 'center',
        sortable: true
      },
      {
        field: '매출처명',
        label: '매출처명',
        sortable: true
      },
      {
        field: '견적일자',
        label: '견적일자',
        align: 'center',
        sortable: true,
        render: (value) => {
          if (!value) return '-';
          return value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        }
      },
      {
        field: '제목',
        label: '제목',
        sortable: true
      },
      {
        field: '견적금액',
        label: '견적금액',
        align: 'right',
        sortable: true,
        render: (value) => {
          if (value == null) return '0';
          return Number(value).toLocaleString();
        }
      },
      {
        field: '담당자',
        label: '담당자',
        align: 'center',
        sortable: true
      },
      {
        field: '상태',
        label: '상태',
        align: 'center',
        render: (value) => {
          const status = value || '대기';
          const badgeClass = status === '확정' ? 'badge-success' : 'badge-warning';
          return `<span class="badge ${badgeClass}">${status}</span>`;
        }
      },
      {
        field: 'actions',
        label: '관리',
        align: 'center',
        sortable: false,
        render: (value, row) => {
          return `
            <div id="quotation-actions-${row.견적번호}" style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn-icon btn-view" onclick="openQuotationDetailModal('${row.견적번호}')" title="보기">상세</button>
              <button class="btn-icon btn-edit" style="display: none;" onclick="editQuotation('${row.견적번호}')" title="수정">수정</button>
              <button class="btn-icon btn-delete" style="display: none;" onclick="deleteQuotation('${row.견적번호}')" title="삭제">삭제</button>
            </div>
          `;
        }
      }
    ],

    // API 설정
    apiUrl: '/api/quotations',

    // 체크박스 설정
    enableCheckbox: true,
    checkboxSingleSelect: true,
    selectAllCheckboxId: 'selectAllQuotations',
    checkboxDataAttributes: {
      'quotation-no': '견적번호',
      'quotation-date': '견적일자'
    },

    // 페이지네이션 설정
    rowsPerPage: 10,
    enablePagination: true,
    paginationContainerId: 'quotationPagination',

    // 검색 설정
    searchInputId: 'quotationSearch',
    countDisplayId: 'quotationCount',

    // 체크박스 변경 콜백
    onCheckboxChange: (checkbox, isChecked) => {
      const quotationNo = checkbox.dataset.quotationNo;
      updateQuotationButtonVisibility(quotationNo, isChecked);
    }
  });

  // 초기 데이터 로드
  loadQuotations();
}

// ==================== 데이터 로드 ====================
async function loadQuotations() {
  const startDate = document.getElementById('quotationStartDate')?.value || '';
  const endDate = document.getElementById('quotationEndDate')?.value || '';

  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  await quotationTable.load(null, params);
}

// ==================== 버튼 표시/숨김 ====================
function updateQuotationButtonVisibility(quotationNo, isChecked) {
  const actionDiv = document.getElementById(`quotation-actions-${quotationNo}`);
  if (!actionDiv) return;

  const viewBtn = actionDiv.querySelector('.btn-view');
  const editBtn = actionDiv.querySelector('.btn-edit');
  const deleteBtn = actionDiv.querySelector('.btn-delete');

  if (isChecked) {
    if (viewBtn) viewBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'inline-block';
    if (deleteBtn) deleteBtn.style.display = 'inline-block';
  } else {
    if (viewBtn) viewBtn.style.display = 'inline-block';
    if (editBtn) editBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
  }
}

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ 견적관리 초기화 (CommonTable 사용)');

  // 모달 드래그 기능
  if (typeof makeModalDraggable === 'function') {
    makeModalDraggable('quotationModalContent', 'quotationModalHeader');
    makeModalDraggable('quotationEditModalContent', 'quotationEditModalHeader');
    makeModalDraggable('quotationDetailModalContent', 'quotationDetailModalHeader');
  }

  // 날짜 초기화
  const today = new Date().toISOString().slice(0, 10);
  const startDateInput = document.getElementById('quotationStartDate');
  const endDateInput = document.getElementById('quotationEndDate');
  if (startDateInput && !startDateInput.value) startDateInput.value = today;
  if (endDateInput && !endDateInput.value) endDateInput.value = today;

  // 조회 버튼
  const loadBtn = document.getElementById('loadQuotationsBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadQuotations);
  }

  // 배지 스타일 추가
  addBadgeStyles();

  // 테이블 초기화
  initQuotationTable();
});

// ==================== 스타일 추가 ====================
function addBadgeStyles() {
  if (document.getElementById('quotation-badge-styles')) return;

  const style = document.createElement('style');
  style.id = 'quotation-badge-styles';
  style.textContent = `
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-success {
      background: #28a745;
      color: white;
    }
    .badge-warning {
      background: #ffc107;
      color: #333;
    }
  `;
  document.head.appendChild(style);
}

// ==================== 전역 함수 노출 ====================
window.loadQuotations = loadQuotations;
window.quotationTable = quotationTable;

console.log('✅ quotation-new.js 로드 완료');
