/**
 * 견적관리 DataTable 초기화 및 관리
 */
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const startDate = new Date(today);
  startDate.setMonth(today.getMonth() - 1);

  document.getElementById('quotationStartDate').value = startDate.toISOString().slice(0, 10);
  document.getElementById('quotationEndDate').value = endDate;
});

$(document).ready(function () {
  console.log('✅ 견적관리 DataTable 초기화 시작');

  // DataTable 초기화
  const quotationTable = $('#quotationTable').DataTable({
    ajax: {
      url: 'http://localhost:3000/api/quotations',
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
        console.log('✅ 견적 데이터 로드:', json);
        return json.data || [];
      },
    },
    columns: [
      // 1. 체크박스
      {
        data: null,
        orderable: false,
        render: function (data, type, row) {
          return `<input type="checkbox" class="quotationCheckbox" data-date="${row.견적일자}" data-no="${row.견적번호}" />`;
        },
      },
      // 2. 순번
      {
        data: null,
        render: function (data, type, row, meta) {
          return meta.row + 1;
        },
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
      // 6. 출고희망일자
      {
        data: '출고희망일자',
        render: function (data) {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      // 7. 제목
      {
        data: '제목',
        defaultContent: '-',
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
            <div class="action-buttons" id="actions-${quotationKey.replace('-', '_')}">
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
    order: [[4, 'desc']], // 견적일자 내림차순
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    responsive: true,
    autoWidth: false,
  });

  console.log('✅ 견적관리 DataTable 초기화 완료');

  // 전체 선택 체크박스
  $('#selectAllQuotations').on('change', function () {
    const isChecked = $(this).prop('checked');
    $('.quotationCheckbox').prop('checked', isChecked).trigger('change');
  });

  // 개별 체크박스 이벤트
  $(document).on('change', '.quotationCheckbox', function () {
    const quotationDate = $(this).data('date');
    const quotationNo = $(this).data('no');
    const isChecked = $(this).prop('checked');
    const actionDiv = $(`#actions-${quotationDate}_${quotationNo}`);

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

  // ✅ 상세 버튼 클릭 이벤트
  $(document).on('click', '.btn-quotation-detail', function () {
    const quotationNo = $(this).data('id');
    openQuotationDetailModal(quotationNo);
  });

  // ✅ 모달 닫기 함수
  function closeQuotationDetailModal() {
    const modal = document.getElementById('quotationDetailModal');
    if (modal) {
      modal.style.display = 'none';
    }
    // DataTable 정리 (메모리 누수 방지)
    if (window.quotationDetailDataTable) {
      window.quotationDetailDataTable.destroy();
      window.quotationDetailDataTable = null;
      $('#quotationDetailTable tbody').empty();
      console.log('✅ 견적 상세 DataTable 정리 완료');
    }
  }

  // ✅ 상세보기 모달 닫기 버튼
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

  // ✅ 견적 데이터 로드 함수
  async function loadQuotations() {
    console.log('✅ 견적 데이터 로드 시작');

    try {
      // ✅ 로그인 날짜 기준으로 최근 1개월 자동 설정
      const today = new Date();
      const end = today.toISOString().slice(0, 10).replace(/-/g, '');
      const startDateObj = new Date();
      // startDateObj.setMonth(today.getMonth() - 1);
      const start = startDateObj.toISOString().slice(0, 10).replace(/-/g, '');

      const response = await fetch(`/api/quotations?startDate=${start}&endDate=${end}`);
      const result = await response.json();

      console.log('✅ 견적 데이터 로드:', result);

      if (result.success && result.data) {
        // ✅ 해당 기간 건수 표시
        const countEl = document.getElementById('quotationCount');
        if (countEl) {
          const periodCount = result.data.length;
          countEl.innerText = `${periodCount.toLocaleString()}`;
          console.log(`📊 최근 1개월 견적 수: ${periodCount}`);
        }

        // ✅ DataTable 업데이트
        const table = $('#quotationTable').DataTable();
        table.clear();
        table.rows.add(result.data);
        table.draw();
      } else {
        console.error('❌ 견적 데이터 로드 실패:', result);
      }
    } catch (error) {
      console.error('❌ 견적 데이터 로드 중 오류 발생:', error);
    }
  }

  // ✅ 모달 열기 함수 (견적일자, 견적번호로 조회)
  async function openQuotationDetailModal(quotationDate, quotationNo) {
    const modal = document.getElementById('quotationDetailModal');
    if (modal) {
      modal.style.display = 'block';
    }

    try {
      // 견적 마스터+상세 조회 (기존 API 사용)
      const masterRes = await fetch(
        `http://localhost:3000/api/quotations/${quotationDate}/${quotationNo}`,
      );
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
        order: [[0, 'asc']], // 자재코드 오름차순
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

  // 전역 변수로 저장
  window.quotationTableInstance = quotationTable;
  window.openQuotationDetailModal = openQuotationDetailModal;
  window.openQuotationEditModal = openQuotationEditModal;
});

// 필터링 함수
function filterQuotations() {
  if (window.quotationTableInstance) {
    window.quotationTableInstance.ajax.reload();
  }
}

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

// ✅ 견적 수정 함수 - 모달 열기 (견적내역 포함)
async function editQuotation(quotationDate, quotationNo) {
  console.log(`✅ 견적 수정: ${quotationDate}-${quotationNo}`);

  try {
    // 현재 견적 정보 조회 (마스터 + 상세)
    const response = await fetch(
      `http://localhost:3000/api/quotations/${quotationDate}/${quotationNo}`,
    );
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
          // 체크박스
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function () {
            return '<input type="checkbox" class="editDetailCheckbox" />';
          },
        },
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
      order: [[1, 'asc']], // 순번 오름차순
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

  // DataTable 정리
  if (window.quotationEditDetailDataTable) {
    window.quotationEditDetailDataTable.destroy();
    window.quotationEditDetailDataTable = null;
    $('#quotationEditDetailTable tbody').empty();
  }
}

// ✅ 자재 추가 함수
async function addQuotationDetailRow() {
  try {
    // 자재 목록 조회
    const response = await fetch('http://localhost:3000/api/materials');
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('자재 목록을 불러올 수 없습니다.');
    }

    const materials = result.data;

    // 간단한 선택 UI (향후 개선 가능)
    let options = '자재를 선택하세요:\n\n';
    materials.slice(0, 20).forEach((m, idx) => {
      const 자재코드 = m.분류코드 + m.세부코드;
      options += `${idx + 1}. [${자재코드}] ${m.자재명} - ${m.규격 || ''}\n`;
    });

    const selection = prompt(
      options + '\n번호를 입력하세요 (1-' + Math.min(20, materials.length) + '):',
    );
    if (!selection) return;

    const idx = parseInt(selection) - 1;
    if (idx < 0 || idx >= materials.length) {
      alert('잘못된 번호입니다.');
      return;
    }

    const material = materials[idx];
    const 자재코드 = material.분류코드 + material.세부코드;

    // 수량과 단가 입력
    const 수량 = prompt('수량을 입력하세요:', '1');
    if (!수량) return;

    const 출고단가 = prompt('출고단가를 입력하세요:', '0');
    if (!출고단가) return;

    const 금액 = parseFloat(수량) * parseFloat(출고단가);

    // DataTable에 행 추가
    const newRow = {
      자재코드: 자재코드,
      자재명: material.자재명,
      규격: material.규격 || '-',
      수량: parseFloat(수량),
      출고단가: parseFloat(출고단가),
      금액: 금액,
      _isNew: true, // 새로 추가된 행 표시
    };

    window.quotationEditDetailDataTable.row.add(newRow).draw();

    // 합계 재계산
    recalculateQuotationEditTotal();

    console.log('✅ 자재 추가 완료:', newRow);
  } catch (err) {
    console.error('❌ 자재 추가 오류:', err);
    alert('자재 추가 중 오류가 발생했습니다: ' + err.message);
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

    const masterResponse = await fetch(
      `http://localhost:3000/api/quotations/${quotationDate}/${quotationNo}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          매출처코드: modal.dataset.매출처코드,
          출고희망일자: 출고희망일자,
          결제방법: parseInt(modal.dataset.결제방법),
          결제예정일자: modal.dataset.결제예정일자,
          유효일수: parseInt(modal.dataset.유효일수),
          제목: document.getElementById('editTitle').value,
          적요: document.getElementById('editRemark').value,
        }),
      },
    );

    const masterResult = await masterResponse.json();

    if (!masterResult.success) {
      throw new Error(masterResult.message || '견적 마스터 수정 실패');
    }

    // 2. 상세 정보는 현재 API가 없으므로 알림만 표시
    // TODO: 향후 상세 정보 업데이트 API 구현 필요
    const detailData = window.quotationEditDetailDataTable.rows().data().toArray();
    console.log('📋 수정된 견적 상세 데이터:', detailData);
    console.log('⚠️ 견적 상세 업데이트 API는 아직 구현되지 않았습니다.');

    alert(
      '✅ 견적 기본 정보가 수정되었습니다.\n\n⚠️ 견적 품목 내역 수정 기능은 추후 구현 예정입니다.',
    );
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
    const response = await fetch(
      `http://localhost:3000/api/quotations/${quotationDate}/${quotationNo}`,
      {
        method: 'DELETE',
      },
    );

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
    const response = await fetch(
      `http://localhost:3000/api/quotations/${quotationDate}/${quotationNo}/approve`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

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
    document.getElementById('quotationEditModal').classList.remove('hidden');

    // 5) 저장/취소 이벤트 바인딩 (중복 바인딩 방지 위해 기존 핸들러 제거 후 추가)
    const btnSave = document.getElementById('btnSaveQuotationDetails');
    const btnCancel = document.getElementById('btnCancelQuotationDetails');
    const btnCloseX = document.getElementById('closeQuotationEditModal');

    btnSave.onclick = () => saveQuotationDetails(quotationDate, quotationNo);
    btnCancel.onclick = closeQuotationEditModal;
    btnCloseX.onclick = closeQuotationEditModal;
  } catch (err) {
    console.error('❌ openQuotationEditModal 오류:', err);
    alert(err.message || '견적 수정 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

// ✅ 자재 검색 모달 열기
function openMaterialModal(rowIndex) {
  const modal = document.getElementById('materialSelectModal');
  modal.dataset.rowIndex = rowIndex; // 어느 행에서 열렸는지 저장
  modal.classList.remove('hidden');
  searchMaterials(); // 초기 로드
}

// ✅ 자재 검색 API 호출
async function searchMaterials() {
  const keyword = document.getElementById('materialSearch').value || '';
  const tbody = document.querySelector('#materialTable tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">검색 중...</td></tr>';

  const res = await fetch(`/api/materials?search=${encodeURIComponent(keyword)}`);
  const result = await res.json();

  if (result.success && result.data.length > 0) {
    tbody.innerHTML = '';
    result.data.forEach((mat) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${mat.자재코드}</td>
        <td>${mat.자재명}</td>
        <td>${mat.규격 || '-'}</td>
        <td>${mat.단가?.toLocaleString() || '-'}</td>
        <td><button class="btn btn-sm btn-primary" onclick="selectMaterial('${mat.자재코드}', '${
        mat.자재명
      }', '${mat.규격}', ${mat.단가 || 0})">선택</button></td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5">검색 결과 없음</td></tr>';
  }
}

// ✅ 자재 선택 시 행에 반영
function selectMaterial(자재코드, 자재명, 규격, 단가) {
  const rowIndex = document.getElementById('materialSelectModal').dataset.rowIndex;
  const row = document.querySelector(`#editDetailTable tbody tr[data-index="${rowIndex}"]`);

  row.querySelector('.mat-code').textContent = 자재코드;
  row.querySelector('.mat-name').textContent = 자재명;
  row.querySelector('.spec').textContent = 규격;
  row.querySelector('.price').value = 단가;

  closeMaterialModal();
}

// ✅ 모달 닫기
function closeMaterialModal() {
  document.getElementById('materialSelectModal').classList.add('hidden');
}

// function renderEditTable(details) {
//   const tbody = document.querySelector('#editDetailTable tbody');
//   tbody.innerHTML = '';

//   details.forEach((item, idx) => {
//     const tr = document.createElement('tr');
//     tr.dataset.index = idx;
//     tr.innerHTML = `
//     <td>
//         <button class="btn btn-sm btn-outline" onclick="openMaterialModal(${idx})">
//           자재 변경
//         </button>
//       </td>
//       <td class="mat-code">${item.자재코드 || ''}</td>
//       <td class="mat-name">${item.자재명 || ''}</td>
//       <td class="spec">${item.규격 || ''}</td>
//       <td><input type="number" class="qty" value="${
//         item.수량 || 0
//       }" min="0" onchange="updateAmount(${idx})"></td>
//       <td><input type="number" class="price" value="${
//         item.출고단가 || 0
//       }" min="0" onchange="updateAmount(${idx})"></td>
//       <td class="amount">${(item.수량 * item.출고단가).toLocaleString()}</td>
//       <td><button class="btn btn-sm btn-outline" onclick="openMaterialModal(${idx})">자재 변경</button></td>
//     `;
//     tbody.appendChild(tr);
//   });
// }

function renderEditDetailTable(details) {
  const tbody = document.querySelector('#editDetailTable tbody');
  tbody.innerHTML = '';

  details.forEach((item, idx) => {
    const qty = Number(item.수량 || 0);
    const price = Number(item.출고단가 || 0);
    const amount = qty * price;

    const tr = document.createElement('tr');
    tr.dataset.index = idx;
    tr.innerHTML = `
      <td>
        <button class="btn btn-sm btn-outline" onclick="openMaterialModal(${idx})">
          자재 변경
        </button>
      </td>
      <td class="mat-code">${item.자재코드 || ''}</td>
      <td class="mat-name">${item.자재명 || ''}</td>
      <td class="spec">${item.규격 || ''}</td>
      <td><input type="number" class="qty" min="0" value="${qty}" onchange="updateAmount(${idx})"></td>
      <td><input type="number" class="price" min="0" value="${price}" onchange="updateAmount(${idx})"></td>
      <td class="amount" style="text-align:right">${amount.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ✅ 수량/단가 변경 시 금액 자동 계산
function updateAmount(idx) {
  const row = document.querySelector(`#editDetailTable tbody tr[data-index="${idx}"]`);
  const qty = parseFloat(row.querySelector('.qty').value) || 0;
  const price = parseFloat(row.querySelector('.price').value) || 0;
  const amount = qty * price;
  row.querySelector('.amount').textContent = amount.toLocaleString();
}

// async function saveQuotationDetails() {
//   const rows = document.querySelectorAll('#editDetailTable tbody tr');
//   const data = [];

//   rows.forEach((row) => {
//     const 자재코드 = row.querySelector('.mat-code').textContent;
//     const 수량 = parseFloat(row.querySelector('.qty').value);
//     const 출고단가 = parseFloat(row.querySelector('.price').value);

//     if (isNaN(수량) || 수량 < 0 || isNaN(출고단가) || 출고단가 < 0) {
//       alert('수량과 단가는 0 이상이어야 합니다.');
//       return;
//     }

//     data.push({
//       자재코드,
//       수량,
//       출고단가,
//       금액: 수량 * 출고단가,
//     });
//   });

//   const res = await fetch(
//     `/api/quotations/${currentQuotation.견적일자}/${currentQuotation.견적번호}/details`,
//     {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(data),
//     },
//   );

//   const result = await res.json();
//   if (result.success) {
//     alert('견적내역이 수정되었습니다.');
//     closeQuotationEditModal();
//     loadQuotations();
//   } else {
//     alert('수정 실패: ' + result.message);
//   }
// }
console.log('✅ quotation.js 로드 완료');
