// ✅ 매입전표관리 스크립트 (purchase.js)
// 거래명세서관리(transaction.js)를 참조하여 작성
// 주요 차이점: 매출처 → 매입처, 출고 → 입고
// 미지급금 처리 추가

// 전역 변수
let selectedPurchaseStatementForDelete = null;
let newPurchaseStatementDetails = []; // 신규 작성 시 품목 목록

document.addEventListener('DOMContentLoaded', () => {
  // 페이지 로드 시 매입전표 목록 불러오기
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const startDate = today.toISOString().slice(0, 10);

  document.getElementById('purchaseStatementStartDate').value = startDate;
  document.getElementById('purchaseStatementEndDate').value = endDate;

  // 매입전표 작성 폼 초기 날짜 설정
  const createDateInput = document.getElementById('purchaseStatementCreateDate');
  if (createDateInput) {
    createDateInput.value = today.toISOString().slice(0, 10);
  }

  loadPurchaseStatements();
});

// ✅ 매입전표 목록 불러오기
async function loadPurchaseStatements() {
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

    // ✅ DataTable 초기화 (purchase-actions- prefix 사용)
    window.purchaseStatementTableInstance = $('#purchaseStatementTable').DataTable({
      data: tableData,
      columns: [
        {
          data: null,
          render: (data, type, row, meta) =>
            `<input type="checkbox" class="purchaseStatementCheckbox" data-date="${row.거래일자}" data-no="${row.거래번호}">`,
          orderable: false,
        },
        {
          data: null,
          render: (data, type, row, meta) => meta.row + 1,
          defaultContent: '-'
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
              <div id="purchase-actions-${row.거래일자}_${row.거래번호}" style="display: flex; gap: 4px; justify-content: center;">
                <button class="btn-icon btn-view" onclick="openPurchaseStatementDetailModal('${row.전표번호}')" title="보기">보기</button>
                <button class="btn-icon btn-edit" style="display: none;" onclick="editPurchaseStatement('${row.거래일자}', ${row.거래번호})" title="수정">수정</button>
                <button class="btn-icon btn-delete" style="display: none;" onclick="openPurchaseStatementDeleteModal('${row.거래일자}', ${row.거래번호}, '${row.전표번호}')" title="삭제">삭제</button>
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
      drawCallback: function(settings) {
        // DataTable이 다시 그려질 때마다 체크박스 상태에 따라 버튼 표시
        $('.purchaseStatementCheckbox').each(function() {
          const $checkbox = $(this);
          const purchaseDate = String($checkbox.data('date'));
          const purchaseNo = String($checkbox.data('no'));
          const isChecked = $checkbox.prop('checked');
          const actionDiv = $('#purchase-actions-' + purchaseDate + '_' + purchaseNo);

          if (isChecked) {
            actionDiv.find('.btn-view').hide();
            actionDiv.find('.btn-edit').show();
            actionDiv.find('.btn-delete').show();
          } else {
            actionDiv.find('.btn-view').show();
            actionDiv.find('.btn-edit').hide();
            actionDiv.find('.btn-delete').hide();
          }
        });
      }
    });
  } catch (err) {
    console.error('❌ 매입전표 조회 에러:', err);
    alert('매입전표 조회 중 오류가 발생했습니다.');
  }
}

// ✅ 체크박스 이벤트 핸들러
$(document)
  .off('change', '.purchaseStatementCheckbox')
  .on('change', '.purchaseStatementCheckbox', function () {
    const purchaseDate = String($(this).data('date'));
    const purchaseNo = String($(this).data('no'));
    const isChecked = $(this).prop('checked');
    const actionDiv = $('#purchase-actions-' + purchaseDate + '_' + purchaseNo);

    if (isChecked) {
      actionDiv.find('.btn-view').hide();
      actionDiv.find('.btn-edit').show();
      actionDiv.find('.btn-delete').show();
    } else {
      actionDiv.find('.btn-view').show();
      actionDiv.find('.btn-edit').hide();
      actionDiv.find('.btn-delete').hide();
    }
  });

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
      '$1-$2-$3'
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
        { data: '자재코드', render: (d) => (d ? d.substring(4) : '-') },
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
function openPurchaseStatementModal() {
  // 품목 목록 초기화
  newPurchaseStatementDetails = [];

  // 폼 초기화
  document.getElementById('purchaseStatementCreateSupplierCode').value = '';
  document.getElementById('purchaseStatementCreateSupplierName').value = '';
  document.getElementById('purchaseStatementCreateRemark').value = '';

  // 오늘 날짜로 설정
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('purchaseStatementCreateDate').value = today;

  // 테이블 초기화
  updateNewPurchaseStatementDetailsTable();

  // 모달 표시
  document.getElementById('purchaseStatementCreateModal').style.display = 'flex';
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
    tbody.innerHTML = '<tr><td colspan="10" style="padding: 40px; text-align: center; color: #6b7280;">자재 추가 버튼을 클릭하여 매입 상세내역을 입력하세요</td></tr>';
  } else {
    tbody.innerHTML = newPurchaseStatementDetails.map((item, index) => {
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
            <button type="button" onclick="editNewPurchaseStatementDetail(${index})" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">수정</button>
          </td>
          <td style="padding: 12px; text-align: center;">
            <button type="button" onclick="deleteNewPurchaseStatementDetail(${index})" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">삭제</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 합계 계산
  const totalSupply = newPurchaseStatementDetails.reduce((sum, item) => sum + (item.수량 * item.단가), 0);
  const totalVat = Math.round(totalSupply * 0.1);
  const grandTotal = totalSupply + totalVat;

  document.getElementById('purchaseStatementCreateTotalSupply').textContent = totalSupply.toLocaleString();
  document.getElementById('purchaseStatementCreateTotalVat').textContent = totalVat.toLocaleString();
  document.getElementById('purchaseStatementCreateGrandTotal').textContent = grandTotal.toLocaleString();
}

// ✅ 신규 매입전표 자재 추가 모달 열기
function openNewPurchaseStatementDetailAddModal() {
  alert('자재 추가 기능은 거래명세서관리의 자재 추가 모달을 참조하여 구현 예정입니다.');
  // TODO: 자재 검색 모달 구현 (transaction.js의 newTransactionDetailAddModal 참조)
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
  alert('매입처 검색 모달은 매입처관리 페이지의 DataTable을 재사용하여 구현 예정입니다.');
  // TODO: 매입처 검색 모달 구현 (supplier.js의 DataTable 재사용)
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

  const details = newPurchaseStatementDetails.map(item => ({
    자재코드: item.자재코드,
    수량: item.수량,
    단가: item.단가,
  }));

  try {
    const res = await fetch(`${API_BASE_URL}/purchase-statements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        거래일자,
        입출고구분: parseInt(입출고구분),
        매입처코드,
        적요,
        details,
      }),
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
function editPurchaseStatement(date, no) {
  alert(`매입전표 수정 기능은 거래명세서 수정 모달을 참조하여 구현 예정입니다.\n거래일자: ${date}\n거래번호: ${no}`);
  // TODO: 매입전표 수정 모달 구현 (transaction.js의 editTransaction 참조)
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
