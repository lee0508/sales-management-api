/**
 * 견적관리 - 순수 JavaScript 구현 (DataTables 제거)
 * DataTables.js 없이 모든 기능을 순수 JS로 구현
 */

// ==================== 전역 변수 ====================
let quotationsData = []; // 전체 견적 데이터
let filteredData = []; // 필터링된 데이터
let currentPage = 1; // 현재 페이지
let itemsPerPage = 10; // 페이지당 항목 수
let sortColumn = null; // 정렬 컬럼
let sortDirection = 'asc'; // 정렬 방향
let isSelectAllMode = false; // 전체선택 모드 플래그
let searchKeyword = ''; // 검색 키워드

// ==================== 전역 함수 정의 ====================
// 견적서용 매출처 선택 함수
window.selectQuotationCustomer = function selectQuotationCustomer(customer) {
  try {
    const codeInput = document.getElementById('selectedCustomerCode');
    const nameInput = document.getElementById('selectedCustomerName');

    if (!codeInput || !nameInput) {
      console.error('❌ 입력 필드를 찾을 수 없습니다!');
      alert('입력 필드를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
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

// 매출처 검색 모달 닫기
window.closeCustomerSearchModal = function closeCustomerSearchModal() {
  const modal = document.getElementById('customerSearchModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// ==================== 데이터 로드 ====================
async function loadQuotations() {
  try {
    console.log('📄 견적 데이터 로드 시작...');

    const startDate = document.getElementById('quotationStartDate')?.value || '';
    const endDate = document.getElementById('quotationEndDate')?.value || '';

    let url = '/api/quotations';
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '데이터 로드 실패');
    }

    quotationsData = result.data || [];
    applyFilters();
    renderTable();

    console.log(`✅ 견적 ${quotationsData.length}건 로드 완료`);
  } catch (err) {
    console.error('❌ 견적 로드 오류:', err);
    alert('견적 목록을 불러오는데 실패했습니다: ' + err.message);
    quotationsData = [];
    filteredData = [];
    renderTable();
  }
}

// ==================== 필터링 ====================
function applyFilters() {
  filteredData = quotationsData.filter((item) => {
    if (!searchKeyword) return true;

    const keyword = searchKeyword.toLowerCase();
    return (
      (item.견적번호 && String(item.견적번호).toLowerCase().includes(keyword)) ||
      (item.매출처명 && item.매출처명.toLowerCase().includes(keyword)) ||
      (item.제목 && item.제목.toLowerCase().includes(keyword)) ||
      (item.담당자 && item.담당자.toLowerCase().includes(keyword))
    );
  });

  // 정렬 적용
  if (sortColumn) {
    applySorting();
  }

  currentPage = 1; // 필터 변경 시 첫 페이지로
}

// ==================== 정렬 ====================
function applySorting() {
  if (!sortColumn) return;

  filteredData.sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    // null/undefined 처리
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';

    // 숫자 비교
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // 문자열 비교
    aVal = String(aVal);
    bVal = String(bVal);

    if (sortDirection === 'asc') {
      return aVal.localeCompare(bVal);
    } else {
      return bVal.localeCompare(aVal);
    }
  });
}

function toggleSort(column) {
  if (sortColumn === column) {
    // 같은 컬럼 클릭 시 방향 전환
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }

  applySorting();
  renderTable();
}

// ==================== 테이블 렌더링 ====================
function renderTable() {
  const tbody = document.getElementById('quotationTableBody');
  if (!tbody) return;

  // 페이지네이션 계산
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageData = filteredData.slice(startIndex, endIndex);

  // 테이블 본문 렌더링
  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">데이터가 없습니다.</td></tr>';
  } else {
    tbody.innerHTML = pageData
      .map((row, index) => {
        const rowNumber = totalItems - (startIndex + index);
        const 견적일자 = row.견적일자 ? row.견적일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-';
        const 견적금액 = row.견적금액 ? Number(row.견적금액).toLocaleString() : '0';

        return `
          <tr data-quotation-no="${row.견적번호}">
            <td style="text-align: center;">
              <input type="checkbox" class="quotationCheckbox"
                data-quotation-no="${row.견적번호}"
                data-quotation-date="${row.견적일자}">
            </td>
            <td style="text-align: center;">${rowNumber}</td>
            <td style="text-align: center;">${row.견적번호 || '-'}</td>
            <td>${row.매출처명 || '-'}</td>
            <td style="text-align: center;">${견적일자}</td>
            <td>${row.제목 || '-'}</td>
            <td style="text-align: right;">${견적금액}</td>
            <td style="text-align: center;">${row.담당자 || '-'}</td>
            <td style="text-align: center;">
              <span class="badge ${row.상태 === '확정' ? 'badge-success' : 'badge-warning'}">
                ${row.상태 || '대기'}
              </span>
            </td>
            <td style="text-align: center;">
              <div id="quotation-actions-${row.견적번호}" style="display: flex; gap: 4px; justify-content: center;">
                <button class="btn-icon btn-view" onclick="openQuotationDetailModal('${row.견적번호}')" title="보기">상세</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editQuotation('${row.견적번호}')" title="수정">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="deleteQuotation('${row.견적번호}')" title="삭제">삭제</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // 개수 업데이트
  const countElement = document.getElementById('quotationCount');
  if (countElement) {
    countElement.textContent = totalItems.toLocaleString();
  }

  // 페이지네이션 렌더링
  renderPagination(totalPages);

  // 체크박스 이벤트 재등록
  attachCheckboxEvents();

  // 전체선택 체크박스 상태 동기화
  syncSelectAllCheckbox();
}

// ==================== 페이지네이션 ====================
function renderPagination(totalPages) {
  const paginationContainer = document.getElementById('quotationPagination');
  if (!paginationContainer) {
    // 페이지네이션 컨테이너가 없으면 생성
    const table = document.getElementById('quotationTable');
    if (table && table.parentElement) {
      const container = document.createElement('div');
      container.id = 'quotationPagination';
      container.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding: 10px;';
      table.parentElement.appendChild(container);
      return renderPagination(totalPages);
    }
    return;
  }

  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  let html = '';

  // 이전 버튼
  html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">이전</button>`;

  // 페이지 번호
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  // 다음 버튼
  html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">다음</button>`;

  paginationContainer.innerHTML = html;
}

window.goToPage = function (page) {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  renderTable();
};

// ==================== 체크박스 관리 ====================
function attachCheckboxEvents() {
  // 전체선택 체크박스
  const selectAllCheckbox = document.getElementById('selectAllQuotations');
  if (selectAllCheckbox) {
    selectAllCheckbox.replaceWith(selectAllCheckbox.cloneNode(true)); // 기존 이벤트 제거
    document.getElementById('selectAllQuotations').addEventListener('change', function () {
      const isChecked = this.checked;
      console.log('📄 [견적관리] 전체선택:', isChecked);

      isSelectAllMode = true;
      document.querySelectorAll('.quotationCheckbox').forEach((cb) => {
        cb.checked = isChecked;
        handleCheckboxChange(cb);
      });
      isSelectAllMode = false;
    });
  }

  // 개별 체크박스
  document.querySelectorAll('.quotationCheckbox').forEach((checkbox) => {
    checkbox.addEventListener('change', function () {
      handleCheckboxChange(this);
    });
  });
}

function handleCheckboxChange(checkbox) {
  const quotationNo = checkbox.dataset.quotationNo;
  const isChecked = checkbox.checked;

  console.log(`📄 [견적관리] 체크박스 ${quotationNo}: ${isChecked ? '선택' : '해제'}`);

  // 개별 선택 모드: 다른 체크박스 해제
  if (!isSelectAllMode && isChecked) {
    document.querySelectorAll('.quotationCheckbox').forEach((cb) => {
      if (cb !== checkbox) {
        cb.checked = false;
        updateButtonVisibility(cb.dataset.quotationNo, false);
      }
    });
  }

  // 현재 체크박스의 버튼 표시/숨김
  updateButtonVisibility(quotationNo, isChecked);

  // 전체선택 체크박스 상태 동기화
  syncSelectAllCheckbox();
}

function updateButtonVisibility(quotationNo, isChecked) {
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

function syncSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('selectAllQuotations');
  if (!selectAllCheckbox) return;

  const checkboxes = document.querySelectorAll('.quotationCheckbox');
  const checkedCheckboxes = document.querySelectorAll('.quotationCheckbox:checked');

  selectAllCheckbox.checked = checkboxes.length > 0 && checkboxes.length === checkedCheckboxes.length;
}

// ==================== 검색 ====================
function handleSearch() {
  const searchInput = document.getElementById('quotationSearch');
  if (searchInput) {
    searchKeyword = searchInput.value.trim();
    applyFilters();
    renderTable();
  }
}

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function () {
  console.log('✅ 견적관리 순수 JavaScript 초기화');

  // 모달 드래그 기능 (기존 함수 사용)
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

  // 검색 버튼
  const searchBtn = document.getElementById('searchQuotationsBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
  }

  // 검색 입력 엔터키
  const searchInput = document.getElementById('quotationSearch');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }

  // 조회 버튼
  const loadBtn = document.getElementById('loadQuotationsBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadQuotations);
  }

  // 테이블 헤더 정렬 클릭
  const headers = document.querySelectorAll('#quotationTable thead th');
  headers.forEach((header, index) => {
    const columnMap = ['', '', '견적번호', '매출처명', '견적일자', '제목', '견적금액', '담당자', '상태', ''];
    const column = columnMap[index];
    if (column) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => toggleSort(column));
    }
  });

  // 스타일 추가
  addPaginationStyles();

  // 초기 데이터 로드
  loadQuotations();
});

// ==================== 스타일 추가 ====================
function addPaginationStyles() {
  if (document.getElementById('quotation-pagination-styles')) return;

  const style = document.createElement('style');
  style.id = 'quotation-pagination-styles';
  style.textContent = `
    .pagination-btn {
      padding: 8px 12px;
      margin: 0 2px;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;
      border-radius: 4px;
      font-size: 14px;
      transition: all 0.2s;
    }
    .pagination-btn:hover:not([disabled]) {
      background: #f0f0f0;
      border-color: #999;
    }
    .pagination-btn.active {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    .pagination-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
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
window.handleSearch = handleSearch;

console.log('✅ quotation-vanilla.js 로드 완료');
