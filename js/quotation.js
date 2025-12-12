/**
 * 견적관리 DataTable 초기화 및 관리
 */

// 전역 변수로 DataTable 인스턴스 저장
let quotationTable = null;

// ==================== 전역 함수 정의 (최상단) ====================
// 견적서용 매출처 선택 함수 - 고유한 이름 사용 (taxinvoice.js와 충돌 방지)
window.selectQuotationCustomer = function selectQuotationCustomer(customer) {
  try {
    // 매출처 코드와 이름 설정
    const codeInput = document.getElementById('selectedCustomerCode');
    const nameInput = document.getElementById('selectedCustomerName');

    if (!codeInput || !nameInput) {
      console.error('❌ 입력 필드를 찾을 수 없습니다!');
      alert('입력 필드를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    codeInput.value = customer.매출처코드;
    nameInput.value = customer.매출처명;

    // 선택된 매출처 정보 표시
    const infoDiv = document.getElementById('selectedCustomerInfo');
    const displaySpan = document.getElementById('selectedCustomerDisplay');

    if (infoDiv && displaySpan) {
      displaySpan.textContent = `[${customer.매출처코드}] ${customer.매출처명}`;
      infoDiv.style.display = 'block';
    }

    // 모달 닫기
    window.closeQuotationCustomerSearchModal();
  } catch (err) {
    console.error('❌ selectQuotationCustomer 에러:', err);
    alert('매출처 선택 중 오류가 발생했습니다: ' + err.message);
  }
};

// 견적서 작성용 매출처 검색 모달 닫기 함수
window.closeQuotationCustomerSearchModal = function closeQuotationCustomerSearchModal() {
  const modal = document.getElementById('quotationCustomerSearchModal');
  if (modal) {
    modal.style.display = 'none';
  }
};
// ==================================================================

$(document).ready(function () {
  // 견적서 작성 모달 드래그 기능
  makeModalDraggable('quotationModalContent', 'quotationModalHeader');
  // 견적서 수정 모달 드래그 기능
  makeModalDraggable('quotationEditModalContent', 'quotationEditModalHeader');
  // 견적 상세 보기 모달 드래그 기능
  makeModalDraggable('quotationDetailModalContent', 'quotationDetailModalHeader');

  // ✅ 상세 버튼 모달 닫기 함수
  // function closeQuotationDetailModal() {
  //   const modal = document.getElementById('quotationDetailModal');
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
  // window.closeQuotationDetailModal = closeQuotationDetailModal;

  // ✅ 상세 보기 모달 닫기 버튼
  $('#closeQuotationDetailModal').on('click', () => {
    closeQuotationDetailModal();
  });

  // ✅ 상세보기 모달 배경 클릭시 닫기
  $(document).on('click', '#quotationDetailModal', function (e) {
    if (e.target.id === 'quotationDetailModal') {
      closeQuotationDetailModal();
    }
  });

  // ✅ 수정 모달 닫기 버튼
  $('#closeQuotationEditModalBtn').on('click', () => {
    closeQuotationEditModal();
  });

  // ✅ 수정 모달 배경 클릭시 닫기
  $(document).on('click', '#quotationEditModal', function (e) {
    if (e.target.id === 'quotationEditModal') {
      closeQuotationEditModal();
    }
  });

  // ✅ 품목 추가 모달 닫기 버튼
  $('#closeQuotationDetailAddModal').on('click', () => {
    closeQuotationDetailAddModal();
  });

  // ✅ 품목 수정 모달 닫기 버튼
  $('#closeQuotationDetailEditModal').on('click', () => {
    closeQuotationDetailEditModal();
  });

  // ✅ 단가 이력 모달 닫기 버튼
  $('#closePriceHistoryModal').on('click', () => {
    closePriceHistoryModal();
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
    $(document).off('change.transactionPage');
    $(document).off('change.purchasePage');

    // 페이지가 표시될 때마다 날짜를 오늘 날짜(로그인 날짜)로 초기화
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const startDateInput = document.getElementById('quotationStartDate');
    const endDateInput = document.getElementById('quotationEndDate');

    // 항상 오늘 날짜로 설정
    if (startDateInput) {
      startDateInput.value = todayStr;
    }
    if (endDateInput) {
      endDateInput.value = todayStr;
    }

    // 이미 DataTable이 존재하면 파괴
    if (quotationTable) {
      quotationTable.destroy();
      quotationTable = null;
    }

    // DataTable 초기화
    quotationTable = $('#quotationTable').DataTable({
      ajax: {
        url: '/api/quotations',
        data: function (d) {
          // 필터링 파라미터 추가
          const 사업장코드 = currentUser?.사업장코드 || '01';
          const 상태코드 = $('#quotationStatusFilter').val();
          const startDate = $('#quotationStartDate').val()?.replace(/-/g, '') || '';
          const endDate = $('#quotationEndDate').val()?.replace(/-/g, '') || '';

          return {
            사업장코드: 사업장코드,
            상태코드: 상태코드,
            startDate: startDate,
            endDate: endDate,
          };
        },
        dataSrc: function (json) {
          // 견적 건수 업데이트
          const countEl = document.getElementById('quotationCount');
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
          className: 'dt-center',
          /* render: function (data, type, row, meta) {
            const table = $('#quotationTable').DataTable();
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
              1: { text: '작성중', class: 'status-pending' },
              2: { text: '승인', class: 'status-active' },
              3: { text: '반려', class: 'status-inactive' },
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
            const quotationKey = `${row.견적일자}-${row.견적번호}`;
            return `
              <div class="action-buttons" id="quotationActions-${quotationKey.replace('-', '_')}">
                <button class="btn-icon btn-view" onclick="viewQuotationDetail('${row.견적일자}', ${
              row.견적번호
            })" title="상세보기">상세</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editQuotation('${
                  row.견적일자
                }', ${row.견적번호})" title="수정">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="deleteQuotation('${
                  row.견적일자
                }', ${row.견적번호})" title="삭제">삭제</button>
                ${
                  row.상태코드 === 1
                    ? `<button class="btn-icon btn-approve" style="display: none; background: #28a745;" onclick="approveQuotation('${row.견적일자}', ${row.견적번호})" title="승인">승인</button>`
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
        // 전체선택 체크박스 상태 확인
        const isSelectAllChecked = $('#quotationSelectAll').prop('checked');

        // 전체선택 상태에 따라 현재 페이지의 모든 체크박스 동기화
        $('.quotationRowCheck').prop('checked', isSelectAllChecked);

        // DataTable이 다시 그려질 때마다 체크박스 상태에 따라 버튼 표시
        $('.quotationRowCheck').each(function () {
          const $checkbox = $(this);
          const quotationDate = $checkbox.data('date');
          const quotationNo = $checkbox.data('no');
          const isChecked = $checkbox.prop('checked');
          const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

          if (isChecked) {
            actionDiv.find('.btn-view').hide();
            actionDiv.find('.btn-edit').show();
            actionDiv.find('.btn-delete').show();
            actionDiv.find('.btn-approve').show();
          } else {
            actionDiv.find('.btn-view').show();
            actionDiv.find('.btn-edit').hide();
            actionDiv.find('.btn-delete').hide();
            actionDiv.find('.btn-approve').hide();
          }
        });
      },
    });

    // ✅ 전체선택 체크박스 이벤트 핸들러 등록
    $(document).off('change', '#quotationSelectAll').on('change', '#quotationSelectAll', function () {
      const isChecked = $(this).prop('checked');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 [견적관리] 전체선택 체크박스 클릭');
      console.log(`✅ 체크 상태: ${isChecked ? '전체 선택' : '전체 해제'}`);

      $('.quotationRowCheck').prop('checked', isChecked).trigger('change');

      console.log('✅ 전체선택 처리 완료');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // ✅ 개별 체크박스 이벤트 핸들러 등록
    $(document).off('change', '.quotationRowCheck').on('change', '.quotationRowCheck', function () {
      const quotationDate = $(this).data('date');
      const quotationNo = $(this).data('no');
      const isChecked = $(this).prop('checked');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 [견적관리] 체크박스 이벤트 발생');
      console.log(`📅 견적일자: ${quotationDate}`);
      console.log(`🔢 견적번호: ${quotationNo}`);
      console.log(`✅ 체크 상태: ${isChecked ? '선택됨' : '해제됨'}`);

      // 전체 선택 체크박스 상태 업데이트
      const totalCheckboxes = $('.quotationRowCheck').length;
      const checkedCheckboxes = $('.quotationRowCheck:checked').length;
      $('#quotationSelectAll').prop('checked', totalCheckboxes === checkedCheckboxes);

      // 현재 행의 버튼 표시/숨김 처리
      const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

      if (isChecked) {
        // 체크됨: 상세 버튼 숨기고 수정/삭제/승인 버튼 표시
        actionDiv.find('.btn-view').hide();
        actionDiv.find('.btn-edit').show();
        actionDiv.find('.btn-delete').show();
        actionDiv.find('.btn-approve').show();

        console.log('🔘 표시된 버튼:');
        console.log('   ❌ [상세보기] 버튼 - 숨김');
        console.log('   ✅ [수정] 버튼 - 표시');
        console.log('   ✅ [삭제] 버튼 - 표시');
        console.log('   ✅ [승인] 버튼 - 표시');
      } else {
        // 체크 해제: 수정/삭제/승인 버튼 숨기고 상세 버튼 표시
        actionDiv.find('.btn-view').show();
        actionDiv.find('.btn-edit').hide();
        actionDiv.find('.btn-delete').hide();
        actionDiv.find('.btn-approve').hide();

        console.log('🔘 표시된 버튼:');
        console.log('   ✅ [상세보기] 버튼 - 표시');
        console.log('   ❌ [수정] 버튼 - 숨김');
        console.log('   ❌ [삭제] 버튼 - 숨김');
        console.log('   ❌ [승인] 버튼 - 숨김');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  }

  // 전역 변수로 저장
  window.loadQuotations = loadQuotations;
});

// ✅ 견적 상세 버튼 모달 열기 함수 (견적일자, 견적번호로 조회)
async function openQuotationDetailModal(quotationDate, quotationNo) {
  const modal = document.getElementById('quotationDetailModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'block';
  }

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.quotationDetailModalDraggable) {
    makeModalDraggable('quotationDetailModal', 'quotationDetailModalHeader');
    window.quotationDetailModalDraggable = true;
  }

  // ✅ 출력 버튼을 위해 현재 견적 정보 저장
  window.currentQuotationDetail = {
    견적일자: quotationDate,
    견적번호: quotationNo,
  };

  try {
    // 견적 마스터+상세 조회 (기존 API 사용)
    const masterRes = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`);
    const masterData = await masterRes.json();

    if (!masterData.success || !masterData.data) {
      throw new Error('견적 정보를 찾을 수 없습니다.');
    }

    const master = masterData.data.master;
    const details = masterData.data.detail;

    // 기본 정보 표시
    $('#q_no').text(`${master.견적일자}-${master.견적번호}`);
    $('#q_date').text(master.견적일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    $('#q_customer').text(master.매출처명 || '-');
    $('#q_remark').text(master.적요 || '-');

    // ✅ DataTable이 이미 초기화되어 있으면 destroy 후 재생성
    if (window.quotationDetailDataTable) {
      window.quotationDetailDataTable.destroy();
    }

    // ✅ DataTable 초기화
    window.quotationDetailDataTable = $('#quotationDetailTable').DataTable({
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
          data: '수량',
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
          data: '금액',
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

    console.log(`✅ 견적 상세 DataTable 초기화 완료 (${details ? details.length : 0}건)`);

    // ✅ 합계 금액 계산
    const totalAmount = (details || []).reduce((sum, item) => {
      return sum + (item.금액 || 0);
    }, 0);

    // 합계 표시
    $('#quotationDetailTotal').text(totalAmount.toLocaleString());
    console.log(`✅ 견적 합계 금액: ${totalAmount.toLocaleString()}원`);
  } catch (err) {
    console.error('❌ 견적 상세 조회 오류:', err);
    alert('견적 상세 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// 전역 함수로 노출
window.openQuotationDetailModal = openQuotationDetailModal;

// ✅ 상세 버튼 모달 닫기 함수
function closeQuotationDetailModal() {
  const modal = document.getElementById('quotationDetailModal');
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

    actionDiv.find('.btn-view').show();
    actionDiv.find('.btn-edit').hide();
    actionDiv.find('.btn-delete').hide();
  });

  // DataTable 정리 (메모리 누수 방지)
  if (window.quotationDetailDataTable) {
    window.quotationDetailDataTable.destroy();
    window.quotationDetailDataTable = null;
    $('#quotationDetailTable tbody').empty();
  }
}

// 필터링 함수
// function filterQuotations() {
//   if (window.quotationTableInstance) {
//     window.quotationTableInstance.ajax.reload();
//   }
// }

// ✅ 견적 상세보기 함수 (DataTable 버튼에서 호출)
function viewQuotationDetail(quotationDate, quotationNo) {
  console.log(`✅ 견적 상세보기 호출: ${quotationDate}-${quotationNo}`);

  // openQuotationDetailModal 함수 호출
  if (typeof window.openQuotationDetailModal === 'function') {
    window.openQuotationDetailModal(quotationDate, quotationNo);
  } else {
    console.error('❌ openQuotationDetailModal 함수를 찾을 수 없습니다.');
    alert('견적 상세보기 기능을 사용할 수 없습니다.');
  }
}

// 전역 함수로 노출
window.viewQuotationDetail = viewQuotationDetail;

// ✅ 견적 수정 함수 - 모달 열기 (견적내역 포함)
async function editQuotation(quotationDate, quotationNo) {
  console.log(`✅ 견적 수정: ${quotationDate}-${quotationNo}`);

  try {
    // 현재 견적 정보 조회 (마스터 + 상세)
    const response = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('견적 정보를 찾을 수 없습니다.');
    }

    const master = result.data.master;
    const details = result.data.detail || [];

    // 기본 정보 표시 (읽기 전용)
    document.getElementById('editQuotationNo').textContent = `${quotationDate}-${quotationNo}`;
    document.getElementById('editQuotationDate').textContent = quotationDate.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('editCustomerName').textContent = master.매출처명 || '-';

    // 출고희망일자 (YYYYMMDD -> YYYY-MM-DD)
    const deliveryDate = master.출고희망일자 || '';
    if (deliveryDate && deliveryDate.length === 8) {
      document.getElementById('editDeliveryDate').value = `${deliveryDate.substring(
        0,
        4,
      )}-${deliveryDate.substring(4, 6)}-${deliveryDate.substring(6, 8)}`;
    } else {
      document.getElementById('editDeliveryDate').value = '';
    }

    document.getElementById('editTitle').value = master.제목 || '';
    document.getElementById('editRemark').value = master.적요 || '';

    // 모달에 견적일자, 번호 저장 (submit 시 사용)
    const modal = document.getElementById('quotationEditModal');
    modal.dataset.quotationDate = quotationDate;
    modal.dataset.quotationNo = quotationNo;
    modal.dataset.매출처코드 = master.매출처코드;
    modal.dataset.결제방법 = master.결제방법 || 0;
    modal.dataset.결제예정일자 = master.결제예정일자 || '';
    modal.dataset.유효일수 = master.유효일수 || 0;

    // ✅ 견적내역 DataTable 초기화
    if (window.quotationEditDetailDataTable) {
      window.quotationEditDetailDataTable.destroy();
    }

    window.quotationEditDetailDataTable = $('#quotationEditDetailTable').DataTable({
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
          data: '단위',
          defaultContent: '-',
        },
        {
          data: '수량',
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
          data: '금액',
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
              <button class="btn-icon" onclick="editQuotationDetailRow(${meta.row})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">수정</button>
              <button class="btn-icon" onclick="deleteQuotationDetailRow(${meta.row})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
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

    // ✅ 합계 금액 계산
    const totalAmount = details.reduce((sum, item) => sum + (item.금액 || 0), 0);
    $('#quotationEditDetailTotal').text(totalAmount.toLocaleString());

    // ✅ 전체 선택 체크박스 이벤트
    $('#selectAllEditDetails')
      .off('change')
      .on('change', function () {
        const isChecked = $(this).prop('checked');
        $('.editDetailCheckbox').prop('checked', isChecked);
      });

    // 모달 표시
    modal.style.display = 'block';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.quotationEditModalDraggable) {
      makeModalDraggable('quotationEditModal', 'quotationEditModalHeader');
      window.quotationEditModalDraggable = true;
    }
  } catch (err) {
    console.error('❌ 견적 수정 모달 열기 오류:', err);
    alert('견적 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적 수정 모달 닫기
function closeQuotationEditModal() {
  const modal = document.getElementById('quotationEditModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // 체크박스 초기화
  $('.quotationRowCheck').prop('checked', false);
  // 버튼 상태도 초기화
  $('.quotationRowCheck').each(function () {
    const quotationDate = $(this).data('date');
    const quotationNo = $(this).data('no');
    const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

    actionDiv.find('.btn-view').show();
    actionDiv.find('.btn-edit').hide();
    actionDiv.find('.btn-delete').hide();
  });

  // DataTable 정리
  if (window.quotationEditDetailDataTable) {
    window.quotationEditDetailDataTable.destroy();
    window.quotationEditDetailDataTable = null;
    $('#quotationEditDetailTable tbody').empty();
  }
}

// ✅ 선택된 자재 정보 (전역 변수)
let selectedMaterial = null;

// ✅ 자재 추가 함수 - 모달 열기
function addQuotationDetailRow() {
  // 초기화
  selectedMaterial = null;
  document.getElementById('materialSearchCode').value = '';
  document.getElementById('materialSearchName').value = '';
  document.getElementById('materialSearchSpec').value = '';
  document.getElementById('materialSearchResults').style.display = 'none';
  document.getElementById('selectedMaterialInfo').style.display = 'none';
  document.getElementById('addDetailQuantity').value = '1';
  document.getElementById('addDetailPrice').value = '0';
  document.getElementById('addDetailAmount').value = '0';

  // 모달 표시
  document.getElementById('quotationDetailAddModal').style.display = 'block';
}

// ✅ 자재 검색 함수
async function searchMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCode = document.getElementById('materialSearchCode').value.trim();
    const searchName = document.getElementById('materialSearchName').value.trim();
    const searchSpec = document.getElementById('materialSearchSpec').value.trim();

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCode && !searchName && !searchSpec) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 견적 자재 검색:', {
      자재코드: searchCode,
      자재명: searchName,
      규격: searchSpec,
    });

    // 검색 조건을 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);
    if (searchSpec) params.append('searchSpec', searchSpec);

    const result = await apiCall(`/materials?${params.toString()}`);

    if (!result.success || !result.data) {
      throw new Error('자재 목록을 불러올 수 없습니다.');
    }

    const filteredMaterials = result.data;

    if (filteredMaterials.length === 0) {
      alert('검색 결과가 없습니다.');
      document.getElementById('materialSearchResults').style.display = 'none';
      return;
    }

    // 검색 결과 테이블에 표시
    const tbody = document.getElementById('materialSearchTableBody');
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
        selectMaterial(m);
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

    // 검색 결과 표시
    document.getElementById('materialSearchResults').style.display = 'block';

    console.log(`✅ 자재 검색 완료: ${filteredMaterials.length}건`);
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
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
  document.getElementById('selectedMaterialInfo').style.display = 'none';
  document.getElementById('materialSearchCode').value = '';
  document.getElementById('materialSearchName').value = '';
  document.getElementById('materialSearchSpec').value = '';
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
      const quotationEditModal = document.getElementById('quotationEditModal');
      매출처코드 = quotationEditModal.dataset.매출처코드;
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
    document.getElementById('priceHistoryModal').style.display = 'block';
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
  closePriceHistoryModal();

  console.log(`✅ 단가 선택: ${price}원`);
}

// ✅ 단가 이력 모달 닫기
function closePriceHistoryModal() {
  document.getElementById('priceHistoryModal').style.display = 'none';
}

// ✅ 단가 이력 탭 전환
let currentPriceHistoryTab = 'actual'; // 현재 활성화된 탭

async function switchPriceHistoryTab(tab) {
  currentPriceHistoryTab = tab;

  // 탭 버튼 스타일 변경
  const tabActual = document.getElementById('tabActualPrice');
  const tabQuotation = document.getElementById('tabQuotationPrice');

  if (tab === 'actual') {
    // 실제 출고가 탭 활성화
    tabActual.style.background = '#3b82f6';
    tabActual.style.color = 'white';
    tabActual.style.borderBottom = '3px solid #3b82f6';

    tabQuotation.style.background = 'transparent';
    tabQuotation.style.color = '#6b7280';
    tabQuotation.style.borderBottom = '3px solid transparent';

    // 레이블 변경
    document.getElementById('priceHistoryLabel').textContent =
      '이 거래처에 실제 출고한 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('priceHistoryTableHead').innerHTML = `
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
    document.getElementById('priceHistoryLabel').textContent =
      '이 거래처에 제안한 견적 이력 (클릭하여 단가 선택)';

    // 테이블 헤더 변경
    document.getElementById('priceHistoryTableHead').innerHTML = `
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
      const quotationEditModal = document.getElementById('quotationEditModal');
      매출처코드 = quotationEditModal.dataset.매출처코드;
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
      const quotationEditModal = document.getElementById('quotationEditModal');
      매출처코드 = quotationEditModal.dataset.매출처코드;
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

// ✅ 자재 추가 모달 닫기
function closeQuotationDetailAddModal() {
  document.getElementById('quotationDetailAddModal').style.display = 'none';

  // 견적서 작성 모달 다시 표시
  if (isNewQuotationMode) {
    const quotationModal = document.getElementById('quotationModal');
    quotationModal.style.display = quotationModal.dataset.previousDisplay || 'block';
    isNewQuotationMode = false;
  }
}

// ✅ 자재 추가 확인
function confirmQuotationDetailAdd() {
  try {
    // 선택된 자재 확인
    if (!selectedMaterial) {
      alert('자재를 검색하여 선택해주세요.');
      return;
    }

    const 자재코드 = selectedMaterial.분류코드 + selectedMaterial.세부코드;
    const 수량 = parseFloat(document.getElementById('addDetailQuantity').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('addDetailPrice').value) || 0;
    const 금액 = 수량 * 출고단가;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 신규 견적서 작성 모드인 경우
    if (isNewQuotationMode) {
      // newQuotationDetails 배열에 추가
      newQuotationDetails.push({
        자재코드: 자재코드,
        자재명: selectedMaterial.자재명,
        규격: selectedMaterial.규격,
        수량: 수량,
        단가: 출고단가,
      });

      // 테이블 렌더링
      renderNewQuotationDetailTable();

      // 견적서 작성 모달 다시 표시
      const quotationModal = document.getElementById('quotationModal');
      quotationModal.style.display = quotationModal.dataset.previousDisplay || 'block';

      // 모드 플래그 초기화
      isNewQuotationMode = false;
    } else {
      // 견적 수정 모드 - DataTable에 행 추가
      const newRow = {
        자재코드: 자재코드,
        자재명: selectedMaterial.자재명,
        규격: selectedMaterial.규격 || '-',
        수량: 수량,
        출고단가: 출고단가,
        금액: 금액,
        _isNew: true,
      };

      window.quotationEditDetailDataTable.row.add(newRow).draw();

      // 합계 재계산
      recalculateQuotationEditTotal();
    }

    // 모달 닫기
    closeQuotationDetailAddModal();
  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 수정 함수 - 모달 열기
function editQuotationDetailRow(rowIndex) {
  try {
    const table = window.quotationEditDetailDataTable;
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
    document.getElementById('editDetailPrice').value = rowData.출고단가 || 0;
    document.getElementById('editDetailAmount').value = (rowData.금액 || 0).toLocaleString();

    // 모달에 rowIndex 저장
    const modal = document.getElementById('quotationDetailEditModal');
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 수정 모달 열기 오류:', err);
    alert('품목 수정 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 수정 모달 닫기
function closeQuotationDetailEditModal() {
  document.getElementById('quotationDetailEditModal').style.display = 'none';
}

// ✅ 견적내역 품목 수정 확인
function confirmQuotationDetailEdit() {
  try {
    const modal = document.getElementById('quotationDetailEditModal');
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.quotationEditDetailDataTable;
    const rowData = table.row(rowIndex).data();

    // 입력값 가져오기
    const 수량 = parseFloat(document.getElementById('editDetailQuantity').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('editDetailPrice').value) || 0;
    const 금액 = 수량 * 출고단가;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 행 데이터 업데이트
    rowData.수량 = 수량;
    rowData.출고단가 = 출고단가;
    rowData.금액 = 금액;

    // DataTable 업데이트
    table.row(rowIndex).data(rowData).invalidate().draw(false);

    // 합계 재계산
    recalculateQuotationEditTotal();

    // 모달 닫기
    closeQuotationDetailEditModal();
  } catch (err) {
    console.error('❌ 품목 수정 오류:', err);
    alert('품목 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 삭제 함수 - 모달 열기
function deleteQuotationDetailRow(rowIndex) {
  try {
    const table = window.quotationEditDetailDataTable;
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
    const modal = document.getElementById('quotationDetailDeleteModal');
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 삭제 모달 열기 오류:', err);
    alert('품목 삭제 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적내역 품목 삭제 모달 닫기
function closeQuotationDetailDeleteModal() {
  document.getElementById('quotationDetailDeleteModal').style.display = 'none';
}

// ✅ 견적내역 품목 삭제 확인
function confirmQuotationDetailDelete() {
  try {
    const modal = document.getElementById('quotationDetailDeleteModal');
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.quotationEditDetailDataTable;

    // 행 삭제
    table.row(rowIndex).remove().draw();

    // 합계 재계산
    recalculateQuotationEditTotal();

    console.log(`✅ 품목 삭제 완료 (행 인덱스: ${rowIndex})`);

    // 모달 닫기
    closeQuotationDetailDeleteModal();
  } catch (err) {
    console.error('❌ 품목 삭제 오류:', err);
    alert('품목 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 선택된 견적내역 삭제 함수
function deleteSelectedQuotationDetails() {
  const checkedBoxes = $('.editDetailCheckbox:checked');

  if (checkedBoxes.length === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }

  if (!confirm(`선택한 ${checkedBoxes.length}개 항목을 삭제하시겠습니까?`)) {
    return;
  }

  // DataTable에서 선택된 행 제거
  const table = window.quotationEditDetailDataTable;
  checkedBoxes.each(function () {
    const row = table.row($(this).closest('tr'));
    row.remove();
  });

  table.draw();

  // 합계 재계산
  recalculateQuotationEditTotal();

  console.log(`✅ ${checkedBoxes.length}개 항목 삭제 완료`);
}

// ✅ 견적 수정 모달 합계 재계산
function recalculateQuotationEditTotal() {
  if (!window.quotationEditDetailDataTable) return;

  const data = window.quotationEditDetailDataTable.rows().data().toArray();
  const totalAmount = data.reduce((sum, item) => sum + (item.금액 || 0), 0);
  $('#quotationEditDetailTotal').text(totalAmount.toLocaleString());
}

// ✅ 견적 수정 제출 (마스터 + 상세)
async function submitQuotationEdit() {
  const modal = document.getElementById('quotationEditModal');
  const quotationDate = modal.dataset.quotationDate;
  const quotationNo = modal.dataset.quotationNo;

  try {
    // 1. 마스터 정보 업데이트
    const deliveryDateInput = document.getElementById('editDeliveryDate').value;
    const 출고희망일자 = deliveryDateInput ? deliveryDateInput.replace(/-/g, '') : '';

    const masterResponse = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify({
        매출처코드: modal.dataset.매출처코드,
        출고희망일자: 출고희망일자,
        결제방법: parseInt(modal.dataset.결제방법),
        결제예정일자: modal.dataset.결제예정일자,
        유효일수: parseInt(modal.dataset.유효일수),
        제목: document.getElementById('editTitle').value,
        적요: document.getElementById('editRemark').value,
      }),
    });

    const masterResult = await masterResponse.json();

    if (!masterResult.success) {
      throw new Error(masterResult.message || '견적 마스터 수정 실패');
    }

    // 2. 견적 상세 정보 업데이트
    const detailData = window.quotationEditDetailDataTable.rows().data().toArray();

    if (detailData.length > 0) {
      // 상세 정보를 서버 형식에 맞게 변환
      const detailPayload = detailData.map((item) => {
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

        return {
          자재코드: 자재코드.trim(),
          수량: parseFloat(item.수량) || 0,
          출고단가: parseFloat(item.출고단가) || 0,
          금액: parseFloat(item.금액) || 0,
        };
      });

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

      const detailResult = await detailResponse.json();

      if (!detailResult.success) {
        throw new Error(detailResult.message || '견적 상세 수정 실패');
      }
    }

    alert('✅ 견적이 성공적으로 수정되었습니다.');
    closeQuotationEditModal();

    // DataTable 새로고침
    if (window.quotationTableInstance) {
      window.quotationTableInstance.ajax.reload();
    }
  } catch (err) {
    console.error('❌ 견적 수정 오류:', err);
    alert('견적 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적 삭제 함수 - 모달 열기
function deleteQuotation(quotationDate, quotationNo) {
  console.log(`✅ 견적 삭제 모달 열기: ${quotationDate}-${quotationNo}`);

  // 모달에 견적 정보 표시
  document.getElementById(
    'deleteQuotationInfo',
  ).textContent = `견적번호: ${quotationDate}-${quotationNo}`;

  // 모달에 데이터 저장
  const modal = document.getElementById('quotationDeleteModal');
  modal.dataset.quotationDate = quotationDate;
  modal.dataset.quotationNo = quotationNo;

  // 모달 표시
  modal.style.display = 'flex';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.quotationDeleteModalDraggable) {
    makeModalDraggable('quotationDeleteModal', 'quotationDeleteModalHeader');
    window.quotationDeleteModalDraggable = true;
  }
}

// ✅ 견적 삭제 모달 닫기
function closeQuotationDeleteModal() {
  const modal = document.getElementById('quotationDeleteModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ✅ 견적 삭제 확인
async function confirmQuotationDelete() {
  const modal = document.getElementById('quotationDeleteModal');
  const quotationDate = modal.dataset.quotationDate;
  const quotationNo = modal.dataset.quotationNo;

  try {
    const response = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ 견적이 삭제되었습니다.');
      closeQuotationDeleteModal();

      // DataTable 새로고침
      if (window.quotationTableInstance) {
        window.quotationTableInstance.ajax.reload();
      }
    } else {
      throw new Error(result.message || '견적 삭제 실패');
    }
  } catch (err) {
    console.error('❌ 견적 삭제 오류:', err);
    alert('견적 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 견적 승인 함수 - 모달 열기
function approveQuotation(quotationDate, quotationNo) {
  console.log(`✅ 견적 승인 모달 열기: ${quotationDate}-${quotationNo}`);

  // 모달에 견적 정보 표시
  document.getElementById(
    'approveQuotationInfo',
  ).textContent = `견적번호: ${quotationDate}-${quotationNo}`;

  // 모달에 데이터 저장
  const modal = document.getElementById('quotationApproveModal');
  modal.dataset.quotationDate = quotationDate;
  modal.dataset.quotationNo = quotationNo;

  // 모달 표시
  modal.style.display = 'flex';
}

// ✅ 견적 승인 모달 닫기
function closeQuotationApproveModal() {
  const modal = document.getElementById('quotationApproveModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ✅ 견적 승인 확인
async function confirmQuotationApprove() {
  const modal = document.getElementById('quotationApproveModal');
  const quotationDate = modal.dataset.quotationDate;
  const quotationNo = modal.dataset.quotationNo;

  try {
    const response = await fetch(`/api/quotations/${quotationDate}/${quotationNo}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ 견적이 승인되었습니다.');
      closeQuotationApproveModal();

      // DataTable 새로고침
      if (window.quotationTableInstance) {
        window.quotationTableInstance.ajax.reload();
      }
    } else {
      throw new Error(result.message || '견적 승인 실패');
    }
  } catch (err) {
    console.error('❌ 견적 승인 오류:', err);
    alert('견적 승인 중 오류가 발생했습니다: ' + err.message);
  }
}

async function onEditQuotation(selectedQuotation) {
  const { 견적일자, 견적번호 } = selectedQuotation;

  // 1. 기존 견적내역 조회
  const res = await fetch(`/api/quotation_details/${견적일자}/${견적번호}`);
  const detailData = await res.json();

  // 2. 모달에 내역 표시
  openQuotationEditModal(detailData);
}

async function openQuotationEditModal(quotationDate, quotationNo) {
  try {
    // 1) 마스터 + 상세 조회
    const res = await fetch(`/api/quotations/${quotationDate}/${quotationNo}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('견적 정보를 찾을 수 없습니다.');
    const master = json.data.master;
    const details = json.data.detail || [];

    // 2) 기본 정보 바인딩
    document.getElementById('edit_q_no').textContent = `Q${quotationDate}-${quotationNo}`;
    document.getElementById('edit_q_date').textContent = quotationDate;
    document.getElementById('edit_q_customer').textContent = master?.매출처명 || '-';

    // 3) 상세 테이블 렌더
    renderEditDetailTable(details);

    // 4) 모달 오픈
    document.getElementById('quotationEditModal').style.display = 'block';
  } catch (err) {
    console.error('❌ openQuotationEditModal 오류:', err);
    alert(err.message || '견적 수정 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

// 전역 함수로 노출
window.openQuotationEditModal = openQuotationEditModal;

// ==================== 견적서 작성 모달 ====================

// 견적서 작성용 상세내역 배열
let newQuotationDetails = [];

// ✅ 견적서 작성 모달 열기
function openNewQuotationModal() {
  // 모달 제목 설정
  document.getElementById('quotationModalTitle').textContent = '견적서 작성';

  // 폼 초기화
  document.getElementById('quotationForm').reset();

  // 매출처 정보 초기화
  document.getElementById('selectedCustomerCode').value = '';
  document.getElementById('selectedCustomerName').value = '';
  const infoDiv = document.getElementById('selectedCustomerInfo');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }

  // 견적일자를 오늘 날짜로 설정
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('quotationDate').value = today;

  // 상세내역 초기화
  newQuotationDetails = [];
  renderNewQuotationDetailTable();

  // 모달 표시
  document.getElementById('quotationModal').style.display = 'block';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (!window.quotationModalDraggable) {
    makeModalDraggable('quotationModal', 'quotationModalHeader');
    window.quotationModalDraggable = true;
  }
}

// ✅ 견적서 작성 모달 닫기
function closeQuotationModal() {
  document.getElementById('quotationModal').style.display = 'none';
  // 견적 체크박스만 초기화
  $('#quotationSelectAll').prop('checked', false);
  $('.quotationRowCheck').prop('checked', false);
  // 버튼 상태도 초기화
  $('.quotationRowCheck').each(function () {
    const quotationDate = $(this).data('date');
    const quotationNo = $(this).data('no');
    const actionDiv = $(`#quotationActions-${quotationDate}_${quotationNo}`);

    actionDiv.find('.btn-view').show();
    actionDiv.find('.btn-edit').hide();
    actionDiv.find('.btn-delete').hide();
  });
  newQuotationDetails = [];
}

// ✅ 견적서 작성용 매출처 검색 모달 열기
function openQuotationCustomerSearchModal() {
  // 입력 필드의 값을 검색 모달로 가져가기
  const searchValue = document.getElementById('selectedCustomerName').value.trim();

  document.getElementById('quotationCustomerSearchModal').style.display = 'block';
  document.getElementById('quotationCustomerSearchInput').value = searchValue;

  // 값이 있으면 자동으로 검색 실행
  if (searchValue) {
    searchQuotationCustomers();
  }
}

// ✅ 전역으로 노출 (HTML에서 호출할 수 있도록)
window.openQuotationCustomerSearchModal = openQuotationCustomerSearchModal;
// 하위 호환성을 위한 별칭 (추후 제거 예정)
window.openCustomerSearchModal = openQuotationCustomerSearchModal;

// ✅ 견적서용 매출처 검색
async function searchQuotationCustomers() {
  try {
    const searchText = document.getElementById('quotationCustomerSearchInput').value.trim();

    const response = await fetch(
      `/api/customers?search=${encodeURIComponent(searchText)}`,
      { credentials: 'include' }, // 세션 쿠키 포함
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '매출처 조회 실패');
    }

    const tbody = document.getElementById('customerSearchTableBody');

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

    result.data.forEach((customer, index) => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';

      tr.innerHTML = `
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${customer.매출처코드}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${customer.매출처명}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${
          customer.전화번호 || '-'
        }</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <button class="select-customer-btn" data-index="${index}" style="
            padding: 6px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">선택</button>
        </td>
      `;

      // innerHTML 설정 후 이벤트 리스너 추가
      tr.onmouseover = () => (tr.style.background = '#f8f9fa');
      tr.onmouseout = () => (tr.style.background = 'white');

      // 행 클릭 시 매출처 선택
      tr.onclick = (e) => {
        console.log('🔵 행 클릭:', customer.매출처코드, 'target:', e.target.tagName);
        // 선택 버튼 클릭은 버튼의 onclick 이벤트가 처리하므로 제외
        if (e.target.tagName !== 'BUTTON') {
          try {
            console.log('🔵 행 클릭 → selectQuotationCustomer 호출');
            window.selectQuotationCustomer(customer);
          } catch (err) {
            console.error('❌ 행 클릭 → selectQuotationCustomer 에러:', err);
          }
        }
      };

      // 선택 버튼 클릭 이벤트
      const selectBtn = tr.querySelector('.select-customer-btn');

      console.log(`🔵 버튼 찾기 [${index}]:`, selectBtn ? '찾음' : '못찾음', customer.매출처코드);

      if (selectBtn) {
        selectBtn.onclick = (e) => {
          console.log('🔵 선택 버튼 클릭:', customer.매출처코드);
          e.stopPropagation(); // 행 클릭 이벤트 방지

          try {
            console.log('🔵 selectQuotationCustomer 호출 시작, customer 객체:', customer);
            window.selectQuotationCustomer(customer); // 견적서 전용 함수 호출
            console.log('🔵 selectQuotationCustomer 호출 완료');
          } catch (err) {
            console.error('❌ selectQuotationCustomer 호출 에러:', err);
            alert('매출처 선택 중 오류가 발생했습니다: ' + err.message);
          }
        };
      } else {
        console.error('❌ 선택 버튼을 찾을 수 없음:', customer.매출처코드);
      }

      tbody.appendChild(tr);
    });

    console.log(`✅ 매출처 검색 완료: ${result.data.length}건`);
  } catch (err) {
    console.error('❌ 매출처 검색 오류:', err);
    alert('매출처 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 전역으로 노출 (HTML에서 호출할 수 있도록)
window.searchQuotationCustomers = searchQuotationCustomers;

// 신규 견적서 작성 모드 플래그
let isNewQuotationMode = false;

// ✅ 자재 검색 모달 열기 (신규 견적서 작성용)
function openMaterialSearchModal() {
  // 신규 견적서 작성 모드로 설정
  isNewQuotationMode = true;

  // 견적서 작성 모달을 임시로 숨김 (완전히 숨기기)
  const quotationModal = document.getElementById('quotationModal');
  quotationModal.dataset.previousDisplay = quotationModal.style.display;
  quotationModal.style.display = 'none';

  // 모달 초기화
  selectedMaterial = null;
  document.getElementById('materialSearchCode').value = '';
  document.getElementById('materialSearchName').value = '';
  document.getElementById('materialSearchSpec').value = '';
  document.getElementById('materialSearchResults').style.display = 'none';
  document.getElementById('selectedMaterialInfo').style.display = 'none';
  document.getElementById('addDetailQuantity').value = '1';
  document.getElementById('addDetailPrice').value = '0';
  document.getElementById('addDetailAmount').value = '0';

  // 품목 추가 모달 표시
  const modal = document.getElementById('quotationDetailAddModal');
  modal.style.display = 'block';
  modal.style.zIndex = '9999';
  modal.style.position = 'fixed';

  console.log('견적서 작성 모달 숨김');
  console.log('품목 추가 모달 z-index:', modal.style.zIndex);
}

// 테스트 모달 닫기 (임시 함수)
function closeTestSimpleModal() {
  document.getElementById('testSimpleModal').style.display = 'none';

  // 견적서 작성 모달의 z-index 복원
  const quotationModal = document.getElementById('quotationModal');
  quotationModal.style.zIndex = '1050';
}

// ✅ 자재 검색 (견적서 작성용)
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
    document.getElementById('priceHistoryModal').style.display = 'block';
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
  closePriceHistoryModal();

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
function selectMaterialForQuotation(material) {
  const 수량 = prompt(`${material.자재명}\n수량을 입력하세요:`, '1');

  if (!수량 || isNaN(수량) || parseFloat(수량) <= 0) {
    alert('유효한 수량을 입력해주세요.');
    return;
  }

  const 단가 = prompt(`${material.자재명}\n출고단가를 입력하세요:`, material.출고단가1 || '0');

  if (!단가 || isNaN(단가) || parseFloat(단가) < 0) {
    alert('유효한 단가를 입력해주세요.');
    return;
  }

  // 상세내역 추가
  newQuotationDetails.push({
    자재코드: material.자재코드,
    자재명: material.자재명,
    규격: material.규격,
    수량: parseFloat(수량),
    단가: parseFloat(단가),
  });

  renderNewQuotationDetailTable();
  closeMaterialSearchModal();
}

// ✅ 새 견적서 상세내역 테이블 렌더링
function renderNewQuotationDetailTable() {
  const tbody = document.getElementById('quotationDetailTableBody');

  if (newQuotationDetails.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="padding: 40px; text-align: center; color: #999;">
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
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${detail.자재코드}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${detail.자재명 || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${detail.규격 || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${detail.수량.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${detail.단가.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${공급가.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${부가세.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <button type="button" onclick="removeNewQuotationDetail(${index})" style="
          padding: 4px 12px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 합계 표시
  document.getElementById('totalSupplyPrice').textContent = totalSupply.toLocaleString();
  document.getElementById('totalVat').textContent = totalVat.toLocaleString();
  document.getElementById('grandTotal').textContent = (totalSupply + totalVat).toLocaleString();
}

// ✅ 상세내역 삭제
function removeNewQuotationDetail(index) {
  if (confirm('이 항목을 삭제하시겠습니까?')) {
    newQuotationDetails.splice(index, 1);
    renderNewQuotationDetailTable();
  }
}

// ✅ 견적서 저장
async function submitQuotation(event) {
  event.preventDefault();

  try {
    // 입력값 가져오기
    const 견적일자 = document.getElementById('quotationDate').value.replace(/-/g, '');
    const 출고희망일자 = document.getElementById('deliveryDate').value.replace(/-/g, '') || '';
    const 매출처코드 = document.getElementById('selectedCustomerCode').value;
    const 제목 = document.getElementById('quotationTitle').value;
    const 적요 = document.getElementById('quotationRemark').value;

    // 유효성 검사
    if (!매출처코드) {
      alert('매출처를 선택해주세요.');
      return;
    }

    if (newQuotationDetails.length === 0) {
      alert('견적 상세내역을 최소 1개 이상 추가해주세요.');
      return;
    }

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

    // API 호출
    const response = await fetch('/api/quotations_add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify(quotationData),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '견적서 저장 실패');
    }

    alert('견적서가 성공적으로 저장되었습니다.');
    closeQuotationModal();

    // 견적 목록 새로고침 (DataTable reload)
    if ($.fn.DataTable.isDataTable('#quotationTable')) {
      $('#quotationTable').DataTable().ajax.reload();
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

// 모달 열기 - 견적서 작성 모달은 유지하고 품목 추가 모달만 표시
function openMaterialSearchModal() {
  // 새 모달 초기화
  newSelectedMaterial = null;
  document.getElementById('newMaterialSearchCode').value = '';
  document.getElementById('newMaterialSearchName').value = '';
  document.getElementById('newMaterialSearchSpec').value = '';
  document.getElementById('newMaterialSearchResults').style.display = 'none';
  document.getElementById('newSelectedMaterialInfo').style.display = 'none';
  document.getElementById('newDetailQuantity').value = '1';
  document.getElementById('newDetailPrice').value = '0';
  document.getElementById('newDetailAmount').value = '0';

  // 품목 추가 모달 표시 (견적서 작성 모달은 그대로 유지)
  const modal = document.getElementById('newQuotationMaterialModal');
  modal.style.display = 'block';
  modal.style.zIndex = '9999';
}

// 테스트 모달 닫기
function closeTestSimpleModal() {
  document.getElementById('testSimpleModal').style.display = 'none';
}

// 모달 닫기
function closeNewQuotationMaterialModal() {
  document.getElementById('newQuotationMaterialModal').style.display = 'none';
  // 견적서 작성 모달은 그대로 유지되므로 별도 처리 불필요
}

// 자재 검색
async function searchNewMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCode = document.getElementById('newMaterialSearchCode').value.trim();
    const searchName = document.getElementById('newMaterialSearchName').value.trim();
    const searchSpec = document.getElementById('newMaterialSearchSpec').value.trim();

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCode && !searchName && !searchSpec) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 신규 견적 자재 검색:', {
      자재코드: searchCode,
      자재명: searchName,
      규격: searchSpec,
    });

    // 검색 조건을 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    if (searchCode) params.append('searchCode', searchCode);
    if (searchName) params.append('searchName', searchName);
    if (searchSpec) params.append('searchSpec', searchSpec);

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

// ✅ 신규 견적서 단가 이력 모달 열기 (기존 priceHistoryModal 재사용)
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
    const priceHistoryModal = document.getElementById('priceHistoryModal');
    if (priceHistoryModal) {
      priceHistoryModal.style.zIndex = '10000';
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
  if (quotationTable) {
    quotationTable.ajax.reload();
  } else {
    console.warn('⚠️ quotationTable이 초기화되지 않았습니다.');
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
window.editQuotation = editQuotation;
window.deleteQuotation = deleteQuotation;
window.approveQuotation = approveQuotation;
window.makeModalDraggable = makeModalDraggable;
window.filterQuotations = filterQuotations;
window.printQuotation = printQuotation;
window.printQuotationFromDetail = printQuotationFromDetail;
window.closeQuotationDetailModal = closeQuotationDetailModal;
