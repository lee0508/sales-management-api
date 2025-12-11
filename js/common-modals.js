/**
 * 공통 모달 라이브러리
 * 견적관리, 거래명세서관리, 발주관리, 매입전표관리에서 공통으로 사용하는 모달들
 *
 * 포함된 모달:
 * 1. MaterialSearchModal - 자재 검색 모달
 * 2. CustomerSearchModal - 매출처 검색 모달
 * 3. SupplierSearchModal - 매입처 검색 모달
 * 4. PreviousPriceModal - 이전단가 조회 모달
 */

// ==================== 1. 자재 검색 모달 ====================
class MaterialSearchModal {
  constructor(options = {}) {
    this.options = {
      modalId: 'materialSearchModal',
      tableId: 'materialSearchTable',
      searchInputId: 'materialSearchInput',
      onSelect: null,
      onClose: null,
      ...options
    };

    this.table = null;
    this.selectedMaterial = null;
    this.init();
  }

  init() {
    console.log('✅ MaterialSearchModal 초기화');

    // 모달 HTML이 없으면 생성
    if (!document.getElementById(this.options.modalId)) {
      this.createModalHTML();
    }

    // 테이블 초기화
    this.table = new CommonTable(this.options.tableId, {
      mode: 'list',
      columns: [
        {
          field: 'rowNumber',
          label: '순번',
          align: 'center',
          render: (v, r, i) => i + 1
        },
        {
          field: '자재코드',
          label: '코드',
          align: 'center',
          render: (value) => value && value.length > 2 ? value.substring(2) : value || '-'
        },
        { field: '자재명', label: '자재명' },
        { field: '규격', label: '규격' },
        { field: '단위', label: '단위', align: 'center' },
        {
          field: 'actions',
          label: '관리',
          align: 'center',
          sortable: false,
          render: (value, row) => {
            const 자재코드 = row.자재코드 || '';
            const 자재명 = (row.자재명 || '').replace(/'/g, "\\'");
            const 규격 = (row.규격 || '').replace(/'/g, "\\'");
            const 단위 = (row.단위 || '').replace(/'/g, "\\'");

            return `
              <button class="btn-icon" style="background: #10b981; color: white; padding: 4px 8px;"
                onclick="window.currentMaterialSearchModal.selectMaterial({
                  자재코드: '${자재코드}',
                  자재명: '${자재명}',
                  규격: '${규격}',
                  단위: '${단위}'
                })">선택</button>
              <button class="btn-icon" style="background: #3b82f6; color: white; padding: 4px 8px;"
                onclick="window.currentMaterialSearchModal.showPreviousPrice('${자재코드}')">이전단가</button>
            `;
          }
        }
      ],
      apiUrl: '/api/materials',
      enablePagination: true,
      rowsPerPage: 10,
      searchInputId: this.options.searchInputId,
      noDataMessage: '자재가 없습니다.'
    });
  }

  async open() {
    console.log('📂 자재 검색 모달 열기');

    // 전역 참조 설정 (HTML onclick에서 접근하기 위해)
    window.currentMaterialSearchModal = this;

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'flex';

      // 데이터 로드
      await this.table.load();

      // 드래그 기능 활성화
      if (typeof makeModalDraggable === 'function' && !this._draggableInitialized) {
        const contentId = this.options.modalId + 'Content';
        const headerId = this.options.modalId + 'Header';
        makeModalDraggable(contentId, headerId);
        this._draggableInitialized = true;
      }
    }
  }

  createModalHTML() {
    const modalHTML = `
      <div id="${this.options.modalId}" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div id="${this.options.modalId}Content" class="modal-content" style="background: white; padding: 24px; border-radius: 8px; max-width: 900px; width: 90%; max-height: 80vh; overflow: auto; position: relative;">
          <div id="${this.options.modalId}Header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move;">
            <h3 style="margin: 0; font-size: 20px; font-weight: 600;">자재 검색</h3>
            <button onclick="window.currentMaterialSearchModal?.close()" style="background: #f0f0f0; border: none; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">×</button>
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <input type="text" id="${this.options.searchInputId}" placeholder="자재명 또는 코드 검색" style="flex: 1; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;" />
            <button onclick="window.currentMaterialSearchModal?.table?.applyFilters()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; white-space: nowrap;">검색</button>
          </div>
          <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
            <table id="${this.options.tableId}" style="width: 100%; border-collapse: collapse;"></table>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  close() {
    console.log('📂 자재 검색 모달 닫기');

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'none';
    }

    this.selectedMaterial = null;

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  selectMaterial(material) {
    console.log('✅ 자재 선택:', material);

    this.selectedMaterial = material;

    if (this.options.onSelect) {
      this.options.onSelect(material);
    }

    this.close();
  }

  showPreviousPrice(materialCode) {
    console.log('💰 이전단가 조회:', materialCode);

    // 이전단가 모달 열기
    if (window.currentPreviousPriceModal) {
      const customerCode = this.options.currentCustomerCode || '';
      window.currentPreviousPriceModal.open(materialCode, customerCode);
    } else {
      alert('이전단가 모달을 찾을 수 없습니다.');
    }
  }

  getSelectedMaterial() {
    return this.selectedMaterial;
  }
}

// ==================== 2. 매출처 검색 모달 ====================
class CustomerSearchModal {
  constructor(options = {}) {
    this.options = {
      modalId: 'customerSearchModal',
      tableId: 'customerSearchTable',
      searchInputId: 'customerSearchInput',
      onSelect: null,
      onClose: null,
      ...options
    };

    this.table = null;
    this.selectedCustomer = null;
    this.init();
  }

  init() {
    console.log('✅ CustomerSearchModal 초기화');

    // 모달 HTML이 없으면 생성
    if (!document.getElementById(this.options.modalId)) {
      this.createModalHTML();
    }

    this.table = new CommonTable(this.options.tableId, {
      mode: 'list',
      columns: [
        {
          field: 'rowNumber',
          label: '순번',
          align: 'center',
          render: (v, r, i) => i + 1
        },
        { field: '매출처코드', label: '코드', align: 'center' },
        { field: '매출처명', label: '매출처명' },
        { field: '대표자', label: '대표자' },
        { field: '전화번호', label: '전화번호' },
        {
          field: 'actions',
          label: '선택',
          align: 'center',
          sortable: false,
          render: (value, row) => {
            const 매출처코드 = row.매출처코드 || '';
            const 매출처명 = (row.매출처명 || '').replace(/'/g, "\\'");
            const 대표자 = (row.대표자 || '').replace(/'/g, "\\'");

            return `
              <button class="btn-icon" style="background: #10b981; color: white; padding: 4px 8px;"
                onclick="window.currentCustomerSearchModal.selectCustomer({
                  매출처코드: '${매출처코드}',
                  매출처명: '${매출처명}',
                  대표자: '${대표자}'
                })">선택</button>
            `;
          }
        }
      ],
      apiUrl: '/api/customers',
      enablePagination: true,
      rowsPerPage: 10,
      searchInputId: this.options.searchInputId,
      noDataMessage: '매출처가 없습니다.'
    });
  }

  async open() {
    console.log('📂 매출처 검색 모달 열기');

    window.currentCustomerSearchModal = this;

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'flex';
      await this.table.load();

      if (typeof makeModalDraggable === 'function' && !this._draggableInitialized) {
        const contentId = this.options.modalId + 'Content';
        const headerId = this.options.modalId + 'Header';
        makeModalDraggable(contentId, headerId);
        this._draggableInitialized = true;
      }
    }
  }

  createModalHTML() {
    const modalHTML = `
      <div id="${this.options.modalId}" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div id="${this.options.modalId}Content" class="modal-content" style="background: white; padding: 24px; border-radius: 8px; max-width: 900px; width: 90%; max-height: 80vh; overflow: auto; position: relative;">
          <div id="${this.options.modalId}Header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move;">
            <h3 style="margin: 0; font-size: 20px; font-weight: 600;">매출처 검색</h3>
            <button onclick="window.currentCustomerSearchModal?.close()" style="background: #f0f0f0; border: none; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">×</button>
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <input type="text" id="${this.options.searchInputId}" placeholder="매출처명 또는 코드 검색" style="flex: 1; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;" />
            <button onclick="window.currentCustomerSearchModal?.table?.applyFilters()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; white-space: nowrap;">검색</button>
          </div>
          <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
            <table id="${this.options.tableId}" style="width: 100%; border-collapse: collapse;"></table>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  close() {
    console.log('📂 매출처 검색 모달 닫기');

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'none';
    }

    this.selectedCustomer = null;

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  selectCustomer(customer) {
    console.log('✅ 매출처 선택:', customer);

    this.selectedCustomer = customer;

    if (this.options.onSelect) {
      this.options.onSelect(customer);
    }

    this.close();
  }

  getSelectedCustomer() {
    return this.selectedCustomer;
  }
}

// ==================== 3. 매입처 검색 모달 ====================
class SupplierSearchModal {
  constructor(options = {}) {
    this.options = {
      modalId: 'supplierSearchModal',
      tableId: 'supplierSearchTable',
      searchInputId: 'supplierSearchInput',
      onSelect: null,
      onClose: null,
      ...options
    };

    this.table = null;
    this.selectedSupplier = null;
    this.init();
  }

  init() {
    console.log('✅ SupplierSearchModal 초기화');

    // 모달 HTML이 없으면 생성
    if (!document.getElementById(this.options.modalId)) {
      this.createModalHTML();
    }

    this.table = new CommonTable(this.options.tableId, {
      mode: 'list',
      columns: [
        {
          field: 'rowNumber',
          label: '순번',
          align: 'center',
          render: (v, r, i) => i + 1
        },
        { field: '매입처코드', label: '코드', align: 'center' },
        { field: '매입처명', label: '매입처명' },
        { field: '대표자', label: '대표자' },
        { field: '전화번호', label: '전화번호' },
        {
          field: 'actions',
          label: '선택',
          align: 'center',
          sortable: false,
          render: (value, row) => {
            const 매입처코드 = row.매입처코드 || '';
            const 매입처명 = (row.매입처명 || '').replace(/'/g, "\\'");
            const 대표자 = (row.대표자 || '').replace(/'/g, "\\'");

            return `
              <button class="btn-icon" style="background: #10b981; color: white; padding: 4px 8px;"
                onclick="window.currentSupplierSearchModal.selectSupplier({
                  매입처코드: '${매입처코드}',
                  매입처명: '${매입처명}',
                  대표자: '${대표자}'
                })">선택</button>
            `;
          }
        }
      ],
      apiUrl: '/api/suppliers',
      enablePagination: true,
      rowsPerPage: 10,
      searchInputId: this.options.searchInputId,
      noDataMessage: '매입처가 없습니다.'
    });
  }

  async open() {
    console.log('📂 매입처 검색 모달 열기');

    window.currentSupplierSearchModal = this;

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'flex';
      await this.table.load();

      if (typeof makeModalDraggable === 'function' && !this._draggableInitialized) {
        const contentId = this.options.modalId + 'Content';
        const headerId = this.options.modalId + 'Header';
        makeModalDraggable(contentId, headerId);
        this._draggableInitialized = true;
      }
    }
  }

  createModalHTML() {
    const modalHTML = `
      <div id="${this.options.modalId}" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div id="${this.options.modalId}Content" class="modal-content" style="background: white; padding: 24px; border-radius: 8px; max-width: 900px; width: 90%; max-height: 80vh; overflow: auto; position: relative;">
          <div id="${this.options.modalId}Header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move;">
            <h3 style="margin: 0; font-size: 20px; font-weight: 600;">매입처 검색</h3>
            <button onclick="window.currentSupplierSearchModal?.close()" style="background: #f0f0f0; border: none; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">×</button>
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <input type="text" id="${this.options.searchInputId}" placeholder="매입처명 또는 코드 검색" style="flex: 1; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;" />
            <button onclick="window.currentSupplierSearchModal?.table?.applyFilters()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; white-space: nowrap;">검색</button>
          </div>
          <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
            <table id="${this.options.tableId}" style="width: 100%; border-collapse: collapse;"></table>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  close() {
    console.log('📂 매입처 검색 모달 닫기');

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'none';
    }

    this.selectedSupplier = null;

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  selectSupplier(supplier) {
    console.log('✅ 매입처 선택:', supplier);

    this.selectedSupplier = supplier;

    if (this.options.onSelect) {
      this.options.onSelect(supplier);
    }

    this.close();
  }

  getSelectedSupplier() {
    return this.selectedSupplier;
  }
}

// ==================== 4. 이전단가 조회 모달 ====================
class PreviousPriceModal {
  constructor(options = {}) {
    this.options = {
      modalId: 'previousPriceModal',
      tableId: 'previousPriceTable',
      onSelect: null,
      onClose: null,
      ...options
    };

    this.table = null;
    this.currentMaterialCode = null;
    this.currentCustomerCode = null;
  }

  initTable() {
    if (this.table) {
      this.table.destroy();
    }

    this.table = new CommonTable(this.options.tableId, {
      mode: 'detail',
      columns: [
        {
          field: 'rowNumber',
          label: '순번',
          align: 'center',
          render: (v, r, i) => i + 1
        },
        {
          field: '거래일자',
          label: '거래일자',
          align: 'center',
          render: (value) => value ? value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'
        },
        { field: '매출처명', label: '매출처' },
        {
          field: '단가',
          label: '단가',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '수량',
          label: '수량',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: '금액',
          label: '금액',
          align: 'right',
          render: (value) => value != null ? Number(value).toLocaleString() : '0'
        },
        {
          field: 'actions',
          label: '선택',
          align: 'center',
          sortable: false,
          render: (value, row) => {
            const 단가 = row.단가 || 0;
            return `
              <button class="btn-icon" style="background: #10b981; color: white; padding: 4px 8px;"
                onclick="window.currentPreviousPriceModal.selectPrice(${단가})">적용</button>
            `;
          }
        }
      ],
      enablePagination: true,
      rowsPerPage: 5,
      noDataMessage: '이전 거래내역이 없습니다.'
    });
  }

  async open(materialCode, customerCode = '') {
    console.log('💰 이전단가 조회 모달 열기:', materialCode, customerCode);

    window.currentPreviousPriceModal = this;

    this.currentMaterialCode = materialCode;
    this.currentCustomerCode = customerCode;

    // 모달 HTML이 없으면 생성
    if (!document.getElementById(this.options.modalId)) {
      this.createModalHTML();
    }

    // 테이블 초기화
    this.initTable();

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'flex';

      // 이전단가 데이터 로드
      const params = {};
      if (customerCode) params.customer = customerCode;

      await this.table.load(`/api/materials/${materialCode}/previous-prices`, params);

      if (typeof makeModalDraggable === 'function' && !this._draggableInitialized) {
        const contentId = this.options.modalId + 'Content';
        const headerId = this.options.modalId + 'Header';
        makeModalDraggable(contentId, headerId);
        this._draggableInitialized = true;
      }
    }
  }

  createModalHTML() {
    const modalHTML = `
      <div id="${this.options.modalId}" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div id="${this.options.modalId}Content" class="modal-content" style="background: white; padding: 24px; border-radius: 8px; max-width: 800px; width: 90%; max-height: 70vh; overflow: auto; position: relative;">
          <div id="${this.options.modalId}Header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move;">
            <h3 style="margin: 0">이전 단가 조회</h3>
            <button onclick="window.currentPreviousPriceModal?.close()" style="background: #f0f0f0; border: none; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">×</button>
          </div>
          <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
            <table id="${this.options.tableId}" style="width: 100%; border-collapse: collapse;"></table>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  close() {
    console.log('💰 이전단가 조회 모달 닫기');

    const modal = document.getElementById(this.options.modalId);
    if (modal) {
      modal.style.display = 'none';
    }

    if (this.table) {
      this.table.destroy();
      this.table = null;
    }

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  selectPrice(price) {
    console.log('✅ 단가 선택:', price);

    if (this.options.onSelect) {
      this.options.onSelect(price);
    }

    this.close();
  }
}

// ==================== 전역 노출 ====================
window.MaterialSearchModal = MaterialSearchModal;
window.CustomerSearchModal = CustomerSearchModal;
window.SupplierSearchModal = SupplierSearchModal;
window.PreviousPriceModal = PreviousPriceModal;

console.log('✅ common-modals.js 로드 완료');
