// ✅ [REPLACE] js/customer.js — 전체 교체
// 주석: DataTables 공통 초기화(initDataTable) 사용 + 서버 응답 스키마 호환 + 상대경로 사용
$(document).ready(function () {
  let table;
  let currentSearchKeyword = ''; // 현재 검색 키워드 저장
  let currentCustomerCode = ''; // 현재 선택된 매출처코드
  let currentCustomerName = ''; // 현재 선택된 매출처명
  let transactionHistoryTable = null; // 거래내역 DataTable 인스턴스

  function loadCustomers(searchKeyword = '') {
    // 기존 인스턴스가 있으면 파괴 후 재생성
    if (table) table.destroy();

    // API URL에 검색 파라미터 추가 (pageSize=10000으로 전체 데이터 조회)
    let apiUrl = API_BASE_URL + '/customers?pageSize=10000';
    if (searchKeyword) {
      apiUrl += `&search=${encodeURIComponent(searchKeyword)}`;
    }

    // ✅ 공통 초기화 함수 사용 (dataTableInit.js) — server.js의 {data:[...]} 스키마와 호환
    table = initDataTable('customerTable', apiUrl, [
      {
        // 선택 체크박스
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return '<input type="checkbox" class="customerRowCheck" data-code="' + row.매출처코드 + '" />';
        },
      },
      {
        // 순번
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row, meta) {
          return meta.row + 1;
        },
      },
      { data: '매출처코드' },
      { data: '매출처명' },
      {
        // 대표자
        data: '대표자명',
        defaultContent: '-'
      },
      {
        // 사업자번호
        data: '사업자번호',
        defaultContent: '-'
      },
      {
        // 연락처
        data: '전화번호',
        defaultContent: '-'
      },
      {
        // 거래상태
        data: '사용구분',
        className: 'text-center',
        render: function (data, type, row) {
          if (data === 0) {
            return '<span class="status-badge status-active">정상거래</span>';
          } else {
            return '<span class="status-badge status-pending">거래보류</span>';
          }
        },
      },
      {
        // 등록일
        data: '수정일자',
        className: 'text-center',
        defaultContent: '-',
        render: function (data, type, row) {
          if (data && data.length === 8) {
            return data.substring(0, 4) + '-' + data.substring(4, 6) + '-' + data.substring(6, 8);
          }
          return data || '-';
        },
      },
      {
        // 관리 버튼
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return `
            <div class="action-buttons" id="customerActions-${row.매출처코드}">
              <button class="btn-icon customerBtnView" onclick="viewCustomerDetail('${row.매출처코드}')">상세</button>
              <button class="btn-icon customerBtnEdit" style="display: none;" onclick="editCustomer('${row.매출처코드}')">수정</button>
              <button class="btn-icon customerBtnDelete" style="display: none;" onclick="deleteCustomer('${row.매출처코드}')">삭제</button>
            </div>
          `;
        },
      },
    ]);

    // ✅ DataTable이 다시 그려질 때마다 전체선택 상태 동기화
    table.on('draw', function() {
      const isSelectAllChecked = $('#customerSelectAll').prop('checked');

      // 전체선택 상태에 따라 현재 페이지의 모든 체크박스 동기화
      $('.customerRowCheck').prop('checked', isSelectAllChecked);

      // 각 체크박스 상태에 따라 버튼 표시/숨김 처리
      $('.customerRowCheck').each(function() {
        const customerCode = $(this).data('code');
        const isChecked = $(this).prop('checked');
        const actionDiv = $('#customerActions-' + customerCode);

        if (isChecked) {
          actionDiv.find('.customerBtnView').hide();
          actionDiv.find('.customerBtnEdit').show();
          actionDiv.find('.customerBtnDelete').show();
        } else {
          actionDiv.find('.customerBtnView').show();
          actionDiv.find('.customerBtnEdit').hide();
          actionDiv.find('.customerBtnDelete').hide();
        }
      });
    });
  }

  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadCustomers = loadCustomers;

  // 새로고침 버튼 (현재 HTML에 없음 - 필요시 추가)
  // $('#customerBtnReload').on('click', () => table.ajax.reload(null, false));

  // 전체 선택 체크박스 (이벤트 네임스페이스 적용)
  $(document)
    .off('change.customerPage', '#customerSelectAll')
    .on('change.customerPage', '#customerSelectAll', function () {
      const isChecked = $(this).prop('checked');
      $('.customerRowCheck').prop('checked', isChecked).trigger('change');
    });

  // 개별 체크박스 변경 시 (이벤트 네임스페이스 적용)
  $(document)
    .off('change.customerPage', '.customerRowCheck')
    .on('change.customerPage', '.customerRowCheck', function () {
      // 전체 선택 체크박스 상태 업데이트
      const totalCheckboxes = $('.customerRowCheck').length;
      const checkedCheckboxes = $('.customerRowCheck:checked').length;
      $('#customerSelectAll').prop('checked', totalCheckboxes === checkedCheckboxes);

      // 현재 행의 버튼 표시/숨김 처리
      const customerCode = $(this).data('code');
      const isChecked = $(this).prop('checked');
      const actionDiv = $('#customerActions-' + customerCode);

      if (isChecked) {
        // 체크됨: 상세 버튼 숨기고 수정/삭제 버튼 표시
        actionDiv.find('.customerBtnView').hide();
        actionDiv.find('.customerBtnEdit').show();
        actionDiv.find('.customerBtnDelete').show();
      } else {
        // 체크 해제: 수정/삭제 버튼 숨기고 상세 버튼 표시
        actionDiv.find('.customerBtnView').show();
        actionDiv.find('.customerBtnEdit').hide();
        actionDiv.find('.customerBtnDelete').hide();
      }
    });

  // Enter 키 이벤트 처리 (이벤트 네임스페이스 적용)
  $('#customerSearchInput')
    .off('keypress.customerPage')
    .on('keypress.customerPage', function (e) {
      if (e.which === 13) { // Enter key
        e.preventDefault();
        searchCustomers();
      }
    });

  // 검색 함수를 전역으로 노출
  window.searchCustomers = function () {
    const keyword = $('#customerSearchInput').val().trim();
    console.log('🔍 매출처 검색:', keyword);
    currentSearchKeyword = keyword;
    loadCustomers(keyword);
  };

  // 검색 초기화 함수를 전역으로 노출
  window.resetCustomerSearch = function () {
    console.log('🔄 매출처 검색 초기화');
    $('#customerSearchInput').val('');
    currentSearchKeyword = '';
    loadCustomers('');
  };

  // ==================== 매출처 상세보기/수정/삭제 기능 ====================

  // 매출처 상세보기
  window.viewCustomerDetail = async function (customerCode) {
    try {
      const result = await apiCall(`/customers/${customerCode}`);

      if (!result.success) {
        alert('매출처 정보를 불러올 수 없습니다.');
        return;
      }

      const data = result.data;

      // 현재 매출처 정보 저장
      currentCustomerCode = customerCode;
      currentCustomerName = data.매출처명;

      // 상세 정보 HTML 생성
      const detailHtml = `
        <div style="grid-column: 1 / -1; padding: 12px; background: #f8f9fa; border-radius: 8px;">
          <strong>매출처코드:</strong> ${data.매출처코드}
        </div>
        <div style="padding: 12px;">
          <strong>매출처명</strong><br/>
          ${data.매출처명 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>대표자명</strong><br/>
          ${data.대표자명 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>사업자번호</strong><br/>
          ${data.사업자번호 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>법인번호</strong><br/>
          ${data.법인번호 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>전화번호</strong><br/>
          ${data.전화번호 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>팩스번호</strong><br/>
          ${data.팩스번호 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>업태</strong><br/>
          ${data.업태 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>업종</strong><br/>
          ${data.업종 || '-'}
        </div>
        <div style="grid-column: 1 / -1; padding: 12px;">
          <strong>주소</strong><br/>
          ${data.주소 || ''} ${data.번지 || ''}
        </div>
        <div style="padding: 12px;">
          <strong>은행</strong><br/>
          ${data.은행코드 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>계좌번호</strong><br/>
          ${data.계좌번호 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>담당자명</strong><br/>
          ${data.담당자명 || '-'}
        </div>
        <div style="padding: 12px;">
          <strong>거래상태</strong><br/>
          <span class="status-badge ${data.사용구분 === 0 ? 'status-active' : 'status-pending'}">
            ${data.사용구분 === 0 ? '정상거래' : '거래보류'}
          </span>
        </div>
        <div style="grid-column: 1 / -1; padding: 12px;">
          <strong>비고</strong><br/>
          ${data.비고란 || '-'}
        </div>
      `;

      document.getElementById('customerDetailContent').innerHTML = detailHtml;
      document.getElementById('customerDetailModal').style.display = 'flex';

      // 모달 드래그 기능 적용
      makeModalDraggable('customerDetailModal', 'customerDetailModalHeader');
    } catch (error) {
      console.error('매출처 상세 조회 오류:', error);
      alert('매출처 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 매출처 상세보기 모달 닫기
  window.closeCustomerDetailModal = function () {
    document.getElementById('customerDetailModal').style.display = 'none';
  };

  // 매출처 수정
  window.editCustomer = async function (customerCode) {
    try {
      // 1. 매출처 상세 정보 조회
      const result = await apiCall(`/customers/${customerCode}`);

      if (!result.success) {
        alert('매출처 정보를 불러올 수 없습니다.');
        return;
      }

      const data = result.data;

      // 2. 모달 열기 (신규/수정 공용 모달)
      const modal = document.getElementById('customerModal');
      if (!modal) {
        console.error('매출처 모달을 찾을 수 없습니다.');
        return;
      }

      // 3. 모달 제목 변경
      const modalTitle = modal.querySelector('h2');
      if (modalTitle) {
        modalTitle.textContent = '매출처 수정';
      }

      // 4. 폼 필드에 데이터 채우기
      document.getElementById('customerCode').value = data.매출처코드;
      document.getElementById('customerCode').readOnly = true; // 수정 시에는 코드 변경 불가
      document.getElementById('customerName').value = data.매출처명 || '';
      document.getElementById('ceoName').value = data.대표자명 || '';
      document.getElementById('businessNo').value = data.사업자번호 || '';
      document.getElementById('businessType').value = data.업태 || '';
      document.getElementById('businessCategory').value = data.업종 || '';
      document.getElementById('phone').value = data.전화번호 || '';
      document.getElementById('fax').value = data.팩스번호 || '';
      document.getElementById('zipCode').value = data.우편번호 || '';
      document.getElementById('address').value = data.주소 || '';
      document.getElementById('addressDetail').value = data.번지 || '';
      document.getElementById('bankCode').value = data.은행코드 || '';
      document.getElementById('accountNo').value = data.계좌번호 || '';
      document.getElementById('managerName').value = data.담당자명 || '';
      document.getElementById('status').value = data.사용구분 || 0;
      document.getElementById('remark').value = data.비고란 || '';

      // 5. 폼에 수정 모드 표시를 위한 데이터 속성 추가
      const form = document.getElementById('customerForm');
      form.dataset.mode = 'edit';
      form.dataset.code = customerCode;

      // 6. 모달 표시
      modal.style.display = 'flex';

      // 7. 모달 드래그 기능 적용
      makeModalDraggable('customerModal', 'customerModalHeader');
    } catch (error) {
      console.error('매출처 수정 준비 오류:', error);
      alert('매출처 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 매출처 등록/수정 폼 제출
  window.submitCustomer = async function (event) {
    event.preventDefault();

    try {
      const form = document.getElementById('customerForm');
      const isEditMode = form.dataset.mode === 'edit';
      const customerCode = form.dataset.code;

      // 폼 데이터 수집
      const formData = {
        매출처명: document.getElementById('customerName').value,
        사업자번호: document.getElementById('businessNo').value,
        대표자명: document.getElementById('ceoName').value,
        업태: document.getElementById('businessType').value,
        업종: document.getElementById('businessCategory').value,
        전화번호: document.getElementById('phone').value,
        팩스번호: document.getElementById('fax').value,
        우편번호: document.getElementById('zipCode').value,
        주소: document.getElementById('address').value,
        번지: document.getElementById('addressDetail').value,
        은행코드: document.getElementById('bankCode').value,
        계좌번호: document.getElementById('accountNo').value,
        담당자명: document.getElementById('managerName').value,
        사용구분: parseInt(document.getElementById('status').value),
        비고란: document.getElementById('remark').value,
      };

      let result;

      if (isEditMode) {
        // 수정 모드
        result = await apiCall(`/customers/${customerCode}`, 'PUT', formData);
      } else {
        // 신규 등록 모드
        formData.매출처코드 = document.getElementById('customerCode').value;
        result = await apiCall('/customers', 'POST', formData);
      }

      if (result.success) {
        alert(isEditMode ? '매출처가 수정되었습니다.' : '매출처가 등록되었습니다.');
        closeCustomerModal();

        // DataTable 새로고침
        try {
          $('#customerTable').DataTable().ajax.reload(null, false);
        } catch (e) {
          console.warn('DataTable 새로고침 실패:', e);
        }
      } else {
        alert('오류: ' + (result.message || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('매출처 저장 오류:', error);
      alert('매출처 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 매출처 모달 닫기 (신규/수정 공용)
  window.closeCustomerModal = function () {
    const modal = document.getElementById('customerModal');
    if (modal) {
      modal.style.display = 'none';

      // 폼 초기화
      const form = document.getElementById('customerForm');
      form.reset();
      delete form.dataset.mode;
      delete form.dataset.code;

      // 모달 제목 복원
      const modalTitle = modal.querySelector('h2');
      if (modalTitle) {
        modalTitle.textContent = '매출처 신규등록';
      }
    }
  };

  // 매출처 검색 모달 닫기 (견적서 등에서 사용)
  window.closeCustomerSearchModal = function () {
    const modal = document.getElementById('customerSearchModal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  // 매출처 삭제 (모달 열기)
  window.deleteCustomer = async function (customerCode) {
    try {
      console.log('===== 매출처 삭제 모달 열기 =====');
      console.log('매출처코드:', customerCode);

      // 1. API 호출로 매출처 정보 가져오기
      const result = await apiCall(`/customers/${customerCode}`, 'GET');

      if (!result.success || !result.data) {
        throw new Error(result.message || '매출처 정보를 불러올 수 없습니다.');
      }

      const customer = result.data;
      console.log('✅ 매출처 정보 로드 성공:', customer);

      // 2. 삭제할 매출처 정보를 모달에 표시
      const deleteContent = document.getElementById('customerDeleteContent');
      deleteContent.innerHTML = `
        <div style="
              background: #f8f9fa;
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 20px;
            ">
          <div style="margin-bottom: 12px;">
            <span style="font-weight: 500; color: var(--text-gray); font-size: 14px;">매출처코드</span>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: var(--text-dark);">${customer.매출처코드}</p>
          </div>
          <div style="margin-bottom: 12px;">
            <span style="font-weight: 500; color: var(--text-gray); font-size: 14px;">매출처명</span>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: var(--text-dark);">${customer.매출처명}</p>
          </div>
          <div style="margin-bottom: 12px;">
            <span style="font-weight: 500; color: var(--text-gray); font-size: 14px;">대표자</span>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: var(--text-dark);">${customer.대표자명 || '-'}</p>
          </div>
          <div>
            <span style="font-weight: 500; color: var(--text-gray); font-size: 14px;">사업자번호</span>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: var(--text-dark);">${customer.사업자번호 || '-'}</p>
          </div>
        </div>
      `;

      // 3. 모달에 매출처코드 저장 (삭제 시 사용)
      document
        .getElementById('customerDeleteModal')
        .setAttribute('data-customer-code', customerCode);

      // 4. 모달 표시
      document.getElementById('customerDeleteModal').style.display = 'flex';
      console.log('✅ 삭제 모달 표시 완료');
    } catch (error) {
      console.error('❌ 매출처 삭제 모달 열기 오류:', error);
      alert('매출처 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 매출처 삭제 모달 닫기
  window.closeCustomerDeleteModal = function () {
    document.getElementById('customerDeleteModal').style.display = 'none';
    document.getElementById('customerDeleteContent').innerHTML = '';
    document.getElementById('customerDeleteModal').removeAttribute('data-customer-code');
    console.log('✅ 삭제 모달 닫기 완료');
  };

  // 매출처 삭제 확인 (실제 삭제)
  window.confirmDeleteCustomer = async function () {
    try {
      const customerCode = document
        .getElementById('customerDeleteModal')
        .getAttribute('data-customer-code');

      if (!customerCode) {
        throw new Error('삭제할 매출처 코드가 없습니다.');
      }

      console.log('===== 매출처 삭제 실행 =====');
      console.log('매출처코드:', customerCode);

      // 1. API 호출로 매출처 삭제
      const result = await apiCall(`/customers/${customerCode}`, 'DELETE');

      if (!result.success) {
        throw new Error(result.message || '매출처 삭제에 실패했습니다.');
      }

      console.log('✅ 매출처 삭제 성공:', result);

      // 2. 성공 메시지 표시
      alert('매출처가 성공적으로 삭제되었습니다.');

      // 3. 모달 닫기
      closeCustomerDeleteModal();

      // 4. 목록 새로고침 (DataTable)
      try {
        $('#customerTable').DataTable().ajax.reload(null, false);
        console.log('✅ 매출처 목록 새로고침 완료');
      } catch (e) {
        console.warn('⚠️ DataTable 새로고침 실패 (수동 새로고침 필요):', e);
      }
    } catch (error) {
      console.error('❌ 매출처 삭제 오류:', error);
      alert('매출처 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 신규 매출처 등록 모달 열기
  window.openNewCustomerModal = async function () {
    try {
      console.log('===== 신규 매출처 등록 모달 열기 =====');

      // 1. 서버에서 새로운 매출처코드 생성 요청
      const result = await apiCall('/customer_new', 'GET');

      if (!result.success || !result.data) {
        throw new Error(result.message || '매출처코드를 생성할 수 없습니다.');
      }

      const newCustomerCode = result.data.매출처코드;
      console.log('✅ 생성된 매출처코드:', newCustomerCode);

      // 2. 모달 열기
      const modal = document.getElementById('customerModal');
      if (!modal) {
        throw new Error('모달을 찾을 수 없습니다.');
      }

      // 3. 폼 초기화
      const form = document.getElementById('customerForm');
      form.reset();
      form.removeAttribute('data-mode');
      form.removeAttribute('data-customer-code');

      // 4. 모달 제목 설정
      const modalTitle = modal.querySelector('h2');
      if (modalTitle) {
        modalTitle.textContent = '매출처 신규등록';
      }

      // 5. 자동 생성된 매출처코드 설정 (사용자 수정 가능)
      document.getElementById('customerCode').value = newCustomerCode;
      document.getElementById('customerCode').readOnly = false;

      // 6. 모달 표시
      modal.style.display = 'flex';

      // 7. 모달 드래그 기능 적용
      makeModalDraggable('customerModal', 'customerModalHeader');

      console.log('✅ 신규 등록 모달 열기 완료');
    } catch (error) {
      console.error('❌ 신규 등록 모달 열기 오류:', error);
      alert('신규 등록 모달을 열 수 없습니다: ' + error.message);
    }
  };

  // ==================== 거래내역 모달 기능 ====================

  // 거래내역 모달 열기
  window.openCustomerTransactionHistoryModal = async function () {
    try {
      if (!currentCustomerCode) {
        alert('매출처 정보가 없습니다.');
        return;
      }

      // 제목 설정
      document.getElementById('customerTransactionHistoryTitle').textContent =
        `${currentCustomerName} (${currentCustomerCode}) 거래내역`;

      // 모달 표시
      document.getElementById('customerTransactionHistoryModal').style.display = 'flex';

      // 거래내역 DataTable 로드
      await loadCustomerTransactionHistory();
    } catch (error) {
      console.error('거래내역 모달 열기 오류:', error);
      alert('거래내역을 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 거래내역 모달 닫기
  window.closeCustomerTransactionHistoryModal = function () {
    document.getElementById('customerTransactionHistoryModal').style.display = 'none';

    // DataTable 파괴
    if (transactionHistoryTable) {
      transactionHistoryTable.destroy();
      transactionHistoryTable = null;
    }
  };

  // 거래내역 DataTable 로드
  async function loadCustomerTransactionHistory() {
    try {
      // 기존 테이블이 있으면 파괴
      if (transactionHistoryTable) {
        transactionHistoryTable.destroy();
      }

      // API 호출하여 거래내역 조회
      const apiUrl = `${API_BASE_URL}/customers/${currentCustomerCode}/transaction-history`;

      transactionHistoryTable = $('#customerTransactionHistoryTable').DataTable({
        ajax: {
          url: apiUrl,
          dataSrc: function (json) {
            if (!json.success) {
              alert('거래내역을 불러올 수 없습니다.');
              return [];
            }
            return json.data || [];
          },
          error: function (xhr, error, thrown) {
            console.error('거래내역 조회 에러:', error);
            alert('거래내역을 불러오는 중 오류가 발생했습니다.');
          },
        },
        columns: [
          {
            data: '입출고일자',
            render: function (data) {
              if (!data) return '-';
              return data.substring(0, 4) + '-' + data.substring(4, 6) + '-' + data.substring(6, 8);
            }
          },
          { data: '거래번호', defaultContent: '-' },
          {
            data: '입출고구분',
            render: function (data) {
              if (data === '1') return '<span class="badge badge-success">입고</span>';
              if (data === '2') return '<span class="badge badge-danger">출고</span>';
              return '-';
            }
          },
          {
            data: null,
            render: function (data, type, row) {
              return (row.분류코드 || '') + (row.세부코드 || '');
            }
          },
          { data: '자재명', defaultContent: '-' },
          { data: '규격', defaultContent: '-' },
          { data: '단위', defaultContent: '-' },
          {
            data: '입고수량',
            className: 'text-right',
            render: function (data) {
              if (!data || data == 0) return '-';
              return parseFloat(data).toLocaleString();
            }
          },
          {
            data: '출고수량',
            className: 'text-right',
            render: function (data) {
              if (!data || data == 0) return '-';
              return parseFloat(data).toLocaleString();
            }
          },
          {
            data: '입고단가',
            className: 'text-right',
            render: function (data) {
              if (!data || data == 0) return '-';
              return '₩' + parseFloat(data).toLocaleString();
            }
          },
          {
            data: '출고단가',
            className: 'text-right',
            render: function (data) {
              if (!data || data == 0) return '-';
              return '₩' + parseFloat(data).toLocaleString();
            }
          },
          { data: '매입처명', defaultContent: '-' },
        ],
        language: {
          lengthMenu: '페이지당 _MENU_ 개씩 보기',
          zeroRecords: '거래내역이 없습니다',
          info: '전체 _TOTAL_개 중 _START_-_END_개 표시',
          infoEmpty: '데이터 없음',
          infoFiltered: '(전체 _MAX_개 중 검색결과)',
          search: '검색:',
          paginate: {
            first: '처음',
            last: '마지막',
            next: '다음',
            previous: '이전',
          },
        },
        order: [[0, 'desc']], // 입출고일자 내림차순
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        responsive: true,
        autoWidth: false,
      });
    } catch (error) {
      console.error('거래내역 테이블 로드 오류:', error);
      alert('거래내역을 불러오는 중 오류가 발생했습니다.');
    }
  }
});

console.log('✅ customer.js 로드 완료');
