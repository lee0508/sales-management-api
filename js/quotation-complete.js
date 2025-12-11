/**
 * 견적관리 - 순수 JavaScript 완전 구현
 * CommonTable 라이브러리 사용
 * DataTables 완전 제거
 */

// ==================== 전역 변수: 테이블 인스턴스 ====================
let quotationListTable = null;          // 메인 견적 목록
let quotationDetailTable = null;        // 상세보기 모달 내부 테이블
let quotationEditTable = null;          // 수정 모달 내부 테이블
let quotationNewTable = null;           // 신규작성 모달 내부 테이블
let customerSearchTable = null;         // 매출처 검색 모달
let materialSearchTable = null;         // 자재 검색 모달 (수정용)
let newMaterialSearchTable = null;      // 자재 검색 모달 (신규용)
let priceHistoryTable = null;           // 이전단가 모달

// ==================== 전역 변수: 현재 편집 중인 데이터 ====================
let currentEditingQuotation = null;     // 현재 수정 중인 견적
let selectedMaterial = null;            // 선택된 자재
let selectedCustomer = null;            // 선택된 매출처

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

    selectedCustomer = customer;
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

// ==================== 1. 메인 견적 목록 테이블 ====================
function initQuotationListTable() {
  console.log('✅ 견적 목록 테이블 초기화');

  quotationListTable = new CommonTable('quotationTable', {
    mode: 'list',
    columns: [
      {
        field: 'rowNumber',
        label: '순번',
        align: 'center',
        render: (value, row, index) => {
          const totalItems = quotationListTable.getFilteredData().length;
          const startIndex = (quotationListTable.currentPage - 1) * quotationListTable.options.rowsPerPage;
          return totalItems - (startIndex + index);
        }
      },
      { field: '견적번호', label: '견적번호', align: 'center', sortable: true },
      { field: '매출처명', label: '매출처명', sortable: true },
      {
        field: '견적일자',
        label: '견적일자',
        align: 'center',
        sortable: true,
        render: (value) => value ? value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'
      },
      { field: '제목', label: '제목', sortable: true },
      {
        field: '견적금액',
        label: '견적금액',
        align: 'right',
        sortable: true,
        render: (value) => value != null ? Number(value).toLocaleString() : '0'
      },
      { field: '담당자', label: '담당자', align: 'center', sortable: true },
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
        render: (value, row) => `
          <div id="quotation-actions-${row.견적번호}" style="display: flex; gap: 4px; justify-content: center;">
            <button class="btn-icon btn-view" onclick="openQuotationDetailModal('${row.견적일자}', '${row.견적번호}')" title="보기">상세</button>
            <button class="btn-icon btn-edit" style="display: none;" onclick="editQuotation('${row.견적일자}', '${row.견적번호}')" title="수정">수정</button>
            <button class="btn-icon btn-delete" style="display: none;" onclick="deleteQuotation('${row.견적일자}', '${row.견적번호}')" title="삭제">삭제</button>
          </div>
        `
      }
    ],
    apiUrl: '/api/quotations',
    enableCheckbox: true,
    checkboxSingleSelect: true,
    selectAllCheckboxId: 'selectAllQuotations',
    checkboxDataAttributes: {
      'quotation-no': '견적번호',
      'quotation-date': '견적일자'
    },
    rowsPerPage: 10,
    enablePagination: true,
    searchInputId: 'quotationSearch',
    countDisplayId: 'quotationCount',
    onCheckboxChange: (checkbox, isChecked) => {
      const quotationNo = checkbox.dataset.quotationNo;
      updateQuotationButtonVisibility(quotationNo, isChecked);
    }
  });

  loadQuotations();
}

async function loadQuotations() {
  const startDate = document.getElementById('quotationStartDate')?.value || '';
  const endDate = document.getElementById('quotationEndDate')?.value || '';

  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  await quotationListTable.load(null, params);
}

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

// ==================== 2. 상세보기 모달 ====================
async function openQuotationDetailModal(quotationDate, quotationNo) {
  try {
    console.log(`📄 견적 상세보기: ${quotationDate}-${quotationNo}`);

    const response = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('견적 정보를 찾을 수 없습니다.');
    }

    const details = result.data || [];
    if (details.length === 0) {
      throw new Error('견적 내역이 없습니다.');
    }

    const firstDetail = details[0];

    // 기본 정보 표시
    document.getElementById('detailQuotationNo').textContent = quotationNo || '-';
    document.getElementById('detailQuotationDate').textContent =
      quotationDate ? quotationDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-';
    document.getElementById('detailCustomer').textContent = firstDetail.매출처명 || '-';
    document.getElementById('detailTitle').textContent = firstDetail.제목 || '-';
    document.getElementById('detailRemark').textContent = firstDetail.적요 || '-';

    // 견적내역 테이블 초기화
    if (quotationDetailTable) {
      quotationDetailTable.destroy();
    }

    quotationDetailTable = new CommonTable('quotationDetailTable', {
      mode: 'detail',
      columns: [
        {
          field: 'rowNumber',
          label: '순번',
          align: 'center',
          render: (v, r, i) => i + 1
        },
        {
          field: '자재코드',
          label: '품목코드',
          render: (value) => value && value.length > 2 ? value.substring(2) : value || '-'
        },
        { field: '자재명', label: '품명' },
        { field: '규격', label: '규격' },
        {
          field: '수량',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '단가',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '공급가액',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '부가세',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '합계금액',
          label: '합계',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        }
      ],
      data: details,
      enablePagination: true,
      rowsPerPage: 10
    });

    // 합계 계산
    calculateQuotationDetailTotal(details);

    // 모달 표시
    const modal = document.getElementById('quotationDetailModal');
    modal.style.display = 'flex';

    // 드래그 기능
    if (typeof makeModalDraggable === 'function' && !window.quotationDetailModalDraggable) {
      makeModalDraggable('quotationDetailModalContent', 'quotationDetailModalHeader');
      window.quotationDetailModalDraggable = true;
    }

  } catch (err) {
    console.error('❌ 견적 상세보기 오류:', err);
    alert('견적 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

function closeQuotationDetailModal() {
  const modal = document.getElementById('quotationDetailModal');
  if (modal) modal.style.display = 'none';

  if (quotationDetailTable) {
    quotationDetailTable.destroy();
    quotationDetailTable = null;
  }
}

function calculateQuotationDetailTotal(details) {
  const totals = details.reduce((acc, item) => {
    acc.공급가액 += Number(item.공급가액 || 0);
    acc.부가세 += Number(item.부가세 || 0);
    acc.합계금액 += Number(item.합계금액 || 0);
    return acc;
  }, { 공급가액: 0, 부가세: 0, 합계금액: 0 });

  document.getElementById('detailTotalSupply').textContent = totals.공급가액.toLocaleString();
  document.getElementById('detailTotalVat').textContent = totals.부가세.toLocaleString();
  document.getElementById('detailGrandTotal').textContent = totals.합계금액.toLocaleString();
}

// ==================== 3. 수정 모달 ====================
async function editQuotation(quotationDate, quotationNo) {
  try {
    console.log(`✏️ 견적 수정: ${quotationDate}-${quotationNo}`);

    const response = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('견적 정보를 찾을 수 없습니다.');
    }

    const details = result.data || [];
    const firstDetail = details[0] || {};

    // 기본 정보 표시
    document.getElementById('editQuotationNo').textContent = quotationNo || '-';
    document.getElementById('editQuotationDate').textContent =
      quotationDate ? quotationDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-';
    document.getElementById('editCustomer').textContent = firstDetail.매출처명 || '-';

    // 현재 편집 중인 견적 저장
    currentEditingQuotation = {
      견적일자: quotationDate,
      견적번호: quotationNo,
      매출처코드: firstDetail.매출처코드,
      details: details
    };

    // 견적내역 편집 테이블 초기화
    if (quotationEditTable) {
      quotationEditTable.destroy();
    }

    quotationEditTable = new CommonTable('quotationEditDetailTable', {
      mode: 'edit',
      columns: [
        {
          field: 'rowNumber',
          label: '순번',
          align: 'center',
          render: (v, r, i) => i + 1
        },
        {
          field: '자재코드',
          label: '품목코드',
          render: (value) => value && value.length > 2 ? value.substring(2) : value || '-'
        },
        { field: '자재명', label: '품명' },
        { field: '규격', label: '규격' },
        {
          field: '수량',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '단가',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '공급가액',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '부가세',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '합계금액',
          label: '합계',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        }
      ],
      data: details,
      enablePagination: true,
      rowsPerPage: 10,
      enableRowActions: true,
      onRowEdit: (row, index) => {
        editQuotationDetailRow(index);
      },
      onRowDelete: (row, index) => {
        deleteQuotationDetailRow(index);
      }
    });

    // 합계 계산
    updateQuotationEditTotal();

    // 모달 표시
    const modal = document.getElementById('quotationEditModal');
    modal.style.display = 'flex';

    // 드래그 기능
    if (typeof makeModalDraggable === 'function' && !window.quotationEditModalDraggable) {
      makeModalDraggable('quotationEditModalContent', 'quotationEditModalHeader');
      window.quotationEditModalDraggable = true;
    }

  } catch (err) {
    console.error('❌ 견적 수정 오류:', err);
    alert('견적 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

function closeQuotationEditModal() {
  const modal = document.getElementById('quotationEditModal');
  if (modal) modal.style.display = 'none';

  if (quotationEditTable) {
    quotationEditTable.destroy();
    quotationEditTable = null;
  }

  currentEditingQuotation = null;
}

function editQuotationDetailRow(index) {
  // TODO: 행 수정 모달 열기
  console.log('편집할 행:', index);
  alert('행 편집 기능은 추가 개발이 필요합니다.');
}

function deleteQuotationDetailRow(index) {
  if (confirm('이 항목을 삭제하시겠습니까?')) {
    const currentData = quotationEditTable.getData();
    currentData.splice(index, 1);
    quotationEditTable.setData(currentData);
    updateQuotationEditTotal();
  }
}

function updateQuotationEditTotal() {
  const details = quotationEditTable ? quotationEditTable.getData() : [];
  const totals = details.reduce((acc, item) => {
    acc.공급가액 += Number(item.공급가액 || 0);
    acc.부가세 += Number(item.부가세 || 0);
    acc.합계금액 += Number(item.합계금액 || 0);
    return acc;
  }, { 공급가액: 0, 부가세: 0, 합계금액: 0 });

  const totalSupply = document.getElementById('editTotalSupply');
  const totalVat = document.getElementById('editTotalVat');
  const grandTotal = document.getElementById('editGrandTotal');

  if (totalSupply) totalSupply.textContent = totals.공급가액.toLocaleString();
  if (totalVat) totalVat.textContent = totals.부가세.toLocaleString();
  if (grandTotal) grandTotal.textContent = totals.합계금액.toLocaleString();
}

async function submitQuotationEdit() {
  try {
    if (!currentEditingQuotation) {
      alert('수정할 견적 정보가 없습니다.');
      return;
    }

    const { 견적일자, 견적번호 } = currentEditingQuotation;
    const details = quotationEditTable.getData();

    if (details.length === 0) {
      alert('최소 1개 이상의 품목이 필요합니다.');
      return;
    }

    const response = await fetch(`/api/quotations/${견적일자}/${견적번호}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ details })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '견적 수정 실패');
    }

    alert('견적이 수정되었습니다.');
    closeQuotationEditModal();
    loadQuotations();

  } catch (err) {
    console.error('❌ 견적 수정 제출 오류:', err);
    alert('견적 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ==================== 4. 삭제 ====================
function deleteQuotation(quotationDate, quotationNo) {
  if (!confirm(`견적번호 ${quotationNo}을(를) 삭제하시겠습니까?`)) {
    return;
  }

  fetch(`/api/quotations/${quotationDate}/${quotationNo}`, {
    method: 'DELETE'
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert('견적이 삭제되었습니다.');
      loadQuotations();
    } else {
      throw new Error(result.message || '삭제 실패');
    }
  })
  .catch(err => {
    console.error('❌ 견적 삭제 오류:', err);
    alert('견적 삭제 중 오류가 발생했습니다: ' + err.message);
  });
}

// ==================== 5. 신규작성 모달 (간략 버전) ====================
function openNewQuotationModal() {
  const modal = document.getElementById('quotationModal');
  if (modal) {
    modal.style.display = 'flex';

    // 드래그 기능
    if (typeof makeModalDraggable === 'function' && !window.quotationModalDraggable) {
      makeModalDraggable('quotationModalContent', 'quotationModalHeader');
      window.quotationModalDraggable = true;
    }
  }
}

function closeQuotationModal() {
  const modal = document.getElementById('quotationModal');
  if (modal) modal.style.display = 'none';
}

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ 견적관리 초기화 (CommonTable 사용)');

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

  // 신규작성 버튼
  const newBtn = document.getElementById('openNewQuotationBtn');
  if (newBtn) {
    newBtn.addEventListener('click', openNewQuotationModal);
  }

  // 배지 스타일 추가
  addBadgeStyles();

  // 메인 테이블 초기화
  initQuotationListTable();
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
window.openQuotationDetailModal = openQuotationDetailModal;
window.closeQuotationDetailModal = closeQuotationDetailModal;
window.editQuotation = editQuotation;
window.closeQuotationEditModal = closeQuotationEditModal;
window.submitQuotationEdit = submitQuotationEdit;
window.deleteQuotation = deleteQuotation;
window.openNewQuotationModal = openNewQuotationModal;
window.closeQuotationModal = closeQuotationModal;

console.log('✅ quotation-complete.js 로드 완료');
