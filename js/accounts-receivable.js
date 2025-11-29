/**
 * 미수금관리 (Accounts Receivable Management)
 * 매출처별 미수금 발생/입금 내역 조회 및 관리
 */

// DataTable 인스턴스
let accountsReceivableTable = null;

/**
 * 미수금관리 페이지 초기화
 */
function initAccountsReceivablePage() {
  console.log('📋 미수금관리 페이지 초기화');

  // 기본 날짜 설정 (오늘 날짜만 - 로그인 일자 기준)
  const today = new Date();
  document.getElementById('receivableStartDate').value = formatDate(today);
  document.getElementById('receivableEndDate').value = formatDate(today);

  // DataTable 초기화
  if (accountsReceivableTable) {
    accountsReceivableTable.destroy();
  }

  accountsReceivableTable = $('#accountsReceivableTable').DataTable({
    data: [],
    order: [], // 입력 순서 유지
    language: {
      emptyTable: '조회된 데이터가 없습니다.',
      info: '총 _TOTAL_건',
      infoEmpty: '0건',
      infoFiltered: '(전체 _MAX_건 중 필터링)',
      lengthMenu: '_MENU_ 개씩 보기',
      search: '검색:',
      zeroRecords: '검색 결과가 없습니다.',
      paginate: {
        first: '처음',
        last: '마지막',
        next: '다음',
        previous: '이전',
      },
    },
    columns: [
      {
        // 체크박스
        data: null,
        orderable: false,
        render: function (data, type, row, meta) {
          return `<input type="checkbox" class="receivable-checkbox" data-index="${meta.row}" />`;
        },
        width: '40px',
      },
      {
        // 일련번호
        data: null,
        render: function (data, type, row, meta) {
          return meta.row + 1;
        },
        width: '60px',
      },
      {
        // 매출처코드
        data: '매출처코드',
        width: '100px',
      },
      {
        // 매출처명
        data: '매출처명',
        width: '150px',
      },
      {
        // 입금일자
        data: '미수금입금일자',
        render: function (data) {
          if (!data) return '';
          return formatDateDisplay(data);
        },
        width: '100px',
      },
      {
        // 입금금액
        data: '미수금입금금액',
        render: function (data) {
          return data ? data.toLocaleString() + '원' : '0원';
        },
        className: 'text-right',
        width: '120px',
      },
      {
        // 결제방법
        data: '결제방법',
        render: function (data) {
          const methods = { 0: '현금', 1: '수표', 2: '어음', 3: '기타' };
          return methods[data] || '';
        },
        width: '80px',
      },
      {
        // 만기일자
        data: '만기일자',
        render: function (data) {
          if (!data) return '';
          return formatDateDisplay(data);
        },
        width: '100px',
      },
      {
        // 어음번호
        data: '어음번호',
        render: function (data) {
          return data || '';
        },
        width: '120px',
      },
      {
        // 적요
        data: '적요',
        render: function (data) {
          return data || '';
        },
        width: '200px',
      },
      {
        // 작업 버튼 (상세, 수정, 삭제)
        data: null,
        orderable: false,
        render: function (data, type, row, meta) {
          const receivableKey = `${row.미수금입금일자}-${row.매출처코드}`;
          return `
            <div class="action-buttons" id="receivable-actions-${receivableKey.replace(
              /[^a-zA-Z0-9]/g,
              '_',
            )}">
              <button class="btn-icon btn-view" onclick="viewAccountsReceivableDetail(${
                meta.row
              })" title="상세보기">상세</button>
              <button class="btn-icon btn-edit" style="display: none;" onclick="editAccountsReceivableByRow(${
                meta.row
              })" title="수정">수정</button>
              <button class="btn-icon btn-delete" style="display: none;" onclick="deleteAccountsReceivableByRow(${
                meta.row
              })" title="삭제">삭제</button>
            </div>
          `;
        },
        width: '120px',
      },
    ],
    pageLength: 25,
    lengthMenu: [
      [10, 25, 50, 100],
      [10, 25, 50, 100],
    ],
    responsive: true,
    // dom: '<"top"lf>rt<"bottom"ip>',
  });

  // 체크박스 변경 이벤트
  $('#accountsReceivableTable tbody').on('change', '.receivable-checkbox', function () {
    updateReceivableButtonStates();
  });

  // 자동 조회
  loadAccountsReceivable();
}

/**
 * 미수금 데이터 로드
 */
async function loadAccountsReceivable() {
  try {
    console.log('🔍 미수금 내역 조회 시작');

    const 시작일자 = document.getElementById('receivableStartDate').value.replace(/-/g, '');
    const 종료일자 = document.getElementById('receivableEndDate').value.replace(/-/g, '');

    // API 호출
    const url = `/api/accounts-receivable?시작일자=${시작일자}&종료일자=${종료일자}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      alert('조회 실패: ' + result.message);
      return;
    }

    console.log('✅ 미수금 내역 조회 완료:', result.data.length, '건');

    // DataTable 업데이트
    accountsReceivableTable.clear();
    accountsReceivableTable.rows.add(result.data);
    accountsReceivableTable.draw();

    // 요약 정보 업데이트
    document.getElementById('receivableCount').textContent = result.data.length;

    // 체크박스 초기화
    document.getElementById('receivableSelectAll').checked = false;
  } catch (err) {
    console.error('❌ 미수금 조회 에러:', err);
    alert('조회 중 오류가 발생했습니다.');
  }
}

/**
 * 전체 선택/해제
 */
function toggleSelectAllReceivable() {
  const selectAll = document.getElementById('receivableSelectAll').checked;
  document.querySelectorAll('.receivable-checkbox').forEach((checkbox) => {
    checkbox.checked = selectAll;
  });
  updateReceivableButtonStates();
}

/**
 * 버튼 표시/숨김 (체크박스 선택 시 각 행의 수정/삭제 버튼 표시)
 */
function updateReceivableButtonStates() {
  console.log('🔍 updateReceivableButtonStates 호출됨');

  // 모든 체크박스를 순회하면서 해당 행의 버튼 표시/숨김
  document.querySelectorAll('.receivable-checkbox').forEach((checkbox) => {
    const index = parseInt(checkbox.dataset.index);
    const rowData = accountsReceivableTable.row(index).data();

    if (rowData) {
      const receivableKey = `${rowData.미수금입금일자}-${rowData.매출처코드}`;
      const actionsDivId = `receivable-actions-${receivableKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const actionsDiv = document.getElementById(actionsDivId);

      console.log(
        `체크박스 index=${index}, checked=${
          checkbox.checked
        }, actionsDivId=${actionsDivId}, found=${!!actionsDiv}`,
      );

      if (actionsDiv) {
        const editBtn = actionsDiv.querySelector('.btn-edit');
        const deleteBtn = actionsDiv.querySelector('.btn-delete');

        console.log(`  버튼 찾기: editBtn=${!!editBtn}, deleteBtn=${!!deleteBtn}`);

        if (checkbox.checked) {
          // 체크박스 선택 시 수정/삭제 버튼 표시
          if (editBtn) {
            editBtn.style.display = 'inline-block';
            console.log(`  ✅ 수정 버튼 표시`);
          }
          if (deleteBtn) {
            deleteBtn.style.display = 'inline-block';
            console.log(`  ✅ 삭제 버튼 표시`);
          }
        } else {
          // 체크박스 해제 시 수정/삭제 버튼 숨김
          if (editBtn) editBtn.style.display = 'none';
          if (deleteBtn) deleteBtn.style.display = 'none';
        }
      } else {
        console.warn(`  ⚠️ actionsDiv를 찾을 수 없음: ${actionsDivId}`);
      }
    }
  });

  // toolbar의 일괄 버튼도 업데이트
  const checkedCount = document.querySelectorAll('.receivable-checkbox:checked').length;
  const toolbarEditBtn = document.getElementById('receivableEditSelectedBtn');
  const toolbarDeleteBtn = document.getElementById('receivableDeleteSelectedBtn');

  if (toolbarEditBtn && toolbarDeleteBtn) {
    if (checkedCount > 0) {
      toolbarEditBtn.style.display = 'inline-block';
      toolbarDeleteBtn.style.display = 'inline-block';
    } else {
      toolbarEditBtn.style.display = 'none';
      toolbarDeleteBtn.style.display = 'none';
    }
  }
}

/**
 * 선택 항목 수정
 */
function editSelectedAccountsReceivable() {
  const selected = getSelectedReceivables();
  if (selected.length === 0) {
    alert('수정할 항목을 선택하세요.');
    return;
  }
  alert('미수금 수정 기능은 준비 중입니다.');
}

/**
 * 선택 항목 삭제
 */
function deleteSelectedAccountsReceivable() {
  const selected = getSelectedReceivables();
  if (selected.length === 0) {
    alert('삭제할 항목을 선택하세요.');
    return;
  }
  if (!confirm(`선택한 ${selected.length}건의 미수금 내역을 삭제하시겠습니까?`)) {
    return;
  }
  alert('미수금 삭제 기능은 준비 중입니다.');
}

/**
 * 선택된 항목 가져오기
 */
function getSelectedReceivables() {
  const selected = [];
  document.querySelectorAll('.receivable-checkbox:checked').forEach((checkbox) => {
    const index = parseInt(checkbox.dataset.index);
    const rowData = accountsReceivableTable.row(index).data();
    selected.push(rowData);
  });
  return selected;
}

/**
 * 상세 보기
 */
function viewAccountsReceivableDetail(rowIndex) {
  try {
    console.log('🔍 미수금 상세 조회: rowIndex =', rowIndex);

    // DataTable에서 데이터 가져오기
    const data = accountsReceivableTable.row(rowIndex).data();

    if (!data) {
      alert('데이터를 찾을 수 없습니다.');
      return;
    }

    console.log('✅ 조회된 데이터:', data);

    // 모달 내용 구성
    const modalContent = `
      <div class="detail-view">
        <h3>미수금 내역 상세</h3>
        <table class="detail-table">
          <tr>
            <th>매출처코드</th>
            <td>${data.매출처코드}</td>
            <th>매출처명</th>
            <td>${data.매출처명 || ''}</td>
          </tr>
          <tr>
            <th>입금일자</th>
            <td>${formatDateDisplay(data.미수금입금일자)}</td>
            <th>입금금액</th>
            <td class="text-right">${data.미수금입금금액.toLocaleString()}원</td>
          </tr>
          <tr>
            <th>결제방법</th>
            <td>${{ 0: '현금', 1: '수표', 2: '어음', 3: '기타' }[data.결제방법] || ''}</td>
            <th>만기일자</th>
            <td>${data.만기일자 ? formatDateDisplay(data.만기일자) : ''}</td>
          </tr>
          <tr>
            <th>어음번호</th>
            <td>${data.어음번호 || ''}</td>
            <th>적요</th>
            <td>${data.적요 || ''}</td>
          </tr>
          <tr>
            <th>사용자코드</th>
            <td>${data.사용자코드 || ''}</td>
          </tr>
        </table>
      </div>
    `;

    // 모달 표시
    showModal('미수금 상세', modalContent);
  } catch (err) {
    console.error('❌ 상세 조회 에러:', err);
    alert('상세 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 개별 항목 수정 (rowIndex 기반)
 */
function editAccountsReceivableByRow(rowIndex) {
  try {
    const data = accountsReceivableTable.row(rowIndex).data();
    if (!data) {
      alert('데이터를 찾을 수 없습니다.');
      return;
    }
    // TODO: 내일 구현 예정
    alert(
      `미수금 수정\n\n매출처: ${data.매출처명}\n입금일자: ${formatDateDisplay(
        data.미수금입금일자,
      )}\n입금금액: ${data.미수금입금금액.toLocaleString()}원\n\n※ 수정 기능은 내일 구현 예정입니다.`,
    );
  } catch (err) {
    console.error('❌ 수정 에러:', err);
    alert('수정 중 오류가 발생했습니다.');
  }
}

/**
 * 개별 항목 삭제 (rowIndex 기반)
 */
function deleteAccountsReceivableByRow(rowIndex) {
  try {
    const data = accountsReceivableTable.row(rowIndex).data();
    if (!data) {
      alert('데이터를 찾을 수 없습니다.');
      return;
    }
    // TODO: 내일 구현 예정
    if (
      confirm(
        `미수금 삭제\n\n매출처: ${data.매출처명}\n입금일자: ${formatDateDisplay(
          data.미수금입금일자,
        )}\n입금금액: ${data.미수금입금금액.toLocaleString()}원\n\n정말 삭제하시겠습니까?\n\n※ 실제 삭제 기능은 내일 구현 예정입니다.`,
      )
    ) {
      alert('삭제 기능은 내일 구현 예정입니다.');
    }
  } catch (err) {
    console.error('❌ 삭제 에러:', err);
    alert('삭제 중 오류가 발생했습니다.');
  }
}

/**
 * CSV 내보내기
 */
function exportAccountsReceivableToCSV() {
  const data = accountsReceivableTable.rows().data().toArray();
  if (data.length === 0) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const headers = [
    '순번',
    '매출처코드',
    '매출처명',
    '입금일자',
    '입금금액',
    '결제방법',
    '만기일자',
    '어음번호',
    '적요',
  ];

  const rows = data.map((row, index) => {
    const methods = { 0: '현금', 1: '수표', 2: '어음', 3: '기타' };
    return [
      index + 1,
      row.매출처코드,
      row.매출처명,
      formatDateDisplay(row.미수금입금일자),
      row.미수금입금금액 ? row.미수금입금금액.toLocaleString() : '0',
      methods[row.결제방법] || '',
      formatDateDisplay(row.만기일자),
      row.어음번호 || '',
      row.적요 || '',
    ];
  });

  const csv = [headers, ...rows].map((row) => row.join('\t')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `미수금내역_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

// formatDate, formatDateDisplay 함수는 common.js에서 정의됨

// 페이지 로드 시 초기화
window.addEventListener('load', function () {
  // pageMap에 미수금관리 페이지 loadFunc 설정
  if (typeof window.pageMap !== 'undefined' && window.pageMap['receivable']) {
    window.pageMap['receivable'].loadFunc = initAccountsReceivablePage;
    console.log('✅ accounts-receivable.js 로드 완료 - pageMap.receivable.loadFunc 설정됨');
  } else {
    console.warn('⚠️ pageMap이 아직 정의되지 않음 - 나중에 재시도');
  }
});
