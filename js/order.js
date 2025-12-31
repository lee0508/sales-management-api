/**
 * 발주관리 DataTable 초기화 및 관리
 */

// 전역 변수로 DataTable 인스턴스 저장
let orderManageTable = null;

// ==================== 전역 함수 정의 (최상단) ====================
// 발주서용 매입처 선택 함수 - 고유한 이름 사용 (taxinvoice.js와 충돌 방지)
window.selectOrderSupplier = function selectOrderSupplier(supplierOrCode, name) {
  try {
    // ✅ 두 가지 호출 방식 지원:
    // 1. selectOrderSupplier(supplier) - 객체 전달 (발주 전용 검색에서 호출)
    // 2. selectOrderSupplier(code, name) - 개별 파라미터 (공통 모달에서 호출)
    let code, supplierName;

    if (typeof supplierOrCode === 'object' && supplierOrCode !== null) {
      // 객체로 전달된 경우
      code = supplierOrCode.매입처코드;
      supplierName = supplierOrCode.매입처명;
    } else {
      // 개별 파라미터로 전달된 경우
      code = supplierOrCode;
      supplierName = name;
    }

    // 매입처 코드와 이름 설정 (Prefix Rule 적용)
    const codeInput = document.getElementById('orderManageCreateSupplierCode');
    const nameInput = document.getElementById('orderManageCreateSupplierName');

    if (!codeInput || !nameInput) {
      console.error('❌ orderManageCreateModal > 입력 필드를 찾을 수 없습니다');
      alert('입력 필드를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    codeInput.value = code;
    nameInput.value = supplierName;

    // 선택된 매입처 정보 표시
    const infoDiv = document.getElementById('orderManageCreateSupplierInfo');
    const displaySpan = document.getElementById('orderManageCreateSupplierDisplay');

    if (infoDiv && displaySpan) {
      displaySpan.textContent = `[${code}] ${supplierName}`;
      infoDiv.style.display = 'block';
    }

    // 모달 닫기
    window.closeOrderSupplierSearchModal();
  } catch (err) {
    console.error('❌ orderManageCreateModal > 매입처 선택 에러:', err);
    alert('매입처 선택 중 오류가 발생했습니다: ' + err.message);
  }
};

// ✅ 발주서 작성용 매입처 검색 모달 닫기 함수 (공통 모달 사용)
// @deprecated - supplier.js의 closeSupplierSearchModal() 사용 권장
window.closeOrderSupplierSearchModal = function closeOrderSupplierSearchModal() {
  // supplier.js의 공통 모달 닫기 함수 호출
  if (typeof window.closeSupplierSearchModal === 'function') {
    window.closeSupplierSearchModal();
  }
};
// ==================================================================

$(document).ready(function () {
  // 발주서 작성 모달 드래그 기능
  makeModalDraggable('orderManageCreateModalContent', 'orderManageCreateModalHeader');
  // 발주서 수정 모달 드래그 기능
  makeModalDraggable('orderManageEditModalContent', 'orderManageEditModalHeader');
  // 발주 상세 보기 모달 드래그 기능
  makeModalDraggable('orderManageViewModalContent', 'orderManageViewModalHeader');
  // 발주 상세내역 입력 모달 드래그 기능
  makeModalDraggable('orderManageDetailAddModal', '.modal-header-draggable');

  // ✅ 상세 버튼 모달 닫기 함수
  // function closeOrderManageViewModal() {
  //   const modal = document.getElementById('orderManageViewModal');
  //   if (modal) {
  //     modal.classList.add('hidden');
  //     modal.style.display = 'none';
  //   }
  //   // DataTable 정리 (메모리 누수 방지)
  //   if (window.orderDetailDataTable) {
  //     window.orderDetailDataTable.destroy();
  //     window.orderDetailDataTable = null;
  //     $('#orderDetailTable tbody').empty();
  //   }
  // }

  // ✅ 전역으로 즉시 노출 (HTML에서 호출할 수 있도록)
  // window.closeOrderManageViewModal = closeOrderManageViewModal;

  // ✅ 상세 보기 모달 닫기 버튼
  $('#orderManageViewModalCloseBtn').on('click', () => {
    closeOrderManageViewModal();
  });

  // ✅ 상세보기 모달 배경 클릭시 닫기
  $(document).on('click', '#orderManageViewModal', function (e) {
    if (e.target.id === 'orderManageViewModal') {
      closeOrderManageViewModal();
    }
  });

  // ✅ 수정 모달 닫기 버튼
  $('#orderManageEditModalCloseBtn').on('click', () => {
    closeOrderManageEditModal();
  });

  // ✅ 수정 모달 배경 클릭시 닫기
  $(document).on('click', '#orderManageEditModal', function (e) {
    if (e.target.id === 'orderManageEditModal') {
      closeOrderManageEditModal();
    }
  });

  // ✅ 품목 추가 모달 닫기 버튼
  $('#closeOrderDetailAddModal').on('click', () => {
    closeOrderManageDetailAddModal();
  });

  // ✅ 품목 수정 모달 닫기 버튼
  $('#closeOrderDetailEditModal').on('click', () => {
    closeOrderManageDetailEditModal();
  });

  // ✅ 단가 이력 모달 닫기 버튼
  $('#orderManagePriceHistoryCloseBtn').on('click', () => {
    closeOrderManagePriceHistoryModal();
  });

  // ✅ 품목 추가 모달 - 금액 자동 계산
  $('#addDetailQuantityForOrder, #addDetailPriceForOrder').on('input', function () {
    const 수량 = parseFloat($('#addDetailQuantityForOrder').val()) || 0;
    const 단가 = parseFloat($('#addDetailPriceForOrder').val()) || 0;
    const 금액 = 수량 * 단가;
    $('#addDetailAmountForOrder').val(금액.toLocaleString());
  });

  // ✅ 품목 수정 모달 - 금액 자동 계산
  $('#editDetailQuantityForOrder, #editDetailPriceForOrder').on('input', function () {
    const 수량 = parseFloat($('#editDetailQuantityForOrder').val()) || 0;
    const 단가 = parseFloat($('#editDetailPriceForOrder').val()) || 0;
    const 금액 = 수량 * 단가;
    $('#editDetailAmountForOrder').val(금액.toLocaleString());
  });

  // ✅ 자재 검색 - Enter 키 이벤트
  $(document).on(
    'keypress',
    '#materialSearchCode, #materialSearchName, #materialSearchSpec',
    function (e) {
      if (e.which === 13) {
        // Enter 키
        e.preventDefault();
        searchMaterialsForOrder();
      }
    },
  );

  // 발주 데이터 로드 함수 (DataTable 초기화)
  async function loadOrders() {
    console.log('[발주관리] loadOrders() 함수 호출됨');

    // ✅ 다른 페이지의 체크박스 이벤트 핸들러 제거
    $(document).off('change.quotationManagePage');
    $(document).off('change.transactionManagePage');
    $(document).off('change.purchasePage');

    // 페이지가 표시될 때마다 날짜를 오늘 날짜(로그인 날짜)로 초기화
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const startDateInput = document.getElementById('orderManageStartDate');
    const endDateInput = document.getElementById('orderManageEndDate');

    // 항상 오늘 날짜로 설정
    if (startDateInput) {
      startDateInput.value = todayStr;
    }
    if (endDateInput) {
      endDateInput.value = todayStr;
    }

    // 이미 DataTable이 존재하면 파괴
    if (orderManageTable) {
      orderManageTable.destroy();
      orderManageTable = null;
    }

    // DataTable 초기화
    orderManageTable = $('#orderManageTable').DataTable({
      ajax: {
        url: '/api/orders',
        data: function (d) {
          // 필터링 파라미터 추가
          const 사업장코드 = currentUser?.사업장코드 || '01';
          const 상태코드 = $('#orderManageStatusFilter').val();
          const startDate = $('#orderManageStartDate').val()?.replace(/-/g, '') || '';
          const endDate = $('#orderManageEndDate').val()?.replace(/-/g, '') || '';

          return {
            사업장코드: 사업장코드,
            상태코드: 상태코드,
            startDate: startDate,
            endDate: endDate,
          };
        },
        dataSrc: function (json) {
          // 발주 건수 업데이트
          const countEl = document.getElementById('orderManageCount');
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
            return `<input type="checkbox" class="orderRowCheck" data-date="${row.발주일자}" data-no="${row.발주번호}" />`;
          },
        },
        // 2. 순번 (역순: 가장 오래된 데이터 = 1, 최신 데이터 = 마지막 번호)
        {
          data: null,
          orderable: false,
          className: 'dt-center',
          /* render: function (data, type, row, meta) {
            const table = $('#orderManageTable').DataTable();
            const info = table.page.info();
            return info.recordsDisplay - meta.row;
          }, */
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
          // ✅ API에서 '합계금액'으로 반환 가능성 체크 (발주금액 또는 합계금액)
          data: null,
          render: function (_data, _type, row) {
            const amount = row.발주금액 || row.합계금액 || 0;
            if (!amount) return '0원';
            return amount.toLocaleString() + '원';
          },
        },
        // 8. 담당자
        {
          data: '담당자',
          defaultContent: '-',
        },
        // 9. 상태 (배지)
        {
          data: null,
          render: function (data, type, row) {
            // 사용구분이 9이면 "삭제됨" 표시 (이탤릭 + 취소선)
            if (row.사용구분 === 9) {
              return `<span style="font-style: italic; text-decoration: line-through; color: #dc2626;">삭제됨</span>`;
            }

            // 상태코드에 따른 표시
            const statusMap = {
              1: { text: '작성중', class: 'status-pending' },
              2: { text: '승인', class: 'status-active' },
              3: { text: '반려', class: 'status-inactive' },
            };
            const status = statusMap[row.상태코드] || { text: '알수없음', class: '' };
            return `<span class="status-badge ${status.class}">${status.text}</span>`;
          },
        },
        // 10. 관리 버튼
        {
          data: null,
          orderable: false,
          render: function (data, type, row) {
            const orderKey = `${row.발주일자}-${row.발주번호}`;
            return `
              <div class="action-buttons" id="orderActions-${orderKey.replace('-', '_')}">
                <button class="btn-icon orderBtnView" onclick="viewOrderManageDetail('${
                  row.발주일자
                }', ${row.발주번호})" title="상세보기">상세</button>
                <button class="btn-icon orderBtnEdit" style="display: none;" onclick="editOrderManage('${
                  row.발주일자
                }', ${row.발주번호})" title="수정">수정</button>
                <button class="btn-icon orderBtnDelete" style="display: none;" onclick="deleteOrderManage('${
                  row.발주일자
                }', ${row.발주번호})" title="삭제">삭제</button>
                ${
                  row.상태코드 === 1
                    ? `<button class="btn-icon orderBtnApprove" style="display: none; background: #28a745;" onclick="approveOrderManage('${row.발주일자}', ${row.발주번호})" title="승인">승인</button>`
                    : ''
                }
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
      drawCallback: function () {
        // DataTable이 다시 그려질 때 버튼 표시 상태 복원
        // 주의: 체크박스 상태는 건드리지 않음 (개별 선택 시 전체선택 문제 방지)
        $('.orderRowCheck').each(function () {
          const $checkbox = $(this);
          const orderDate = $checkbox.data('date');
          const orderNo = $checkbox.data('no');
          const isChecked = $checkbox.prop('checked');
          const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

          if (isChecked) {
            actionDiv.find('.orderBtnView').hide();
            actionDiv.find('.orderBtnEdit').show();
            actionDiv.find('.orderBtnDelete').show();
            // actionDiv.find('.orderBtnApprove').show();
          } else {
            actionDiv.find('.orderBtnView').show();
            actionDiv.find('.orderBtnEdit').hide();
            actionDiv.find('.orderBtnDelete').hide();
            // actionDiv.find('.orderBtnApprove').hide();
          }
        });
      },
      // ✅ 각 행에 data 속성 추가 (삭제 기능에서 사용)
      createdRow: function (row, data, dataIndex) {
        $(row).attr('data-order-date', data.발주일자);
        $(row).attr('data-order-no', data.발주번호);
      },
    });

    // ✅ 전역 참조 통일 (window.orderManageTableInstance와 orderManageTable을 동일하게)
    window.orderManageTableInstance = orderManageTable;

    // 전체 선택 모드 플래그 (전체 선택 체크박스 클릭 시 true)
    let isSelectAllMode = false;

    // ✅ 전체선택 체크박스 클릭 이벤트 핸들러 등록 (click 이벤트 사용)
    $(document)
      .off('click.orderManagePage', '#orderManageSelectAll')
      .on('click.orderManagePage', '#orderManageSelectAll', function () {
        const isChecked = $(this).prop('checked');

        // 전체 선택 모드 활성화
        isSelectAllMode = true;

        // 모든 개별 체크박스를 선택/해제
        $('.orderRowCheck').each(function () {
          const $checkbox = $(this);
          const orderDate = $checkbox.data('date');
          const orderNo = $checkbox.data('no');
          const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

          $checkbox.prop('checked', isChecked);

          if (isChecked) {
            // 체크됨: 상세 버튼 숨기고 수정/삭제/승인 버튼 표시
            actionDiv.find('.orderBtnView').hide();
            actionDiv.find('.orderBtnEdit').show();
            actionDiv.find('.orderBtnDelete').show();
            // actionDiv.find('.orderBtnApprove').show();
          } else {
            // 체크 해제: 수정/삭제/승인 버튼 숨기고 상세 버튼 표시
            actionDiv.find('.orderBtnView').show();
            actionDiv.find('.orderBtnEdit').hide();
            actionDiv.find('.orderBtnDelete').hide();
            // actionDiv.find('.orderBtnApprove').hide();
          }
        });

        // 전체 선택 모드 비활성화
        isSelectAllMode = false;
      });

    // ✅ 개별 체크박스 이벤트 핸들러 등록
    $(document)
      .off('change.orderManagePage', '.orderRowCheck')
      .on('change.orderManagePage', '.orderRowCheck', function () {
        const orderDate = $(this).data('date');
        const orderNo = $(this).data('no');
        const isChecked = $(this).prop('checked');

        // 전체 선택 모드가 아닐 때만 라디오 버튼처럼 동작
        if (!isSelectAllMode && isChecked) {
          // 새로운 체크박스를 선택하면 다른 모든 체크박스 해제
          $('.orderRowCheck')
            .not(this)
            .each(function () {
              const $otherCheckbox = $(this);
              const otherDate = $otherCheckbox.data('date');
              const otherNo = $otherCheckbox.data('no');
              const otherActionDiv = $(`#orderActions-${otherDate}_${otherNo}`);

              // 다른 체크박스 해제
              $otherCheckbox.prop('checked', false);

              // 다른 행의 버튼 상태 복원
              otherActionDiv.find('.orderBtnView').show();
              otherActionDiv.find('.orderBtnEdit').hide();
              otherActionDiv.find('.orderBtnDelete').hide();
              // otherActionDiv.find('.orderBtnApprove').hide();
            });
        }

        // 현재 행의 버튼 표시/숨김 처리
        const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

        if (isChecked) {
          // 체크됨: 상세 버튼 숨기고 수정/삭제/승인 버튼 표시
          actionDiv.find('.orderBtnView').hide();
          actionDiv.find('.orderBtnEdit').show();
          actionDiv.find('.orderBtnDelete').show();
          // actionDiv.find('.orderBtnApprove').show();
        } else {
          // 체크 해제: 수정/삭제/승인 버튼 숨기고 상세 버튼 표시
          actionDiv.find('.orderBtnView').show();
          actionDiv.find('.orderBtnEdit').hide();
          actionDiv.find('.orderBtnDelete').hide();
          // actionDiv.find('.orderBtnApprove').hide();
        }
      });
  }

  // 전역 변수로 저장
  window.loadOrders = loadOrders;
});

// ✅ 발주 상세 버튼 모달 열기 함수 (발주일자, 발주번호로 조회)
async function openOrderManageViewModal(orderDate, orderNo) {
  const modal = document.getElementById('orderManageViewModal');

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'block';
  } else {
    console.error('❌ orderManageViewModal 요소를 찾을 수 없습니다');
    alert('상세보기 모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.orderManageViewModalDraggable) {
    makeModalDraggable('orderManageViewModal', 'orderManageViewModalHeader');
    window.orderManageViewModalDraggable = true;
  }

  // ✅ 출력 버튼을 위해 현재 발주 정보 저장
  window.currentOrderDetail = {
    발주일자: orderDate,
    발주번호: orderNo,
  };

  try {
    // 발주 마스터+상세 조회 (기존 API 사용)
    const masterRes = await fetch(`/api/orders/${orderDate}/${orderNo}`);
    const masterData = await masterRes.json();

    if (!masterData.success || !masterData.data) {
      throw new Error('발주 정보를 찾을 수 없습니다.');
    }

    const master = masterData.data.master;
    // ✅ API 응답이 details 또는 detail로 올 수 있으므로 둘 다 처리
    const details = masterData.data.details || masterData.data.detail || [];

    // 기본 정보 표시 (올바른 요소 ID 사용)
    $('#orderManageViewNo').text(`${master.발주일자}-${master.발주번호}`);
    $('#orderManageViewDate').text(master.발주일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    $('#orderManageViewSupplier').text(
      master.매입처명 && master.매입처코드
        ? `${master.매입처명}(${master.매입처코드})`
        : master.매입처명 || '-',
    );
    $('#orderManageViewRemark').text(master.적요 || '-');

    // ✅ DataTable이 이미 초기화되어 있으면 destroy 후 재생성
    if ($.fn.DataTable.isDataTable('#orderManageViewDetailTable')) {
      $('#orderManageViewDetailTable').DataTable().destroy();
    }

    // ✅ DataTable 초기화 (API 필드명에 맞게 수정)
    window.orderManageViewDetailTable = $('#orderManageViewDetailTable').DataTable({
      data: details,
      columns: [
        {
          data: null,
          render: function (data, type, row, meta) {
            return meta.row + 1;
          },
          orderable: false,
          className: 'dt-center',
          width: '60px',
        },
        {
          data: '자재코드',
          defaultContent: '-',
          orderable: false,
        },
        {
          data: '자재명',
          defaultContent: '-',
          orderable: false,
        },
        {
          data: '규격',
          defaultContent: '-',
          orderable: false,
        },
        {
          data: '단위',
          defaultContent: '-',
          orderable: false,
          className: 'dt-center',
        },
        {
          data: '수량',
          defaultContent: 0,
          orderable: false,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          // ✅ API에서 '단가'로 반환 (출고단가 as 단가)
          data: '단가',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          // ✅ API에서 '공급가액'으로 반환 (수량 * 출고단가)
          data: '공급가액',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
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
      order: [], // 자재코드 오름차순
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      responsive: true,
      autoWidth: false,
      searching: true,
      paging: true,
      info: true,
    });

    // ✅ 합계 금액 계산 (API 필드명: 공급가액)
    const totalAmount = details.reduce((sum, item) => {
      return sum + (item.공급가액 || 0);
    }, 0);

    // 합계 표시
    $('#orderManageViewTotal').text(totalAmount.toLocaleString());
  } catch (err) {
    console.error('❌ 발주 상세 조회 오류:', err);
    alert('발주 상세 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// 전역 함수로 노출
window.openOrderManageViewModal = openOrderManageViewModal;

// ✅ 상세 버튼 모달 닫기 함수
function closeOrderManageViewModal() {
  const modal = document.getElementById('orderManageViewModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  // 체크박스 초기화
  $('.orderRowCheck').prop('checked', false);

  // 버튼 상태도 초기화
  $('.orderRowCheck').each(function () {
    const orderDate = $(this).data('date');
    const orderNo = $(this).data('no');
    const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

    actionDiv.find('.orderBtnView').show();
    actionDiv.find('.orderBtnEdit').hide();
    actionDiv.find('.orderBtnDelete').hide();
    // actionDiv.find('.orderBtnApprove').hide(); // ✅ 승인 버튼도 숨김
  });

  // DataTable 정리 (메모리 누수 방지)
  if (window.orderManageViewDetailTable) {
    window.orderManageViewDetailTable.destroy();
    window.orderManageViewDetailTable = null;
    $('#orderManageViewDetailTable tbody').empty();
  }
}

// 필터링 함수
// function filterOrders() {
//   if (window.orderManageTableInstance) {
//     window.orderManageTableInstance.ajax.reload();
//   }
// }

// ✅ 발주 상세보기 함수 (DataTable 버튼에서 호출)
function viewOrderManageDetail(orderDate, orderNo) {
  console.log('===== orderManageTable > 상세 버튼 클릭 =====');

  // openOrderManageViewModal 함수 호출
  if (typeof window.openOrderManageViewModal === 'function') {
    window.openOrderManageViewModal(orderDate, orderNo);
  } else {
    console.error('❌ orderManageTable > openOrderManageViewModal 함수를 찾을 수 없습니다');
    alert('발주 상세보기 기능을 사용할 수 없습니다.');
  }
}

// 전역 함수로 노출
window.viewOrderManageDetail = viewOrderManageDetail;

// ✅ 발주 수정 함수 - 모달 열기 (발주내역 포함)
async function editOrderManage(orderDate, orderNo) {
  console.log('===== orderManageTable > 수정 버튼 클릭 =====');

  try {
    // 현재 발주 정보 조회 (마스터 + 상세)
    const response = await fetch(`/api/orders/${orderDate}/${orderNo}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('발주 정보를 찾을 수 없습니다.');
    }

    const master = result.data.master;
    const details = result.data.details || result.data.detail || [];

    // ✅ 기본 정보 표시 (Prefix Rule 적용)
    // readonly input 요소 - value 사용
    document.getElementById('orderManageEditNo').value = `${orderDate}-${orderNo}`;
    document.getElementById('orderManageEditDate').value = orderDate.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('orderManageEditSupplierName').value = master.매입처명 || '-';

    // input/textarea 요소 - value 사용
    const deliveryDateEl = document.getElementById('orderManageEditDeliveryDate');
    if (deliveryDateEl && master.입고희망일자) {
      const deliveryDate = master.입고희망일자.toString();
      if (deliveryDate.length === 8) {
        deliveryDateEl.value = `${deliveryDate.substring(0, 4)}-${deliveryDate.substring(
          4,
          6,
        )}-${deliveryDate.substring(6, 8)}`;
      }
    }

    const titleEl = document.getElementById('orderManageEditTitle');
    if (titleEl) titleEl.value = master.제목 || '';

    const remarkEl = document.getElementById('orderManageEditRemark');
    if (remarkEl) remarkEl.value = master.적요 || '';

    // 모달에 발주일자, 번호 저장 (submit 시 사용)
    const modal = document.getElementById('orderManageEditModal');
    modal.dataset.orderDate = orderDate;
    modal.dataset.orderNo = orderNo;
    modal.dataset.매입처코드 = master.매입처코드;
    modal.dataset.결제방법 = master.결제방법 || 0;
    modal.dataset.결제예정일자 = master.결제예정일자 || '';
    modal.dataset.유효일수 = master.유효일수 || 0;

    // ✅ 모달을 먼저 표시 (DataTable 너비 계산을 위해)
    modal.style.display = 'block';

    // ✅ 브라우저 렌더링 대기 후 DataTable 초기화
    setTimeout(() => {
      // ✅ 발주내역 DataTable 초기화
      if (window.orderManageEditDetailDataTable) {
        window.orderManageEditDetailDataTable.destroy();
      }

      // ✅ tbody 초기화 (placeholder 행 제거)
      $('#orderManageEditDetailTableBody').empty();

      window.orderManageEditDetailDataTable = $('#orderManageEditDetailTable').DataTable({
        data: details,
        columns: [
          {
            // 순번
            data: null,
            orderable: false,
            className: 'dt-center',
            width: '60px',
            render: function (data, type, row, meta) {
              return meta.row + 1;
            },
          },
          {
            data: '자재코드',
            defaultContent: '-',
            orderable: false,
          },
          {
            data: '자재명',
            defaultContent: '-',
            orderable: false,
          },
          {
            data: '규격',
            defaultContent: '-',
            orderable: false,
          },
          {
            data: '단위',
            defaultContent: '-',
            orderable: false,
            className: 'dt-center',
          },
          {
            data: '수량',
            defaultContent: 0,
            orderable: false,
            render: function (data) {
              return (data || 0).toLocaleString();
            },
            className: 'dt-right',
          },
          {
            // ✅ API에서 '단가'로 반환 (출고단가 as 단가)
            data: '단가',
            defaultContent: 0,
            orderable: false,
            render: function (data) {
              return (data || 0).toLocaleString();
            },
            className: 'dt-right',
          },
          {
            // ✅ API에서 '공급가액'으로 반환 (수량 * 출고단가)
            data: '공급가액',
            defaultContent: 0,
            orderable: false,
            render: function (data) {
              return (data || 0).toLocaleString();
            },
            className: 'dt-right',
          },
          {
            // 부가세 (공급가액 * 10%)
            data: null,
            orderable: false,
            render: function (data, type, row) {
              const vat = Math.round((row.공급가액 || 0) * 0.1);
              return vat.toLocaleString();
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
              <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                <button type="button" class="btn-icon" onclick="editOrderManageDetailRow(${meta.row})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 50px;">수정</button>
                <button type="button" class="btn-icon" onclick="deleteOrderManageDetailRow(${meta.row})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 50px;">삭제</button>
              </div>
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

      // ✅ DataTable 칼럼 너비 재조정 (모달이 표시된 후)
      window.orderManageEditDetailDataTable.columns.adjust().draw();

      // ✅ 합계 금액 계산 (API 필드명: 공급가액)
      const totalAmount = details.reduce((sum, item) => sum + (item.공급가액 || 0), 0);
      $('#orderManageEditDetailTotal').text(totalAmount.toLocaleString());

      // ✅ 전체 선택 체크박스 이벤트
      $('#selectAllEditDetails')
        .off('change')
        .on('change', function () {
          const isChecked = $(this).prop('checked');
          $('.editDetailCheckbox').prop('checked', isChecked);
        });

      // 드래그 기능 활성화 (최초 1회만 실행)
      if (typeof makeModalDraggable === 'function' && !window.orderManageEditModalDraggable) {
        makeModalDraggable('orderManageEditModal', 'orderManageEditModalHeader');
        window.orderManageEditModalDraggable = true;
      }
    }, 100); // 100ms 대기 후 DataTable 초기화 (브라우저 렌더링 완료 보장)
  } catch (err) {
    console.error('❌ 발주 수정 모달 열기 오류:', err);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주 수정 모달 닫기
function closeOrderManageEditModal() {
  const modal = document.getElementById('orderManageEditModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // 체크박스 초기화
  $('.orderRowCheck').prop('checked', false);

  // 버튼 상태도 초기화
  $('.orderRowCheck').each(function () {
    const orderDate = $(this).data('date');
    const orderNo = $(this).data('no');
    const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

    actionDiv.find('.orderBtnView').show();
    actionDiv.find('.orderBtnEdit').hide();
    actionDiv.find('.orderBtnDelete').hide();
    // actionDiv.find('.orderBtnApprove').hide(); // ✅ 승인 버튼도 숨김
  });

  // DataTable 정리
  if (window.orderManageEditDetailDataTable) {
    window.orderManageEditDetailDataTable.destroy();
    window.orderManageEditDetailDataTable = null;
    $('#orderManageEditDetailTable tbody').empty();
  }
}

// ✅ 선택된 자재 정보 (전역 변수) - quotation.js와 충돌 방지
let selectedOrderMaterial = null;

// ✅ 신규/수정 모드 플래그 (전역 변수)
let isNewOrderMode = false;

// ✅ 자재 검색 함수
// ✅ [발주관리] 공통 자재 검색 (orderDetailAddModal)
// HTML에 있는 materialSearchInput / materialSearchTableBody / materialSearchResults 기준으로 동작
async function searchMaterialsForOrder() {
  console.log('===== orderManageDetailAddModal > 자재 검색 버튼 클릭 =====');
  try {
    let keyword = document.getElementById('materialSearchInput').value.trim();
    let searchSpec = ''; // 규격 검색어

    if (!keyword) {
      alert('검색어를 입력해주세요.');
      return;
    }

    // 검색어에서 쉼표로 분리하여 자재명과 규격 검색어 추출
    // 예: "케이블, 200mm" → 자재명: "케이블", 규격: "200mm"
    if (keyword.includes(',')) {
      const parts = keyword.split(',').map((s) => s.trim());
      keyword = parts[0] || ''; // 첫 번째 부분: 자재명
      searchSpec = parts[1] || ''; // 두 번째 부분: 규격

      console.log(`  검색어 분리: "${keyword}", 규격: "${searchSpec}"`);
    }

    // 서버는 /api/materials 에서 searchName을 처리
    const params = new URLSearchParams();
    params.append('searchCode', keyword);
    params.append('searchName', keyword);
    if (searchSpec) {
      params.append('searchSpec', searchSpec); // 규격 검색어 추가 (쉼표로 분리된 경우)
    } else {
      params.append('searchSpec', keyword); // 단일 검색어인 경우 모든 필드에서 검색
    }
    params.append('removeDuplicates', 'true'); // 중복 제거 활성화

    const response = await fetch(`/api/materials?${params.toString()}`);
    const result = await response.json();

    if (!result.success) throw new Error(result.message || '자재 조회 실패');

    const tbody = document.getElementById('materialSearchTableBody');
    const resultsDiv = document.getElementById('materialSearchResults');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding:40px;text-align:center;color:#999;">
            검색 결과가 없습니다
          </td>
        </tr>`;
      resultsDiv.style.display = 'block';
      return;
    }

    tbody.innerHTML = '';
    result.data.forEach((material) => {
      const 자재코드 = (material.분류코드 || '') + (material.세부코드 || '');

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onmouseover = () => (tr.style.background = '#f8f9fa');
      tr.onmouseout = () => (tr.style.background = 'white');

      tr.innerHTML = `
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${자재코드}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${material.자재명 || '-'}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${material.규격 || '-'}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${(
          material.출고단가1 || 0
        ).toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">
          <button type="button" class="btn btn-sm"
            onclick='selectMaterialForOrder(${JSON.stringify(material).replace(/'/g, '&apos;')})'>
            선택
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    resultsDiv.style.display = 'block';
  } catch (err) {
    console.error('❌ orderManageDetailAddModal > 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

// ✅ 자재 선택 함수
function selectMaterial(material) {
  selectedOrderMaterial = material;

  const 자재코드 = material.분류코드 + material.세부코드;

  // 선택된 자재 정보 표시
  document.getElementById('selectedMaterialName').textContent = material.자재명;
  document.getElementById('selectedMaterialCode').textContent = `[${자재코드}] ${
    material.규격 || ''
  }`;
  document.getElementById('selectedMaterialInfo').style.display = 'block';

  // 검색 결과 숨기기
  document.getElementById('materialSearchResults').style.display = 'none';
}

// ✅ 선택된 자재 취소
function clearSelectedMaterial() {
  selectedOrderMaterial = null;
  if (typeof newSelectedOrderMaterial !== 'undefined') newSelectedOrderMaterial = null;

  const selectedInfo = document.getElementById('selectedMaterialInfo');
  if (selectedInfo) selectedInfo.style.display = 'none';

  // 검색 결과 다시 표시
  const resultsDiv = document.getElementById('materialSearchResults');
  if (resultsDiv) resultsDiv.style.display = 'block';
}

// ✅ 금액 자동 계산 (수량 * 단가)
function calculateDetailAmount() {
  const qtyEl = document.getElementById('addDetailQuantity');
  const priceEl = document.getElementById('addDetailPrice');
  const amtEl = document.getElementById('addDetailAmount');

  if (qtyEl && priceEl && amtEl) {
    const qty = parseFloat(qtyEl.value) || 0;
    const price = parseFloat(priceEl.value) || 0;
    const amount = qty * price;
    amtEl.value = amount.toLocaleString();
  }
}

// ✅ 출고단가 이력 보기
async function showPriceHistory() {
  try {
    // 자재가 선택되었는지 확인
    if (!selectedOrderMaterial) {
      alert('먼저 자재를 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 = selectedOrderMaterial.분류코드 + selectedOrderMaterial.세부코드;

    // 매입처코드 가져오기 (신규 발주서 또는 발주 수정)
    let 매입처코드;

    if (isNewOrderMode) {
      // 신규 발주서 작성 모드
      매입처코드 = document.getElementById('selectedSupplierCode').value;
    } else {
      // 발주 수정 모드
      const orderManageEditModal = document.getElementById('orderManageEditModal');
      매입처코드 = orderManageEditModal.dataset.매입처코드;
    }

    if (!매입처코드) {
      alert('매입처 정보를 찾을 수 없습니다.');
      return;
    }

    // 자재 정보 표시
    document.getElementById('priceHistoryMaterialName').textContent = selectedOrderMaterial.자재명;
    document.getElementById('priceHistoryMaterialCode').textContent = `[${자재코드}] ${
      selectedOrderMaterial.규격 || ''
    }`;

    // 탭 초기화 (실제 출고가 탭으로 시작)
    currentPriceHistoryTab = 'actual';
    const tabActual = document.getElementById('tabActualPrice');
    const tabOrder = document.getElementById('tabOrderPrice');

    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 실제 출고가 데이터 로드
    await loadActualPriceHistory();

    // 모달 표시
    document.getElementById('orderManagePriceHistoryModal').style.display = 'block';
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 이력에서 단가 선택
function selectPriceFromHistory(price) {
  document.getElementById('addDetailPrice').value = price;

  // 금액 자동 재계산
  const 수량 = parseFloat(document.getElementById('addDetailQuantity').value) || 0;
  const 금액 = 수량 * price;
  document.getElementById('addDetailAmount').value = 금액.toLocaleString();

  // 모달 닫기
  closeOrderManagePriceHistoryModal();
}

// ✅ 단가 이력 모달 닫기
function closeOrderManagePriceHistoryModal() {
  document.getElementById('orderManagePriceHistoryModal').style.display = 'none';
}

// ✅ 단가 이력 탭 전환
let currentOrderManagePriceHistoryTab = 'actual'; // 현재 활성화된 탭

async function switchOrderManagePriceHistoryTab(tab) {
  currentOrderManagePriceHistoryTab = tab;

  // 탭 버튼 스타일 변경
  const tabActual = document.getElementById('orderManagePriceHistoryActualTab');
  const tabOrder = document.getElementById('orderManagePriceHistoryOrderTab');

  if (tab === 'actual') {
    // 실제 출고가 탭 활성화
    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('orderManagePriceHistoryLabel').textContent =
      '이 거래처에 실제 출고한 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('orderManagePriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">적요</th>
      </tr>
    `;

    // 실제 출고 데이터 로드
    await loadActualPriceHistory();
  } else if (tab === 'order') {
    // 발주 제안가 탭 활성화
    tabOrder.style.background = '#3b82f6';
    tabOrder.style.color = 'white';
    tabOrder.style.borderBottom = '3px solid #3b82f6';

    tabActual.style.background = 'transparent';
    tabActual.style.color = '#6b7280';
    tabActual.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('orderManagePriceHistoryLabel').textContent =
      '이 거래처에 제안한 발주 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('orderManagePriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">발주일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">수량</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">합계</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">적요</th>
      </tr>
    `;

    // 발주 제안가 데이터 로드
    await loadOrderPriceHistory();
  }
}

// ✅ 실제 출고 이력 로드
async function loadActualPriceHistory() {
  try {
    if (!selectedOrderMaterial) return;

    const 자재코드 = selectedOrderMaterial.분류코드 + selectedOrderMaterial.세부코드;

    // 매입처코드 가져오기 (신규 발주서 또는 발주 수정)
    let 매입처코드;

    if (isNewOrderMode) {
      // 신규 발주서 작성 모드
      매입처코드 = document.getElementById('selectedSupplierCode').value;
    } else {
      // 발주 수정 모드
      const orderManageEditModal = document.getElementById('orderManageEditModal');
      매입처코드 = orderManageEditModal.dataset.매입처코드;
    }

    if (!매입처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/price-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('priceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            이 거래처에 출고한 이력이 없습니다
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
          selectPriceFromHistory(item.출고단가);
        };

        const 입출고일자 = item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 적요 = item.적요 || '-';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${입출고일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.출고단가 || 0).toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${(item.출고수량 || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280;">
            ${적요}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('❌ 실제 출고가 이력 조회 오류:', err);
    alert('실제 출고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주 제안가 이력 로드
async function loadOrderPriceHistory() {
  try {
    if (!selectedOrderMaterial) return;

    const 자재코드 = selectedOrderMaterial.분류코드 + selectedOrderMaterial.세부코드;

    // 매입처코드 가져오기 (신규 발주서 또는 발주 수정)
    let 매입처코드;

    if (isNewOrderMode) {
      // 신규 발주서 작성 모드
      매입처코드 = document.getElementById('selectedSupplierCode').value;
    } else {
      // 발주 수정 모드
      const orderManageEditModal = document.getElementById('orderManageEditModal');
      매입처코드 = orderManageEditModal.dataset.매입처코드;
    }

    if (!매입처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/order-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('priceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: #9ca3af;">
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
          selectPriceFromHistory(item.출고단가);
        };

        const 발주일자 = item.발주일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 수량 = parseFloat(item.수량 || 0);
        const 단가 = parseFloat(item.출고단가 || 0);
        const 합계 = 수량 * 단가;

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${발주일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${수량.toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${단가.toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${합계.toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280; font-size: 12px;">
            ${item.적요 || '-'}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('❌ 발주 제안가 이력 조회 오류:', err);
    alert('발주 제안가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 자재 추가 모달 열기
// mode: 'create' (작성 모달) 또는 'edit' (수정 모달)
function openOrderManageDetailAddModal(mode = 'create') {
  const parentModal = mode === 'create' ? 'orderManageCreateModal' : 'orderManageEditModal';
  console.log(`===== ${parentModal} > 자재 추가 버튼 클릭 =====`);

  // 모달 초기화
  selectedMaterialForAddForOrder = null;

  // 모달에 모드 저장 (확인 버튼에서 사용)
  const modal = document.getElementById('orderManageDetailAddModal');
  if (modal) {
    modal.dataset.mode = mode;
  }

  // 자재 검색 섹션 ID 로깅

  // 자재 검색 필드 초기화
  const categoryInput = document.getElementById('addDetailMaterialSearchCategoryForOrder');
  const codeInput = document.getElementById('addDetailMaterialSearchCodeForOrder');
  const nameInput = document.getElementById('addDetailMaterialSearchNameForOrder');
  if (categoryInput) categoryInput.value = '';
  if (codeInput) codeInput.value = '';
  if (nameInput) nameInput.value = '';

  // 수량/단가/금액 필드 초기화
  const quantityInput = document.getElementById('addDetailQuantityForOrder');
  const priceInput = document.getElementById('addDetailPriceForOrder');
  const amountInput = document.getElementById('addDetailAmountForOrder');
  if (quantityInput) quantityInput.value = '1';
  if (priceInput) priceInput.value = '0';
  if (amountInput) amountInput.value = '0';

  // 검색 결과 및 선택 정보 숨기기
  const searchResults = document.getElementById('addDetailMaterialSearchResultsForOrder');
  const selectedInfo = document.getElementById('addDetailSelectedMaterialInfoForOrder');
  if (searchResults) searchResults.style.display = 'none';
  if (selectedInfo) selectedInfo.style.display = 'none';

  // 검색 결과 테이블 초기화
  const tbody = document.getElementById('addDetailMaterialSearchTableBodyForOrder');
  if (tbody) tbody.innerHTML = '';

  // 모달 표시
  if (modal) {
    modal.style.display = 'block';

    // 드래그로 인한 transform 초기화 (overflow-x 방지)
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.transform = 'none';
      modalContent.style.left = '';
      modalContent.style.top = '';
    }
  }
}

// ✅ 자재 검색 함수 (발주 상세내역 추가용)
async function searchAddDetailMaterialsForOrder() {
  try {
    const searchCategory = document
      .getElementById('addDetailMaterialSearchCategoryForOrder')
      .value.trim();
    const searchCode = document.getElementById('addDetailMaterialSearchCodeForOrder').value.trim();
    let searchName = document.getElementById('addDetailMaterialSearchNameForOrder').value.trim();
    let searchSpec = ''; // 규격 검색어

    // 자재명에서 쉼표로 분리하여 자재명과 규격 검색어 추출
    // 예: "케이블, 200mm" → 자재명: "케이블", 규격: "200mm"
    if (searchName && searchName.includes(',')) {
      const parts = searchName.split(',').map((s) => s.trim());
      searchName = parts[0] || ''; // 첫 번째 부분: 자재명
      searchSpec = parts[1] || ''; // 두 번째 부분: 규격

      console.log(`  자재명 검색: "${searchName}", 규격 검색: "${searchSpec}"`);
    }

    if (!searchCategory && !searchCode && !searchName) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    const params = new URLSearchParams();
    if (searchCategory) params.append('searchCategory', searchCategory);
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);
    if (searchSpec) params.append('searchSpec', searchSpec); // 규격 검색어 추가
    params.append('removeDuplicates', 'true'); // 중복 제거 활성화

    const response = await fetch(`${API_BASE_URL}/materials?${params.toString()}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '자재 조회 실패');
    }

    const materials = result.data || [];

    const tbody = document.getElementById('addDetailMaterialSearchTableBodyForOrder');
    tbody.innerHTML = '';

    if (materials.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #6b7280;">검색 결과가 없습니다.</td></tr>';
    } else {
      materials.forEach((material) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.style.transition = 'background 0.2s';
        row.onmouseover = function () {
          this.style.background = '#f9fafb';
        };
        row.onmouseout = function () {
          this.style.background = 'white';
        };
        row.onclick = function () {
          selectAddDetailMaterialForOrder(material);
        };

        const 품목코드 = (material.분류코드 || '') + (material.세부코드 || '');

        row.innerHTML = `
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${품목코드}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
            material.자재명 || '-'
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
            material.규격 || '-'
          }</td>
        `;
        tbody.appendChild(row);
      });
    }

    // 검색 결과 표시
    document.getElementById('addDetailMaterialSearchResultsForOrder').style.display = 'block';
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 자재 검색 초기화 함수
function clearAddDetailMaterialSearchForOrder() {
  document.getElementById('addDetailMaterialSearchCategoryForOrder').value = '';
  document.getElementById('addDetailMaterialSearchCodeForOrder').value = '';
  document.getElementById('addDetailMaterialSearchNameForOrder').value = '';
  document.getElementById('addDetailMaterialSearchResultsForOrder').style.display = 'none';
}

// ✅ 자재 선택 함수
function selectAddDetailMaterialForOrder(material) {
  selectedMaterialForAddForOrder = {
    품목코드: (material.분류코드 || '') + (material.세부코드 || ''),
    품목명: material.자재명,
    판매단가: material.출고단가 || material.출고단가1 || 0,
    규격: material.규격 || '',
    단위: material.단위 || '',
    분류코드: material.분류코드 || '',
    세부코드: material.세부코드 || '',
  };

  // 선택된 자재 정보 표시
  document.getElementById('addDetailSelectedMaterialNameForOrder').textContent =
    selectedMaterialForAddForOrder.품목명 +
    (selectedMaterialForAddForOrder.규격 ? ` (${selectedMaterialForAddForOrder.규격})` : '');
  document.getElementById(
    'addDetailSelectedMaterialCodeForOrder',
  ).textContent = `품목코드: ${selectedMaterialForAddForOrder.품목코드}`;

  document.getElementById('addDetailSelectedMaterialInfoForOrder').style.display = 'block';

  // 단가 자동 입력
  document.getElementById('addDetailPriceForOrder').value = selectedMaterialForAddForOrder.판매단가;

  // 금액 자동 계산
  calculateAddDetailAmountForOrder();

  // 검색 결과 숨기기
  document.getElementById('addDetailMaterialSearchResultsForOrder').style.display = 'none';
}

// ✅ 선택 취소
function clearAddDetailSelectedMaterialForOrder() {
  selectedMaterialForAddForOrder = null;

  document.getElementById('addDetailSelectedMaterialInfoForOrder').style.display = 'none';

  document.getElementById('addDetailPriceForOrder').value = '0';

  calculateAddDetailAmountForOrder();
}

// ✅ 금액 자동 계산
function calculateAddDetailAmountForOrder() {
  const 수량 = parseFloat(document.getElementById('addDetailQuantityForOrder').value) || 0;
  const 단가 = parseFloat(document.getElementById('addDetailPriceForOrder').value) || 0;

  const 금액 = 수량 * 단가;

  document.getElementById('addDetailAmountForOrder').value = 금액.toLocaleString();
}

// ✅ 이전 단가 조회
async function showOrderManageDetailPriceHistory() {
  try {
    if (!selectedMaterialForAddForOrder) {
      alert('먼저 자재를 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 =
      selectedMaterialForAddForOrder.품목코드 ||
      selectedMaterialForAddForOrder.분류코드 + selectedMaterialForAddForOrder.세부코드;

    // 매입처코드 가져오기 (발주서 작성 모달에서)
    const 매입처코드 =
      document.getElementById('orderManageCreateSupplierCode')?.value ||
      document.getElementById('selectedSupplierCode')?.value;

    if (!매입처코드) {
      alert('매입처를 먼저 선택해주세요.');
      return;
    }

    // 자재 정보 표시
    const nameEl = document.getElementById('orderManagePriceHistoryMaterialName');
    const codeEl = document.getElementById('orderManagePriceHistoryMaterialCode');

    if (nameEl) nameEl.textContent = selectedMaterialForAddForOrder.품목명;
    if (codeEl) codeEl.textContent = `[${자재코드}] ${selectedMaterialForAddForOrder.규격 || ''}`;

    // 탭 초기화
    currentOrderManagePriceHistoryTab = 'actual';
    const actualTab = document.getElementById('orderManagePriceHistoryActualTab');
    const orderTab = document.getElementById('orderManagePriceHistoryOrderTab');

    if (actualTab) {
      actualTab.style.background = '#3b82f6';
      actualTab.style.color = 'white';
      actualTab.style.borderBottom = '3px solid #3b82f6';
    }
    if (orderTab) {
      orderTab.style.background = 'transparent';
      orderTab.style.color = '#6b7280';
      orderTab.style.borderBottom = '3px solid transparent';
    }

    // 실제 출고단가 이력 로드
    await loadActualPriceHistoryForOrderAddDetail(자재코드, 매입처코드);

    // 모달 표시
    const modal = document.getElementById('orderManagePriceHistoryModal');

    if (modal) {
      modal.style.display = 'block';
    } else {
      console.error('❌ orderManagePriceHistoryModal 요소를 찾을 수 없음!');
    }
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    console.error('스택 트레이스:', err.stack);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 상세내역 추가용 실제 출고단가 이력 로드
async function loadActualPriceHistoryForOrderAddDetail(자재코드, 매입처코드) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/materials/${encodeURIComponent(자재코드)}/order-history/${encodeURIComponent(
        매입처코드,
      )}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP 에러:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '단가 이력 조회 실패');
    }

    const history = result.data || [];
    const tbody = document.getElementById('orderManagePriceHistoryTableBody');

    if (!tbody) {
      console.error('❌ orderManagePriceHistoryTableBody 요소를 찾을 수 없음!');
      throw new Error('테이블 요소를 찾을 수 없습니다.');
    }

    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: #6c757d;">
            이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      history.forEach((item) => {
        const row = tbody.insertRow();
        row.style.cursor = 'pointer';
        row.onclick = function () {
          applyOrderAddDetailPriceFromHistory(item.단가);
        };

        const 수량 = parseFloat(item.수량 || 0);
        const 단가 = parseFloat(item.단가 || 0);
        const 합계 = 수량 * 단가;

        row.innerHTML = `
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${
            item.입출고일자?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') || '-'
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: right;">${수량.toLocaleString()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600; color: #007bff;">${단가.toLocaleString()}원</td>
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: right;">${합계.toLocaleString()}원</td>
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: center; color: #6b7280; font-size: 12px;">${
            item.적요 || '-'
          }</td>
        `;
      });
    }
  } catch (err) {
    console.error('❌ 실제 출고단가 이력 조회 오류:', err);
    alert('실제 출고단가 이력을 불러오는 중 오류가 발생했습니다.');
  }
}

// ✅ 이력에서 단가 적용
function applyOrderAddDetailPriceFromHistory(price) {
  document.getElementById('addDetailPriceForOrder').value = price;
  calculateAddDetailAmountForOrder();
  closeOrderManagePriceHistoryModal();
}

// ✅ 자재 추가 모달 닫기
function closeOrderManageDetailAddModal() {
  document.getElementById('orderManageDetailAddModal').style.display = 'none';

  // 발주서 작성 모달 다시 표시
  if (isNewOrderMode) {
    const orderManageCreateModal = document.getElementById('orderManageCreateModal');
    orderManageCreateModal.style.display =
      orderManageCreateModal.dataset.previousDisplay || 'block';
    isNewOrderMode = false;
  }
}

// ✅ 자재 추가 확인 (작성/수정 모드 분기)
function confirmOrderManageDetailAdd() {
  try {
    // 모드 확인
    const modal = document.getElementById('orderManageDetailAddModal');
    const mode = modal ? modal.dataset.mode : 'create';

    // 선택된 자재 확인
    if (!selectedMaterialForAddForOrder) {
      alert('품목을 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 =
      selectedMaterialForAddForOrder.품목코드 ||
      selectedMaterialForAddForOrder.분류코드 + selectedMaterialForAddForOrder.세부코드;
    const 수량 = parseFloat(document.getElementById('addDetailQuantityForOrder').value) || 0;
    const 단가 = parseFloat(document.getElementById('addDetailPriceForOrder').value) || 0;

    const 공급가액 = 수량 * 단가;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    if (mode === 'edit') {
      // 발주 수정 모드 - DataTable에 행 추가
      const newRow = {
        자재코드: 자재코드,
        자재명: selectedMaterialForAddForOrder.품목명 || selectedMaterialForAddForOrder.자재명,
        규격: selectedMaterialForAddForOrder.규격 || '-',
        단위: selectedMaterialForAddForOrder.단위 || '-',
        수량: 수량,
        단가: 단가,
        공급가액: 공급가액,
        _isNew: true,
      };

      window.orderManageEditDetailDataTable.row.add(newRow).draw();

      // 합계 재계산
      recalculateOrderManageEditTotal();
    } else {
      // 신규 발주서 작성 모드: newOrderDetails 배열에 추가
      const newDetail = {
        자재코드: 자재코드,
        자재명: selectedMaterialForAddForOrder.품목명 || selectedMaterialForAddForOrder.자재명,
        규격: selectedMaterialForAddForOrder.규격 || '',
        단위: selectedMaterialForAddForOrder.단위 || '',
        수량: 수량,
        단가: 단가,
        공급가액: 공급가액,
      };

      newOrderDetails.push(newDetail);

      // 테이블 렌더링
      renderNewOrderDetailTable();
    }

    // 자재 추가 모달 닫기
    closeOrderManageDetailAddModal();
  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ [이전 코드 - 참고용] 발주 수정 모드의 자재 추가 (별도 함수로 분리 필요시 사용)
function confirmOrderManageDetailAddForEdit() {
  try {
    if (!selectedMaterialForAddForOrder) {
      alert('품목을 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 =
      selectedMaterialForAddForOrder.품목코드 ||
      selectedMaterialForAddForOrder.분류코드 + selectedMaterialForAddForOrder.세부코드;
    const 수량 = parseFloat(document.getElementById('addDetailQuantityForOrder').value) || 0;
    const 단가 = parseFloat(document.getElementById('addDetailPriceForOrder').value) || 0;
    const 공급가액 = 수량 * 단가;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 발주 수정 모드 - DataTable에 행 추가
    const newRow = {
      자재코드: 자재코드,
      자재명: selectedMaterialForAddForOrder.품목명 || selectedMaterialForAddForOrder.자재명,
      규격: selectedMaterialForAddForOrder.규격 || '-',
      단위: selectedMaterialForAddForOrder.단위 || '-',
      수량: 수량,
      단가: 단가,
      공급가액: 공급가액,
      _isNew: true,
    };

    window.orderManageEditDetailDataTable.row.add(newRow).draw();

    // 합계 재계산
    recalculateOrderManageEditTotal();

    // 모달 닫기
    closeOrderManageDetailAddModal();
  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주내역 품목 수정 함수 - 모달 열기
function editOrderManageDetailRow(rowIndex) {
  console.log('===== orderManageEditModal > orderManageEditDetailTable > 수정 버튼 클릭 =====');

  try {
    const table = window.orderManageEditDetailDataTable;
    if (!table) {
      console.error('❌ orderManageEditModal > DataTable을 찾을 수 없습니다.');
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 현재 행 데이터 가져오기
    const rowData = table.row(rowIndex).data();

    if (!rowData) {
      console.error('❌ orderManageEditModal > 행 데이터를 찾을 수 없습니다.');
      alert('행 데이터를 찾을 수 없습니다.');
      return;
    }

    // 모달에 데이터 표시
    document.getElementById('editDetailCodeForOrder').textContent = rowData.자재코드 || '-';
    document.getElementById('editDetailNameForOrder').textContent = rowData.자재명 || '-';
    document.getElementById('editDetailSpecForOrder').textContent = rowData.규격 || '-';

    document.getElementById('editDetailQuantityForOrder').value = rowData.수량 || 0;

    // ✅ API에서 '단가'로 반환 (출고단가 as 단가)
    document.getElementById('editDetailPriceForOrder').value = rowData.단가 || 0;

    // ✅ API에서 '공급가액'으로 반환 (수량 * 출고단가)
    document.getElementById('editDetailAmountForOrder').value = (
      rowData.공급가액 || 0
    ).toLocaleString();

    // 모달에 rowIndex 저장 (editIndex는 삭제하여 발주서 관리 모드로 설정)
    const modal = document.getElementById('orderManageDetailEditModal');
    delete modal.dataset.editIndex;
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.orderManageDetailEditModalDraggable) {
      makeModalDraggable('orderManageDetailEditModal', 'orderManageDetailEditModalHeader');
      window.orderManageDetailEditModalDraggable = true;
    }
  } catch (err) {
    console.error('❌ orderManageDetailEditModal > 품목 수정 모달 열기 오류:', err);
    alert('품목 수정 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 공급가액 자동 계산 (품목 수정 모달)
function calculateOrderManageEditDetailAmount() {
  const quantity = parseFloat(document.getElementById('editDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('editDetailPrice').value) || 0;
  const amount = quantity * price;

  document.getElementById('editDetailAmount').value = amount.toLocaleString();
}

// ✅ 발주내역 품목 수정 모달 닫기
function closeOrderManageDetailEditModal() {
  console.log('===== orderManageDetailEditModal > 취소 버튼 클릭 =====');

  const modal = document.getElementById('orderManageDetailEditModal');
  modal.style.display = 'none';

  // dataset 초기화
  delete modal.dataset.rowIndex;
  delete modal.dataset.editIndex;
}

// ✅ 발주내역 품목 수정 확인 (발주서 관리 + 신규 발주서)
function confirmOrderManageDetailEdit() {
  console.log('===== orderManageDetailEditModal > 저장 버튼 클릭 =====');

  try {
    const modal = document.getElementById('orderManageDetailEditModal');

    // 신규 발주서 작성 모드인지 확인 (editIndex가 있으면 신규 발주서)
    if (
      modal.dataset.editIndex !== undefined &&
      modal.dataset.editIndex !== null &&
      modal.dataset.editIndex !== ''
    ) {
      confirmNewOrderDetailEdit();
      return;
    }

    // 발주서 관리 모드 (rowIndex 사용)
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.orderManageEditDetailDataTable;
    if (!table) {
      console.error('❌ orderManageEditModal > DataTable을 찾을 수 없습니다.');
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    const rowData = table.row(rowIndex).data();
    if (!rowData) {
      console.error('❌ orderManageEditModal > 행 데이터를 찾을 수 없습니다.');
      alert('행 데이터를 찾을 수 없습니다.');
      return;
    }

    // 입력값 가져오기
    const 수량 = parseFloat(document.getElementById('editDetailQuantity').value) || 0;
    const 단가 = parseFloat(document.getElementById('editDetailPrice').value) || 0;
    const 공급가액 = 수량 * 단가;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 행 데이터 업데이트 (API 필드명에 맞춤)
    rowData.수량 = 수량;
    rowData.단가 = 단가;
    rowData.공급가액 = 공급가액;

    // DataTable 업데이트
    table.row(rowIndex).data(rowData).invalidate().draw(false);

    // 합계 재계산
    recalculateOrderManageEditTotal();

    // 모달 닫기
    closeOrderManageDetailEditModal();
  } catch (err) {
    console.error('❌ 품목 수정 오류:', err);
    alert('품목 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주내역 품목 삭제 함수 - 모달 열기
function deleteOrderManageDetailRow(rowIndex) {
  console.log('===== orderManageEditModal > orderManageEditDetailTable > 삭제 버튼 클릭 =====');

  try {
    const table = window.orderManageEditDetailDataTable;
    if (!table) {
      console.error('❌ orderManageEditModal > DataTable을 찾을 수 없습니다.');
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 현재 행 데이터 가져오기
    const rowData = table.row(rowIndex).data();

    if (!rowData) {
      console.error('❌ orderManageEditModal > 행 데이터를 찾을 수 없습니다.');
      alert('행 데이터를 찾을 수 없습니다.');
      return;
    }

    // 모달에 정보 표시
    document.getElementById(
      'deleteOrderDetailInfo',
    ).textContent = `[${rowData.자재코드}] ${rowData.자재명}`;

    // 모달에 rowIndex 저장 (deleteIndex는 삭제하여 발주서 수정 모드로 설정)
    const modal = document.getElementById('orderManageDetailDeleteConfirmModal');
    delete modal.dataset.deleteIndex;
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 삭제 오류:', err);
    alert('품목 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주 품목 삭제 모달 닫기
function closeOrderManageDetailDeleteConfirmModal() {
  console.log('===== orderManageDetailDeleteConfirmModal > 취소 버튼 클릭 =====');

  const modal = document.getElementById('orderManageDetailDeleteConfirmModal');
  modal.style.display = 'none';

  // dataset 초기화
  delete modal.dataset.rowIndex;
  delete modal.dataset.deleteIndex;
}

// ✅ 발주 품목 삭제 확인 (발주서 수정 + 신규 발주서 작성)
function confirmOrderManageDetailDelete() {
  console.log('===== orderManageDetailDeleteConfirmModal > 삭제 확인 버튼 클릭 =====');

  try {
    const modal = document.getElementById('orderManageDetailDeleteConfirmModal');

    // 신규 발주서 작성 모드인지 확인 (deleteIndex가 있으면 신규 발주서)
    if (
      modal.dataset.deleteIndex !== undefined &&
      modal.dataset.deleteIndex !== null &&
      modal.dataset.deleteIndex !== ''
    ) {
      const index = parseInt(modal.dataset.deleteIndex);

      // newOrderDetails 배열에서 삭제
      newOrderDetails.splice(index, 1);

      // 테이블 다시 렌더링
      renderNewOrderDetailTable();

      // 모달 닫기
      closeOrderManageDetailDeleteConfirmModal();
      return;
    }

    // 발주서 수정 모드 (rowIndex 사용)
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.orderManageEditDetailDataTable;
    if (!table) {
      console.error('❌ orderManageEditModal > DataTable을 찾을 수 없습니다.');
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 행 삭제
    table.row(rowIndex).remove().draw(false);

    // 합계 재계산
    recalculateOrderManageEditTotal();

    // 모달 닫기
    closeOrderManageDetailDeleteConfirmModal();
  } catch (err) {
    console.error('❌ 품목 삭제 오류:', err);
    alert('품목 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 선택된 발주내역 삭제 함수
function deleteSelectedOrderManageDetails() {
  const checkedBoxes = $('.editDetailCheckbox:checked');

  if (checkedBoxes.length === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }

  if (!confirm(`선택한 ${checkedBoxes.length}개 항목을 삭제하시겠습니까?`)) {
    return;
  }

  // DataTable에서 선택된 행 제거
  const table = window.orderManageEditDetailDataTable;
  checkedBoxes.each(function () {
    const row = table.row($(this).closest('tr'));
    row.remove();
  });

  table.draw();

  // 합계 재계산
  recalculateOrderManageEditTotal();
}

// ✅ 발주 수정 모달 합계 재계산
function recalculateOrderManageEditTotal() {
  if (!window.orderManageEditDetailDataTable) return;

  const data = window.orderManageEditDetailDataTable.rows().data().toArray();
  // ✅ API 필드명 '공급가액' 사용
  const totalAmount = data.reduce((sum, item) => sum + (item.공급가액 || 0), 0);
  $('#orderManageEditDetailTotal').text(totalAmount.toLocaleString());
}

// ✅ 발주 수정 제출 (마스터 + 상세)
async function submitOrderManageEdit(event) {
  // form submit 이벤트인 경우 기본 동작 방지
  if (event) {
    event.preventDefault();
  }

  const modal = document.getElementById('orderManageEditModal');
  const orderDate = modal.dataset.orderDate;
  const orderNo = modal.dataset.orderNo;

  try {
    // ✅ 1. 마스터 정보 업데이트 (Prefix Rule 적용)
    const orderDateInput = document.getElementById('orderManageEditDate');
    const orderDateText = orderDateInput.value || orderDateInput.textContent;
    const deliveryDateInput = document.getElementById('orderManageEditDeliveryDate');
    const titleInput = document.getElementById('orderManageEditTitle');
    const remarkInput = document.getElementById('orderManageEditRemark');

    const masterData = {
      발주일자: orderDateText ? orderDateText.replace(/-/g, '') : orderDate,
      매입처코드: modal.dataset.매입처코드,
      출고희망일자: deliveryDateInput?.value ? deliveryDateInput.value.replace(/-/g, '') : '',
      제목: titleInput?.value || '',
      적요: remarkInput?.value || '',
    };

    const masterResponse = await fetch(`/api/orders/${orderDate}/${orderNo}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify(masterData),
    });

    const masterResult = await masterResponse.json();

    if (!masterResult.success) {
      throw new Error(masterResult.message || '발주 마스터 수정 실패');
    }

    // 2. 발주 상세 정보 업데이트
    const detailData = window.orderManageEditDetailDataTable.rows().data().toArray();

    if (detailData.length > 0) {
      // 상세 정보를 서버 형식에 맞게 변환
      const detailPayload = detailData.map((item, index) => {
        // 자재코드가 분리되어 있는 경우 합치기
        let 자재코드 = item.자재코드;
        if (item.분류코드 && item.세부코드) {
          자재코드 = item.분류코드 + item.세부코드;
        }

        // 자재코드 길이 제한 (최대 18자)
        if (자재코드 && 자재코드.length > 18) {
          console.warn('⚠️ 자재코드가 18자를 초과하여 잘림:', 자재코드);
          자재코드 = 자재코드.substring(0, 18);
        }

        // 자재코드가 없거나 빈 문자열인 경우 에러
        if (!자재코드 || 자재코드.trim() === '') {
          console.error('❌ 자재코드가 비어있음:', item);
          throw new Error(`자재코드가 비어있습니다: ${item.자재명}`);
        }

        const payload = {
          자재코드: 자재코드.trim(),
          수량: parseFloat(item.수량) || 0,
          // ✅ API 필드명: '단가' (출고단가 as 단가)
          출고단가: parseFloat(item.단가 || item.출고단가) || 0,
          // ✅ API 필드명: '공급가액' (수량 * 출고단가)
          금액: parseFloat(item.공급가액 || item.금액) || 0,
        };

        if (index < 3) {
          // 첫 3개만 로깅
        }

        return payload;
      });

      const detailResponse = await fetch(`/api/orders/${orderDate}/${orderNo}/details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 세션 쿠키 포함
        body: JSON.stringify(detailPayload),
      });

      const detailResult = await detailResponse.json();

      if (!detailResult.success) {
        throw new Error(detailResult.message || '발주 상세 수정 실패');
      }
    }

    alert('✅ 발주이 성공적으로 수정되었습니다.');
    closeOrderManageEditModal();

    // DataTable 새로고침
    if (window.orderManageTableInstance) {
      window.orderManageTableInstance.ajax.reload();
    }
  } catch (err) {
    console.error('❌ 발주 수정 오류:', err);
    alert('발주 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주 삭제 함수 - 모달 열기
async function deleteOrderManage(orderDate, orderNo) {
  console.log('===== orderManageTable > 삭제 버튼 클릭 =====');

  // 모달 요소 확인
  const modal = document.getElementById('orderManageDeleteConfirmModal');
  if (!modal) {
    console.error('❌ orderManageDeleteConfirmModal 요소를 찾을 수 없습니다');
    alert('삭제 모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  try {
    // 발주 정보 조회 (세부내역 건수 가져오기)
    const response = await fetch(`/api/orders/${orderDate}/${orderNo}`);
    const result = await response.json();

    let detailCount = 0;
    if (result.success && result.data && result.data.details) {
      detailCount = result.data.details.length;
    }

    // 단일 발주을 선택된 발주 형식으로 변환
    const selectedOrders = [
      {
        orderDate,
        orderNo,
        supplierName: '',
        title: '',
        detailCount, // 세부내역 건수 추가
      },
    ];

    // 모달에 발주 정보 표시 (세부내역 건수)
    const deleteInfo = document.getElementById('orderManageDeleteInfo');
    if (deleteInfo) {
      deleteInfo.textContent = `세부내역 ${detailCount}건`;
    } else {
      console.error('❌ orderManageDeleteInfo 요소를 찾을 수 없습니다');
    }

    // 모달에 데이터 저장
    modal.dataset.selectedOrders = JSON.stringify(selectedOrders);

    // 모달 표시
    modal.style.display = 'flex';
  } catch (err) {
    console.error('❌ 발주 정보 조회 오류:', err);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주 삭제 모달 닫기
function closeOrderManageDeleteConfirmModal() {
  const modal = document.getElementById('orderManageDeleteConfirmModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ✅ 선택된 발주 삭제 (체크박스)
function deleteSelectedOrders() {
  const checkboxes = document.querySelectorAll(
    '#orderManageTable tbody input[type="checkbox"]:checked',
  );

  if (checkboxes.length === 0) {
    alert('삭제할 발주을 선택해주세요.');
    return;
  }

  // 선택된 발주 정보 수집
  const selectedOrders = [];
  checkboxes.forEach((checkbox) => {
    const row = checkbox.closest('tr');
    const orderDate = row.dataset.orderDate;
    const orderNo = row.dataset.orderNo;
    const supplierName = row.querySelector('td:nth-child(4)').textContent; // 매입처명
    const title = row.querySelector('td:nth-child(6)').textContent; // 제목

    selectedOrders.push({
      orderDate,
      orderNo,
      supplierName,
      title,
    });
  });

  // 모달에 선택된 발주 정보 표시
  const deleteInfo = document.getElementById('orderManageDeleteInfo');
  if (deleteInfo) {
    deleteInfo.textContent = `${selectedOrders.length}건`;
  } else {
    console.error('❌ orderManageDeleteInfo 요소를 찾을 수 없습니다');
  }

  // 모달에 데이터 저장
  const modal = document.getElementById('orderManageDeleteConfirmModal');
  modal.dataset.selectedOrders = JSON.stringify(selectedOrders);

  // 모달 표시
  modal.style.display = 'flex';
}

// ✅ 발주 삭제 확인
async function confirmOrderManageDelete() {
  console.log('===== orderManageDeleteConfirmModal > 삭제 확인 버튼 클릭 =====');

  const modal = document.getElementById('orderManageDeleteConfirmModal');

  const selectedOrdersJson = modal.dataset.selectedOrders;

  if (!selectedOrdersJson) {
    console.error('❌ 삭제할 발주 정보가 없습니다');
    alert('삭제할 발주 정보가 없습니다.');
    return;
  }

  const selectedOrders = JSON.parse(selectedOrdersJson);

  let successCount = 0;
  let failCount = 0;

  try {
    // 각 발주에 대해 삭제 요청
    for (const q of selectedOrders) {
      try {
        const response = await fetch(`/api/orders/${q.orderDate}/${q.orderNo}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`❌ 발주 삭제 실패: ${q.orderDate}-${q.orderNo}`, result.message);
        }
      } catch (err) {
        failCount++;
        console.error(`❌ 발주 삭제 오류: ${q.orderDate}-${q.orderNo}`, err);
      }
    }

    // 결과 표시
    if (failCount === 0) {
      alert(`✅ ${successCount}건의 발주이 삭제되었습니다.`);
    } else {
      alert(`⚠️ ${successCount}건 삭제 완료, ${failCount}건 삭제 실패`);
    }

    closeOrderManageDeleteConfirmModal();

    // 전체 선택 체크박스 해제
    const selectAllCheckbox = document.getElementById('orderManageSelectAll');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
    }

    // DataTable 새로고침
    if (window.orderManageTableInstance) {
      window.orderManageTableInstance.ajax.reload();
    }
  } catch (err) {
    console.error('❌ 발주 삭제 오류:', err);
    alert('발주 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주 승인 함수 - 모달 열기
function approveOrderManage(orderDate, orderNo) {
  console.log('===== orderManageTable > 승인 버튼 클릭 =====');

  // 모달 요소 확인
  const modal = document.getElementById('orderManageApproveConfirmModal');
  if (!modal) {
    console.error('❌ orderManageApproveConfirmModal 요소를 찾을 수 없습니다');
    alert('승인 모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 모달 내부 요소 ID 로깅

  // 모달에 발주 정보 표시
  const infoElement = document.getElementById('orderManageApproveInfo');
  if (infoElement) {
    infoElement.textContent = `발주번호: ${orderDate}-${orderNo}`;
  }

  // 모달에 데이터 저장
  modal.dataset.orderDate = orderDate;
  modal.dataset.orderNo = orderNo;

  // 모달 표시
  modal.style.display = 'flex';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.orderManageApproveConfirmModalDraggable) {
    makeModalDraggable('orderManageApproveConfirmModal', 'orderManageApproveConfirmModalHeader');
    window.orderManageApproveConfirmModalDraggable = true;
  }
}

// ✅ 발주 승인 모달 닫기
function closeOrderManageApproveConfirmModal() {
  const modal = document.getElementById('orderManageApproveConfirmModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ✅ 발주 승인 확인
async function confirmOrderManageApprove() {
  console.log('===== orderManageApproveConfirmModal > 승인 확인 버튼 클릭 =====');

  const modal = document.getElementById('orderManageApproveConfirmModal');

  const orderDate = modal.dataset.orderDate;
  const orderNo = modal.dataset.orderNo;

  try {
    const response = await fetch(`/api/orders/${orderDate}/${orderNo}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ 발주이 승인되었습니다.');
      closeOrderManageApproveConfirmModal();

      // DataTable 새로고침
      if (window.orderManageTableInstance) {
        window.orderManageTableInstance.ajax.reload();
      }
    } else {
      throw new Error(result.message || '발주 승인 실패');
    }
  } catch (err) {
    console.error('❌ 발주 승인 오류:', err);
    alert('발주 승인 중 오류가 발생했습니다: ' + err.message);
  }
}

// ==================== 발주서 작성 모달 ====================

// 발주서 작성용 상세내역 배열
let newOrderDetails = [];

// ✅ 발주서 작성 모달 열기
function openOrderManageCreateModal() {
  console.log('===== orderManagePage > 작성 버튼 클릭 =====');

  // 모달 제목 설정
  document.getElementById('orderManageCreateModalTitle').textContent = '발주서 작성';

  // 폼 초기화
  document.getElementById('orderManageCreateForm').reset();

  // 매입처 정보 초기화
  document.getElementById('orderManageCreateSupplierCode').value = '';
  document.getElementById('orderManageCreateSupplierName').value = '';
  const infoDiv = document.getElementById('orderManageCreateSupplierInfo');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }

  // 발주일자를 오늘 날짜로 설정
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('orderManageCreateDate').value = today;

  // 상세내역 초기화
  newOrderDetails = [];
  renderNewOrderDetailTable();

  // 모달 표시
  const modal = document.getElementById('orderManageCreateModal');
  modal.style.display = 'block';
  modal.style.position = 'fixed';

  // ✅ 드래그 기능 활성화 (최초 1회만 실행)
  const modalContent = document.getElementById('orderModalContent');
  if (!window.orderManageCreateModalDraggable) {
    // 최초 실행시에만 modal-content에 드래그를 위한 positioning 설정
    if (modalContent) {
      modalContent.style.position = 'absolute';
      modalContent.style.top = '50%';
      modalContent.style.left = '50%';
      modalContent.style.transform = 'translate(-50%, -50%)';
      modalContent.style.margin = '0';
    }

    // makeModalDraggable 함수 호출 (modal-draggable.js에서 로드됨)
    if (typeof makeModalDraggable === 'function') {
      makeModalDraggable('orderManageCreateModal', 'orderModalHeader');
      window.orderManageCreateModalDraggable = true;
    } else {
      console.error(
        '❌ makeModalDraggable 함수를 찾을 수 없습니다. modal-draggable.js가 로드되었는지 확인하세요.',
      );
    }
  }
}

// ✅ 발주서 작성 모달 닫기
function closeOrderManageCreateModal() {
  document.getElementById('orderManageCreateModal').style.display = 'none';

  // 발주 체크박스만 초기화
  $('#orderManageSelectAll').prop('checked', false);
  $('.orderRowCheck').prop('checked', false);

  // 버튼 상태도 초기화
  $('.orderRowCheck').each(function () {
    const orderDate = $(this).data('date');
    const orderNo = $(this).data('no');
    const actionDiv = $(`#orderActions-${orderDate}_${orderNo}`);

    actionDiv.find('.orderBtnView').show();
    actionDiv.find('.orderBtnEdit').hide();
    actionDiv.find('.orderBtnDelete').hide();
    actionDiv.find('.orderBtnApprove').hide(); // ✅ 승인 버튼도 숨김
  });

  newOrderDetails = [];
}

// ✅ 발주서 작성용 매입처 검색 모달 열기 (공통 모달 1개 사용)
function openOrderManageCreateSupplierSearchModal() {
  // 발주 입력값을 공통 검색창에 전달
  const searchValue = document.getElementById('orderManageCreateSupplierName').value.trim();

  // [핵심] supplier.js의 공통 모달 열기 사용
  // callerContext = 'order' (선택 결과를 발주에 주입하기 위한 컨텍스트)
  // initialSearchValue = searchValue (매입처명 입력란의 값을 검색어로 전달)
  if (typeof window.openSupplierSearchModal === 'function') {
    window.openSupplierSearchModal('order', searchValue);
  } else {
    console.error('❌ window.openSupplierSearchModal 함수를 찾을 수 없습니다');
  }

  // 값이 있으면 자동검색 (모달이 열린 후 실행되도록 setTimeout 사용)
  if (searchValue) {
    setTimeout(() => {
      if (typeof window.searchSuppliersForModal === 'function') {
        window.searchSuppliersForModal();
      } else {
        searchOrderSuppliers();
      }
    }, 100);
  }
}

// ✅ 전역으로 노출 (HTML에서 호출할 수 있도록)
window.openOrderManageCreateSupplierSearchModal = openOrderManageCreateSupplierSearchModal;
// ❌ 절대 두지 마세요: 공통 openSupplierSearchModal을 덮어씀 (충돌 원인)
// window.openSupplierSearchModal = openOrderSupplierSearchModal;

// ✅ 발주서용 매입처 검색
// @deprecated - supplier.js의 공통 모달 검색 사용 (searchSuppliersForModal)
// supplier.js가 이미 별칭 제공: window.searchOrderSuppliers = window.searchSuppliersForModal
// 이 함수는 하위 호환성을 위해서만 유지됨
async function searchOrderSuppliers() {
  // supplier.js의 공통 검색 함수 사용
  if (typeof window.searchSuppliersForModal === 'function') {
    return window.searchSuppliersForModal();
  }

  console.error(
    '❌ searchSuppliersForModal 함수를 찾을 수 없습니다. supplier.js가 로드되었는지 확인하세요.',
  );
}

// ✅ 전역으로 노출 (하위 호환성)
// 참고: supplier.js가 이미 별칭 제공 - window.searchOrderSuppliers = window.searchSuppliersForModal
window.searchOrderSuppliers = searchOrderSuppliers;

// ==================== 품목 선택 처리 ====================

/**
 * 품목 검색 모달 열기 (발주서 작성용)
 * @description HTML에서 호출하는 발주 전용 함수 (material.js의 공용 모달 사용)
 */
window.openOrderMaterialSearch = function () {
  // material.js의 공용 모달 열기 (context: 'order')
  if (typeof window.openMaterialSearchModal === 'function') {
    window.openMaterialSearchModal('order', '');
  } else {
    console.error('❌ material.js의 openMaterialSearchModal 함수를 찾을 수 없습니다.');
  }
};

// ✅ [발주관리 - 신규] 품목 선택 처리 함수 (material.js에서 호출)
window.selectOrderMaterial = function (material) {
  // 자재코드 생성
  const 자재코드 = (material.분류코드 || '') + (material.세부코드 || '');

  // newOrderDetails 배열에 추가
  newOrderDetails.push({
    자재코드: 자재코드,
    자재명: material.자재명,
    규격: material.규격 || '',
    수량: 1,
    단가: material.출고단가1 || 0,
  });

  // 테이블 렌더링
  renderNewOrderDetailTable();

  // 모달 닫기
  if (typeof window.closeMaterialSearchModal === 'function') {
    window.closeMaterialSearchModal();
  }
};

// ✅ [발주관리 - 수정] 품목 선택 처리 함수 (material.js에서 호출)
window.selectOrderEditMaterial = function (material) {
  // material.js에서 전달받은 데이터를 orderMaterialAddModal 형식에 맞게 변환
  const materialForModal = {
    품목코드: material.품목코드 || (material.분류코드 || '') + (material.세부코드 || ''),
    품목명: material.자재명,
    판매단가: material.출고단가 || material.출고단가1 || 0,
    규격: material.규격 || '',
  };

  // 선택된 품목 저장
  selectedMaterialForAdd = materialForModal;

  // 품목 검색 모달 닫기
  if (typeof window.closeMaterialSearchModal === 'function') {
    window.closeMaterialSearchModal();
  }

  // 품목 추가 모달 열기 (수량/단가 입력용)
  openOrderMaterialAddModal(materialForModal);
};

// ==================== 품목 추가 모달 관리 ====================

// 선택된 품목 정보 저장 (전역 변수가 이미 존재하면 재사용)
if (typeof selectedMaterialForAdd === 'undefined') {
  var selectedMaterialForAdd = null;
}

/**
 * 품목 추가 모달 열기
 * @param {Object} material - 미리 선택된 품목 정보 (선택적)
 */
window.openOrderMaterialAddModal = function (material) {
  const modal = document.getElementById('orderMaterialAddModal');
  if (!modal) {
    console.error('❌ orderMaterialAddModal 요소를 찾을 수 없습니다.');
    return;
  }

  // 모달 초기화
  document.getElementById('orderMaterialAddName').value = '';
  document.getElementById('orderMaterialAddQuantity').value = '1';
  document.getElementById('orderMaterialAddPrice').value = '0';
  document.getElementById('orderMaterialAddAmount').value = '0';
  document.getElementById('orderMaterialAddSelectedInfo').style.display = 'none';
  selectedMaterialForAdd = null;

  // 미리 선택된 품목이 있으면 표시
  if (material) {
    selectedMaterialForAdd = material;
    document.getElementById('orderMaterialAddName').value =
      material.품목명 || material.자재명 || '';
    document.getElementById('orderMaterialAddPrice').value =
      material.판매단가 || material.출고단가 || material.출고단가1 || 0;
    document.getElementById('orderMaterialAddSelectedName').textContent =
      material.품목명 || material.자재명 || '-';
    document.getElementById('orderMaterialAddSelectedCode').textContent = material.품목코드 || '-';
    document.getElementById('orderMaterialAddSelectedInfo').style.display = 'block';
    calculateOrderMaterialAddAmount();
  }

  modal.style.display = 'block';
};

/**
 * 품목 추가 모달 닫기
 */
window.closeOrderMaterialAddModal = function () {
  const modal = document.getElementById('orderMaterialAddModal');
  if (modal) {
    modal.style.display = 'none';
  }
  selectedMaterialForAdd = null;
};

/**
 * 선택된 품목 정보 초기화
 */
window.clearOrderMaterialAddSelected = function () {
  selectedMaterialForAdd = null;
  document.getElementById('orderMaterialAddName').value = '';
  document.getElementById('orderMaterialAddPrice').value = '0';
  document.getElementById('orderMaterialAddSelectedInfo').style.display = 'none';
  calculateOrderMaterialAddAmount();
};

/**
 * 금액 자동계산
 */
window.calculateOrderMaterialAddAmount = function () {
  const quantity = parseFloat(document.getElementById('orderMaterialAddQuantity').value) || 0;
  const price = parseFloat(document.getElementById('orderMaterialAddPrice').value) || 0;
  const amount = Math.round(quantity * price);
  document.getElementById('orderMaterialAddAmount').value = amount.toLocaleString();
};

/**
 * 품목 추가 확정 (직접 입력 또는 검색 선택 모두 지원)
 */
window.confirmOrderMaterialAdd = function () {
  const materialName = document.getElementById('orderMaterialAddName').value.trim();
  const quantity = parseFloat(document.getElementById('orderMaterialAddQuantity').value);
  const price = parseFloat(document.getElementById('orderMaterialAddPrice').value);

  // 품목명 입력 확인
  if (!materialName) {
    alert('품목명을 입력하거나 검색하여 선택해주세요.');
    return;
  }

  // 수량 입력 확인
  if (!quantity || quantity <= 0) {
    alert('수량을 입력해주세요.');
    return;
  }

  // ✅ 검색으로 선택한 경우와 직접 입력한 경우 모두 처리
  let 자재코드 = '';
  let 규격 = '';

  if (selectedMaterialForAdd) {
    // 검색 모달에서 선택한 경우
    자재코드 = selectedMaterialForAdd.품목코드 || '';
    규격 = selectedMaterialForAdd.규격 || '';
  } else {
    // 직접 입력한 경우 (자재코드 없음)
    자재코드 = '';
    규격 = '';
  }

  // newOrderDetails 배열에 추가
  newOrderDetails.push({
    자재코드: 자재코드,
    자재명: materialName,
    규격: 규격,
    수량: quantity,
    단가: price,
  });

  // 테이블 렌더링
  renderNewOrderDetailTable();

  // 모달 닫기
  closeOrderMaterialAddModal();
};

/**
 * 이전 단가 조회 (향후 구현)
 */
window.showOrderMaterialPriceHistory = function () {
  if (!selectedMaterialForAdd) {
    alert('품목을 먼저 선택해주세요.');
    return;
  }
  alert('이전 단가 조회 기능은 향후 구현 예정입니다.');
};

/**
 * 품목 검색 모달에서 품목 선택 시 호출되는 함수
 * @description material.js에서 context='order_material_add'로 호출
 */
window.selectOrderMaterialAdd = function (material) {
  // material.js에서 전달받은 데이터를 저장
  selectedMaterialForAdd = {
    품목코드: material.품목코드 || (material.분류코드 || '') + (material.세부코드 || ''),
    품목명: material.자재명,
    판매단가: material.출고단가 || material.출고단가1 || 0,
    규격: material.규격 || '',
    단위: material.단위 || '',
    분류코드: material.분류코드 || '',
    세부코드: material.세부코드 || '',
  };

  // UI 업데이트
  const priceInput = document.getElementById('addDetailPrice');
  const selectedNameEl = document.getElementById('selectedMaterialName');
  const selectedCodeEl = document.getElementById('selectedMaterialCode');
  const selectedInfoEl = document.getElementById('selectedMaterialInfo');

  if (priceInput) priceInput.value = selectedMaterialForAdd.판매단가;
  if (selectedNameEl)
    selectedNameEl.textContent =
      selectedMaterialForAdd.품목명 +
      (selectedMaterialForAdd.규격 ? ` (${selectedMaterialForAdd.규격})` : '');
  if (selectedCodeEl) selectedCodeEl.textContent = `품목코드: ${selectedMaterialForAdd.품목코드}`;
  if (selectedInfoEl) selectedInfoEl.style.display = 'block';

  // 금액 재계산
  if (typeof calculateDetailAmount === 'function') {
    calculateDetailAmount();
  }

  // 품목 검색 모달 닫기
  if (typeof window.closeMaterialSearchModal === 'function') {
    window.closeMaterialSearchModal();
  }
};
async function searchNewOrderMaterials() {
  try {
    let searchText = document.getElementById('materialSearchInput2').value.trim();
    let searchSpec = ''; // 규격 검색어

    // 검색어에서 쉼표로 분리하여 자재명과 규격 검색어 추출
    // 예: "케이블, 200mm" → 자재명: "케이블", 규격: "200mm"
    if (searchText && searchText.includes(',')) {
      const parts = searchText.split(',').map((s) => s.trim());
      searchText = parts[0] || ''; // 첫 번째 부분: 자재명
      searchSpec = parts[1] || ''; // 두 번째 부분: 규격

      console.log(`  검색어 분리: "${searchText}", 규격: "${searchSpec}"`);
    }

    // API 호출
    const params = new URLSearchParams();
    if (searchText) {
      params.append('search', searchText);
    }
    if (searchSpec) {
      params.append('searchSpec', searchSpec); // 규격 검색어 추가
    }

    const response = await fetch(`/api/materials?${params.toString()}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '자재 조회 실패');
    }

    const tbody = document.getElementById('materialSearchTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 40px; text-align: center; color: #999;">
            검색 결과가 없습니다
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';

    result.data.forEach((material) => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onmouseover = () => (tr.style.background = '#f8f9fa');
      tr.onmouseout = () => (tr.style.background = 'white');

      const 자재코드 = material.분류코드 + material.세부코드;

      tr.innerHTML = `
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${자재코드}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${material.자재명}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${material.규격 || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(
          material.출고단가1 || 0
        ).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <button onclick='showPriceHistoryForNewOrder(${JSON.stringify({
            ...material,
            자재코드,
          }).replace(/'/g, '&apos;')})' style="
            padding: 6px 12px;
            background: #8b5cf6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">이전단가</button>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <button onclick='selectMaterialForOrder(${JSON.stringify({
            ...material,
            자재코드,
          }).replace(/'/g, '&apos;')})' style="
            padding: 6px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">추가</button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// 신규 발주서 작성용 임시 자재 정보 저장
let tempMaterialForNewOrder = null;

// ✅ 신규 발주서 작성용 이전단가 조회
async function showPriceHistoryForNewOrder(material) {
  try {
    // 매입처 코드 확인
    const 매입처코드 = document.getElementById('selectedSupplierCode').value;

    if (!매입처코드) {
      alert('먼저 매입처를 선택해주세요.');
      return;
    }

    // 임시 자재 정보 저장
    tempMaterialForNewOrder = material;

    // 자재 정보 표시
    document.getElementById('priceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('priceHistoryMaterialCode').textContent = `[${material.자재코드}] ${
      material.규격 || ''
    }`;

    // 탭 초기화 (실제 출고가 탭으로 시작)
    currentPriceHistoryTab = 'actual';
    const tabActual = document.getElementById('tabActualPrice');
    const tabOrder = document.getElementById('tabOrderPrice');

    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 실제 출고가 데이터 로드
    await loadActualPriceHistoryForNewOrder(material.자재코드, 매입처코드);

    // 모달 표시
    document.getElementById('orderManagePriceHistoryModal').style.display = 'block';
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 발주서용 실제 출고가 이력 로드
async function loadActualPriceHistoryForNewOrder(자재코드, 매입처코드) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/price-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('priceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            이 거래처에 출고한 이력이 없습니다
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
          selectPriceFromHistoryForNewOrder(item.출고단가);
        };

        const 입출고일자 = item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 적요 = item.적요 || '-';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${입출고일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.출고단가 || 0).toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${(item.출고수량 || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280;">
            ${적요}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('❌ 실제 출고가 이력 조회 오류:', err);
    alert('실제 출고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 발주서용 이력에서 단가 선택
function selectPriceFromHistoryForNewOrder(price) {
  closeOrderManagePriceHistoryModal();

  if (!tempMaterialForNewOrder) {
    alert('자재 정보를 찾을 수 없습니다.');
    return;
  }

  // 수량 입력
  const 수량 = prompt(`${tempMaterialForNewOrder.자재명}\n수량을 입력하세요:`, '1');

  if (!수량 || isNaN(수량) || parseFloat(수량) <= 0) {
    alert('유효한 수량을 입력해주세요.');
    return;
  }

  // 선택한 단가로 자재 추가
  newOrderDetails.push({
    자재코드: tempMaterialForNewOrder.자재코드,
    자재명: tempMaterialForNewOrder.자재명,
    규격: tempMaterialForNewOrder.규격,
    수량: parseFloat(수량),
    단가: parseFloat(price),
  });

  renderNewOrderDetailTable();
  tempMaterialForNewOrder = null;
}

// ✅ 자재 선택 및 추가 (발주서 작성용)
// ✅ [발주관리] 자재 선택 (공통 - 모달 내 입력 필드 사용)
function selectMaterialForOrder(material) {
  // 선택된 자재를 변수에 저장 (신규/수정 모두 호환)
  selectedOrderMaterial = material;
  if (typeof newSelectedOrderMaterial !== 'undefined') {
    newSelectedOrderMaterial = material;
  }

  // 자재코드 생성
  const 자재코드 = (material.분류코드 || '') + (material.세부코드 || '');

  // 선택된 자재 정보 표시
  const selectedInfo = document.getElementById('selectedMaterialInfo');
  const selectedName = document.getElementById('selectedMaterialName');
  const selectedCode = document.getElementById('selectedMaterialCode');

  if (selectedInfo) selectedInfo.style.display = 'block';
  if (selectedName) selectedName.textContent = material.자재명 || '-';
  if (selectedCode) selectedCode.textContent = `품목코드: ${자재코드}`;

  // 기본 단가 설정 (값이 없을 때만)
  const priceEl = document.getElementById('addDetailPrice');
  if (priceEl && (!priceEl.value || priceEl.value === '0')) {
    priceEl.value = material.출고단가1 || 0;
  }

  // 검색 결과 숨기기
  const resultsDiv = document.getElementById('materialSearchResults');
  if (resultsDiv) resultsDiv.style.display = 'none';

  // 금액 자동 계산
  calculateDetailAmount();

  // 수량 입력란에 포커스
  const qtyEl = document.getElementById('addDetailQuantity');
  if (qtyEl) {
    setTimeout(() => qtyEl.focus(), 100);
  }
}

// ✅ 새 발주서 상세내역 테이블 렌더링
function renderNewOrderDetailTable() {
  const tbody = document.getElementById('orderManageCreateDetailTableBody');

  if (!tbody) {
    console.warn('⚠️ orderManageCreateDetailTableBody 요소를 찾을 수 없습니다');
    return;
  }

  if (newOrderDetails.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 40px; text-align: center; color: #999;">
          자재 추가 버튼을 클릭하여 발주 상세내역을 입력하세요
        </td>
      </tr>
    `;

    // 합계 초기화
    document.getElementById('totalSupplyPrice').textContent = '0';
    document.getElementById('totalVat').textContent = '0';
    document.getElementById('grandTotal').textContent = '0';
    return;
  }

  tbody.innerHTML = '';
  let totalSupply = 0;
  let totalVat = 0;

  newOrderDetails.forEach((detail, index) => {
    const 공급가 = detail.수량 * detail.단가;
    const 부가세 = Math.round(공급가 * 0.1);

    totalSupply += 공급가;
    totalVat += 부가세;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${
        index + 1
      }</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${detail.자재코드 || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${detail.자재명 || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${detail.규격 || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${
        detail.단위 || '-'
      }</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${detail.수량.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${detail.단가.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${공급가.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${부가세.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
          <button type="button" onclick="openNewOrderDetailEditModal(${index})" style="
            padding: 4px 12px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 60px;
          ">수정</button>
          <button type="button" onclick="removeNewOrderDetail(${index})" style="
            padding: 4px 12px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 60px;
          ">삭제</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 합계 표시
  document.getElementById('totalSupplyPrice').textContent = totalSupply.toLocaleString();
  document.getElementById('totalVat').textContent = totalVat.toLocaleString();
  document.getElementById('grandTotal').textContent = (totalSupply + totalVat).toLocaleString();
}

// ✅ 신규 발주서 상세내역 수정 모달 열기
function openNewOrderDetailEditModal(index) {
  try {
    const detail = newOrderDetails[index];

    if (!detail) {
      alert('항목을 찾을 수 없습니다.');
      return;
    }

    // 모달에 데이터 표시
    document.getElementById('editDetailCodeForOrder').textContent = detail.자재코드 || '-';
    document.getElementById('editDetailNameForOrder').textContent = detail.자재명 || '-';
    document.getElementById('editDetailSpecForOrder').textContent = detail.규격 || '-';
    document.getElementById('editDetailQuantityForOrder').value = detail.수량 || 0;
    document.getElementById('editDetailPriceForOrder').value = detail.단가 || 0;
    document.getElementById('editDetailAmountForOrder').value = (
      detail.수량 * detail.단가
    ).toLocaleString();

    // 모달에 index 저장 (rowIndex는 삭제하여 신규 발주서 모드로 설정)
    const modal = document.getElementById('orderManageDetailEditModal');
    delete modal.dataset.rowIndex;
    modal.dataset.editIndex = index;

    // 자동 계산 이벤트 리스너 추가
    const quantityInput = document.getElementById('editDetailQuantityForOrder');
    const priceInput = document.getElementById('editDetailPriceForOrder');
    const amountInput = document.getElementById('editDetailAmountForOrder');

    const calculateEditAmount = () => {
      const qty = parseFloat(quantityInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      amountInput.value = (qty * price).toLocaleString();
    };

    quantityInput.oninput = calculateEditAmount;
    priceInput.oninput = calculateEditAmount;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 상세내역 수정 모달 열기 오류:', err);
    alert('상세내역 수정 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 상세내역 수정 모달 닫기
function closeOrderManageDetailEditModal() {
  document.getElementById('orderManageDetailEditModal').style.display = 'none';
}

// ✅ 신규 발주서 상세내역 수정 확인
function confirmNewOrderDetailEdit() {
  try {
    const modal = document.getElementById('orderManageDetailEditModal');
    const index = parseInt(modal.dataset.editIndex);

    if (isNaN(index) || index < 0 || index >= newOrderDetails.length) {
      alert('유효하지 않은 항목입니다.');
      return;
    }

    // 입력값 가져오기
    const 수량 = parseFloat(document.getElementById('editDetailQuantityForOrder').value) || 0;
    const 단가 = parseFloat(document.getElementById('editDetailPriceForOrder').value) || 0;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 배열 데이터 업데이트
    newOrderDetails[index].수량 = 수량;
    newOrderDetails[index].단가 = 단가;
    newOrderDetails[index].공급가액 = 수량 * 단가;

    // 테이블 다시 렌더링
    renderNewOrderDetailTable();

    // 모달 닫기
    closeOrderManageDetailEditModal();
  } catch (err) {
    console.error('❌ 상세내역 수정 오류:', err);
    alert('상세내역 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 상세내역 삭제 - 모달 열기
function removeNewOrderDetail(index) {
  console.log('===== orderManageCreateModal > orderManageCreateDetailTable > 삭제 버튼 클릭 =====');

  try {
    const detail = newOrderDetails[index];
    if (!detail) {
      alert('항목을 찾을 수 없습니다.');
      return;
    }

    // 모달에 정보 표시
    document.getElementById(
      'deleteOrderDetailInfo',
    ).textContent = `[${detail.자재코드}] ${detail.자재명}`;

    // 모달에 index 저장 (rowIndex는 삭제하여 신규 발주서 모드로 설정)
    const modal = document.getElementById('orderManageDetailDeleteConfirmModal');
    delete modal.dataset.rowIndex;
    modal.dataset.deleteIndex = index;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 삭제 모달 열기 오류:', err);
    alert('품목 삭제 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 발주서 저장
async function submitOrderManageCreate(event) {
  console.log('===== orderManageCreateModal > 저장 버튼 클릭 =====');
  event.preventDefault();

  try {
    // 입력값 가져오기
    const 발주일자 = document.getElementById('orderManageCreateDate').value.replace(/-/g, '');
    const 출고희망일자 =
      document.getElementById('orderManageCreateDeliveryDate').value.replace(/-/g, '') || '';
    const 매입처코드 = document.getElementById('orderManageCreateSupplierCode').value;
    const 제목 = document.getElementById('orderManageCreateTitle').value;
    const 적요 = document.getElementById('orderManageCreateRemark').value;

    // 유효성 검사
    if (!매입처코드) {
      console.error('❌ orderManageCreateModal > 유효성 검사 실패: 매입처 미선택');
      alert('매입처를 선택해주세요.');
      return;
    }

    if (newOrderDetails.length === 0) {
      console.error('❌ orderManageCreateModal > 유효성 검사 실패: 상세내역 없음');
      alert('발주 상세내역을 최소 1개 이상 추가해주세요.');
      return;
    }

    // API 호출 데이터 구성
    const orderData = {
      master: {
        발주일자,
        출고희망일자,
        매입처코드,
        제목,
        적요,
        상태코드: 1, // 작성중
      },
      details: newOrderDetails.map((detail) => ({
        자재코드: detail.자재코드,
        수량: detail.수량,
        출고단가: detail.단가, // '단가' 필드를 '출고단가'로 변환
      })),
    };

    // API 호출
    const response = await fetch('/api/orders_add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify(orderData),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '발주서 저장 실패');
    }

    alert('발주서가 성공적으로 저장되었습니다.');
    closeOrderManageCreateModal();

    // 발주 목록 새로고침 (DataTable reload)
    if ($.fn.DataTable.isDataTable('#orderManageTable')) {
      $('#orderManageTable').DataTable().ajax.reload();
    }
  } catch (err) {
    console.error('❌ orderManageCreateModal > 발주서 저장 오류:', err);
    alert('발주서 저장 중 오류가 발생했습니다: ' + err.message);
  }
}

// ==================== 모달 드래그 기능 ====================
// makeModalDraggable 함수는 js/modal-draggable.js에서 전역으로 로드됨

// ==================== 신규 발주서용 품목 추가 모달 ====================

let newSelectedOrderMaterial = null;

// ❌ [중복 삭제됨] openMaterialSearchModal() - 위의 공통 함수(라인 1887) 사용
// 이전에는 newOrderMaterialModal을 사용했으나, 이제 orderDetailAddModal 1개로 통합

// 모달 닫기
function closeNewOrderMaterialModal() {
  document.getElementById('newOrderMaterialModal').style.display = 'none';
  // 발주서 작성 모달은 그대로 유지되므로 별도 처리 불필요
}

// 자재 검색
async function searchNewMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCategory = document.getElementById('newMaterialSearchCategory').value.trim();
    const searchCode = document.getElementById('newMaterialSearchCode').value.trim();
    let searchName = document.getElementById('newMaterialSearchName').value.trim();
    let searchSpec = ''; // 규격 검색어

    // 자재명에서 쉼표로 분리하여 자재명과 규격 검색어 추출
    // 예: "케이블, 200mm" → 자재명: "케이블", 규격: "200mm"
    if (searchName && searchName.includes(',')) {
      const parts = searchName.split(',').map((s) => s.trim());
      searchName = parts[0] || ''; // 첫 번째 부분: 자재명
      searchSpec = parts[1] || ''; // 두 번째 부분: 규격

      console.log(`  자재명 검색: "${searchName}", 규격 검색: "${searchSpec}"`);
    }

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCategory && !searchCode && !searchName) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    // 검색 조건을 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    if (searchCategory) params.append('searchCategory', searchCategory);
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);
    if (searchSpec) params.append('searchSpec', searchSpec); // 규격 검색어 추가
    params.append('removeDuplicates', 'true'); // 중복 제거 활성화

    const result = await apiCall(`/materials?${params.toString()}`);

    if (!result.success || !result.data) {
      throw new Error('자재 목록을 불러올 수 없습니다.');
    }

    const filteredMaterials = result.data;

    if (filteredMaterials.length === 0) {
      alert('검색 결과가 없습니다.');
      document.getElementById('newMaterialSearchResults').style.display = 'none';
      return;
    }

    const tbody = document.getElementById('newMaterialSearchTableBody');
    tbody.innerHTML = '';

    filteredMaterials.forEach((m) => {
      const 자재코드 = m.분류코드 + m.세부코드;
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.style.transition = 'background 0.2s';
      tr.onmouseover = function () {
        this.style.background = '#f3f4f6';
      };
      tr.onmouseout = function () {
        this.style.background = 'white';
      };
      tr.onclick = function () {
        selectNewMaterial(m);
      };

      tr.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${자재코드}</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${
          m.자재명
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${
          m.규격 || '-'
        }</td>
      `;

      tbody.appendChild(tr);
    });

    document.getElementById('newMaterialSearchResults').style.display = 'block';
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// 자재 검색 초기화
function clearNewMaterialSearch() {
  document.getElementById('newMaterialSearchCategory').value = '';
  document.getElementById('newMaterialSearchCode').value = '';
  document.getElementById('newMaterialSearchName').value = '';
  document.getElementById('newMaterialSearchResults').style.display = 'none';
}

// 자재 선택
function selectNewMaterial(material) {
  newSelectedOrderMaterial = material;

  const 자재코드 = material.분류코드 + material.세부코드;

  document.getElementById('newSelectedMaterialName').textContent = material.자재명;
  document.getElementById('newSelectedMaterialCode').textContent = `[${자재코드}] ${
    material.규격 || ''
  }`;
  document.getElementById('newSelectedMaterialInfo').style.display = 'block';

  document.getElementById('newMaterialSearchResults').style.display = 'none';
}

// 선택된 자재 취소
function clearNewSelectedMaterial() {
  newSelectedOrderMaterial = null;
  document.getElementById('newSelectedMaterialInfo').style.display = 'none';
  document.getElementById('newMaterialSearchCode').value = '';
  document.getElementById('newMaterialSearchName').value = '';
  document.getElementById('newMaterialSearchSpec').value = '';
}

// 자재 추가 확인
function confirmNewOrderMaterialAdd() {
  try {
    if (!newSelectedOrderMaterial) {
      alert('자재를 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 = newSelectedOrderMaterial.분류코드 + newSelectedOrderMaterial.세부코드;
    const 수량 = parseFloat(document.getElementById('newDetailQuantity').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('newDetailPrice').value) || 0;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // newOrderDetails 배열에 추가
    newOrderDetails.push({
      자재코드: 자재코드,
      자재명: newSelectedOrderMaterial.자재명,
      규격: newSelectedOrderMaterial.규격,
      수량: 수량,
      단가: 출고단가,
    });

    // 테이블 렌더링
    renderNewOrderDetailTable();

    // 모달 닫기 (발주서 작성 모달은 그대로 유지)
    closeNewOrderMaterialModal();
  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
  }
}

// 금액 자동 계산
$(document).ready(function () {
  $('#newDetailQuantity, #newDetailPrice').on('input', function () {
    const 수량 = parseFloat($('#newDetailQuantity').val()) || 0;
    const 단가 = parseFloat($('#newDetailPrice').val()) || 0;
    const 금액 = 수량 * 단가;
    $('#newDetailAmount').val(금액.toLocaleString());
  });
});

// ========================================
// 신규 발주서 단가 이력 조회
// ========================================

// ✅ 신규 발주서 단가 이력 모달 열기 (기존 orderManagePriceHistoryModal 재사용)
async function showNewPriceHistory() {
  try {
    // 자재가 선택되었는지 확인
    if (!newSelectedOrderMaterial) {
      alert('먼저 자재를 검색하여 선택해주세요.');
      return;
    }

    const 매입처코드 = document.getElementById('selectedSupplierCode').value;
    if (!매입처코드) {
      alert('매입처를 먼저 선택해주세요.');
      return;
    }

    // 기존 단가 이력 모달 재사용 - selectedOrderMaterial 설정
    selectedOrderMaterial = newSelectedOrderMaterial;
    isNewOrderMode = true;

    // 단가 이력 모달의 z-index를 더 높게 설정 (신규 발주서 모달 위에 표시)
    const orderManagePriceHistoryModal = document.getElementById('orderManagePriceHistoryModal');
    if (orderManagePriceHistoryModal) {
      orderManagePriceHistoryModal.style.zIndex = '10000';
    }

    // 기존 showPriceHistory 함수 호출 (공통 모달 사용)
    await showPriceHistory();
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 발주서 단가 이력 탭 전환
async function switchNewPriceHistoryTab(tab) {
  currentNewPriceHistoryTab = tab;

  // 탭 버튼 스타일 변경
  const tabActual = document.getElementById('newTabActualPrice');
  const tabOrder = document.getElementById('newTabOrderPrice');

  if (tab === 'actual') {
    // 실제 출고가 탭 활성화
    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabOrder.style.background = 'transparent';
    tabOrder.style.color = '#6b7280';
    tabOrder.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('newPriceHistoryLabel').textContent =
      '이 거래처에 실제 출고한 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('newPriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">적요</th>
      </tr>
    `;

    // 실제 출고 데이터 로드
    await loadNewActualPriceHistory();
  } else if (tab === 'order') {
    // 발주 제안가 탭 활성화
    tabOrder.style.background = '#3b82f6';
    tabOrder.style.color = 'white';
    tabOrder.style.borderBottom = '3px solid #3b82f6';

    tabActual.style.background = 'transparent';
    tabActual.style.color = '#6b7280';
    tabActual.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('newPriceHistoryLabel').textContent =
      '이 거래처에 제안한 발주 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('newPriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">발주일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">수량</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">합계</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">적요</th>
      </tr>
    `;

    // 발주 제안가 데이터 로드
    await loadNewOrderPriceHistory();
  }
}

// ✅ 신규 발주서 실제 출고 이력 로드
async function loadNewActualPriceHistory() {
  try {
    if (!newSelectedOrderMaterial) return;

    const 자재코드 = newSelectedOrderMaterial.분류코드 + newSelectedOrderMaterial.세부코드;
    const 매입처코드 = document.getElementById('selectedSupplierCode').value;

    if (!매입처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/price-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('newPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: #9ca3af;">
            이 거래처에 출고한 이력이 없습니다
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
          selectNewPriceFromHistory(item.출고단가);
        };

        const 입출고일자 = item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 수량 = parseFloat(item.출고수량 || 0);
        const 단가 = parseFloat(item.출고단가 || 0);
        const 합계 = 수량 * 단가;

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${입출고일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${수량.toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${단가.toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${합계.toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280; font-size: 12px;">
            ${item.적요 || '-'}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('❌ 실제 출고가 이력 조회 오류:', err);
    alert('실제 출고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 발주서 발주 제안가 이력 로드
async function loadNewOrderPriceHistory() {
  try {
    if (!newSelectedOrderMaterial) return;

    const 자재코드 = newSelectedOrderMaterial.분류코드 + newSelectedOrderMaterial.세부코드;
    const 매입처코드 = document.getElementById('selectedSupplierCode').value;

    if (!매입처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/order-history/${매입처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('newPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: #9ca3af;">
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
          selectNewPriceFromHistory(item.출고단가);
        };

        const 발주일자 = item.발주일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 수량 = parseFloat(item.수량 || 0);
        const 단가 = parseFloat(item.출고단가 || 0);
        const 합계 = 수량 * 단가;

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${발주일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${수량.toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${단가.toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">
            ${합계.toLocaleString()}원
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #6b7280; font-size: 12px;">
            ${item.적요 || '-'}
          </td>
        `;

        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('❌ 발주 제안가 이력 조회 오류:', err);
    alert('발주 제안가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 발주서 이력에서 단가 선택
function selectNewPriceFromHistory(price) {
  document.getElementById('newDetailPrice').value = price;

  // 금액 자동 재계산
  const 수량 = parseFloat(document.getElementById('newDetailQuantity').value) || 0;
  const 금액 = 수량 * price;
  document.getElementById('newDetailAmount').value = 금액.toLocaleString();

  // 모달 닫기
  closeNewPriceHistoryModal();
}

// ✅ 모달 드래그 기능
// makeModalDraggable 함수는 js/modal-draggable.js에서 전역으로 로드됨
// (아래는 간소화된 버전으로 MutationObserver 등 일부 기능이 누락되어 주석 처리)
/*
function makeModalDraggable(modalContentId, dragHandleId) {
  const modalContent = document.getElementById(modalContentId);
  const dragHandle = document.getElementById(dragHandleId);

  if (!modalContent || !dragHandle) return;

  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  dragHandle.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === dragHandle || dragHandle.contains(e.target)) {
      // 닫기 버튼 클릭시에는 드래그 안함
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, modalContent);
    }
  }

  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }
}
*/

// ==================== 필터링 함수 ====================

// 발주 필터링 함수 (상태, 시작일, 종료일 기준으로 데이터 재조회)
function filterOrders() {
  if (orderManageTable) {
    orderManageTable.ajax.reload();
  } else {
    console.warn('⚠️ orderManageTable이 초기화되지 않았습니다.');
  }
}

/**
 * 발주서 출력 함수
 * @param {string} orderDate - 발주일자 (YYYYMMDD)
 * @param {number} orderNo - 발주번호
 */
async function printOrder(orderDate, orderNo, mode = 1) {
  try {
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

    // 날짜 포맷팅 함수 (common.js의 formatDate 사용)
    // const formatDate = (dateStr) => {
    //   if (!dateStr) return '-';
    //   return dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    // };

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

          /* 발주 정보 섹션 */
          .order-info {
            border: 2px solid #333;
            padding: 3mm;
            margin-bottom: 8mm;
          }

          .order-info-row {
            display: flex;
            margin-bottom: 1.5mm;
            font-size: 9pt;
          }

          .order-info-row .info-label {
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

            .order-info {
              page-break-after: auto;
            }

            .total-section {
              page-break-before: avoid;
            }

            .notes {
              page-break-before: avoid;
            }
          }

          td {
            border: none;
            border-bottom: 1px solid #333;
            padding: 1.5mm 1mm;
            text-align: center;
            font-size: 8.5pt;
            min-height: 15mm;
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
          <div class="title">견 적 서</div>

          <!-- 정보 박스 (주석 처리)
          <div class="info-container">
            <div class="info-box">
              <div class="info-box-title">공급자 정보</div>
              ...
            </div>
            <div class="info-box">
              <div class="info-box-title">매입처 정보</div>
              ...
            </div>
          </div>
          -->

          <!-- 발주 정보 (공급자 위치로 이동) -->
          <div class="order-info">
            <div class="order-info-row">
              <span class="info-label">발주번호:</span>
              <span class="info-value">${header.발주일자}-${header.발주번호}</span>
            </div>
            <div class="order-info-row">
              <span class="info-label">발주일자:</span>
              <span class="info-value">${formatDate(header.발주일자)}</span>
            </div>
            <div class="order-info-row">
              <span class="info-label">수신:</span>
              <span class="info-value">${header.매입처명}</span>
            </div>
            <div class="order-info-row">
              <span class="info-label">담당자:</span>
              <span class="info-value">${header.매입처담당자}</span>
            </div>
            <div class="order-info-row">
              <span class="info-label">전화번호:</span>
              <span class="info-value">${header.매입처전화}</span>
            </div>
            <div class="order-info-row">
              <span class="info-label">팩스번호:</span>
              <span class="info-value">${header.매입처팩스}</span>
            </div>
            <div class="order-info-row">
              <span class="info-label">출고희망일:</span>
              <span class="info-value">${formatDate(header.출고희망일자)}</span>
            </div>
            <div class="order-info-row">
              <span class="info-label">제목:</span>
              <span class="info-value">${header.제목}</span>
            </div>
            <div class="order-info-row">
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

          <!-- 하단 참고사항 -->
          <div class="notes">
            <strong>※ 참고사항</strong><br>
            · 본 발주서는 ${formatDate(header.발주일자)}부터 ${header.유효일수}일간 유효합니다.<br>
            · 상기 금액으로 발주 드립니다.<br>
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
  } catch (error) {
    console.error('❌ 발주서 출력 실패:', error);
    alert('발주서 출력 중 오류가 발생했습니다.');
  }
}

/**
 * 상세 모달에서 출력 버튼 클릭 시 호출되는 래퍼 함수
 */
function printOrderFromDetail() {
  if (!window.currentOrderDetail) {
    alert('출력할 발주 정보가 없습니다.');
    return;
  }

  const { 발주일자, 발주번호 } = window.currentOrderDetail;
  printOrder(발주일자, 발주번호);
}

// 전역 함수 노출
window.editOrderManage = editOrderManage;
window.deleteOrderManage = deleteOrderManage;
window.closeOrderManageDeleteConfirmModal = closeOrderManageDeleteConfirmModal;
window.confirmOrderManageDelete = confirmOrderManageDelete;
window.approveOrderManage = approveOrderManage;
window.closeOrderManageApproveConfirmModal = closeOrderManageApproveConfirmModal;
window.confirmOrderManageApprove = confirmOrderManageApprove;
window.makeModalDraggable = makeModalDraggable;
window.filterOrders = filterOrders;
window.printOrder = printOrder;
window.printOrderFromDetail = printOrderFromDetail;
window.closeOrderManageViewModal = closeOrderManageViewModal;
window.searchNewMaterials = searchNewMaterials;
window.clearNewMaterialSearch = clearNewMaterialSearch;
window.searchAddDetailMaterialsForOrder = searchAddDetailMaterialsForOrder;
window.clearAddDetailMaterialSearchForOrder = clearAddDetailMaterialSearchForOrder;
window.closeOrderManagePriceHistoryModal = closeOrderManagePriceHistoryModal;
window.switchOrderManagePriceHistoryTab = switchOrderManagePriceHistoryTab;
window.showOrderManageDetailPriceHistory = showOrderManageDetailPriceHistory;

/**
 * 발주 데이터를 CSV로 내보내기 (Google Sheets 가져오기용)
 * DataTable 기반으로 전체 데이터 또는 현재 표시된 데이터 내보내기
 */
function exportOrdersToExcel() {
  try {
    if (!orderManageTable) {
      alert('발주 테이블이 초기화되지 않았습니다.');
      return;
    }

    // DataTable에서 현재 표시된 데이터 가져오기
    const dataToExport = orderManageTable.rows({ search: 'applied' }).data().toArray();

    if (dataToExport.length === 0) {
      alert('내보낼 발주 데이터가 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = ['발주번호', '매입처명', '발주일자', '제목', '발주금액', '담당자', '상태'];

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

      // 발주일자 포맷 (YYYYMMDD → YYYY-MM-DD)
      let formattedDate = row.발주일자 || '';
      if (formattedDate.length === 8) {
        formattedDate = `${formattedDate.substring(0, 4)}-${formattedDate.substring(
          4,
          6,
        )}-${formattedDate.substring(6, 8)}`;
      }

      const rowData = [
        `${row.발주일자}-${row.발주번호}`,
        row.매입처명 || '-',
        formattedDate,
        row.제목 || '-',
        (row.발주금액 || 0).toLocaleString() + '원',
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
    const fileName = `발주관리_${year}${month}${date}_${hours}${minutes}${seconds}.csv`;

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
      `${dataToExport.length}개의 발주 정보가 CSV로 내보내졌습니다.\n\n📊 Google Sheets에서 불러오려면:\n1. sheets.google.com 접속\n2. 파일 > 가져오기 > 업로드\n3. 다운로드된 CSV 파일 선택`,
    );
  } catch (error) {
    console.error('❌ 발주 Google Sheets 내보내기 오류:', error);
    alert('내보내기 중 오류가 발생했습니다: ' + error.message);
  }
}

window.exportOrdersToExcel = exportOrdersToExcel;
