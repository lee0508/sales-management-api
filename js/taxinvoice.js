/**
 * 세금계산서 관리 스크립트
 * 작성일: 2025-11-11
 */

let taxInvoiceTable = null;
let currentEditTaxInvoice = null; // 현재 수정 중인 세금계산서 데이터
let currentDeleteTaxInvoice = null; // 삭제할 세금계산서 정보 임시 저장
let currentTaxInvoiceDetail = null; // 현재 상세 보기 중인 세금계산서 정보 (인쇄용)

/**
 * 세금계산서 목록 로드
 * @param {boolean} skipDateInit - 날짜 초기화 건너뛰기 여부 (기본: false)
 */
window.loadTaxInvoices = async function (skipDateInit = false) {
  console.log('✅ 세금계산서 목록 로드 시작');

  try {
    // 날짜 필터 초기화 (기본: 최근 3개월) - 최초 로드시만
    if (!skipDateInit) {
      initializeTaxInvoiceDateFilters();
    }

    // API 호출
    const 사업장코드 = sessionStorage.getItem('사업장코드') || '01';
    const startDate = document.getElementById('taxInvoiceStartDate').value.replace(/-/g, '');
    const endDate = document.getElementById('taxInvoiceEndDate').value.replace(/-/g, '');
    const status = document.getElementById('taxInvoiceStatusFilter').value;

    let url = `/api/tax-invoices?사업장코드=${사업장코드}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (status) url += `&발행여부=${status}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '세금계산서 목록을 불러오는데 실패했습니다.');
    }

    const taxInvoices = result.data || [];
    console.log(`📊 세금계산서 ${taxInvoices.length}건 로드 완료`);

    // DataTable 초기화
    if (taxInvoiceTable) {
      taxInvoiceTable.destroy();
      taxInvoiceTable = null;
    }

    taxInvoiceTable = $('#taxInvoiceTable').DataTable({
      data: taxInvoices,
      order: [[5, 'desc']], // 작성일자 내림차순
      pageLength: 25,
      language: {
        url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/ko.json',
      },
      columns: [
        {
          // 체크박스
          data: null,
          orderable: false,
          render: function (data, type, row) {
            return `<input type="checkbox" class="tax-invoice-checkbox" value="${row.작성년도}-${row.책번호}-${row.일련번호}" onchange="toggleTaxInvoiceActions('${row.작성년도}', ${row.책번호}, ${row.일련번호})" />`;
          },
        },
        {
          // 순번
          data: null,
          render: function (data, type, row, meta) {
            return meta.row + 1;
          },
        },
        { data: '작성년도' },
        { data: '책번호' },
        { data: '일련번호' },
        {
          // 작성일자 (YYYY-MM-DD 포맷)
          data: '작성일자',
          render: function (data) {
            if (!data || data.length !== 8) return data;
            return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
          },
        },
        { data: '매출처명' },
        { data: '품목및규격' },
        {
          // 수량
          data: '수량',
          render: function (data) {
            return Number(data || 0).toLocaleString('ko-KR');
          },
        },
        {
          // 공급가액
          data: '공급가액',
          render: function (data) {
            return Number(data || 0).toLocaleString('ko-KR');
          },
        },
        {
          // 세액
          data: '세액',
          render: function (data) {
            return Number(data || 0).toLocaleString('ko-KR');
          },
        },
        {
          // 합계
          data: null,
          render: function (data, type, row) {
            const total = (Number(row.공급가액) || 0) + (Number(row.세액) || 0);
            return `<strong style="color: #2563eb">${total.toLocaleString('ko-KR')}</strong>`;
          },
        },
        {
          // 발행여부
          data: '발행여부',
          render: function (data) {
            const statusMap = {
              0: { text: '미발행', class: 'status-pending' },
              1: { text: '발행완료', class: 'status-active' },
            };
            const status = statusMap[data] || { text: '미발행', class: 'status-pending' };
            return `<span class="status-badge ${status.class}">${status.text}</span>`;
          },
        },
        {
          // 관리 버튼
          data: null,
          orderable: false,
          render: function (data, type, row) {
            const actionId = `tax-invoice-actions-${row.작성년도}-${row.책번호}-${row.일련번호}`;
            return `
              <div class="action-buttons" id="${actionId}">
                <button
                  class="btn-icon btn-view"
                  onclick="openTaxInvoiceDetailModal('${row.작성년도}', ${row.책번호}, ${row.일련번호})"
                  title="상세보기"
                >
                  상세
                </button>
                <button
                  class="btn-icon btn-edit"
                  style="display: none;"
                  onclick="openTaxInvoiceEditModal('${row.작성년도}', ${row.책번호}, ${row.일련번호})"
                  title="수정"
                >
                  수정
                </button>
                <button
                  class="btn-icon btn-delete"
                  style="display: none;"
                  onclick="deleteTaxInvoice('${row.작성년도}', ${row.책번호}, ${row.일련번호})"
                  title="삭제"
                >
                  삭제
                </button>
              </div>
            `;
          },
        },
      ],
    });

    // 요약 정보 업데이트
    updateTaxInvoiceSummary(taxInvoices);

    // 전체 선택 체크박스 이벤트
    $('#selectAllTaxInvoices').off('change').on('change', function () {
      $('.tax-invoice-checkbox').prop('checked', this.checked);
    });

  } catch (error) {
    console.error('❌ 세금계산서 목록 로드 실패:', error);
    alert('세금계산서 목록을 불러오는데 실패했습니다: ' + error.message);
  }
};

/**
 * 체크박스 선택 시 관리 버튼 표시/숨김 토글
 * 체크 시: 상세 버튼 숨김, 수정/삭제 버튼 표시
 * 체크 해제 시: 상세 버튼 표시, 수정/삭제 버튼 숨김
 */
window.toggleTaxInvoiceActions = function (작성년도, 책번호, 일련번호) {
  const actionId = `tax-invoice-actions-${작성년도}-${책번호}-${일련번호}`;
  const actionDiv = document.getElementById(actionId);
  const checkbox = document.querySelector(
    `.tax-invoice-checkbox[value="${작성년도}-${책번호}-${일련번호}"]`
  );

  if (actionDiv && checkbox) {
    const viewBtn = actionDiv.querySelector('.btn-view');
    const editBtn = actionDiv.querySelector('.btn-edit');
    const deleteBtn = actionDiv.querySelector('.btn-delete');

    if (checkbox.checked) {
      // 체크 시: 상세 숨김, 수정/삭제 표시
      if (viewBtn) viewBtn.style.display = 'none';
      if (editBtn) editBtn.style.display = 'inline-block';
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
      // 체크 해제 시: 상세 표시, 수정/삭제 숨김
      if (viewBtn) viewBtn.style.display = 'inline-block';
      if (editBtn) editBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
  }
};

/**
 * 날짜 필터 초기화 (오늘 날짜로 시작일과 종료일 동일하게 설정)
 */
function initializeTaxInvoiceDateFilters() {
  const today = new Date();

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  document.getElementById('taxInvoiceStartDate').value = formatDate(today);
  document.getElementById('taxInvoiceEndDate').value = formatDate(today);
}

/**
 * 세금계산서 필터링
 */
window.filterTaxInvoices = function () {
  console.log('🔍 세금계산서 필터 조회');
  // 날짜 초기화 건너뛰기 (사용자가 선택한 날짜 유지)
  window.loadTaxInvoices(true);
};

/**
 * 요약 정보 업데이트
 */
function updateTaxInvoiceSummary(taxInvoices) {
  const totalCount = taxInvoices.length;
  const totalSupply = taxInvoices.reduce((sum, item) => sum + (Number(item.공급가액) || 0), 0);
  const totalTax = taxInvoices.reduce((sum, item) => sum + (Number(item.세액) || 0), 0);

  document.getElementById('taxInvoiceCount').textContent = totalCount;
  document.getElementById('taxInvoiceTotalSupply').textContent = totalSupply.toLocaleString('ko-KR');
  document.getElementById('taxInvoiceTotalTax').textContent = totalTax.toLocaleString('ko-KR');
}

/**
 * 세금계산서 상세보기 모달 열기 (매출처 정보 + 자재입출내역 포함)
 */
window.openTaxInvoiceDetailModal = async function (작성년도, 책번호, 일련번호) {
  console.log(`📄 세금계산서 상세 조회: ${작성년도}-${책번호}-${일련번호}`);

  try {
    const 사업장코드 = sessionStorage.getItem('사업장코드') || '01';
    const response = await fetch(
      `/api/tax-invoices/${사업장코드}/${작성년도}/${책번호}/${일련번호}`
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '세금계산서 정보를 불러오는데 실패했습니다.');
    }

    // 응답 구조 확인 및 처리
    const master = result.data?.master || result.data;
    const details = result.data?.details || [];

    // 기본 정보 표시
    document.getElementById('detailTaxInvoiceNo').textContent = `${master.작성년도}-${master.책번호}-${master.일련번호}`;
    document.getElementById('detailTaxInvoiceDate').textContent = formatDate(master.작성일자);
    document.getElementById('detailTaxCustomerName').textContent = master.매출처명 || '-';
    document.getElementById('detailTaxBusinessNo').textContent = master.사업자번호 || '-';
    document.getElementById('detailTaxCeoName').textContent = master.대표자명 || '-';
    document.getElementById('detailTaxBusinessType').textContent =
      `${master.업태 || '-'} / ${master.업종 || '-'}`;
    document.getElementById('detailTaxAddress').textContent =
      `${master.주소 || ''} ${master.번지 || ''}`.trim() || '-';
    document.getElementById('detailTaxItemSpec').textContent = master.품목및규격 || '-';
    document.getElementById('detailTaxQuantity').textContent = Number(master.수량 || 0).toLocaleString('ko-KR');
    document.getElementById('detailTaxSupplyAmount').textContent = Number(master.공급가액 || 0).toLocaleString('ko-KR') + ' 원';
    document.getElementById('detailTaxAmount').textContent = Number(master.세액 || 0).toLocaleString('ko-KR') + ' 원';
    const total = (Number(master.공급가액) || 0) + (Number(master.세액) || 0);
    document.getElementById('detailTaxTotal').textContent = total.toLocaleString('ko-KR') + ' 원';
    document.getElementById('detailTaxIssued').textContent = master.발행여부 === 1 ? '발행완료' : '미발행';
    document.getElementById('detailTaxRemark').textContent = master.적요 || '-';

    // 자재입출내역 테이블 초기화 및 표시
    if ($.fn.DataTable.isDataTable('#taxInvoiceDetailItemsTable')) {
      $('#taxInvoiceDetailItemsTable').DataTable().destroy();
    }

    $('#taxInvoiceDetailItemsTable').DataTable({
      data: details,
      order: [], // 입력 순서 유지
      pageLength: 10,
      language: {
        url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/ko.json',
      },
      columns: [
        {
          // 순번
          data: null,
          render: function (data, type, row, meta) {
            return meta.row + 1;
          },
        },
        {
          data: '자재명',
        },
        {
          data: '규격',
          render: function (data) {
            return data || '-';
          },
        },
        {
          data: '단위',
          render: function (data) {
            return data || '-';
          },
        },
        {
          data: '수량',
          render: function (data) {
            return Number(data || 0).toLocaleString('ko-KR');
          },
        },
        {
          data: '단가',
          render: function (data) {
            return Number(data || 0).toLocaleString('ko-KR');
          },
        },
        {
          data: '공급가액',
          render: function (data) {
            return Number(data || 0).toLocaleString('ko-KR');
          },
        },
        {
          data: '부가세',
          render: function (data) {
            return Number(data || 0).toLocaleString('ko-KR');
          },
        },
        {
          data: '합계금액',
          render: function (data) {
            return `<strong style="color: #2563eb">${Number(data || 0).toLocaleString('ko-KR')}</strong>`;
          },
        },
        {
          data: '적요',
          render: function (data) {
            return data || '-';
          },
        },
      ],
    });

    // 전역 변수에 저장 (인쇄용)
    window.currentTaxInvoiceDetail = {
      작성년도: master.작성년도,
      책번호: master.책번호,
      일련번호: master.일련번호,
    };

    // 모달 표시
    const modal = document.getElementById('taxInvoiceDetailModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    console.log('✅ 세금계산서 상세 정보 로드 완료:', details.length, '개 품목');
  } catch (error) {
    console.error('❌ 세금계산서 상세 조회 실패:', error);
    alert('세금계산서 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

/**
 * 세금계산서 상세보기 모달 닫기
 */
window.closeTaxInvoiceDetailModal = function () {
  const modal = document.getElementById('taxInvoiceDetailModal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
};

/**
 * 세금계산서 수정 모달 열기
 */
window.openTaxInvoiceEditModal = async function (작성년도, 책번호, 일련번호) {
  console.log(`✏️ 세금계산서 수정 모달 열기: ${작성년도}-${책번호}-${일련번호}`);

  try {
    const 사업장코드 = sessionStorage.getItem('사업장코드') || '01';
    const response = await fetch(
      `/api/tax-invoices/${사업장코드}/${작성년도}/${책번호}/${일련번호}`
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '세금계산서 정보를 불러오는데 실패했습니다.');
    }

    const data = result.data.master; // 응답 구조 변경에 따른 수정
    currentEditTaxInvoice = data; // 현재 수정 중인 데이터 저장

    // 폼에 데이터 설정
    document.getElementById('editTaxInvoiceNo').value = `${data.작성년도}-${data.책번호}`;
    document.getElementById('editTaxInvoiceDate').value = formatDateForInput(data.작성일자);
    document.getElementById('editTaxItemSpec').value = data.품목및규격 || '';
    document.getElementById('editTaxQuantity').value = data.수량 || 0;
    document.getElementById('editTaxSupplyAmount').value = data.공급가액 || 0;
    document.getElementById('editTaxAmount').value = data.세액 || 0;
    const total = (Number(data.공급가액) || 0) + (Number(data.세액) || 0);
    document.getElementById('editTaxTotal').value = total;
    document.getElementById('editTaxIssued').value = data.발행여부 || 0;
    document.getElementById('editTaxRemark').value = data.적요 || '';

    // 모달 표시
    const editModal = document.getElementById('taxInvoiceEditModal');
    editModal.classList.remove('hidden');
    editModal.style.display = 'flex';

    // 폼 제출 이벤트 바인딩
    const form = document.getElementById('taxInvoiceEditForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await saveTaxInvoiceEdit();
    };

    // 취소 버튼 이벤트
    document.getElementById('cancelTaxInvoiceEditBtn').onclick = closeTaxInvoiceEditModal;
    document.getElementById('closeTaxInvoiceEditModalBtn').onclick = closeTaxInvoiceEditModal;

  } catch (error) {
    console.error('❌ 세금계산서 수정 모달 열기 실패:', error);
    alert('세금계산서 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

/**
 * 세금계산서 수정 모달 닫기
 */
function closeTaxInvoiceEditModal() {
  const editModal = document.getElementById('taxInvoiceEditModal');
  editModal.classList.add('hidden');
  editModal.style.display = 'none';
  currentEditTaxInvoice = null;
}

/**
 * 공급가액 변경 시 세액 및 합계 자동 계산
 */
window.calculateTaxInvoiceTotal = function () {
  const supplyAmount = Number(document.getElementById('editTaxSupplyAmount').value) || 0;
  const taxAmount = Math.round(supplyAmount * 0.1);
  const total = supplyAmount + taxAmount;

  document.getElementById('editTaxAmount').value = taxAmount;
  document.getElementById('editTaxTotal').value = total;
};

/**
 * 세금계산서 수정 저장
 */
async function saveTaxInvoiceEdit() {
  console.log('💾 세금계산서 수정 저장');

  try {
    if (!currentEditTaxInvoice) {
      throw new Error('수정할 세금계산서 데이터가 없습니다.');
    }

    const 사업장코드 = sessionStorage.getItem('사업장코드') || '01';
    const 작성년도 = currentEditTaxInvoice.작성년도;
    const 책번호 = currentEditTaxInvoice.책번호;
    const 일련번호 = currentEditTaxInvoice.일련번호;

    const updateData = {
      작성일자: document.getElementById('editTaxInvoiceDate').value.replace(/-/g, ''),
      품목및규격: document.getElementById('editTaxItemSpec').value,
      수량: Number(document.getElementById('editTaxQuantity').value),
      공급가액: Number(document.getElementById('editTaxSupplyAmount').value),
      세액: Number(document.getElementById('editTaxAmount').value),
      발행여부: Number(document.getElementById('editTaxIssued').value),
      적요: document.getElementById('editTaxRemark').value,
    };

    const response = await fetch(
      `/api/tax-invoices/${사업장코드}/${작성년도}/${책번호}/${일련번호}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '세금계산서 수정에 실패했습니다.');
    }

    alert('세금계산서가 수정되었습니다.');
    closeTaxInvoiceEditModal();
    window.loadTaxInvoices(true); // 목록 새로고침 (날짜 유지)

  } catch (error) {
    console.error('❌ 세금계산서 수정 실패:', error);
    alert('세금계산서 수정에 실패했습니다: ' + error.message);
  }
}

/**
 * 세금계산서 삭제 모달 열기
 */
window.deleteTaxInvoice = function (작성년도, 책번호, 일련번호) {
  console.log(`🗑️ 세금계산서 삭제 모달 열기: ${작성년도}-${책번호}-${일련번호}`);

  // 삭제할 세금계산서 정보 저장
  currentDeleteTaxInvoice = {
    작성년도,
    책번호,
    일련번호,
  };

  // 모달에 정보 표시
  document.getElementById('deleteTaxInvoiceInfo').textContent =
    `세금계산서 번호: ${작성년도}-${책번호}-${일련번호}`;

  // 모달 표시
  const modal = document.getElementById('taxInvoiceDeleteModal');
  modal.style.display = 'flex';
};

/**
 * 세금계산서 삭제 모달 닫기
 */
window.closeTaxInvoiceDeleteModal = function () {
  const modal = document.getElementById('taxInvoiceDeleteModal');
  modal.style.display = 'none';
  currentDeleteTaxInvoice = null;
};

/**
 * 세금계산서 삭제 확인 실행
 */
window.confirmTaxInvoiceDelete = async function () {
  if (!currentDeleteTaxInvoice) {
    console.error('❌ 삭제할 세금계산서 정보가 없습니다.');
    return;
  }

  const { 작성년도, 책번호, 일련번호 } = currentDeleteTaxInvoice;
  console.log(`🗑️ 세금계산서 삭제 실행: ${작성년도}-${책번호}-${일련번호}`);

  try {
    const 사업장코드 = sessionStorage.getItem('사업장코드') || '01';
    const response = await fetch(
      `/api/tax-invoices/${사업장코드}/${작성년도}/${책번호}/${일련번호}`,
      {
        method: 'DELETE',
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '세금계산서 삭제에 실패했습니다.');
    }

    alert('세금계산서가 삭제되었습니다.');
    closeTaxInvoiceDeleteModal();
    window.loadTaxInvoices(true); // 목록 새로고침 (날짜 유지)

  } catch (error) {
    console.error('❌ 세금계산서 삭제 실패:', error);
    alert('세금계산서 삭제에 실패했습니다: ' + error.message);
  }
};

/**
 * 신규 세금계산서 발행 모달 열기 (추후 구현)
 */
window.openNewTaxInvoiceModal = function () {
  alert('세금계산서 발행 기능은 거래명세서에서 자동 생성됩니다.\n(추후 수동 발행 기능 추가 예정)');
};

/**
 * CSV 내보내기 (Google Sheets용)
 */
window.exportTaxInvoicesToCSV = function () {
  if (!taxInvoiceTable) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const data = taxInvoiceTable
    .rows()
    .data()
    .toArray()
    .map((row) => ({
      작성년도: row.작성년도,
      책번호: row.책번호,
      일련번호: row.일련번호,
      작성일자: row.작성일자,
      매출처명: row.매출처명,
      사업자번호: row.사업자번호 || '',
      품목및규격: row.품목및규격,
      수량: row.수량,
      공급가액: row.공급가액,
      세액: row.세액,
      합계금액: (Number(row.공급가액) || 0) + (Number(row.세액) || 0),
      발행여부: row.발행여부 === 1 || row.발행여부 === '1' ? '발행완료' : '미발행',
      적요: row.적요 || '',
    }));

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' + // BOM for Excel Korean support
    [
      '작성년도,책번호,일련번호,작성일자,매출처명,사업자번호,품목및규격,수량,공급가액,세액,합계금액,발행여부,적요',
      ...data.map((r) =>
        [
          r.작성년도,
          r.책번호,
          r.일련번호,
          r.작성일자,
          `"${r.매출처명}"`, // 쉼표 포함 가능성 있어 따옴표로 감싸기
          r.사업자번호,
          `"${r.품목및규격}"`, // 쉼표 포함 가능성 있어 따옴표로 감싸기
          r.수량,
          r.공급가액,
          r.세액,
          r.합계금액,
          r.발행여부,
          `"${r.적요}"`, // 쉼표 포함 가능성 있어 따옴표로 감싸기
        ].join(','),
      ),
    ].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);

  // 파일명에 날짜 포함
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  link.setAttribute('download', `세금계산서목록_${dateStr}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('✅ 세금계산서 CSV 내보내기 완료');
};

/**
 * 날짜 포맷 변환 (YYYYMMDD → YYYY-MM-DD)
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

/**
 * 날짜 포맷 변환 (YYYYMMDD → YYYY-MM-DD for input)
 */
function formatDateForInput(dateStr) {
  if (!dateStr || dateStr.length !== 8) return '';
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

/**
 * 세금계산서 인쇄 함수
 * @param {string} 작성년도 - 작성년도 (YYYY)
 * @param {number} 책번호 - 책번호
 * @param {number} 일련번호 - 일련번호
 */
async function printTaxInvoice(작성년도, 책번호, 일련번호) {
  try {
    console.log('📄 세금계산서 인쇄 시작:', { 작성년도, 책번호, 일련번호 });

    // 새로운 인쇄 전용 API 호출
    const response = await fetch(`/api/tax-invoices/${작성년도}/${책번호}/${일련번호}/print`);
    const result = await response.json();

    if (!result.success || !result.data) {
      alert('세금계산서 정보를 불러올 수 없습니다.');
      return;
    }

    const { header } = result.data;

    // 출력 창 생성 (A4 크기)
    const printWindow = window.open('', '_blank', 'width=800,height=900');

    // 날짜 포맷팅 함수
    const formatPrintDate = (dateStr) => {
      if (!dateStr) return '-';
      return dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    };

    // 사업자번호 포맷팅 (000-00-00000)
    const formatBusinessNo = (no) => {
      if (!no) return '-';
      const cleaned = no.replace(/[^0-9]/g, '');
      if (cleaned.length === 10) {
        return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 5)}-${cleaned.substring(5)}`;
      }
      return no;
    };

    // HTML 생성 - 전자세금계산서 표준 양식 스타일
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>세금계산서 - ${header.작성년도}-${header.책번호}-${header.일련번호}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: '맑은 고딕', 'Malgun Gothic', Arial, sans-serif;
            font-size: 9pt;
            line-height: 1.3;
            padding: 5mm;
            background: white;
          }

          .document {
            width: 180mm;
            margin: 0 auto;
            background: white;
            border: 2px solid #000;
          }

          /* 제목 */
          .title {
            text-align: center;
            font-size: 20pt;
            font-weight: bold;
            padding: 8mm 0 6mm 0;
            border-bottom: 2px solid #000;
            letter-spacing: 8px;
          }

          /* 승인번호 */
          .approval-section {
            text-align: right;
            padding: 2mm 5mm;
            font-size: 8pt;
            border-bottom: 1px solid #ccc;
          }

          /* 공급자/공급받는자 정보 */
          .info-section {
            display: flex;
            border-bottom: 2px solid #000;
          }

          .info-column {
            flex: 1;
            padding: 3mm;
          }

          .info-column.left {
            border-right: 2px solid #000;
          }

          .info-title {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 2mm;
            padding-bottom: 1mm;
            border-bottom: 1px solid #666;
          }

          .info-row {
            display: flex;
            margin-bottom: 1.5mm;
            font-size: 8.5pt;
          }

          /* 두 개의 필드를 같은 라인에 표시 */
          .info-row-dual {
            display: flex;
            margin-bottom: 1.5mm;
            font-size: 8.5pt;
          }

          .info-row-dual .info-group {
            display: flex;
            flex: 1;
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

          .info-row-dual .info-label {
            width: 70px;
            font-weight: bold;
            color: #333;
          }

          .info-row-dual .info-value {
            flex: 1;
            color: #000;
            margin-right: 2mm;
          }

          /* 금액 정보 */
          .amount-section {
            display: flex;
            border-bottom: 2px solid #000;
          }

          .amount-box {
            flex: 1;
            text-align: center;
            padding: 3mm 0;
            border-right: 1px solid #000;
          }

          .amount-box:last-child {
            border-right: none;
          }

          .amount-label {
            font-size: 8pt;
            font-weight: bold;
            margin-bottom: 2mm;
            color: #333;
          }

          .amount-value {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            font-family: 'Courier New', monospace;
          }

          /* 품목 정보 */
          .item-section {
            padding: 3mm;
            border-bottom: 2px solid #000;
            min-height: 60mm;
          }

          .item-title {
            font-size: 9pt;
            font-weight: bold;
            margin-bottom: 2mm;
            padding-bottom: 1mm;
            border-bottom: 1px solid #999;
          }

          .item-row {
            display: flex;
            margin-bottom: 1mm;
            font-size: 8.5pt;
          }

          .item-label {
            width: 60px;
            font-weight: bold;
          }

          .item-value {
            flex: 1;
          }

          /* 하단 참고사항 */
          .footer-section {
            padding: 3mm;
            font-size: 7.5pt;
            line-height: 1.6;
            background-color: #fafafa;
          }

          /* 발행일시 */
          .issue-date {
            text-align: right;
            padding: 2mm 3mm;
            font-size: 8pt;
            border-top: 1px solid #ccc;
          }

          @media print {
            body {
              padding: 0;
            }
            .document {
              width: 100%;
              border: none;
            }
            @page {
              margin: 10mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <!-- 제목 -->
          <div class="title">세 금 계 산 서</div>

          <!-- 승인번호 (전자세금계산서인 경우) -->
          <div class="approval-section">
            승인번호: ${header.작성년도}-${header.책번호}-${header.일련번호}
          </div>

          <!-- 공급자/공급받는자 정보 -->
          <div class="info-section">
            <!-- 공급자 정보 (좌측) -->
            <div class="info-column left">
              <div class="info-title">공급자</div>
              <div class="info-row">
                <span class="info-label">등록번호</span>
                <span class="info-value">${formatBusinessNo(header.좌등록번호)}</span>
              </div>
              <div class="info-row-dual">
                <div class="info-group">
                  <span class="info-label">상호(법인명)</span>
                  <span class="info-value">${header.좌상호법인명}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">성명(대표자)</span>
                  <span class="info-value">${header.좌성명}</span>
                </div>
              </div>
              <div class="info-row">
                <span class="info-label">사업장주소</span>
                <span class="info-value">${header.좌사업장주소}</span>
              </div>
              <div class="info-row-dual">
                <div class="info-group">
                  <span class="info-label">업태</span>
                  <span class="info-value">${header.좌업태}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">종목</span>
                  <span class="info-value">${header.좌종목}</span>
                </div>
              </div>
              <div class="info-row">
                <span class="info-label">전화번호</span>
                <span class="info-value">${header.좌전화번호}</span>
              </div>
            </div>

            <!-- 공급받는자 정보 (우측) -->
            <div class="info-column">
              <div class="info-title">공급받는자</div>
              <div class="info-row">
                <span class="info-label">등록번호</span>
                <span class="info-value">${formatBusinessNo(header.우등록번호)}</span>
              </div>
              <div class="info-row-dual">
                <div class="info-group">
                  <span class="info-label">상호(법인명)</span>
                  <span class="info-value">${header.우상호법인명}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">성명(대표자)</span>
                  <span class="info-value">${header.우성명}</span>
                </div>
              </div>
              <div class="info-row">
                <span class="info-label">사업장주소</span>
                <span class="info-value">${header.우사업장주소}</span>
              </div>
              <div class="info-row-dual">
                <div class="info-group">
                  <span class="info-label">업태</span>
                  <span class="info-value">${header.우업태}</span>
                </div>
                <div class="info-group">
                  <span class="info-label">종목</span>
                  <span class="info-value">${header.우종목}</span>
                </div>
              </div>
              <div class="info-row">
                <span class="info-label">전화번호</span>
                <span class="info-value">${header.우전화번호}</span>
              </div>
            </div>
          </div>

          <!-- 금액 정보 -->
          <div class="amount-section">
            <div class="amount-box">
              <div class="amount-label">공급가액</div>
              <div class="amount-value">${header.공급가액.toLocaleString()}</div>
            </div>
            <div class="amount-box">
              <div class="amount-label">세액</div>
              <div class="amount-value">${header.세액.toLocaleString()}</div>
            </div>
            <div class="amount-box">
              <div class="amount-label">합계금액</div>
              <div class="amount-value">${header.합계금액.toLocaleString()}</div>
            </div>
          </div>

          <!-- 품목 정보 -->
          <div class="item-section">
            <div class="item-title">품목 정보</div>
            <div class="item-row">
              <span class="item-label">작성일자</span>
              <span class="item-value">${formatPrintDate(header.작성일자)}</span>
            </div>
            <div class="item-row">
              <span class="item-label">품목 및 규격</span>
              <span class="item-value">${header.품목및규격}</span>
            </div>
            <div class="item-row">
              <span class="item-label">건수</span>
              <span class="item-value">${(header.수량 || 0).toLocaleString()}</span>
            </div>
            <div class="item-row">
              <span class="item-label">비고</span>
              <span class="item-value">
                ${header.금액구분 === 1 ? '[현금]' : ''}
                ${header.영청구분 === 1 ? '[영수]' : header.영청구분 === 2 ? '[청구]' : ''}
                ${header.미수구분 === 1 ? '[미수]' : ''}
              </span>
            </div>
          </div>

          <!-- 하단 참고사항 -->
          <div class="footer-section">
            <strong>※ 참고사항</strong><br>
            · 이 세금계산서는 부가가치세법 제32조 및 제54조에 의하여 발급되었습니다.<br>
            · 공급가액과 세액을 별도로 구분하여 기재하였습니다.<br>
            · 세금계산서 관련 문의사항은 공급자에게 연락 바랍니다.
          </div>

          <!-- 발행일시 -->
          <div class="issue-date">
            발행일시: ${formatPrintDate(header.작성일자)}
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

    console.log('✅ 세금계산서 인쇄 완료');
  } catch (error) {
    console.error('❌ 세금계산서 인쇄 실패:', error);
    alert('세금계산서 인쇄 중 오류가 발생했습니다.');
  }
}

/**
 * 상세 모달에서 출력 버튼 클릭 시 호출되는 래퍼 함수
 */
function printTaxInvoiceFromDetail() {
  if (!window.currentTaxInvoiceDetail) {
    alert('출력할 세금계산서 정보가 없습니다.');
    return;
  }

  const { 작성년도, 책번호, 일련번호 } = window.currentTaxInvoiceDetail;
  printTaxInvoice(작성년도, 책번호, 일련번호);
  console.log('✅ 세금계산서 출력:', { 작성년도, 책번호, 일련번호 });
}

// 전역 함수 노출
window.printTaxInvoice = printTaxInvoice;
window.printTaxInvoiceFromDetail = printTaxInvoiceFromDetail;

console.log('✅ taxinvoice.js 로드 완료');
