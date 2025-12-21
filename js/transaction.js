// ✅ 거래명세서관리 스크립트 (transaction.js)
// 최초 1회만 호출

// ✅ Prefix 규칙 준수: transactionTableInstance → window.transactionTable
window.transactionTable = null;
let isTransactionSelectAllMode = false; // 전체선택 모드 플래그

function initTransactionDates() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const start = document.getElementById('transactionStartDate');
  const end = document.getElementById('transactionEndDate');
  if (!start.value) start.value = todayStr;
  if (!end.value) end.value = todayStr;
}

// ✅ 거래명세서 페이지 초기화 함수 (showPage에서 호출)
window.initTransactionPage = function () {
  // 날짜 초기화
  initTransactionDates();

  // 데이터 로드
  loadTransactions();

  // ✅ 수정 모달 닫기 버튼 이벤트 (네임스페이스 사용)
  $(document).on('click.transactionManagePage', '#closeTransactionEditModalBtn', () => {
    closeTransactionEditModal();
  });

  // ✅ 수정 모달 배경 클릭시 닫기 (네임스페이스 사용)
  $(document).on('click.transactionManagePage', '#openTransactionEditModal', function (e) {
    if (e.target.id === 'openTransactionEditModal') {
      closeTransactionEditModal();
    }
  });

  // ✅ 품목 수정 모달 닫기 버튼 이벤트 (네임스페이스 사용)
  $(document).on('click.transactionManagePage', '#transactionItemEditModalCloseBtn', () => {
    closeTransactionItemEditModal();
  });
};

// ✅ 거래명세서 목록 불러오기
async function loadTransactions() {
  // ✅ transaction 페이지의 이벤트만 제거 (네임스페이스 사용)
  $(document).off('.transactionManagePage');

  // 페이지가 표시될 때마다 날짜를 오늘 날짜(로그인 날짜)로 초기화
  // const today = new Date();
  // const todayStr = today.toISOString().slice(0, 10);

  const startDateInput = document.getElementById('transactionStartDate');
  const endDateInput = document.getElementById('transactionEndDate');

  // 항상 오늘 날짜로 설정
  // if (startDateInput) {
  //   startDateInput.value = todayStr;
  // }
  // if (endDateInput) {
  //   endDateInput.value = todayStr;
  // }
  try {
    // ✅ 안전한 엘리먼트 접근
    const startDateEl = document.getElementById('transactionStartDate');
    const endDateEl = document.getElementById('transactionEndDate');
    const statusEl = document.getElementById('transactionStatusFilter');

    if (!startDateEl || !endDateEl || !statusEl) {
      console.warn('필수 입력 요소를 찾을 수 없습니다.');
      return;
    }

    const startDate = startDateEl.value;
    const endDate = endDateEl.value;
    const status = statusEl.value;

    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    if (status) query.append('status', status);

    const res = await fetch(`/api/transactions?${query.toString()}`, {
      credentials: 'include', // 세션 쿠키 포함
    });
    const data = await res.json();

    if (!data.success) throw new Error('데이터를 불러오지 못했습니다.');

    const tableData = data.data || [];

    // ✅ 안전한 카운트 업데이트
    const countEl = document.getElementById('transactionCount');
    if (countEl) {
      countEl.textContent = tableData.length;
    }

    // ✅ DataTable 재사용 패턴: 없으면 생성, 있으면 데이터만 업데이트
    if (!window.transactionTable || typeof window.transactionTable.clear !== 'function') {
      // ✅ DataTable 인스턴스가 손상된 경우 복구
      if ($.fn.DataTable.isDataTable('#transactionTable')) {
        $('#transactionTable').DataTable().destroy();
        $('#transactionTable').empty();
      }

      // ✅ DataTable 초기화 (최초 1회만)
      window.transactionTable = $('#transactionTable').DataTable({
        data: [],
        columns: [
          {
            data: null,
            render: (data, type, row, meta) =>
              `<input type="checkbox" class="transactionCheckbox" data-date="${row.거래일자}" data-no="${row.거래번호}">`,
            orderable: false,
          },
          {
            data: null,
            render: (data, type, row, meta) => meta.row + 1,
            defaultContent: '-',
          },
          { data: '명세서번호', defaultContent: '-' },
          {
            data: '거래일자',
            render: (data) => (data ? data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'),
          },
          { data: '매출처명', defaultContent: '-' },
          {
            data: '출고금액',
            render: (d) => (d ? d.toLocaleString() : '0'),
            className: 'dt-right',
          },
          {
            data: '출고부가세',
            render: (d) => (d ? d.toLocaleString() : '0'),
            className: 'dt-right',
          },
          {
            data: null,
            render: (data, type, row) => {
              const 출고금액 = row.출고금액 || 0;
              const 출고부가세 = row.출고부가세 || 0;
              return (출고금액 + 출고부가세).toLocaleString();
            },
            className: 'dt-right',
          },
          { data: '작성자', defaultContent: '-' },
          {
            data: '입출고구분',
            render: (d) => renderTransactionStatus(d),
          },
          {
            data: null,
            render: (data, type, row) => {
              return `
              <div id="transactionActions-${row.거래일자}_${row.거래번호}" style="display: flex; gap: 4px; justify-content: center;">
                <button class="btn-icon transactionBtnView" onclick="openTransactionViewModal('${row.명세서번호}')" title="보기">상세</button>
                <button class="btn-icon transactionBtnEdit" style="display: none;" onclick="editTransaction('${row.거래일자}', ${row.거래번호})" title="수정">수정</button>
                <button class="btn-icon transactionBtnDelete" style="display: none;" onclick="deleteTransaction('${row.거래일자}', ${row.거래번호})" title="삭제">삭제</button>
                <!--<button class="btn-icon transactionBtnApprove" style="display: none;" onclick="approveTransaction('${row.거래일자}', ${row.거래번호})" title="확정">확정</button>-->
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
        drawCallback: function () {
          // 전체선택 체크박스 상태 확인
          const isSelectAllChecked = $('#transactionSelectAll').prop('checked');

          // 전체선택 상태에 따라 현재 페이지의 모든 체크박스 동기화
          $('.transactionCheckbox').prop('checked', isSelectAllChecked);

          // DataTable이 다시 그려질 때마다 체크박스 상태에 따라 버튼 표시
          $('.transactionCheckbox').each(function () {
            const $checkbox = $(this);
            const transactionDate = String($checkbox.data('date'));
            const transactionNo = String($checkbox.data('no'));
            const isChecked = $checkbox.prop('checked');
            const actionDiv = $('#transactionActions-' + transactionDate + '_' + transactionNo);

            if (isChecked) {
              actionDiv.find('.transactionBtnView').hide();
              actionDiv.find('.transactionBtnEdit').show();
              actionDiv.find('.transactionBtnDelete').show();
              actionDiv.find('.transactionBtnApprove').show();
            } else {
              actionDiv.find('.transactionBtnView').show();
              actionDiv.find('.transactionBtnEdit').hide();
              actionDiv.find('.transactionBtnDelete').hide();
              actionDiv.find('.transactionBtnApprove').hide();
            }
          });
        },
      });
    }

    // ✅ DataTable에 데이터 업데이트 (재사용 패턴)
    window.transactionTable.clear().rows.add(tableData).draw();

    // ✅ 전체선택 체크박스 이벤트 핸들러 등록 (네임스페이스 사용)
    $(document)
      .off('change.transactionManagePage', '#transactionSelectAll')
      .on('change.transactionManagePage', '#transactionSelectAll', function () {
        const isChecked = $(this).prop('checked');

        // 전체선택 모드 플래그 설정
        isTransactionSelectAllMode = true;
        $('.transactionCheckbox').prop('checked', isChecked).trigger('change');
        isTransactionSelectAllMode = false;
      });

    // ✅ 개별 체크박스 이벤트 핸들러 등록 (네임스페이스 사용)
    $(document)
      .off('change.transactionManagePage', '.transactionCheckbox')
      .on('change.transactionManagePage', '.transactionCheckbox', function () {
        const $currentCheckbox = $(this);
        const transactionDate = String($currentCheckbox.data('date'));
        const transactionNo = String($currentCheckbox.data('no'));
        const isChecked = $currentCheckbox.prop('checked');

        // 개별 선택 모드일 때만 단일 선택 로직 실행
        if (!isTransactionSelectAllMode && isChecked) {
          // 체크된 경우: 다른 모든 체크박스 해제
          $('.transactionCheckbox')
            .not($currentCheckbox)
            .each(function () {
              const $otherCheckbox = $(this);
              const otherDate = String($otherCheckbox.data('date'));
              const otherNo = String($otherCheckbox.data('no'));

              $otherCheckbox.prop('checked', false);

              const otherActionDiv = $('#transactionActions-' + otherDate + '_' + otherNo);
              otherActionDiv.find('.transactionBtnView').show();
              otherActionDiv.find('.transactionBtnEdit').hide();
              otherActionDiv.find('.transactionBtnDelete').hide();
              otherActionDiv.find('.transactionBtnApprove').hide();
            });
        }

        // 전체 선택 체크박스 상태 업데이트
        const totalCheckboxes = $('.transactionCheckbox').length;
        const checkedCheckboxes = $('.transactionCheckbox:checked').length;
        $('#transactionSelectAll').prop('checked', totalCheckboxes === checkedCheckboxes);

        // 현재 행의 버튼 표시/숨김 처리
        const actionDiv = $('#transactionActions-' + transactionDate + '_' + transactionNo);

        if (isChecked) {
          // 체크됨: 상세 버튼 숨기고 수정/삭제 버튼 표시
          actionDiv.find('.transactionBtnView').hide();
          actionDiv.find('.transactionBtnEdit').show();
          actionDiv.find('.transactionBtnDelete').show();
          actionDiv.find('.transactionBtnApprove').show();
        } else {
          // 체크 해제: 수정/삭제 버튼 숨기고 상세 버튼 표시
          actionDiv.find('.transactionBtnView').show();
          actionDiv.find('.transactionBtnEdit').hide();
          actionDiv.find('.transactionBtnDelete').hide();
          actionDiv.find('.transactionBtnApprove').hide();
        }
      });
  } catch (err) {
    console.error('❌ 거래명세서 조회 오류:', err);
    alert('거래명세서를 불러오는 중 오류가 발생했습니다.');
  }
}

// ✅ 상태 표시 포맷
function renderTransactionStatus(statusCode) {
  switch (statusCode) {
    case 1:
      return `<span class="badge bg-warning">작성중</span>`;
    case 2:
      return `<span class="badge bg-info">확정</span>`;
    case 3:
      return `<span class="badge bg-success">발행완료</span>`;
    default:
      return `<span class="badge bg-secondary">미지정</span>`;
  }
}

// ✅ 필터 적용 (상태 + 기간)
window.filterTransactions = function filterTransactions() {
  loadTransactions();
};

// ✅ 거래명세서 상세보기 (Prefix 규칙: transactionViewModal)
window.openTransactionViewModal = async function openTransactionViewModal(transactionNo) {
  const modal = document.getElementById('openTransactionViewModal');
  modal.style.display = 'flex';
  modal.classList.remove('hidden');

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.openTransactionViewModalDraggable) {
    makeModalDraggable('openTransactionViewModal', 'openTransactionViewModalHeader');
    window.openTransactionViewModalDraggable = true;
  }

  try {
    // 명세서번호 형식: "YYYYMMDD-번호" 를 분리
    const [date, no] = transactionNo.split('-');

    const res = await fetch(`/api/transactions/${date}/${no}`, { credentials: 'include' });
    const result = await res.json();

    if (!result.success) throw new Error(result.message || '상세 정보를 불러올 수 없습니다.');

    // API는 details 배열만 반환 (master는 없음)
    const details = result.data || [];
    const firstDetail = details[0] || {};

    // ✅ 출력 버튼을 위해 현재 거래명세서 정보 저장
    window.currentTransactionDetail = {
      거래일자: date,
      거래번호: no,
      명세서번호: transactionNo,
    };

    // 기본 정보 표시
    document.getElementById('transactionDetailTransactionNo').textContent = transactionNo;
    document.getElementById('transactionDetailTransactionDate').textContent = date.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    // 매출처명(매출처코드) 형식으로 표시
    const customerDisplay = firstDetail.매출처명
      ? `${firstDetail.매출처명}(${firstDetail.매출처코드 || '-'})`
      : '-';
    document.getElementById('transactionDetailCustomerName').textContent = customerDisplay;
    document.getElementById('transactionDetailUserName').textContent = firstDetail.사용자명 || '-';

    // ✅ 상세 DataTable 초기화 (최초 1회만 생성, 이후 데이터만 업데이트)
    if (
      !window.transactionViewDetailTable ||
      !$.fn.DataTable.isDataTable('#transactionViewDetailTable')
    ) {
      window.transactionViewDetailTable = $('#transactionViewDetailTable').DataTable({
        data: [],
        columns: [
          {
            data: null,
            render: (data, type, row, meta) => meta.row + 1,
            className: 'dt-center',
            width: '70px',
          },
          {
            data: '자재코드',
            defaultContent: '-',
            width: '100px',
            render: (d) => {
              if (!d) return '-';
              // 자재코드에서 분류코드(2자리)만 제거, 세부코드 표시
              return d.length > 2 ? d.substring(2) : d;
            },
          },
          {
            data: '자재명',
            defaultContent: '-',
            width: '200px',
          },
          {
            data: '규격',
            defaultContent: '-',
            width: '150px',
          },
          {
            data: '단위',
            defaultContent: '-',
            width: '70px',
          },
          {
            data: '수량',
            render: (d) => (d ? d.toLocaleString() : '0'),
            className: 'dt-right',
            width: '100px',
          },
          {
            data: '단가',
            render: (d) => (d ? d.toLocaleString() : '0'),
            className: 'dt-right',
            width: '120px',
          },
          {
            data: '합계금액',
            render: (d) => (d ? d.toLocaleString() : '0'),
            className: 'dt-right',
            width: '130px',
          },
        ],
        order: [], // 정렬 비활성화 - 입력 순서대로 표시
        pageLength: 10,
        autoWidth: false, // 자동 너비 조정 비활성화
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
      });
    }

    // ✅ 기존 테이블이 있으면 데이터만 업데이트 (테이블 재생성 안함)
    window.transactionViewDetailTable.clear().rows.add(details).draw();

    // ✅ 합계 계산
    const total = details.reduce((sum, item) => sum + (item.합계금액 || 0), 0);
    document.getElementById('transactionDetailTotal').textContent = total.toLocaleString();
  } catch (err) {
    console.error('❌ 거래명세서 상세 조회 오류:', err);
    alert('상세 조회 중 오류가 발생했습니다.');
  }
};

// 거래명세서 작성용 상세내역 배열
let newTransactionDetails = [];

// ✅ 거래명세서 작성 모달 열기
window.openTransactionCreateModal = function openTransactionCreateModal() {
  // 폼 초기화
  document.getElementById('transactionCreateForm').reset();

  // 거래일자를 오늘 날짜로 설정
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('transactionCreateDate').value = today;

  // 매출처 검색 입력 필드 초기화
  const searchInput = document.getElementById('transactionCreateCustomerSearch');
  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = '매출처 코드 또는 이름 입력 후 엔터';
  }

  // 선택된 매출처 표시 영역 숨김
  const displayDiv = document.getElementById('transactionSelectedCustomerDisplay');
  if (displayDiv) {
    displayDiv.style.display = 'none';
  }

  // ✅ 테이블 초기화 (빈 메시지 표시)
  const tbody = document.getElementById('transactionCreateDetailTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="10" style="padding: 40px; text-align: center; color: #6b7280;">
        자재 추가 버튼을 클릭하여 거래 상세내역을 입력하세요
      </td>
    </tr>
  `;

  // 합계 초기화
  document.getElementById('transactionCreateTotalSupply').textContent = '0';
  document.getElementById('transactionCreateTotalVat').textContent = '0';
  document.getElementById('transactionCreateGrandTotal').textContent = '0';

  // 모달 표시
  document.getElementById('openTransactionCreateModal').style.display = 'block';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.openTransactionCreateModalDraggable) {
    makeModalDraggable('openTransactionCreateModal', 'openTransactionCreateModalHeader');
    window.openTransactionCreateModalDraggable = true;
  }
};

// ✅ 거래명세서 작성 모달 닫기
window.closeTransactionCreateModal = function closeTransactionCreateModal() {
  document.getElementById('openTransactionCreateModal').style.display = 'none';
  newTransactionDetails = [];
};

// ✅ 매출처 검색 모달 열기 (거래명세서용)
function openTransactionCustomerSearchModal() {
  // 검색 입력 필드의 값을 가져와서 모달 검색창에 자동 입력
  const searchInput = document.getElementById('transactionCreateCustomerSearch');
  const searchText = searchInput ? searchInput.value.trim() : '';

  document.getElementById('transactionCustomerSearchModal').style.display = 'block';
  document.getElementById('transactionCustomerSearchInput').value = searchText;

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.transactionCustomerSearchModalDraggable) {
    makeModalDraggable('transactionCustomerSearchModal', 'transactionCustomerSearchModalHeader');
    window.transactionCustomerSearchModalDraggable = true;
  }

  // 검색어가 있으면 자동으로 검색 실행
  if (searchText) {
    searchTransactionCustomers();
  }
}

// ✅ 매출처 검색 모달 닫기
function closeTransactionCustomerSearchModal() {
  document.getElementById('transactionCustomerSearchModal').style.display = 'none';
}

// ✅ 매출처 검색
async function searchTransactionCustomers() {
  try {
    const searchText = document.getElementById('transactionCustomerSearchInput').value.trim();

    const response = await fetch(`/api/customers?search=${encodeURIComponent(searchText)}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '매출처 조회 실패');
    }

    const tbody = document.getElementById('transactionCustomerSearchTableBody');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 40px; text-align: center; color: #6b7280;">
            검색 결과가 없습니다
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = result.data
      .map(
        (customer) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px;">${customer.매출처코드}</td>
        <td style="padding: 12px;">${customer.매출처명}</td>
        <td style="padding: 12px;">${customer.전화번호 || '-'}</td>
        <td style="padding: 12px; text-align: center;">
          <button onclick='selectTransactionCustomer(${JSON.stringify(customer).replace(
            /'/g,
            '&apos;',
          )})' style="
            padding: 6px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
          " onmouseover="this.style.background='#1d4ed8';"
             onmouseout="this.style.background='#2563eb';">선택</button>
        </td>
      </tr>
    `,
      )
      .join('');
  } catch (err) {
    console.error('❌ 매출처 검색 오류:', err);
    alert('매출처 검색 중 오류가 발생했습니다.');
  }
}

// ✅ 매출처 선택
function selectTransactionCustomer(customer) {
  // 숨김 필드에 값 설정
  document.getElementById('transactionCreateCustomerCode').value = customer.매출처코드;
  document.getElementById('transactionCreateCustomerName').value = customer.매출처명;

  // 검색 입력 필드에 선택된 정보 표시
  const searchInput = document.getElementById('transactionCreateCustomerSearch');
  searchInput.value = `${customer.매출처명} (${customer.매출처코드})`;

  // 선택된 매출처 표시 영역 업데이트
  const displayDiv = document.getElementById('transactionSelectedCustomerDisplay');
  const infoSpan = document.getElementById('transactionSelectedCustomerInfo');
  infoSpan.textContent = `✓ ${customer.매출처명} (${customer.매출처코드})`;
  displayDiv.style.display = 'block';

  closeTransactionCustomerSearchModal();
}

// ✅ 매출처 선택 취소
function clearTransactionSelectedCustomer() {
  // 숨김 필드 초기화
  document.getElementById('transactionCreateCustomerCode').value = '';
  document.getElementById('transactionCreateCustomerName').value = '';

  // 검색 입력 필드 초기화
  const searchInput = document.getElementById('transactionCreateCustomerSearch');
  searchInput.value = '';
  searchInput.placeholder = '매출처 코드 또는 이름 입력 후 엔터';

  // 선택된 매출처 표시 영역 숨김
  document.getElementById('transactionSelectedCustomerDisplay').style.display = 'none';

  // 검색 입력 필드에 포커스
  searchInput.focus();
}

// ✅ 자재 검색 모달 열기 (거래명세서 작성용)
function openTransactionMaterialSearchModal() {
  document.getElementById('transactionMaterialSearchModal').style.display = 'block';
  document.getElementById('transactionCreateMaterialSearchInput').value = '';
}

// ✅ 자재 검색 모달 닫기
function closeTransactionMaterialSearchModal() {
  document.getElementById('transactionMaterialSearchModal').style.display = 'none';
}

// ✅ 자재 검색 (거래명세서 작성 모달용)
async function searchTransactionMaterials() {
  try {
    const searchText = document.getElementById('transactionCreateMaterialSearchInput').value.trim();

    const response = await fetch(`/api/materials?search=${encodeURIComponent(searchText)}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '자재 조회 실패');
    }

    const tbody = document.getElementById('transactionMaterialSearchTableBody');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: #6b7280;">
            검색 결과가 없습니다
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = result.data
      .map(
        (material) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px;">${material.세부코드}</td>
        <td style="padding: 12px;">${material.자재명}</td>
        <td style="padding: 12px;">${material.규격 || '-'}</td>
        <td style="padding: 12px; text-align: right;">${(
          material.출고단가1 || 0
        ).toLocaleString()}</td>
        <td style="padding: 12px; text-align: center;">
          <button onclick='showTransactionPriceHistory(${JSON.stringify(material).replace(
            /'/g,
            '&apos;',
          )})' style="
            padding: 6px 16px;
            background: #f59e0b;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            margin-right: 4px;
          " onmouseover="this.style.background='#d97706';"
             onmouseout="this.style.background='#f59e0b';">이전단가</button>
          <button onclick='selectTransactionMaterial(${JSON.stringify(material).replace(
            /'/g,
            '&apos;',
          )})' style="
            padding: 6px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
          " onmouseover="this.style.background='#1d4ed8';"
             onmouseout="this.style.background='#2563eb';">선택</button>
        </td>
      </tr>
    `,
      )
      .join('');
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

// ✅ 자재 선택 및 추가
function selectTransactionMaterial(material) {
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
  newTransactionDetails.push({
    분류코드: material.분류코드,
    세부코드: material.세부코드,
    자재명: material.자재명,
    규격: material.규격,
    수량: parseFloat(수량),
    단가: parseFloat(단가),
  });

  renderNewTransactionDetailTable();
  closeTransactionMaterialSearchModal();
}

// ✅ 새 거래명세서 상세내역 테이블 렌더링
function renderNewTransactionDetailTable() {
  const tbody = document.getElementById('transactionCreateDetailTableBody');

  if (newTransactionDetails.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 40px; text-align: center; color: #6b7280;">
          자재 추가 버튼을 클릭하여 거래 상세내역을 입력하세요
        </td>
      </tr>
    `;

    // 합계 초기화
    document.getElementById('transactionCreateTotalSupply').textContent = '0';
    document.getElementById('transactionCreateTotalVat').textContent = '0';
    document.getElementById('transactionCreateGrandTotal').textContent = '0';
    return;
  }

  tbody.innerHTML = '';
  let totalSupply = 0;
  let totalVat = 0;

  newTransactionDetails.forEach((detail, index) => {
    const 공급가 = detail.수량 * detail.단가;
    const 부가세 = Math.round(공급가 * 0.1);
    const 합계 = 공급가 + 부가세;

    totalSupply += 공급가;
    totalVat += 부가세;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #e5e7eb';
    tr.innerHTML = `
      <td style="padding: 12px; text-align: center;">${index + 1}</td>
      <td style="padding: 12px;">${detail.세부코드}</td>
      <td style="padding: 12px;">${detail.자재명 || '-'}</td>
      <td style="padding: 12px;">${detail.규격 || '-'}</td>
      <td style="padding: 12px; text-align: right;">${detail.수량.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right;">${detail.단가.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right;">${공급가.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right;">${부가세.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right;">${합계.toLocaleString()}</td>
      <td style="padding: 8px; text-align: center; vertical-align: middle;">
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
          <button type="button" onclick="editNewTransactionDetail(${index})" style="
            padding: 6px 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
            width: 60px;
          " onmouseover="this.style.background='#2563eb';"
             onmouseout="this.style.background='#3b82f6';">수정</button>
          <button type="button" onclick="removeNewTransactionDetail(${index})" style="
            padding: 6px 12px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
            width: 60px;
          " onmouseover="this.style.background='#dc2626';"
             onmouseout="this.style.background='#ef4444';">삭제</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 합계 업데이트
  document.getElementById('transactionCreateTotalSupply').textContent =
    totalSupply.toLocaleString();
  document.getElementById('transactionCreateTotalVat').textContent = totalVat.toLocaleString();
  document.getElementById('transactionCreateGrandTotal').textContent = (
    totalSupply + totalVat
  ).toLocaleString();
}

// ✅ 상세내역 항목 삭제
function removeNewTransactionDetail(index) {
  if (confirm('이 항목을 삭제하시겠습니까?')) {
    newTransactionDetails.splice(index, 1);
    renderNewTransactionDetailTable();
  }
}

// ✅ 상세내역 항목 수정
function editNewTransactionDetail(index) {
  const detail = newTransactionDetails[index];

  // 수정 모달 열기 - 기존 newTransactionDetailEditModal 사용
  // 자재 정보 설정
  document.getElementById('editNewTransactionDetailMaterialCode').value = detail.자재코드;
  document.getElementById('editNewTransactionDetailMaterialName').value = detail.자재명 || '';
  document.getElementById('editNewTransactionDetailMaterialSpec').value = detail.규격 || '';

  // 수량, 단가 설정
  document.getElementById('editNewTransactionDetailQuantity').value = detail.수량;
  document.getElementById('editNewTransactionDetailPrice').value = detail.단가;

  // 금액 자동 계산
  const 공급가 = detail.수량 * detail.단가;
  const 부가세 = Math.round(공급가 * 0.1);
  document.getElementById('editNewTransactionDetailSupply').value = 공급가;
  document.getElementById('editNewTransactionDetailVat').value = 부가세;

  // 수정할 인덱스 저장
  window.currentEditingNewTransactionIndex = index;

  // 모달 표시
  document.getElementById('newTransactionDetailEditModal').style.display = 'block';
}

// ✅ 거래명세서 저장
async function submitTransactionCreate(event) {
  event.preventDefault();

  try {
    // 입력값 가져오기
    const 거래일자 = document.getElementById('transactionCreateDate').value.replace(/-/g, '');
    const 입출고구분 = document.getElementById('transactionCreateType').value;
    const 매출처코드 = document.getElementById('transactionCreateCustomerCode').value;
    const 적요 = document.getElementById('transactionCreateRemark').value;

    // 유효성 검사
    if (!매출처코드) {
      alert('매출처를 선택해주세요.');
      return;
    }

    // ✅ newTransactionDetails 배열에서 상세내역 수집
    if (newTransactionDetails.length === 0) {
      alert('거래 상세내역을 최소 1개 이상 추가해주세요.');
      return;
    }

    // newTransactionDetails 배열을 API 형식으로 변환
    const details = newTransactionDetails.map((detail) => ({
      자재코드: detail.자재코드,
      수량: detail.수량,
      단가: detail.단가,
    }));

    // API 호출 데이터 구성
    const transactionData = {
      거래일자,
      입출고구분: parseInt(입출고구분),
      매출처코드,
      적요,
      details: details,
    };

    // API 호출
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify(transactionData),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '거래명세서 저장 실패');
    }

    alert('거래명세서가 성공적으로 저장되었습니다.');
    closeTransactionCreateModal();

    // 목록 새로고침
    loadTransactions();
  } catch (err) {
    console.error('❌ 거래명세서 저장 오류:', err);
    alert('거래명세서 저장 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 거래명세서 상세 닫기 (Prefix 규칙: transactionViewModal)
window.closeTransactionViewModal = function closeTransactionViewModal() {
  const modal = document.getElementById('openTransactionViewModal');
  modal.style.display = 'none';
  modal.classList.add('hidden');
};

// ✅ 하위 호환성 유지
window.closeTransactionDetailModal = window.closeTransactionViewModal;

// ✅ CSV 내보내기 (Google Sheets용)
window.exportTransactionsToExcel = function exportTransactionsToExcel() {
  if (!window.transactionTable) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const data = window.transactionTable
    .rows()
    .data()
    .toArray()
    .map((row) => ({
      명세서번호: row.명세서번호,
      거래일자: row.거래일자,
      매출처명: row.매출처명,
      공급가액: row.출고금액,
      부가세: row.출고부가세,
      합계금액: (row.출고금액 || 0) + (row.출고부가세 || 0),
      작성자: row.작성자,
      상태: row.입출고구분,
    }));

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [
      '명세서번호,거래일자,매출처명,공급가액,부가세,합계금액,작성자,상태',
      ...data.map((r) =>
        [
          r.명세서번호,
          r.거래일자,
          r.매출처명,
          r.공급가액,
          r.부가세,
          r.합계금액,
          r.작성자,
          r.상태,
        ].join(','),
      ),
    ].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', '거래명세서목록.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ✅ 거래명세서 수정 함수
window.editTransaction = async function editTransaction(transactionDate, transactionNo) {
  try {
    // 현재 거래명세서 정보 조회
    const res = await fetch(`/api/transactions/${transactionDate}/${transactionNo}`);
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error('거래명세서 정보를 찾을 수 없습니다.');
    }

    const details = result.data || [];

    // 첫 번째 상세 레코드에서 기본 정보 추출 (마스터 정보가 없으므로)
    const firstDetail = details[0] || {};

    // 기본 정보 표시
    const transactionNoText = `${transactionDate}-${transactionNo}`;
    document.getElementById('editTransactionNo').textContent = transactionNoText;
    document.getElementById('editTransactionDate').textContent = transactionDate.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    const customerDisplay = firstDetail.매출처명
      ? `${firstDetail.매출처명}(${firstDetail.매출처코드 || '-'})`
      : '-';
    document.getElementById('editTransactionCustomer').textContent = customerDisplay;

    // 입출고구분 설정 (거래명세서는 항상 2=출고)
    document.getElementById('editTransactionStatus').value = 2;

    // 전역 변수에 현재 편집 중인 거래명세서 정보 저장
    window.currentEditingTransaction = {
      거래일자: transactionDate,
      거래번호: transactionNo,
      details: details,
    };

    // DataTable 초기화 - 기존 인스턴스 정리
    if ($.fn.DataTable.isDataTable('#transactionEditDetailTable')) {
      $('#transactionEditDetailTable').DataTable().clear().destroy();
    }
    window.transactionEditDetailTableInstance = null;

    // 테이블 tbody 초기화
    $('#transactionEditDetailTable tbody').empty();

    // DataTable 초기화
    window.transactionEditDetailTableInstance = $('#transactionEditDetailTable').DataTable({
      data: details,
      columns: [
        {
          data: null,
          orderable: false,
          className: 'dt-center',
          render: (data, type, row, meta) => meta.row + 1,
        },
        {
          data: '자재코드',
          defaultContent: '-',
          className: 'dt-center',
          render: (d) => {
            if (!d) return '-';
            return d.length > 2 ? d.substring(2) : d;
          },
        },
        {
          data: '자재명',
          defaultContent: '-',
          className: 'dt-left',
        },
        {
          data: '규격',
          defaultContent: '-',
          className: 'dt-left',
        },
        {
          data: '수량',
          defaultContent: '0',
          className: 'dt-right',
          render: (d) => (d ? d.toLocaleString() : '0'),
        },
        {
          data: '단가',
          defaultContent: '0',
          className: 'dt-right',
          render: (d) => (d ? d.toLocaleString() : '0'),
        },
        {
          data: '공급가액',
          defaultContent: '0',
          className: 'dt-right',
          render: (d) => (d ? d.toLocaleString() : '0'),
        },
        {
          data: '부가세',
          defaultContent: '0',
          className: 'dt-right',
          render: (d) => (d ? d.toLocaleString() : '0'),
        },
        {
          data: '합계금액',
          defaultContent: '0',
          className: 'dt-right',
          render: (d) => (d ? d.toLocaleString() : '0'),
        },
        {
          data: null,
          orderable: false,
          className: 'dt-center',
          render: (data, type, row, meta) => {
            return `
              <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                <button class="btn-icon" onclick="editTransactionDetailRow(${meta.row})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; width: 50px;">수정</button>
                <button class="btn-icon" onclick="deleteTransactionDetailRow(${meta.row})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; width: 50px;">삭제</button>
              </div>
            `;
          },
        },
      ],
      // order: [[0, 'asc']],
      pageLength: 10,
      createdRow: function (row) {
        // 관리 칼럼(마지막 칼럼)에 수직 가운데 정렬 적용
        $(row).find('td:last-child').css('vertical-align', 'middle');
      },
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
    });

    // 합계 계산
    updateTransactionEditTotal();

    // 모달 열기
    const modal = document.getElementById('openTransactionEditModal');
    modal.style.display = 'flex';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.openTransactionEditModalDraggable) {
      makeModalDraggable('openTransactionEditModal', 'openTransactionEditModalHeader');
      window.openTransactionEditModalDraggable = true;
    }
  } catch (err) {
    console.error('❌ 거래명세서 수정 조회 오류:', err);
    alert('거래명세서 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
};

// ✅ 거래명세서 수정 모달 닫기
window.closeTransactionEditModal = function closeTransactionEditModal() {
  const modal = document.getElementById('openTransactionEditModal');
  modal.style.display = 'none';

  // DataTable 정리
  if ($.fn.DataTable.isDataTable('#transactionEditDetailTable')) {
    $('#transactionEditDetailTable').DataTable().clear().destroy();
  }
  window.transactionEditDetailTableInstance = null;

  // 테이블 tbody 초기화
  $('#transactionEditDetailTable tbody').empty();

  // 전역 변수 초기화
  window.currentEditingTransaction = null;
};

// ✅ 거래명세서 수정 제출
window.submitTransactionEdit = async function submitTransactionEdit() {
  if (!window.currentEditingTransaction) {
    alert('수정할 거래명세서 정보가 없습니다.');
    return;
  }

  const { 거래일자, 거래번호 } = window.currentEditingTransaction;
  const 입출고구분 = document.getElementById('editTransactionStatus').value;

  // DataTable에서 현재 데이터 가져오기
  const rawDetails = window.transactionEditDetailTableInstance.rows().data().toArray();

  if (rawDetails.length === 0) {
    alert('최소 1개 이상의 품목이 필요합니다.');
    return;
  }

  // 서버 API 형식에 맞게 데이터 변환
  const details = rawDetails.map((detail) => {
    // 기존 데이터에서 필요한 필드만 추출
    const firstDetail = window.currentEditingTransaction.details[0] || {};

    // 분류코드, 세부코드가 없으면 자재코드에서 분리
    let 분류코드 = detail.분류코드;
    let 세부코드 = detail.세부코드;

    if (!분류코드 || !세부코드) {
      // 자재코드가 있으면 분리 (fallback)
      if (detail.자재코드) {
        분류코드 = detail.자재코드.substring(0, 2);
        세부코드 = detail.자재코드.substring(2);
      }
    }

    return {
      분류코드: 분류코드,
      세부코드: 세부코드,
      수량: detail.수량,
      단가: detail.단가,
      매출처코드: detail.매출처코드 || firstDetail.매출처코드 || '', // 기존 매출처코드 유지
      적요: detail.적요 || '',
    };
  });

  try {
    const response = await fetch(`/api/transactions/${거래일자}/${거래번호}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify({
        입출고구분: parseInt(입출고구분),
        details: details,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert('거래명세서가 수정되었습니다.');
      closeTransactionEditModal();
      loadTransactions(); // 목록 새로고침
    } else {
      alert(`수정 실패: ${result.message}`);
    }
  } catch (err) {
    console.error('❌ 거래명세서 수정 오류:', err);
    alert('거래명세서 수정 중 오류가 발생했습니다.');
  }
};

// ✅ 거래명세서 수정 합계 업데이트
function updateTransactionEditTotal() {
  if (!window.transactionEditDetailTableInstance) return;

  const data = window.transactionEditDetailTableInstance.rows().data().toArray();

  const total = data.reduce((sum, item) => sum + (item.합계금액 || 0), 0);
  document.getElementById('transactionEditDetailTotal').textContent = total.toLocaleString();
}

// ✅ 거래명세서 상세 행 추가 - 자재 검색 모달 열기
window.addTransactionDetailRow = function addTransactionDetailRow() {
  // 선택된 자재 정보 초기화
  window.selectedTransactionMaterial = null;
  document.getElementById('transactionMaterialSearchInput').value = '';
  document.getElementById('transactionSelectedMaterialInfo').style.display = 'none';
  document.getElementById('transactionMaterialSearchResults').style.display = 'none';
  document.getElementById('transactionAddDetailQuantity').value = '1';
  document.getElementById('transactionAddDetailPrice').value = '0';
  document.getElementById('transactionAddDetailAmount').value = '0';

  // 검색 결과 테이블 초기화
  const tbody = document.getElementById('transactionMaterialSearchTableBody');
  tbody.innerHTML = '';

  // 모달 표시
  document.getElementById('transactionItemCreateModal').style.display = 'block';
};

// ✅ 자재 검색 함수
window.searchTransactionMaterials = async function searchTransactionMaterials() {
  try {
    // 검색어 가져오기
    const searchKeyword = document.getElementById('transactionMaterialSearchInput').value.trim();

    // 검색어 입력 확인
    if (!searchKeyword) {
      alert('검색어를 입력해주세요.');
      return;
    }

    // 검색 조건을 쿼리 파라미터로 전달 (자재명으로 검색)
    const params = new URLSearchParams();
    params.append('searchName', searchKeyword);

    const response = await fetch(`/api/materials?${params.toString()}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('자재 목록을 불러올 수 없습니다.');
    }

    const materials = result.data;
    const tbody = document.getElementById('transactionMaterialSearchTableBody');
    const resultsDiv = document.getElementById('transactionMaterialSearchResults');

    if (materials.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #9ca3af;">검색 결과가 없습니다</td></tr>';
      resultsDiv.style.display = 'block';
      return;
    }

    tbody.innerHTML = materials
      .map(
        (material) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px;">${material.자재코드 || '-'}</td>
        <td style="padding: 12px;">${material.자재명 || '-'}</td>
        <td style="padding: 12px;">${material.규격 || '-'}</td>
        <td style="padding: 12px; text-align: right;">${(
          material.출고단가1 || 0
        ).toLocaleString()}</td>
        <td style="padding: 12px; text-align: center;">
          <button onclick='selectTransactionMaterial(${JSON.stringify(material).replace(
            /'/g,
            '&apos;',
          )})' style="
            padding: 6px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
          " onmouseover="this.style.background='#1d4ed8';"
             onmouseout="this.style.background='#2563eb';">선택</button>
        </td>
      </tr>
    `,
      )
      .join('');

    resultsDiv.style.display = 'block';
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
};

// ✅ 자재 선택 함수
window.selectTransactionMaterial = function selectTransactionMaterial(material) {
  window.selectedTransactionMaterial = material;

  // 선택된 자재 정보 표시 (견적서와 동일한 구조)
  document.getElementById('transactionSelectedMaterialName').textContent = material.자재명 || '-';
  document.getElementById('transactionSelectedMaterialCode').textContent = material.자재코드 || '-';

  // 기본 단가 설정
  document.getElementById('transactionAddDetailPrice').value = material.출고단가1 || 0;
  document.getElementById('transactionAddDetailQuantity').value = 1;

  // 공급가액 계산
  calculateTransactionDetailAmount();

  // 검색 결과 숨기고 선택된 자재 정보 표시
  document.getElementById('transactionMaterialSearchResults').style.display = 'none';
  document.getElementById('transactionSelectedMaterialInfo').style.display = 'block';
};

// ✅ 공급가액 자동 계산 (추가 모달)
window.calculateTransactionDetailAmount = function calculateTransactionDetailAmount() {
  const quantity = parseFloat(document.getElementById('transactionAddDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('transactionAddDetailPrice').value) || 0;
  const amount = quantity * price;

  document.getElementById('transactionAddDetailAmount').value = amount.toLocaleString();
};

// ✅ 자재 추가 확인
window.confirmTransactionDetailAdd = function confirmTransactionDetailAdd() {
  if (!window.selectedTransactionMaterial) {
    alert('자재를 선택해주세요.');
    return;
  }

  const material = window.selectedTransactionMaterial;
  const 수량 = parseFloat(document.getElementById('transactionAddDetailQuantity').value) || 0;
  const 단가 = parseFloat(document.getElementById('transactionAddDetailPrice').value) || 0;
  const 공급가액 = 수량 * 단가;
  const 부가세 = Math.round(공급가액 * 0.1);
  const 합계금액 = 공급가액 + 부가세;

  if (수량 <= 0) {
    alert('수량을 1 이상 입력해주세요.');
    return;
  }

  // DataTable에 행 추가
  // 매출처코드는 기존 거래명세서의 매출처코드 사용
  const firstDetail = window.currentEditingTransaction?.details[0] || {};

  const newRow = {
    분류코드: material.분류코드,
    세부코드: material.세부코드,
    자재코드: material.자재코드,
    자재명: material.자재명,
    규격: material.규격 || '-',
    수량: 수량,
    단가: 단가,
    공급가액: 공급가액,
    부가세: 부가세,
    합계금액: 합계금액,
    매출처코드: firstDetail.매출처코드 || '',
    _isNew: true,
  };

  window.transactionEditDetailTableInstance.row.add(newRow).draw();

  // 합계 재계산
  updateTransactionEditTotal();

  // 모달 닫기
  closeTransactionDetailAddModal();
};

// ✅ 선택된 자재 취소
window.clearSelectedTransactionMaterial = function clearSelectedTransactionMaterial() {
  window.selectedTransactionMaterial = null;
  document.getElementById('transactionSelectedMaterialInfo').style.display = 'none';
  document.getElementById('transactionMaterialSearchResults').style.display = 'none';
  document.getElementById('transactionMaterialSearchInput').value = '';
  document.getElementById('transactionAddDetailQuantity').value = '1';
  document.getElementById('transactionAddDetailPrice').value = '0';
  document.getElementById('transactionAddDetailAmount').value = '0';
};

// ✅ 품목 추가 모달 닫기 (Prefix 규칙: transactionItemCreateModal)
window.closeTransactionItemCreateModal = function closeTransactionItemCreateModal() {
  document.getElementById('transactionItemCreateModal').style.display = 'none';
  window.clearSelectedTransactionMaterial();
};

// ✅ 하위 호환성 유지
window.closeTransactionDetailAddModal = window.closeTransactionItemCreateModal;

// ✅ 거래명세서 상세 행 수정 - 수정 모달 열기
function editTransactionDetailRow(rowIndex) {
  try {
    const table = window.transactionEditDetailTableInstance;
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
    document.getElementById('transactionEditDetailCode').textContent = rowData.자재코드 || '-';
    document.getElementById('transactionEditDetailName').textContent = rowData.자재명 || '-';
    document.getElementById('transactionEditDetailSpec').textContent = rowData.규격 || '-';
    document.getElementById('transactionEditDetailQuantity').value = rowData.수량 || 0;
    document.getElementById('transactionEditDetailPrice').value = rowData.단가 || 0;
    document.getElementById('transactionEditDetailAmount').value = (
      rowData.공급가액 || 0
    ).toLocaleString();

    // 모달에 rowIndex 저장
    const modal = document.getElementById('transactionItemEditModal');
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 품목 수정 모달 열기 오류:', err);
    alert('품목 수정 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 공급가액 자동 계산 (수정 모달)
function calculateTransactionEditDetailAmount() {
  const quantity = parseFloat(document.getElementById('transactionEditDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('transactionEditDetailPrice').value) || 0;
  const amount = quantity * price;

  document.getElementById('transactionEditDetailAmount').value = amount.toLocaleString();
}

// ✅ 품목 수정 확인
function confirmTransactionDetailEdit() {
  try {
    const modal = document.getElementById('transactionItemEditModal');
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.transactionEditDetailTableInstance;
    const rowData = table.row(rowIndex).data();

    // 새로운 값 가져오기
    const 수량 = parseFloat(document.getElementById('transactionEditDetailQuantity').value) || 0;
    const 단가 = parseFloat(document.getElementById('transactionEditDetailPrice').value) || 0;
    const 공급가액 = 수량 * 단가;
    const 부가세 = Math.round(공급가액 * 0.1);
    const 합계금액 = 공급가액 + 부가세;

    if (수량 <= 0) {
      alert('수량을 1 이상 입력해주세요.');
      return;
    }

    // 행 데이터 업데이트
    rowData.수량 = 수량;
    rowData.단가 = 단가;
    rowData.공급가액 = 공급가액;
    rowData.부가세 = 부가세;
    rowData.합계금액 = 합계금액;

    // DataTable 업데이트
    table.row(rowIndex).data(rowData).invalidate().draw(false);

    // 합계 재계산
    updateTransactionEditTotal();

    // 모달 닫기
    closeTransactionDetailEditModal();
  } catch (err) {
    console.error('❌ 품목 수정 오류:', err);
    alert('품목 수정 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 품목 수정 모달 닫기 (Prefix 규칙: transactionItemEditModal)
window.closeTransactionItemEditModal = function closeTransactionItemEditModal() {
  document.getElementById('transactionItemEditModal').style.display = 'none';
};

// ✅ 하위 호환성 유지
function closeTransactionDetailEditModal() {
  window.closeTransactionItemEditModal();
}

// ✅ 품목 삭제 - 삭제 확인 모달 열기
function deleteTransactionDetailRow(rowIndex) {
  try {
    const table = window.transactionEditDetailTableInstance;
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
      'transactionDeleteDetailInfo',
    ).textContent = `[${rowData.자재코드}] ${rowData.자재명}`;

    // 모달에 rowIndex 저장
    const modal = document.getElementById('transactionItemDeleteModal');
    modal.dataset.rowIndex = rowIndex;

    // 모달 표시
    modal.style.display = 'flex';
  } catch (err) {
    console.error('❌ 품목 삭제 모달 열기 오류:', err);
    alert('품목 삭제 모달을 여는 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 품목 삭제 확인
function confirmTransactionDetailDelete() {
  try {
    const modal = document.getElementById('transactionItemDeleteModal');
    const rowIndex = parseInt(modal.dataset.rowIndex);

    const table = window.transactionEditDetailTableInstance;

    // 행 삭제
    table.row(rowIndex).remove().draw();

    // 합계 재계산
    updateTransactionEditTotal();

    // 모달 닫기
    closeTransactionDetailDeleteModal();
  } catch (err) {
    console.error('❌ 품목 삭제 오류:', err);
    alert('품목 삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

// ✅ 품목 삭제 모달 닫기 (ID 통일: transactionItemDeleteModal)
window.closeTransactionItemDeleteModal = function closeTransactionItemDeleteModal() {
  const modal = document.getElementById('transactionItemDeleteModal');
  if (!modal) {
    console.warn('⚠️ transactionItemDeleteModal 요소를 찾을 수 없습니다.');
    return;
  }
  modal.style.display = 'none';
};

// ✅ 하위 호환: 기존 HTML onclick이 closeTransactionDetailDeleteModal()을 호출하는 경우 대응
function closeTransactionDetailDeleteModal() {
  closeTransactionItemDeleteModal();
}

// ✅ 선택된 거래명세서 상세 삭제
// ❌ DEPRECATED: 체크박스 기능 제거로 인해 더 이상 사용되지 않음
// function deleteSelectedTransactionDetails() {
//   if (!window.transactionEditDetailTableInstance) return;
//
//   const checkboxes = document.querySelectorAll('.editTransactionDetailCheckbox:checked');
//   if (checkboxes.length === 0) {
//     alert('삭제할 항목을 선택하세요.');
//     return;
//   }
//
//   if (!confirm(`선택한 ${checkboxes.length}개의 항목을 삭제하시겠습니까?`)) {
//     return;
//   }
//
//   // 선택된 행들의 인덱스를 역순으로 삭제 (인덱스가 변경되지 않도록)
//   const rowsToDelete = [];
//   checkboxes.forEach((checkbox) => {
//     const row = $(checkbox).closest('tr');
//     const rowIndex = window.transactionEditDetailTableInstance.row(row).index();
//     rowsToDelete.push(rowIndex);
//   });
//
//   rowsToDelete.sort((a, b) => b - a);
//   rowsToDelete.forEach((index) => {
//     window.transactionEditDetailTableInstance.row(index).remove();
//   });
//
//   window.transactionEditDetailTableInstance.draw();
//   updateTransactionEditTotal();
// }

// ✅ 거래명세서 삭제 함수 (확인 모달 표시)
function deleteTransaction(transactionDate, transactionNo) {
  // 전역 변수에 삭제할 거래명세서 정보 저장
  window.deletingTransaction = {
    거래일자: transactionDate,
    거래번호: transactionNo,
  };

  // 삭제 확인 모달에 정보 표시
  const transactionNoText = `${transactionDate}-${transactionNo}`;
  document.getElementById(
    'transactionDeleteTransactionInfo',
  ).textContent = `명세서번호: ${transactionNoText}`;

  // 모달 열기
  const modal = document.getElementById('transactionDeleteModal');
  modal.style.display = 'flex';
}

// ✅ 거래명세서 삭제 확인 모달 닫기
function closeTransactionDeleteModal() {
  const modal = document.getElementById('transactionDeleteModal');
  modal.style.display = 'none';
  window.deletingTransaction = null;
}

// ✅ 거래명세서 삭제 확정
async function confirmTransactionDelete() {
  if (!window.deletingTransaction) {
    alert('삭제할 거래명세서 정보가 없습니다.');
    return;
  }

  const { 거래일자, 거래번호 } = window.deletingTransaction;

  try {
    const res = await fetch(`/api/transactions/${거래일자}/${거래번호}`, {
      method: 'DELETE',
    });

    const result = await res.json();

    if (result.success) {
      alert('거래명세서가 삭제되었습니다.');
      closeTransactionDeleteModal();
      loadTransactions(); // 목록 새로고침
    } else {
      alert(`삭제 실패: ${result.message}`);
    }
  } catch (err) {
    console.error('❌ 거래명세서 삭제 오류:', err);
    alert('거래명세서 삭제 중 오류가 발생했습니다.');
  }
}

// ✅ 거래명세서 확정 함수
async function approveTransaction(transactionDate, transactionNo) {
  const confirmed = confirm(
    `거래명세서 ${transactionDate}-${transactionNo}를 확정하시겠습니까?\n\n확정 후에는 수정이 불가능합니다.`,
  );

  if (!confirmed) {
    return;
  }

  try {
    const res = await fetch(`/api/transactions/${transactionDate}/${transactionNo}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const result = await res.json();

    if (result.success) {
      alert('거래명세서가 확정되었습니다.');
      loadTransactions(); // 목록 새로고침
    } else {
      alert(`확정 실패: ${result.message}`);
    }
  } catch (err) {
    console.error('❌ 거래명세서 확정 오류:', err);
    alert('거래명세서 확정 중 오류가 발생했습니다.');
  }
}

// ========================================
// ✅ 거래명세서 작성 - 자재 추가 모달 함수 (new 접두사)
// ========================================

// ✅ 자재 추가 모달 열기
window.openNewTransactionDetailAddModal = function openNewTransactionDetailAddModal() {
  window.newSelectedTransactionMaterial = null;
  document.getElementById('newTransactionMaterialSearchInput').value = '';
  document.getElementById('newTransactionSelectedMaterialInfo').style.display = 'none';
  document.getElementById('newTransactionMaterialSearchResults').style.display = 'none';
  document.getElementById('newTransactionAddDetailQuantity').value = '1';
  document.getElementById('newTransactionAddDetailPrice').value = '0';
  document.getElementById('newTransactionAddDetailAmount').value = '0';

  const tbody = document.getElementById('newTransactionMaterialSearchTableBody');
  tbody.innerHTML = '';

  document.getElementById('newTransactionDetailAddModal').style.display = 'block';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.newTransactionDetailAddModalDraggable) {
    makeModalDraggable('newTransactionDetailAddModal', 'newTransactionDetailAddModalHeader');
    window.newTransactionDetailAddModalDraggable = true;
  }
};

// ✅ 자재 추가 모달 닫기
window.closeNewTransactionDetailAddModal = function closeNewTransactionDetailAddModal() {
  document.getElementById('newTransactionDetailAddModal').style.display = 'none';
};

// ✅ 자재 검색 (거래명세서 작성용)
window.searchNewTransactionMaterials = async function searchNewTransactionMaterials() {
  try {
    // 검색어 가져오기
    const searchKeyword = document.getElementById('newTransactionMaterialSearchInput').value.trim();

    // 검색어 입력 확인
    if (!searchKeyword) {
      alert('검색어를 입력해주세요.');
      return;
    }

    // 검색 조건을 쿼리 파라미터로 전달 (자재명으로 검색)
    const params = new URLSearchParams();
    params.append('searchName', searchKeyword);

    const response = await fetch(`/api/materials?${params.toString()}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '자재 조회 실패');
    }

    const materials = result.data;
    const tbody = document.getElementById('newTransactionMaterialSearchTableBody');
    const resultsDiv = document.getElementById('newTransactionMaterialSearchResults');

    if (!materials || materials.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="padding: 40px; text-align: center; color: #6b7280;">
            검색 결과가 없습니다
          </td>
        </tr>
      `;
      resultsDiv.style.display = 'block';
      return;
    }

    tbody.innerHTML = materials
      .map(
        (material) => `
      <tr onclick='selectNewTransactionMaterial(${JSON.stringify(material).replace(
        /'/g,
        '&apos;',
      )})' style="
        cursor: pointer;
        transition: background 0.15s;
        border-bottom: 1px solid #f3f4f6;
      " onmouseover="this.style.background='#f0f9ff';" onmouseout="this.style.background='white';">
        <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${
          material.자재코드 || '-'
        }</td>
        <td style="padding: 10px 12px; font-weight: 500; font-size: 13px; color: #1f2937;">${
          material.자재명 || '-'
        }</td>
        <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${
          material.규격 || '-'
        }</td>
      </tr>
    `,
      )
      .join('');

    resultsDiv.style.display = 'block';
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
};

// ✅ 자재 선택 (클릭 시)
window.selectNewTransactionMaterial = function selectNewTransactionMaterial(material) {
  window.newSelectedTransactionMaterial = material;

  document.getElementById('newTransactionSelectedMaterialName').textContent =
    material.자재명 || '-';
  document.getElementById('newTransactionSelectedMaterialCode').textContent =
    material.자재코드 || '-';

  // 출고단가를 기본값으로 설정
  document.getElementById('newTransactionAddDetailPrice').value = material.출고단가1 || 0;
  document.getElementById('newTransactionAddDetailQuantity').value = 1;

  calculateNewTransactionDetailAmount();

  document.getElementById('newTransactionMaterialSearchResults').style.display = 'none';
  document.getElementById('newTransactionSelectedMaterialInfo').style.display = 'block';
};

// ✅ 선택된 자재 취소
window.clearNewSelectedTransactionMaterial = function clearNewSelectedTransactionMaterial() {
  window.newSelectedTransactionMaterial = null;
  document.getElementById('newTransactionSelectedMaterialInfo').style.display = 'none';
  document.getElementById('newTransactionMaterialSearchResults').style.display = 'none';
  document.getElementById('newTransactionMaterialSearchInput').value = '';
  document.getElementById('newTransactionAddDetailQuantity').value = '1';
  document.getElementById('newTransactionAddDetailPrice').value = '0';
  document.getElementById('newTransactionAddDetailAmount').value = '0';
};

// ✅ 공급가액 자동 계산
window.calculateNewTransactionDetailAmount = function calculateNewTransactionDetailAmount() {
  const quantity =
    parseFloat(document.getElementById('newTransactionAddDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('newTransactionAddDetailPrice').value) || 0;
  const amount = Math.round(quantity * price);

  document.getElementById('newTransactionAddDetailAmount').value = amount.toLocaleString();
};

// ✅ 자재 추가 확정 (테이블에 추가)
window.confirmNewTransactionDetailAdd = function confirmNewTransactionDetailAdd() {
  const material = window.newSelectedTransactionMaterial;

  if (!material) {
    alert('자재를 먼저 선택해주세요.');
    return;
  }

  const quantity =
    parseFloat(document.getElementById('newTransactionAddDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('newTransactionAddDetailPrice').value) || 0;

  if (quantity <= 0) {
    alert('수량을 올바르게 입력해주세요.');
    return;
  }

  if (price < 0) {
    alert('단가를 올바르게 입력해주세요.');
    return;
  }

  // 자재코드에서 분류코드(2자리)만 제거, 세부코드 표시
  const 세부코드 =
    material.자재코드.length > 2 ? material.자재코드.substring(2) : material.자재코드;

  // newTransactionDetails 배열에 추가
  newTransactionDetails.push({
    자재코드: material.자재코드,
    세부코드: 세부코드,
    자재명: material.자재명,
    규격: material.규격 || '-',
    수량: quantity,
    단가: price,
  });

  // 테이블 다시 렌더링
  renderNewTransactionDetailTable();

  // 모달 닫기
  closeNewTransactionDetailAddModal();
};

// ✅ 테이블 행 수정
function editNewTransactionDetailRow(button) {
  const row = button.closest('tr');
  const rowIndex = row.rowIndex - 1; // thead를 제외한 인덱스

  // 현재 행의 데이터 가져오기
  const materialCode = row.dataset.materialCode;
  const materialName = row.dataset.materialName;
  const materialSpec = row.dataset.materialSpec;
  const quantity = parseFloat(row.dataset.quantity);
  const price = parseFloat(row.dataset.price);

  // 수정 모달에 데이터 설정
  document.getElementById('newTransactionEditDetailCode').textContent = materialCode;
  document.getElementById('newTransactionEditDetailName').textContent = materialName;
  document.getElementById('newTransactionEditDetailSpec').textContent = materialSpec;
  document.getElementById('newTransactionEditDetailQuantity').value = quantity;
  document.getElementById('newTransactionEditDetailPrice').value = price;

  // 공급가액 계산
  calculateNewTransactionEditAmount();

  // 수정할 행을 저장
  window.editingNewTransactionRow = row;

  // 모달 열기
  document.getElementById('newTransactionDetailEditModal').style.display = 'block';
}

// ✅ 수정 모달 닫기
function closeNewTransactionDetailEditModal() {
  document.getElementById('newTransactionDetailEditModal').style.display = 'none';
  window.editingNewTransactionRow = null;
}

// ✅ 수정 모달 - 공급가액 계산
function calculateNewTransactionEditAmount() {
  const quantity =
    parseFloat(document.getElementById('newTransactionEditDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('newTransactionEditDetailPrice').value) || 0;
  const amount = Math.round(quantity * price);

  document.getElementById('newTransactionEditDetailAmount').value = amount.toLocaleString();
}

// ✅ 수정 확정
function confirmNewTransactionDetailEdit() {
  const row = window.editingNewTransactionRow;

  if (!row) {
    alert('수정할 품목을 찾을 수 없습니다.');
    return;
  }

  const quantity =
    parseFloat(document.getElementById('newTransactionEditDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('newTransactionEditDetailPrice').value) || 0;

  if (quantity <= 0) {
    alert('수량을 올바르게 입력해주세요.');
    return;
  }

  if (price < 0) {
    alert('단가를 올바르게 입력해주세요.');
    return;
  }

  const supplyAmount = Math.round(quantity * price);
  const vat = Math.round(supplyAmount * 0.1);

  // 테이블 행 업데이트
  row.cells[4].textContent = quantity.toLocaleString();
  row.cells[5].textContent = price.toLocaleString();
  row.cells[6].textContent = supplyAmount.toLocaleString();
  row.cells[7].textContent = vat.toLocaleString();

  // 데이터 속성 업데이트
  row.dataset.quantity = quantity;
  row.dataset.price = price;
  row.dataset.supplyAmount = supplyAmount;
  row.dataset.vat = vat;

  // 합계 업데이트
  updateNewTransactionTotals();

  // 모달 닫기
  closeNewTransactionDetailEditModal();
}

// ✅ 테이블 행 삭제
function deleteNewTransactionDetailRow(button) {
  const row = button.closest('tr');
  row.remove();

  // 순번 재정렬
  const tbody = document.getElementById('transactionCreateDetailTableBody');
  Array.from(tbody.rows).forEach((row, index) => {
    row.cells[0].textContent = index + 1;
  });

  // 행이 모두 삭제되면 메시지 표시
  if (tbody.rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 40px; text-align: center; color: #6b7280;">
          자재 추가 버튼을 클릭하여 거래 상세내역을 입력하세요
        </td>
      </tr>
    `;
  }

  // 합계 업데이트
  updateNewTransactionTotals();
}

// ✅ 합계 금액 업데이트
function updateNewTransactionTotals() {
  const tbody = document.getElementById('transactionCreateDetailTableBody');
  let totalSupply = 0;
  let totalVat = 0;

  Array.from(tbody.rows).forEach((row) => {
    const supplyAmount = parseFloat(row.dataset.supplyAmount) || 0;
    const vat = parseFloat(row.dataset.vat) || 0;
    totalSupply += supplyAmount;
    totalVat += vat;
  });

  const grandTotal = totalSupply + totalVat;

  document.getElementById('transactionCreateTotalSupply').textContent =
    totalSupply.toLocaleString();
  document.getElementById('transactionCreateTotalVat').textContent = totalVat.toLocaleString();
  document.getElementById('transactionCreateGrandTotal').textContent = grandTotal.toLocaleString();
}

// ✅ 상세 모달에서 출력 버튼 클릭 시 호출
function printTransactionFromDetail() {
  if (!window.currentTransactionDetail) {
    alert('출력할 거래명세서 정보가 없습니다.');
    return;
  }

  const { 거래일자, 거래번호 } = window.currentTransactionDetail;

  // 기존 printTransaction 함수 호출
  printTransaction(거래일자, 거래번호);
}

// ✅ 거래명세서 인쇄 함수
async function printTransaction(거래일자, 거래번호) {
  try {
    // API 호출하여 인쇄용 데이터 가져오기
    const response = await fetch(`/api/transactions/${거래일자}/${거래번호}/print`, {
      credentials: 'include',
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '거래명세서 인쇄 데이터를 불러올 수 없습니다.');
    }

    const { header, details } = result.data;

    // 인쇄 창 열기
    const printWindow = window.open('', '_blank', 'width=800,height=900');

    if (!printWindow) {
      alert('팝업 차단으로 인해 인쇄 창을 열 수 없습니다. 팝업 차단을 해제해주세요.');
      return;
    }

    // 거래일자 포맷 변환 (YYYYMMDD → YYYY년 MM월 DD일)
    const 거래일자_포맷 = 거래일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1년 $2월 $3일');

    // 총금액에 부가세 포함 계산
    const 총공급가액 = details.reduce((sum, item) => sum + (item.출고금액 || 0), 0);
    const 총부가세 = details.reduce((sum, item) => sum + (item.부가 || 0), 0);
    const 총합계 = 총공급가액 + 총부가세;

    // HTML 생성
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>거래명세서 - ${거래일자}-${거래번호}</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 10mm;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      padding: 20px;
    }

    .print-container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
    }

    /* 제목 */
    .print-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }

    .print-header h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .print-header .transaction-info {
      font-size: 10pt;
      color: #555;
    }

    /* 좌우 정보 섹션 */
    .info-section {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      font-size: 10pt;
    }

    .info-box {
      flex: 1;
      border: 1px solid #000;
      padding: 12px;
    }

    .info-box h3 {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #ddd;
    }

    .info-row {
      display: flex;
      margin-bottom: 4px;
    }

    /* 두 개의 필드를 같은 라인에 표시 */
    .info-row-dual {
      display: flex;
      margin-bottom: 4px;
    }

    .info-row-dual .info-group {
      display: flex;
      flex: 1;
    }

    .info-label {
      width: 80px;
      font-weight: 600;
      color: #333;
    }

    .info-value {
      flex: 1;
      color: #000;
    }

    .info-row-dual .info-label {
      width: 80px;
      font-weight: 600;
      color: #333;
    }

    .info-row-dual .info-value {
      flex: 1;
      color: #000;
      margin-right: 2mm;
    }

    /* 품목 테이블 */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 10pt;
    }

    .items-table th,
    .items-table td {
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: center;
    }

    .items-table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }

    .items-table td.left {
      text-align: left;
    }

    .items-table td.right {
      text-align: right;
    }

    /* 합계 섹션 */
    .total-section {
      margin-top: 20px;
      text-align: right;
    }

    .total-table {
      display: inline-block;
      border: 2px solid #000;
      font-size: 11pt;
    }

    .total-table table {
      border-collapse: collapse;
    }

    .total-table td {
      padding: 8px 16px;
      border: 1px solid #000;
    }

    .total-table .label {
      font-weight: bold;
      background-color: #f0f0f0;
      text-align: center;
      width: 100px;
    }

    .total-table .value {
      text-align: right;
      font-weight: bold;
      font-size: 13pt;
      min-width: 150px;
    }

    /* 인쇄 버튼 */
    .print-button-container {
      text-align: center;
      margin: 20px 0;
    }

    .print-button {
      padding: 12px 32px;
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14pt;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .print-button:hover {
      background-color: #1d4ed8;
    }

    .print-button:active {
      background-color: #1e40af;
    }
  </style>
</head>
<body>
  <div class="print-container">
    <!-- 제목 -->
    <div class="print-header">
      <h1>거 래 명 세 서</h1>
      <div class="transaction-info">
        명세서번호: ${거래일자}-${거래번호} | 거래일자: ${거래일자_포맷}
      </div>
    </div>

    <!-- 좌우 정보 섹션 -->
    <div class="info-section">
      <!-- 좌측: 공급자 (회사) 정보 -->
      <div class="info-box">
        <h3>공급자</h3>
        <div class="info-row">
          <div class="info-label">사업자번호</div>
          <div class="info-value">${header.좌등록번호 || '-'}</div>
        </div>
        <div class="info-row-dual">
          <div class="info-group">
            <div class="info-label">상호</div>
            <div class="info-value">${header.좌상호 || '-'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">대표자명</div>
            <div class="info-value">${header.좌성명 || '-'}</div>
          </div>
        </div>
        <div class="info-row">
          <div class="info-label">주소</div>
          <div class="info-value">${header.좌주소 || '-'}</div>
        </div>
        <div class="info-row-dual">
          <div class="info-group">
            <div class="info-label">업태</div>
            <div class="info-value">${header.좌업태 || '-'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">종목</div>
            <div class="info-value">${header.좌종목 || '-'}</div>
          </div>
        </div>
      </div>

      <!-- 우측: 공급받는자 (매출처) 정보 -->
      <div class="info-box">
        <h3>공급받는자</h3>
        <div class="info-row">
          <div class="info-label">사업자번호</div>
          <div class="info-value">${header.우등록번호 || '-'}</div>
        </div>
        <div class="info-row-dual">
          <div class="info-group">
            <div class="info-label">상호</div>
            <div class="info-value">${header.우상호 || '-'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">대표자명</div>
            <div class="info-value">${header.우성명 || '-'}</div>
          </div>
        </div>
        <div class="info-row">
          <div class="info-label">주소</div>
          <div class="info-value">${header.우주소 || '-'}</div>
        </div>
        <div class="info-row-dual">
          <div class="info-group">
            <div class="info-label">업태</div>
            <div class="info-value">${header.우업태 || '-'}</div>
          </div>
          <div class="info-group">
            <div class="info-label">종목</div>
            <div class="info-value">${header.우종목 || '-'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 품목 테이블 -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">No</th>
          <th style="width: 100px;">품목코드</th>
          <th style="width: 200px;">품명</th>
          <th style="width: 150px;">규격</th>
          <th style="width: 70px;">수량</th>
          <th style="width: 60px;">단위</th>
          <th style="width: 100px;">단가</th>
          <th style="width: 100px;">공급가액</th>
          <th style="width: 80px;">부가세</th>
        </tr>
      </thead>
      <tbody>
        ${details
          .map(
            (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.코드 ? item.코드.substring(2) : '-'}</td>
          <td class="left">${item.품명 || '-'}</td>
          <td class="left">${item.규격 || '-'}</td>
          <td class="right">${(item.수량 || 0).toLocaleString()}</td>
          <td>${item.단위 || '-'}</td>
          <td class="right">${(item.단가 || 0).toLocaleString()}</td>
          <td class="right">${(item.출고금액 || 0).toLocaleString()}</td>
          <td class="right">${(item.부가 || 0).toLocaleString()}</td>
        </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>

    <!-- 합계 섹션 -->
    <div class="total-section">
      <div class="total-table">
        <table>
          <tr>
            <td class="label">공급가액</td>
            <td class="value">${총공급가액.toLocaleString()} 원</td>
          </tr>
          <tr>
            <td class="label">부가세</td>
            <td class="value">${총부가세.toLocaleString()} 원</td>
          </tr>
          <tr>
            <td class="label">합계</td>
            <td class="value">${총합계.toLocaleString()} 원</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- 인쇄 버튼 -->
    <div class="print-button-container no-print">
      <button class="print-button" onclick="window.print()">인쇄하기</button>
    </div>
  </div>
</body>
</html>
    `);

    printWindow.document.close();
  } catch (err) {
    console.error('❌ 거래명세서 인쇄 오류:', err);
    alert('거래명세서 인쇄 중 오류가 발생했습니다: ' + err.message);
  }
}
