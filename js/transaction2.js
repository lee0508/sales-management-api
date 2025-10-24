/**
 * 거래명세서 관리 프론트엔드 스크립트
 * - 목록/상세 2개 테이블 렌더링
 * - 날짜 범위 및 키워드 필터
 * - 신규 등록 모달 및 품목 라인 편집
 *
 * 실제 API 연동은 /api/transactions, /api/materials 등 백엔드 구현과 맞춰야 합니다.
 */

const transactionState = {
  initialized: false,
  filters: {
    startDate: null,
    endDate: null,
    keyword: '',
  },
  pagination: {
    page: 1,
    pageSize: 10,
    totalCount: 0,
  },
  headerList: [],
  selectedHeader: null,
  detailList: [],
};

const TRANSACTION_PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatDateToInput(date) {
  if (!date) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayRange(days = 0) {
  const end = new Date();
  const start = new Date();
  if (days > 0) {
    start.setDate(start.getDate() - days + 1);
  }
  return { start, end };
}

function setTransactionDateRange(range) {
  const startInput = document.getElementById('transactionStartDate');
  const endInput = document.getElementById('transactionEndDate');
  if (startInput && endInput) {
    startInput.value = formatDateToInput(range.start);
    endInput.value = formatDateToInput(range.end);
  }
}

async function loadTransactionPage(forceRefresh = false) {
  if (!document.getElementById('transactionPage')) return;

  if (!transactionState.initialized || forceRefresh) {
    attachTransactionEventHandlers();
    initializeTransactionFilters();
    transactionState.initialized = true;
  }

  await fetchTransactionHeaders();
}

function initializeTransactionFilters() {
  const { start, end } = getTodayRange();
  transactionState.filters.startDate = formatDateToInput(start);
  transactionState.filters.endDate = formatDateToInput(end);
  setTransactionDateRange({ start, end });

  const keywordInput = document.getElementById('transactionKeyword');
  if (keywordInput) keywordInput.value = '';
}

function attachTransactionEventHandlers() {
  const todayBtn = document.getElementById('transactionTodayBtn');
  const weekBtn = document.getElementById('transactionWeekBtn');
  const monthBtn = document.getElementById('transactionMonthBtn');
  const searchBtn = document.getElementById('transactionSearchBtn');
  const resetBtn = document.getElementById('transactionResetBtn');
  const startInput = document.getElementById('transactionStartDate');
  const endInput = document.getElementById('transactionEndDate');
  const keywordInput = document.getElementById('transactionKeyword');
  const createBtn = document.getElementById('transactionCreateBtn');

  todayBtn?.addEventListener('click', () => {
    const range = getTodayRange();
    setTransactionDateRange(range);
    updateTransactionFiltersFromInputs();
    fetchTransactionHeaders();
  });

  weekBtn?.addEventListener('click', () => {
    const range = getTodayRange(7);
    setTransactionDateRange(range);
    updateTransactionFiltersFromInputs();
    fetchTransactionHeaders();
  });

  monthBtn?.addEventListener('click', () => {
    const range = getTodayRange(30);
    setTransactionDateRange(range);
    updateTransactionFiltersFromInputs();
    fetchTransactionHeaders();
  });

  searchBtn?.addEventListener('click', () => {
    updateTransactionFiltersFromInputs();
    transactionState.pagination.page = 1;
    fetchTransactionHeaders();
  });

  resetBtn?.addEventListener('click', () => {
    initializeTransactionFilters();
    transactionState.filters.keyword = '';
    updateTransactionInputsFromState();
    transactionState.pagination.page = 1;
    fetchTransactionHeaders();
  });

  startInput?.addEventListener('change', () => {
    transactionState.filters.startDate = startInput.value;
  });

  endInput?.addEventListener('change', () => {
    transactionState.filters.endDate = endInput.value;
  });

  keywordInput?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      updateTransactionFiltersFromInputs();
      transactionState.pagination.page = 1;
      fetchTransactionHeaders();
    }
  });

  createBtn?.addEventListener('click', () => {
    openTransactionModal();
  });

  const exportBtn = document.getElementById('transactionExportBtn');
  exportBtn?.addEventListener('click', () => {
    exportTransactionList();
  });
}

function updateTransactionInputsFromState() {
  const startInput = document.getElementById('transactionStartDate');
  const endInput = document.getElementById('transactionEndDate');
  const keywordInput = document.getElementById('transactionKeyword');

  if (startInput) startInput.value = transactionState.filters.startDate || '';
  if (endInput) endInput.value = transactionState.filters.endDate || '';
  if (keywordInput) keywordInput.value = transactionState.filters.keyword || '';
}

function updateTransactionFiltersFromInputs() {
  const startInput = document.getElementById('transactionStartDate');
  const endInput = document.getElementById('transactionEndDate');
  const keywordInput = document.getElementById('transactionKeyword');

  transactionState.filters.startDate = startInput?.value || null;
  transactionState.filters.endDate = endInput?.value || null;
  transactionState.filters.keyword = keywordInput?.value?.trim() || '';
}

async function fetchTransactionHeaders() {
  const tbody = document.getElementById('transactionHeaderBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" class="loading">거래명세서를 불러오는 중입니다...</td></tr>';

  try {
    const params = {
      startDate: transactionState.filters.startDate,
      endDate: transactionState.filters.endDate,
      keyword: transactionState.filters.keyword,
      page: transactionState.pagination.page,
      pageSize: transactionState.pagination.pageSize,
      사업장코드: currentUser?.사업장코드,
    };

    const result = await apiCall('/transactions', 'GET', params);

    if (result?.success) {
      transactionState.headerList = result.data?.items || [];
      transactionState.pagination.totalCount = result.data?.totalCount || 0;
      renderTransactionHeaderTable();
      renderTransactionPagination();
      const first = transactionState.headerList[0];
      if (first) {
        selectTransactionHeader(first);
      } else {
        renderTransactionDetailTable([]);
      }
    } else {
      throw new Error(result?.message || '거래명세서 조회 실패');
    }
  } catch (error) {
    console.error('거래명세서 목록 조회 오류:', error);
    tbody.innerHTML = '<tr><td colspan="9" class="loading">거래명세서를 가져오지 못했습니다.</td></tr>';
    transactionState.headerList = [];
    transactionState.pagination.totalCount = 0;
    renderTransactionDetailTable([]);
  }
}

function renderTransactionHeaderTable() {
  const tbody = document.getElementById('transactionHeaderBody');
  if (!tbody) return;

  if (!transactionState.headerList.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="loading">검색된 거래명세서가 없습니다.</td></tr>';
    return;
  }

  const rows = transactionState.headerList
    .map((item) => {
      const isActive = transactionState.selectedHeader?.문서번호 === item.문서번호 ? ' class="active"' : '';
      return `
        <tr data-document-no="${item.문서번호 || ''}"${isActive}>
          <td>${item.거래일자 || ''}</td>
          <td>${item.문서번호 || ''}</td>
          <td>${item.거래처명 || ''}</td>
          <td>${item.거래처코드 || ''}</td>
          <td>${item.담당자 || ''}</td>
          <td class="text-right">${formatNumber(item.공급가액)}</td>
          <td class="text-right">${formatNumber(item.부가세)}</td>
          <td class="text-right">${formatNumber(item.합계금액)}</td>
          <td>${item.상태 || ''}</td>
        </tr>
      `;
    })
    .join('');

  tbody.innerHTML = rows;

  Array.from(tbody.querySelectorAll('tr')).forEach((row) => {
    row.addEventListener('click', () => {
      const docNo = row.getAttribute('data-document-no');
      const header = transactionState.headerList.find((item) => item.문서번호 === docNo);
      if (header) {
        selectTransactionHeader(header);
      }
    });
  });
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString();
}

function renderTransactionPagination() {
  const container = document.getElementById('transactionPagination');
  if (!container) return;

  const { page, pageSize, totalCount } = transactionState.pagination;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  const createBtn = (label, targetPage, disabled = false, active = false) => {
    const classes = ['page-btn'];
    if (disabled) classes.push('disabled');
    if (active) classes.push('active');
    return `<button class="${classes.join(' ')}" data-page="${targetPage}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  };

  html += createBtn('〈', Math.max(1, page - 1), page === 1);

  const windowSize = 5;
  const windowStart = Math.max(1, page - Math.floor(windowSize / 2));
  const windowEnd = Math.min(totalPages, windowStart + windowSize - 1);

  for (let p = windowStart; p <= windowEnd; p += 1) {
    html += createBtn(String(p), p, false, p === page);
  }

  html += createBtn('〉', Math.min(totalPages, page + 1), page === totalPages);

  container.innerHTML = html;

  container.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = Number(btn.getAttribute('data-page'));
      if (target && target !== transactionState.pagination.page) {
        transactionState.pagination.page = target;
        fetchTransactionHeaders();
      }
    });
  });
}

async function selectTransactionHeader(header) {
  transactionState.selectedHeader = header;
  renderTransactionHeaderTable();
  await fetchTransactionDetails(header);
}

async function fetchTransactionDetails(header) {
  const tbody = document.getElementById('transactionDetailBody');
  const title = document.getElementById('transactionDetailTitle');

  if (title) {
    title.textContent = `${header.거래일자 || ''} / ${header.거래처명 || ''} 상세내역`;
  }

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">상세 내역을 불러오는 중입니다...</td></tr>';
  }

  try {
    const result = await apiCall(`/transactions/${encodeURIComponent(header.문서번호)}`, 'GET');

    if (result?.success) {
      transactionState.detailList = result.data?.items || [];
      renderTransactionDetailTable(transactionState.detailList);
    } else {
      throw new Error(result?.message || '상세 조회 실패');
    }
  } catch (error) {
    console.error('거래명세서 상세 조회 오류:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading">상세 정보를 가져오지 못했습니다.</td></tr>';
    }
  }
}

function renderTransactionDetailTable(list) {
  const tbody = document.getElementById('transactionDetailBody');
  if (!tbody) return;

  if (!list || !list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">표시할 상세 내역이 없습니다.</td></tr>';
    document.getElementById('transactionDetailCount')?.textContent = '0';
    document.getElementById('transactionDetailQuantity')?.textContent = '0';
    return;
  }

  let totalQty = 0;
  const rows = list
    .map((item) => {
      const qty = Number(item.수량) || 0;
      totalQty += qty;
      return `
        <tr>
          <td>${item.자재분류 || ''}</td>
          <td>${item.자재명 || ''}</td>
          <td>${item.규격 || ''}</td>
          <td>${item.단위 || ''}</td>
          <td class="text-right">${formatNumber(item.자재시세)}</td>
          <td class="text-right">${formatNumber(item.수량)}</td>
          <td class="text-right">${formatNumber(item.단가)}</td>
          <td class="text-right">${formatNumber(item.공급가액)}</td>
          <td>${item.입출내역 || ''}</td>
          <td>${item.비고 || ''}</td>
        </tr>
      `;
    })
    .join('');

  tbody.innerHTML = rows;
  document.getElementById('transactionDetailCount')?.textContent = String(list.length);
  document.getElementById('transactionDetailQuantity')?.textContent = formatNumber(totalQty);
}

function openTransactionModal() {
  const modal = document.getElementById('transactionModal');
  if (!modal) return;

  const title = document.getElementById('transactionModalTitle');
  if (title) title.textContent = '거래명세서 등록';

  const form = document.getElementById('transactionForm');
  form?.reset();
  transactionItemManager.reset();

  modal.style.display = 'flex';
}

function closeTransactionModal() {
  const modal = document.getElementById('transactionModal');
  if (modal) modal.style.display = 'none';
}

const transactionItemManager = {
  tableBody: null,
  init() {
    this.tableBody = document.getElementById('transactionItemBody');
    const addBtn = document.getElementById('transactionAddItemBtn');
    addBtn?.addEventListener('click', () => this.addRow());
    this.reset();
  },
  reset() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="10" class="loading">품목을 추가해 주세요.</td>
      </tr>
    `;
    updateTransactionModalSummary();
  },
  addRow(item = {}) {
    if (!this.tableBody) return;
    if (this.tableBody.querySelector('.empty-row')) {
      this.tableBody.innerHTML = '';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="text" name="itemCategory" value="${item.자재분류 || ''}" /></td>
      <td><input type="text" name="itemName" value="${item.자재명 || ''}" /></td>
      <td><input type="text" name="itemSpec" value="${item.규격 || ''}" /></td>
      <td><input type="text" name="itemUnit" value="${item.단위 || ''}" /></td>
      <td><input type="number" name="itemMarketPrice" value="${item.자재시세 || ''}" step="0.01" /></td>
      <td><input type="number" name="itemQty" value="${item.수량 || ''}" step="0.01" min="0" /></td>
      <td><input type="number" name="itemPrice" value="${item.단가 || ''}" step="0.01" min="0" /></td>
      <td><input type="number" name="itemSupply" value="${item.공급가액 || ''}" step="0.01" min="0" /></td>
      <td><input type="text" name="itemHistory" value="${item.입출내역 || ''}" /></td>
      <td><button type="button" class="btn btn-icon" aria-label="삭제">×</button></td>
    `;

    row.querySelector('button')?.addEventListener('click', () => {
      row.remove();
      if (!this.tableBody.querySelector('tr')) {
        this.reset();
      }
      updateTransactionModalSummary();
    });

    this.tableBody.appendChild(row);

    Array.from(row.querySelectorAll('input[type="number"]')).forEach((input) => {
      input.addEventListener('input', () => updateTransactionModalSummary());
    });

    updateTransactionModalSummary();
  },
  collectItems() {
    if (!this.tableBody) return [];
    const rows = Array.from(this.tableBody.querySelectorAll('tr'));
    return rows
      .filter((row) => !row.classList.contains('empty-row'))
      .map((row) => {
        const get = (selector) => row.querySelector(selector)?.value?.trim() || '';
        return {
          자재분류: get('input[name="itemCategory"]'),
          자재명: get('input[name="itemName"]'),
          규격: get('input[name="itemSpec"]'),
          단위: get('input[name="itemUnit"]'),
          자재시세: get('input[name="itemMarketPrice"]'),
          수량: get('input[name="itemQty"]'),
          단가: get('input[name="itemPrice"]'),
          공급가액: get('input[name="itemSupply"]'),
          입출내역: get('input[name="itemHistory"]'),
        };
      });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('transactionPage')) {
    transactionItemManager.init();
  }

  const form = document.getElementById('transactionForm');
  form?.addEventListener('submit', handleTransactionSubmit);

  document.getElementById('transactionModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'transactionModal') {
      closeTransactionModal();
    }
  });
});

function updateTransactionModalSummary() {
  const items = transactionItemManager.collectItems();
  const totalCount = items.length;
  const totalQty = items.reduce((sum, item) => sum + (Number(item.수량) || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.공급가액) || 0), 0);

  document.getElementById('transactionModalItemCount')?.textContent = String(totalCount);
  document.getElementById('transactionModalTotalQty')?.textContent = formatNumber(totalQty);
  document.getElementById('transactionModalTotalAmount')?.textContent = formatNumber(totalAmount);
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  const form = event.target;

  const items = transactionItemManager.collectItems();
  if (!items.length) {
    alert('자재 내역을 한 건 이상 입력해 주세요.');
    return;
  }

  const payload = {
    거래일자: form.transactionDate.value,
    문서번호: form.transactionDocumentNo.value.trim() || null,
    거래처코드: form.transactionCustomerCode.value.trim(),
    거래처명: form.transactionCustomerName.value.trim(),
    담당자: form.transactionSalesUser.value.trim() || null,
    비고: form.transactionMemo.value.trim() || null,
    품목: items,
    사업장코드: currentUser?.사업장코드,
    작성자: currentUser?.사용자코드,
  };

  try {
    const result = await apiCall('/transactions', 'POST', payload);
    if (result?.success) {
      alert('거래명세서가 저장되었습니다.');
      closeTransactionModal();
      fetchTransactionHeaders();
    } else {
      throw new Error(result?.message || '저장 실패');
    }
  } catch (error) {
    console.error('거래명세서 저장 오류:', error);
    alert(`거래명세서를 저장하지 못했습니다.\n${error.message}`);
  }
}

function exportTransactionList() {
  if (!transactionState.headerList.length) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const rows = transactionState.headerList.map((item) => [
    item.거래일자,
    item.문서번호,
    item.거래처명,
    item.거래처코드,
    item.담당자,
    item.공급가액,
    item.부가세,
    item.합계금액,
    item.상태,
  ]);

  const header = ['거래일자', '문서번호', '거래처명', '거래처코드', '담당자', '공급가액', '부가세', '합계금액', '상태'];
  const csv = [header, ...rows]
    .map((cols) => cols.map((col) => `"${(col ?? '').toString().replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transaction_${formatDateToInput(new Date()).replace(/-/g, '')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

window.loadTransactionPage = loadTransactionPage;
window.openTransactionModal = openTransactionModal;
window.closeTransactionModal = closeTransactionModal;
window.transactionItemManager = transactionItemManager;
