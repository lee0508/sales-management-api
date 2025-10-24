/**
 * 견적관리 DataTable 초기화 및 관리
 */

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
              <button class="btn-icon btn-view" onclick="viewQuotationDetail('${row.견적일자}', ${row.견적번호})" title="상세보기">상세</button>
              <button class="btn-icon btn-edit" style="display: none;" onclick="editQuotation('${row.견적일자}', ${row.견적번호})" title="수정">수정</button>
              <button class="btn-icon btn-delete" style="display: none;" onclick="deleteQuotation('${row.견적일자}', ${row.견적번호})" title="삭제">삭제</button>
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
    pageLength: 25,
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

  // 전역 변수로 저장
  window.quotationTableInstance = quotationTable;
});

// 필터링 함수
function filterQuotations() {
  if (window.quotationTableInstance) {
    window.quotationTableInstance.ajax.reload();
  }
}

// 견적서 상세내역 저장 배열
let quotationDetails = [];

// 견적서 작성 모달 열기
function openQuotationModal() {
  console.log('===== 견적서 작성 모달 열기 =====');

  // 폼 초기화
  document.getElementById('quotationForm').reset();
  document.getElementById('quotationModalTitle').textContent = '견적서 작성';

  // 오늘 날짜 기본값
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('quotationDate').value = today;

  // 상세내역 초기화
  quotationDetails = [];
  updateDetailTable();

  // 모달 표시
  document.getElementById('quotationModal').style.display = 'flex';
}

// 견적서 작성 모달 닫기
function closeQuotationModal() {
  document.getElementById('quotationModal').style.display = 'none';
  quotationDetails = [];
}

// 매출처 검색 모달 열기 (임시)
function openCustomerSearchModal() {
  alert('매출처 검색 기능은 다음 단계에서 구현됩니다.\n임시로 직접 입력해주세요.');

  // 임시: 프롬프트로 입력
  const customerCode = prompt('매출처 코드를 입력하세요:', 'A001');
  const customerName = prompt('매출처명을 입력하세요:', '에이스전기통신주');

  if (customerCode && customerName) {
    document.getElementById('selectedCustomerCode').value = customerCode;
    document.getElementById('selectedCustomerName').value = customerName;
  }
}

// 자재 검색 모달 열기 (임시)
function openMaterialSearchModal() {
  alert('자재 검색 기능은 다음 단계에서 구현됩니다.\n임시로 직접 입력해주세요.');

  // 임시: 프롬프트로 입력
  const materialCode = prompt('자재코드를 입력하세요:', '0101BJ12');
  const materialName = prompt('자재명을 입력하세요:', '전선');
  const spec = prompt('규격을 입력하세요:', '2.5SQ');
  const qty = parseFloat(prompt('수량을 입력하세요:', '10'));
  const price = parseFloat(prompt('단가를 입력하세요:', '5000'));

  if (materialCode && materialName && qty && price) {
    const supplyPrice = qty * price;
    const vat = Math.round(supplyPrice * 0.1);

    quotationDetails.push({
      자재코드: materialCode,
      자재명: materialName,
      규격: spec || '-',
      수량: qty,
      단가: price,
      공급가: supplyPrice,
      부가세: vat,
    });

    updateDetailTable();
  }
}

// 상세내역 테이블 업데이트
function updateDetailTable() {
  const tbody = document.getElementById('quotationDetailTableBody');

  if (quotationDetails.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="padding: 40px; text-align: center; color: #999;">
          자재 추가 버튼을 클릭하여 견적 상세내역을 입력하세요
        </td>
      </tr>
    `;
    updateTotals();
    return;
  }

  let html = '';
  quotationDetails.forEach((detail, index) => {
    html += `
      <tr>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid var(--border);">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid var(--border);">${detail.자재코드}</td>
        <td style="padding: 12px; border-bottom: 1px solid var(--border);">${detail.자재명}</td>
        <td style="padding: 12px; border-bottom: 1px solid var(--border);">${detail.규격}</td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${detail.수량.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${detail.단가.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${detail.공급가.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid var(--border);">${detail.부가세.toLocaleString()}</td>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid var(--border);">
          <button type="button" onclick="removeDetail(${index})" style="
                padding: 4px 8px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
              ">삭제</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  updateTotals();
}

// 상세내역 삭제
function removeDetail(index) {
  quotationDetails.splice(index, 1);
  updateDetailTable();
}

// 합계 업데이트
function updateTotals() {
  const totalSupply = quotationDetails.reduce((sum, item) => sum + item.공급가, 0);
  const totalVat = quotationDetails.reduce((sum, item) => sum + item.부가세, 0);
  const grandTotal = totalSupply + totalVat;

  document.getElementById('totalSupplyPrice').textContent = totalSupply.toLocaleString();
  document.getElementById('totalVat').textContent = totalVat.toLocaleString();
  document.getElementById('grandTotal').textContent = grandTotal.toLocaleString();
}

// 견적서 제출
async function submitQuotation(event) {
  event.preventDefault();

  try {
    console.log('===== 견적서 제출 시작 =====');

    // 상세내역 검증
    if (quotationDetails.length === 0) {
      alert('견적 상세내역을 최소 1개 이상 입력해주세요.');
      return;
    }

    // 마스터 데이터 수집
    const master = {
      사업장코드: currentUser?.사업장코드 || '01',
      견적일자: document.getElementById('quotationDate').value.replace(/-/g, ''),
      매출처코드: document.getElementById('selectedCustomerCode').value,
      출고희망일자: document.getElementById('deliveryDate').value?.replace(/-/g, '') || '',
      제목: document.getElementById('quotationTitle').value || '',
      적요: document.getElementById('quotationRemark').value || '',
      상태코드: 1, // 작성중
      사용자코드: currentUser?.사용자코드 || '',
    };

    // 상세내역 데이터 변환
    const details = quotationDetails.map((detail) => ({
      자재코드: detail.자재코드,
      수량: detail.수량,
      입고단가: 0,
      입고부가: 0,
      출고단가: detail.단가,
      출고부가: detail.부가세 / detail.수량, // 단위당 부가세
      매입처코드: '',
      계산서발행여부: 1,
      적요: '',
    }));

    console.log('마스터 데이터:', master);
    console.log('상세내역 데이터:', details);

    // API 호출
    const result = await apiCall('/quotations_add', 'POST', {
      master: master,
      details: details,
    });

    if (result.success) {
      alert('견적서가 성공적으로 등록되었습니다.');
      closeQuotationModal();

      // 목록 새로고침
      if (window.quotationTableInstance) {
        window.quotationTableInstance.ajax.reload();
      }
    } else {
      alert('오류: ' + (result.message || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('❌ 견적서 등록 오류:', error);
    alert('견적서 등록 중 오류가 발생했습니다: ' + error.message);
  }
}

// 견적 상세보기 (임시)
function viewQuotationDetail(date, no) {
  alert(`견적 상세보기: ${date}-${no}\n다음 단계에서 구현됩니다.`);
}

// 견적 수정 (임시)
function editQuotation(date, no) {
  alert(`견적 수정: ${date}-${no}\n다음 단계에서 구현됩니다.`);
}

// 견적 삭제 (임시)
function deleteQuotation(date, no) {
  if (confirm(`견적 ${date}-${no}을(를) 삭제하시겠습니까?`)) {
    alert('다음 단계에서 구현됩니다.');
  }
}

// 견적 승인 (임시)
function approveQuotation(date, no) {
  if (confirm(`견적 ${date}-${no}을(를) 승인하시겠습니까?`)) {
    alert('다음 단계에서 구현됩니다.');
  }
}

console.log('✅ quotation.js 로드 완료');
