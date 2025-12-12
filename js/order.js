/**
 * 발주관리 페이지 - DataTable 구현
 * 견적관리(quotation.js)와 동일한 패턴 적용
 */

// 전역 변수로 DataTable 인스턴스 저장
let orderListTableInstance = null;
let isSelectAllMode = false; // 전체선택 모드 플래그

// ==================== 전역 함수 정의 (최상단) ====================
// 발주서용 매입처 선택 함수 - 고유한 이름 사용 (다른 모듈과 충돌 방지)
window.selectOrderSupplier = function selectOrderSupplier(supplier) {
  try {
    // 매입처 코드와 이름 설정
    const codeInput = document.getElementById('selectedSupplierCode');
    const nameInput = document.getElementById('selectedSupplierName');

    if (!codeInput || !nameInput) {
      console.error('❌ 입력 필드를 찾을 수 없습니다!');
      alert('입력 필드를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    codeInput.value = supplier.매입처코드;
    nameInput.value = supplier.매입처명;

    // 선택된 매입처 정보 표시
    const infoDiv = document.getElementById('selectedSupplierInfo');
    const displaySpan = document.getElementById('selectedSupplierDisplay');

    if (infoDiv && displaySpan) {
      displaySpan.textContent = `[${supplier.매입처코드}] ${supplier.매입처명}`;
      infoDiv.style.display = 'block';
    }

    // 모달 닫기
    window.closeSupplierSearchModal();
  } catch (err) {
    console.error('❌ selectOrderSupplier 에러:', err);
    alert('매입처 선택 중 오류가 발생했습니다: ' + err.message);
  }
};

// 매입처 검색 모달 닫기 함수
window.closeSupplierSearchModal = function closeSupplierSearchModal() {
  const modal = document.getElementById('supplierSearchModal');
  if (modal) {
    modal.style.display = 'none';
  }
};
// ==================================================================


/**
 * 발주 목록 조회 및 DataTable에 로드
 */
async function loadOrderList() {
  // ✅ 다른 페이지의 체크박스 이벤트 핸들러 제거
  $(document).off('change.quotationPage');
  $(document).off('change.transactionPage');
  $(document).off('change.purchasePage');

  // 페이지가 표시될 때마다 날짜를 오늘 날짜로 초기화
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const startDateInput = document.getElementById('orderStartDate');
  const endDateInput = document.getElementById('orderEndDate');

  // 항상 오늘 날짜로 설정
  if (startDateInput) {
    startDateInput.value = todayStr;
  }
  if (endDateInput) {
    endDateInput.value = todayStr;
  }

  // 이미 DataTable이 존재하면 파괴
  if (orderListTableInstance) {
    orderListTableInstance.destroy();
    orderListTableInstance = null;
  }

  // DataTable 초기화
  orderListTableInstance = $('#orderListTable').DataTable({
    ajax: {
      url: '/api/orders',
      data: function (d) {
        // 필터링 파라미터 추가
        const 사업장코드 = currentUser?.사업장코드 || '01';
        const 상태코드 = $('#orderStatusFilter').val();
        const startDate = $('#orderStartDate').val()?.replace(/-/g, '') || '';
        const endDate = $('#orderEndDate').val()?.replace(/-/g, '') || '';

        return {
          사업장코드: 사업장코드,
          상태코드: 상태코드,
          orderStartDate: startDate,
          orderEndDate: endDate,
        };
      },
      dataSrc: function (json) {
        // 발주 건수 업데이트
        const countEl = document.getElementById('orderCount');
        if (countEl && json.total !== undefined) {
          countEl.innerText = `${json.total.toLocaleString()}`;
        }

        return json.data || [];
      },
    },
    columns: [
      // 1. 체크박스
      {
        data: null,
        orderable: false,
        render: function (data, type, row) {
          return `<input type="checkbox" class="orderRowCheck" data-order-date="${row.발주일자}" data-order-no="${row.발주번호}" />`;
        },
      },
      // 2. 순번
      {
        data: null,
        className: 'dt-center',
        render: (data, type, row, meta) => meta.row + 1,
      },
      // 3. 발주번호 (일자-번호)
      {
        data: null,
        render: function (data, type, row) {
          return `${row.발주일자}-${row.발주번호}`;
        },
      },
      // 4. 매입처명
      {
        data: '매입처명',
        defaultContent: '-',
      },
      // 5. 발주일자 (YYYY-MM-DD 포맷)
      {
        data: '발주일자',
        render: function (data) {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      // 6. 제목
      {
        data: '제목',
        defaultContent: '-',
      },
      // 7. 발주금액
      {
        data: '합계금액',
        render: function (data) {
          if (!data) return '0원';
          return data.toLocaleString() + '원';
        },
      },
      // 8. 담당자
      {
        data: '사용자명',
        defaultContent: '-',
      },
      // 9. 상태 (배지)
      {
        data: '상태코드',
        render: function (data) {
          const statusMap = {
            0: { text: '발주대기', class: 'status-pending' },
            1: { text: '발주완료', class: 'status-active' },
            2: { text: '입고완료', class: 'status-completed' },
          };
          const status = statusMap[data] || { text: '알수없음', class: '' };
          return `<span class="status-badge ${status.class}">${status.text}</span>`;
        },
      },
      // 10. 관리 버튼
      {
        data: null,
        orderable: false,
        render: function (data, type, row) {
          const orderKey = `${row.발주일자}_${row.발주번호}`;
          return `
            <div class="action-buttons" id="orderActions-${orderKey}">
              <button class="btn-icon orderBtnView" onclick="viewOrderDetail('${row.발주일자}', ${row.발주번호})" title="상세보기">상세</button>
              <button class="btn-icon orderBtnEdit" style="display: none;" onclick="editOrder('${row.발주일자}', ${row.발주번호})" title="수정">수정</button>
              <button class="btn-icon orderBtnDelete" style="display: none;" onclick="deleteOrder('${row.발주일자}', ${row.발주번호})" title="삭제">삭제</button>
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
    order: [], // 백엔드에서 제공하는 등록 순서 유지 (최신 등록이 맨 위)
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    responsive: true,
    autoWidth: false,
    drawCallback: function (settings) {
      // 전체선택 체크박스 상태 확인
      const isSelectAllChecked = $('#orderSelectAll').prop('checked');

      // 전체선택 상태에 따라 현재 페이지의 모든 체크박스 동기화
      $('.orderRowCheck').prop('checked', isSelectAllChecked);

      // DataTable이 다시 그려질 때마다 체크박스 상태에 따라 버튼 표시
      $('.orderRowCheck').each(function () {
        const $checkbox = $(this);
        const orderDate = $checkbox.data('order-date');
        const orderNo = $checkbox.data('order-no');
        const isChecked = $checkbox.prop('checked');
        const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

        if (isChecked) {
          actionDiv.find('.orderBtnView').hide();
          actionDiv.find('.orderBtnEdit').show();
          actionDiv.find('.orderBtnDelete').show();
        } else {
          actionDiv.find('.orderBtnView').show();
          actionDiv.find('.orderBtnEdit').hide();
          actionDiv.find('.orderBtnDelete').hide();
        }
      });
    },
  });

  // ✅ 전체선택 체크박스 이벤트 핸들러 등록
  $(document)
    .off('change.orderPage', '#orderSelectAll')
    .on('change.orderPage', '#orderSelectAll', function () {
    const isChecked = $(this).prop('checked');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 [발주관리] 전체선택 체크박스 클릭');
    console.log(`✅ 체크 상태: ${isChecked ? '전체 선택' : '전체 해제'}`);

    // 전체선택 모드 플래그 설정
    isSelectAllMode = true;
    $('.orderRowCheck').prop('checked', isChecked).trigger('change');
    isSelectAllMode = false;

    console.log('✅ 전체선택 처리 완료');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });

  // ✅ 개별 체크박스 이벤트 핸들러 등록
  $(document)
    .off('change.orderPage', '.orderRowCheck')
    .on('change.orderPage', '.orderRowCheck', function () {
    const $currentCheckbox = $(this);
    const orderDate = $currentCheckbox.data('order-date');
    const orderNo = $currentCheckbox.data('order-no');
    const isChecked = $currentCheckbox.prop('checked');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 [발주관리] 체크박스 이벤트 발생');
    console.log(`📅 발주일자: ${orderDate} (타입: ${typeof orderDate})`);
    console.log(`🔢 발주번호: ${orderNo} (타입: ${typeof orderNo})`);
    console.log(`✅ 체크 상태: ${isChecked ? '선택됨' : '해제됨'}`);
    console.log(`🔧 전체선택 모드: ${isSelectAllMode}`);

    // 개별 선택 모드일 때만 단일 선택 로직 실행
    if (!isSelectAllMode && isChecked) {
      // 체크된 경우: 다른 모든 체크박스 해제
      $('.orderRowCheck').not($currentCheckbox).each(function() {
        const $otherCheckbox = $(this);
        const otherDate = $otherCheckbox.data('order-date');
        const otherNo = $otherCheckbox.data('order-no');

        // 다른 체크박스 해제
        $otherCheckbox.prop('checked', false);

        // 다른 행의 버튼 숨김 처리
        const otherActionDiv = $(`#orderActions-${otherDate}_${otherNo}`);
        otherActionDiv.find('.orderBtnView').show();
        otherActionDiv.find('.orderBtnEdit').hide();
        otherActionDiv.find('.orderBtnDelete').hide();
      });

      console.log('✅ 다른 모든 체크박스 해제됨 (개별 선택 모드)');
    }

    // 개별 선택 모드일 때만 전체 선택 체크박스 해제
    if (!isSelectAllMode) {
      $('#orderSelectAll').prop('checked', false);
    }

    // 현재 행의 버튼 표시/숨김 처리
    const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);
    console.log(`🔍 찾을 액션 DIV ID: #orderActions-${orderDate}_${orderNo}`);
    console.log(`🔍 actionDiv 발견됨: ${actionDiv.length > 0 ? '예' : '아니오'}`);
    if (actionDiv.length === 0) {
      console.error(`❌ 액션 DIV를 찾을 수 없습니다! ID: #orderActions-${orderDate}_${orderNo}`);
      console.log('🔍 현재 페이지의 모든 액션 DIV:');
      $('.action-buttons').each(function() {
        console.log(`  - ${$(this).attr('id')}`);
      });
    }

    if (isChecked) {
      // 체크됨: 상세 버튼 숨기고 수정/삭제 버튼 표시
      actionDiv.find('.orderBtnView').hide();
      actionDiv.find('.orderBtnEdit').show();
      actionDiv.find('.orderBtnDelete').show();

      console.log('🔘 표시된 버튼:');
      console.log('   ❌ [상세보기] 버튼 - 숨김');
      console.log('   ✅ [수정] 버튼 - 표시');
      console.log('   ✅ [삭제] 버튼 - 표시');
    } else {
      // 체크 해제: 수정/삭제 버튼 숨기고 상세 버튼 표시
      actionDiv.find('.orderBtnView').show();
      actionDiv.find('.orderBtnEdit').hide();
      actionDiv.find('.orderBtnDelete').hide();

      console.log('🔘 표시된 버튼:');
      console.log('   ✅ [상세보기] 버튼 - 표시');
      console.log('   ❌ [수정] 버튼 - 숨김');
      console.log('   ❌ [삭제] 버튼 - 숨김');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
}

/**
 * 페이지 로드 시 초기화
 */
$(document).ready(function () {
  // 발주서 작성 모달 드래그 기능
  makeModalDraggable('orderModalContent', 'orderModalHeader');
  // 발주서 수정 모달 드래그 기능
  makeModalDraggable('orderEditModalContent', 'orderEditModalHeader');
  // 발주 상세 보기 모달 드래그 기능
  makeModalDraggable('orderDetailModalContent', 'orderDetailModalHeader');

  // ✅ 상세 보기 모달 닫기 버튼
  $('#closeOrderDetailModal').on('click', () => {
    closeOrderDetailModal();
  });

  // ✅ 상세보기 모달 배경 클릭시 닫기
  $(document).on('click', '#orderDetailModal', function (e) {
    if (e.target.id === 'orderDetailModal') {
      closeOrderDetailModal();
    }
  });

  // ✅ 수정 모달 닫기 버튼
  $('#closeOrderEditModalBtn').on('click', () => {
    closeOrderEditModal();
  });

  // ✅ 수정 모달 배경 클릭시 닫기
  $(document).on('click', '#orderEditModal', function (e) {
    if (e.target.id === 'orderEditModal') {
      closeOrderEditModal();
    }
  });

  // ✅ 발주서 작성 모달 닫기 버튼
  $('#closeOrderModal').on('click', () => {
    closeOrderModal();
  });

  // ✅ 품목 추가 모달 닫기 버튼
  $('#closeOrderDetailAddModal').on('click', () => {
    closeOrderDetailAddModal();
  });

  // ✅ 품목 수정 모달 닫기 버튼
  $('#closeOrderDetailEditModal').on('click', () => {
    closeOrderDetailEditModal();
  });

  // ✅ 단가 이력 모달 닫기 버튼
  $('#closeOrderPriceHistoryModal').on('click', () => {
    closeOrderPriceHistoryModal();
  });

  // ✅ 품목 추가 모달 - 금액 자동 계산 (발주량 × 입고단가)
  $('#addOrderDetailQuantity, #addOrderDetailInPrice').on('input', function () {
    const 발주량 = parseFloat($('#addOrderDetailQuantity').val()) || 0;
    const 입고단가 = parseFloat($('#addOrderDetailInPrice').val()) || 0;
    const 금액 = 발주량 * 입고단가;
    $('#addOrderDetailAmount').text(금액.toLocaleString() + '원');
  });

  // ✅ 품목 수정 모달 - 금액 자동 계산 (발주량 × 입고단가)
  $('#editOrderDetailQuantity, #editOrderDetailInPrice').on('input', function () {
    const 발주량 = parseFloat($('#editOrderDetailQuantity').val()) || 0;
    const 입고단가 = parseFloat($('#editOrderDetailInPrice').val()) || 0;
    const 금액 = 발주량 * 입고단가;
    $('#editOrderDetailAmount').text(금액.toLocaleString() + '원');
  });

  // ✅ 자재 검색 - Enter 키 이벤트
  $(document).on('keypress', '#orderMaterialSearchInput', function (e) {
    if (e.which === 13) {
      // Enter 키
      e.preventDefault();
      searchOrderMaterials();
    }
  });

  // ✅ 신규 발주서 자재 검색 - Enter 키 이벤트
  $(document).on('keypress', '#newOrderMaterialSearchCode, #newOrderMaterialSearchName, #newOrderMaterialSearchSpec', function (e) {
    if (e.which === 13) {
      // Enter 키
      e.preventDefault();
      searchNewOrderMaterials();
    }
  });

  // 전역으로 접근 가능하도록 window에 등록
  window.loadOrderList = loadOrderList;
});

// ==================== 발주 상세 조회 및 모달 ====================
/**
 * 발주 상세보기
 */
async function viewOrderDetail(orderDate, orderNo) {
  try {
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`);

    if (!result.success) {
      alert('발주 정보를 불러올 수 없습니다.');
      return;
    }

    const master = result.data.master;
    const details = result.data.detail || [];

    // 💾 현재 발주 상세 정보 저장 (출력 버튼용)
    window.currentOrderDetail = {
      발주일자: orderDate,
      발주번호: orderNo,
    };

    // 기본 정보 표시
    document.getElementById('orderDetailNo').textContent = `${orderDate}-${orderNo}`;
    document.getElementById('orderDetailDate').textContent = orderDate.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('orderDetailSupplier').textContent = master.매입처명 || '-';
    document.getElementById('orderDetailRemark').textContent = master.적요 || '-';

    // ✅ DataTable이 이미 초기화되어 있으면 destroy 후 재생성
    if (window.orderDetailDataTable) {
      window.orderDetailDataTable.destroy();
    }

    // ✅ DataTable 초기화 (견적관리와 동일한 구조)
    window.orderDetailDataTable = $('#orderDetailTable').DataTable({
      data: details || [],
      columns: [
        {
          data: '자재코드',
          defaultContent: '-',
        },
        {
          data: '자재명',
          defaultContent: '-',
        },
        {
          data: '규격',
          defaultContent: '-',
        },
        {
          data: '단위',
          defaultContent: '-',
        },
        {
          data: '발주량',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          data: '입고단가',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          data: null,
          defaultContent: 0,
          render: function (data, type, row) {
            const 금액 = (row.발주량 || 0) * (row.입고단가 || 0);
            return 금액.toLocaleString();
          },
          className: 'dt-right',
        },
      ],
      language: {
        lengthMenu: '페이지당 _MENU_ 개씩 보기',
        zeroRecords: '상세 내역이 없습니다',
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
      order: [],
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      responsive: true,
      autoWidth: false,
      searching: true,
      paging: true,
      info: true,
    });

    console.log(`✅ 발주 상세 DataTable 초기화 완료 (${details ? details.length : 0}건)`);

    // ✅ 합계 금액 계산 (발주량 * 입고단가)
    const totalAmount = (details || []).reduce((sum, item) => {
      return sum + (item.발주량 || 0) * (item.입고단가 || 0);
    }, 0);

    // 합계 표시
    $('#orderDetailTotal').text(totalAmount.toLocaleString());
    console.log(`✅ 발주 합계 금액: ${totalAmount.toLocaleString()}원`);

    // 모달 표시
    document.getElementById('orderDetailModal').style.display = 'block';
    document.getElementById('orderDetailModal').classList.remove('hidden');

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.orderDetailModalDraggable) {
      makeModalDraggable('orderDetailModal', 'orderDetailModalHeader');
      window.orderDetailModalDraggable = true;
    }
  } catch (error) {
    console.error('발주 상세 조회 오류:', error);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 상세 모달 닫기
 */
function closeOrderDetailModal() {
  const modal = document.getElementById('orderDetailModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  // 발주 체크박스만 초기화
  $('#orderSelectAll').prop('checked', false);
  $('.orderRowCheck').prop('checked', false);

  // 버튼 상태도 초기화
  $('.orderRowCheck').each(function () {
    const orderDate = $(this).data('order-date');
    const orderNo = $(this).data('order-no');
    const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

    actionDiv.find('.orderBtnView').show();
    actionDiv.find('.orderBtnEdit').hide();
    actionDiv.find('.orderBtnDelete').hide();
  });

  // DataTable 정리 (메모리 누수 방지)
  if (window.orderDetailDataTable) {
    window.orderDetailDataTable.destroy();
    window.orderDetailDataTable = null;
    $('#orderDetailTable tbody').empty();
  }
}

// 전역으로 접근 가능하도록 window에 등록
window.closeOrderDetailModal = closeOrderDetailModal;

/**
 * 상태코드를 텍스트로 변환
 */
function getOrderStatusText(statusCode) {
  switch (statusCode) {
    case 0:
      return '<span class="status-badge status-pending">발주대기</span>';
    case 1:
      return '<span class="status-badge status-active">발주완료</span>';
    case 2:
      return '<span class="status-badge status-completed">입고완료</span>';
    default:
      return '-';
  }
}

/**
 * 발주 신규 등록 모달 열기
 */
async function openOrderModal() {
  try {
    // 모달 제목 변경
    document.getElementById('orderModalTitle').textContent = '발주서 작성';

    // 폼 초기화
    document.getElementById('orderForm').reset();

    // 사업장 목록 로드
    await loadWorkplacesForOrder();

    // 매입처 목록 로드
    await loadSuppliersForOrder();

    // 오늘 날짜 자동 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;

    // 품목 테이블 초기화
    document.getElementById('orderDetailTableBody').innerHTML = `
      <tr id="orderDetailEmptyRow">
        <td colspan="8" style="padding: 40px; text-align: center; color: #9ca3af;">
          발주 품목을 추가해주세요
        </td>
      </tr>
    `;

    // 폼 제출 이벤트
    document.getElementById('orderForm').onsubmit = async (e) => {
      e.preventDefault();
      await saveOrder();
    };

    // 모달 표시
    document.getElementById('orderModal').style.display = 'flex';
    document.getElementById('orderModal').classList.remove('hidden');

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.orderModalDraggable) {
      makeModalDraggable('orderModal', 'orderModalHeader');
      window.orderModalDraggable = true;
    }
  } catch (error) {
    console.error('❌ 발주 모달 열기 오류:', error);
    alert('발주 모달을 여는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 모달 닫기
 */
function closeOrderModal() {
  document.getElementById('orderModal').style.display = 'none';
  // 발주 체크박스만 초기화
  $('#orderSelectAll').prop('checked', false);
  $('.orderRowCheck').prop('checked', false);
  // 버튼 상태도 초기화
  $('.orderRowCheck').each(function () {
    const orderDate = $(this).data('order-date');
    const orderNo = $(this).data('order-no');
    const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

    actionDiv.find('.orderBtnView').show();
    actionDiv.find('.orderBtnEdit').hide();
    actionDiv.find('.orderBtnDelete').hide();
  });
  document.getElementById('orderModal').classList.add('hidden');
  document.getElementById('orderForm').reset();
}

/**
 * 사업장 목록 로드 (발주용)
 */
async function loadWorkplacesForOrder() {
  try {
    const result = await apiCall('/workplaces');
    const select = document.getElementById('orderWorkplace');
    select.innerHTML = '<option value="">사업장 선택</option>';

    if (result.success && result.data) {
      result.data.forEach((workplace) => {
        const option = document.createElement('option');
        option.value = workplace.사업장코드;
        option.textContent = `${workplace.사업장코드} - ${workplace.사업장명 || ''}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('사업장 목록 로드 오류:', error);
  }
}

/**
 * 매입처 목록 로드 (발주용)
 */
async function loadSuppliersForOrder() {
  try {
    const result = await apiCall('/suppliers');
    const select = document.getElementById('orderSupplier');
    select.innerHTML = '<option value="">매입처 선택</option>';

    if (result.success && result.data) {
      result.data.forEach((supplier) => {
        const option = document.createElement('option');
        option.value = supplier.매입처코드;
        option.textContent = `${supplier.매입처명 || ''} (${supplier.매입처코드})`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('매입처 목록 로드 오류:', error);
  }
}

/**
 * 발주 품목 행 추가
 */
function addOrderDetailRow() {
  const tbody = document.getElementById('orderDetailTableBody');

  // 빈 행 제거
  const emptyRow = document.getElementById('orderDetailEmptyRow');
  if (emptyRow) {
    emptyRow.remove();
  }

  const rowIndex = tbody.querySelectorAll('tr').length + 1;

  const row = document.createElement('tr');
  row.innerHTML = `
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${rowIndex}</td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <select class="form-control materialSelect" style="width: 100%;" onchange="onMaterialSelected(this)">
        <option value="">자재 선택</option>
      </select>
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
      <input type="text" class="form-control materialSpec" readonly style="width: 100%;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
      <input type="text" class="form-control materialUnit" readonly style="width: 100%;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <input type="number" class="form-control orderQty" value="0" min="0" style="width: 100%; text-align: right;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <input type="number" class="form-control incomingPrice" value="0" min="0" style="width: 100%; text-align: right;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <input type="number" class="form-control outgoingPrice" value="0" min="0" style="width: 100%; text-align: right;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
      <button type="button" onclick="removeOrderDetailRow(this)" style="
        padding: 4px 8px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      ">삭제</button>
    </td>
  `;

  tbody.appendChild(row);

  // 자재 목록 로드
  loadMaterialsForRow(row.querySelector('.materialSelect'));
}

/**
 * 발주 품목 행 삭제
 */
function removeOrderDetailRow(button) {
  const row = button.closest('tr');
  const tbody = document.getElementById('orderDetailTableBody');
  row.remove();

  // 순번 재정렬
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((r, idx) => {
    const firstCell = r.querySelector('td:first-child');
    if (firstCell && !r.id) {
      firstCell.textContent = idx + 1;
    }
  });

  // 모든 행이 삭제되면 빈 행 표시
  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr id="orderDetailEmptyRow">
        <td colspan="8" style="padding: 40px; text-align: center; color: #9ca3af;">
          발주 품목을 추가해주세요
        </td>
      </tr>
    `;
  }
}

/**
 * 자재 목록 로드 (품목 행용)
 */
async function loadMaterialsForRow(selectElement) {
  try {
    const result = await apiCall('/materials');
    selectElement.innerHTML = '<option value="">자재 선택</option>';

    if (result.success && result.data) {
      result.data.forEach((material) => {
        const option = document.createElement('option');
        const materialCode = material.분류코드 + material.세부코드;
        option.value = materialCode;
        option.textContent = `${material.자재명 || ''} (${materialCode})`;
        option.dataset.spec = material.규격 || '';
        option.dataset.unit = material.단위 || '';
        selectElement.appendChild(option);
      });
    }
  } catch (error) {
    console.error('자재 목록 로드 오류:', error);
  }
}

/**
 * 자재 선택 시 규격/단위 자동 입력
 */
function onMaterialSelected(selectElement) {
  const row = selectElement.closest('tr');
  const selectedOption = selectElement.options[selectElement.selectedIndex];

  if (selectedOption && selectedOption.value) {
    row.querySelector('.materialSpec').value = selectedOption.dataset.spec || '';
    row.querySelector('.materialUnit').value = selectedOption.dataset.unit || '';
  } else {
    row.querySelector('.materialSpec').value = '';
    row.querySelector('.materialUnit').value = '';
  }
}

/**
 * 발주 저장
 */
async function saveOrder() {
  try {
    // 마스터 데이터 수집
    const orderData = {
      사업장코드: document.getElementById('orderWorkplace').value,
      매입처코드: document.getElementById('orderSupplier').value,
      발주일자: document.getElementById('orderDate').value.replace(/-/g, ''), // YYYYMMDD
      입고희망일자: document.getElementById('orderDeliveryDate').value.replace(/-/g, '') || null,
      결제방법: document.getElementById('orderPaymentMethod').value || null,
      제목: document.getElementById('orderTitle').value,
      적요: document.getElementById('orderRemarks').value || null,
      상태코드: parseInt(document.getElementById('orderStatus').value),
    };

    // 품목 데이터 수집
    const detailRows = document.querySelectorAll(
      '#orderDetailTableBody tr:not(#orderDetailEmptyRow)',
    );
    const details = [];

    detailRows.forEach((row) => {
      const materialSelect = row.querySelector('.materialSelect');
      const orderQty = row.querySelector('.orderQty');
      const incomingPrice = row.querySelector('.incomingPrice');
      const outgoingPrice = row.querySelector('.outgoingPrice');

      if (materialSelect.value) {
        details.push({
          자재코드: materialSelect.value,
          발주량: parseFloat(orderQty.value) || 0,
          입고단가: parseFloat(incomingPrice.value) || 0,
          출고단가: parseFloat(outgoingPrice.value) || 0,
        });
      }
    });

    // 유효성 검사
    if (!orderData.사업장코드) {
      alert('사업장을 선택해주세요.');
      return;
    }
    if (!orderData.매입처코드) {
      alert('매입처를 선택해주세요.');
      return;
    }
    if (!orderData.발주일자) {
      alert('발주일자를 입력해주세요.');
      return;
    }
    if (!orderData.제목) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (details.length === 0) {
      alert('발주 품목을 1개 이상 추가해주세요.');
      return;
    }

    // 서버로 전송
    const requestData = {
      master: orderData,
      details: details,
    };

    const result = await apiCall('/orders', 'POST', requestData);

    if (result.success) {
      alert('발주가 저장되었습니다.');
      closeOrderModal();
      // DataTable 새로고침 - window.loadOrderList() 호출
      if (typeof window.loadOrderList === 'function') {
        window.loadOrderList();
      }
    } else {
      alert(result.message || '발주 저장에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 발주 저장 오류:', error);
    alert('발주 저장 중 오류가 발생했습니다.');
  }
}

// ==================== 발주 수정 기능 ====================
/**
 * 발주 수정 - 모달 열기 (발주내역 포함)
 */
async function editOrder(orderDate, orderNo) {
  console.log(`✅ 발주 수정: ${orderDate}-${orderNo}`);

  try {
    // 현재 발주 정보 조회 (마스터 + 상세)
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`);

    if (!result.success || !result.data) {
      throw new Error('발주 정보를 찾을 수 없습니다.');
    }

    const master = result.data.master;
    const details = result.data.detail || [];

    // 기본 정보 표시 (읽기 전용)
    document.getElementById('editOrderNo').textContent = `${orderDate}-${orderNo}`;
    document.getElementById('editOrderDate').textContent = orderDate.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('editSupplierName').textContent = master.매입처명 || '-';

    // 입고희망일자 (YYYYMMDD -> YYYY-MM-DD)
    const deliveryDate = master.입고희망일자 || '';
    if (deliveryDate && deliveryDate.length === 8) {
      document.getElementById('editOrderDeliveryDate').value = `${deliveryDate.substring(
        0,
        4,
      )}-${deliveryDate.substring(4, 6)}-${deliveryDate.substring(6, 8)}`;
    } else {
      document.getElementById('editOrderDeliveryDate').value = '';
    }

    document.getElementById('editOrderPaymentMethod').value = master.결제방법 || '';
    document.getElementById('editOrderStatus').value = master.상태코드 || 0;
    document.getElementById('editOrderTitle').value = master.제목 || '';
    document.getElementById('editOrderRemark').value = master.적요 || '';

    // 모달에 발주일자, 번호 저장 (submit 시 사용)
    const modal = document.getElementById('orderEditModal');
    modal.dataset.orderDate = orderDate;
    modal.dataset.orderNo = orderNo;
    modal.dataset.매입처코드 = master.매입처코드;
    modal.dataset.사업장코드 = master.사업장코드;

    // ✅ 발주내역 DataTable 초기화
    if (window.orderEditDetailDataTable) {
      window.orderEditDetailDataTable.destroy();
    }

    window.orderEditDetailDataTable = $('#orderEditDetailTable').DataTable({
      data: details,
      columns: [
        {
          // 순번
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function (data, type, row, meta) {
            return meta.row + 1;
          },
        },
        {
          data: '자재코드',
          defaultContent: '-',
        },
        {
          data: '자재명',
          defaultContent: '-',
        },
        {
          data: '규격',
          defaultContent: '-',
        },
        {
          data: '발주량',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          data: '입고단가',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          data: '출고단가',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          // 관리 버튼
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function (data, type, row, meta) {
            return `
              <button class="btn-icon" onclick="editOrderDetailRow(${meta.row})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">수정</button>
              <button class="btn-icon" onclick="deleteOrderDetailRow(${meta.row})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
            `;
          },
        },
      ],
      language: {
        lengthMenu: '페이지당 _MENU_ 개씩 보기',
        zeroRecords: '발주 품목이 없습니다',
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
      order: [[0, 'asc']], // 순번 오름차순
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      responsive: true,
      autoWidth: false,
      searching: true,
      paging: true,
      info: true,
    });

    console.log(`✅ 발주 수정 DataTable 초기화 완료 (${details.length}건)`);

    // 닫기 버튼 이벤트
    $('#closeOrderEditModalBtn').off('click').on('click', closeOrderEditModal);

    // 모달 표시
    modal.style.display = 'block';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (!window.orderEditModalDraggable) {
      makeModalDraggable('orderEditModal', 'orderEditModalHeader');
      window.orderEditModalDraggable = true;
    }
  } catch (err) {
    console.error('❌ 발주 수정 모달 열기 오류:', err);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 발주 수정 모달 닫기
 */
function closeOrderEditModal() {
  const modal = document.getElementById('orderEditModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // DataTable 정리
  if (window.orderEditDetailDataTable) {
    window.orderEditDetailDataTable.destroy();
    window.orderEditDetailDataTable = null;
    $('#orderEditDetailTable tbody').empty();
  }
}

/**
 * 발주 품목 수정 (행 단위)
 */
function editOrderDetailRow(rowIndex) {
  try {
    const table = window.orderEditDetailDataTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 현재 행 데이터 가져오기
    const rowData = table.row(rowIndex).data();
    if (!rowData) {
      alert('행 데이터를 찾을 수 없습니다.');
      return;
    }

    // 모달에 데이터 설정
    document.getElementById('editOrderDetailMaterialName').value = rowData.자재명 || '';
    document.getElementById('editOrderDetailQuantity').value = rowData.발주량 || 0;
    document.getElementById('editOrderDetailInPrice').value = rowData.입고단가 || 0;
    document.getElementById('editOrderDetailOutPrice').value = rowData.출고단가 || 0;

    // 금액 미리보기 초기값 계산
    const 초기금액 = (rowData.발주량 || 0) * (rowData.입고단가 || 0);
    $('#editOrderDetailAmount').text(초기금액.toLocaleString() + '원');

    // 현재 수정 중인 행 인덱스 저장
    window.currentEditOrderDetailRowIndex = rowIndex;

    // 모달 열기
    document.getElementById('orderDetailEditModal').style.display = 'block';

    // 닫기 버튼 이벤트
    $('#closeOrderDetailEditModal').off('click').on('click', closeOrderDetailEditModal);
  } catch (error) {
    console.error('❌ 품목 수정 모달 열기 오류:', error);
    alert('품목 수정 모달을 여는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 품목 수정 모달 닫기
 */
function closeOrderDetailEditModal() {
  document.getElementById('orderDetailEditModal').style.display = 'none';
  window.currentEditOrderDetailRowIndex = null;
}

/**
 * 발주 품목 수정 확인
 */
function confirmEditOrderDetail() {
  try {
    const rowIndex = window.currentEditOrderDetailRowIndex;
    if (rowIndex === null || rowIndex === undefined) {
      alert('수정할 행을 찾을 수 없습니다.');
      return;
    }

    const table = window.orderEditDetailDataTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 수정된 데이터 가져오기
    const 발주량 = parseFloat(document.getElementById('editOrderDetailQuantity').value) || 0;
    const 입고단가 = parseFloat(document.getElementById('editOrderDetailInPrice').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('editOrderDetailOutPrice').value) || 0;

    // 기존 행 데이터 가져오기
    const rowData = table.row(rowIndex).data();

    // 데이터 업데이트
    rowData.발주량 = 발주량;
    rowData.입고단가 = 입고단가;
    rowData.출고단가 = 출고단가;

    // 테이블에 반영
    table.row(rowIndex).data(rowData).draw(false);

    console.log('✅ 품목 수정 완료:', rowData);

    closeOrderDetailEditModal();
  } catch (error) {
    console.error('❌ 품목 수정 오류:', error);
    alert('품목 수정 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 품목 삭제 (행 단위)
 */
function deleteOrderDetailRow(rowIndex) {
  try {
    const table = window.orderEditDetailDataTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 현재 행 데이터 가져오기
    const rowData = table.row(rowIndex).data();

    if (!rowData) {
      alert('행 데이터를 찾을 수 없습니다.');
      return;
    }

    // 모달에 정보 표시
    document.getElementById(
      'deleteOrderDetailInfo',
    ).textContent = `[${rowData.자재코드}] ${rowData.자재명}`;

    // 모달에 rowIndex 저장
    const modal = document.getElementById('orderDetailDeleteModal');
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 삭제 모달 열기 오류:', err);
    alert('품목 삭제 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주내역 품목 삭제 모달 닫기
function closeOrderDetailDeleteModal() {
  document.getElementById('orderDetailDeleteModal').style.display = 'none';
}

// ✅ 발주내역 품목 삭제 확인
function confirmOrderDetailDelete() {
  try {
    const modal = document.getElementById('orderDetailDeleteModal');
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.orderEditDetailDataTable;

    // 행 삭제
    table.row(rowIndex).remove().draw();

    // 합계 재계산 (있는 경우)
    if (typeof recalculateOrderEditTotal === 'function') {
      recalculateOrderEditTotal();
    }

    console.log(`✅ 품목 삭제 완료 (행 인덱스: ${rowIndex})`);

    // 모달 닫기
    closeOrderDetailDeleteModal();
  } catch (err) {
    console.error('❌ 품목 삭제 오류:', err);
    alert('품목 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 선택된 발주 품목 삭제
 */
function deleteSelectedOrderDetails() {
  const table = window.orderEditDetailDataTable;
  if (!table) return;

  const selectedRows = [];
  $('.editOrderDetailCheckbox:checked').each(function () {
    const row = $(this).closest('tr');
    selectedRows.push(table.row(row));
  });

  if (selectedRows.length === 0) {
    alert('삭제할 품목을 선택해주세요.');
    return;
  }

  if (!confirm(`선택한 ${selectedRows.length}개 품목을 삭제하시겠습니까?`)) {
    return;
  }

  selectedRows.forEach((row) => row.remove());
  table.draw();
}

/**
 * 발주 품목 추가 (수정 모달 내) - 모달 열기
 */
function addOrderDetailRowInEdit() {
  // 초기화
  window.selectedOrderMaterial = null;
  document.getElementById('orderMaterialSearchCode').value = '';
  document.getElementById('orderMaterialSearchName').value = '';
  document.getElementById('orderMaterialSearchSpec').value = '';
  document.getElementById('orderMaterialSearchResults').style.display = 'none';
  document.getElementById('selectedOrderMaterialInfo').style.display = 'none';
  document.getElementById('addOrderDetailQuantity').value = '1';
  document.getElementById('addOrderDetailInPrice').value = '0';
  document.getElementById('addOrderDetailOutPrice').value = '0';

  // 금액 미리보기 초기화
  $('#addOrderDetailAmount').text('0원');

  // 모달 표시
  document.getElementById('orderDetailAddModal').style.display = 'block';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (!window.orderDetailAddModalDraggable) {
    makeModalDraggable('orderDetailAddModal', 'orderDetailAddModalHeader');
    window.orderDetailAddModalDraggable = true;
  }

  // 닫기 버튼 이벤트
  $('#closeOrderDetailAddModal').off('click').on('click', closeOrderDetailAddModal);
}

/**
 * 발주 품목 추가 모달 닫기
 */
function closeOrderDetailAddModal() {
  document.getElementById('orderDetailAddModal').style.display = 'none';
}

/**
 * 자재 검색
 */
async function searchOrderMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCode = document.getElementById('orderMaterialSearchCode').value.trim();
    const searchName = document.getElementById('orderMaterialSearchName').value.trim();
    const searchSpec = document.getElementById('orderMaterialSearchSpec').value.trim();

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCode && !searchName && !searchSpec) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 발주 자재 검색:', {
      자재코드: searchCode,
      자재명: searchName,
      규격: searchSpec,
    });

    // 검색 조건을 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);
    if (searchSpec) params.append('searchSpec', searchSpec);

    // 자재 검색 API 호출
    const result = await apiCall(`/materials?${params.toString()}`);

    if (!result.success || !result.data) {
      alert('자재 검색에 실패했습니다.');
      return;
    }

    const materials = result.data;

    if (materials.length === 0) {
      alert('검색 결과가 없습니다.');
      return;
    }

    // 검색 결과 테이블에 표시
    const tbody = document.getElementById('orderMaterialSearchTableBody');
    tbody.innerHTML = '';

    materials.forEach((material, index) => {
      const row = document.createElement('tr');
      row.style.transition = 'background 0.2s';
      row.onmouseover = () => (row.style.background = '#f9fafb');
      row.onmouseout = () => (row.style.background = 'white');

      const 자재코드 = material.분류코드 + material.세부코드;

      // 자재 데이터를 전역 변수에 임시 저장
      if (!window.tempOrderMaterialsData) {
        window.tempOrderMaterialsData = [];
      }
      window.tempOrderMaterialsData[index] = {
        ...material,
        자재코드,
      };

      row.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
          자재코드 || '-'
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
          material.자재명 || '-'
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
          material.규격 || '-'
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">${(
          material.입고단가 || 0
        ).toLocaleString()}원</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <button onclick='selectOrderMaterialForAdd(window.tempOrderMaterialsData[${index}])' style="
            padding: 6px 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">선택</button>
        </td>
      `;

      tbody.appendChild(row);
    });

    // 검색 결과 영역 표시
    document.getElementById('orderMaterialSearchResults').style.display = 'block';
  } catch (error) {
    console.error('❌ 자재 검색 오류:', error);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

/**
 * 자재 선택 (선택 버튼 클릭) - 입력 필드에 정보 채우기
 */
function selectOrderMaterialForAdd(material) {
  console.log('🔍 selectOrderMaterialForAdd 호출됨:', material);

  if (!material) {
    console.error('❌ material 객체가 없습니다!');
    alert('자재 정보를 불러올 수 없습니다. 다시 시도해주세요.');
    return;
  }

  // 선택된 자재 정보 저장
  window.selectedOrderMaterial = material;
  console.log('✅ window.selectedOrderMaterial 저장됨:', window.selectedOrderMaterial);

  // 선택된 자재 정보 표시
  document.getElementById('selectedOrderMaterialName').textContent = material.자재명 || '-';
  document.getElementById('selectedOrderMaterialCode').textContent = `품목코드: ${
    material.자재코드 || '-'
  }`;
  document.getElementById('selectedOrderMaterialInfo').style.display = 'block';

  // 입력 필드에 기본값 설정
  document.getElementById('addOrderDetailQuantity').value = '1';
  document.getElementById('addOrderDetailInPrice').value = material.입고단가 || '0';
  document.getElementById('addOrderDetailOutPrice').value = material.출고단가 || '0';

  // 금액 미리보기 초기값 계산 (발주량 1 × 입고단가)
  const 초기금액 = 1 * (material.입고단가 || 0);
  $('#addOrderDetailAmount').text(초기금액.toLocaleString() + '원');

  // 검색 결과 숨김
  document.getElementById('orderMaterialSearchResults').style.display = 'none';

  console.log('✅ 자재 선택 완료:', material);
}

/**
 * 선택된 자재 취소
 */
function clearSelectedOrderMaterial() {
  window.selectedOrderMaterial = null;
  document.getElementById('selectedOrderMaterialInfo').style.display = 'none';
}

/**
 * 발주 품목 추가 확인 (모달 하단의 추가하기 버튼)
 */
function confirmAddOrderDetail() {
  try {
    if (!window.selectedOrderMaterial) {
      alert('자재를 선택해주세요.');
      return;
    }

    const 발주량 = parseFloat(document.getElementById('addOrderDetailQuantity').value) || 0;
    const 입고단가 = parseFloat(document.getElementById('addOrderDetailInPrice').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('addOrderDetailOutPrice').value) || 0;

    if (발주량 <= 0) {
      alert('발주량을 입력해주세요.');
      return;
    }

    const table = window.orderEditDetailDataTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 새 행 데이터 생성
    const newRow = {
      자재코드: window.selectedOrderMaterial.자재코드,
      자재명: window.selectedOrderMaterial.자재명,
      규격: window.selectedOrderMaterial.규격,
      발주량: 발주량,
      입고단가: 입고단가,
      출고단가: 출고단가,
    };

    // DataTable에 추가
    table.row.add(newRow).draw();

    console.log('✅ 품목 추가 완료:', newRow);

    // 모달 닫기
    closeOrderDetailAddModal();
  } catch (error) {
    console.error('❌ 품목 추가 오류:', error);
    alert('품목 추가 중 오류가 발생했습니다.');
  }
}

// ✅ 발주 입고단가 이력 관련 변수
let tempMaterialForOrder = null;
let currentOrderPriceHistoryTab = 'actual';

/**
 * 발주용 이전단가 조회 모달 열기
 */
async function showPriceHistoryForOrder(material) {
  try {
    // 매입처 코드 확인 (현재 수정 중인 발주의 매입처)
    const modal = document.getElementById('orderEditModal');
    const 매입처코드 = modal.dataset.매입처코드;

    if (!매입처코드) {
      alert('먼저 발주를 선택해주세요.');
      return;
    }

    // 임시 자재 정보 저장
    tempMaterialForOrder = material;

    // 자재 정보 표시
    document.getElementById('orderPriceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('orderPriceHistoryMaterialCode').textContent = `[${
      material.자재코드
    }] ${material.규격 || ''}`;

    // 탭 초기화 (실제 입고가 탭으로 시작)
    currentOrderPriceHistoryTab = 'actual';
    const tabActual = document.getElementById('tabActualPurchasePrice');
    const tabOrder = document.getElementById('tabOrderPrice');

    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 실제 입고가 데이터 로드
    await loadActualPurchasePriceHistory(material.자재코드, 매입처코드);

    // 모달 표시
    document.getElementById('orderPriceHistoryModal').style.display = 'block';

    console.log('✅ 발주용 단가 이력 조회:', material);
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 발주용 실제 입고가 이력 로드
 */
async function loadActualPurchasePriceHistory(자재코드, 매입처코드) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/purchase-price-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('orderPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            최근 1년 이내 이 거래처에 입고한 이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '';

      result.data.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background 0.2s';
        tr.onmouseover = function () {
          this.style.background = '#f9fafb';
        };
        tr.onmouseout = function () {
          this.style.background = 'white';
        };
        tr.onclick = function () {
          selectPriceFromOrderHistory(item.입고단가);
        };

        const 입출고일자 = item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 적요 = item.적요 || '-';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${입출고일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.입고단가 || 0).toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${(item.입고수량 || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280;">
            ${적요}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }

    console.log(`✅ 실제 입고가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 실제 입고가 이력 조회 오류:', err);
    alert('실제 입고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 발주용 발주 제안가 이력 로드
 */
async function loadOrderPriceHistory(자재코드, 매입처코드) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/order-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('orderPriceHistoryTableBody');
    const thead = document.getElementById('orderPriceHistoryTableHead');

    // 테이블 헤더 변경
    thead.innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">발주일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">발주량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">상태</th>
      </tr>
    `;

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            최근 1년 이내 이 거래처에 발주한 이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '';

      result.data.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background 0.2s';
        tr.onmouseover = function () {
          this.style.background = '#f9fafb';
        };
        tr.onmouseout = function () {
          this.style.background = 'white';
        };
        tr.onclick = function () {
          selectPriceFromOrderHistory(item.입고단가);
        };

        const 발주일자 = item.발주일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 상태 = item.상태코드 === 1 ? '작성중' : item.상태코드 === 2 ? '발주' : '완료';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${발주일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.입고단가 || 0).toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${(item.발주량 || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280;">
            ${상태}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }

    console.log(`✅ 발주 제안가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 발주 제안가 이력 조회 오류:', err);
    alert('발주 제안가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 발주용 이력에서 단가 선택
 */
function selectPriceFromOrderHistory(price) {
  closeOrderPriceHistoryModal();

  if (!tempMaterialForOrder) {
    alert('자재 정보를 찾을 수 없습니다.');
    return;
  }

  // 발주량 입력
  const 수량 = prompt(`${tempMaterialForOrder.자재명}\n발주량을 입력하세요:`, '1');

  if (!수량 || isNaN(수량) || parseFloat(수량) <= 0) {
    alert('유효한 수량을 입력해주세요.');
    tempMaterialForOrder = null;
    return;
  }

  // 출고단가 입력
  const 출고단가 = prompt(
    `${tempMaterialForOrder.자재명}\n출고단가를 입력하세요:`,
    tempMaterialForOrder.출고단가 || '0',
  );

  if (!출고단가 || isNaN(출고단가) || parseFloat(출고단가) < 0) {
    alert('유효한 출고단가를 입력해주세요.');
    tempMaterialForOrder = null;
    return;
  }

  const table = window.orderEditDetailDataTable;
  if (!table) {
    alert('DataTable을 찾을 수 없습니다.');
    tempMaterialForOrder = null;
    return;
  }

  // 선택한 단가로 자재 추가
  const newRow = {
    자재코드: tempMaterialForOrder.자재코드,
    자재명: tempMaterialForOrder.자재명,
    규격: tempMaterialForOrder.규격,
    발주량: parseFloat(수량),
    입고단가: parseFloat(price),
    출고단가: parseFloat(출고단가),
  };

  // DataTable에 추가
  table.row.add(newRow).draw();

  tempMaterialForOrder = null;

  console.log(`✅ 이전단가로 자재 추가: ${price}원`);
}

/**
 * 발주용 단가 이력 탭 전환
 */
async function switchOrderPriceHistoryTab(tabName) {
  currentOrderPriceHistoryTab = tabName;

  const tabActual = document.getElementById('tabActualPurchasePrice');
  const tabOrder = document.getElementById('tabOrderPrice');
  const label = document.getElementById('orderPriceHistoryLabel');
  const thead = document.getElementById('orderPriceHistoryTableHead');

  if (tabName === 'actual') {
    // 실제 입고가 탭 활성화
    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    label.textContent = '이 거래처에 실제 입고한 이력 (최근 1년, 클릭하여 단가 선택)';

    // 테이블 헤더 복원
    thead.innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">적요</th>
      </tr>
    `;

    // 실제 입고가 이력 로드
    if (tempMaterialForOrder) {
      const modal = document.getElementById('orderEditModal');
      const 매입처코드 = modal.dataset.매입처코드;
      await loadActualPurchasePriceHistory(tempMaterialForOrder.자재코드, 매입처코드);
    }
  } else {
    // 발주 제안가 탭 활성화
    tabActual.style.background = 'transparent';
    tabActual.style.color = '#6b7280';
    tabActual.style.borderBottom = '3px solid transparent';

    tabOrder.style.background = '#3b82f6';
    tabOrder.style.color = 'white';
    tabOrder.style.borderBottom = '3px solid #3b82f6';

    label.textContent = '이 거래처에 발주한 이력 (최근 1년, 클릭하여 단가 선택)';

    // 발주 제안가 이력 로드
    if (tempMaterialForOrder) {
      const modal = document.getElementById('orderEditModal');
      const 매입처코드 = modal.dataset.매입처코드;
      await loadOrderPriceHistory(tempMaterialForOrder.자재코드, 매입처코드);
    }
  }
}

/**
 * 발주용 단가 이력 모달 닫기
 */
function closeOrderPriceHistoryModal() {
  document.getElementById('orderPriceHistoryModal').style.display = 'none';
  tempMaterialForOrder = null;
}

/**
 * 발주 수정 모달 - 품목 추가에서 이전단가 버튼 클릭 시
 */
async function showEditOrderPriceHistory() {
  try {
    console.log('🔍 showEditOrderPriceHistory 호출됨');
    console.log('📦 window.selectedOrderMaterial:', window.selectedOrderMaterial);

    // 선택된 자재가 있는지 확인
    if (!window.selectedOrderMaterial) {
      console.error('❌ selectedOrderMaterial이 null입니다!');
      alert('먼저 자재를 검색한 후 검색 결과에서 "선택" 버튼을 클릭해주세요.');
      return;
    }

    // 매입처 코드 확인 (현재 수정 중인 발주의 매입처)
    const modal = document.getElementById('orderEditModal');
    const 매입처코드 = modal.dataset.매입처코드;
    console.log('🏢 매입처코드:', 매입처코드);

    if (!매입처코드) {
      alert('먼저 발주를 선택해주세요.');
      return;
    }

    const material = window.selectedOrderMaterial;

    // 임시 자재 정보 저장 (기존 tempMaterialForOrder와 구분)
    window.tempMaterialForAddModal = material;

    // 자재 정보 표시
    document.getElementById('orderPriceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('orderPriceHistoryMaterialCode').textContent = `[${
      material.자재코드
    }] ${material.규격 || ''}`;

    // 탭 초기화 (실제 입고가 탭으로 시작)
    currentOrderPriceHistoryTab = 'actual';
    const tabActual = document.getElementById('tabActualPurchasePrice');
    const tabOrder = document.getElementById('tabOrderPrice');

    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 실제 입고가 데이터 로드
    await loadActualPurchasePriceHistoryForAddModal(material.자재코드, 매입처코드);

    // 모달 표시
    document.getElementById('orderPriceHistoryModal').style.display = 'block';

    console.log('✅ 품목 추가 모달용 단가 이력 조회:', material);
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 품목 추가 모달용 실제 입고가 이력 로드
 */
async function loadActualPurchasePriceHistoryForAddModal(자재코드, 매입처코드) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/purchase-price-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('orderPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            최근 1년 이내 이 거래처에 입고한 이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '';

      result.data.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background 0.2s';
        tr.onmouseover = function () {
          this.style.background = '#f9fafb';
        };
        tr.onmouseout = function () {
          this.style.background = 'white';
        };
        tr.onclick = function () {
          selectPriceForAddModal(item.입고단가);
        };

        const 입출고일자 = item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 적요 = item.적요 || '-';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${입출고일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.입고단가 || 0).toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${(item.입고수량 || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280;">
            ${적요}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }

    console.log(`✅ 실제 입고가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 실제 입고가 이력 조회 오류:', err);
    alert('실제 입고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 품목 추가 모달용 단가 선택
 */
function selectPriceForAddModal(price) {
  closeOrderPriceHistoryModal();

  // 입고단가 필드에 선택한 단가 자동 입력
  document.getElementById('addOrderDetailInPrice').value = price;

  // 금액 미리보기 업데이트
  const 발주량 = parseFloat($('#addOrderDetailQuantity').val()) || 0;
  const 금액 = 발주량 * price;
  $('#addOrderDetailAmount').text(금액.toLocaleString() + '원');

  console.log(`✅ 품목 추가 모달: 이전단가 선택 (${price}원)`);
}

/**
 * 발주 수정 완료
 */
async function submitOrderEdit() {
  try {
    const modal = document.getElementById('orderEditModal');
    const orderDate = modal.dataset.orderDate;
    const orderNo = modal.dataset.orderNo;

    // 수정된 마스터 데이터 수집
    const 입고희망일자 = document.getElementById('editOrderDeliveryDate').value.replace(/-/g, '');
    const 결제방법 = document.getElementById('editOrderPaymentMethod').value;
    const 상태코드 = parseInt(document.getElementById('editOrderStatus').value);
    const 제목 = document.getElementById('editOrderTitle').value;
    const 적요 = document.getElementById('editOrderRemark').value;

    // 유효성 검사
    if (!제목) {
      alert('제목을 입력해주세요.');
      return;
    }

    // 품목 데이터 수집 (DataTable에서)
    const table = window.orderEditDetailDataTable;
    const details = [];

    if (table) {
      const tableData = table.rows().data();
      tableData.each(function (row) {
        // 자재코드가 배열인 경우 첫 번째 값만 사용
        let 자재코드 = row.자재코드;
        if (Array.isArray(자재코드)) {
          자재코드 = 자재코드[0];
        }

        details.push({
          자재코드: 자재코드,
          발주량: parseFloat(row.발주량) || 0,
          입고단가: parseFloat(row.입고단가) || 0,
          출고단가: parseFloat(row.출고단가) || 0,
        });
      });
    }

    // 품목 유효성 검사
    if (details.length === 0) {
      alert('발주 품목을 1개 이상 추가해주세요.');
      return;
    }

    console.log('✅ 수정할 데이터:', {
      마스터: { 입고희망일자, 결제방법, 제목, 적요, 상태코드 },
      품목수: details.length,
    });

    // 서버로 전송 (마스터 + 품목)
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`, 'PUT', {
      입고희망일자,
      결제방법,
      제목,
      적요,
      상태코드,
      details, // 품목 데이터 추가
    });

    if (result.success) {
      alert('발주가 수정되었습니다.');
      closeOrderEditModal();
      // DataTable 새로고침 - window.loadOrderList() 호출
      if (typeof window.loadOrderList === 'function') {
        window.loadOrderList();
      }
    } else {
      alert(result.message || '발주 수정에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 발주 수정 오류:', error);
    alert('발주 수정 중 오류가 발생했습니다.');
  }
}

// ==================== 발주 삭제 기능 ====================
/**
 * 발주 삭제
 */
async function deleteOrder(orderDate, orderNo) {
  try {
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`, 'GET');

    if (!result.success) {
      alert('발주 정보를 불러올 수 없습니다.');
      return;
    }

    const master = result.data.master;

    // 발주번호 표시 (간단하게)
    const orderNumber = `${master.발주일자}-${master.발주번호}`;
    const deleteContent = document.getElementById('orderDeleteContent');
    deleteContent.textContent = `발주번호: ${orderNumber}`;

    // 현재 삭제할 발주 정보 저장
    window.currentDeleteOrderDate = orderDate;
    window.currentDeleteOrderNo = orderNo;

    document.getElementById('orderDeleteModal').style.display = 'flex';
  } catch (error) {
    console.error('❌ 발주 삭제 모달 열기 오류:', error);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 삭제 확인
 */
async function confirmDeleteOrder() {
  const orderDate = window.currentDeleteOrderDate;
  const orderNo = window.currentDeleteOrderNo;

  if (!orderDate || !orderNo) {
    alert('삭제할 발주 정보가 없습니다.');
    return;
  }

  try {
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`, 'DELETE');

    if (result.success) {
      alert('발주가 삭제되었습니다.');
      closeOrderDeleteModal();

      // DataTable 새로고침 - window.loadOrderList() 호출
      if (typeof window.loadOrderList === 'function') {
        window.loadOrderList();
      }
    } else {
      alert(result.message || '발주 삭제에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 발주 삭제 오류:', error);
    alert('발주 삭제 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 삭제 모달 닫기
 */
function closeOrderDeleteModal() {
  document.getElementById('orderDeleteModal').style.display = 'none';
  window.currentDeleteOrderDate = null;
  window.currentDeleteOrderNo = null;
}

// ==================== 필터링 및 엑셀 내보내기 ====================
/**
 * 필터링 (상태, 날짜 범위) - 조회 버튼 클릭 시
 */
window.filterOrders = function filterOrders() {
  if (orderListTableInstance) {
    orderListTableInstance.ajax.reload();
  } else {
    console.warn('⚠️ orderListTableInstance가 초기화되지 않았습니다.');
  }
};

/**
 * Google Sheets로 내보내기 (임시)
 */
function exportOrdersToExcel() {
  alert('Google Sheets 내보내기 기능은 준비 중입니다.');
}

// makeModalDraggable 함수는 js/modal-draggable.js에서 전역으로 로드됨

// ==================== 신규 발주서 작성 기능 (견적서 작성과 동일 패턴) ====================

let newOrderDetails = [];

/**
 * 발주서 작성 모달 열기 (새 패턴)
 */
function openNewOrderModal() {
  // 모달 제목 설정
  document.getElementById('newOrderModalTitle').textContent = '발주서 작성';

  // 폼 초기화
  document.getElementById('orderForm').reset();

  // 매입처 정보 초기화
  document.getElementById('selectedSupplierCode').value = '';
  document.getElementById('selectedSupplierName').value = '';
  const infoDiv = document.getElementById('selectedSupplierInfo');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }

  // 발주일자를 오늘 날짜로 설정
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('orderDate').value = today;

  // 상세내역 초기화
  newOrderDetails = [];
  renderNewOrderDetailTable();

  // 모달 표시
  document.getElementById('newOrderModal').style.display = 'block';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (!window.newOrderModalDraggable) {
    makeModalDraggable('newOrderModal', 'newOrderModalHeader');
    window.newOrderModalDraggable = true;
  }

  console.log('✅ 발주서 작성 모달 열기');
}

/**
 * 발주서 작성 모달 닫기
 */
function closeOrderModal() {
  document.getElementById('newOrderModal').style.display = 'none';
  // 발주 체크박스만 초기화
  $('#orderSelectAll').prop('checked', false);
  $('.orderRowCheck').prop('checked', false);

  // 버튼 상태도 초기화
  $('.orderRowCheck').each(function () {
    const orderDate = $(this).data('order-date');
    const orderNo = $(this).data('order-no');
    const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

    actionDiv.find('.orderBtnView').show();
    actionDiv.find('.orderBtnEdit').hide();
    actionDiv.find('.orderBtnDelete').hide();
  });
  newOrderDetails = [];
}

/**
 * 사업장 목록 로드
 */
async function loadWorkplacesForNewOrder() {
  try {
    const result = await apiCall('/workplaces');
    const select = document.getElementById('orderWorkplace');
    select.innerHTML = '<option value="">사업장 선택</option>';

    if (result.success && result.data) {
      result.data.forEach((workplace) => {
        const option = document.createElement('option');
        option.value = workplace.사업장코드;
        option.textContent = `${workplace.사업장코드} - ${workplace.사업장명 || ''}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('사업장 목록 로드 오류:', error);
  }
}

/**
 * 매입처 검색 모달 열기
 */
function openSupplierSearchModal() {
  // 사용자가 입력한 매입처명 가져오기
  const supplierNameInput = document.getElementById('selectedSupplierName').value.trim();

  // 모달 열기
  document.getElementById('supplierSearchModal').style.display = 'block';

  // 검색 입력란에 사용자가 입력한 값 설정
  document.getElementById('orderSupplierSearchInput').value = supplierNameInput;

  // 입력값이 있으면 자동으로 검색 실행
  if (supplierNameInput) {
    searchOrderSuppliers();
  }

  console.log('✅ 매입처 검색 모달 열기:', supplierNameInput);
}

// ✅ 매입처 검색 모달 닫기
function closeSupplierSearchModal() {
  document.getElementById('supplierSearchModal').style.display = 'none';
}

// ✅ 발주서용 매입처 검색
async function searchOrderSuppliers() {
  try {
    const searchText = document.getElementById('orderSupplierSearchInput').value.trim();

    const response = await fetch(`/api/suppliers?search=${encodeURIComponent(searchText)}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '매입처 조회 실패');
    }

    const tbody = document.getElementById('supplierSearchTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #999;">
            검색 결과가 없습니다
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';

    result.data.forEach((supplier) => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onmouseover = () => (tr.style.background = '#f8f9fa');
      tr.onmouseout = () => (tr.style.background = 'white');

      // 행 클릭 시 매입처 선택
      tr.onclick = (e) => {
        // 선택 버튼 클릭은 버튼의 onclick 이벤트가 처리하므로 제외
        if (e.target.tagName !== 'BUTTON') {
          window.selectOrderSupplier(supplier);
        }
      };

      tr.innerHTML = `
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${supplier.매입처코드}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${supplier.매입처명}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${
          supplier.전화번호 || '-'
        }</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <button onclick='window.selectOrderSupplier(${JSON.stringify(supplier).replace(
            /'/g,
            '&apos;',
          )})' style="
            padding: 6px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">선택</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    console.log(`✅ 매입처 검색 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 매입처 검색 오류:', err);
    alert('매입처 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 매입처 선택 함수는 파일 최상단의 window.selectOrderSupplier로 통합됨

/**
 * 매입처 검색
 */
async function searchSuppliersForOrder(searchTerm) {
  try {
    const result = await apiCall(`/suppliers?search=${encodeURIComponent(searchTerm)}`);
    if (result.success && result.data && result.data.length > 0) {
      // 첫 번째 검색 결과 선택
      const supplier = result.data[0];
      document.getElementById('selectedSupplierCode').value = supplier.매입처코드;
      document.getElementById('selectedSupplierName').value = supplier.매입처명;
    } else {
      alert('검색 결과가 없습니다.');
    }
  } catch (error) {
    console.error('매입처 검색 오류:', error);
    alert('매입처 검색 중 오류가 발생했습니다.');
  }
}

// 신규 발주서 작성 모드 플래그
let isNewSupplierSearchMode = false;

/**
 * 자재 검색 모달 열기 (발주용)
 */
function openOrderMaterialSearchModal() {
  // 새 모달 초기화
  newSelectedMaterial = null;
  document.getElementById('newOrderMaterialSearchCode').value = '';
  document.getElementById('newOrderMaterialSearchName').value = '';
  document.getElementById('newOrderMaterialSearchSpec').value = '';
  document.getElementById('newOrderMaterialSearchResults').style.display = 'none';
  document.getElementById('newOrderSelectedMaterialInfo').style.display = 'none';
  document.getElementById('newOrderDetailQuantity').value = '1';
  document.getElementById('newOrderDetailPrice').value = '0';
  document.getElementById('newOrderDetailAmount').value = '0';

  // 품목 추가 모달 표시 (견적서 작성 모달은 그대로 유지)
  const modal = document.getElementById('newOrderMaterialModal');
  modal.style.display = 'block';
  modal.style.zIndex = '9999';

  console.log('✅ 신규 발주서용 품목 추가 모달 열기 (견적서 작성 모달 유지)');
}

// 모달 닫기
function closeNewOrderMaterialModal() {
  document.getElementById('newOrderMaterialModal').style.display = 'none';
  // 견적서 작성 모달은 그대로 유지되므로 별도 처리 불필요
}

// 자재 검색
async function searchNewOrderMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCode = document.getElementById('newOrderMaterialSearchCode').value.trim();
    const searchName = document.getElementById('newOrderMaterialSearchName').value.trim();
    const searchSpec = document.getElementById('newOrderMaterialSearchSpec').value.trim();

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCode && !searchName && !searchSpec) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 신규 발주서 자재 검색:', {
      자재코드: searchCode,
      자재명: searchName,
      규격: searchSpec,
    });

    // 검색 조건을 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);
    if (searchSpec) params.append('searchSpec', searchSpec);

    const response = await fetch(`/api/materials?${params.toString()}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('자재 목록을 불러올 수 없습니다.');
    }

    const filteredMaterials = result.data;

    if (filteredMaterials.length === 0) {
      alert('검색 결과가 없습니다.');
      document.getElementById('newOrderMaterialSearchResults').style.display = 'none';
      return;
    }

    const tbody = document.getElementById('newOrderMaterialSearchTableBody');
    tbody.innerHTML = '';

    // 자재 데이터를 전역 배열에 저장
    if (!window.tempNewOrderMaterialsData) {
      window.tempNewOrderMaterialsData = [];
    }

    filteredMaterials.forEach((m, index) => {
      const 자재코드 = m.분류코드 + m.세부코드;

      // 자재 데이터 저장
      window.tempNewOrderMaterialsData[index] = {
        ...m,
        자재코드,
      };

      const tr = document.createElement('tr');
      tr.style.transition = 'background 0.2s';
      tr.onmouseover = function () {
        this.style.background = '#f3f4f6';
      };
      tr.onmouseout = function () {
        this.style.background = 'white';
      };

      tr.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${자재코드}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${
          m.자재명
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${
          m.규격 || '-'
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">${(
          m.입고단가 || 0
        ).toLocaleString()}원</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: center;">
          <button onclick='selectNewOrderMaterial(window.tempNewOrderMaterialsData[${index}])' style="
            padding: 6px 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">선택</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    document.getElementById('newOrderMaterialSearchResults').style.display = 'block';
    console.log(`✅ 자재 검색 완료: ${filteredMaterials.length}건`);
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// 자재 선택
function selectNewOrderMaterial(material) {
  newOrderSelectedMaterial = material;

  const 자재코드 = material.분류코드 + material.세부코드;

  document.getElementById('newOrderSelectedMaterialName').textContent = material.자재명;
  document.getElementById('newOrderSelectedMaterialCode').textContent = `[${자재코드}] ${
    material.규격 || ''
  }`;
  document.getElementById('newOrderSelectedMaterialInfo').style.display = 'block';

  document.getElementById('newOrderMaterialSearchResults').style.display = 'none';

  console.log('✅ 자재 선택:', material);
}

let currentNewOrderPriceHistoryTab = 'actual'; // 현재 활성화된 탭

// ✅ 신규 발주서 단가 이력 모달 열기
async function showNewOrderPriceHistory() {
  try {
    if (!newOrderSelectedMaterial) {
      alert('먼저 자재를 검색하여 선택해주세요.');
      return;
    }

    const 매입처코드 = document.getElementById('selectedSupplierCode').value;
    if (!매입처코드) {
      alert('매입처를 먼저 선택해주세요.');
      return;
    }

    const 자재코드 = newOrderSelectedMaterial.분류코드 + newOrderSelectedMaterial.세부코드;

    // 임시 자재 정보 저장 (기존 발주 수정과 구분)
    window.tempMaterialForNewOrder = newOrderSelectedMaterial;

    // 자재 정보 표시 (기존 orderPriceHistoryModal 사용)
    document.getElementById('orderPriceHistoryMaterialName').textContent =
      newOrderSelectedMaterial.자재명;
    document.getElementById('orderPriceHistoryMaterialCode').textContent = `[${자재코드}] ${
      newOrderSelectedMaterial.규격 || ''
    }`;

    // 탭 초기화 (실제 입고가 탭으로 시작)
    currentNewOrderPriceHistoryTab = 'actual';
    const tabActual = document.getElementById('tabActualPurchasePrice');
    const tabOrder = document.getElementById('tabOrderPrice');

    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 실제 입고가 데이터 로드
    await loadActualPurchasePriceHistoryForNewOrder(자재코드, 매입처코드);

    // 모달 표시 (기존 orderPriceHistoryModal 사용)
    const modal = document.getElementById('orderPriceHistoryModal');
    modal.style.display = 'block';

    console.log('✅ 신규 발주서 단가 이력 모달 열기');
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 신규 발주서용 실제 입고가 이력 로드
 */
async function loadActualPurchasePriceHistoryForNewOrder(자재코드, 매입처코드) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/purchase-price-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('orderPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            최근 1년 이내 이 거래처에 입고한 이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '';

      result.data.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background 0.2s';
        tr.onmouseover = function () {
          this.style.background = '#f9fafb';
        };
        tr.onmouseout = function () {
          this.style.background = 'white';
        };
        tr.onclick = function () {
          selectPriceForNewOrder(item.입고단가);
        };

        const 입출고일자 = item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

        tr.innerHTML = `
          <td style="padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb;">${입출고일자}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #2563eb;">${(
            item.입고단가 || 0
          ).toLocaleString()}원</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">${(
            item.입고수량 || 0
          ).toLocaleString()}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">${
            item.적요 || '-'
          }</td>
        `;

        tbody.appendChild(tr);
      });
    }

    console.log(`✅ 신규 발주서 입고가 이력 로드 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 입고가 이력 로드 오류:', err);
    alert('입고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 신규 발주서용 단가 선택
 */
function selectPriceForNewOrder(입고단가) {
  // 신규 발주서 모달의 입력란에 단가 설정
  const inputField = document.getElementById('newOrderDetailPrice');
  if (inputField) {
    inputField.value = 입고단가;
  }

  // 모달 닫기
  document.getElementById('orderPriceHistoryModal').style.display = 'none';

  console.log('✅ 신규 발주서 단가 선택:', 입고단가);
}

// ✅ 신규 발주서 단가 이력 모달 닫기
function closeNewOrderPriceHistoryModal() {
  document.getElementById('orderPriceHistoryModal').style.display = 'none';
}

// ✅ 신규 발주서 단가 이력 탭 전환
async function switchNewOrderPriceHistoryTab(tab) {
  currentNewOrderPriceHistoryTab = tab;

  // 탭 버튼 스타일 변경
  const tabActual = document.getElementById('newTabOrderActualPrice');
  const ordertab = document.getElementById('newTabOrderPrice');

  if (ordertab === 'actual') {
    // 실제 출고가 탭 활성화
    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    ordertab.style.background = 'transparent';
    ordertab.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('newOrderPriceHistoryLabel').textContent =
      '이 거래처에 실제 입고한 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('newOrderPriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">적요</th>
      </tr>
    `;

    // 실제 입고 데이터 로드
    await loadNewOrderActualPriceHistory();
  } else if (tab === 'order') {
    // 견적 제안가 탭 활성화
    ordertab.style.background = '#3b82f6';
    ordertab.style.color = 'white';
    ordertab.style.borderBottom = '3px solid #3b82f6';

    tabActual.style.background = 'transparent';
    tabActual.style.color = '#6b7280';
    tabActual.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('newOrderPriceHistoryLabel').textContent =
      '이 거래처에 제안한 발주 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('newOrderPriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">발주일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">입고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">상태</th>
      </tr>
    `;

    // 발주 제안가 데이터 로드
    await loadNewOrderPriceHistory();
  }
}

// ✅ 신규 발주서 실제 입고 이력 로드
async function loadNewOrderActualPriceHistory() {
  try {
    if (!newSelectedMaterial) return;

    const 자재코드 = newSelectedMaterial.분류코드 + newSelectedMaterial.세부코드;
    const 매입처코드 = document.getElementById('selectedOrderCode').value;

    if (!매입처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/price-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('newOrderPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            최근 1년 이내 이 거래처에 입고한 이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '';

      result.data.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background 0.2s';
        tr.onmouseover = function () {
          this.style.background = '#f9fafb';
        };
        tr.onmouseout = function () {
          this.style.background = 'white';
        };
        tr.onclick = function () {
          selectNewOrderPriceFromHistory(item.입고단가);
        };

        const 입출고일자 = item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 적요 = item.적요 || '-';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${입출고일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.입고단가 || 0).toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${(item.입고수량 || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280;">
            ${적요}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }

    console.log(`✅ 신규 발주서 실제 입고가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 실제 입고가 이력 조회 오류:', err);
    alert('실제 입고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 발주서 견적 제안가 이력 로드
async function loadNewOrderPriceHistory() {
  try {
    if (!newSelectedMaterial) return;

    const 자재코드 = newSelectedMaterial.분류코드 + newSelectedMaterial.세부코드;
    const 매입처코드 = document.getElementById('selectedOrderCode').value;

    if (!매입처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/order-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('newOrderPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            이 거래처에 제안한 발주 이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '';

      result.data.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background 0.2s';
        tr.onmouseover = function () {
          this.style.background = '#f9fafb';
        };
        tr.onmouseout = function () {
          this.style.background = 'white';
        };
        tr.onclick = function () {
          selectNewOrderPriceFromHistory(item.입고단가);
        };

        const 발주일자 = item.발주일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 상태 = item.상태코드 === 1 ? '작성중' : item.상태코드 === 2 ? '승인' : '반려';
        const 상태색 =
          item.상태코드 === 1 ? '#f59e0b' : item.상태코드 === 2 ? '#10b981' : '#ef4444';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${발주일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.입고단가 || 0).toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${(item.수량 || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center;">
            <span style="padding: 2px 8px; border-radius: 4px; background: ${상태색}22; color: ${상태색}; font-size: 11px; font-weight: 600;">
              ${상태}
            </span>
          </td>
        `;

        tbody.appendChild(tr);
      });
    }

    console.log(`✅ 신규 발주서 발주 제안가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 발주 제안가 이력 조회 오류:', err);
    alert('발주 제안가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 발주서 이력에서 단가 선택
function selectNewOrderPriceFromHistory(price) {
  document.getElementById('newOrderDetailPrice').value = price;

  // 금액 자동 재계산
  const 수량 = parseFloat(document.getElementById('newOrderDetailQuantity').value) || 0;
  const 금액 = 수량 * price;
  document.getElementById('newOrderDetailAmount').value = 금액.toLocaleString();

  // 모달 닫기
  closeNewOrderPriceHistoryModal();

  console.log(`✅ 신규 발주서 단가 선택: ${price}원`);
}

// ✅ 신규 발주서 단가 이력 모달 닫기
function closeNewOrderPriceHistoryModal() {
  document.getElementById('newOrderPriceHistoryModal').style.display = 'none';
}

// 자재 추가 확인
function confirmNewOrderMaterialAdd() {
  try {
    if (!newOrderSelectedMaterial) {
      alert('자재를 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 = newOrderSelectedMaterial.분류코드 + newOrderSelectedMaterial.세부코드;
    const 수량 = parseFloat(document.getElementById('newOrderDetailQuantity').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('newOrderDetailPrice').value) || 0;

    // if (수량 <= 0) {
    //   alert('수량을 1 이상 입력해주세요.');
    //   return;
    // }

    // newOrderDetails 배열에 추가
    newOrderDetails.push({
      자재코드: 자재코드,
      자재명: newOrderSelectedMaterial.자재명,
      규격: newOrderSelectedMaterial.규격,
      발주량: 수량,
      입고단가: 출고단가,
      출고단가: 출고단가,
    });

    // 테이블 렌더링
    renderNewOrderDetailTable();

    // 모달 닫기 (발주서 작성 모달은 그대로 유지)
    closeNewOrderMaterialModal();

    console.log('✅ 신규 발주서에 자재 추가 완료:', newOrderSelectedMaterial.자재명);
  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
  }
}

console.log('✅ order.js 로드 완료');

/**
 * 자재 검색 (발주용)
 */
async function searchMaterialsForOrder(searchTerm) {
  try {
    const result = await apiCall(`/materials?search=${encodeURIComponent(searchTerm)}`);
    if (result.success && result.data && result.data.length > 0) {
      // 첫 번째 검색 결과로 자재 추가 모달 표시
      const material = result.data[0];
      const 자재코드 = material.분류코드 + material.세부코드;

      const 발주량 = prompt(`${material.자재명}\n발주량을 입력하세요:`, '1');
      if (!발주량 || isNaN(발주량) || parseFloat(발주량) <= 0) {
        return;
      }

      const 입고단가 = prompt(
        `${material.자재명}\n입고단가를 입력하세요:`,
        material.입고단가 || '0',
      );
      if (!입고단가 || isNaN(입고단가)) {
        return;
      }

      const 출고단가 = prompt(
        `${material.자재명}\n출고단가를 입력하세요:`,
        material.출고단가 || '0',
      );
      if (!출고단가 || isNaN(출고단가)) {
        return;
      }

      // 상세내역에 추가
      newOrderDetails.push({
        자재코드: 자재코드,
        자재명: material.자재명,
        규격: material.규격,
        발주량: parseFloat(발주량),
        입고단가: parseFloat(입고단가),
        출고단가: parseFloat(출고단가),
      });

      renderNewOrderDetailTable();
    } else {
      alert('검색 결과가 없습니다.');
    }
  } catch (error) {
    console.error('자재 검색 오류:', error);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 상세내역 테이블 렌더링
 */
function renderNewOrderDetailTable() {
  const tbody = document.getElementById('newOrderDetailTableBody');

  if (newOrderDetails.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="padding: 40px; text-align: center; color: #999;">
          자재 추가 버튼을 클릭하여 발주 상세내역을 입력하세요
        </td>
      </tr>
    `;
    // 합계 초기화
    document.getElementById('orderTotalSupplyPrice').textContent = '0';
    document.getElementById('orderTotalVat').textContent = '0';
    document.getElementById('orderGrandTotal').textContent = '0';
    return;
  }

  tbody.innerHTML = '';

  let 총공급가 = 0;
  let 총부가세 = 0;

  newOrderDetails.forEach((detail, index) => {
    const 수량 = parseFloat(detail.발주량) || 0;
    const 단가 = parseFloat(detail.입고단가) || 0;
    const 공급가 = 수량 * 단가;
    const 부가세 = Math.round(공급가 * 0.1);

    총공급가 += 공급가;
    총부가세 += 부가세;

    // 자재코드 표시 (세부코드만)
    // const 자재코드표시 = detail.자재코드 ? detail.자재코드.substring(4) : '-';

    const 자재코드표시 = detail.자재코드 ? detail.자재코드 : '-';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border);">${
        index + 1
      }</td>
      <td style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border);">${자재코드표시}</td>
      <td style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border);">${
        detail.자재명 || '-'
      }</td>
      <td style="padding: 12px; text-align: left; border-bottom: 1px solid var(--border);">${
        detail.규격 || '-'
      }</td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${수량.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${단가.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${공급가.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${부가세.toLocaleString()}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid var(--border);">
        <button type="button" onclick="removeNewOrderDetail(${index})" style="
          padding: 4px 8px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">삭제</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // 합계 업데이트
  const 총액 = 총공급가 + 총부가세;
  document.getElementById('orderTotalSupplyPrice').textContent = 총공급가.toLocaleString();
  document.getElementById('orderTotalVat').textContent = 총부가세.toLocaleString();
  document.getElementById('orderGrandTotal').textContent = 총액.toLocaleString();
}

/**
 * 발주 상세내역 삭제
 */
function removeNewOrderDetail(index) {
  newOrderDetails.splice(index, 1);
  renderNewOrderDetailTable();
}

/**
 * 발주서 저장
 */
async function submitNewOrder(event) {
  event.preventDefault();

  try {
    // 입력값 수집
    const 사업장코드 = currentUser?.사업장코드 || '01'; // 로그인한 사용자의 사업장 코드 사용
    const 매입처코드 = document.getElementById('selectedSupplierCode').value;
    const 발주일자 = document.getElementById('orderDate').value.replace(/-/g, '');
    const 입고희망일자 = document.getElementById('orderDeliveryDate').value.replace(/-/g, '');
    const 결제방법 = document.getElementById('orderPaymentMethod').value;
    const 상태코드 = document.getElementById('orderStatus').value;
    const 제목 = document.getElementById('orderTitle').value;
    const 적요 = document.getElementById('orderRemarks').value;

    // 유효성 검사
    if (!매입처코드) {
      alert('매입처를 선택해주세요.');
      return;
    }

    if (newOrderDetails.length === 0) {
      alert('최소 1개 이상의 품목을 추가해주세요.');
      return;
    }

    // 전송할 데이터 구성
    const requestData = {
      master: {
        사업장코드,
        매입처코드,
        발주일자,
        입고희망일자: 입고희망일자 || '',
        결제방법: 결제방법 || '',
        상태코드: parseInt(상태코드) || 0,
        제목: 제목 || '',
        적요: 적요 || '',
      },
      details: newOrderDetails.map((detail) => ({
        자재코드: detail.자재코드,
        발주량: parseFloat(detail.발주량) || 0,
        입고단가: parseFloat(detail.입고단가) || 0,
        출고단가: parseFloat(detail.출고단가) || 0,
      })),
    };

    console.log('📤 발주서 저장 요청 데이터:', requestData);

    // API 호출
    const result = await apiCall('/orders', 'POST', requestData);

    if (result.success) {
      alert('발주서가 저장되었습니다.');
      closeOrderModal();

      // 목록 새로고침 - window.loadOrderList() 호출
      if (typeof window.loadOrderList === 'function') {
        window.loadOrderList();
      }
    } else {
      alert('저장 실패: ' + (result.message || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('❌ 발주서 저장 오류:', error);
    alert('발주서 저장 중 오류가 발생했습니다: ' + error.message);
  }
}

// ==================== 발주서 출력 기능 ====================
/**
 * 발주서 출력 함수
 * @param {string} orderDate - 발주일자 (YYYYMMDD)
 * @param {number} orderNo - 발주번호
 */
async function printOrder(orderDate, orderNo, mode = 1) {
  try {
    console.log('📄 발주서 출력 시작:', { 발주일자: orderDate, 발주번호: orderNo, mode });

    // 새로운 인쇄 전용 API 호출
    const response = await fetch(`/api/orders/${orderDate}/${orderNo}/print?mode=${mode}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      alert('발주 정보를 불러올 수 없습니다.');
      return;
    }

    const { header, items } = result.data;

    // 출력 창 생성 (A4 크기)
    const printWindow = window.open('', '_blank', 'width=800,height=900');

    // 날짜 포맷팅 함수
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    };

    // 숫자를 한자로 변환하는 함수
    const numberToKoreanHanja = (num) => {
      // 입력값 검증 및 변환
      if (num === undefined || num === null || num === '' || isNaN(num)) {
        return '零';
      }

      // 숫자로 변환
      const numValue = typeof num === 'string' ? parseInt(num) : num;

      if (numValue === 0 || isNaN(numValue)) {
        return '零';
      }

      const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      const units = ['', '十', '百', '千'];
      const bigUnits = ['', '萬', '億', '兆'];

      let result = '';
      let unitIndex = 0;

      const numStr = numValue.toString();
      const len = numStr.length;

      for (let i = 0; i < len; i++) {
        const digit = parseInt(numStr[len - 1 - i]);
        const unit = units[i % 4];

        if (digit !== 0) {
          result = digits[digit] + unit + result;
        }

        if ((i + 1) % 4 === 0 && i !== len - 1) {
          result = bigUnits[unitIndex + 1] + result;
          unitIndex++;
        }
      }

      return result || '零';
    };

    // HTML 생성
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>발주서 - ${header.발주일자}-${header.발주번호}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: '맑은 고딕', 'Malgun Gothic', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            padding: 10mm;
            background: white;
          }

          .document {
            width: 170mm;
            margin: 0 auto;
            background: white;
          }

          /* 제목 */
          .title {
            text-align: center;
            font-size: 24pt;
            font-weight: bold;
            margin-bottom: 15mm;
            letter-spacing: 10px;
          }

          /* 정보 박스 컨테이너 */
          .info-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8mm;
            gap: 5mm;
          }

          .info-box {
            flex: 1;
            border: 2px solid #333;
            padding: 3mm;
          }

          .info-box-title {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 2mm;
            padding-bottom: 1mm;
            border-bottom: 1px solid #999;
          }

          .info-row {
            display: flex;
            margin-bottom: 1.5mm;
            font-size: 9pt;
          }

          .info-label {
            width: 70px;
            font-weight: bold;
            color: #333;
          }

          .info-value {
            flex: 1;
            color: #000;
          }

          /* 견적 정보 섹션 */
          .quotation-info {
            border: 2px solid #333;
            padding: 3mm;
            margin-bottom: 8mm;
          }

          .quotation-info-row {
            display: flex;
            margin-bottom: 1.5mm;
            font-size: 9pt;
          }

          .quotation-info-row .info-label {
            width: 90px;
          }

          /* 품목 테이블 */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8mm;
            font-size: 9pt;
          }

          /* 페이지 분할 시 테이블 헤더 반복 */
          thead {
            display: table-header-group;
          }

          tbody {
            display: table-row-group;
          }

          th {
            background-color: #f0f0f0;
            border: none;
            padding: 2mm 1mm;
            text-align: center;
            font-weight: bold;
            font-size: 9pt;
            border-bottom: 2px solid #999;
          }

          /* 페이지 넘김 시 헤더 다시 출력 */
          @media print {
            thead {
              display: table-header-group;
            }

            tr {
              page-break-inside: avoid;
            }

            .quotation-info {
              page-break-after: auto;
            }

            table {
              page-break-after: auto;
            }

            .total-section {
              page-break-before: avoid;
              page-break-inside: avoid;
              page-break-after: avoid;
            }

            .notes {
              page-break-before: avoid;
              page-break-inside: avoid;
            }
          }

          td {
            border: none;
            border-bottom: 1px solid #333;
            padding: 1mm 1mm;
            text-align: center;
            font-size: 8.5pt;
            min-height: 10mm;
          }

          td.left {
            text-align: left;
            padding-left: 2mm;
          }

          td.right {
            text-align: right;
            padding-right: 2mm;
          }

          /* 발주금액 표시 행 */
          .amount-row {
            display: flex;
            margin-bottom: 1.5mm;
            font-size: 10pt;
            font-weight: bold;
          }

          .amount-row .info-label {
            width: 90px;
          }

          .amount-hanja {
            color: #000;
            font-size: 11pt;
          }

          /* 합계 섹션 */
          .total-section {
            border: 2px solid #333;
            padding: 3mm;
            background-color: #f9f9f9;
            page-break-inside: avoid;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 1.5mm 0;
            font-size: 10pt;
          }

          .total-row.grand-total {
            font-size: 12pt;
            font-weight: bold;
            border-top: 2px solid #333;
            padding-top: 3mm;
            margin-top: 2mm;
          }

          .total-label {
            font-weight: bold;
          }

          .total-value {
            text-align: right;
            font-family: 'Courier New', monospace;
          }

          /* 하단 참고사항 */
          .notes {
            margin-top: 8mm;
            padding: 3mm;
            border: 1px solid #999;
            background-color: #fafafa;
            font-size: 8pt;
            line-height: 1.6;
            page-break-inside: avoid;
          }

          @media print {
            body {
              padding: 0;
            }
            .document {
              width: 100%;
            }
            @page {
              margin: 15mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <!-- 제목 -->
          <div class="title">발 주 서</div>

          <!-- 정보 박스 (주석 처리)
          <div class="info-container">
            <div class="info-box">
              <div class="info-box-title">공급자 정보</div>
              ...
            </div>
            <div class="info-box">
              <div class="info-box-title">고객 정보</div>
              ...
            </div>
          </div>
          -->

          <!-- 견적 정보 (공급자 위치로 이동) -->
          <div class="quotation-info">
            <div class="quotation-info-row">
              <span class="info-label">발주번호:</span>
              <span class="info-value">${header.발주일자}-${header.발주번호}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">발주일자:</span>
              <span class="info-value">${formatDate(header.발주일자)}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">수신:</span>
              <span class="info-value">${header.매입처명}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">담당자:</span>
              <span class="info-value">${header.매입처담당자}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">전화번호:</span>
              <span class="info-value">${header.매입처전화}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">팩스번호:</span>
              <span class="info-value">${header.매입처팩스}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">입고희망일:</span>
              <span class="info-value">${formatDate(header.입고희망일자)}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">제목:</span>
              <span class="info-value">${header.제목}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">적요:</span>
              <span class="info-value">${header.적요}</span>
            </div>
            <div class="amount-row">
              <span class="info-label">발주금액:</span>
              <span class="amount-hanja">${numberToKoreanHanja(
                header.총합계,
              )} (${header.총합계.toLocaleString()} 원)</span>
            </div>
          </div>

          <!-- 품목 테이블 -->
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">No</th>
                <th style="width: 20%;">품명</th>
                <th style="width: 20%;">규격</th>
                <th style="width: 7%;">수량</th>
                <th style="width: 6%;">단위</th>
                ${mode === 1 ? '<th style="width: 10%;">단가</th>' : ''}
                ${mode === 1 ? '<th style="width: 10%;">부가세</th>' : ''}
                ${mode === 1 ? '<th style="width: 12%;">금액</th>' : ''}
                ${
                  mode === 0
                    ? '<th style="width: 42%;">비고</th>'
                    : '<th style="width: 20%;">비고</th>'
                }
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td class="left">${item.품명 || '-'}</td>
                  <td class="left">${item.규격 || '-'}</td>
                  <td class="right">${(item.수량 || 0).toLocaleString()}</td>
                  <td>${item.단위 || '-'}</td>
                  ${mode === 1 ? `<td class="right">${(item.단가 || 0).toLocaleString()}</td>` : ''}
                  ${mode === 1 ? `<td class="right">${(item.부가 || 0).toLocaleString()}</td>` : ''}
                  ${mode === 1 ? `<td class="right">${(item.금액 || 0).toLocaleString()}</td>` : ''}
                  <td class="left">${item.적요 || ''}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>

          ${
            mode === 1
              ? `
          <!-- 합계 섹션 -->
          <div class="total-section">
            <div class="total-row">
              <span class="total-label">공급가액:</span>
              <span class="total-value">${header.총공급가액.toLocaleString()} 원</span>
            </div>
            <div class="total-row">
              <span class="total-label">부가세(10%):</span>
              <span class="total-value">${header.총부가세.toLocaleString()} 원</span>
            </div>
            <div class="total-row grand-total">
              <span class="total-label">합계금액:</span>
              <span class="total-value">${header.총합계.toLocaleString()} 원</span>
            </div>
          </div>
          `
              : ''
          }

          <!-- 하단 참고사항 -->
          <div class="notes">
            <strong>※ 참고사항</strong><br>
            · 본 발주서는 ${formatDate(header.발주일자)}부터 ${header.유효일수}일간 유효합니다.<br>
            · 상기 금액으로 견적 드립니다.<br>
            · 기타 문의사항은 연락 바랍니다.
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    console.log('✅ 발주서 출력 완료');
  } catch (error) {
    console.error('❌ 발주서 출력 실패:', error);
    alert('발주서 출력 중 오류가 발생했습니다.');
  }
}

// 전역으로 접근 가능하도록 window에 등록
window.printOrder = printOrder;

/**
 * 발주 상세 모달에서 출력 버튼 클릭 시 호출되는 래퍼 함수
 * 현재 저장된 발주 정보를 사용하여 printOrder 함수 호출 (항상 가격 표시)
 */
function printOrderFromDetail() {
  if (!window.currentOrderDetail) {
    alert('출력할 발주서 정보가 없습니다.');
    return;
  }

  const { 발주일자, 발주번호 } = window.currentOrderDetail;
  printOrder(발주일자, 발주번호); // 항상 가격 표시 모드
  console.log('✅ 발주서 출력:', { 발주일자, 발주번호 });
}

// 전역으로 접근 가능하도록 window에 등록
window.printOrderFromDetail = printOrderFromDetail;
