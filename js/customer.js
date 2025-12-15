// ✅ 매출처관리 스크립트 (sales-customer.js)
// ✅ Prefix 규칙 준수: salesCustomer prefix 적용, DataTable 재사용 패턴 적용
$(document).ready(function () {
  // ✅ Prefix 규칙: window.salesCustomerTable
  window.salesCustomerTable = null;
  let currentSalesCustomerSearchKeyword = ''; // 현재 검색 키워드 저장
  let currentSalesCustomerCode = ''; // 현재 선택된 매출처코드
  let currentSalesCustomerName = ''; // 현재 선택된 매출처명
  // ✅ Prefix 규칙: window.salesCustomerTransactionHistoryTable
  window.salesCustomerTransactionHistoryTable = null;

  async function loadSalesCustomers(searchKeyword = '') {
    try {
      // API URL에 검색 파라미터 추가 (pageSize=10000으로 전체 데이터 조회)
      let apiUrl = API_BASE_URL + '/customers?pageSize=10000';
      if (searchKeyword) {
        apiUrl += `&search=${encodeURIComponent(searchKeyword)}`;
      }

      // 데이터 조회
      const response = await fetch(apiUrl, { credentials: 'include' });
      const result = await response.json();
      const tableData = result.data || [];

      // ✅ DataTable 재사용 패턴: 없으면 생성, 있으면 데이터만 업데이트
      if (!window.salesCustomerTable || typeof window.salesCustomerTable.clear !== 'function') {
        // ✅ DataTable 인스턴스가 손상된 경우 복구
        if ($.fn.DataTable.isDataTable('#salesCustomerTable')) {
          $('#salesCustomerTable').DataTable().destroy();
          $('#salesCustomerTable').empty();
        }

        // ✅ DataTable 초기화 (최초 1회만)
        window.salesCustomerTable = $('#salesCustomerTable').DataTable({
          data: [],
          columns: [
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
          } else if (data === 9) {
            return '<span class="status-badge status-deleted">삭제됨</span>';
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
          // 삭제된 매출처(사용구분=9)는 상세보기만 가능
          if (row.사용구분 === 9) {
            return `
              <div class="action-buttons" id="customerActions-${row.매출처코드}">
                <button class="btn-icon customerBtnView" onclick="viewCustomerDetail('${row.매출처코드}')">상세</button>
                <span style="color: #9ca3af; font-size: 12px;">(삭제됨)</span>
              </div>
            `;
          }

          return `
            <div class="action-buttons" id="customerActions-${row.매출처코드}">
              <button class="btn-icon customerBtnView" onclick="viewCustomerDetail('${row.매출처코드}')">상세</button>
              <button class="btn-icon customerBtnEdit" style="display: none;" onclick="editCustomer('${row.매출처코드}')">수정</button>
              <button class="btn-icon customerBtnDelete" style="display: none;" onclick="deleteCustomer('${row.매출처코드}')">삭제</button>
            </div>
          `;
        },
      },
          ],
          language: {
            lengthMenu: '페이지당 _MENU_ 개씩 보기',
            zeroRecords: '데이터가 없습니다.',
            info: '전체 _TOTAL_개 중 _START_ - _END_',
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
          order: [[2, 'asc']], // 매출처코드 기준 오름차순
          pageLength: 10,
          responsive: true,
          autoWidth: false,
          rowCallback: function(row, data) {
            // 삭제된 매출처(사용구분=9)는 행 전체를 회색으로 처리
            if (data.사용구분 === 9) {
              $(row).css({
                'background-color': '#f9fafb',
                'opacity': '0.7',
                'color': '#9ca3af'
              });
            }
          },
          drawCallback: function() {
            const isSelectAllChecked = $('#salesCustomerSelectAll').prop('checked');

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
          },
        });
      }

      // ✅ DataTable에 데이터 업데이트 (재사용 패턴)
      window.salesCustomerTable.clear().rows.add(tableData).draw();

    } catch (err) {
      console.error('❌ 매출처 조회 오류:', err);
      alert('매출처 데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }

  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadSalesCustomers = loadSalesCustomers;

  // 새로고침 버튼 (현재 HTML에 없음 - 필요시 추가)
  // $('#customerBtnReload').on('click', () => table.ajax.reload(null, false));

  // 전체 선택 체크박스 (이벤트 네임스페이스 적용)
  $(document)
    .off('change.customerPage', '#salesCustomerSelectAll')
    .on('change.customerPage', '#salesCustomerSelectAll', function () {
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
      $('#salesCustomerSelectAll').prop('checked', totalCheckboxes === checkedCheckboxes);

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
  $('#salesCustomerSearchInput')
    .off('keypress.customerPage')
    .on('keypress.customerPage', function (e) {
      if (e.which === 13) { // Enter key
        e.preventDefault();
        searchCustomers();
      }
    });

  // 검색 함수를 전역으로 노출
  window.searchCustomers = function () {
    const keyword = $('#salesCustomerSearchInput').val().trim();
    console.log('🔍 매출처 검색:', keyword);
    currentSalesCustomerSearchKeyword = keyword;
    loadSalesCustomers(keyword);
  };

  // ✅ 표준 함수명 별칭 (HTML onclick에서 사용)
  window.searchSalesCustomers = window.searchCustomers;

  // 검색 초기화 함수를 전역으로 노출
  window.resetCustomerSearch = function () {
    console.log('🔄 매출처 검색 초기화');
    $('#salesCustomerSearchInput').val('');
    currentSalesCustomerSearchKeyword = '';
    loadSalesCustomers('');
  };

  // ✅ 표준 함수명 별칭
  window.resetSalesCustomerSearch = window.resetCustomerSearch;

  // Google Sheets로 내보내기 (CSV 다운로드)
  window.exportCustomersToGoogleSheets = function() {
    try {
      console.log('===== Google Sheets로 내보내기 시작 =====');

      // 1. DataTable에서 현재 표시된 데이터 가져오기
      if (!window.salesCustomerTable) {
        alert('데이터 테이블이 초기화되지 않았습니다.');
        return;
      }

      const dataToExport = window.salesCustomerTable.rows().data().toArray();

      if (dataToExport.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
      }

      console.log(`✅ 내보낼 데이터 수: ${dataToExport.length}건`);

      // 2. CSV 형식으로 변환
      const headers = [
        '매출처코드',
        '매출처명',
        '대표자',
        '사업자번호',
        '연락처',
        '거래상태',
        '등록일',
      ];
      let csvContent = '\uFEFF'; // UTF-8 BOM 추가 (엑셀에서 한글 깨짐 방지)
      csvContent += headers.join(',') + '\n';

      dataToExport.forEach((row) => {
        const rowArray = [
          row.매출처코드 || '',
          row.매출처명 || '',
          row.대표자명 || '',
          row.사업자번호 || '',
          row.전화번호 || '',
          row.사용구분 === 0 ? '정상거래' : '거래보류',
          row.수정일자 || '',
        ];
        csvContent += rowArray.map(field => `"${field}"`).join(',') + '\n';
      });

      // 3. CSV 파일 다운로드
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.setAttribute('href', url);
      link.setAttribute('download', `매출처목록_${today}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ CSV 파일 다운로드 완료');
      alert(`매출처 ${dataToExport.length}건을 CSV 파일로 내보냈습니다.`);
    } catch (error) {
      console.error('❌ CSV 내보내기 오류:', error);
      alert('CSV 파일 생성 중 오류가 발생했습니다.');
    }
  };

  // ✅ 표준 함수명 별칭
  window.exportSalesCustomersToGoogleSheets = window.exportCustomersToGoogleSheets;

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

      document.getElementById('salesCustomerViewContent').innerHTML = detailHtml;
      document.getElementById('salesCustomerViewModal').style.display = 'flex';

      // 모달 드래그 기능 적용
      makeModalDraggable('salesCustomerViewModal', 'salesCustomerViewModalHeader');
    } catch (error) {
      console.error('매출처 상세 조회 오류:', error);
      alert('매출처 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 매출처 상세보기 모달 닫기
  window.closeCustomerViewModal = function () {
    document.getElementById('salesCustomerViewModal').style.display = 'none';
  };

  // ✅ 표준 함수명 (salesCustomer prefix)
  window.closeSalesCustomerViewModal = window.closeCustomerViewModal;

  // ✅ 하위 호환성: 기존 함수명 유지
  window.closeCustomerDetailModal = window.closeCustomerViewModal;

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
      const modal = document.getElementById('salesCustomerEditModal');
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
      const form = document.getElementById('salesCustomerEditForm');
      form.dataset.mode = 'edit';
      form.dataset.code = customerCode;

      // 6. 모달 표시
      modal.style.display = 'flex';

      // 7. 모달 드래그 기능 적용
      makeModalDraggable('salesCustomerEditModal', 'salesCustomerEditModalHeader');
    } catch (error) {
      console.error('매출처 수정 준비 오류:', error);
      alert('매출처 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 매출처 등록/수정 폼 제출
  window.submitCustomer = async function (event) {
    event.preventDefault();

    try {
      const form = document.getElementById('salesCustomerEditForm');
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
        은행코드: document.getElementById('bankCode').value || '',
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
        // ✅ 신규 등록 모드 - 매출처코드 대문자 변환만 처리
        let inputCode = document.getElementById('customerCode').value.trim();

        // ✅ 소문자 → 대문자 자동 변환
        const upperCode = inputCode.toUpperCase();
        if (inputCode !== upperCode) {
          document.getElementById('customerCode').value = upperCode;
          inputCode = upperCode;
        }

        formData.매출처코드 = inputCode;
        result = await apiCall('/customers', 'POST', formData);
      }

      if (result.success) {
        alert(isEditMode ? '매출처가 수정되었습니다.' : '매출처가 등록되었습니다.');
        closeCustomerEditModal();

        // DataTable 새로고침
        try {
          window.loadSalesCustomers();
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

  // ✅ 표준 함수명 별칭
  window.submitSalesCustomer = window.submitCustomer;

  // 매출처 모달 닫기 (신규/수정 공용)
  window.closeCustomerEditModal = function () {
    const modal = document.getElementById('salesCustomerEditModal');
    if (modal) {
      modal.style.display = 'none';

      // 폼 초기화
      const form = document.getElementById('salesCustomerEditForm');
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

  // ✅ 표준 함수명 (salesCustomer prefix)
  window.closeSalesCustomerEditModal = window.closeCustomerEditModal;

  // ✅ 하위 호환성: 기존 함수명 유지
  window.closeCustomerModal = window.closeCustomerEditModal;

  // 매출처 검색 모달 닫기 (견적서 등에서 사용)
  window.closeCustomerSearchModal = function () {
    // 표준 ID 우선, 없으면 기존 quotation ID 사용 (하위 호환)
    const modal = document.getElementById('customerSearchModal') ||
                  document.getElementById('quotationCustomerSearchModal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  /**
   * 매출처 편집 폼에서 검색 모달 열기
   * @description 신규등록/수정 모달의 검색 버튼 클릭 시 호출
   */
  window.openCustomerSearchFromEditForm = function() {
    console.log('===== 매출처 편집 폼에서 검색 모달 열기 =====');

    // 1. 매출처명 입력 필드에서 검색어 가져오기
    const customerNameInput = document.getElementById('customerName');
    const searchKeyword = customerNameInput ? customerNameInput.value.trim() : '';

    console.log('🔍 검색어:', searchKeyword);

    // 2. 검색 모달 열기
    window.openCustomerSearchModal('editForm');

    // 3. 검색어가 있으면 검색 모달 입력 필드에 설정하고 자동 검색
    if (searchKeyword) {
      const modalInput = document.getElementById('customerSearchModalInput');
      if (modalInput) {
        modalInput.value = searchKeyword;
        console.log('✅ 검색어 설정 완료:', searchKeyword);

        // 자동으로 검색 실행
        if (typeof window.searchCustomersForModal === 'function') {
          window.searchCustomersForModal();
          console.log('✅ 자동 검색 실행 완료');
        }
      }
    } else {
      console.log('ℹ️ 검색어 없음 - 빈 상태로 모달 표시');
    }
  };

  /**
   * 매출처 편집 폼에 선택한 매출처 정보 채우기
   * @param {string} code - 매출처 코드
   * @param {string} name - 매출처명
   */
  window.selectCustomerForEditForm = async function(code, name) {
    try {
      console.log('===== 매출처 편집 폼에 정보 채우기 =====');
      console.log('매출처코드:', code);
      console.log('매출처명:', name);

      // 1. API로 전체 매출처 정보 가져오기
      const result = await apiCall(`/customers/${code}`, 'GET');

      if (!result.success || !result.data) {
        throw new Error(result.message || '매출처 정보를 불러올 수 없습니다.');
      }

      const customer = result.data;
      console.log('✅ 매출처 정보 로드 성공:', customer);

      // 2. 폼 필드에 정보 채우기
      document.getElementById('customerCode').value = customer.매출처코드 || '';
      document.getElementById('customerName').value = customer.매출처명 || '';
      document.getElementById('ceoName').value = customer.대표자명 || '';
      document.getElementById('businessNumber').value = customer.사업자번호 || '';
      document.getElementById('companyAddress').value = customer.회사주소 || '';
      document.getElementById('phoneNumber').value = customer.전화번호 || '';
      document.getElementById('faxNumber').value = customer.팩스번호 || '';
      document.getElementById('email').value = customer.이메일 || '';
      document.getElementById('homepage').value = customer.홈페이지 || '';
      document.getElementById('zipCode').value = customer.우편번호 || '';

      // 사용구분 설정
      const useStatus = document.getElementById('useStatus');
      if (useStatus) {
        useStatus.value = customer.사용구분 !== undefined ? customer.사용구분.toString() : '0';
      }

      // 비고
      document.getElementById('remarks').value = customer.비고 || '';

      console.log('✅ 매출처 정보 폼 채우기 완료');

      // 3. 검색 모달 닫기
      window.closeCustomerSearchModal();

      // 4. 사용자에게 알림
      alert(`매출처 정보를 불러왔습니다: ${customer.매출처명}`);

    } catch (error) {
      console.error('❌ 매출처 정보 불러오기 오류:', error);
      alert('매출처 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
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
      const modal = document.getElementById('salesCustomerEditModal');
      if (!modal) {
        throw new Error('모달을 찾을 수 없습니다.');
      }

      // 3. 폼 초기화
      const form = document.getElementById('salesCustomerEditForm');
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
      makeModalDraggable('salesCustomerEditModal', 'salesCustomerEditModalHeader');

      console.log('✅ 신규 등록 모달 열기 완료');
    } catch (error) {
      console.error('❌ 신규 등록 모달 열기 오류:', error);
      alert('신규 등록 모달을 열 수 없습니다: ' + error.message);
    }
  };

  // ✅ 표준 함수명 별칭
  window.openNewSalesCustomerModal = window.openNewCustomerModal;

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
    // ✅ 모달 닫을 때 DataTable은 유지 (재사용)
  };

  // 거래내역 DataTable 로드
  async function loadCustomerTransactionHistory() {
    try {
      // API 호출하여 거래내역 조회
      const apiUrl = `${API_BASE_URL}/customers/${currentCustomerCode}/transaction-history`;

      const response = await fetch(apiUrl, { credentials: 'include' });
      const result = await response.json();

      if (!result.success) {
        alert('거래내역을 불러올 수 없습니다.');
        return;
      }

      const transactionData = result.data || [];

      // ✅ DataTable 재사용 패턴
      if (!window.customerTransactionHistoryTable || typeof window.customerTransactionHistoryTable.clear !== 'function') {
        if ($.fn.DataTable.isDataTable('#customerTransactionHistoryTable')) {
          $('#customerTransactionHistoryTable').DataTable().destroy();
          $('#customerTransactionHistoryTable').empty();
        }

        window.customerTransactionHistoryTable = $('#customerTransactionHistoryTable').DataTable({
          data: [],
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
      }

      // ✅ DataTable에 데이터 업데이트 (재사용 패턴)
      window.customerTransactionHistoryTable.clear().rows.add(transactionData).draw();

    } catch (error) {
      console.error('거래내역 테이블 로드 오류:', error);
      alert('거래내역을 불러오는 중 오류가 발생했습니다.');
    }
  }
});

// ========================================
// 🔹 공용 함수 (Common Functions for All Modules)
// ========================================
// quotation, transaction, taxinvoice 등 여러 모듈에서 재사용하는 매출처 검색/선택 함수

/**
 * 매출처 검색 모달용 검색 함수 (공용)
 * @description customerSearchModal에서 사용하는 공용 검색 함수
 */
window.searchCustomersForModal = async function() {
  try {
    const keyword = document.getElementById('customerSearchModalInput').value.trim();

    // API 호출
    let apiUrl = API_BASE_URL + '/customers?pageSize=100';
    if (keyword) {
      apiUrl += `&search=${encodeURIComponent(keyword)}`;
    }

    const response = await fetch(apiUrl, { credentials: 'include' });
    const result = await response.json();
    const customers = result.data || [];

    // 검색 결과 렌더링
    const tbody = document.getElementById('customerSearchTableBody');
    tbody.innerHTML = '';

    if (customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #999">
            검색 결과가 없습니다
          </td>
        </tr>
      `;
      return;
    }

    customers.forEach(customer => {
      const row = document.createElement('tr');
      row.style.cursor = 'pointer';
      row.style.transition = 'background-color 0.2s';
      row.onmouseenter = function() { this.style.backgroundColor = '#f8f9fa'; };
      row.onmouseleave = function() { this.style.backgroundColor = ''; };

      // API 필드명 사용 (매출처코드, 매출처명, 전화번호)
      const code = customer.매출처코드 || '';
      const name = customer.매출처명 || '';
      const phone = customer.전화번호 || '';

      row.innerHTML = `
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb">${code}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb">${name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb">${phone}</td>
        <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb">
          <button onclick="selectCustomerFromModal('${code}', '${name}')"
                  style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer">
            선택
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('매출처 검색 오류:', error);
    alert('매출처 검색 중 오류가 발생했습니다.');
  }
};

/**
 * 매출처 선택 함수 (공용)
 * @param {string} code - 매출처 코드
 * @param {string} name - 매출처명
 * @description 매출처 검색 모달에서 매출처 선택 시 호출되는 공용 함수
 */
window.selectCustomerFromModal = function(code, name) {
  // 호출한 모듈에 따라 다른 처리 (callerContext 활용 가능)
  // 현재는 간단하게 window.currentCallerContext로 판단

  if (window.currentCustomerSearchCaller === 'editForm') {
    // 매출처 편집 폼에서 호출한 경우
    if (typeof window.selectCustomerForEditForm === 'function') {
      window.selectCustomerForEditForm(code, name);
    }
  } else if (window.currentCustomerSearchCaller === 'quotation') {
    // 견적관리에서 호출한 경우
    if (typeof window.selectQuotationCustomer === 'function') {
      window.selectQuotationCustomer(code, name);
    }
  } else if (window.currentCustomerSearchCaller === 'transaction') {
    // 거래명세서에서 호출한 경우
    if (typeof window.selectTransactionCustomer === 'function') {
      window.selectTransactionCustomer(code, name);
    }
  } else if (window.currentCustomerSearchCaller === 'taxinvoice') {
    // 세금계산서에서 호출한 경우
    if (typeof window.selectTaxInvoiceCustomer === 'function') {
      window.selectTaxInvoiceCustomer(code, name);
    }
  }

  // 모달 닫기 (editForm의 경우 selectCustomerForEditForm 내부에서 처리하므로 중복 호출 방지)
  if (window.currentCustomerSearchCaller !== 'editForm') {
    window.closeCustomerSearchModal();
  }
};

/**
 * 매출처 검색 모달 열기 (공용)
 * @param {string} callerContext - 호출한 모듈 식별자 (quotation, transaction, taxinvoice 등)
 * @param {string} initialSearchValue - 초기 검색어 (선택적)
 */
window.openCustomerSearchModal = function(callerContext, initialSearchValue) {
  window.currentCustomerSearchCaller = callerContext || 'unknown';
  // 표준 ID 우선, 없으면 기존 quotation ID 사용 (하위 호환)
  const modal = document.getElementById('customerSearchModal') ||
                document.getElementById('quotationCustomerSearchModal');
  if (modal) {
    modal.style.display = 'block';
    // 입력 필드 설정
    const input = document.getElementById('customerSearchModalInput');
    if (input) {
      // 초기 검색어가 제공되면 설정, 아니면 빈 값
      input.value = initialSearchValue || '';
      input.focus();
    }
  }
};

/**
 * 매출처 검색 모달 닫기 (공용)
 */
window.closeCustomerSearchModal = function() {
  // 표준 ID 우선, 없으면 기존 quotation ID 사용 (하위 호환)
  const modal = document.getElementById('customerSearchModal') ||
                document.getElementById('quotationCustomerSearchModal');
  if (modal) {
    modal.style.display = 'none';
  }
  window.currentCustomerSearchCaller = null;
};

// ========================================
// 하위 호환성 레이어 (Backward Compatibility Layer)
// ========================================
// 다른 파일(quotation.js, taxinvoice.js 등)에서 기존 customer 이름으로 접근할 수 있도록 별칭 설정

// DataTable 변수
window.customerTable = window.salesCustomerTable;
window.customerTransactionHistoryTable = window.salesCustomerTransactionHistoryTable;

// 함수 별칭 (레거시 호환 - 이미 정의된 함수들의 별칭만 추가)
// 위에서 정의된 실제 함수들:
// - window.searchCustomers, window.resetCustomerSearch (이미 정의됨)
// - window.loadSalesCustomers, window.searchSalesCustomers (별칭 추가됨)
// - window.resetSalesCustomerSearch, window.submitSalesCustomer (별칭 추가됨)
// - window.openNewSalesCustomerModal (별칭 추가됨)

// 레거시 이름으로도 접근 가능하도록 유지 (이미 정의된 함수 사용)
if (!window.loadCustomers) {
  window.loadCustomers = window.loadSalesCustomers;
}

// ========================================
// 🔹 Quotation 모듈 하위 호환성 (공용 모달 관련)
// ========================================
// quotation.js에서 기존 함수명으로 접근할 수 있도록 별칭 설정

/**
 * @deprecated searchCustomersForModal() 사용 권장
 */
window.searchQuotationCustomers = window.searchCustomersForModal;

/**
 * @deprecated closeCustomerSearchModal() 사용 권장
 */
window.closeQuotationCustomerSearchModal = window.closeCustomerSearchModal;

console.log('✅ customer.js (salesCustomer) 로드 완료 - 하위 호환성 레이어 활성화');
console.log('✅ 공용 매출처 검색 모달 함수 로드 완료 (customerSearchModal)');
