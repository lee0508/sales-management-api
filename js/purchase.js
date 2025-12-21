// ✅ 매입전표관리 스크립트 (purchase.js)
// 거래명세서관리(transaction.js)를 참조하여 작성
// 주요 차이점: 매출처 → 매입처, 출고 → 입고
// 미지급금 처리 추가

// 전역 변수
let selectedPurchaseStatementForDelete = null;
let newPurchaseStatementDetails = []; // 신규 작성 시 품목 목록

// ✅ 날짜 초기화 함수 (최초 1회만 호출)
function initPurchaseStatementDates() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const start = document.getElementById('purchaseStatementStartDate');
  const end = document.getElementById('purchaseStatementEndDate');
  const create = document.getElementById('purchaseStatementCreateDate');

  if (start && !start.value) start.value = todayStr;
  if (end && !end.value) end.value = todayStr;
  if (create && !create.value) create.value = todayStr;
}

document.addEventListener('DOMContentLoaded', () => {
  // 날짜 초기화 (최초 1회만)
  initPurchaseStatementDates();

  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadPurchaseStatements = loadPurchaseStatements;
});

// ✅ 매입전표 목록 불러오기
async function loadPurchaseStatements() {
  // ✅ 다른 페이지의 체크박스 이벤트 핸들러 제거
  $(document).off('change.quotationPage');
  $(document).off('change.orderPage');
  $(document).off('change.transactionManagePage');
  try {
    const startDate = document.getElementById('purchaseStatementStartDate').value;
    const endDate = document.getElementById('purchaseStatementEndDate').value;
    const status = document.getElementById('purchaseStatementStatusFilter').value;

    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    if (status) query.append('status', status);

    const res = await fetch(`${API_BASE_URL}/purchase-statements?${query.toString()}`);
    const data = await res.json();

    if (!data.success) throw new Error('데이터를 불러오지 못했습니다.');

    const tableData = data.data || [];
    document.getElementById('purchaseStatementCount').textContent = tableData.length;

    // ✅ 기존 DataTable 있으면 destroy
    if (window.purchaseStatementTableInstance) {
      window.purchaseStatementTableInstance.destroy();
    }

    // ✅ DataTable 초기화 (purchaseActions- prefix 사용)
    window.purchaseStatementTableInstance = $('#purchaseStatementTable').DataTable({
      data: tableData,
      columns: [
        {
          data: null,
          render: (data, type, row, meta) =>
            `<input type="checkbox" class="purchaseRowCheck" data-date="${row.거래일자}" data-no="${row.거래번호}" />`,
          orderable: false,
        },
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
          defaultContent: '-',
        },
        { data: '전표번호', defaultContent: '-' },
        {
          data: '거래일자',
          render: (data) => (data ? data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'),
        },
        { data: '매입처명', defaultContent: '-' },
        {
          data: '입고금액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '입고부가세',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: null,
          render: (data, type, row) => {
            const 입고금액 = row.입고금액 || 0;
            const 입고부가세 = row.입고부가세 || 0;
            return (입고금액 + 입고부가세).toLocaleString();
          },
          className: 'dt-right',
        },
        { data: '작성자', defaultContent: '-' },
        {
          data: '입출고구분',
          render: (d) => renderPurchaseStatementStatus(d),
        },
        {
          data: null,
          render: (data, type, row) => {
            return `
              <div id="purchaseActions-${row.거래일자}_${row.거래번호}" style="display: flex; gap: 4px; justify-content: center;">
                <button class="btn-icon purchaseBtnView" onclick="openPurchaseStatementDetailModal('${row.전표번호}')" title="보기">보기</button>
                <button class="btn-icon purchaseBtnEdit" style="display: none;" onclick="editPurchaseStatement('${row.거래일자}', ${row.거래번호})" title="수정">수정</button>
                <button class="btn-icon purchaseBtnDelete" style="display: none;" onclick="openPurchaseStatementDeleteModal('${row.거래일자}', ${row.거래번호}, '${row.전표번호}')" title="삭제">삭제</button>
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
      drawCallback: function (settings) {
        // DataTable이 다시 그려질 때마다 체크박스 상태에 따라 버튼 표시
        $('.purchaseRowCheck').each(function () {
          const $checkbox = $(this);
          const purchaseDate = String($checkbox.data('date'));
          const purchaseNo = String($checkbox.data('no'));
          const isChecked = $checkbox.prop('checked');
          const actionDiv = $('#purchaseActions-' + purchaseDate + '_' + purchaseNo);

          if (isChecked) {
            actionDiv.find('.purchaseBtnView').hide();
            actionDiv.find('.purchaseBtnEdit').show();
            actionDiv.find('.purchaseBtnDelete').show();
          } else {
            actionDiv.find('.purchaseBtnView').show();
            actionDiv.find('.purchaseBtnEdit').hide();
            actionDiv.find('.purchaseBtnDelete').hide();
          }
        });
      },
    });

    // ✅ 전체선택 체크박스 이벤트 핸들러 등록
    $(document)
      .off('change.purchasePage', '#purchaseSelectAll')
      .on('change.purchasePage', '#purchaseSelectAll', function () {
      const isChecked = $(this).prop('checked');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💰 [매입전표관리] 전체선택 체크박스 클릭');
      console.log(`✅ 체크 상태: ${isChecked ? '전체 선택' : '전체 해제'}`);

      $('.purchaseRowCheck').prop('checked', isChecked).trigger('change');

      console.log('✅ 전체선택 처리 완료');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // ✅ 개별 체크박스 이벤트 핸들러 등록
    $(document)
      .off('change.purchasePage', '.purchaseRowCheck')
      .on('change.purchasePage', '.purchaseRowCheck', function () {
      const purchaseDate = String($(this).data('date'));
      const purchaseNo = String($(this).data('no'));
      const isChecked = $(this).prop('checked');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💰 [매입전표관리] 체크박스 이벤트 발생');
      console.log(`📅 거래일자: ${purchaseDate}`);
      console.log(`🔢 거래번호: ${purchaseNo}`);
      console.log(`✅ 체크 상태: ${isChecked ? '선택됨' : '해제됨'}`);

      // 전체 선택 체크박스 상태 업데이트
      const totalCheckboxes = $('.purchaseRowCheck').length;
      const checkedCheckboxes = $('.purchaseRowCheck:checked').length;
      $('#purchaseSelectAll').prop('checked', totalCheckboxes === checkedCheckboxes);

      // 현재 행의 버튼 표시/숨김 처리
      const actionDiv = $('#purchaseActions-' + purchaseDate + '_' + purchaseNo);

      if (isChecked) {
        // 체크됨: 보기 버튼 숨기고 수정/삭제 버튼 표시
        actionDiv.find('.purchaseBtnView').hide();
        actionDiv.find('.purchaseBtnEdit').show();
        actionDiv.find('.purchaseBtnDelete').show();

        console.log('🔘 표시된 버튼:');
        console.log('   ❌ [보기] 버튼 - 숨김');
        console.log('   ✅ [수정] 버튼 - 표시');
        console.log('   ✅ [삭제] 버튼 - 표시');
      } else {
        // 체크 해제: 수정/삭제 버튼 숨기고 보기 버튼 표시
        actionDiv.find('.purchaseBtnView').show();
        actionDiv.find('.purchaseBtnEdit').hide();
        actionDiv.find('.purchaseBtnDelete').hide();

        console.log('🔘 표시된 버튼:');
        console.log('   ✅ [보기] 버튼 - 표시');
        console.log('   ❌ [수정] 버튼 - 숨김');
        console.log('   ❌ [삭제] 버튼 - 숨김');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

  } catch (err) {
    console.error('❌ 매입전표 조회 에러:', err);
    alert('매입전표 조회 중 오류가 발생했습니다.');
  }
}

// ✅ 상태 렌더링 함수
function renderPurchaseStatementStatus(status) {
  const statusMap = {
    1: '<span class="badge badge-warning">작성중</span>',
    2: '<span class="badge badge-info">확정</span>',
    3: '<span class="badge badge-success">발행완료</span>',
  };
  return statusMap[status] || '<span class="badge badge-secondary">-</span>';
}

// ✅ 필터링 함수
function filterPurchaseStatements() {
  loadPurchaseStatements();
}

// ✅ 매입전표 상세보기 모달 열기
async function openPurchaseStatementDetailModal(statementNo) {
  try {
    const [date, no] = statementNo.split('-');
    const res = await fetch(`${API_BASE_URL}/purchase-statements/${date}/${no}`);
    const data = await res.json();

    if (!data.success || !data.data || data.data.length === 0) {
      alert('매입전표 상세 정보를 불러올 수 없습니다.');
      return;
    }

    const details = data.data;
    const firstRow = details[0];

    // 기본 정보 표시
    document.getElementById('detailPurchaseStatementNo').textContent = statementNo;
    document.getElementById('detailPurchaseStatementDate').textContent = date.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('detailSupplierName').textContent = firstRow.매입처명 || '-';
    document.getElementById('detailPurchaseUserName').textContent = firstRow.사용자명 || '-';

    // 상세 내역 테이블 초기화
    if (window.purchaseStatementDetailTableInstance) {
      window.purchaseStatementDetailTableInstance.destroy();
    }

    window.purchaseStatementDetailTableInstance = $('#purchaseStatementDetailTable').DataTable({
      data: details,
      columns: [
        { data: null, render: (d, t, r, meta) => meta.row + 1 },
        {
          data: '자재코드',
          defaultContent: '-',
          render: (d) => {
            if (!d) return '-';
            // 자재코드에서 분류코드(2자리)만 제거, 세부코드 표시
            return d.length > 2 ? d.substring(2) : d;
          },
        },
        { data: '자재명', defaultContent: '-' },
        { data: '규격', defaultContent: '-' },
        { data: '수량', render: (d) => (d ? d.toLocaleString() : '0'), className: 'dt-right' },
        { data: '단가', render: (d) => (d ? d.toLocaleString() : '0'), className: 'dt-right' },
        { data: '공급가액', render: (d) => (d ? d.toLocaleString() : '0'), className: 'dt-right' },
        { data: '부가세', render: (d) => (d ? d.toLocaleString() : '0'), className: 'dt-right' },
        { data: '합계금액', render: (d) => (d ? d.toLocaleString() : '0'), className: 'dt-right' },
      ],
      paging: false,
      searching: false,
      info: false,
      order: [], // 입력 순서대로 표시
      language: {
        emptyTable: '등록된 품목이 없습니다.',
      },
    });

    // 합계 계산
    const total = details.reduce((sum, item) => sum + (item.합계금액 || 0), 0);
    document.getElementById('purchaseStatementDetailTotal').textContent = total.toLocaleString();

    // 모달 표시
    document.getElementById('purchaseStatementDetailModal').classList.remove('hidden');
    document.getElementById('purchaseStatementDetailModal').style.display = 'flex';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.purchaseStatementDetailModalDraggable) {
      makeModalDraggable('purchaseStatementDetailModal', 'purchaseStatementDetailModalHeader');
      window.purchaseStatementDetailModalDraggable = true;
    }
  } catch (err) {
    console.error('❌ 매입전표 상세 조회 에러:', err);
    alert('매입전표 상세 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

// ✅ 매입전표 상세보기 모달 닫기
function closePurchaseStatementDetailModal() {
  document.getElementById('purchaseStatementDetailModal').style.display = 'none';
  document.getElementById('purchaseStatementDetailModal').classList.add('hidden');
}

// ✅ 매입전표 작성 모달 열기
function openNewPurchaseStatementModal() {
  // 품목 목록 초기화
  newPurchaseStatementDetails = [];

  // 폼 초기화
  document.getElementById('purchaseStatementCreateSupplierCode').value = '';
  document.getElementById('purchaseStatementCreateSupplierName').value = '';
  document.getElementById('purchaseStatementCreateRemark').value = '';

  // 드롭다운 숨김
  document.getElementById('purchaseStatementSupplierCodeDropdown').style.display = 'none';
  document.getElementById('purchaseStatementSupplierNameDropdown').style.display = 'none';

  // 오늘 날짜로 설정
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('purchaseStatementCreateDate').value = today;

  // 테이블 초기화
  updateNewPurchaseStatementDetailsTable();

  // 모달 표시
  document.getElementById('purchaseStatementCreateModal').style.display = 'flex';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.purchaseStatementCreateModalDraggable) {
    makeModalDraggable('purchaseStatementCreateModal', 'purchaseStatementCreateModalHeader');
    window.purchaseStatementCreateModalDraggable = true;
  }

  // ✅ 자동완성 이벤트 리스너 등록 (최초 1회만)
  if (!window.purchaseSupplierAutocompleteInitialized) {
    const codeInput = document.getElementById('purchaseStatementCreateSupplierCode');
    const nameInput = document.getElementById('purchaseStatementCreateSupplierName');

    // 매입처 코드 입력 이벤트
    codeInput.addEventListener('input', (e) => {
      searchPurchaseSupplierByCode(e.target.value);
    });

    // 매입처 명 입력 이벤트
    nameInput.addEventListener('input', (e) => {
      searchPurchaseSupplierByName(e.target.value);
    });

    // 포커스 아웃 시 드롭다운 숨김 (약간의 딜레이로 클릭 이벤트 먼저 처리)
    codeInput.addEventListener('blur', () => {
      setTimeout(() => {
        document.getElementById('purchaseStatementSupplierCodeDropdown').style.display = 'none';
      }, 200);
    });

    nameInput.addEventListener('blur', () => {
      setTimeout(() => {
        document.getElementById('purchaseStatementSupplierNameDropdown').style.display = 'none';
      }, 200);
    });

    window.purchaseSupplierAutocompleteInitialized = true;
    console.log('✅ 매입처 자동완성 이벤트 리스너 등록 완료');
  }
}

// ✅ 매입전표 작성 모달 닫기
function closePurchaseStatementCreateModal() {
  document.getElementById('purchaseStatementCreateModal').style.display = 'none';
  newPurchaseStatementDetails = [];
}

// ✅ 신규 매입전표 상세 테이블 업데이트
function updateNewPurchaseStatementDetailsTable() {
  const tbody = document.getElementById('purchaseStatementCreateDetailTableBody');

  if (newPurchaseStatementDetails.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" style="padding: 40px; text-align: center; color: #6b7280;">자재 추가 버튼을 클릭하여 매입 상세내역을 입력하세요</td></tr>';
  } else {
    tbody.innerHTML = newPurchaseStatementDetails
      .map((item, index) => {
        const 공급가액 = item.수량 * item.단가;
        const 부가세 = Math.round(공급가액 * 0.1);

        return `
        <tr>
          <td style="padding: 12px; text-align: center;">${index + 1}</td>
          <td style="padding: 12px;">${item.자재코드.substring(4)}</td>
          <td style="padding: 12px;">${item.자재명}</td>
          <td style="padding: 12px;">${item.규격 || '-'}</td>
          <td style="padding: 12px; text-align: right;">${item.수량.toLocaleString()}</td>
          <td style="padding: 12px; text-align: right;">${item.단가.toLocaleString()}</td>
          <td style="padding: 12px; text-align: right;">${공급가액.toLocaleString()}</td>
          <td style="padding: 12px; text-align: right;">${부가세.toLocaleString()}</td>
          <td style="padding: 12px; text-align: center;">
            <button type="button" onclick="editNewPurchaseStatementDetail(${index})" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 4px;">수정</button>
            <button type="button" onclick="deleteNewPurchaseStatementDetail(${index})" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">삭제</button>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  // 합계 계산
  const totalSupply = newPurchaseStatementDetails.reduce(
    (sum, item) => sum + item.수량 * item.단가,
    0,
  );
  const totalVat = Math.round(totalSupply * 0.1);
  const grandTotal = totalSupply + totalVat;

  document.getElementById('purchaseStatementCreateTotalSupply').textContent =
    totalSupply.toLocaleString();
  document.getElementById('purchaseStatementCreateTotalVat').textContent =
    totalVat.toLocaleString();
  document.getElementById('purchaseStatementCreateGrandTotal').textContent =
    grandTotal.toLocaleString();
}

// ✅ 신규 매입전표 자재 추가 모달 열기
function openNewPurchaseStatementDetailAddModal() {
  document.getElementById('purchaseStatementMaterialSearchModal').style.display = 'block';
  document.getElementById('purchaseStatementMaterialSearchCode').value = '';
  document.getElementById('purchaseStatementMaterialSearchName').value = '';
  document.getElementById('purchaseStatementMaterialSearchSpec').value = '';
  console.log('✅ 자재 검색 모달 열기 (매입전표용)');

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (
    typeof makeModalDraggable === 'function' &&
    !window.purchaseStatementMaterialSearchModalDraggable
  ) {
    makeModalDraggable(
      'purchaseStatementMaterialSearchModal',
      'purchaseStatementMaterialSearchModalHeader',
    );
    window.purchaseStatementMaterialSearchModalDraggable = true;
  }
}

// ✅ 자재 검색 모달 닫기
function closePurchaseStatementMaterialSearchModal() {
  console.log('🔍 closePurchaseStatementMaterialSearchModal 호출됨');

  try {
    const modal = document.getElementById('purchaseStatementMaterialSearchModal');
    console.log('🔍 모달 요소:', modal);

    if (modal) {
      modal.style.display = 'none';
      console.log('✅ 모달 display를 none으로 설정 완료');
      console.log('🔍 설정 후 모달 display 값:', modal.style.display);
    } else {
      console.error('❌ purchaseStatementMaterialSearchModal 요소를 찾을 수 없습니다!');
    }

    // 입력 필드 초기화 (에러가 발생해도 모달은 닫힘)
    try {
      document.getElementById('purchaseStatementMaterialSearchCode').value = '';
      document.getElementById('purchaseStatementMaterialSearchName').value = '';
      document.getElementById('purchaseStatementMaterialSearchSpec').value = '';
      document.getElementById('purchaseStatementAddDetailQuantity').value = 1;
      document.getElementById('purchaseStatementAddDetailPrice').value = 0;
      document.getElementById('purchaseStatementAddDetailAmount').value = '0';
      document.getElementById('purchaseStatementMaterialSearchResults').style.display = 'none';
      document.getElementById('purchaseStatementSelectedMaterialInfo').style.display = 'none';
      window.selectedPurchaseStatementMaterial = null;
      console.log('✅ 입력 필드 초기화 완료');
    } catch (initError) {
      console.error('⚠️ 입력 필드 초기화 중 오류 (무시):', initError);
    }
  } catch (error) {
    console.error('❌ 모달 닫기 중 오류:', error);
  }
}

// ✅ 자재 검색 (매입전표 작성 모달용)
async function searchPurchaseStatementMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCode = document.getElementById('purchaseStatementMaterialSearchCode').value.trim();
    const searchName = document.getElementById('purchaseStatementMaterialSearchName').value.trim();
    const searchSpec = document.getElementById('purchaseStatementMaterialSearchSpec').value.trim();

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCode && !searchName && !searchSpec) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 매입전표 자재 검색:', {
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

    if (!result.success) {
      throw new Error(result.message || '자재 조회 실패');
    }

    const materials = result.data;
    const tbody = document.getElementById('purchaseStatementMaterialSearchTableBody');
    const resultsDiv = document.getElementById('purchaseStatementMaterialSearchResults');

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

    // 자재 데이터를 전역 변수에 임시 저장 (JSON.stringify 오류 방지)
    window.tempPurchaseStatementMaterialsData = materials;

    tbody.innerHTML = materials
      .map(
        (material, index) => `
      <tr style="
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
        <td style="padding: 10px 12px; text-align: center;">
          <button onclick='selectPurchaseStatementMaterial(window.tempPurchaseStatementMaterialsData[${index}])' style="
            padding: 6px 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
          " onmouseover="this.style.background='#059669';" onmouseout="this.style.background='#10b981';">선택</button>
        </td>
      </tr>
    `,
      )
      .join('');

    resultsDiv.style.display = 'block';
    console.log('✅ 자재 검색 완료:', materials.length + '건');
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

// ✅ 자재 선택 (클릭 시)
function selectPurchaseStatementMaterial(material) {
  console.log('🔍 selectPurchaseStatementMaterial 호출됨:', material);

  if (!material) {
    console.error('❌ material 객체가 없습니다!');
    alert('자재 정보를 불러올 수 없습니다. 다시 시도해주세요.');
    return;
  }

  window.selectedPurchaseStatementMaterial = material;
  console.log(
    '✅ window.selectedPurchaseStatementMaterial 저장됨:',
    window.selectedPurchaseStatementMaterial,
  );

  document.getElementById('purchaseStatementSelectedMaterialName').textContent =
    material.자재명 || '-';
  document.getElementById('purchaseStatementSelectedMaterialCode').textContent =
    material.자재코드 || '-';

  // 입고단가를 기본값으로 설정
  document.getElementById('purchaseStatementAddDetailPrice').value = material.입고단가1 || 0;
  document.getElementById('purchaseStatementAddDetailQuantity').value = 1;

  calculatePurchaseStatementDetailAmount();

  document.getElementById('purchaseStatementMaterialSearchResults').style.display = 'none';
  document.getElementById('purchaseStatementSelectedMaterialInfo').style.display = 'block';

  console.log('✅ 자재 선택 완료:', material.자재명);
}

// ✅ 선택된 자재 취소
function clearSelectedPurchaseStatementMaterial() {
  window.selectedPurchaseStatementMaterial = null;
  document.getElementById('purchaseStatementSelectedMaterialInfo').style.display = 'none';
  document.getElementById('purchaseStatementMaterialSearchResults').style.display = 'none';
  document.getElementById('purchaseStatementMaterialSearchInput').value = '';
  document.getElementById('purchaseStatementAddDetailQuantity').value = '1';
  document.getElementById('purchaseStatementAddDetailPrice').value = '0';
  document.getElementById('purchaseStatementAddDetailAmount').value = '0';

  console.log('✅ 선택된 자재 취소');
}

// ✅ 공급가액 자동 계산
function calculatePurchaseStatementDetailAmount() {
  const quantity =
    parseFloat(document.getElementById('purchaseStatementAddDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('purchaseStatementAddDetailPrice').value) || 0;
  const amount = Math.round(quantity * price);

  document.getElementById('purchaseStatementAddDetailAmount').value = amount.toLocaleString();
}

// ✅ 신규 등록 - 자재 추가 확정 (테이블에 추가)
function confirmPurchaseStatementDetailAdd() {
  console.log('🔍 confirmPurchaseStatementDetailAdd 호출됨 (신규 등록)');
  const material = window.selectedPurchaseStatementMaterial;

  console.log('🔍 선택된 자재:', material);

  if (!material) {
    alert('자재를 먼저 선택해주세요.');
    return;
  }

  const quantity =
    parseFloat(document.getElementById('purchaseStatementAddDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('purchaseStatementAddDetailPrice').value) || 0;

  if (quantity <= 0) {
    alert('수량을 올바르게 입력해주세요.');
    return;
  }

  if (price < 0) {
    alert('단가를 올바르게 입력해주세요.');
    return;
  }

  // 상세내역 추가
  newPurchaseStatementDetails.push({
    자재코드: material.자재코드,
    자재명: material.자재명,
    규격: material.규격,
    수량: quantity,
    단가: price,
  });

  updateNewPurchaseStatementDetailsTable();

  console.log(
    '✅ 자재 추가 완료 (신규 등록):',
    material.자재명,
    `수량: ${quantity}, 단가: ${price}`,
  );

  // 모달 닫기 및 초기화
  console.log('🔍 모달 닫기 시작...');

  // clearSelectedPurchaseStatementMaterial 대신 직접 초기화 (closePurchaseStatementMaterialSearchModal에서 처리)
  closePurchaseStatementMaterialSearchModal();

  console.log('✅ 모달 닫기 완료');
}

// ✅ 이전 단가 보기 (TODO: 구현 예정)
function showPurchaseStatementPriceHistory() {
  const material = window.selectedPurchaseStatementMaterial;

  if (!material) {
    alert('자재를 먼저 선택해주세요.');
    return;
  }

  // TODO: 이전 단가 조회 모달 구현
  alert('이전 단가 조회 기능은 추후 구현 예정입니다.');
  console.log('🔍 이전 단가 조회:', material.자재명);
}

// ✅ 신규 매입전표 품목 수정
function editNewPurchaseStatementDetail(index) {
  alert(`품목 수정 기능 구현 예정 (인덱스: ${index})`);
  // TODO: 품목 수정 모달 구현
}

// ✅ 신규 매입전표 품목 삭제
function deleteNewPurchaseStatementDetail(index) {
  if (confirm('이 품목을 삭제하시겠습니까?')) {
    newPurchaseStatementDetails.splice(index, 1);
    updateNewPurchaseStatementDetailsTable();
  }
}

// ✅ 매입처 검색 모달 열기
function openPurchaseStatementSupplierSearchModal() {
  document.getElementById('purchaseStatementSupplierSearchModal').style.display = 'block';
  document.getElementById('purchaseStatementSupplierSearchInput').value = '';
  console.log('✅ 매입처 검색 모달 열기');
}

// ✅ 매입처 검색 모달 닫기
function closePurchaseStatementSupplierSearchModal() {
  document.getElementById('purchaseStatementSupplierSearchModal').style.display = 'none';
}

// ✅ 매입처 검색 (매입전표 작성 모달용)
async function searchPurchaseStatementSuppliers() {
  try {
    const searchText = document.getElementById('purchaseStatementSupplierSearchInput').value.trim();

    const response = await fetch(`/api/suppliers?search=${encodeURIComponent(searchText)}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '매입처 조회 실패');
    }

    const tbody = document.getElementById('purchaseStatementSupplierSearchTableBody');

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
        (supplier) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px;">${supplier.매입처코드}</td>
        <td style="padding: 12px;">${supplier.매입처명}</td>
        <td style="padding: 12px;">${supplier.전화번호 || '-'}</td>
        <td style="padding: 12px; text-align: center;">
          <button onclick='selectPurchaseStatementSupplier(${JSON.stringify(supplier).replace(
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

    console.log('✅ 매입처 검색 완료:', result.data.length, '건');
  } catch (err) {
    console.error('❌ 매입처 검색 오류:', err);
    alert('매입처 검색 중 오류가 발생했습니다.');
  }
}

// ✅ 매입처 선택
function selectPurchaseStatementSupplier(supplier) {
  document.getElementById('purchaseStatementCreateSupplierCode').value = supplier.매입처코드;
  document.getElementById('purchaseStatementCreateSupplierName').value = supplier.매입처명;
  closePurchaseStatementSupplierSearchModal();
  console.log('✅ 매입처 선택:', supplier.매입처명);
}

// ✅ 매입처 코드로 자동완성 검색
let purchaseSupplierCodeSearchTimeout;
async function searchPurchaseSupplierByCode(searchValue) {
  clearTimeout(purchaseSupplierCodeSearchTimeout);

  if (!searchValue || searchValue.trim().length === 0) {
    document.getElementById('purchaseStatementSupplierCodeDropdown').style.display = 'none';
    return;
  }

  purchaseSupplierCodeSearchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers?searchCode=${encodeURIComponent(searchValue)}`);
      const data = await response.json();

      const dropdown = document.getElementById('purchaseStatementSupplierCodeDropdown');
      dropdown.innerHTML = '';

      if (data.success && data.data && data.data.length > 0) {
        data.data.forEach((supplier) => {
          const item = document.createElement('div');
          item.style.cssText = `
            padding: 10px 12px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            font-size: 14px;
          `;
          item.innerHTML = `
            <div style="font-weight: 500;">${supplier.매입처코드}</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">${supplier.매입처명}</div>
          `;
          item.onmouseover = () => (item.style.background = '#f0f7ff');
          item.onmouseout = () => (item.style.background = 'white');
          item.onclick = () => {
            document.getElementById('purchaseStatementCreateSupplierCode').value = supplier.매입처코드;
            document.getElementById('purchaseStatementCreateSupplierName').value = supplier.매입처명;
            dropdown.style.display = 'none';
            console.log('✅ 매입처 자동완성 선택 (코드):', supplier.매입처명);
          };
          dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
      } else {
        dropdown.style.display = 'none';
      }
    } catch (err) {
      console.error('❌ 매입처 코드 검색 오류:', err);
    }
  }, 300);
}

// ✅ 매입처 명으로 자동완성 검색
let purchaseSupplierNameSearchTimeout;
async function searchPurchaseSupplierByName(searchValue) {
  clearTimeout(purchaseSupplierNameSearchTimeout);

  if (!searchValue || searchValue.trim().length === 0) {
    document.getElementById('purchaseStatementSupplierNameDropdown').style.display = 'none';
    return;
  }

  purchaseSupplierNameSearchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers?searchName=${encodeURIComponent(searchValue)}`);
      const data = await response.json();

      const dropdown = document.getElementById('purchaseStatementSupplierNameDropdown');
      dropdown.innerHTML = '';

      if (data.success && data.data && data.data.length > 0) {
        data.data.forEach((supplier) => {
          const item = document.createElement('div');
          item.style.cssText = `
            padding: 10px 12px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            font-size: 14px;
          `;
          item.innerHTML = `
            <div style="font-weight: 500;">${supplier.매입처명}</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">${supplier.매입처코드}</div>
          `;
          item.onmouseover = () => (item.style.background = '#f0f7ff');
          item.onmouseout = () => (item.style.background = 'white');
          item.onclick = () => {
            document.getElementById('purchaseStatementCreateSupplierCode').value = supplier.매입처코드;
            document.getElementById('purchaseStatementCreateSupplierName').value = supplier.매입처명;
            dropdown.style.display = 'none';
            console.log('✅ 매입처 자동완성 선택 (명):', supplier.매입처명);
          };
          dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
      } else {
        dropdown.style.display = 'none';
      }
    } catch (err) {
      console.error('❌ 매입처 명 검색 오류:', err);
    }
  }, 300);
}

// ✅ 매입전표 작성 제출
async function submitPurchaseStatementCreate(event) {
  event.preventDefault();

  const 거래일자 = document.getElementById('purchaseStatementCreateDate').value.replace(/-/g, '');
  const 입출고구분 = document.getElementById('purchaseStatementCreateType').value;
  const 매입처코드 = document.getElementById('purchaseStatementCreateSupplierCode').value;
  const 적요 = document.getElementById('purchaseStatementCreateRemark').value;

  if (!매입처코드) {
    alert('매입처를 선택해주세요.');
    return;
  }

  if (newPurchaseStatementDetails.length === 0) {
    alert('최소 1개 이상의 품목을 추가해주세요.');
    return;
  }

  const details = newPurchaseStatementDetails.map((item) => ({
    자재코드: item.자재코드,
    수량: item.수량,
    단가: item.단가,
  }));

  // 디버깅: 전송 데이터 확인
  const requestData = {
    거래일자,
    입출고구분: parseInt(입출고구분),
    매입처코드,
    적요,
    details,
  };

  console.log('📤 매입전표 작성 요청 데이터:', requestData);
  console.log('   - 매입처코드:', `'${매입처코드}'`, '(길이:', 매입처코드?.length || 0, ')');

  try {
    const res = await fetch(`${API_BASE_URL}/purchase-statements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // 세션 쿠키 포함
      body: JSON.stringify(requestData),
    });

    const data = await res.json();

    if (data.success) {
      alert('매입전표가 작성되었습니다.');
      closePurchaseStatementCreateModal();
      loadPurchaseStatements();
    } else {
      alert('작성 실패: ' + (data.message || '알 수 없는 오류'));
    }
  } catch (err) {
    console.error('❌ 매입전표 작성 에러:', err);
    alert('매입전표 작성 중 오류가 발생했습니다.');
  }
}

// ✅ 매입전표 수정
async function editPurchaseStatement(date, no) {
  console.log(`✅ 매입전표 수정: ${date}-${no}`);

  try {
    // 현재 매입전표 정보 조회
    const res = await fetch(`${API_BASE_URL}/purchase-statements/${date}/${no}`);
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error('매입전표 정보를 찾을 수 없습니다.');
    }

    const details = result.data || [];
    const firstRow = details[0] || {};

    // 기본 정보 표시
    const statementNoText = `${date}-${no}`;
    document.getElementById('editPurchaseStatementNo').textContent = statementNoText;
    document.getElementById('editPurchaseStatementDate').textContent = date.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('editPurchaseStatementSupplier').textContent = firstRow.매입처명 || '-';

    // 입출고구분 설정 (매입전표는 항상 1=입고)
    document.getElementById('editPurchaseStatementStatus').value = 1;

    // 전역 변수에 현재 편집 중인 매입전표 정보 저장
    window.currentEditingPurchaseStatement = {
      거래일자: date,
      거래번호: no,
      매입처코드: firstRow.매입처코드 || '', // ✅ 추가
      입출고구분: 1, // 매입전표는 항상 입고
      적요: firstRow.적요 || '', // ✅ 추가
      details: details,
    };

    console.log('✅ 매입전표 정보 로드:', {
      거래일자: date,
      거래번호: no,
      매입처코드: firstRow.매입처코드,
      매입처명: firstRow.매입처명,
      품목수: details.length,
    });

    // DataTable 초기화
    if (window.purchaseStatementEditDetailTableInstance) {
      window.purchaseStatementEditDetailTableInstance.destroy();
    }

    window.purchaseStatementEditDetailTableInstance = $(
      '#purchaseStatementEditDetailTable',
    ).DataTable({
      data: details,
      columns: [
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
        },
        {
          data: '자재코드',
          defaultContent: '-',
          render: (d) => {
            if (!d) return '-';
            // 자재코드에서 분류코드(2자리)만 제거, 세부코드 표시
            return d.length > 2 ? d.substring(2) : d;
          },
        },
        { data: '자재명', defaultContent: '-' },
        { data: '규격', defaultContent: '-' },
        {
          data: '수량',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '단가',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '공급가액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '부가세',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '합계금액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: null,
          orderable: false,
          className: 'dt-center',
          render: (data, type, row, meta) => {
            return `
              <button class="btn-icon" onclick="editPurchaseStatementDetailRow(${meta.row})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">수정</button>
              <button class="btn-icon" onclick="deletePurchaseStatementDetailRow(${meta.row})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
            `;
          },
        },
      ],
      order: [], // 입력 순서대로 표시
      pageLength: 10,
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
    updatePurchaseStatementEditTotal();

    // 모달 표시
    document.getElementById('purchaseStatementEditModal').style.display = 'block';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.purchaseStatementEditModalDraggable) {
      makeModalDraggable('purchaseStatementEditModal', 'purchaseStatementEditModalHeader');
      window.purchaseStatementEditModalDraggable = true;
    }

    console.log('✅ 매입전표 수정 모달 열기 완료');
  } catch (error) {
    console.error('❌ 매입전표 수정 오류:', error);
    alert('매입전표 수정 중 오류가 발생했습니다: ' + error.message);
  }
}

// ✅ 매입전표 수정 모달 닫기
function closePurchaseStatementEditModal() {
  document.getElementById('purchaseStatementEditModal').style.display = 'none';
  window.currentEditingPurchaseStatement = null;
}

// ✅ 매입전표 수정 - 합계 업데이트
function updatePurchaseStatementEditTotal() {
  if (!window.currentEditingPurchaseStatement) return;

  const total = window.currentEditingPurchaseStatement.details.reduce(
    (sum, item) => sum + (item.수량 || 0) * (item.단가 || 0) * 1.1,
    0,
  );

  document.getElementById('purchaseStatementEditDetailTotal').textContent =
    Math.round(total).toLocaleString();
}

// ✅ 매입전표 수정 - 자재 추가 버튼
function addPurchaseStatementDetailRow() {
  document.getElementById('purchaseStatementDetailAddModal').style.display = 'block';

  // 입력 필드 초기화
  document.getElementById('purchaseStatementEditMaterialSearchCode').value = '';
  document.getElementById('purchaseStatementEditMaterialSearchName').value = '';
  document.getElementById('purchaseStatementEditMaterialSearchSpec').value = '';
  document.getElementById('purchaseStatementEditDetailQuantity').value = 1;
  document.getElementById('purchaseStatementEditDetailPrice').value = 0;
  document.getElementById('purchaseStatementEditDetailAmount').value = '0';
  document.getElementById('purchaseStatementEditMaterialSearchResults').style.display = 'none';
  document.getElementById('purchaseStatementEditSelectedMaterialInfo').style.display = 'none';
  window.selectedPurchaseStatementEditMaterial = null;
}

// ✅ 매입전표 수정 - 자재 추가 모달 닫기
function closePurchaseStatementDetailAddModal() {
  document.getElementById('purchaseStatementDetailAddModal').style.display = 'none';
}

// ✅ 매입전표 수정 - 자재 검색
async function searchPurchaseStatementEditMaterials() {
  try {
    // 각 필드의 검색어 가져오기
    const searchCode = document
      .getElementById('purchaseStatementEditMaterialSearchCode')
      .value.trim();
    const searchName = document
      .getElementById('purchaseStatementEditMaterialSearchName')
      .value.trim();
    const searchSpec = document
      .getElementById('purchaseStatementEditMaterialSearchSpec')
      .value.trim();

    // 최소 1개 이상의 검색어 입력 확인
    if (!searchCode && !searchName && !searchSpec) {
      alert('최소 1개 이상의 검색 조건을 입력해주세요.');
      return;
    }

    console.log('🔍 매입전표 수정 자재 검색:', {
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

    if (!result.success) {
      throw new Error(result.message || '자재 조회 실패');
    }

    const materials = result.data;
    const tbody = document.getElementById('purchaseStatementEditMaterialSearchTableBody');
    const resultsDiv = document.getElementById('purchaseStatementEditMaterialSearchResults');

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
      <tr onclick='selectPurchaseStatementEditMaterial(${JSON.stringify(material).replace(
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
    console.log('✅ 자재 검색 완료 (수정모달):', materials.length + '건');
  } catch (err) {
    console.error('❌ 자재 검색 오류:', err);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

// ✅ 매입전표 수정 - 자재 선택
function selectPurchaseStatementEditMaterial(material) {
  window.selectedPurchaseStatementEditMaterial = material;

  document.getElementById('purchaseStatementEditSelectedMaterialName').textContent =
    material.자재명 || '-';
  document.getElementById('purchaseStatementEditSelectedMaterialCode').textContent =
    material.자재코드 || '-';

  // 입고단가를 기본값으로 설정
  document.getElementById('purchaseStatementEditDetailPrice').value = material.입고단가1 || 0;
  document.getElementById('purchaseStatementEditDetailQuantity').value = 1;

  calculatePurchaseStatementEditDetailAmount();

  document.getElementById('purchaseStatementEditMaterialSearchResults').style.display = 'none';
  document.getElementById('purchaseStatementEditSelectedMaterialInfo').style.display = 'block';

  console.log('✅ 자재 선택 (수정모달):', material.자재명);
}

// ✅ 매입전표 수정 - 선택된 자재 취소
function clearSelectedPurchaseStatementEditMaterial() {
  window.selectedPurchaseStatementEditMaterial = null;
  document.getElementById('purchaseStatementEditSelectedMaterialInfo').style.display = 'none';
  document.getElementById('purchaseStatementEditMaterialSearchResults').style.display = 'none';
  document.getElementById('purchaseStatementEditMaterialSearchInput').value = '';
  document.getElementById('purchaseStatementEditDetailQuantity').value = '1';
  document.getElementById('purchaseStatementEditDetailPrice').value = '0';
  document.getElementById('purchaseStatementEditDetailAmount').value = '0';

  console.log('✅ 선택된 자재 취소 (수정모달)');
}

// ✅ 매입전표 수정 - 공급가액 자동 계산
function calculatePurchaseStatementEditDetailAmount() {
  const quantity =
    parseFloat(document.getElementById('purchaseStatementEditDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('purchaseStatementEditDetailPrice').value) || 0;
  const amount = Math.round(quantity * price);

  document.getElementById('purchaseStatementEditDetailAmount').value = amount.toLocaleString();
}

// ✅ 매입전표 수정 - 자재 추가 확정
function confirmPurchaseStatementEditDetailAdd() {
  console.log('🔍 confirmPurchaseStatementEditDetailAdd 호출됨 (수정 모달)');
  const material = window.selectedPurchaseStatementEditMaterial;

  if (!material) {
    alert('자재를 먼저 선택해주세요.');
    return;
  }

  const quantity =
    parseFloat(document.getElementById('purchaseStatementEditDetailQuantity').value) || 0;
  const price = parseFloat(document.getElementById('purchaseStatementEditDetailPrice').value) || 0;

  if (quantity <= 0) {
    alert('수량을 올바르게 입력해주세요.');
    return;
  }

  if (price < 0) {
    alert('단가를 올바르게 입력해주세요.');
    return;
  }

  const 공급가액 = quantity * price;
  const 부가세 = Math.round(공급가액 * 0.1);

  // 상세내역 추가
  window.currentEditingPurchaseStatement.details.push({
    자재코드: material.자재코드,
    자재명: material.자재명,
    규격: material.규격,
    수량: quantity,
    단가: price,
    공급가액: 공급가액,
    부가세: 부가세,
    합계금액: 공급가액 + 부가세,
  });

  // DataTable 다시 로드
  window.purchaseStatementEditDetailTableInstance.clear();
  window.purchaseStatementEditDetailTableInstance.rows.add(
    window.currentEditingPurchaseStatement.details,
  );
  window.purchaseStatementEditDetailTableInstance.draw();

  // 합계 업데이트
  updatePurchaseStatementEditTotal();

  // 모달 닫기
  closePurchaseStatementDetailAddModal();

  console.log(
    '✅ 자재 추가 완료 (수정모달):',
    material.자재명,
    `수량: ${quantity}, 단가: ${price}`,
  );
}

// ✅ 매입전표 수정 - 품목 수정 모달 열기
function editPurchaseStatementDetailRow(rowIndex) {
  const item = window.currentEditingPurchaseStatement.details[rowIndex];

  window.currentEditingPurchaseStatementDetailIndex = rowIndex;

  // 품목 정보 표시 (읽기 전용 박스)
  document.getElementById('purchaseStatementEditDetailCode').textContent = item.자재코드 ? item.자재코드.substring(4) : '-';
  document.getElementById('purchaseStatementEditDetailName').textContent = item.자재명 || '-';
  document.getElementById('purchaseStatementEditDetailSpec').textContent = item.규격 || '-';

  // 수정 가능한 필드
  document.getElementById('purchaseStatementEditItemQuantity').value = item.수량 || 0;
  document.getElementById('purchaseStatementEditItemPrice').value = item.단가 || 0;

  calculatePurchaseStatementEditItemAmount();

  document.getElementById('purchaseStatementDetailEditModal').style.display = 'block';

  // 드래그 기능 제거 (헤더에서 cursor: move 제거됨)
}

// ✅ 매입전표 수정 - 품목 수정 모달 닫기
function closePurchaseStatementDetailEditModal() {
  document.getElementById('purchaseStatementDetailEditModal').style.display = 'none';
  window.currentEditingPurchaseStatementDetailIndex = null;
}

// ✅ 매입전표 수정 - 품목 수정 공급가액 계산
function calculatePurchaseStatementEditItemAmount() {
  const quantity =
    parseFloat(document.getElementById('purchaseStatementEditItemQuantity').value) || 0;
  const price = parseFloat(document.getElementById('purchaseStatementEditItemPrice').value) || 0;
  const amount = Math.round(quantity * price);

  document.getElementById('purchaseStatementEditItemAmount').value = amount.toLocaleString();
}

// ✅ 매입전표 수정 - 품목 수정 확정
function confirmPurchaseStatementDetailEdit() {
  const rowIndex = window.currentEditingPurchaseStatementDetailIndex;

  if (rowIndex === null || rowIndex === undefined) return;

  const quantity =
    parseFloat(document.getElementById('purchaseStatementEditItemQuantity').value) || 0;
  const price = parseFloat(document.getElementById('purchaseStatementEditItemPrice').value) || 0;

  if (quantity <= 0) {
    alert('수량을 올바르게 입력해주세요.');
    return;
  }

  if (price < 0) {
    alert('단가를 올바르게 입력해주세요.');
    return;
  }

  const 공급가액 = quantity * price;
  const 부가세 = Math.round(공급가액 * 0.1);

  // 품목 수정
  window.currentEditingPurchaseStatement.details[rowIndex].수량 = quantity;
  window.currentEditingPurchaseStatement.details[rowIndex].단가 = price;
  window.currentEditingPurchaseStatement.details[rowIndex].공급가액 = 공급가액;
  window.currentEditingPurchaseStatement.details[rowIndex].부가세 = 부가세;
  window.currentEditingPurchaseStatement.details[rowIndex].합계금액 = 공급가액 + 부가세;

  // DataTable 다시 로드
  window.purchaseStatementEditDetailTableInstance.clear();
  window.purchaseStatementEditDetailTableInstance.rows.add(
    window.currentEditingPurchaseStatement.details,
  );
  window.purchaseStatementEditDetailTableInstance.draw();

  // 합계 업데이트
  updatePurchaseStatementEditTotal();

  // 모달 닫기
  closePurchaseStatementDetailEditModal();

  console.log('✅ 품목 수정 완료 (수정모달):', rowIndex);
}

// ✅ 매입전표 수정 - 품목 삭제
function deletePurchaseStatementDetailRow(rowIndex) {
  if (!confirm('이 품목을 삭제하시겠습니까?')) return;

  // 품목 삭제
  window.currentEditingPurchaseStatement.details.splice(rowIndex, 1);

  // DataTable 다시 로드
  window.purchaseStatementEditDetailTableInstance.clear();
  window.purchaseStatementEditDetailTableInstance.rows.add(
    window.currentEditingPurchaseStatement.details,
  );
  window.purchaseStatementEditDetailTableInstance.draw();

  // 합계 업데이트
  updatePurchaseStatementEditTotal();

  console.log('✅ 품목 삭제 완료 (수정모달):', rowIndex);
}

// ✅ 매입전표 수정 제출
async function submitPurchaseStatementEdit() {
  if (!window.currentEditingPurchaseStatement) {
    alert('수정 중인 매입전표가 없습니다.');
    return;
  }

  if (window.currentEditingPurchaseStatement.details.length === 0) {
    alert('최소 1개 이상의 품목이 있어야 합니다.');
    return;
  }

  const { 거래일자, 거래번호, 매입처코드, 입출고구분, 적요, details } =
    window.currentEditingPurchaseStatement;

  // 매입처코드 검증
  if (!매입처코드) {
    alert('매입처 정보가 없습니다. 매입전표를 다시 불러와주세요.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/purchase-statements/${거래일자}/${거래번호}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        입출고구분: 입출고구분 || 1, // 기본: 입고
        매입처코드: 매입처코드,
        적요: 적요 || '',
        details: details.map((item) => ({
          자재코드: item.자재코드,
          수량: item.수량,
          단가: item.단가,
        })),
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert(
        '매입전표가 수정되었습니다.\n\n' +
          '✅ 자재입출내역 업데이트\n' +
          '✅ 미지급금내역 업데이트\n' +
          '✅ 회계전표 자동 생성\n\n' +
          `회계전표번호: ${data.data?.회계전표번호 || '생성됨'}\n` +
          `미지급금액: ${(data.data?.미지급금지급금액 || 0).toLocaleString()}원`,
      );
      closePurchaseStatementEditModal();
      loadPurchaseStatements();
    } else {
      alert('수정 실패: ' + (data.message || '알 수 없는 오류'));
    }
  } catch (err) {
    console.error('❌ 매입전표 수정 제출 에러:', err);
    alert('매입전표 수정 중 오류가 발생했습니다.');
  }
}

// ✅ 매입전표 삭제 모달 열기
function openPurchaseStatementDeleteModal(date, no, statementNo) {
  selectedPurchaseStatementForDelete = { date, no, statementNo };
  document.getElementById('purchaseStatementDeleteInfo').textContent = `전표번호: ${statementNo}`;
  document.getElementById('purchaseStatementDeleteModal').style.display = 'flex';
}

// ✅ 매입전표 삭제 모달 닫기
function closePurchaseStatementDeleteModal() {
  document.getElementById('purchaseStatementDeleteModal').style.display = 'none';
  selectedPurchaseStatementForDelete = null;
}

// ✅ 매입전표 삭제 확인
async function confirmPurchaseStatementDelete() {
  if (!selectedPurchaseStatementForDelete) return;

  const { date, no } = selectedPurchaseStatementForDelete;

  try {
    const res = await fetch(`${API_BASE_URL}/purchase-statements/${date}/${no}`, {
      method: 'DELETE',
    });
    const data = await res.json();

    if (data.success) {
      alert('매입전표가 삭제되었습니다.');
      closePurchaseStatementDeleteModal();
      loadPurchaseStatements();
    } else {
      alert('삭제 실패: ' + (data.message || '알 수 없는 오류'));
    }
  } catch (err) {
    console.error('❌ 매입전표 삭제 에러:', err);
    alert('매입전표 삭제 중 오류가 발생했습니다.');
  }
}

// ✅ Google Sheets 내보내기
function exportPurchaseStatementsToExcel() {
  alert('Google Sheets 내보내기 기능은 거래명세서 내보내기를 참조하여 구현 예정입니다.');
  // TODO: CSV 내보내기 구현 (transaction.js의 exportTransactionsToExcel 참조)
}

// ✅ 미지급금 잔액 조회
async function loadAccountsPayableBalance(supplierCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/accounts-payable/balance/${supplierCode}`);
    const data = await res.json();

    if (data.success) {
      return data.data;
    }
  } catch (err) {
    console.error('❌ 미지급 잔액 조회 에러:', err);
  }
  return null;
}

console.log('✅ purchase.js 로드 완료');
