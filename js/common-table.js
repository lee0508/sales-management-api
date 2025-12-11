/**
 * 공통 테이블 라이브러리 - 재사용 가능한 순수 JavaScript 테이블
 * DataTables.js를 대체하는 경량 테이블 컴포넌트
 *
 * 사용 사례:
 * 1. 메인 목록 테이블: 체크박스, 페이지네이션, 정렬, 검색
 * 2. 모달 상세 테이블: 읽기 전용
 * 3. 모달 편집 테이블: 행 추가/수정/삭제
 */

class CommonTable {
  constructor(tableId, options = {}) {
    this.tableId = tableId;
    this.table = document.getElementById(tableId);

    if (!this.table) {
      console.error(`❌ 테이블을 찾을 수 없습니다: ${tableId}`);
      return;
    }

    // 기본 옵션
    this.options = {
      // 테이블 모드
      mode: 'list', // 'list' | 'detail' | 'edit'

      // 컬럼 정의
      columns: [],

      // 데이터 소스
      apiUrl: null, // API URL
      apiParams: {}, // API 파라미터
      data: null, // 직접 데이터 제공 (API 대신)

      // 페이지네이션
      rowsPerPage: 10,
      enablePagination: true,
      paginationContainerId: null,

      // 체크박스 (list 모드)
      enableCheckbox: false,
      checkboxSingleSelect: true,
      selectAllCheckboxId: null,
      checkboxDataAttributes: {},
      onCheckboxChange: null,

      // ✅ [추가] 행 체크박스에 사용할 class 이름 (기본값: row-checkbox)
      checkboxClass: 'row-checkbox',

      // 정렬
      enableSort: true,

      // 검색
      searchInputId: null,
      countDisplayId: null,

      // 편집 모드 (edit 모드)
      enableEdit: false, // 편집 활성화
      enableRowActions: false, // 행 액션 버튼 (수정/삭제)
      onRowEdit: null, // 행 수정 콜백
      onRowDelete: null, // 행 삭제 콜백
      onRowAdd: null, // 행 추가 콜백

      // 콜백
      onRowRender: null,
      onDataChange: null, // 데이터 변경 시 콜백

      // 메시지
      noDataMessage: '데이터가 없습니다.',

      ...options,
    };

    // 내부 상태
    this.data = [];
    this.filteredData = [];
    this.currentPage = 1;
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.searchKeyword = '';
    this.isSelectAllMode = false;

    this.init();
  }

  // ==================== 초기화 ====================
  init() {
    this.setupTableHeader();
    this.setupPaginationContainer();
    this.attachHeaderEvents();
    this.addStyles();

    if (this.options.searchInputId) {
      this.attachSearchEvent();
    }

    // 초기 데이터가 제공된 경우
    if (this.options.data) {
      this.setData(this.options.data);
    }

    console.log(`✅ CommonTable 초기화: ${this.tableId} (${this.options.mode} 모드)`);
  }

  // ==================== 테이블 헤더 설정 ====================
  setupTableHeader() {
    const thead = this.table.querySelector('thead tr');
    if (!thead || this.options.columns.length === 0) return;

    const headers = thead.querySelectorAll('th');
    headers.forEach((th, index) => {
      const column = this.options.columns[index];
      if (column && column.sortable !== false && this.options.enableSort) {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.title = '클릭하여 정렬';
      }
    });
  }

  setupPaginationContainer() {
    if (!this.options.enablePagination) return;

    let containerId = this.options.paginationContainerId;
    if (!containerId) {
      containerId = `${this.tableId}-pagination`;
      this.options.paginationContainerId = containerId;
    }

    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 10px;';

      // 좌측: 데이터 정보
      const infoDiv = document.createElement('div');
      infoDiv.id = `${containerId}-info`;
      infoDiv.style.cssText = 'color: #6b7280; font-size: 14px;';
      container.appendChild(infoDiv);

      // 우측: 페이지네이션 버튼
      const buttonsDiv = document.createElement('div');
      buttonsDiv.id = `${containerId}-buttons`;
      buttonsDiv.style.cssText = 'display: flex; gap: 5px;';
      container.appendChild(buttonsDiv);

      if (this.table.nextSibling) {
        this.table.parentElement.insertBefore(container, this.table.nextSibling);
      } else {
        this.table.parentElement.appendChild(container);
      }
    }
  }

  // ==================== 이벤트 ====================
  attachHeaderEvents() {
    if (!this.options.enableSort) return;

    const headers = this.table.querySelectorAll('thead th');
    headers.forEach((th, index) => {
      const column = this.options.columns[index];
      if (column && column.sortable !== false) {
        th.addEventListener('click', () => this.toggleSort(column.field));
      }
    });
  }

  attachSearchEvent() {
    const searchInput = document.getElementById(this.options.searchInputId);
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value.trim();
      this.applyFilters();
      this.render();
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.applyFilters();
        this.render();
      }
    });
  }

  // ==================== 데이터 로드 ====================
  async load(apiUrl = null, params = {}) {
    try {
      const url = apiUrl || this.options.apiUrl;
      if (!url) {
        console.error('❌ API URL이 지정되지 않았습니다.');
        return;
      }

      const queryParams = { ...this.options.apiParams, ...params };
      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl = queryString ? `${url}?${queryString}` : url;

      console.log(`📡 데이터 로드: ${fullUrl}`);

      const response = await fetch(fullUrl);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '데이터 로드 실패');
      }

      this.setData(result.data || []);
      console.log(`✅ ${this.data.length}건 로드 완료`);
    } catch (err) {
      console.error('❌ 데이터 로드 오류:', err);
      alert(`데이터를 불러오는데 실패했습니다: ${err.message}`);
      this.setData([]);
    }
  }

  setData(data) {
    this.data = Array.isArray(data) ? data : [];
    this.applyFilters();
    this.render();

    if (this.options.onDataChange) {
      this.options.onDataChange(this.data);
    }
  }

  // ==================== 필터링 ====================
  applyFilters() {
    this.filteredData = this.data.filter((item) => {
      if (!this.searchKeyword) return true;

      const keyword = this.searchKeyword.toLowerCase();
      return this.options.columns.some((column) => {
        if (!column.field || column.searchable === false) return false;
        const value = item[column.field];
        return value && String(value).toLowerCase().includes(keyword);
      });
    });

    if (this.sortColumn) {
      this.applySorting();
    }

    this.currentPage = 1;
  }

  // ==================== 정렬 ====================
  toggleSort(field) {
    if (this.sortColumn === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = field;
      this.sortDirection = 'asc';
    }

    this.applySorting();
    this.render();
  }

  applySorting() {
    if (!this.sortColumn) return;

    this.filteredData.sort((a, b) => {
      let aVal = a[this.sortColumn];
      let bVal = b[this.sortColumn];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      aVal = String(aVal);
      bVal = String(bVal);

      return this.sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }

  // ==================== 렌더링 ====================
  render() {
    const tbody = this.table.querySelector('tbody');
    if (!tbody) return;

    const totalItems = this.filteredData.length;
    const totalPages = Math.ceil(totalItems / this.options.rowsPerPage);
    const startIndex = (this.currentPage - 1) * this.options.rowsPerPage;
    const endIndex = Math.min(startIndex + this.options.rowsPerPage, totalItems);
    const pageData = this.filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
      const colSpan = this.getColumnCount();
      tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 40px;">${this.options.noDataMessage}</td></tr>`;
    } else {
      tbody.innerHTML = pageData
        .map((row, index) => this.renderRow(row, startIndex + index, totalItems))
        .join('');
    }

    // 개수 표시
    if (this.options.countDisplayId) {
      const countElement = document.getElementById(this.options.countDisplayId);
      if (countElement) {
        countElement.textContent = totalItems.toLocaleString();
      }
    }

    // 페이지네이션
    if (this.options.enablePagination) {
      this.renderPagination(totalPages);
    }

    // 체크박스 이벤트
    if (this.options.enableCheckbox) {
      this.attachCheckboxEvents();
    }

    // 편집 모드 이벤트
    if (this.options.mode === 'edit' && this.options.enableRowActions) {
      this.attachEditEvents();
    }

    // 콜백
    if (this.options.onRowRender) {
      this.options.onRowRender(pageData);
    }
  }

  renderRow(row, index, totalItems) {
    const rowNumber = totalItems - index;
    let html = '<tr';

    // 행 데이터 속성
    if (this.options.rowDataAttributes) {
      Object.keys(this.options.rowDataAttributes).forEach((attr) => {
        const field = this.options.rowDataAttributes[attr];
        html += ` data-${attr}="${row[field] || ''}"`;
      });
    }

    html += '>';

    // 체크박스 컬럼
    if (this.options.enableCheckbox) {
      const checkboxAttrs = this.options.checkboxDataAttributes || {};

      // ✅ [변경] checkboxClass 옵션 사용 (기본값은 row-checkbox)
      const checkboxClass = this.options.checkboxClass || 'row-checkbox';

      let checkboxHtml = `<input type="checkbox" class="${checkboxClass}"`;

      Object.keys(checkboxAttrs).forEach((attr) => {
        const field = checkboxAttrs[attr];
        checkboxHtml += ` data-${attr}="${row[field] || ''}"`;
      });

      checkboxHtml += '>';
      html += `<td style="text-align: center;">${checkboxHtml}</td>`;
    }

    // 데이터 컬럼
    this.options.columns.forEach((column) => {
      let value = row[column.field];

      if (column.render && typeof column.render === 'function') {
        value = column.render(value, row, index);
      } else if (value == null) {
        value = column.defaultValue || '-';
      }

      const align = column.align || 'left';
      const width = column.width ? `width: ${column.width};` : '';
      const whiteSpace =
        column.width && column.width !== 'auto'
          ? 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
          : '';
      html += `<td style="text-align: ${align}; ${width} ${whiteSpace}">${value}</td>`;
    });

    // 편집 액션 컬럼
    if (this.options.mode === 'edit' && this.options.enableRowActions) {
      html += `<td style="text-align: center;">
        <button class="btn-icon btn-row-edit" data-index="${index}" title="수정">수정</button>
        <button class="btn-icon btn-row-delete" data-index="${index}" title="삭제">삭제</button>
      </td>`;
    }

    html += '</tr>';
    return html;
  }

  getColumnCount() {
    let count = this.options.columns.length;
    if (this.options.enableCheckbox) count++;
    if (this.options.mode === 'edit' && this.options.enableRowActions) count++;
    return count;
  }

  // ==================== 페이지네이션 ====================
  renderPagination(totalPages) {
    const containerId = this.options.paginationContainerId;
    const infoDiv = document.getElementById(`${containerId}-info`);
    const buttonsDiv = document.getElementById(`${containerId}-buttons`);

    if (!infoDiv || !buttonsDiv) return;

    // 데이터 정보 표시 (좌측)
    const totalItems = this.filteredData.length;

    if (totalItems === 0) {
      infoDiv.innerHTML = `전체 <strong>0</strong>건`;
      buttonsDiv.innerHTML = '';
      return;
    }

    const startIndex = (this.currentPage - 1) * this.options.rowsPerPage + 1;
    const endIndex = Math.min(this.currentPage * this.options.rowsPerPage, totalItems);

    infoDiv.innerHTML = `전체 <strong>${totalItems.toLocaleString()}</strong>건 중 <strong>${startIndex.toLocaleString()}</strong>-<strong>${endIndex.toLocaleString()}</strong>건 표시`;

    // 페이지네이션 버튼 (우측)
    if (totalPages <= 1) {
      buttonsDiv.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${
      this.currentPage === 1 ? 'disabled' : ''
    } data-page="${this.currentPage - 1}">이전</button>`;

    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="pagination-btn ${
        i === this.currentPage ? 'active' : ''
      }" data-page="${i}">${i}</button>`;
    }

    html += `<button class="pagination-btn" ${
      this.currentPage === totalPages ? 'disabled' : ''
    } data-page="${this.currentPage + 1}">다음</button>`;

    buttonsDiv.innerHTML = html;

    buttonsDiv.querySelectorAll('.pagination-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        if (page) this.goToPage(page);
      });
    });
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredData.length / this.options.rowsPerPage);
    if (page < 1 || page > totalPages) return;

    this.currentPage = page;
    this.render();
  }

  // ==================== 체크박스 ====================
  attachCheckboxEvents() {
    // ✅ [추가] 행 체크박스 class 이름을 옵션에서 가져옴
    // const checkboxClass = this.options.checkboxClass || 'row-checkbox';
    // const checkboxSelector = `.${checkboxClass}`;

    const checkboxClass = this.options.checkboxClass || 'row-checkbox';
    const checkboxSelector = `.${checkboxClass}`;

    const selectAllId = this.options.selectAllCheckboxId;
    if (selectAllId) {
      const selectAll = document.getElementById(selectAllId);
      if (selectAll) {
        const newSelectAll = selectAll.cloneNode(true);
        selectAll.parentNode.replaceChild(newSelectAll, selectAll);

        newSelectAll.addEventListener('change', (e) => {
          console.log('✅ 전체 선택 체크박스 클릭:', e.target.checked);
          this.isSelectAllMode = true;

          // ✅ [변경] .row-checkbox → checkboxSelector
          const checkboxes = this.table.querySelectorAll(checkboxSelector);
          console.log('📋 체크박스 개수:', checkboxes.length);

          checkboxes.forEach((cb) => {
            cb.checked = e.target.checked;
            this.handleCheckboxChange(cb);
          });

          this.isSelectAllMode = false;
        });
      }
    }

    // ✅ [변경] 개별 체크박스도 동일한 selector 사용
    const checkboxes = this.table.querySelectorAll(checkboxSelector);
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleCheckboxChange(checkbox));
    });
  }

  handleCheckboxChange(checkbox) {
    const isChecked = checkbox.checked;

    // ✅ [추가] 공통 selector 정의
    const checkboxClass = this.options.checkboxClass || 'row-checkbox';
    const checkboxSelector = `.${checkboxClass}`;

    // 단일 선택 모드: 전체 선택 모드가 아니고, 체크박스가 선택된 경우에만 다른 체크박스 해제

    if (this.options.checkboxSingleSelect && !this.isSelectAllMode && isChecked) {
      this.table.querySelectorAll(checkboxSelector).forEach((cb) => {
        if (cb !== checkbox) {
          cb.checked = false;
          if (this.options.onCheckboxChange) {
            this.options.onCheckboxChange(cb, false);
          }
        }
      });
    }

    if (this.options.onCheckboxChange) {
      this.options.onCheckboxChange(checkbox, isChecked);
    }

    this.syncSelectAllCheckbox();
  }

  syncSelectAllCheckbox() {
    const selectAllId = this.options.selectAllCheckboxId;
    if (!selectAllId) return;

    const selectAll = document.getElementById(selectAllId);
    if (!selectAll) return;

    const checkboxClass = this.options.checkboxClass || 'row-checkbox';
    const checkboxSelector = `.${checkboxClass}`;
    const checkedSelector = `${checkboxSelector}:checked`;

    const checkboxes = this.table.querySelectorAll(checkboxSelector);
    const checkedCheckboxes = this.table.querySelectorAll(checkedSelector);

    selectAll.checked = checkboxes.length > 0 && checkboxes.length === checkedCheckboxes.length;
  }

  // ==================== 편집 모드 ====================
  attachEditEvents() {
    // 수정 버튼
    this.table.querySelectorAll('.btn-row-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.editRow(index);
      });
    });

    // 삭제 버튼
    this.table.querySelectorAll('.btn-row-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.deleteRow(index);
      });
    });
  }

  editRow(index) {
    const row = this.filteredData[index];
    if (this.options.onRowEdit) {
      this.options.onRowEdit(row, index);
    }
  }

  deleteRow(index) {
    if (this.options.onRowDelete) {
      this.options.onRowDelete(this.filteredData[index], index);
    } else {
      // 기본 동작: 데이터에서 제거
      if (confirm('이 행을 삭제하시겠습니까?')) {
        this.filteredData.splice(index, 1);
        this.data = this.filteredData; // 원본 데이터도 업데이트
        this.render();

        if (this.options.onDataChange) {
          this.options.onDataChange(this.data);
        }
      }
    }
  }

  addRow(rowData) {
    this.data.push(rowData);
    this.applyFilters();
    this.render();

    if (this.options.onDataChange) {
      this.options.onDataChange(this.data);
    }
  }

  updateRow(index, rowData) {
    if (index >= 0 && index < this.filteredData.length) {
      Object.assign(this.filteredData[index], rowData);
      this.render();

      if (this.options.onDataChange) {
        this.options.onDataChange(this.data);
      }
    }
  }

  // ==================== 유틸리티 ====================
  reload() {
    return this.load();
  }

  refresh() {
    this.render();
  }

  getData() {
    return this.data;
  }

  getFilteredData() {
    return this.filteredData;
  }

  clear() {
    this.setData([]);
  }

  destroy() {
    // options가 없으면 안전하게 종료
    if (!this.options) {
      console.warn('⚠️ destroy 호출: options가 없습니다');
      return;
    }

    // 페이지네이션 컨테이너 제거
    if (this.options.paginationContainerId) {
      const paginationContainer = document.getElementById(this.options.paginationContainerId);
      if (paginationContainer) {
        paginationContainer.remove();
      }
    }

    // 테이블 본문 초기화
    if (this.table) {
      const tbody = this.table.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = '';
      }
    }
  }

  // ==================== 스타일 ====================
  addStyles() {
    if (document.getElementById('common-table-styles')) return;

    const style = document.createElement('style');
    style.id = 'common-table-styles';
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
    `;
    document.head.appendChild(style);
  }
}

// ==================== 전역 노출 ====================
window.CommonTable = CommonTable;

console.log('✅ CommonTable 라이브러리 로드 완료');
