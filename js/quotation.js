/**
 * 견적관리 DataTable 초기화 및 관리
 */

// 전역 변수로 DataTable 인스턴스 저장
let quotationManageTable = null;

// ==================== 전역 함수 정의 (최상단) ====================
// 견적서용 매출처 선택 함수 - 고유한 이름 사용 (taxinvoice.js와 충돌 방지)
window.selectQuotationCustomer = function selectQuotationCustomer(customerOrCode, name) {
  try {
    // ✅ 두 가지 호출 방식 지원:
    // 1. selectQuotationCustomer(customer) - 객체 전달 (견적 전용 검색에서 호출)
    // 2. selectQuotationCustomer(code, name) - 개별 파라미터 (공통 모달에서 호출)
    let code, customerName;

    if (typeof customerOrCode === 'object' && customerOrCode !== null) {
      // 객체로 전달된 경우
      code = customerOrCode.매출처코드;
      customerName = customerOrCode.매출처명;
    } else {
      // 개별 파라미터로 전달된 경우
      code = customerOrCode;
      customerName = name;
    }

    // 매출처 코드와 이름 설정 (Prefix Rule 적용)
    const codeInput = document.getElementById('quotationManageCreateCustomerCode');
    const nameInput = document.getElementById('quotationManageCreateCustomerName');

    if (!codeInput || !nameInput) {
      console.error('❌ 입력 필드를 찾을 수 없습니다!');
      alert('입력 필드를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    codeInput.value = code;
    nameInput.value = customerName;

    // 선택된 매출처 정보 표시
    const infoDiv = document.getElementById('quotationManageCreateCustomerInfo');
    const displaySpan = document.getElementById('quotationManageCreateCustomerDisplay');

    if (infoDiv && displaySpan) {
      displaySpan.textContent = `[${code}] ${customerName}`;
      infoDiv.style.display = 'block';
    }

    // 모달 닫기
    window.closeQuotationCustomerSearchModal();

    console.log('✅ 매출처 선택 완료:', code, customerName);
  } catch (err) {
    console.error('❌ selectQuotationCustomer 에러:', err);
    alert('매출처 선택 중 오류가 발생했습니다: ' + err.message);
  }
};

// ✅ 견적서 작성용 매출처 검색 모달 닫기 함수 (공통 모달 사용)
// @deprecated - customer.js의 closeCustomerSearchModal() 사용 권장
window.closeQuotationCustomerSearchModal = function closeQuotationCustomerSearchModal() {
  // customer.js의 공통 모달 닫기 함수 호출
  if (typeof window.closeCustomerSearchModal === 'function') {
    window.closeCustomerSearchModal();
  }
};
// ==================================================================

$(document).ready(function () {
  // 견적서 작성 모달 드래그 기능
  makeModalDraggable('quotationManageCreateModalContent', 'quotationManageCreateModalHeader');
  // 견적서 수정 모달 드래그 기능
  makeModalDraggable('quotationManageEditModalContent', 'quotationManageEditModalHeader');
  // 견적 상세 보기 모달 드래그 기능
  makeModalDraggable('quotationManageViewModalContent', 'quotationManageViewModalHeader');
  // 견적 상세내역 입력 모달 드래그 기능
  makeModalDraggable('quotationManageDetailAddModal', '.modal-header-draggable');

  // ✅ 상세 버튼 모달 닫기 함수
  // function closeQuotationManageViewModal() {
  //   const modal = document.getElementById('quotationManageViewModal');
  //   if (modal) {
  //     modal.classList.add('hidden');
  //     modal.style.display = 'none';
  //   }
  //   // DataTable 정리 (메모리 누수 방지)
  //   if (window.quotationDetailDataTable) {
  //     window.quotationDetailDataTable.destroy();
  //     window.quotationDetailDataTable = null;
  //     $('#quotationDetailTable tbody').empty();
  //   }
  // }

  // ✅ 전역으로 즉시 노출 (HTML에서 호출할 수 있도록)
  // window.closeQuotationManageViewModal = closeQuotationManageViewModal;

  // ✅ 상세 보기 모달 닫기 버튼
  $('#quotationManageViewModalCloseBtn').on('click', () => {
    closeQuotationManageViewModal();
  });

  // ✅ 상세보기 모달 배경 클릭시 닫기
  $(document).on('click', '#quotationManageViewModal', function (e) {
    if (e.target.id === 'quotationManageViewModal') {
      closeQuotationManageViewModal();
    }
  });

  // ✅ 수정 모달 닫기 버튼
  $('#quotationManageEditModalCloseBtn').on('click', () => {
    closeQuotationManageEditModal();
  });

  // ✅ 수정 모달 배경 클릭시 닫기
  $(document).on('click', '#quotationManageEditModal', function (e) {
    if (e.target.id === 'quotationManageEditModal') {
      closeQuotationManageEditModal();
    }
  });

  // ✅ 품목 추가 모달 닫기 버튼
  $('#closeQuotationDetailAddModal').on('click', () => {
    closeQuotationManageDetailAddModal();
  });

  // ✅ 품목 수정 모달 닫기 버튼
  $('#closeQuotationDetailEditModal').on('click', () => {
    closeQuotationManageDetailEditModal();
  });

  // ✅ 단가 이력 모달 닫기 버튼
  $('#quotationManagePriceHistoryCloseBtn').on('click', () => {
    closeQuotationManagePriceHistoryModal();
  });

  // ✅ 품목 추가 모달 - 금액 자동 계산
  $('#addDetailQuantity, #addDetailPrice').on('input', function () {
    const 수량 = parseFloat($('#addDetailQuantity').val()) || 0;
    const 단가 = parseFloat($('#addDetailPrice').val()) || 0;
    const 금액 = 수량 * 단가;
    $('#addDetailAmount').val(금액.toLocaleString());
  });

  // ✅ 품목 수정 모달 - 금액 자동 계산
  $('#editDetailQuantity, #editDetailPrice').on('input', function () {
    const 수량 = parseFloat($('#editDetailQuantity').val()) || 0;
    const 단가 = parseFloat($('#editDetailPrice').val()) || 0;
    const 금액 = 수량 * 단가;
    $('#editDetailAmount').val(금액.toLocaleString());
  });

  // ✅ 자재 검색 - Enter 키 이벤트
  $(document).on('keypress', '#materialSearchCode, #materialSearchName, #materialSearchSpec', function (e) {
    if (e.which === 13) {
      // Enter 키
      e.preventDefault();
      searchMaterials();
    }
  });

  // 견적 데이터 로드 함수 (DataTable 초기화)
  async function loadQuotations() {
    // ✅ 다른 페이지의 체크박스 이벤트 핸들러 제거
    $(document).off('change.orderPage');
    $(document).off('change.transactionManagePage');
    $(document).off('change.purchasePage');

    // 페이지가 표시될 때마다 날짜를 오늘 날짜(로그인 날짜)로 초기화
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const startDateInput = document.getElementById('quotationManageStartDate');
    const endDateInput = document.getElementById('quotationManageEndDate');

    // 항상 오늘 날짜로 설정
    if (startDateInput) {
      startDateInput.value = todayStr;
    }
    if (endDateInput) {
      endDateInput.value = todayStr;
    }

    // 이미 DataTable이 존재하면 파괴
    if (quotationManageTable) {
      quotationManageTable.destroy();
      quotationManageTable = null;
    }

    // DataTable 초기화
    quotationManageTable = $('#quotationManageTable').DataTable({
      ajax: {
        url: '/api/quotations',
        data: function (d) {
          // 필터링 파라미터 추가
          const 사업장코드 = currentUser?.사업장코드 || '01';
          const 상태코드 = $('#quotationManageStatusFilter').val();
          const startDate = $('#quotationManageStartDate').val()?.replace(/-/g, '') || '';
          const endDate = $('#quotationManageEndDate').val()?.replace(/-/g, '') || '';

          return {
            사업장코드: 사업장코드,
            상태코드: 상태코드,
            startDate: startDate,
            endDate: endDate,
          };
        },
        dataSrc: function (json) {
          // 견적 건수 업데이트
          const countEl = document.getElementById('quotationManageCount');
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
            return `<input type="checkbox" class="quotationRowCheck" data-date="${row.견적일자}" data-no="${row.견적번호}" />`;
          },
        },
        // 2. 순번 (역순: 가장 오래된 데이터 = 1, 최신 데이터 = 마지막 번호)
        {
          data: null,
          orderable: false,
          className: 'dt-center',
          /* render: function (data, type, row, meta) {
            const table = $('#quotationManageTable').DataTable();
            const info = table.page.info();
            return info.recordsDisplay - meta.row;
          }, */
          render: (data, type, row, meta) => meta.row + 1,
        },
        // 3. 견적번호 (일자-번호)
        {
          data: null,
          render: function (data, type, row) {
            return `${row.견적일자}-${row.견적번호}`;
          },
        },
        // 4. 매출처명
        {
          data: '매출처명',
          defaultContent: '-',
        },
        // 5. 견적일자 (YYYY-MM-DD 포맷)
        {
          data: '견적일자',
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
        // 7. 견적금액
        {
          // ✅ API에서 '합계금액'으로 반환 가능성 체크 (견적금액 또는 합계금액)
          data: null,
          render: function (_data, _type, row) {
            const amount = row.견적금액 || row.합계금액 || 0;
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
            const quotationKey = `${row.견적일자}-${row.견적번호}`;
            return `
              <div class="action-buttons" id="quotationActions-${quotationKey.replace('-', '_')}">
                <button class="btn-icon quotationBtnView" onclick="viewQuotationManageDetail('${row.견적일자}', ${
              row.견적번호
            })" title="상세보기">상세</button>
                <button class="btn-icon quotationBtnEdit" style="display: none;" onclick="editQuotationManage('${
                  row.견적일자
                }', ${row.견적번호})" title="수정">수정</button>
                <button class="btn-icon quotationBtnDelete" style="display: none;" onclick="deleteQuotationManage('${
                  row.견적일자
                }', ${row.견적번호})" title="삭제">삭제</button>
                ${
                  row.상태코드 === 1
                    ? `<button class="btn-icon quotationBtnApprove" style="display: none; background: #28a745;" onclick="approveQuotationManage('${row.견적일자}', ${row.견적번호})" title="승인">승인</button>`
                    : ''
                }
              </div>
            `;
          },
        },
      ],
      language: {
        lengthMenu: '페이지당 _MENU_ 개씩 보기',
        zeroRecords: '견적 데이터가 없습니다',
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
        $('.quotationRowCheck').each(function () {
          const $checkbox = $(this);
          const quotationDate = $checkbox.data('date');
          const quotationNo = $checkbox.data('no');
          const isChecked = $checkbox.prop('checked');
          const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

          if (isChecked) {
            actionDiv.find('.quotationBtnView').hide();
            actionDiv.find('.quotationBtnEdit').show();
            actionDiv.find('.quotationBtnDelete').show();
            actionDiv.find('.quotationBtnApprove').show();
          } else {
            actionDiv.find('.quotationBtnView').show();
            actionDiv.find('.quotationBtnEdit').hide();
            actionDiv.find('.quotationBtnDelete').hide();
            actionDiv.find('.quotationBtnApprove').hide();
          }
        });
      },
      // ✅ 각 행에 data 속성 추가 (삭제 기능에서 사용)
      createdRow: function (row, data, dataIndex) {
        $(row).attr('data-quotation-date', data.견적일자);
        $(row).attr('data-quotation-no', data.견적번호);
      },
    });

    // ✅ 전역 참조 통일 (window.quotationManageTableInstance와 quotationManageTable을 동일하게)
    window.quotationManageTableInstance = quotationManageTable;

    // 전체 선택 모드 플래그 (전체 선택 체크박스 클릭 시 true)
    let isSelectAllMode = false;

    // ✅ 전체선택 체크박스 클릭 이벤트 핸들러 등록 (click 이벤트 사용)
    $(document)
      .off('click.quotationManagePage', '#quotationManageSelectAll')
      .on('click.quotationManagePage', '#quotationManageSelectAll', function () {
      const isChecked = $(this).prop('checked');

      // 전체 선택 모드 활성화
      isSelectAllMode = true;

      // 모든 개별 체크박스를 선택/해제
      $('.quotationRowCheck').each(function() {
        const $checkbox = $(this);
        const quotationDate = $checkbox.data('date');
        const quotationNo = $checkbox.data('no');
        const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

        $checkbox.prop('checked', isChecked);

        if (isChecked) {
          // 체크됨: 상세 버튼 숨기고 수정/삭제/승인 버튼 표시
          actionDiv.find('.quotationBtnView').hide();
          actionDiv.find('.quotationBtnEdit').show();
          actionDiv.find('.quotationBtnDelete').show();
          actionDiv.find('.quotationBtnApprove').show();
        } else {
          // 체크 해제: 수정/삭제/승인 버튼 숨기고 상세 버튼 표시
          actionDiv.find('.quotationBtnView').show();
          actionDiv.find('.quotationBtnEdit').hide();
          actionDiv.find('.quotationBtnDelete').hide();
          actionDiv.find('.quotationBtnApprove').hide();
        }
      });

      // 전체 선택 모드 비활성화
      isSelectAllMode = false;
    });

    // ✅ 개별 체크박스 이벤트 핸들러 등록
    $(document)
      .off('change.quotationManagePage', '.quotationRowCheck')
      .on('change.quotationManagePage', '.quotationRowCheck', function () {
      const quotationDate = $(this).data('date');
      const quotationNo = $(this).data('no');
      const isChecked = $(this).prop('checked');

      // 전체 선택 모드가 아닐 때만 라디오 버튼처럼 동작
      if (!isSelectAllMode && isChecked) {
        // 새로운 체크박스를 선택하면 다른 모든 체크박스 해제
        $('.quotationRowCheck').not(this).each(function () {
          const $otherCheckbox = $(this);
          const otherDate = $otherCheckbox.data('date');
          const otherNo = $otherCheckbox.data('no');
          const otherActionDiv = $(`#quotationActions-${otherDate}_${otherNo}`);

          // 다른 체크박스 해제
          $otherCheckbox.prop('checked', false);

          // 다른 행의 버튼 상태 복원
          otherActionDiv.find('.quotationBtnView').show();
          otherActionDiv.find('.quotationBtnEdit').hide();
          otherActionDiv.find('.quotationBtnDelete').hide();
          otherActionDiv.find('.quotationBtnApprove').hide();
        });
      }

      // 현재 행의 버튼 표시/숨김 처리
      const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

      if (isChecked) {
        // 체크됨: 상세 버튼 숨기고 수정/삭제/승인 버튼 표시
        actionDiv.find('.quotationBtnView').hide();
        actionDiv.find('.quotationBtnEdit').show();
        actionDiv.find('.quotationBtnDelete').show();
        actionDiv.find('.quotationBtnApprove').show();
      } else {
        // 체크 해제: 수정/삭제/승인 버튼 숨기고 상세 버튼 표시
        actionDiv.find('.quotationBtnView').show();
        actionDiv.find('.quotationBtnEdit').hide();
        actionDiv.find('.quotationBtnDelete').hide();
        actionDiv.find('.quotationBtnApprove').hide();
      }
    });
  }

  // 전역 변수로 저장
  window.loadQuotations = loadQuotations;
});

// ✅ 견적 상세 버튼 모달 열기 함수 (견적일자, 견적번호로 조회)
async function openQuotationManageViewModal(quotationDate, quotationNo) {
  console.log('===== 함수 호출: openQuotationManageViewModal() =====');
  console.log(`📋 견적 정보: ${quotationDate}-${quotationNo}`);

  const modal = document.getElementById('quotationManageViewModal');
  console.log('📌 HTML ID: quotationManageViewModal');

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    console.log('✅ 모달 표시 완료');
    console.log('모달 display:', modal.style.display);
  } else {
    console.error('❌ quotationManageViewModal 요소를 찾을 수 없습니다');
    alert('상세보기 모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 드래그 기능 활성화 (최초 1회만 실행)
  console.log('📌 HTML ID: quotationManageViewModalHeader (드래그 헤더)');
  if (typeof makeModalDraggable === 'function' && !window.quotationManageViewModalDraggable) {
    makeModalDraggable('quotationManageViewModal', 'quotationManageViewModalHeader');
    window.quotationManageViewModalDraggable = true;
    console.log('✅ 드래그 기능 활성화 완료');
  }

  // ✅ 출력 버튼을 위해 현재 견적 정보 저장
  window.currentQuotationDetail = {
    견적일자: quotationDate,
    견적번호: quotationNo,
  };
  console.log('📋 현재 견적 정보 저장 완료');

  try {
    console.log(`📡 API 호출 시작: GET /api/quotations/${quotationDate}/${quotationNo}`);
    // 견적 마스터+상세 조회 (기존 API 사용)
    const masterRes = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`);
    console.log('API 응답 상태:', masterRes.status);
    const masterData = await masterRes.json();
    console.log('API 응답 결과:', masterData);

    if (!masterData.success || !masterData.data) {
      throw new Error('견적 정보를 찾을 수 없습니다.');
    }

    const master = masterData.data.master;
    // ✅ API 응답이 details 또는 detail로 올 수 있으므로 둘 다 처리
    const details = masterData.data.details || masterData.data.detail || [];

    console.log('✅ 견적 상세 데이터:', { master, detailCount: details.length });

    // 기본 정보 표시 (올바른 요소 ID 사용)
    console.log('📌 HTML ID: quotationManageViewNo, quotationManageViewDate, quotationManageViewCustomer, quotationManageViewRemark');
    $('#quotationManageViewNo').text(`${master.견적일자}-${master.견적번호}`);
    $('#quotationManageViewDate').text(master.견적일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    $('#quotationManageViewCustomer').text(
      master.매출처명 && master.매출처코드 ? `${master.매출처명}(${master.매출처코드})` : master.매출처명 || '-'
    );
    $('#quotationManageViewRemark').text(master.적요 || '-');
    console.log('✅ 기본 정보 표시 완료');

    // ✅ DataTable이 이미 초기화되어 있으면 destroy 후 재생성
    console.log('📌 HTML ID: quotationManageViewDetailTable');
    if ($.fn.DataTable.isDataTable('#quotationManageViewDetailTable')) {
      console.log('✅ 기존 DataTable 파괴');
      $('#quotationManageViewDetailTable').DataTable().destroy();
    }

    // ✅ DataTable 초기화 (API 필드명에 맞게 수정)
    console.log(`📊 DataTable 초기화 시작 (상세내역: ${details.length}건)`);
    window.quotationManageViewDetailTable = $('#quotationManageViewDetailTable').DataTable({
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

    console.log(`✅ 견적 상세 DataTable 초기화 완료 (${details.length}건)`);

    // ✅ 합계 금액 계산 (API 필드명: 공급가액)
    const totalAmount = details.reduce((sum, item) => {
      return sum + (item.공급가액 || 0);
    }, 0);

    // 합계 표시
    console.log('📌 HTML ID: quotationManageViewTotal');
    $('#quotationManageViewTotal').text(totalAmount.toLocaleString());
    console.log(`💰 견적 합계 금액: ${totalAmount.toLocaleString()}원`);

    console.log('===== 함수 종료: openQuotationManageViewModal() =====');
  } catch (err) {
    console.error('❌ 견적 상세 조회 오류:', err);
    alert('견적 상세 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
    console.log('===== 함수 종료: openQuotationManageViewModal() (오류 발생) =====');
  }
}

// 전역 함수로 노출
window.openQuotationManageViewModal = openQuotationManageViewModal;

// ✅ 상세 버튼 모달 닫기 함수
function closeQuotationManageViewModal() {
  const modal = document.getElementById('quotationManageViewModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  // 체크박스 초기화
  $('.quotationRowCheck').prop('checked', false);

  // 버튼 상태도 초기화
  $('.quotationRowCheck').each(function () {
    const quotationDate = $(this).data('date');
    const quotationNo = $(this).data('no');
    const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

    actionDiv.find('.quotationBtnView').show();
    actionDiv.find('.quotationBtnEdit').hide();
    actionDiv.find('.quotationBtnDelete').hide();
    actionDiv.find('.quotationBtnApprove').hide(); // ✅ 승인 버튼도 숨김
  });

  // DataTable 정리 (메모리 누수 방지)
  if (window.quotationManageViewDetailTable) {
    window.quotationManageViewDetailTable.destroy();
    window.quotationManageViewDetailTable = null;
    $('#quotationManageViewDetailTable tbody').empty();
  }
}

// 필터링 함수
// function filterQuotations() {
//   if (window.quotationManageTableInstance) {
//     window.quotationManageTableInstance.ajax.reload();
//   }
// }

// ✅ 견적 상세보기 함수 (DataTable 버튼에서 호출)
function viewQuotationManageDetail(quotationDate, quotationNo) {
  console.log(`✅ 견적 상세보기 호출: ${quotationDate}-${quotationNo}`);

  // openQuotationManageViewModal 함수 호출
  if (typeof window.openQuotationManageViewModal === 'function') {
    window.openQuotationManageViewModal(quotationDate, quotationNo);
  } else {
    console.error('❌ openQuotationManageViewModal 함수를 찾을 수 없습니다.');
    alert('견적 상세보기 기능을 사용할 수 없습니다.');
  }
}

// 전역 함수로 노출
window.viewQuotationManageDetail = viewQuotationManageDetail;

// ✅ 견적 수정 함수 - 모달 열기 (견적내역 포함)
async function editQuotationManage(quotationDate, quotationNo) {
  console.log('===== 함수 호출: editQuotationManage() =====');
  console.log(`📋 견적 정보: ${quotationDate}-${quotationNo}`);

  try {
    // 현재 견적 정보 조회 (마스터 + 상세)
    console.log(`📡 API 호출 시작: GET /api/quotations/${quotationDate}/${quotationNo}`);
    const response = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`);
    console.log('API 응답 상태:', response.status);
    const result = await response.json();
    console.log('API 응답 결과:', result);

    if (!result.success || !result.data) {
      throw new Error('견적 정보를 찾을 수 없습니다.');
    }

    const master = result.data.master;
    const details = result.data.details || result.data.detail || [];

    console.log('✅ API 응답 확인:', {
      master: master ? '존재' : '없음',
      detailCount: details.length,
      detailFields: details.length > 0 ? Object.keys(details[0]) : '데이터 없음'
    });

    // ✅ 기본 정보 표시 (Prefix Rule 적용)
    // readonly input 요소 - value 사용
    console.log('📌 HTML ID: quotationManageEditNo, quotationManageEditDate, quotationManageEditCustomerName');
    document.getElementById('quotationManageEditNo').value = `${quotationDate}-${quotationNo}`;
    document.getElementById('quotationManageEditDate').value = quotationDate.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('quotationManageEditCustomerName').value = master.매출처명 || '-';
    console.log('✅ 기본 정보 표시 완료');

    // input/textarea 요소 - value 사용
    console.log('📌 HTML ID: quotationManageEditDeliveryDate, quotationManageEditTitle, quotationManageEditRemark');
    const deliveryDateEl = document.getElementById('quotationManageEditDeliveryDate');
    if (deliveryDateEl && master.출고희망일자) {
      const deliveryDate = master.출고희망일자.toString();
      if (deliveryDate.length === 8) {
        deliveryDateEl.value = `${deliveryDate.substring(0, 4)}-${deliveryDate.substring(4, 6)}-${deliveryDate.substring(6, 8)}`;
      }
    }

    const titleEl = document.getElementById('quotationManageEditTitle');
    if (titleEl) titleEl.value = master.제목 || '';

    const remarkEl = document.getElementById('quotationManageEditRemark');
    if (remarkEl) remarkEl.value = master.적요 || '';
    console.log('✅ 입력 필드 값 설정 완료');

    // 모달에 견적일자, 번호 저장 (submit 시 사용)
    const modal = document.getElementById('quotationManageEditModal');
    console.log('📌 HTML ID: quotationManageEditModal');
    modal.dataset.quotationDate = quotationDate;
    modal.dataset.quotationNo = quotationNo;
    modal.dataset.매출처코드 = master.매출처코드;
    modal.dataset.결제방법 = master.결제방법 || 0;
    modal.dataset.결제예정일자 = master.결제예정일자 || '';
    modal.dataset.유효일수 = master.유효일수 || 0;
    console.log('📋 모달 dataset 저장:', { quotationDate, quotationNo, 매출처코드: master.매출처코드 });

    // ✅ 모달을 먼저 표시 (DataTable 너비 계산을 위해)
    modal.style.display = 'block';
    console.log('✅ 모달 표시 완료 (DataTable 초기화 전)');

    // ✅ 브라우저 렌더링 대기 후 DataTable 초기화
    setTimeout(() => {
      // ✅ 견적내역 DataTable 초기화
      console.log('📌 HTML ID: quotationManageEditDetailTable');
      if (window.quotationManageEditDetailDataTable) {
        console.log('✅ 기존 DataTable 파괴');
        window.quotationManageEditDetailDataTable.destroy();
      }

      // ✅ tbody 초기화 (placeholder 행 제거)
      $('#quotationManageEditDetailTableBody').empty();

      console.log(`📊 DataTable 초기화 시작 (상세내역: ${details.length}건)`);
      window.quotationManageEditDetailDataTable = $('#quotationManageEditDetailTable').DataTable({
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
                <button class="btn-icon" onclick="editQuotationManageDetailRow(${meta.row})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 50px;">수정</button>
                <button class="btn-icon" onclick="deleteQuotationManageDetailRow(${meta.row})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 50px;">삭제</button>
              </div>
            `;
          },
        },
      ],
      language: {
        lengthMenu: '페이지당 _MENU_ 개씩 보기',
        zeroRecords: '견적 품목이 없습니다',
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

      console.log(`✅ 견적 수정 DataTable 초기화 완료 (${details.length}건)`);

      // ✅ DataTable 칼럼 너비 재조정 (모달이 표시된 후)
      window.quotationManageEditDetailDataTable.columns.adjust().draw();
      console.log('✅ DataTable 칼럼 너비 재조정 완료');

      // ✅ 합계 금액 계산 (API 필드명: 공급가액)
      console.log('📌 HTML ID: quotationManageEditDetailTotal');
      const totalAmount = details.reduce((sum, item) => sum + (item.공급가액 || 0), 0);
      $('#quotationManageEditDetailTotal').text(totalAmount.toLocaleString());
      console.log(`💰 합계 금액: ${totalAmount.toLocaleString()}원`);

      // ✅ 전체 선택 체크박스 이벤트
      console.log('📌 HTML ID: selectAllEditDetails (체크박스)');
      $('#selectAllEditDetails')
        .off('change')
        .on('change', function () {
          const isChecked = $(this).prop('checked');
          $('.editDetailCheckbox').prop('checked', isChecked);
          console.log(`✅ 전체 선택 체크박스 변경: ${isChecked}`);
        });

      // 드래그 기능 활성화 (최초 1회만 실행)
      console.log('📌 HTML ID: quotationManageEditModalHeader (드래그 헤더)');
      if (typeof makeModalDraggable === 'function' && !window.quotationManageEditModalDraggable) {
        makeModalDraggable('quotationManageEditModal', 'quotationManageEditModalHeader');
        window.quotationManageEditModalDraggable = true;
        console.log('✅ 드래그 기능 활성화 완료');
      }
    }, 100); // 100ms 대기 후 DataTable 초기화 (브라우저 렌더링 완료 보장)

    console.log('===== 함수 종료: editQuotationManage() =====');
  } catch (err) {
    console.error('❌ 견적 수정 모달 열기 오류:', err);
    alert('견적 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
    console.log('===== 함수 종료: editQuotationManage() (오류 발생) =====');
  }
}

// ✅ 견적 수정 모달 닫기
function closeQuotationManageEditModal() {
  console.log('===== 함수 호출: closeQuotationManageEditModal() =====');

  const modal = document.getElementById('quotationManageEditModal');
  console.log('📌 HTML ID: quotationManageEditModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ 모달 닫기 완료');
  }

  // 체크박스 초기화
  $('.quotationRowCheck').prop('checked', false);
  console.log('✅ 체크박스 초기화 완료');

  // 버튼 상태도 초기화
  $('.quotationRowCheck').each(function () {
    const quotationDate = $(this).data('date');
    const quotationNo = $(this).data('no');
    const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

    actionDiv.find('.quotationBtnView').show();
    actionDiv.find('.quotationBtnEdit').hide();
    actionDiv.find('.quotationBtnDelete').hide();
    actionDiv.find('.quotationBtnApprove').hide(); // ✅ 승인 버튼도 숨김
  });
  console.log('✅ 버튼 상태 초기화 완료');

  // DataTable 정리
  console.log('📌 HTML ID: quotationManageEditDetailTable');
  if (window.quotationManageEditDetailDataTable) {
    window.quotationManageEditDetailDataTable.destroy();
    window.quotationManageEditDetailDataTable = null;
    $('#quotationManageEditDetailTable tbody').empty();
    console.log('✅ DataTable 정리 완료');
  }

  console.log('===== 함수 종료: closeQuotationManageEditModal() =====');
}

// ✅ 선택된 자재 정보 (전역 변수)
let selectedMaterial = null;

// ✅ 신규/수정 모드 플래그 (전역 변수)
let isNewQuotationMode = false;

// ✅ 자재 검색 함수
// ✅ [견적관리] 공통 자재 검색 (quotationDetailAddModal)
// HTML에 있는 materialSearchInput / materialSearchTableBody / materialSearchResults 기준으로 동작
async function searchMaterials() {
  try {
    const keyword = document.getElementById('materialSearchInput').value.trim();
    if (!keyword) {
      alert('검색어를 입력해주세요.');
      return;
    }

    // 서버는 /api/materials 에서 searchName을 처리
    const params = new URLSearchParams();
    params.append('searchName', keyword);

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
            onclick='selectMaterialForQuotation(${JSON.stringify(material).replace(/'/g,"&apos;")})'>
            선택
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    resultsDiv.style.display = 'block';
    console.log(`✅ 자재 검색 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

// ✅ 자재 선택 함수
function selectMaterial(material) {
  selectedMaterial = material;

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
  selectedMaterial = null;
  if (typeof newSelectedMaterial !== 'undefined') newSelectedMaterial = null;

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
    if (!selectedMaterial) {
      alert('먼저 자재를 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 = selectedMaterial.분류코드 + selectedMaterial.세부코드;

    // 매출처코드 가져오기 (신규 견적서 또는 견적 수정)
    let 매출처코드;

    if (isNewQuotationMode) {
      // 신규 견적서 작성 모드
      매출처코드 = document.getElementById('selectedCustomerCode').value;
    } else {
      // 견적 수정 모드
      const quotationManageEditModal = document.getElementById('quotationManageEditModal');
      매출처코드 = quotationManageEditModal.dataset.매출처코드;
    }

    if (!매출처코드) {
      alert('매출처 정보를 찾을 수 없습니다.');
      return;
    }

    // 자재 정보 표시
    document.getElementById('priceHistoryMaterialName').textContent = selectedMaterial.자재명;
    document.getElementById('priceHistoryMaterialCode').textContent = `[${자재코드}] ${
      selectedMaterial.규격 || ''
    }`;

    // 탭 초기화 (실제 출고가 탭으로 시작)
    currentPriceHistoryTab = 'actual';
    const tabActual = document.getElementById('tabActualPrice');
    const tabQuotation = document.getElementById('tabQuotationPrice');

    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabQuotation.style.background = 'transparent';
    tabQuotation.style.color = '#6b7280';
    tabQuotation.style.borderBottom = '3px solid transparent';

    // 실제 출고가 데이터 로드
    await loadActualPriceHistory();

    // 모달 표시
    document.getElementById('quotationManagePriceHistoryModal').style.display = 'block';
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
  closeQuotationManagePriceHistoryModal();

  console.log(`✅ 단가 선택: ${price}원`);
}

// ✅ 단가 이력 모달 닫기
function closeQuotationManagePriceHistoryModal() {
  document.getElementById('quotationManagePriceHistoryModal').style.display = 'none';
}

// ✅ 단가 이력 탭 전환
let currentQuotationManagePriceHistoryTab = 'actual'; // 현재 활성화된 탭

async function switchQuotationManagePriceHistoryTab(tab) {
  currentQuotationManagePriceHistoryTab = tab;

  // 탭 버튼 스타일 변경
  const tabActual = document.getElementById('quotationManagePriceHistoryActualTab');
  const tabQuotation = document.getElementById('quotationManagePriceHistoryQuotationTab');

  if (tab === 'actual') {
    // 실제 출고가 탭 활성화
    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabQuotation.style.background = 'transparent';
    tabQuotation.style.color = '#6b7280';
    tabQuotation.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('quotationManagePriceHistoryLabel').textContent =
      '이 거래처에 실제 출고한 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('quotationManagePriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">적요</th>
      </tr>
    `;

    // 실제 출고 데이터 로드
    await loadActualPriceHistory();
  } else if (tab === 'quotation') {
    // 견적 제안가 탭 활성화
    tabQuotation.style.background = '#3b82f6';
    tabQuotation.style.color = 'white';
    tabQuotation.style.borderBottom = '3px solid #3b82f6';

    tabActual.style.background = 'transparent';
    tabActual.style.color = '#6b7280';
    tabActual.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('quotationManagePriceHistoryLabel').textContent =
      '이 거래처에 제안한 견적 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('quotationManagePriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">견적일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">상태</th>
      </tr>
    `;

    // 견적 제안가 데이터 로드
    await loadQuotationPriceHistory();
  }
}

// ✅ 실제 출고 이력 로드
async function loadActualPriceHistory() {
  try {
    if (!selectedMaterial) return;

    const 자재코드 = selectedMaterial.분류코드 + selectedMaterial.세부코드;

    // 매출처코드 가져오기 (신규 견적서 또는 견적 수정)
    let 매출처코드;

    if (isNewQuotationMode) {
      // 신규 견적서 작성 모드
      매출처코드 = document.getElementById('selectedCustomerCode').value;
    } else {
      // 견적 수정 모드
      const quotationManageEditModal = document.getElementById('quotationManageEditModal');
      매출처코드 = quotationManageEditModal.dataset.매출처코드;
    }

    if (!매출처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/price-history/${매출처코드}`,
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

    console.log(`✅ 실제 출고가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 실제 출고가 이력 조회 오류:', err);
    alert('실제 출고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적 제안가 이력 로드
async function loadQuotationPriceHistory() {
  try {
    if (!selectedMaterial) return;

    const 자재코드 = selectedMaterial.분류코드 + selectedMaterial.세부코드;

    // 매출처코드 가져오기 (신규 견적서 또는 견적 수정)
    let 매출처코드;

    if (isNewQuotationMode) {
      // 신규 견적서 작성 모드
      매출처코드 = document.getElementById('selectedCustomerCode').value;
    } else {
      // 견적 수정 모드
      const quotationManageEditModal = document.getElementById('quotationManageEditModal');
      매출처코드 = quotationManageEditModal.dataset.매출처코드;
    }

    if (!매출처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/quotation-history/${매출처코드}`,
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
            이 거래처에 제안한 견적 이력이 없습니다
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

        const 견적일자 = item.견적일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 상태 = item.상태코드 === 1 ? '작성중' : item.상태코드 === 2 ? '승인' : '반려';
        const 상태색 =
          item.상태코드 === 1 ? '#f59e0b' : item.상태코드 === 2 ? '#10b981' : '#ef4444';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${견적일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.출고단가 || 0).toLocaleString()}원
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

    console.log(`✅ 견적 제안가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 견적 제안가 이력 조회 오류:', err);
    alert('견적 제안가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 자재 추가 모달 열기
// mode: 'create' (작성 모달) 또는 'edit' (수정 모달)
function openQuotationManageDetailAddModal(mode = 'create') {
  console.log('===== 함수 호출: openQuotationManageDetailAddModal() =====');
  console.log('📌 모달 ID: quotationManageDetailAddModal');
  console.log('📌 모드:', mode);

  // 모달 초기화
  selectedMaterialForAdd = null;

  // 모달에 모드 저장 (확인 버튼에서 사용)
  const modal = document.getElementById('quotationManageDetailAddModal');
  if (modal) {
    modal.dataset.mode = mode;
  }

  console.log('✅ 선택된 자재 초기화, 모드:', mode);

  // 자재 검색 섹션 ID 로깅
  console.log('📌 HTML ID: quotationManageDetailAddMaterialSearchSection, quotationManageDetailAddSearchInputArea');

  // 자재 검색 필드 초기화
  const categoryInput = document.getElementById('addDetailMaterialSearchCategory');
  const codeInput = document.getElementById('addDetailMaterialSearchCode');
  const nameInput = document.getElementById('addDetailMaterialSearchName');
  console.log('📌 HTML ID: addDetailMaterialSearchCategory, addDetailMaterialSearchCode, addDetailMaterialSearchName');
  if (categoryInput) categoryInput.value = '';
  if (codeInput) codeInput.value = '';
  if (nameInput) nameInput.value = '';
  console.log('✅ 자재 검색 필드 초기화 완료');

  // 수량/단가/금액 필드 초기화
  const quantityInput = document.getElementById('addDetailQuantity');
  const priceInput = document.getElementById('addDetailPrice');
  const amountInput = document.getElementById('addDetailAmount');
  console.log('📌 HTML ID: addDetailQuantity, addDetailPrice, addDetailAmount');
  if (quantityInput) quantityInput.value = '1';
  if (priceInput) priceInput.value = '0';
  if (amountInput) amountInput.value = '0';
  console.log('✅ 수량/단가/금액 필드 초기화 완료 (수량: 1, 단가: 0, 금액: 0)');

  // 검색 결과 및 선택 정보 숨기기
  const searchResults = document.getElementById('addDetailMaterialSearchResults');
  const selectedInfo = document.getElementById('addDetailSelectedMaterialInfo');
  console.log('📌 HTML ID: addDetailMaterialSearchResults, addDetailSelectedMaterialInfo');
  if (searchResults) searchResults.style.display = 'none';
  if (selectedInfo) selectedInfo.style.display = 'none';
  console.log('✅ 검색 결과 및 선택 정보 숨김');

  // 검색 결과 테이블 초기화
  const tbody = document.getElementById('addDetailMaterialSearchTableBody');
  console.log('📌 HTML ID: addDetailMaterialSearchTableBody');
  if (tbody) tbody.innerHTML = '';
  console.log('✅ 검색 결과 테이블 초기화 완료');

  // 모달 표시
  console.log('📌 HTML ID: quotationManageDetailAddModal');
  if (modal) {
    modal.style.display = 'block';
    console.log('✅ 모달 표시 완료');
    console.log('모달 display:', modal.style.display);

    // 드래그로 인한 transform 초기화 (overflow-x 방지)
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.transform = 'none';
      modalContent.style.left = '';
      modalContent.style.top = '';
    }
  }
  console.log('===== 함수 종료: openQuotationManageDetailAddModal() =====');
}

// ✅ 자재 검색 함수 (견적 상세내역 추가용)
async function searchAddDetailMaterials() {
  console.log('===== 함수 호출: searchAddDetailMaterials() =====');
  try {
    const searchCategory = document.getElementById('addDetailMaterialSearchCategory').value.trim();
    const searchCode = document.getElementById('addDetailMaterialSearchCode').value.trim();
    const searchName = document.getElementById('addDetailMaterialSearchName').value.trim();
    console.log('📌 HTML ID: addDetailMaterialSearchCategory, addDetailMaterialSearchCode, addDetailMaterialSearchName');

    if (!searchCategory && !searchCode && !searchName) {
      console.log('❌ 검색 조건 없음');
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 자재 검색 조건:', {
      분류코드: searchCategory,
      자재코드: searchCode,
      자재명: searchName,
    });

    const params = new URLSearchParams();
    if (searchCategory) params.append('searchCategory', searchCategory);
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);

    console.log('📡 API 요청:', `${API_BASE_URL}/materials?${params.toString()}`);
    const response = await fetch(`${API_BASE_URL}/materials?${params.toString()}`);
    const result = await response.json();
    console.log('📡 API 응답:', result);

    if (!result.success) {
      throw new Error(result.message || '자재 조회 실패');
    }

    const materials = result.data || [];
    console.log('📋 검색 결과 개수:', materials.length);

    const tbody = document.getElementById('addDetailMaterialSearchTableBody');
    console.log('📌 HTML ID: addDetailMaterialSearchTableBody');
    tbody.innerHTML = '';

    if (materials.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #6b7280;">검색 결과가 없습니다.</td></tr>';
      console.log('⚠️ 검색 결과 없음');
    } else {
      materials.forEach(material => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.style.transition = 'background 0.2s';
        row.onmouseover = function() { this.style.background = '#f9fafb'; };
        row.onmouseout = function() { this.style.background = 'white'; };
        row.onclick = function() { selectAddDetailMaterial(material); };

        const 품목코드 = (material.분류코드 || '') + (material.세부코드 || '');

        row.innerHTML = `
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${품목코드}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${material.자재명 || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${material.규격 || '-'}</td>
        `;
        tbody.appendChild(row);
      });
      console.log('✅ 검색 결과 테이블 렌더링 완료');
    }

    // 검색 결과 표시
    document.getElementById('addDetailMaterialSearchResults').style.display = 'block';
    console.log('📌 HTML ID: addDetailMaterialSearchResults');
    console.log('✅ 검색 결과 영역 표시');
    console.log('===== 함수 종료: searchAddDetailMaterials() =====');

  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 자재 검색 초기화 함수
function clearAddDetailMaterialSearch() {
  console.log('===== 함수 호출: clearAddDetailMaterialSearch() =====');
  document.getElementById('addDetailMaterialSearchCategory').value = '';
  document.getElementById('addDetailMaterialSearchCode').value = '';
  document.getElementById('addDetailMaterialSearchName').value = '';
  console.log('📌 HTML ID: addDetailMaterialSearchCategory, addDetailMaterialSearchCode, addDetailMaterialSearchName');
  document.getElementById('addDetailMaterialSearchResults').style.display = 'none';
  console.log('📌 HTML ID: addDetailMaterialSearchResults');
  console.log('✅ 자재 검색 초기화 완료');
  console.log('===== 함수 종료: clearAddDetailMaterialSearch() =====');
}

// ✅ 자재 선택 함수
function selectAddDetailMaterial(material) {
  console.log('===== 함수 호출: selectAddDetailMaterial() =====');
  console.log('📋 선택된 자재:', material);

  selectedMaterialForAdd = {
    품목코드: (material.분류코드 || '') + (material.세부코드 || ''),
    품목명: material.자재명,
    판매단가: material.출고단가 || material.출고단가1 || 0,
    규격: material.규격 || '',
    단위: material.단위 || '',
    분류코드: material.분류코드 || '',
    세부코드: material.세부코드 || '',
  };
  console.log('✅ 자재 정보 저장:', selectedMaterialForAdd);

  // 선택된 자재 정보 표시
  document.getElementById('addDetailSelectedMaterialName').textContent =
    selectedMaterialForAdd.품목명 + (selectedMaterialForAdd.규격 ? ` (${selectedMaterialForAdd.규격})` : '');
  document.getElementById('addDetailSelectedMaterialCode').textContent =
    `품목코드: ${selectedMaterialForAdd.품목코드}`;
  console.log('📌 HTML ID: addDetailSelectedMaterialName, addDetailSelectedMaterialCode');

  document.getElementById('addDetailSelectedMaterialInfo').style.display = 'block';
  console.log('📌 HTML ID: addDetailSelectedMaterialInfo');
  console.log('✅ 선택된 자재 정보 표시');

  // 단가 자동 입력
  document.getElementById('addDetailPrice').value = selectedMaterialForAdd.판매단가;
  console.log('📌 HTML ID: addDetailPrice');
  console.log('✅ 단가 자동 입력:', selectedMaterialForAdd.판매단가);

  // 금액 자동 계산
  calculateAddDetailAmount();

  // 검색 결과 숨기기
  document.getElementById('addDetailMaterialSearchResults').style.display = 'none';
  console.log('📌 HTML ID: addDetailMaterialSearchResults');
  console.log('✅ 검색 결과 숨김');
  console.log('===== 함수 종료: selectAddDetailMaterial() =====');
}

// ✅ 선택 취소
function clearAddDetailSelectedMaterial() {
  console.log('===== 함수 호출: clearAddDetailSelectedMaterial() =====');
  selectedMaterialForAdd = null;
  console.log('✅ 선택된 자재 초기화');

  document.getElementById('addDetailSelectedMaterialInfo').style.display = 'none';
  console.log('📌 HTML ID: addDetailSelectedMaterialInfo');

  document.getElementById('addDetailPrice').value = '0';
  console.log('📌 HTML ID: addDetailPrice');
  console.log('✅ 단가 초기화: 0');

  calculateAddDetailAmount();
  console.log('===== 함수 종료: clearAddDetailSelectedMaterial() =====');
}

// ✅ 금액 자동 계산
function calculateAddDetailAmount() {
  console.log('===== 함수 호출: calculateAddDetailAmount() =====');
  const 수량 = parseFloat(document.getElementById('addDetailQuantity').value) || 0;
  const 단가 = parseFloat(document.getElementById('addDetailPrice').value) || 0;
  console.log('📌 HTML ID: addDetailQuantity, addDetailPrice');
  console.log('📊 계산 값:', { 수량, 단가 });

  const 금액 = 수량 * 단가;
  console.log('💰 계산된 금액:', 금액);

  document.getElementById('addDetailAmount').value = 금액.toLocaleString();
  console.log('📌 HTML ID: addDetailAmount');
  console.log('✅ 금액 표시:', 금액.toLocaleString());
  console.log('===== 함수 종료: calculateAddDetailAmount() =====');
}

// ✅ 이전 단가 조회
async function showQuotationManageDetailPriceHistory() {
  console.log('🎯 showQuotationManageDetailPriceHistory 함수 호출됨');

  try {
    if (!selectedMaterialForAdd) {
      console.log('❌ selectedMaterialForAdd가 없음');
      alert('먼저 자재를 검색하여 선택해주세요.');
      return;
    }
    console.log('✅ selectedMaterialForAdd:', selectedMaterialForAdd);

    const 자재코드 = selectedMaterialForAdd.품목코드 ||
                   (selectedMaterialForAdd.분류코드 + selectedMaterialForAdd.세부코드);
    console.log('📦 자재코드:', 자재코드);

    // 매출처코드 가져오기 (견적서 작성 모달에서)
    const 매출처코드 = document.getElementById('quotationManageCreateCustomerCode')?.value ||
                      document.getElementById('selectedCustomerCode')?.value;
    console.log('🏢 매출처코드:', 매출처코드);

    if (!매출처코드) {
      console.log('❌ 매출처코드가 없음');
      alert('매출처를 먼저 선택해주세요.');
      return;
    }

    // 자재 정보 표시
    const nameEl = document.getElementById('quotationManagePriceHistoryMaterialName');
    const codeEl = document.getElementById('quotationManagePriceHistoryMaterialCode');
    console.log('🔍 Modal 요소 체크 - nameEl:', nameEl, 'codeEl:', codeEl);

    if (nameEl) nameEl.textContent = selectedMaterialForAdd.품목명;
    if (codeEl) codeEl.textContent = `[${자재코드}] ${selectedMaterialForAdd.규격 || ''}`;

    // 탭 초기화
    currentQuotationManagePriceHistoryTab = 'actual';
    const actualTab = document.getElementById('quotationManagePriceHistoryActualTab');
    const quotationTab = document.getElementById('quotationManagePriceHistoryQuotationTab');
    console.log('🔍 Tab 요소 체크 - actualTab:', actualTab, 'quotationTab:', quotationTab);

    if (actualTab) {
      actualTab.style.background = '#3b82f6';
      actualTab.style.color = 'white';
      actualTab.style.borderBottom = '3px solid #3b82f6';
    }
    if (quotationTab) {
      quotationTab.style.background = 'transparent';
      quotationTab.style.color = '#6b7280';
      quotationTab.style.borderBottom = '3px solid transparent';
    }

    // 실제 출고단가 이력 로드
    console.log('📡 API 호출 시작');
    await loadActualPriceHistoryForAddDetail(자재코드, 매출처코드);
    console.log('✅ API 호출 완료');

    // 모달 표시
    const modal = document.getElementById('quotationManagePriceHistoryModal');
    console.log('🔍 quotationManagePriceHistoryModal 요소:', modal);
    console.log('🔍 Modal 현재 display:', modal?.style.display);

    if (modal) {
      modal.style.display = 'block';
      console.log('✅ Modal display를 block으로 설정 완료');
      console.log('🔍 Modal display 확인:', modal.style.display);
    } else {
      console.error('❌ quotationManagePriceHistoryModal 요소를 찾을 수 없음!');
    }

  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    console.error('스택 트레이스:', err.stack);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 상세내역 추가용 실제 출고단가 이력 로드
async function loadActualPriceHistoryForAddDetail(자재코드, 매출처코드) {
  try {
    console.log(`🔍 견적 단가 이력 조회: 자재코드=${자재코드}, 매출처코드=${매출처코드}`);

    const response = await fetch(
      `${API_BASE_URL}/materials/${encodeURIComponent(자재코드)}/quotation-history/${encodeURIComponent(매출처코드)}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP 에러:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ API 응답:', result);

    if (!result.success) {
      throw new Error(result.message || '단가 이력 조회 실패');
    }

    const history = result.data || [];
    const tbody = document.getElementById('quotationManagePriceHistoryTableBody');

    if (!tbody) {
      console.error('❌ quotationManagePriceHistoryTableBody 요소를 찾을 수 없음!');
      throw new Error('테이블 요소를 찾을 수 없습니다.');
    }

    tbody.innerHTML = '';
    console.log(`📋 이력 데이터 ${history.length}건 로드`);

    if (history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 20px; color: #6c757d;">
            이력이 없습니다
          </td>
        </tr>
      `;
    } else {
      history.forEach(item => {
        const row = tbody.insertRow();
        row.style.cursor = 'pointer';
        row.onclick = function() {
          applyAddDetailPriceFromHistory(item.단가);
        };

        row.innerHTML = `
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${item.입출고일자?.replace(
            /(\d{4})(\d{2})(\d{2})/,
            '$1-$2-$3'
          ) || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${item.매출처명 || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: right;">${parseFloat(
            item.수량 || 0
          ).toLocaleString()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600; color: #007bff;">${parseFloat(
            item.단가 || 0
          ).toLocaleString()}원</td>
        `;
      });
    }
  } catch (err) {
    console.error('❌ 실제 출고단가 이력 조회 오류:', err);
    alert('실제 출고단가 이력을 불러오는 중 오류가 발생했습니다.');
  }
}

// ✅ 이력에서 단가 적용
function applyAddDetailPriceFromHistory(price) {
  document.getElementById('addDetailPrice').value = price;
  calculateAddDetailAmount();
  closeQuotationManagePriceHistoryModal();
  console.log(`✅ 이전단가 적용: ${price}원`);
}

// ✅ 자재 추가 모달 닫기
function closeQuotationManageDetailAddModal() {
  console.log('===== 함수 호출: closeQuotationManageDetailAddModal() =====');

  document.getElementById('quotationManageDetailAddModal').style.display = 'none';
  console.log('📌 HTML ID: quotationManageDetailAddModal');
  console.log('✅ 모달 닫기 완료');

  // 견적서 작성 모달 다시 표시
  if (isNewQuotationMode) {
    const quotationManageCreateModal = document.getElementById('quotationManageCreateModal');
    console.log('📌 HTML ID: quotationManageCreateModal');
    quotationManageCreateModal.style.display = quotationManageCreateModal.dataset.previousDisplay || 'block';
    console.log('✅ 견적서 작성 모달 다시 표시');
    isNewQuotationMode = false;
  }

  console.log('===== 함수 종료: closeQuotationManageDetailAddModal() =====');
}

// ✅ 자재 추가 확인 (작성/수정 모드 분기)
function confirmQuotationManageDetailAdd() {
  console.log('===== 함수 호출: confirmQuotationManageDetailAdd() =====');

  try {
    // 모드 확인
    const modal = document.getElementById('quotationManageDetailAddModal');
    const mode = modal ? modal.dataset.mode : 'create';
    console.log('📌 현재 모드:', mode);

    // 선택된 자재 확인
    if (!selectedMaterialForAdd) {
      console.log('❌ 선택된 자재 없음');
      alert('품목을 검색하여 선택해주세요.');
      return;
    }
    console.log('✅ 선택된 자재 확인:', selectedMaterialForAdd);

    const 자재코드 = selectedMaterialForAdd.품목코드 || (selectedMaterialForAdd.분류코드 + selectedMaterialForAdd.세부코드);
    const 수량 = parseFloat(document.getElementById('addDetailQuantity').value) || 0;
    const 단가 = parseFloat(document.getElementById('addDetailPrice').value) || 0;
    console.log('📌 HTML ID: addDetailQuantity, addDetailPrice');
    console.log('📊 입력 값:', { 자재코드, 수량, 단가 });

    const 공급가액 = 수량 * 단가;
    console.log('💰 계산된 공급가액:', 공급가액);

    if (수량 <= 0) {
      console.log('❌ 수량 검증 실패:', 수량);
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    if (mode === 'edit') {
      // 견적 수정 모드 - DataTable에 행 추가
      console.log('📌 수정 모드: DataTable에 행 추가');
      const newRow = {
        자재코드: 자재코드,
        자재명: selectedMaterialForAdd.품목명 || selectedMaterialForAdd.자재명,
        규격: selectedMaterialForAdd.규격 || '-',
        단위: selectedMaterialForAdd.단위 || '-',
        수량: 수량,
        단가: 단가,
        공급가액: 공급가액,
        _isNew: true,
      };

      window.quotationManageEditDetailDataTable.row.add(newRow).draw();
      console.log('✅ DataTable에 행 추가 완료');

      // 합계 재계산
      recalculateQuotationManageEditTotal();
      console.log('✅ 합계 재계산 완료');

    } else {
      // 신규 견적서 작성 모드: newQuotationDetails 배열에 추가
      console.log('📌 작성 모드: newQuotationDetails 배열에 추가');
      const newDetail = {
        자재코드: 자재코드,
        자재명: selectedMaterialForAdd.품목명 || selectedMaterialForAdd.자재명,
        규격: selectedMaterialForAdd.규격 || '',
        단위: selectedMaterialForAdd.단위 || '',
        수량: 수량,
        단가: 단가,
        공급가액: 공급가액,
      };
      console.log('📋 추가할 상세내역:', newDetail);

      newQuotationDetails.push(newDetail);
      console.log('✅ newQuotationDetails 배열에 추가 완료, 현재 개수:', newQuotationDetails.length);

      // 테이블 렌더링
      renderNewQuotationDetailTable();
      console.log('✅ 테이블 렌더링 완료');
    }

    // 자재 추가 모달 닫기
    closeQuotationManageDetailAddModal();

    console.log('===== 함수 종료: confirmQuotationManageDetailAdd() =====');

  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ [이전 코드 - 참고용] 견적 수정 모드의 자재 추가 (별도 함수로 분리 필요시 사용)
function confirmQuotationManageDetailAddForEdit() {
  try {
    if (!selectedMaterialForAdd) {
      alert('품목을 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 = selectedMaterialForAdd.품목코드 || (selectedMaterialForAdd.분류코드 + selectedMaterialForAdd.세부코드);
    const 수량 = parseFloat(document.getElementById('addDetailQuantity').value) || 0;
    const 단가 = parseFloat(document.getElementById('addDetailPrice').value) || 0;
    const 공급가액 = 수량 * 단가;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 견적 수정 모드 - DataTable에 행 추가
    const newRow = {
      자재코드: 자재코드,
      자재명: selectedMaterialForAdd.품목명 || selectedMaterialForAdd.자재명,
      규격: selectedMaterialForAdd.규격 || '-',
      단위: selectedMaterialForAdd.단위 || '-',
      수량: 수량,
      단가: 단가,
      공급가액: 공급가액,
      _isNew: true,
    };

    window.quotationManageEditDetailDataTable.row.add(newRow).draw();

    // 합계 재계산
    recalculateQuotationManageEditTotal();

    // 모달 닫기
    closeQuotationManageDetailAddModal();
  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 수정 함수 - 모달 열기
function editQuotationManageDetailRow(rowIndex) {
  try {
    const table = window.quotationManageEditDetailDataTable;
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

    // 모달에 데이터 표시
    document.getElementById('editDetailCode').textContent = rowData.자재코드 || '-';
    document.getElementById('editDetailName').textContent = rowData.자재명 || '-';
    document.getElementById('editDetailSpec').textContent = rowData.규격 || '-';
    document.getElementById('editDetailQuantity').value = rowData.수량 || 0;
    // ✅ API에서 '단가'로 반환 (출고단가 as 단가)
    document.getElementById('editDetailPrice').value = rowData.단가 || 0;
    // ✅ API에서 '공급가액'으로 반환 (수량 * 출고단가)
    document.getElementById('editDetailAmount').value = (rowData.공급가액 || 0).toLocaleString();

    // 모달에 rowIndex 저장
    const modal = document.getElementById('quotationManageDetailEditModal');
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 수정 모달 열기 오류:', err);
    alert('품목 수정 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 수정 모달 닫기
function closeQuotationManageDetailEditModal() {
  document.getElementById('quotationManageDetailEditModal').style.display = 'none';
}

// ✅ 견적내역 품목 수정 확인
function confirmQuotationManageDetailEdit() {
  try {
    const modal = document.getElementById('quotationManageDetailEditModal');
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.quotationManageEditDetailDataTable;
    const rowData = table.row(rowIndex).data();

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
    recalculateQuotationManageEditTotal();

    // 모달 닫기
    closeQuotationManageDetailEditModal();
  } catch (err) {
    console.error('❌ 품목 수정 오류:', err);
    alert('품목 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 삭제 함수 - 모달 열기
function deleteQuotationManageDetailRow(rowIndex) {
  try {
    const table = window.quotationManageEditDetailDataTable;
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
      'deleteDetailInfo',
    ).textContent = `[${rowData.자재코드}] ${rowData.자재명}`;

    // 모달에 rowIndex 저장
    const modal = document.getElementById('quotationManageDetailDeleteConfirmModal');
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 삭제 모달 열기 오류:', err);
    alert('품목 삭제 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 삭제 모달 닫기
function closeQuotationManageDetailDeleteConfirmModal() {
  document.getElementById('quotationManageDetailDeleteConfirmModal').style.display = 'none';
}

// ✅ 견적내역 품목 삭제 확인
function confirmQuotationManageDetailDelete() {
  try {
    const modal = document.getElementById('quotationManageDetailDeleteConfirmModal');
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.quotationManageEditDetailDataTable;

    // 행 삭제
    table.row(rowIndex).remove().draw();

    // 합계 재계산
    recalculateQuotationManageEditTotal();

    console.log(`✅ 품목 삭제 완료 (행 인덱스: ${rowIndex})`);

    // 모달 닫기
    closeQuotationManageDetailDeleteConfirmModal();
  } catch (err) {
    console.error('❌ 품목 삭제 오류:', err);
    alert('품목 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 선택된 견적내역 삭제 함수
function deleteSelectedQuotationManageDetails() {
  const checkedBoxes = $('.editDetailCheckbox:checked');

  if (checkedBoxes.length === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }

  if (!confirm(`선택한 ${checkedBoxes.length}개 항목을 삭제하시겠습니까?`)) {
    return;
  }

  // DataTable에서 선택된 행 제거
  const table = window.quotationManageEditDetailDataTable;
  checkedBoxes.each(function () {
    const row = table.row($(this).closest('tr'));
    row.remove();
  });

  table.draw();

  // 합계 재계산
  recalculateQuotationManageEditTotal();

  console.log(`✅ ${checkedBoxes.length}개 항목 삭제 완료`);
}

// ✅ 견적 수정 모달 합계 재계산
function recalculateQuotationManageEditTotal() {
  if (!window.quotationManageEditDetailDataTable) return;

  const data = window.quotationManageEditDetailDataTable.rows().data().toArray();
  // ✅ API 필드명 '공급가액' 사용
  const totalAmount = data.reduce((sum, item) => sum + (item.공급가액 || 0), 0);
  $('#quotationManageEditDetailTotal').text(totalAmount.toLocaleString());
}

// ✅ 견적 수정 제출 (마스터 + 상세)
async function submitQuotationManageEdit(event) {
  // form submit 이벤트인 경우 기본 동작 방지
  if (event) {
    event.preventDefault();
  }

  console.log('===== 함수 호출: submitQuotationManageEdit() =====');

  const modal = document.getElementById('quotationManageEditModal');
  console.log('📌 HTML ID: quotationManageEditModal');
  const quotationDate = modal.dataset.quotationDate;
  const quotationNo = modal.dataset.quotationNo;
  console.log(`📋 견적 정보: ${quotationDate}-${quotationNo}`);

  try {
    // ✅ 1. 마스터 정보 업데이트 (Prefix Rule 적용)
    console.log('📌 HTML ID: quotationManageEditDate, quotationManageEditDeliveryDate, quotationManageEditTitle, quotationManageEditRemark');
    const quotationDateInput = document.getElementById('quotationManageEditDate');
    const quotationDateText = quotationDateInput.value || quotationDateInput.textContent;
    const deliveryDateInput = document.getElementById('quotationManageEditDeliveryDate');
    const titleInput = document.getElementById('quotationManageEditTitle');
    const remarkInput = document.getElementById('quotationManageEditRemark');

    const masterData = {
      견적일자: quotationDateText ? quotationDateText.replace(/-/g, '') : quotationDate,
      매출처코드: modal.dataset.매출처코드,
      출고희망일자: deliveryDateInput?.value ? deliveryDateInput.value.replace(/-/g, '') : '',
      제목: titleInput?.value || '',
      적요: remarkInput?.value || '',
    };
    console.log('📋 마스터 정보:', masterData);

    console.log(`📡 API 호출 시작: PUT /api/quotations/${quotationDate}/${quotationNo}`);
    const masterResponse = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify(masterData),
    });

    console.log('API 응답 상태:', masterResponse.status);
    const masterResult = await masterResponse.json();
    console.log('API 응답 결과:', masterResult);

    if (!masterResult.success) {
      throw new Error(masterResult.message || '견적 마스터 수정 실패');
    }
    console.log('✅ 마스터 정보 수정 완료');

    // 2. 견적 상세 정보 업데이트
    const detailData = window.quotationManageEditDetailDataTable.rows().data().toArray();
    console.log(`📋 상세 데이터: ${detailData.length}건`);

    if (detailData.length > 0) {
      // 상세 정보를 서버 형식에 맞게 변환
      console.log('📊 상세 데이터 변환 시작');
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

        if (index < 3) { // 첫 3개만 로깅
          console.log(`📋 상세[${index}]:`, payload);
        }

        return payload;
      });
      console.log(`✅ 상세 데이터 변환 완료 (총 ${detailPayload.length}건)`);

      console.log(`📡 API 호출 시작: PUT /api/quotations/${quotationDate}/${quotationNo}/details`);
      const detailResponse = await fetch(
        `/api/quotations/${quotationDate}/${quotationNo}/details`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // 세션 쿠키 포함
          body: JSON.stringify(detailPayload),
        },
      );

      console.log('API 응답 상태:', detailResponse.status);
      const detailResult = await detailResponse.json();
      console.log('API 응답 결과:', detailResult);

      if (!detailResult.success) {
        throw new Error(detailResult.message || '견적 상세 수정 실패');
      }
      console.log('✅ 상세 정보 수정 완료');
    }

    alert('✅ 견적이 성공적으로 수정되었습니다.');
    console.log('✅ 견적 수정 전체 완료');
    closeQuotationManageEditModal();

    // DataTable 새로고침
    if (window.quotationManageTableInstance) {
      console.log('📊 DataTable 새로고침 시작');
      window.quotationManageTableInstance.ajax.reload();
    }

    console.log('===== 함수 종료: submitQuotationManageEdit() =====');
  } catch (err) {
    console.error('❌ 견적 수정 오류:', err);
    alert('견적 수정 중 오류가 발생했습니다: ' + err.message);
    console.log('===== 함수 종료: submitQuotationManageEdit() (오류 발생) =====');
  }
}

// ✅ 견적 삭제 함수 - 모달 열기
function deleteQuotationManage(quotationDate, quotationNo) {
  console.log('===== 함수 호출: deleteQuotationManage() =====');
  console.log(`📋 견적 정보: ${quotationDate}-${quotationNo}`);

  // 모달 요소 확인
  const modal = document.getElementById('quotationManageDeleteConfirmModal');
  console.log('📌 HTML ID: quotationManageDeleteConfirmModal');
  if (!modal) {
    console.error('❌ quotationManageDeleteConfirmModal 요소를 찾을 수 없습니다');
    alert('삭제 모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 모달 내부 요소 ID 로깅
  console.log('📌 HTML ID: quotationManageDeleteConfirmModalBody, quotationManageDeleteConfirmContentArea');
  console.log('📌 HTML ID: quotationManageDeleteConfirmInfoBox, quotationManageDeleteConfirmWarningBox, quotationManageDeleteConfirmButtonArea');

  // 단일 견적을 선택된 견적 형식으로 변환
  const selectedQuotations = [{
    quotationDate,
    quotationNo,
    customerName: '', // 매출처명은 모달에서 표시하지 않음
    title: '' // 제목도 모달에서 표시하지 않음
  }];
  console.log('📋 삭제할 견적 목록:', selectedQuotations);

  // 모달에 견적 정보 표시
  const deleteCount = document.getElementById('quotationManageDeleteCount');
  const deleteList = document.getElementById('quotationManageDeleteList');
  console.log('📌 HTML ID: quotationManageDeleteCount, quotationManageDeleteList');

  if (deleteCount) {
    deleteCount.textContent = '1';
    console.log('✅ 삭제 건수 표시: 1건');
  } else {
    console.error('❌ quotationManageDeleteCount 요소를 찾을 수 없습니다');
  }

  if (deleteList) {
    deleteList.innerHTML = `
      <div style="font-size: 14px;">
        <div style="padding: 8px 0;">
          <div style="font-weight: 600;">견적번호: ${quotationDate}-${quotationNo}</div>
        </div>
      </div>
    `;
    console.log('✅ 삭제 목록 표시 완료');
  } else {
    console.error('❌ quotationManageDeleteList 요소를 찾을 수 없습니다');
  }

  // 모달에 데이터 저장
  modal.dataset.selectedQuotations = JSON.stringify(selectedQuotations);
  console.log('✅ 모달 데이터 저장 완료');

  // 모달 표시
  modal.style.display = 'flex';
  console.log('✅ 모달 표시 완료');

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.quotationManageDeleteConfirmModalDraggable) {
    makeModalDraggable('quotationManageDeleteConfirmModal', 'quotationManageDeleteConfirmModalHeader');
    window.quotationManageDeleteConfirmModalDraggable = true;
    console.log('✅ 드래그 기능 활성화 완료');
  }

  console.log('===== 함수 종료: deleteQuotationManage() =====');
}

// ✅ 견적 삭제 모달 닫기
function closeQuotationManageDeleteConfirmModal() {
  console.log('===== 함수 호출: closeQuotationManageDeleteConfirmModal() =====');
  const modal = document.getElementById('quotationManageDeleteConfirmModal');
  console.log('📌 HTML ID: quotationManageDeleteConfirmModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ 모달 닫기 완료');
  }
  console.log('===== 함수 종료: closeQuotationManageDeleteConfirmModal() =====');
}

// ✅ 선택된 견적 삭제 (체크박스)
function deleteSelectedQuotations() {
  const checkboxes = document.querySelectorAll('#quotationManageTable tbody input[type="checkbox"]:checked');

  if (checkboxes.length === 0) {
    alert('삭제할 견적을 선택해주세요.');
    return;
  }

  // 선택된 견적 정보 수집
  const selectedQuotations = [];
  checkboxes.forEach(checkbox => {
    const row = checkbox.closest('tr');
    const quotationDate = row.dataset.quotationDate;
    const quotationNo = row.dataset.quotationNo;
    const customerName = row.querySelector('td:nth-child(4)').textContent; // 매출처명
    const title = row.querySelector('td:nth-child(6)').textContent; // 제목

    selectedQuotations.push({
      quotationDate,
      quotationNo,
      customerName,
      title
    });
  });

  // 모달에 선택된 견적 목록 표시
  const deleteCount = document.getElementById('quotationManageDeleteCount');
  const deleteList = document.getElementById('quotationManageDeleteList');

  deleteCount.textContent = selectedQuotations.length;

  let listHtml = '<div style="font-size: 14px;">';
  selectedQuotations.forEach((q, index) => {
    listHtml += `<div style="padding: 8px 0; border-bottom: 1px solid #fecaca;">
      <div style="font-weight: 600;">${index + 1}. ${q.quotationDate}-${q.quotationNo}</div>
      <div style="margin-top: 4px; color: #7f1d1d;">매출처: ${q.customerName} | 제목: ${q.title}</div>
    </div>`;
  });
  listHtml += '</div>';

  deleteList.innerHTML = listHtml;

  // 모달에 데이터 저장
  const modal = document.getElementById('quotationManageDeleteConfirmModal');
  modal.dataset.selectedQuotations = JSON.stringify(selectedQuotations);

  // 모달 표시
  modal.style.display = 'flex';
}

// ✅ 견적 삭제 확인
async function confirmQuotationManageDelete() {
  console.log('===== 함수 호출: confirmQuotationManageDelete() =====');

  const modal = document.getElementById('quotationManageDeleteConfirmModal');
  console.log('📌 HTML ID: quotationManageDeleteConfirmModal');

  const selectedQuotationsJson = modal.dataset.selectedQuotations;

  if (!selectedQuotationsJson) {
    console.error('❌ 삭제할 견적 정보가 없습니다');
    alert('삭제할 견적 정보가 없습니다.');
    return;
  }

  const selectedQuotations = JSON.parse(selectedQuotationsJson);
  console.log(`📋 삭제할 견적: ${selectedQuotations.length}건`, selectedQuotations);

  let successCount = 0;
  let failCount = 0;

  try {
    // 각 견적에 대해 삭제 요청
    for (const q of selectedQuotations) {
      try {
        console.log(`📡 API 호출 시작: DELETE /api/quotations/${q.quotationDate}/${q.quotationNo}`);
        const response = await fetch(`/api/quotations/${q.quotationDate}/${q.quotationNo}`, {
          method: 'DELETE',
        });

        console.log('API 응답 상태:', response.status);
        const result = await response.json();
        console.log('API 응답 결과:', result);

        if (result.success) {
          successCount++;
          console.log(`✅ 견적 삭제 성공: ${q.quotationDate}-${q.quotationNo}`);
        } else {
          failCount++;
          console.error(`❌ 견적 삭제 실패: ${q.quotationDate}-${q.quotationNo}`, result.message);
        }
      } catch (err) {
        failCount++;
        console.error(`❌ 견적 삭제 오류: ${q.quotationDate}-${q.quotationNo}`, err);
      }
    }

    // 결과 표시
    console.log(`📊 삭제 결과: 성공 ${successCount}건, 실패 ${failCount}건`);
    if (failCount === 0) {
      alert(`✅ ${successCount}건의 견적이 삭제되었습니다.`);
    } else {
      alert(`⚠️ ${successCount}건 삭제 완료, ${failCount}건 삭제 실패`);
    }

    closeQuotationManageDeleteConfirmModal();

    // 전체 선택 체크박스 해제
    const selectAllCheckbox = document.getElementById('quotationManageSelectAll');
    console.log('📌 HTML ID: quotationManageSelectAll');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      console.log('✅ 전체 선택 체크박스 해제 완료');
    }

    // DataTable 새로고침
    if (window.quotationManageTableInstance) {
      console.log('✅ DataTable 새로고침 시작');
      window.quotationManageTableInstance.ajax.reload();
    }
  } catch (err) {
    console.error('❌ 견적 삭제 오류:', err);
    alert('견적 삭제 중 오류가 발생했습니다: ' + err.message);
  }

  console.log('===== 함수 종료: confirmQuotationManageDelete() =====');
}

// ✅ 견적 승인 함수 - 모달 열기
function approveQuotationManage(quotationDate, quotationNo) {
  console.log('===== 함수 호출: approveQuotationManage() =====');
  console.log(`📋 견적 정보: ${quotationDate}-${quotationNo}`);

  // 모달 요소 확인
  const modal = document.getElementById('quotationManageApproveConfirmModal');
  console.log('📌 HTML ID: quotationManageApproveConfirmModal');
  if (!modal) {
    console.error('❌ quotationManageApproveConfirmModal 요소를 찾을 수 없습니다');
    alert('승인 모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 모달 내부 요소 ID 로깅
  console.log('📌 HTML ID: quotationManageApproveConfirmModalBody, quotationManageApproveConfirmContentArea');
  console.log('📌 HTML ID: quotationManageApproveConfirmInfoBox, quotationManageApproveConfirmNoticeBox, quotationManageApproveConfirmButtonArea');

  // 모달에 견적 정보 표시
  const infoElement = document.getElementById('quotationManageApproveInfo');
  console.log('📌 HTML ID: quotationManageApproveInfo');
  if (infoElement) {
    infoElement.textContent = `견적번호: ${quotationDate}-${quotationNo}`;
    console.log('✅ 견적 정보 표시 완료');
  }

  // 모달에 데이터 저장
  modal.dataset.quotationDate = quotationDate;
  modal.dataset.quotationNo = quotationNo;
  console.log('✅ 모달 데이터 저장 완료');

  // 모달 표시
  modal.style.display = 'flex';
  console.log('✅ 모달 표시 완료');

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.quotationManageApproveConfirmModalDraggable) {
    makeModalDraggable('quotationManageApproveConfirmModal', 'quotationManageApproveConfirmModalHeader');
    window.quotationManageApproveConfirmModalDraggable = true;
    console.log('✅ 드래그 기능 활성화 완료');
  }

  console.log('===== 함수 종료: approveQuotationManage() =====');
}

// ✅ 견적 승인 모달 닫기
function closeQuotationManageApproveConfirmModal() {
  console.log('===== 함수 호출: closeQuotationManageApproveConfirmModal() =====');
  const modal = document.getElementById('quotationManageApproveConfirmModal');
  console.log('📌 HTML ID: quotationManageApproveConfirmModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ 모달 닫기 완료');
  }
  console.log('===== 함수 종료: closeQuotationManageApproveConfirmModal() =====');
}

// ✅ 견적 승인 확인
async function confirmQuotationManageApprove() {
  console.log('===== 함수 호출: confirmQuotationManageApprove() =====');

  const modal = document.getElementById('quotationManageApproveConfirmModal');
  console.log('📌 HTML ID: quotationManageApproveConfirmModal');

  const quotationDate = modal.dataset.quotationDate;
  const quotationNo = modal.dataset.quotationNo;
  console.log(`📋 승인할 견적: ${quotationDate}-${quotationNo}`);

  try {
    console.log('📡 API 호출 시작: PUT /api/quotations/' + quotationDate + '/' + quotationNo + '/approve');
    const response = await fetch(`/api/quotations/${quotationDate}/${quotationNo}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('API 응답 상태:', response.status);
    const result = await response.json();
    console.log('API 응답 결과:', result);

    if (result.success) {
      console.log('✅ 견적 승인 성공');
      alert('✅ 견적이 승인되었습니다.');
      closeQuotationManageApproveConfirmModal();

      // DataTable 새로고침
      if (window.quotationManageTableInstance) {
        console.log('✅ DataTable 새로고침 시작');
        window.quotationManageTableInstance.ajax.reload();
      }
    } else {
      throw new Error(result.message || '견적 승인 실패');
    }
  } catch (err) {
    console.error('❌ 견적 승인 오류:', err);
    alert('견적 승인 중 오류가 발생했습니다: ' + err.message);
  }

  console.log('===== 함수 종료: confirmQuotationManageApprove() =====');
}

// ==================== 견적서 작성 모달 ====================

// 견적서 작성용 상세내역 배열
let newQuotationDetails = [];

// ✅ 견적서 작성 모달 열기
function openQuotationManageCreateModal() {
  console.log('===== 견적서 작성 모달 열기 =====');
  console.log('모달 ID: quotationManageCreateModal');

  // 모달 제목 설정
  document.getElementById('quotationManageCreateModalTitle').textContent = '견적서 작성';
  console.log('✅ 모달 제목 설정 완료');

  // 폼 초기화
  document.getElementById('quotationManageCreateForm').reset();
  console.log('✅ 폼 초기화 완료');

  // 매출처 정보 초기화
  document.getElementById('quotationManageCreateCustomerCode').value = '';
  document.getElementById('quotationManageCreateCustomerName').value = '';
  const infoDiv = document.getElementById('quotationManageCreateCustomerInfo');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }
  console.log('✅ 매출처 정보 초기화 완료');

  // 견적일자를 오늘 날짜로 설정
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('quotationManageCreateDate').value = today;
  console.log('✅ 견적일자 설정:', today);

  // 상세내역 초기화
  newQuotationDetails = [];
  renderNewQuotationDetailTable();
  console.log('✅ 상세내역 초기화 완료');

  // 모달 표시
  const modal = document.getElementById('quotationManageCreateModal');
  modal.style.display = 'block';
  modal.style.position = 'fixed';
  console.log('✅ 모달 표시 완료');
  console.log('모달 display:', modal.style.display);
  console.log('모달 position:', modal.style.position);

  // ✅ 드래그 기능 활성화 (최초 1회만 실행)
  const modalContent = document.getElementById('quotationModalContent');
  if (!window.quotationManageCreateModalDraggable) {
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
      makeModalDraggable('quotationManageCreateModal', 'quotationModalHeader');
      window.quotationManageCreateModalDraggable = true;
    } else {
      console.error('❌ makeModalDraggable 함수를 찾을 수 없습니다. modal-draggable.js가 로드되었는지 확인하세요.');
    }
  }
}

// ✅ 견적서 작성 모달 닫기
function closeQuotationManageCreateModal() {
  console.log('===== 견적서 작성 모달 닫기 =====');
  console.log('모달 ID: quotationManageCreateModal');

  document.getElementById('quotationManageCreateModal').style.display = 'none';
  console.log('✅ 모달 숨김 완료');

  // 견적 체크박스만 초기화
  $('#quotationManageSelectAll').prop('checked', false);
  $('.quotationRowCheck').prop('checked', false);
  console.log('✅ 체크박스 초기화 완료');

  // 버튼 상태도 초기화
  $('.quotationRowCheck').each(function () {
    const quotationDate = $(this).data('date');
    const quotationNo = $(this).data('no');
    const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

    actionDiv.find('.quotationBtnView').show();
    actionDiv.find('.quotationBtnEdit').hide();
    actionDiv.find('.quotationBtnDelete').hide();
    actionDiv.find('.quotationBtnApprove').hide(); // ✅ 승인 버튼도 숨김
  });
  console.log('✅ 버튼 상태 초기화 완료');

  newQuotationDetails = [];
  console.log('✅ 상세내역 배열 초기화 완료');
}

// ✅ 견적서 작성용 매출처 검색 모달 열기 (공통 모달 1개 사용)
function openQuotationManageCreateCustomerSearchModal() {
  console.log('===== 견적서 작성용 매출처 검색 모달 열기 =====');

  // 견적 입력값을 공통 검색창에 전달
  const searchValue = document.getElementById('quotationManageCreateCustomerName').value.trim();
  console.log('검색어:', searchValue);

  // [핵심] customer.js의 공통 모달 열기 사용
  // callerContext = 'quotation' (선택 결과를 견적에 주입하기 위한 컨텍스트)
  // initialSearchValue = searchValue (매출처명 입력란의 값을 검색어로 전달)
  if (typeof window.openCustomerSearchModal === 'function') {
    console.log('✅ 공통 매출처 검색 모달 호출 (callerContext: quotation)');
    window.openCustomerSearchModal('quotation', searchValue);
  } else {
    console.error('❌ window.openCustomerSearchModal 함수를 찾을 수 없습니다');
  }

  // 값이 있으면 자동검색 (모달이 열린 후 실행되도록 setTimeout 사용)
  if (searchValue) {
    console.log('✅ 자동 검색 예약 (100ms 후)');
    setTimeout(() => {
      if (typeof window.searchCustomersForModal === 'function') {
        console.log('✅ 공통 검색 함수 호출: searchCustomersForModal()');
        window.searchCustomersForModal();
      } else {
        console.log('✅ 대체 검색 함수 호출: searchQuotationCustomers()');
        searchQuotationCustomers();
      }
    }, 100);
  }
}

// ✅ 전역으로 노출 (HTML에서 호출할 수 있도록)
window.openQuotationManageCreateCustomerSearchModal = openQuotationManageCreateCustomerSearchModal;
// ❌ 절대 두지 마세요: 공통 openCustomerSearchModal을 덮어씀 (충돌 원인)
// window.openCustomerSearchModal = openQuotationCustomerSearchModal;

// ✅ 견적서용 매출처 검색
// @deprecated - customer.js의 공통 모달 검색 사용 (searchCustomersForModal)
// customer.js가 이미 별칭 제공: window.searchQuotationCustomers = window.searchCustomersForModal
// 이 함수는 하위 호환성을 위해서만 유지됨
async function searchQuotationCustomers() {
  // customer.js의 공통 검색 함수 사용
  if (typeof window.searchCustomersForModal === 'function') {
    return window.searchCustomersForModal();
  }

  console.error('❌ searchCustomersForModal 함수를 찾을 수 없습니다. customer.js가 로드되었는지 확인하세요.');
}

// ✅ 전역으로 노출 (하위 호환성)
// 참고: customer.js가 이미 별칭 제공 - window.searchQuotationCustomers = window.searchCustomersForModal
window.searchQuotationCustomers = searchQuotationCustomers;

// ==================== 품목 선택 처리 ====================

/**
 * 품목 검색 모달 열기 (견적서 작성용)
 * @description HTML에서 호출하는 견적 전용 함수 (material.js의 공용 모달 사용)
 */
window.openQuotationMaterialSearch = function() {
  // material.js의 공용 모달 열기 (context: 'quotation')
  if (typeof window.openMaterialSearchModal === 'function') {
    window.openMaterialSearchModal('quotation', '');
  } else {
    console.error('❌ material.js의 openMaterialSearchModal 함수를 찾을 수 없습니다.');
  }
};

// ✅ [견적관리 - 신규] 품목 선택 처리 함수 (material.js에서 호출)
window.selectQuotationMaterial = function(material) {
  console.log('✅ 견적관리 품목 선택:', material);

  // 자재코드 생성
  const 자재코드 = (material.분류코드 || '') + (material.세부코드 || '');

  // newQuotationDetails 배열에 추가
  newQuotationDetails.push({
    자재코드: 자재코드,
    자재명: material.자재명,
    규격: material.규격 || '',
    수량: 1,
    단가: material.출고단가1 || 0,
  });

  // 테이블 렌더링
  renderNewQuotationDetailTable();

  // 모달 닫기
  if (typeof window.closeMaterialSearchModal === 'function') {
    window.closeMaterialSearchModal();
  }
};

// ✅ [견적관리 - 수정] 품목 선택 처리 함수 (material.js에서 호출)
window.selectQuotationEditMaterial = function(material) {
  console.log('✅ 견적 수정 품목 선택:', material);

  // material.js에서 전달받은 데이터를 quotationMaterialAddModal 형식에 맞게 변환
  const materialForModal = {
    품목코드: material.품목코드 || ((material.분류코드 || '') + (material.세부코드 || '')),
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
  openQuotationMaterialAddModal(materialForModal);
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
window.openQuotationMaterialAddModal = function(material) {
  const modal = document.getElementById('quotationMaterialAddModal');
  if (!modal) {
    console.error('❌ quotationMaterialAddModal 요소를 찾을 수 없습니다.');
    return;
  }

  // 모달 초기화
  document.getElementById('quotationMaterialAddName').value = '';
  document.getElementById('quotationMaterialAddQuantity').value = '1';
  document.getElementById('quotationMaterialAddPrice').value = '0';
  document.getElementById('quotationMaterialAddAmount').value = '0';
  document.getElementById('quotationMaterialAddSelectedInfo').style.display = 'none';
  selectedMaterialForAdd = null;

  // 미리 선택된 품목이 있으면 표시
  if (material) {
    selectedMaterialForAdd = material;
    document.getElementById('quotationMaterialAddName').value = material.품목명 || material.자재명 || '';
    document.getElementById('quotationMaterialAddPrice').value = material.판매단가 || material.출고단가 || material.출고단가1 || 0;
    document.getElementById('quotationMaterialAddSelectedName').textContent = material.품목명 || material.자재명 || '-';
    document.getElementById('quotationMaterialAddSelectedCode').textContent = material.품목코드 || '-';
    document.getElementById('quotationMaterialAddSelectedInfo').style.display = 'block';
    calculateQuotationMaterialAddAmount();
  }

  modal.style.display = 'block';
};

/**
 * 품목 추가 모달 닫기
 */
window.closeQuotationMaterialAddModal = function() {
  const modal = document.getElementById('quotationMaterialAddModal');
  if (modal) {
    modal.style.display = 'none';
  }
  selectedMaterialForAdd = null;
};

/**
 * 선택된 품목 정보 초기화
 */
window.clearQuotationMaterialAddSelected = function() {
  selectedMaterialForAdd = null;
  document.getElementById('quotationMaterialAddName').value = '';
  document.getElementById('quotationMaterialAddPrice').value = '0';
  document.getElementById('quotationMaterialAddSelectedInfo').style.display = 'none';
  calculateQuotationMaterialAddAmount();
};

/**
 * 금액 자동계산
 */
window.calculateQuotationMaterialAddAmount = function() {
  const quantity = parseFloat(document.getElementById('quotationMaterialAddQuantity').value) || 0;
  const price = parseFloat(document.getElementById('quotationMaterialAddPrice').value) || 0;
  const amount = Math.round(quantity * price);
  document.getElementById('quotationMaterialAddAmount').value = amount.toLocaleString();
};

/**
 * 품목 추가 확정 (직접 입력 또는 검색 선택 모두 지원)
 */
window.confirmQuotationMaterialAdd = function() {
  const materialName = document.getElementById('quotationMaterialAddName').value.trim();
  const quantity = parseFloat(document.getElementById('quotationMaterialAddQuantity').value);
  const price = parseFloat(document.getElementById('quotationMaterialAddPrice').value);

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

  // newQuotationDetails 배열에 추가
  newQuotationDetails.push({
    자재코드: 자재코드,
    자재명: materialName,
    규격: 규격,
    수량: quantity,
    단가: price,
  });

  // 테이블 렌더링
  renderNewQuotationDetailTable();

  // 모달 닫기
  closeQuotationMaterialAddModal();
};

/**
 * 이전 단가 조회 (향후 구현)
 */
window.showQuotationMaterialPriceHistory = function() {
  if (!selectedMaterialForAdd) {
    alert('품목을 먼저 선택해주세요.');
    return;
  }
  alert('이전 단가 조회 기능은 향후 구현 예정입니다.');
};

/**
 * 품목 검색 모달에서 품목 선택 시 호출되는 함수
 * @description material.js에서 context='quotation_material_add'로 호출
 */
window.selectQuotationMaterialAdd = function(material) {
  console.log('✅ 품목 추가 모달용 품목 선택:', material);

  // material.js에서 전달받은 데이터를 저장
  selectedMaterialForAdd = {
    품목코드: material.품목코드 || ((material.분류코드 || '') + (material.세부코드 || '')),
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
  if (selectedNameEl) selectedNameEl.textContent = selectedMaterialForAdd.품목명 + (selectedMaterialForAdd.규격 ? ` (${selectedMaterialForAdd.규격})` : '');
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
async function searchMaterialsForQuotation() {
  try {
    const searchText = document.getElementById('materialSearchInput2').value.trim();

    const response = await fetch(`/api/materials?search=${encodeURIComponent(searchText)}`);
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
          <button onclick='showPriceHistoryForNewQuotation(${JSON.stringify({
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
          <button onclick='selectMaterialForQuotation(${JSON.stringify({
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

    console.log(`✅ 자재 검색 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// 신규 견적서 작성용 임시 자재 정보 저장
let tempMaterialForNewQuotation = null;

// ✅ 신규 견적서 작성용 이전단가 조회
async function showPriceHistoryForNewQuotation(material) {
  try {
    // 매출처 코드 확인
    const 매출처코드 = document.getElementById('selectedCustomerCode').value;

    if (!매출처코드) {
      alert('먼저 매출처를 선택해주세요.');
      return;
    }

    // 임시 자재 정보 저장
    tempMaterialForNewQuotation = material;

    // 자재 정보 표시
    document.getElementById('priceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('priceHistoryMaterialCode').textContent = `[${material.자재코드}] ${
      material.규격 || ''
    }`;

    // 탭 초기화 (실제 출고가 탭으로 시작)
    currentPriceHistoryTab = 'actual';
    const tabActual = document.getElementById('tabActualPrice');
    const tabQuotation = document.getElementById('tabQuotationPrice');

    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabQuotation.style.background = 'transparent';
    tabQuotation.style.color = '#6b7280';
    tabQuotation.style.borderBottom = '3px solid transparent';

    // 실제 출고가 데이터 로드
    await loadActualPriceHistoryForNewQuotation(material.자재코드, 매출처코드);

    // 모달 표시
    document.getElementById('quotationManagePriceHistoryModal').style.display = 'block';
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 견적서용 실제 출고가 이력 로드
async function loadActualPriceHistoryForNewQuotation(자재코드, 매출처코드) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/price-history/${매출처코드}`,
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
          selectPriceFromHistoryForNewQuotation(item.출고단가);
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

    console.log(`✅ 실제 출고가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 실제 출고가 이력 조회 오류:', err);
    alert('실제 출고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 견적서용 이력에서 단가 선택
function selectPriceFromHistoryForNewQuotation(price) {
  closeQuotationManagePriceHistoryModal();

  if (!tempMaterialForNewQuotation) {
    alert('자재 정보를 찾을 수 없습니다.');
    return;
  }

  // 수량 입력
  const 수량 = prompt(`${tempMaterialForNewQuotation.자재명}\n수량을 입력하세요:`, '1');

  if (!수량 || isNaN(수량) || parseFloat(수량) <= 0) {
    alert('유효한 수량을 입력해주세요.');
    return;
  }

  // 선택한 단가로 자재 추가
  newQuotationDetails.push({
    자재코드: tempMaterialForNewQuotation.자재코드,
    자재명: tempMaterialForNewQuotation.자재명,
    규격: tempMaterialForNewQuotation.규격,
    수량: parseFloat(수량),
    단가: parseFloat(price),
  });

  renderNewQuotationDetailTable();
  tempMaterialForNewQuotation = null;

  console.log(`✅ 이전단가로 자재 추가: ${price}원`);
}

// ✅ 자재 선택 및 추가 (견적서 작성용)
// ✅ [견적관리] 자재 선택 (공통 - 모달 내 입력 필드 사용)
function selectMaterialForQuotation(material) {
  // 선택된 자재를 변수에 저장 (신규/수정 모두 호환)
  selectedMaterial = material;
  if (typeof newSelectedMaterial !== 'undefined') {
    newSelectedMaterial = material;
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

// ✅ 새 견적서 상세내역 테이블 렌더링
function renderNewQuotationDetailTable() {
  const tbody = document.getElementById('quotationManageCreateDetailTableBody');

  if (!tbody) {
    console.warn('⚠️ quotationManageCreateDetailTableBody 요소를 찾을 수 없습니다');
    return;
  }

  if (newQuotationDetails.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 40px; text-align: center; color: #999;">
          자재 추가 버튼을 클릭하여 견적 상세내역을 입력하세요
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

  newQuotationDetails.forEach((detail, index) => {
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
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${detail.단위 || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${detail.수량.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${detail.단가.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${공급가.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${부가세.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
          <button type="button" onclick="openQuotationManageDetailEditModal(${index})" style="
            padding: 4px 12px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 60px;
          ">수정</button>
          <button type="button" onclick="removeNewQuotationDetail(${index})" style="
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

// ✅ 상세내역 수정 모달 열기
function openQuotationManageDetailEditModal(index) {
  try {
    const detail = newQuotationDetails[index];

    if (!detail) {
      alert('항목을 찾을 수 없습니다.');
      return;
    }

    // 모달에 데이터 표시
    document.getElementById('editDetailCode').textContent = detail.자재코드 || '-';
    document.getElementById('editDetailName').textContent = detail.자재명 || '-';
    document.getElementById('editDetailSpec').textContent = detail.규격 || '-';
    document.getElementById('editDetailQuantity').value = detail.수량 || 0;
    document.getElementById('editDetailPrice').value = detail.단가 || 0;
    document.getElementById('editDetailAmount').value = (detail.수량 * detail.단가).toLocaleString();

    // 모달에 index 저장
    const modal = document.getElementById('quotationManageDetailEditModal');
    modal.dataset.editIndex = index;

    // 자동 계산 이벤트 리스너 추가
    const quantityInput = document.getElementById('editDetailQuantity');
    const priceInput = document.getElementById('editDetailPrice');
    const amountInput = document.getElementById('editDetailAmount');

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
function closeQuotationManageDetailEditModal() {
  document.getElementById('quotationManageDetailEditModal').style.display = 'none';
}

// ✅ 상세내역 수정 확인
function confirmQuotationManageDetailEdit() {
  try {
    const modal = document.getElementById('quotationManageDetailEditModal');
    const index = parseInt(modal.dataset.editIndex);

    if (isNaN(index) || index < 0 || index >= newQuotationDetails.length) {
      alert('유효하지 않은 항목입니다.');
      return;
    }

    // 입력값 가져오기
    const 수량 = parseFloat(document.getElementById('editDetailQuantity').value) || 0;
    const 단가 = parseFloat(document.getElementById('editDetailPrice').value) || 0;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 배열 데이터 업데이트
    newQuotationDetails[index].수량 = 수량;
    newQuotationDetails[index].단가 = 단가;
    newQuotationDetails[index].공급가액 = 수량 * 단가;

    // 테이블 다시 렌더링
    renderNewQuotationDetailTable();

    // 모달 닫기
    closeQuotationManageDetailEditModal();

    console.log(`✅ 상세내역 수정 완료: ${newQuotationDetails[index].자재명}`);
  } catch (err) {
    console.error('❌ 상세내역 수정 오류:', err);
    alert('상세내역 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 상세내역 삭제
function removeNewQuotationDetail(index) {
  if (confirm('이 항목을 삭제하시겠습니까?')) {
    newQuotationDetails.splice(index, 1);
    renderNewQuotationDetailTable();
  }
}

// ✅ 견적서 저장
async function submitQuotationManageCreate(event) {
  console.log('===== 견적서 등록 폼 제출 =====');
  event.preventDefault();

  try {
    // 입력값 가져오기
    const 견적일자 = document.getElementById('quotationManageCreateDate').value.replace(/-/g, '');
    const 출고희망일자 = document.getElementById('quotationManageCreateDeliveryDate').value.replace(/-/g, '') || '';
    const 매출처코드 = document.getElementById('quotationManageCreateCustomerCode').value;
    const 제목 = document.getElementById('quotationManageCreateTitle').value;
    const 적요 = document.getElementById('quotationManageCreateRemark').value;

    console.log('입력값:', { 견적일자, 출고희망일자, 매출처코드, 제목, 적요 });

    // 유효성 검사
    if (!매출처코드) {
      console.error('❌ 유효성 검사 실패: 매출처 미선택');
      alert('매출처를 선택해주세요.');
      return;
    }

    if (newQuotationDetails.length === 0) {
      console.error('❌ 유효성 검사 실패: 상세내역 없음');
      alert('견적 상세내역을 최소 1개 이상 추가해주세요.');
      return;
    }

    console.log('✅ 유효성 검사 통과');
    console.log('상세내역 개수:', newQuotationDetails.length);

    // API 호출 데이터 구성
    const quotationData = {
      master: {
        견적일자,
        출고희망일자,
        매출처코드,
        제목,
        적요,
        상태코드: 1, // 작성중
      },
      details: newQuotationDetails.map((detail) => ({
        자재코드: detail.자재코드,
        수량: detail.수량,
        출고단가: detail.단가, // '단가' 필드를 '출고단가'로 변환
      })),
    };

    console.log('API 요청 데이터:', JSON.stringify(quotationData, null, 2));

    // API 호출
    console.log('✅ API 호출 시작: POST /api/quotations_add');
    const response = await fetch('/api/quotations_add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify(quotationData),
    });

    console.log('API 응답 상태:', response.status);
    const result = await response.json();
    console.log('API 응답 결과:', result);

    if (!result.success) {
      throw new Error(result.message || '견적서 저장 실패');
    }

    alert('견적서가 성공적으로 저장되었습니다.');
    closeQuotationManageCreateModal();

    // 견적 목록 새로고침 (DataTable reload)
    if ($.fn.DataTable.isDataTable('#quotationManageTable')) {
      $('#quotationManageTable').DataTable().ajax.reload();
    }
  } catch (err) {
    console.error('❌ 견적서 저장 오류:', err);
    alert('견적서 저장 중 오류가 발생했습니다: ' + err.message);
  }
}

// ==================== 모달 드래그 기능 ====================
// makeModalDraggable 함수는 js/modal-draggable.js에서 전역으로 로드됨

// ==================== 신규 견적서용 품목 추가 모달 ====================

let newSelectedMaterial = null;

// ❌ [중복 삭제됨] openMaterialSearchModal() - 위의 공통 함수(라인 1887) 사용
// 이전에는 newQuotationMaterialModal을 사용했으나, 이제 quotationDetailAddModal 1개로 통합

// 모달 닫기
function closeNewQuotationMaterialModal() {
  document.getElementById('newQuotationMaterialModal').style.display = 'none';
  // 견적서 작성 모달은 그대로 유지되므로 별도 처리 불필요
}

// 자재 검색
async function searchNewMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCategory = document.getElementById('newMaterialSearchCategory').value.trim();
    const searchCode = document.getElementById('newMaterialSearchCode').value.trim();
    const searchName = document.getElementById('newMaterialSearchName').value.trim();

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCategory && !searchCode && !searchName) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 신규 견적 자재 검색:', {
      분류코드: searchCategory,
      자재코드: searchCode,
      자재명: searchName,
    });

    // 검색 조건을 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    if (searchCategory) params.append('searchCategory', searchCategory);
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);

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
    console.log(`✅ 자재 검색 완료: ${filteredMaterials.length}건`);
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
  console.log('✅ 신규 견적 자재 검색 초기화');
}

// 자재 선택
function selectNewMaterial(material) {
  newSelectedMaterial = material;

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
  newSelectedMaterial = null;
  document.getElementById('newSelectedMaterialInfo').style.display = 'none';
  document.getElementById('newMaterialSearchCode').value = '';
  document.getElementById('newMaterialSearchName').value = '';
  document.getElementById('newMaterialSearchSpec').value = '';
}


// 자재 추가 확인
function confirmNewQuotationMaterialAdd() {
  try {
    if (!newSelectedMaterial) {
      alert('자재를 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 = newSelectedMaterial.분류코드 + newSelectedMaterial.세부코드;
    const 수량 = parseFloat(document.getElementById('newDetailQuantity').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('newDetailPrice').value) || 0;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // newQuotationDetails 배열에 추가
    newQuotationDetails.push({
      자재코드: 자재코드,
      자재명: newSelectedMaterial.자재명,
      규격: newSelectedMaterial.규격,
      수량: 수량,
      단가: 출고단가,
    });

    // 테이블 렌더링
    renderNewQuotationDetailTable();

    // 모달 닫기 (견적서 작성 모달은 그대로 유지)
    closeNewQuotationMaterialModal();
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
// 신규 견적서 단가 이력 조회
// ========================================

// ✅ 신규 견적서 단가 이력 모달 열기 (기존 quotationManagePriceHistoryModal 재사용)
async function showNewPriceHistory() {
  try {
    // 자재가 선택되었는지 확인
    if (!newSelectedMaterial) {
      alert('먼저 자재를 검색하여 선택해주세요.');
      return;
    }

    const 매출처코드 = document.getElementById('selectedCustomerCode').value;
    if (!매출처코드) {
      alert('매출처를 먼저 선택해주세요.');
      return;
    }

    // 기존 단가 이력 모달 재사용 - selectedMaterial 설정
    selectedMaterial = newSelectedMaterial;
    isNewQuotationMode = true;

    // 단가 이력 모달의 z-index를 더 높게 설정 (신규 견적서 모달 위에 표시)
    const quotationManagePriceHistoryModal = document.getElementById('quotationManagePriceHistoryModal');
    if (quotationManagePriceHistoryModal) {
      quotationManagePriceHistoryModal.style.zIndex = '10000';
    }

    // 기존 showPriceHistory 함수 호출 (공통 모달 사용)
    await showPriceHistory();
  } catch (err) {
    console.error('❌ 단가 이력 조회 오류:', err);
    alert('단가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 견적서 단가 이력 탭 전환
async function switchNewPriceHistoryTab(tab) {
  currentNewPriceHistoryTab = tab;

  // 탭 버튼 스타일 변경
  const tabActual = document.getElementById('newTabActualPrice');
  const tabQuotation = document.getElementById('newTabQuotationPrice');

  if (tab === 'actual') {
    // 실제 출고가 탭 활성화
    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabQuotation.style.background = 'transparent';
    tabQuotation.style.color = '#6b7280';
    tabQuotation.style.borderBottom = '3px solid transparent';

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
  } else if (tab === 'quotation') {
    // 견적 제안가 탭 활성화
    tabQuotation.style.background = '#3b82f6';
    tabQuotation.style.color = 'white';
    tabQuotation.style.borderBottom = '3px solid #3b82f6';

    tabActual.style.background = 'transparent';
    tabActual.style.color = '#6b7280';
    tabActual.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('newPriceHistoryLabel').textContent =
      '이 거래처에 제안한 견적 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('newPriceHistoryTableHead').innerHTML = `
      <tr>
        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 13px;">견적일자</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">출고단가</th>
        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 13px;">수량</th>
        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb; font-size: 13px;">상태</th>
      </tr>
    `;

    // 견적 제안가 데이터 로드
    await loadNewQuotationPriceHistory();
  }
}

// ✅ 신규 견적서 실제 출고 이력 로드
async function loadNewActualPriceHistory() {
  try {
    if (!newSelectedMaterial) return;

    const 자재코드 = newSelectedMaterial.분류코드 + newSelectedMaterial.세부코드;
    const 매출처코드 = document.getElementById('selectedCustomerCode').value;

    if (!매출처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/price-history/${매출처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('newPriceHistoryTableBody');

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
          selectNewPriceFromHistory(item.출고단가);
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

    console.log(`✅ 신규 견적서 실제 출고가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 실제 출고가 이력 조회 오류:', err);
    alert('실제 출고가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 견적서 견적 제안가 이력 로드
async function loadNewQuotationPriceHistory() {
  try {
    if (!newSelectedMaterial) return;

    const 자재코드 = newSelectedMaterial.분류코드 + newSelectedMaterial.세부코드;
    const 매출처코드 = document.getElementById('selectedCustomerCode').value;

    if (!매출처코드) return;

    const response = await fetch(
      `/api/materials/${encodeURIComponent(자재코드)}/quotation-history/${매출처코드}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이력 조회 실패');
    }

    const tbody = document.getElementById('newPriceHistoryTableBody');

    if (result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #9ca3af;">
            이 거래처에 제안한 견적 이력이 없습니다
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

        const 견적일자 = item.견적일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const 상태 = item.상태코드 === 1 ? '작성중' : item.상태코드 === 2 ? '승인' : '반려';
        const 상태색 =
          item.상태코드 === 1 ? '#f59e0b' : item.상태코드 === 2 ? '#10b981' : '#ef4444';

        tr.innerHTML = `
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${견적일자}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #2563eb;">
            ${(item.출고단가 || 0).toLocaleString()}원
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

    console.log(`✅ 신규 견적서 견적 제안가 이력 조회 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 견적 제안가 이력 조회 오류:', err);
    alert('견적 제안가 이력을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 신규 견적서 이력에서 단가 선택
function selectNewPriceFromHistory(price) {
  document.getElementById('newDetailPrice').value = price;

  // 금액 자동 재계산
  const 수량 = parseFloat(document.getElementById('newDetailQuantity').value) || 0;
  const 금액 = 수량 * price;
  document.getElementById('newDetailAmount').value = 금액.toLocaleString();

  // 모달 닫기
  closeNewPriceHistoryModal();

  console.log(`✅ 신규 견적서 단가 선택: ${price}원`);
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

// 견적 필터링 함수 (상태, 시작일, 종료일 기준으로 데이터 재조회)
function filterQuotations() {
  if (quotationManageTable) {
    quotationManageTable.ajax.reload();
  } else {
    console.warn('⚠️ quotationManageTable이 초기화되지 않았습니다.');
  }
}

/**
 * 견적서 출력 함수
 * @param {string} quotationDate - 견적일자 (YYYYMMDD)
 * @param {number} quotationNo - 견적번호
 */
async function printQuotation(quotationDate, quotationNo, mode = 1) {
  try {
    console.log('📄 견적서 출력 시작:', { 견적일자: quotationDate, 견적번호: quotationNo, mode });

    // 새로운 인쇄 전용 API 호출
    const response = await fetch(
      `/api/quotations/${quotationDate}/${quotationNo}/print?mode=${mode}`,
    );
    const result = await response.json();

    if (!result.success || !result.data) {
      alert('견적 정보를 불러올 수 없습니다.');
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
        <title>견적서 - ${header.견적일자}-${header.견적번호}</title>
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

          /* 견적금액 표시 행 */
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
              <div class="info-box-title">고객 정보</div>
              ...
            </div>
          </div>
          -->

          <!-- 견적 정보 (공급자 위치로 이동) -->
          <div class="quotation-info">
            <div class="quotation-info-row">
              <span class="info-label">견적번호:</span>
              <span class="info-value">${header.견적일자}-${header.견적번호}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">견적일자:</span>
              <span class="info-value">${formatDate(header.견적일자)}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">수신:</span>
              <span class="info-value">${header.매출처명}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">담당자:</span>
              <span class="info-value">${header.매출처담당자}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">전화번호:</span>
              <span class="info-value">${header.매출처전화}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">팩스번호:</span>
              <span class="info-value">${header.매출처팩스}</span>
            </div>
            <div class="quotation-info-row">
              <span class="info-label">출고희망일:</span>
              <span class="info-value">${formatDate(header.출고희망일자)}</span>
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
              <span class="info-label">견적금액:</span>
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
            · 본 견적서는 ${formatDate(header.견적일자)}부터 ${header.유효일수}일간 유효합니다.<br>
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
  } catch (error) {
    console.error('❌ 견적서 출력 실패:', error);
    alert('견적서 출력 중 오류가 발생했습니다.');
  }
}

/**
 * 상세 모달에서 출력 버튼 클릭 시 호출되는 래퍼 함수
 */
function printQuotationFromDetail() {
  if (!window.currentQuotationDetail) {
    alert('출력할 견적 정보가 없습니다.');
    return;
  }

  const { 견적일자, 견적번호 } = window.currentQuotationDetail;
  printQuotation(견적일자, 견적번호);
}

// 전역 함수 노출
window.editQuotationManage = editQuotationManage;
window.deleteQuotationManage = deleteQuotationManage;
window.closeQuotationManageDeleteConfirmModal = closeQuotationManageDeleteConfirmModal;
window.confirmQuotationManageDelete = confirmQuotationManageDelete;
window.approveQuotationManage = approveQuotationManage;
window.closeQuotationManageApproveConfirmModal = closeQuotationManageApproveConfirmModal;
window.confirmQuotationManageApprove = confirmQuotationManageApprove;
window.makeModalDraggable = makeModalDraggable;
window.filterQuotations = filterQuotations;
window.printQuotation = printQuotation;
window.printQuotationFromDetail = printQuotationFromDetail;
window.closeQuotationManageViewModal = closeQuotationManageViewModal;
window.searchNewMaterials = searchNewMaterials;
window.clearNewMaterialSearch = clearNewMaterialSearch;
window.searchAddDetailMaterials = searchAddDetailMaterials;
window.clearAddDetailMaterialSearch = clearAddDetailMaterialSearch;
window.closeQuotationManagePriceHistoryModal = closeQuotationManagePriceHistoryModal;
window.switchQuotationManagePriceHistoryTab = switchQuotationManagePriceHistoryTab;
window.showQuotationManageDetailPriceHistory = showQuotationManageDetailPriceHistory;

/**
 * 견적 데이터를 CSV로 내보내기 (Google Sheets 가져오기용)
 * DataTable 기반으로 전체 데이터 또는 현재 표시된 데이터 내보내기
 */
function exportQuotationsToExcel() {
  try {
    console.log('===== 견적 Google Sheets 내보내기 시작 =====');

    if (!quotationManageTable) {
      alert('견적 테이블이 초기화되지 않았습니다.');
      return;
    }

    // DataTable에서 현재 표시된 데이터 가져오기
    const dataToExport = quotationManageTable.rows({ search: 'applied' }).data().toArray();

    if (dataToExport.length === 0) {
      alert('내보낼 견적 데이터가 없습니다.');
      return;
    }

    console.log(`✅ 내보낼 데이터 수: ${dataToExport.length}건`);

    // CSV 헤더
    const headers = [
      '견적번호',
      '매출처명',
      '견적일자',
      '제목',
      '견적금액',
      '담당자',
      '상태',
    ];

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
        formattedDate = `${formattedDate.substring(0, 4)}-${formattedDate.substring(4, 6)}-${formattedDate.substring(6, 8)}`;
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

    console.log('✅ CSV 파일 다운로드 완료:', fileName);
    alert(
      `${dataToExport.length}개의 견적 정보가 CSV로 내보내졌습니다.\n\n📊 Google Sheets에서 불러오려면:\n1. sheets.google.com 접속\n2. 파일 > 가져오기 > 업로드\n3. 다운로드된 CSV 파일 선택`,
    );
  } catch (error) {
    console.error('❌ 견적 Google Sheets 내보내기 오류:', error);
    alert('내보내기 중 오류가 발생했습니다: ' + error.message);
  }
}

window.exportQuotationsToExcel = exportQuotationsToExcel;
