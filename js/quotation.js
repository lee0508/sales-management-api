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

  // ✅ 모달 닫기 버튼
  $('#closeQuotationDetailModal').on('click', () => {
    $('#quotationDetailModal').addClass('hidden');
  });

  // ✅ 견적 데이터 로드 함수
  async function loadQuotations() {
    console.log('✅ 견적 데이터 로드 시작');

    try {
      const start = document.getElementById('quotationStartDate')?.value.replace(/-/g, '');
      const end = document.getElementById('quotationEndDate')?.value.replace(/-/g, '');

      const response = await fetch(`/quotations?start=${start}&end=${end}`);
      const result = await response.json();

      console.log('✅ 견적 데이터 로드:', result);

      if (result.success && result.data) {
        // ✅ 견적 수 표시
        const countEl = document.getElementById('quotationCount');
        if (countEl) {
          countEl.innerText = result.total || result.data.length;
        } else {
          console.warn('⚠️ quotationCount element not found in DOM');
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

  // ✅ 모달 열기 함수
  async function openQuotationDetailModal(quotationNo) {
    $('#quotationDetailModal').removeClass('hidden');

    try {
      // 견적 기본정보 조회
      const infoRes = await fetch(`/api/quotation/${quotationNo}`);
      const info = await infoRes.json();

      $('#q_no').text(info.data.견적번호);
      $('#q_date').text(info.data.견적일자);
      $('#q_customer').text(info.data.매출처명);
      $('#q_remark').text(info.data.비고 || '');

      // 견적 상세 품목 조회
      const detailRes = await fetch(`/api/quotation/${quotationNo}/details`);
      const detailData = await detailRes.json();

      const tbody = $('#quotationDetailTable tbody');
      tbody.empty();

      detailData.data.forEach((item) => {
        const row = `
        <tr>
          <td>${item.품목코드}</td>
          <td>${item.품명}</td>
          <td>${item.규격}</td>
          <td style="text-align:right">${item.수량.toLocaleString()}</td>
          <td style="text-align:right">${item.단가.toLocaleString()}</td>
          <td style="text-align:right">${item.금액.toLocaleString()}</td>
        </tr>`;
        tbody.append(row);
      });
    } catch (err) {
      console.error('❌ 견적 상세 조회 오류:', err);
      alert('견적 상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
  }

  // 전역 변수로 저장
  window.quotationTableInstance = quotationTable;
});

// 필터링 함수
function filterQuotations() {
  if (window.quotationTableInstance) {
    window.quotationTableInstance.ajax.reload();
  }
}

console.log('✅ quotation.js 로드 완료');
