// ============================================
// 전역 변수 선언
// ============================================

// 전역 변수로 DataTable 인스턴스 저장 (Prefix 규칙 준수)
window.purchaseTable = null;

// 매입전표 상세 품목 배열 (신규 작성용)
let newPurchaseDetails = [];

// 선택된 자재 정보
let selectedPurchaseMaterial = null;

// 품목 추가 모달 모드 ("new" or "edit")
let purchaseDetailAddMode = 'new';

// ============================================
// 페이지 로드 시 초기화
// ============================================

$(document).ready(function () {
  // ================================================
  // 모달 드래그 기능 초기화
  // ================================================
  makeModalDraggable('purchaseModalContent', 'purchaseModalHeader');
  makeModalDraggable('purchaseEditModalContent', 'purchaseEditModalHeader');
  makeModalDraggable('purchaseDetailModalContent', 'purchaseDetailModalHeader');

  // ================================================
  // 금액 자동 계산 이벤트
  // ================================================
  
  // 매입 품목 추가 모달 - 금액 자동 계산
  $('#addPurchaseDetailQuantity, #addPurchaseDetailUnitPrice')
    .off('input.purchasePage')
    .on('input.purchasePage', function () {
      const quantity = parseFloat($('#addPurchaseDetailQuantity').val()) || 0;
      const unitPrice = parseFloat($('#addPurchaseDetailUnitPrice').val()) || 0;
      const amount = quantity * unitPrice;
      $('#addPurchaseDetailSupplyPrice').val(amount);
      
      console.log('💰 [품목추가] 금액 재계산:', {
        수량: quantity,
        단가: unitPrice,
        공급가액: amount
      });
    });

  // 매입 품목 수정 모달 - 금액 자동 계산
  $('#editPurchaseDetailQuantity, #editPurchaseDetailUnitPrice')
    .off('input.purchasePage')
    .on('input.purchasePage', function () {
      const quantity = parseFloat($('#editPurchaseDetailQuantity').val()) || 0;
      const unitPrice = parseFloat($('#editPurchaseDetailUnitPrice').val()) || 0;
      const amount = quantity * unitPrice;
      $('#editPurchaseDetailSupplyPrice').val(amount);
      
      console.log('💰 [품목수정] 금액 재계산:', {
        수량: quantity,
        단가: unitPrice,
        공급가액: amount
      });
    });

  // ================================================
  // Enter 키 이벤트
  // ================================================
  
  // 매입처 검색 - Enter 키
  $(document)
    .off('keypress.purchasePage', '#purchaseSupplierSearchInput')
    .on('keypress.purchasePage', '#purchaseSupplierSearchInput', function (e) {
      if (e.which === 13) {
        e.preventDefault();
        console.log('⌨️ [매입처검색] Enter 키 입력');
        searchPurchaseSuppliers();
      }
    });

  // 자재 검색 - Enter 키
  $(document)
    .off('keypress.purchasePage', '#purchaseMaterialSearchCode, #purchaseMaterialSearchName')
    .on('keypress.purchasePage', '#purchaseMaterialSearchCode, #purchaseMaterialSearchName', function (e) {
      if (e.which === 13) {
        e.preventDefault();
        console.log('⌨️ [자재검색] Enter 키 입력');
        searchPurchaseMaterials();
      }
    });

  // ================================================
  // 전역 함수 등록
  // ================================================
  window.loadPurchaseList = loadPurchaseList;

  console.log('✅ 매입전표관리 페이지 초기화 완료');
});

// ============================================
// 매입전표 목록 조회
// ============================================

/**
 * 매입전표 목록 조회
 */
async function loadPurchaseList() {
  console.log('[매입전표] 메뉴페이지 loadPurchaseList() 시작');

  try {
    const startDate = document.getElementById('purchaseStartDate').value;
    const endDate = document.getElementById('purchaseEndDate').value;
    const status = document.getElementById('purchaseStatusFilter').value;

    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    if (status) query.append('status', status);

    const res = await fetch(`${API_BASE_URL}/purchase-statements?${query.toString()}`);
    const data = await res.json();

    if (!data.success) throw new Error('데이터를 불러오지 못했습니다.');

    const tableData = data.data || [];
    document.getElementById('purchaseCount').textContent = tableData.length;

    // ✅ 기존 DataTable 있으면 destroy
    if (window.purchaseTableInstance) {
      window.purchaseTableInstance.destroy();
    }

    // ✅ DataTable 초기화 (purchaseActions- prefix 사용)
    window.purchaseTableInstance = $('#purchaseTable').DataTable({
      data: tableData,
      columns: [
        {
          data: null,
          render: (data, type, row, meta) =>
            `<input type="checkbox" class="purchaseRowCheck" data-date="${row.거래일자}" data-no="${row.거래번호}" />`,
          orderable: false,
        },
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
          defaultContent: '-',
        },
        { data: '전표번호', defaultContent: '-' },
        {
          data: '거래일자',
          render: (data) => (data ? data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'),
        },
        { data: '매입처명', defaultContent: '-' },
        {
          data: '입고금액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '입고부가세',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: null,
          render: (data, type, row) => {
            const 입고금액 = row.입고금액 || 0;
            const 입고부가세 = row.입고부가세 || 0;
            return (입고금액 + 입고부가세).toLocaleString();
          },
          className: 'dt-right',
        },
        { data: '작성자', defaultContent: '-' },
        {
          data: '입출고구분',
          render: (d) => renderPurchaseStatementStatus(d),
        },
        {
          data: null,
          render: (data, type, row) => {
            const purchaseKey = row.purchaseKey || `${row.거래일자}_${row.거래번호}`;
            // ✅ 타입 혼선을 막기 위해 문자열로 고정 저장
            const purchaseDate = String(row.거래일자);
            const purchaseNo = String(row.거래번호);
            return `              
              <div class="action-buttons" id="purchaseActions-${purchaseKey}">
              <button class="btn-icon purchaseBtnView"
                      data-purchase-key="${purchaseKey}"
                      data-purchase-date="${purchaseDate}"
                      data-purchase-no="${purchaseNo}"
                      title="상세보기">상세</button>

              <button class="btn-icon purchaseBtnEdit"
                      style="display:none;"
                      data-purchase-key="${purchaseKey}"
                      data-purchase-date="${purchaseDate}"
                      data-purchase-no="${purchaseNo}"
                      title="수정">수정</button>

              <button class="btn-icon purchaseBtnDelete"
                      style="display:none;"
                      data-purchase-key="${purchaseKey}"
                      data-purchase-date="${purchaserDate}"
                      data-purchase-no="${purchaseNo}"
                      title="삭제">삭제</button>
            </div>
            `;
          },
          orderable: false,
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
      order: [[1, 'asc']],
      pageLength: 10,
      responsive: true,
      autoWidth: false,
      drawCallback: function (settings) {
        // DataTable이 다시 그려질 때마다 체크박스 상태에 따라 버튼 표시
        $('.purchaseRowCheck').each(function () {
          const $checkbox = $(this);
          const purchaseDate = String($checkbox.data('date'));
          const purchaseNo = String($checkbox.data('no'));
          const isChecked = $checkbox.prop('checked');
          const actionDiv = $('#purchaseActions-' + purchaseDate + '_' + purchaseNo);

          if (isChecked) {
            actionDiv.find('.purchaseBtnView').hide();
            actionDiv.find('.purchaseBtnEdit').show();
            actionDiv.find('.purchaseBtnDelete').show();
          } else {
            actionDiv.find('.purchaseBtnView').show();
            actionDiv.find('.purchaseBtnEdit').hide();
            actionDiv.find('.purchaseBtnDelete').hide();
          }
        });
      },
    });

    console.log('발주서관리 페이지에 있는 테이블 #orderTable 표시 완료');

    // ✅ 전체선택 체크박스 이벤트 핸들러 등록
    $(document)
      .off('change.purchasePage', '#purchaseSelectAll')
      .on('change.purchasePage', '#purchaseSelectAll', function () {
      const isChecked = $(this).prop('checked');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💰 [매입전표] 전체선택 체크박스 클릭');
      console.log(`✅ 체크 상태: ${isChecked ? '전체 선택' : '전체 해제'}`);

      $('.purchaseRowCheck').prop('checked', isChecked).trigger('change');

      console.log('✅ 전체선택 처리 완료');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // ✅ 개별 체크박스 이벤트 핸들러 등록
    $(document)
      .off('change.purchasePage', '.purchaseRowCheck')
      .on('change.purchasePage', '.purchaseRowCheck', function () {
      const purchaseDate = String($(this).data('date'));
      const purchaseNo = String($(this).data('no'));
      const isChecked = $(this).prop('checked');

      console.log('💰 [매입전표] 체크박스 이벤트 발생');
      console.log(`📅 거래일자: ${purchaseDate}`);
      console.log(`🔢 거래번호: ${purchaseNo}`);
      console.log(`✅ 체크 상태: ${isChecked ? '선택됨' : '해제됨'}`);

      // 전체 선택 체크박스 상태 업데이트
      const totalCheckboxes = $('.purchaseRowCheck').length;
      const checkedCheckboxes = $('.purchaseRowCheck:checked').length;
      $('#purchaseSelectAll').prop('checked', totalCheckboxes === checkedCheckboxes);

      // 현재 행의 버튼 표시/숨김 처리
      const actionDiv = $('#purchaseActions-' + purchaseDate + '_' + purchaseNo);

      if (isChecked) {
        // 체크됨: 보기 버튼 숨기고 수정/삭제 버튼 표시
        actionDiv.find('.purchaseBtnView').hide();
        actionDiv.find('.purchaseBtnEdit').show();
        actionDiv.find('.purchaseBtnDelete').show();

        console.log('🔘 표시된 버튼:');
        console.log('   ❌ [보기] 버튼 - 숨김');
        console.log('   ✅ [수정] 버튼 - 표시');
        console.log('   ✅ [삭제] 버튼 - 표시');
      } else {
        // 체크 해제: 수정/삭제 버튼 숨기고 보기 버튼 표시
        actionDiv.find('.purchaseBtnView').show();
        actionDiv.find('.purchaseBtnEdit').hide();
        actionDiv.find('.purchaseBtnDelete').hide();

        console.log('🔘 표시된 버튼:');
        console.log('   ✅ [보기] 버튼 - 표시');
        console.log('   ❌ [수정] 버튼 - 숨김');
        console.log('   ❌ [삭제] 버튼 - 숨김');
      }

    });
    // ✅ 상세 버튼 클릭 (이벤트 위임)
    $(document)
      .off('click.orderPage', '.orderBtnView')
      .on('click.orderPage', '.orderBtnView', function (e) {
        e.preventDefault();

        const orderDate = String($(this).data('order-date'));
        const orderNo = Number($(this).data('order-no'));

        console.log('[발주관리-상세] 버튼 클릭(위임) ->', orderDate, orderNo);
        viewOrder(orderDate, orderNo);
      });

    // ✅ 수정 버튼 클릭 (이벤트 위임)
    $(document)
      .off('click.orderPage', '.orderBtnEdit')
      .on('click.orderPage', '.orderBtnEdit', function (e) {
        e.preventDefault();

        const orderDate = String($(this).data('order-date'));
        const orderNo = Number($(this).data('order-no'));

        console.log('[발주관리-수정] 버튼 클릭(위임) ->', orderDate, orderNo);
        editOrder(orderDate, orderNo);
      });

    // ✅ 삭제 버튼 클릭 (이벤트 위임)
    $(document)
      .off('click.orderPage', '.orderBtnDelete')
      .on('click.orderPage', '.orderBtnDelete', function (e) {
        e.preventDefault();

        const orderDate = String($(this).data('order-date'));
        const orderNo = Number($(this).data('order-no'));

        console.log('[발주관리-삭제] 버튼 클릭(위임) ->', orderDate, orderNo);
        deleteOrder(orderDate, orderNo);
      });
    
    

  } catch (err) {
    console.error('❌ 매입전표 조회 에러:', err);
    alert('매입전표 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 매입전표 DataTable 초기화
 */
function initPurchaseTable() {
  console.log('[매입전표] DataTable 초기화 시작');

  try {
    const table = $('#purchaseTable').DataTable({
      ajax: {
        url: '/api/purchase/list',
        type: 'POST',
        data: function (d) {
          const siteCode = currentUser?.사업장코드 || '01';
          const startDate = $('#purchaseStartDate').val() || '';
          const endDate = $('#purchaseEndDate').val() || '';
          const status = $('#purchaseStatusFilter').val() || '0';

          console.log('[매입관리] DataTable AJAX 요청 파라미터:');
          console.log('  - 사업장코드:', siteCode);
          console.log('  - 시작일자:', startDate);
          console.log('  - 종료일자:', endDate);
          console.log('  - 상태코드:', status);

          return {
            사업장코드: siteCode,
            시작일자: startDate,
            종료일자: endDate,
            상태코드: status,
          };
        },
        dataSrc: function (json) {
          console.log('[매입전표] 서버 응답 수신:', json);
          console.log('  - 데이터 건수:', json.data ? json.data.length : 0);
          console.log('  - 전체 건수:', json.total || 0);
          return json.data || [];
        },
        error: function (xhr, error, code) {
          console.error(' [매입전표] AJAX 요청 실패:', {
            status: xhr.status,
            statusText: xhr.statusText,
            error: error,
            code: code,
            responseText: xhr.responseText,
          });
        },        
      },
      columns: [
        {
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function (data, type, row) {
            const uniqueId = `${row.사업장코드}_${row.매입일자}_${row.매입번호}`;
            return `<input type="checkbox" class="purchase-checkbox" data-purchase-date="${row.매입일자}" data-purchase-no="${row.매입번호}" data-unique-id="${uniqueId}">`;
          },
        },
        { data: '매입일자', className: 'dt-center' },
        { data: '매입번호', className: 'dt-center' },
        { data: '매입처코드', className: 'dt-center' },
        { data: '매입처명' },
        {
          data: '공급가액',
          className: 'dt-right',
          render: function (data) {
            return data ? data.toLocaleString() : '0';
          },
        },
        {
          data: '부가세액',
          className: 'dt-right',
          render: function (data) {
            return data ? data.toLocaleString() : '0';
          },
        },
        {
          data: '합계금액',
          className: 'dt-right',
          render: function (data) {
            return data ? data.toLocaleString() : '0';
          },
        },
        { data: '결제방법', className: 'dt-center' },
        {
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function (data, type, row) {
            const uniqueId = `${row.사업장코드}_${row.매입일자}_${row.매입번호}`;
            return `
              <div id="purchaseActions-${uniqueId}" style="display: none;">
                <button onclick="viewPurchase('${row.매입일자}', ${row.매입번호})" class="btn-view">상세</button>
                <button onclick="editPurchase('${row.매입일자}', ${row.매입번호})" class="btn-edit">수정</button>
                <button onclick="deletePurchase('${row.매입일자}', ${row.매입번호})" class="btn-delete">삭제</button>
              </div>
            `;
          },
        },
      ],
      language: {
        lengthMenu: '페이지당 _MENU_ 개씩 보기',
        zeroRecords: '발주 데이터가 없습니다',
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
      // order: [[1, 'desc'], [2, 'desc']],
      order: [], // 백엔드에서 제공하는 등록 순서 유지 (최신 등록이 맨 위)
      pageLength: 10,
      lengthMenu: [10, 25, 50, 100],
      responsive: true,
      autoWidth: false,
      drawCallback: function (settings) {
        // 전체선택 체크박스 상태 확인
        const isSelectAllChecked = $('#purchaseSelectAll').prop('checked');

        // 전체선택 상태에 따라 현재 페이지의 모든 체크박스 동기화
        $('.purchaseRowCheck').prop('checked', isSelectAllChecked);

        // DataTable이 다시 그려질 때마다 체크박스 상태에 따라 버튼 표시
        $('.purchaseRowCheck').each(function () {
          const $checkbox = $(this);
          // const orderDate = $checkbox.data('order-date');
          // const orderNo = $checkbox.data('order-no');
          const isChecked = $checkbox.prop('checked');
          // const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);
          // ✅ 서버에서 내려준 orderKey 우선, 없으면 fallback
          const purchaseKey = String(
            $checkbox.data('purchase-key') ||
              `${$checkbox.data('purchase-date')}_${$checkbox.data('purchase-no')}`,
          );

          const actionDiv = $(`#purchaseActions-${purchaseKey}`);

          // actionDiv가 없으면 그냥 넘어가되 디버깅 로그 남김(선택)
          if (actionDiv.length === 0) {
            console.warn('[버튼초기화] actionDiv 없음:', `#purchaseActions-${purchaseKey}`);
            return;
          }

          if (isChecked) {
            actionDiv.find('.purchaseBtnView').hide();
            actionDiv.find('.purchaseBtnEdit').show();
            actionDiv.find('.purchaseBtnDelete').show();
          } else {
            actionDiv.find('.purchaseBtnView').show();
            actionDiv.find('.purchaseBtnEdit').hide();
            actionDiv.find('.purchaseBtnDelete').hide();
          }
        });
      },
    });

    // 체크박스 이벤트
    $('#purchaseTable').on('change', '.purchase-checkbox', function () {
      const isChecked = $(this).is(':checked');
      const purchaseDate = $(this).data('purchase-date');
      const purchaseNo = $(this).data('purchase-no');
      const uniqueId = $(this).data('unique-id');

      console.log('[매입전표] 체크박스 이벤트 발생');
      console.log('매입일자:', purchaseDate, '(타입:', typeof purchaseDate + ')');
      console.log('매입번호:', purchaseNo, '(타입:', typeof purchaseNo + ')');
      console.log('체크 상태:', isChecked ? '선택됨' : '해제됨');

      if (isChecked) {
        // 다른 체크박스 모두 해제
        $('.purchase-checkbox').not(this).prop('checked', false);
        $('.purchase-checkbox').not(this).each(function() {
          const otherId = $(this).data('unique-id');
          $(`#purchaseActions-${otherId}`).hide();
        });

        // 선택된 행의 액션 버튼 표시
        $(`#purchaseActions-${uniqueId}`).show();
      } else {
        // 액션 버튼 숨김
        $(`#purchaseActions-${uniqueId}`).hide();
      }
    });

    console.log('매입전표관리 페이지에 있는 테이블 #purchaseTable 표시 완료');

  } catch (error) {
    console.error('❌ [매입전표] DataTable 초기화 오류:', error);
    console.error('   에러 스택:', error.stack);
    alert('매입전표 테이블 초기화 중 오류가 발생했습니다.\n\n' + error.message);
  }
}

// 전역 함수 등록
window.loadPurchaseList = loadPurchaseList;
window.initPurchaseTable = initPurchaseTable;

/**
 * 필터링 (상태, 날짜 범위) - 조회 버튼 클릭 시
 */
window.filterPurchase = function filterPurchase() {
  console.log('[매입전표] 조회 (id: searchOrderBtn) → searchOrder()');

  if (!window.orderTable || typeof window.orderTable.ajax?.reload !== 'function') {
    console.warn('window.purchaseTable이 초기화되지 않았습니다.');
    return;
  }
  // 조회 전에 선택상태 초기화 (UX 안정화)
  $('#orderSelectAll').prop('checked', false);
  $('.orderRowCheck').prop('checked', false);
  // 조회 전에 버튼 상태도 "상세만 보이게" 초기화
  // (actionDiv는 drawCallback에서 다시 한번 정리되지만,
  //  조회 직전에도 초기화해두면 화면 깜빡임/잔상 방지에 도움됩니다.)
  $('.action-buttons').each(function () {
    const $actionDiv = $(this);
    $actionDiv.find('.orderBtnView').show();
    $actionDiv.find('.orderBtnEdit').hide();
    $actionDiv.find('.orderBtnDelete').hide();
  });

  // 페이지 유지하고 조회만 새로고침 (필요하면 true/false 선택)
  // - false: 현재 페이지 유지 (추천)
  // - true: 첫 페이지로 이동
  window.orderTable.ajax.reload(null, false);
};

// ✅ Google Sheets 내보내기
function exportPurchaseToExcel() {
  console.log('[매입전표] Google Sheets 내보내기 (id: purchaseBtnExport) → exportPurchaseToGoogleSheets()');
  // alert('Google Sheets 내보내기 기능은 준비 중입니다.');
  try {
    if (!purchaseTable) {
      alert('견적 테이블이 초기화되지 않았습니다.');
      return;
    }

    // DataTable에서 현재 표시된 데이터 가져오기
    const dataToExport = purchaseTable.rows({ search: 'applied' }).data().toArray();

    if (dataToExport.length === 0) {
      alert('내보낼 견적 데이터가 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = ['거래번호', '매입처명', '거래일자', '제목', '견적금액', '담당자', '상태'];

    // CSV 특수문자 처리
    const escapeCsv = (value) => {
      const text = (value ?? '').toString().replace(/"/g, '""');
      return `"${text}"`;
    };

    // CSV 내용 생성
    let csvContent = '\uFEFF' + headers.join(',') + '\n'; // UTF-8 BOM 추가

    dataToExport.forEach((row) => {
      const statusMap = {
        1: '작성중',
        2: '승인',
        3: '반려',
      };
      const status = statusMap[row.상태코드] || '알수없음';

      // 견적일자 포맷 (YYYYMMDD → YYYY-MM-DD)
      let formattedDate = row.견적일자 || '';
      if (formattedDate.length === 8) {
        formattedDate = `${formattedDate.substring(0, 4)}-${formattedDate.substring(
          4,
          6,
        )}-${formattedDate.substring(6, 8)}`;
      }

      const rowData = [
        `${row.견적일자}-${row.견적번호}`,
        row.매출처명 || '-',
        formattedDate,
        row.제목 || '-',
        (row.견적금액 || 0).toLocaleString() + '원',
        row.담당자 || '-',
        status,
      ].map(escapeCsv);

      csvContent += rowData.join(',') + '\n';
    });

    // Blob 생성 및 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const fileName = `견적관리_${year}${month}${date}_${hours}${minutes}${seconds}.csv`;

    if (navigator.msSaveBlob) {
      // IE 10+
      navigator.msSaveBlob(blob, fileName);
    } else {
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    alert(
      `${dataToExport.length}개의 견적 정보가 CSV로 내보내졌습니다.\n\n📊 Google Sheets에서 불러오려면:\n1. sheets.google.com 접속\n2. 파일 > 가져오기 > 업로드\n3. 다운로드된 CSV 파일 선택`,
    );
  } catch (error) {
    console.error('❌ 견적 Google Sheets 내보내기 오류:', error);
    alert('내보내기 중 오류가 발생했습니다: ' + error.message);
  }
}
window.exportPurchaseToExcel = exportPurchaseToExcel;

// ============================================
// 매입전표 작성 모달
// ============================================

/**
 * 매입전표 작성 모달 열기
 */
function openNewPurchaseModal() {
  console.log('🔓 [매입작성] 모달 열림 → newPurchaseModal');

  try {
    const modal = document.getElementById('newPurchaseModal');
    if (!modal) {
      console.error('❌ newPurchaseModal 요소를 찾을 수 없습니다');
      alert('매입전표 작성 모달을 찾을 수 없습니다.');
      return;
    }

    // 입력 필드 초기화
    const purchaseDateInput = document.getElementById('purchaseDate');
    const supplierCodeInput = document.getElementById('selectedSupplierCode');
    const supplierNameInput = document.getElementById('selectedSupplierName');
    const paymentMethodSelect = document.getElementById('purchasePaymentMethod');

    if (purchaseDateInput) purchaseDateInput.value = new Date().toISOString().split('T')[0];
    if (supplierCodeInput) supplierCodeInput.value = '';
    if (supplierNameInput) supplierNameInput.value = '';
    if (paymentMethodSelect) paymentMethodSelect.value = '현금';

    // 품목 배열 초기화
    newPurchaseDetails = [];

    // 품목 테이블 렌더링
    if (typeof renderNewPurchaseDetailTable === 'function') {
      renderNewPurchaseDetailTable();
    }

    // 모달 표시
    modal.style.display = 'block';

    console.log('✅ [매입작성] 모달 표시 완료');

  } catch (error) {
    console.error('❌ [매입작성] 모달 열기 오류:', error);
    console.error('   에러 스택:', error.stack);
    alert('매입전표 작성 모달을 여는 중 오류가 발생했습니다.\n\n' + error.message);
  }
}

/**
 * 매입전표 작성 모달 닫기
 */
function closeNewPurchaseModal() {
  console.log('🔒 [매입작성] 모달 닫힘 → newPurchaseModal');

  const modal = document.getElementById('newPurchaseModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // 초기화
  newPurchaseDetails = [];

  console.log('✅ [매입작성] 모달 닫힘');
}

// ============================================
// 매입전표 수정 모달
// ============================================

/**
 * 매입전표 수정 모달 닫기
 */
function closePurchaseEditModal() {
  console.log('[매입관리-수정] 닫기 (onclick) → closePurchaseEditModal()');

  const modal = document.getElementById('purchaseEditModal');
  if (modal) {
    modal.style.display = 'none';
  }

  console.log('✅ 매입전표 수정 모달 닫기 완료');
}

// ============================================
// 매입전표 상세보기 모달
// ============================================

/**
 * 매입전표 상세보기 모달 닫기
 */
function closeViewPurchaseModal() {
  console.log('[매입관리-상세] 닫기 (onclick) → closeViewPurchaseModal()');

  const modal = document.getElementById('viewPurchaseModal');
  if (modal) {
    modal.style.display = 'none';
  }

  console.log('✅ 매입전표 상세보기 모달 닫기 완료');
}

// ============================================
// 매입처 검색 모달
// ============================================

/**
 * 매입처 검색 모달 닫기
 */
function closeSupplierSearchModalForPurchase() {
  console.log('[매입처검색모달] 닫기 (onclick) → closeSupplierSearchModalForPurchase()');

  const modal = document.getElementById('supplierSearchModalForPurchase');
  if (modal) {
    modal.style.display = 'none';
  }

  console.log('✅ 매입처 검색 모달 닫기 완료');
}

// ============================================
// 품목 추가 모달
// ============================================

/**
 * 매입 작성 - 품목 추가 모달 열기
 */
function openPurchaseDetailAddModal() {
  console.log('🔓 [품목추가-신규] 모달 열림');

  // 모드 설정
  purchaseDetailAddMode = 'new';

  // 공통 모달 열기
  openPurchaseDetailAddModalCommon();
}

/**
 * 매입 수정 - 품목 추가 모달 열기
 */
function addPurchaseDetailRowInEdit() {
  console.log('🔓 [품목추가-수정] 모달 열림');

  // 모드 설정
  purchaseDetailAddMode = 'edit';

  // 공통 모달 열기
  openPurchaseDetailAddModalCommon();
}

/**
 * 품목 추가 모달 열기 (공통)
 */
function openPurchaseDetailAddModalCommon() {
  try {
    console.log('🔓 [품목추가] 모달 열기 (모드:', purchaseDetailAddMode + ')');

    // 선택된 품목 초기화
    selectedPurchaseMaterial = null;

    // 검색 필드 초기화
    const searchCode = document.getElementById('purchaseMaterialSearchCode');
    const searchName = document.getElementById('purchaseMaterialSearchName');

    if (searchCode) searchCode.value = '';
    if (searchName) searchName.value = '';

    // 입력 필드 초기화
    const qtyInput = document.getElementById('addPurchaseDetailQuantity');
    const priceInput = document.getElementById('addPurchaseDetailUnitPrice');
    const supplyPriceInput = document.getElementById('addPurchaseDetailSupplyPrice');

    if (qtyInput) qtyInput.value = '1';
    if (priceInput) priceInput.value = '0';
    if (supplyPriceInput) supplyPriceInput.value = '0';

    // 검색 결과 숨기기
    const searchResults = document.getElementById('purchaseMaterialSearchResults');
    if (searchResults) {
      searchResults.style.display = 'none';
    }

    // 모달 표시
    const modal = document.getElementById('purchaseDetailAddModal');
    if (modal) {
      modal.style.display = 'block';
      console.log('✅ [품목추가] 모달 표시 완료 (모드:', purchaseDetailAddMode + ')');
    } else {
      console.error('❌ [품목추가] purchaseDetailAddModal 요소를 찾을 수 없습니다');
      alert('품목 추가 모달을 찾을 수 없습니다.');
      return;
    }

    // 드래그 기능 활성화 (최초 1회만)
    if (!window.purchaseDetailAddModalDraggable) {
      makeModalDraggable('purchaseDetailAddModal', 'purchaseDetailAddModalHeader');
      window.purchaseDetailAddModalDraggable = true;
    }

  } catch (error) {
    console.error('❌ [품목추가] 모달 열기 오류:', error);
    console.error('   에러 스택:', error.stack);
    alert('품목 추가 모달을 여는 중 오류가 발생했습니다.\n\n' + error.message);
  }
}

/**
 * 품목 추가 모달 닫기
 */
function closePurchaseDetailAddModal() {
  console.log('🔒 [품목추가] 모달 닫기');

  const modal = document.getElementById('purchaseDetailAddModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // 초기화
  selectedPurchaseMaterial = null;
  purchaseDetailAddMode = 'new';

  console.log('✅ [품목추가] 모달 닫기 및 초기화 완료');
}

// ============================================
// 품목 수정 모달
// ============================================

/**
 * 품목 수정 모달 닫기
 */
function closePurchaseDetailEditModal() {
  console.log('[품목수정] 닫기 (onclick) → closePurchaseDetailEditModal()');

  const modal = document.getElementById('purchaseDetailEditModal');
  if (modal) {
    modal.style.display = 'none';
  }

  console.log('✅ 품목 수정 모달 닫기 완료');
}

// ============================================
// 품목 삭제 모달
// ============================================

/**
 * 품목 삭제 모달 닫기
 */
function closePurchaseDetailDeleteModal() {
  console.log('[상세삭제확인모달] 닫기 → closePurchaseDetailDeleteModal()');

  const modal = document.getElementById('purchaseDetailDeleteModal');
  if (modal) {
    modal.style.display = 'none';
    delete modal.dataset.rowId;
  }

  console.log('✅ 품목 삭제 모달 닫기 완료');
}

// ============================================
// 매입전표 삭제 모달
// ============================================

/**
 * 매입전표 삭제 모달 닫기
 */
function closePurchaseDeleteModal() {
  console.log('[매입관리-삭제] 닫기 (onclick) → closePurchaseDeleteModal()');

  const modal = document.getElementById('purchaseDeleteModal');
  if (modal) {
    modal.style.display = 'none';
  }

  console.log('✅ 매입전표 삭제 모달 닫기 완료');
}

// ============================================
// 전역 함수 등록
// ============================================
window.openNewPurchaseModal = openNewPurchaseModal;
window.closeNewPurchaseModal = closeNewPurchaseModal;
window.closePurchaseEditModal = closePurchaseEditModal;
window.closeViewPurchaseModal = closeViewPurchaseModal;
window.closeSupplierSearchModalForPurchase = closeSupplierSearchModalForPurchase;
window.openPurchaseDetailAddModal = openPurchaseDetailAddModal;
window.addPurchaseDetailRowInEdit = addPurchaseDetailRowInEdit;
window.openPurchaseDetailAddModalCommon = openPurchaseDetailAddModalCommon;
window.closePurchaseDetailAddModal = closePurchaseDetailAddModal;
window.closePurchaseDetailEditModal = closePurchaseDetailEditModal;
window.closePurchaseDetailDeleteModal = closePurchaseDetailDeleteModal;
window.closePurchaseDeleteModal = closePurchaseDeleteModal;

// ============================================
// 품목 추가
// ============================================

/**
 * 신규/수정 모달에서 품목 추가 확인 (공용)
 */
function confirmPurchaseDetailAdd() {
  console.log('✅ [품목추가] 추가 확인 (모드:', purchaseDetailAddMode + ')');

  try {
    // 자재 선택 확인
    if (!selectedPurchaseMaterial) {
      alert('자재를 검색하여 선택해주세요.');
      return;
    }

    // 입력값 가져오기
    const qtyInput = document.getElementById('addPurchaseDetailQuantity');
    const priceInput = document.getElementById('addPurchaseDetailUnitPrice');
    const supplyPriceInput = document.getElementById('addPurchaseDetailSupplyPrice');

    if (!qtyInput || !priceInput || !supplyPriceInput) {
      console.error('❌ 입력 필드를 찾을 수 없습니다.');
      alert('입력 필드를 찾을 수 없습니다.');
      return;
    }

    const quantity = Number(qtyInput.value) || 0;
    const unitPrice = Number(priceInput.value) || 0;
    const supplyPrice = Number(supplyPriceInput.value) || 0;

    // 입력값 유효성 검사
    if (quantity <= 0) {
      alert('수량은 1 이상 입력해주세요.');
      qtyInput.focus();
      return;
    }

    if (unitPrice < 0) {
      alert('단가는 0 이상 입력해주세요.');
      priceInput.focus();
      return;
    }

    // 자재코드 생성
    const materialCode =
      selectedPurchaseMaterial.품목코드 ||
      selectedPurchaseMaterial.분류코드 + selectedPurchaseMaterial.세부코드;

    if (!materialCode) {
      console.error('❌ 자재코드를 생성할 수 없습니다:', selectedPurchaseMaterial);
      alert('자재코드를 확인할 수 없습니다.');
      return;
    }

    console.log('📝 추가할 자재 정보:', {
      자재코드: materialCode,
      자재명: selectedPurchaseMaterial.품목명,
      수량: quantity,
      단가: unitPrice,
      공급가액: supplyPrice,
    });

    // 모드에 따라 처리
    if (purchaseDetailAddMode === 'new') {
      // 신규 매입전표 작성 모드
      console.log('🆕 [품목추가-신규] newPurchaseDetails 배열에 추가');

      // 새 품목 객체 생성 (rowId를 순수 숫자로)
      const newDetail = {
        rowId: Date.now(),
        자재코드: materialCode,
        자재명: selectedPurchaseMaterial.품목명,
        규격: selectedPurchaseMaterial.규격,
        단위: selectedPurchaseMaterial.단위,
        수량: quantity,
        단가: unitPrice,
        공급가액: supplyPrice,
      };

      newPurchaseDetails.push(newDetail);

      console.log('✅ [품목추가-신규] 추가 완료:', {
        자재코드: materialCode,
        자재명: selectedPurchaseMaterial.품목명,
        rowId: newDetail.rowId,
        전체품목수: newPurchaseDetails.length,
      });

      // 테이블 렌더링
      if (typeof renderNewPurchaseDetailTable === 'function') {
        renderNewPurchaseDetailTable();
      } else {
        console.warn('⚠️ renderNewPurchaseDetailTable 함수가 정의되어 있지 않습니다');
      }

    } else {
      // 매입전표 수정 모드
      console.log('✏️ [품목추가-수정] DataTable에 추가');

      const table = window.purchaseEditDetailTable;

      if (!table || typeof table.rows !== 'function') {
        console.error('❌ purchaseEditDetailTable이 초기화되지 않았습니다');
        alert('매입전표 상세 테이블이 준비되지 않았습니다.');
        return;
      }

      // 새 품목 객체 생성
      const newDetail = {
        rowId: Date.now(),
        자재코드: materialCode,
        자재명: selectedPurchaseMaterial.품목명,
        규격: selectedPurchaseMaterial.규격,
        단위: selectedPurchaseMaterial.단위,
        수량: quantity,
        단가: unitPrice,
        공급가액: supplyPrice,
      };

      table.row.add(newDetail).draw(false);

      console.log('✅ [품목추가-수정] 추가 완료:', {
        자재코드: materialCode,
        자재명: selectedPurchaseMaterial.품목명,
        rowId: newDetail.rowId,
      });
    }

    closePurchaseDetailAddModal();

  } catch (error) {
    console.error('❌ 자재 추가 오류:', error);
    console.error('   에러 스택:', error.stack);
    alert('자재 추가 중 오류가 발생했습니다.\n\n' + error.message);
  }
}

// ============================================
// 품목 수정
// ============================================

/**
 * 품목 수정 확인
 */
function confirmPurchaseDetailEdit() {
  console.log('✅ [품목수정] 수정완료 버튼 클릭 → confirmPurchaseDetailEdit()');

  try {
    const modal = document.getElementById('purchaseDetailEditModal');

    if (!modal) {
      alert('purchaseDetailEditModal을 찾을 수 없습니다.');
      return;
    }

    const mode = modal.dataset.mode || 'edit';
    const rowIdStr = modal.dataset.rowId;

    console.log('  - 모드:', mode);
    console.log('  - rowId:', rowIdStr);

    if (!rowIdStr) {
      throw new Error('수정할 품목의 ID가 없습니다.');
    }

    // 입력값 가져오기
    const qtyInput = document.getElementById('editPurchaseDetailQuantity');
    const priceInput = document.getElementById('editPurchaseDetailUnitPrice');
    const supplyPriceInput = document.getElementById('editPurchaseDetailSupplyPrice');

    if (!qtyInput || !priceInput || !supplyPriceInput) {
      alert('수정 입력 요소를 찾을 수 없습니다.');
      return;
    }

    const quantity = Number(qtyInput.value) || 0;
    const unitPrice = Number(priceInput.value) || 0;
    const supplyPrice = Number(supplyPriceInput.value) || 0;

    if (quantity <= 0) {
      alert('수량은 1 이상 입력해주세요.');
      qtyInput.focus();
      return;
    }

    console.log('📝 [품목수정] 입력값:', { 수량: quantity, 단가: unitPrice, 공급가액: supplyPrice });

    // 모드에 따라 처리
    if (mode === 'new') {
      // 신규 모드
      console.log('🆕 [품목수정-신규] newPurchaseDetails 배열 업데이트');

      const targetIndex = newPurchaseDetails.findIndex(
        (item) => String(item.rowId) === String(rowIdStr) || item.rowId === Number(rowIdStr)
      );

      if (targetIndex < 0) {
        console.error('❌ newPurchaseDetails에서 대상 품목을 찾을 수 없습니다');
        alert('수정할 자재 정보를 찾을 수 없습니다.');
        return;
      }

      const targetItem = newPurchaseDetails[targetIndex];

      newPurchaseDetails[targetIndex] = {
        ...targetItem,
        수량: quantity,
        단가: unitPrice,
        공급가액: supplyPrice,
      };

      console.log('✅[품목수정-신규] 수정 완료');

      if (typeof renderNewPurchaseDetailTable === 'function') {
        renderNewPurchaseDetailTable();
      }

    } else {
      // 수정 모드
      console.log('✏️ [품목수정-기존] DataTable 업데이트');

      const table = window.purchaseEditDetailTable;

      if (!table) {
        console.error('❌ purchaseEditDetailTable이 초기화되지 않았습니다');
        alert('매입전표 상세 테이블이 준비되지 않았습니다.');
        return;
      }

      const allRowsData = table.rows().data().toArray();
      const targetRowIndex = allRowsData.findIndex((row) => {
        return String(row.rowId) === String(rowIdStr) || row.rowId === Number(rowIdStr);
      });

      if (targetRowIndex === -1) {
        console.error('❌ DataTable에서 대상 rowId를 찾을 수 없습니다');
        alert('수정할 자재 정보를 찾을 수 없습니다.');
        return;
      }

      const targetRowData = allRowsData[targetRowIndex];

      targetRowData.수량 = quantity;
      targetRowData.단가 = unitPrice;
      targetRowData.공급가액 = supplyPrice;

      console.log('[품목수정-기존] 수정 완료');

      try {
        const rowNode = table.row(targetRowIndex);
        rowNode.data(targetRowData).invalidate();
        table.draw(false);
        console.log('✏️ [품목수정-기존] DataTable 업데이트 완료');
      } catch (drawError) {
        table.clear();
        table.rows.add(allRowsData);
        table.draw(false);
        console.log('✏️ [품목수정-기존] DataTable 전체 재렌더링 완료');
      }
    }

    modal.style.display = 'none';
    console.log('✅ [품목수정] 품목 수정 완료');

  } catch (error) {
    console.error('❌ [품목수정] 품목 수정 오류:', error);
    alert('품목 수정 중 오류가 발생했습니다.\n\n' + error.message);
  }
}

// ============================================
// 품목 삭제
// ============================================

/**
 * 매입 품목 삭제 (행 단위)
 */
function deletePurchaseDetailRow(rowId) {
  console.log('[매입전표수정-상세테이블] 삭제 버튼 클릭 → deletePurchaseDetailRow()', rowId);

  try {
    if (!rowId) {
      alert('삭제할 행(rowId)이 올바르지 않습니다.');
      return;
    }

    const table = window.purchaseEditDetailTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    const tableDataArray = table.rows().data().toArray();
    const targetRow = tableDataArray.find((row) => String(row.rowId) === String(rowId) || row.rowId === Number(rowId));

    if (!targetRow) {
      console.error('❌ 찾을 수 없는 rowId:', rowId);
      alert('삭제할 자재 정보를 찾을 수 없습니다.');
      return;
    }

    const modal = document.getElementById('purchaseDetailDeleteModal');
    const infoEl = document.getElementById('deletePurchaseDetailInfo');

    if (!modal) {
      console.error('❌ purchaseDetailDeleteModal을 찾을 수 없습니다');
      alert('삭제 확인 모달을 찾을 수 없습니다.');
      return;
    }

    if (infoEl) {
      infoEl.textContent = `[${targetRow.자재코드 || '-'}] ${targetRow.자재명 || '-'}`;
    }

    modal.dataset.rowId = rowId;
    modal.style.display = 'flex';

    console.log('✅ 삭제 모달 표시');

  } catch (err) {
    console.error('❌ 품목 삭제 모달 열기 오류:', err);
    alert('품목 삭제 모달을 여는 중 오류가 발생했습니다.');
  }
}

/**
 * 매입 품목 삭제 확인
 */
function confirmPurchaseDetailDelete() {
  console.log('[상세삭제확인모달] 삭제하기 → confirmPurchaseDetailDelete()');

  try {
    const modal = document.getElementById('purchaseDetailDeleteModal');
    if (!modal) {
      alert('삭제 확인 모달을 찾을 수 없습니다.');
      return;
    }

    const rowId = modal.dataset.rowId;
    if (!rowId) {
      alert('삭제 대상(rowId)을 찾을 수 없습니다.');
      return;
    }

    const table = window.purchaseEditDetailTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    const allRows = table.rows().data().toArray();
    const rowIndex = allRows.findIndex((r) => String(r.rowId) === String(rowId) || r.rowId === Number(rowId));

    if (rowIndex < 0) {
      alert('삭제할 행 데이터를 찾을 수 없습니다.');
      return;
    }

    table.row(rowIndex).remove().draw(false);

    console.log(`✅ 품목 삭제 완료 (rowId: ${rowId})`);

    closePurchaseDetailDeleteModal();

  } catch (err) {
    console.error('❌ 품목 삭제 오류:', err);
    alert('품목 삭제 중 오류가 발생했습니다.');
  }
}

/**
 * 신규 매입전표 작성 - 품목 삭제
 */
function deleteNewPurchaseDetail(rowId) {
  console.log('[매입전표작성-상세테이블] 삭제 → id:', rowId);

  try {
    const targetIndex = newPurchaseDetails.findIndex(
      (item) => String(item.rowId) === String(rowId) || item.rowId === Number(rowId)
    );

    if (targetIndex < 0) {
      console.error('❌ 삭제할 품목을 찾을 수 없습니다');
      alert('삭제할 품목을 찾을 수 없습니다.');
      return;
    }

    newPurchaseDetails.splice(targetIndex, 1);

    console.log('✅ 품목 삭제 완료');

    if (typeof renderNewPurchaseDetailTable === 'function') {
      renderNewPurchaseDetailTable();
    }

  } catch (error) {
    console.error('❌ 품목 삭제 오류:', error);
    alert('품목 삭제 중 오류가 발생했습니다.');
  }
}

// ============================================
// 매입전표 삭제
// ============================================

/**
 * 매입전표 삭제 확인
 */
function confirmPurchaseDelete() {
  console.log('[매입관리-삭제] 삭제하기 (onclick) → confirmPurchaseDelete()');

  try {
    const modal = document.getElementById('purchaseDeleteModal');
    if (!modal) {
      alert('삭제 확인 모달을 찾을 수 없습니다.');
      return;
    }

    const purchaseDate = modal.dataset.purchaseDate;
    const purchaseNo = modal.dataset.purchaseNo;

    if (!purchaseDate || !purchaseNo) {
      alert('삭제할 매입전표 정보가 없습니다.');
      return;
    }

    fetch('/api/purchase/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        매입일자: purchaseDate,
        매입번호: purchaseNo,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          console.log('✅ 매입전표 삭제 성공');
          alert('매입전표가 삭제되었습니다.');
          closePurchaseDeleteModal();

          if (typeof loadPurchaseList === 'function') {
            loadPurchaseList();
          }
        } else {
          console.error('❌ 매입전표 삭제 실패:', data.message);
          alert('매입전표 삭제에 실패했습니다.\n\n' + (data.message || ''));
        }
      })
      .catch((error) => {
        console.error('❌ 매입전표 삭제 오류:', error);
        alert('매입전표 삭제 중 오류가 발생했습니다.');
      });

  } catch (error) {
    console.error('❌ 매입전표 삭제 오류:', error);
    alert('매입전표 삭제 중 오류가 발생했습니다.');
  }
}

// ============================================
// 전역 함수 등록
// ============================================
window.confirmPurchaseDetailAdd = confirmPurchaseDetailAdd;
window.confirmPurchaseDetailEdit = confirmPurchaseDetailEdit;
window.deletePurchaseDetailRow = deletePurchaseDetailRow;
window.confirmPurchaseDetailDelete = confirmPurchaseDetailDelete;
window.deleteNewPurchaseDetail = deleteNewPurchaseDetail;
window.confirmPurchaseDelete = confirmPurchaseDelete;