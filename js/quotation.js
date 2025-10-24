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

  // ✅ 모달 닫기 버튼
  $('#closeQuotationDetailModal').on('click', () => {
    closeQuotationDetailModal();
  });

  // ✅ 모달 배경 클릭시 닫기
  $(document).on('click', '#quotationDetailModal', function (e) {
    if (e.target.id === 'quotationDetailModal') {
      closeQuotationDetailModal();
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
      const masterRes = await fetch(`http://localhost:3000/api/quotations/${quotationDate}/${quotationNo}`);
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

// ✅ 견적 수정 함수
function editQuotation(quotationDate, quotationNo) {
  console.log(`✅ 견적 수정: ${quotationDate}-${quotationNo}`);
  alert('견적 수정 기능은 아직 구현되지 않았습니다.');
  // TODO: 견적 수정 모달 열기
}

// ✅ 견적 삭제 함수
function deleteQuotation(quotationDate, quotationNo) {
  console.log(`✅ 견적 삭제: ${quotationDate}-${quotationNo}`);

  if (!confirm('정말로 이 견적을 삭제하시겠습니까?')) {
    return;
  }

  alert('견적 삭제 기능은 아직 구현되지 않았습니다.');
  // TODO: 견적 삭제 API 호출
}

// ✅ 견적 승인 함수
function approveQuotation(quotationDate, quotationNo) {
  console.log(`✅ 견적 승인: ${quotationDate}-${quotationNo}`);

  if (!confirm('이 견적을 승인하시겠습니까?')) {
    return;
  }

  alert('견적 승인 기능은 아직 구현되지 않았습니다.');
  // TODO: 견적 승인 API 호출 (상태코드 2로 변경)
}

console.log('✅ quotation.js 로드 완료');
