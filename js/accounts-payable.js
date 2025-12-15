/**
 * 미지급금관리 (Accounts Payable Management)
 * 매입처별 미지급금 발생/지급 내역 조회 및 관리
 */

// DataTable 인스턴스
let accountsPayableTable = null;

/**
 * 미지급금관리 페이지 초기화
 */
function initAccountsPayablePage() {
  console.log('📋 미지급금관리 페이지 초기화');

  // 기본 날짜 설정 (오늘 날짜만 - 로그인 일자 기준)
  const today = new Date();
  document.getElementById('payableStartDate').value = formatDate(today);
  document.getElementById('payableEndDate').value = formatDate(today);

  // DataTable 초기화
  if (accountsPayableTable) {
    accountsPayableTable.destroy();
  }

  accountsPayableTable = $('#accountsPayableTable').DataTable({
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
          return `<input type="checkbox" class="payable-checkbox" data-index="${meta.row}" />`;
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
        // 매입처코드
        data: '매입처코드',
        width: '100px',
      },
      {
        // 매입처명
        data: '매입처명',
        width: '150px',
      },
      {
        // 지급일자
        data: '미지급금지급일자',
        render: function (data) {
          if (!data) return '';
          return formatDateDisplay(data);
        },
        width: '100px',
      },
      {
        // 지급금액
        data: '미지급금지급금액',
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
          const payableKey = `${row.미지급금지급일자}-${row.매입처코드}`;
          return `
            <div class="action-buttons" id="payableActions-${payableKey.replace(
              /[^a-zA-Z0-9]/g,
              '_',
            )}">
              <button class="btn-icon payableBtnView" onclick="viewAccountsPayableDetail(${
                meta.row
              })" title="상세보기">상세</button>
              <button class="btn-icon payableBtnEdit" style="display: none;" onclick="editAccountsPayableByRow(${
                meta.row
              })" title="수정">수정</button>
              <button class="btn-icon payableBtnDelete" style="display: none;" onclick="deleteAccountsPayableByRow(${
                meta.row
              })" title="삭제">삭제</button>
            </div>
          `;
        },
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
  // $('#accountsPayableTable tbody').on('change', '.payable-checkbox', function () {
  //   updatePayableButtonStates();
  // });

  // 자동 조회
  loadAccountsPayable();
}

/**
 * 미지급금 데이터 로드
 */
async function loadAccountsPayable() {
  try {
    console.log('🔍 미지급금 내역 조회 시작');

    const 시작일자 = document.getElementById('payableStartDate').value.replace(/-/g, '');
    const 종료일자 = document.getElementById('payableEndDate').value.replace(/-/g, '');

    // API 호출
    const url = `/api/accounts-payable?시작일자=${시작일자}&종료일자=${종료일자}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      alert('조회 실패: ' + result.message);
      return;
    }

    console.log('✅ 미지급금 내역 조회 완료:', result.data.length, '건');

    // DataTable 업데이트
    accountsPayableTable.clear();
    accountsPayableTable.rows.add(result.data);
    accountsPayableTable.draw();

    // 요약 정보 업데이트
    document.getElementById('payableCount').textContent = result.data.length;

    // 체크박스 초기화
    // document.getElementById('payableSelectAll').checked = false;

    $('#payableSelectAll').on('change', function () {
      const isChecked = $(this).prop('checked');
      $('.payable-checkbox').prop('checked', isChecked).trigger('change');
    });
    // 개별 체크박스 이벤트 (이벤트 위임 방식)
    $(document).on('change', '.payable-checkbox', function () {
      const payableDate = $(this).data('date');
      const quotationNo = $(this).data('no');
      const isChecked = $(this).prop('checked');
      const actionDiv = $(`#actions-${quotationDate}_${quotationNo}`);

      if (isChecked) {
        actionDiv.find('.payableBtnView').hide();
        actionDiv.find('.payableBtnEdit').show();
        actionDiv.find('.payableBtnDelete').show();
        actionDiv.find('.btn-approve').show();
      } else {
        actionDiv.find('.payableBtnView').show();
        actionDiv.find('.payableBtnEdit').hide();
        actionDiv.find('.payableBtnDelete').hide();
        actionDiv.find('.btn-approve').hide();
      }
    });
  } catch (err) {
    console.error('❌ 미지급금 조회 에러:', err);
    alert('조회 중 오류가 발생했습니다.');
  }
}

/**
 * 전체 선택/해제
 */
function toggleSelectAllPayable() {
  const selectAll = document.getElementById('payableSelectAll').checked;
  document.querySelectorAll('.payable-checkbox').forEach((checkbox) => {
    checkbox.checked = selectAll;
  });
  updatePayableButtonStates();
}

/**
 * 버튼 표시/숨김 (체크박스 선택 시 각 행의 수정/삭제 버튼 표시)
 */
function updatePayableButtonStates() {
  console.log('🔍 updatePayableButtonStates 호출됨');

  // 모든 체크박스를 순회하면서 해당 행의 버튼 표시/숨김
  document.querySelectorAll('.payable-checkbox').forEach((checkbox) => {
    const index = parseInt(checkbox.dataset.index);
    const rowData = accountsPayableTable.row(index).data();

    if (rowData) {
      const payableKey = `${rowData.미지급금지급일자}-${rowData.매입처코드}`;
      const actionsDivId = `payableActions-${payableKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const actionsDiv = document.getElementById(actionsDivId);

      console.log(
        `체크박스 index=${index}, checked=${
          checkbox.checked
        }, actionsDivId=${actionsDivId}, found=${!!actionsDiv}`,
      );

      if (actionsDiv) {
        const editBtn = actionsDiv.querySelector('.payableBtnEdit');
        const deleteBtn = actionsDiv.querySelector('.payableBtnDelete');

        console.log(`  버튼 찾기: editBtn=${!!editBtn}, deleteBtn=${!!deleteBtn}`);

        if (checkbox.checked) {
          // 체크박스 선택 시 수정/삭제 버튼 표시
          if (editBtn) {
            editBtn.style.setProperty('display', 'inline-block', 'important');
            console.log(`  ✅ 수정 버튼 표시`);
          }
          if (deleteBtn) {
            deleteBtn.style.setProperty('display', 'inline-block', 'important');
            console.log(`  ✅ 삭제 버튼 표시`);
          }
        } else {
          // 체크박스 해제 시 수정/삭제 버튼 숨김
          if (editBtn) editBtn.style.setProperty('display', 'none', 'important');
          if (deleteBtn) deleteBtn.style.setProperty('display', 'none', 'important');
        }
      } else {
        console.warn(`  ⚠️ actionsDiv를 찾을 수 없음: ${actionsDivId}`);
      }
    }
  });

  // toolbar의 일괄 버튼도 업데이트
  const checkedCount = document.querySelectorAll('.payable-checkbox:checked').length;
  const toolbarEditBtn = document.getElementById('payableEditSelectedBtn');
  const toolbarDeleteBtn = document.getElementById('payableDeleteSelectedBtn');

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
function editSelectedAccountsPayable() {
  const selected = getSelectedPayables();
  if (selected.length === 0) {
    alert('수정할 항목을 선택하세요.');
    return;
  }
  if (selected.length > 1) {
    alert('한 번에 하나의 항목만 수정할 수 있습니다.');
    return;
  }

  const row = selected[0];
  editAccountsPayable(row.매입처코드, row.미지급금지급일자);
}

/**
 * 선택 항목 삭제
 */
async function deleteSelectedAccountsPayable() {
  const selected = getSelectedPayables();
  if (selected.length === 0) {
    alert('삭제할 항목을 선택하세요.');
    return;
  }

  if (!confirm(`선택한 ${selected.length}건의 미지급금 내역을 삭제하시겠습니까?`)) {
    return;
  }

  try {
    let successCount = 0;
    let failCount = 0;

    for (const row of selected) {
      const response = await fetch(
        `/api/accounts-payable/${row.매입처코드}/${row.미지급금지급일자}`,
        {
          method: 'DELETE',
        },
      );

      const result = await response.json();
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error('삭제 실패:', row, result.message);
      }
    }

    alert(`삭제 완료\n성공: ${successCount}건\n실패: ${failCount}건`);
    loadAccountsPayable(); // 새로고침
  } catch (err) {
    console.error('❌ 삭제 에러:', err);
    alert('삭제 중 오류가 발생했습니다.');
  }
}

/**
 * 선택된 행 데이터 가져오기
 */
function getSelectedPayables() {
  const selected = [];
  document.querySelectorAll('.payable-checkbox:checked').forEach((checkbox) => {
    const index = parseInt(checkbox.dataset.index);
    const rowData = accountsPayableTable.row(index).data();
    selected.push(rowData);
  });
  return selected;
}

/**
 * 상세보기
 */
function viewAccountsPayableDetail(rowIndex) {
  try {
    console.log('🔍 미지급금 상세 조회: rowIndex =', rowIndex);

    // DataTable에서 데이터 가져오기
    const data = accountsPayableTable.row(rowIndex).data();

    if (!data) {
      alert('데이터를 찾을 수 없습니다.');
      return;
    }

    console.log('✅ 조회된 데이터:', data);

    // 모달 내용 구성
    const modalContent = `
      <div class="detail-view">
        <h3>미지급금 내역 상세</h3>
        <table class="detail-table">
          <tr>
            <th>매입처코드</th>
            <td>${data.매입처코드}</td>
            <th>매입처명</th>
            <td>${data.매입처명 || ''}</td>
          </tr>
          <tr>
            <th>지급일자</th>
            <td>${formatDateDisplay(data.미지급금지급일자)}</td>
            <th>지급금액</th>
            <td class="text-right">${data.미지급금지급금액.toLocaleString()}원</td>
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
    showModal('미지급금 상세', modalContent);
  } catch (err) {
    console.error('❌ 상세 조회 에러:', err);
    alert('상세 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 개별 항목 수정 (rowIndex 기반)
 */
function editAccountsPayableByRow(rowIndex) {
  try {
    const data = accountsPayableTable.row(rowIndex).data();
    if (!data) {
      alert('데이터를 찾을 수 없습니다.');
      return;
    }
    // 기존 수정 함수 호출
    editAccountsPayable(data.매입처코드, data.미지급금지급일자);
  } catch (err) {
    console.error('❌ 수정 에러:', err);
    alert('수정 중 오류가 발생했습니다.');
  }
}

/**
 * 수정
 */
async function editAccountsPayable(매입처코드, 지급일자) {
  try {
    console.log('✏️ 미지급금 수정:', 매입처코드, 지급일자);

    // 기존 데이터 조회
    const response = await fetch(`/api/accounts-payable/${매입처코드}/${지급일자}`);
    const result = await response.json();

    if (!result.success) {
      alert('조회 실패: ' + result.message);
      return;
    }

    const data = result.data;

    // 수정 폼 모달
    const modalContent = `
      <div class="edit-form">
        <h3>미지급금 내역 수정</h3>
        <form id="payableEditForm">
          <table class="form-table">
            <tr>
              <th>매입처코드 *</th>
              <td>
                <input type="text" id="editPayableSupplierCode" value="${
                  data.매입처코드
                }" readonly />
              </td>
            </tr>
            <tr>
              <th>지급일자 *</th>
              <td>
                <input type="date" id="editPayableDate" value="${formatDate(
                  data.미지급금지급일자,
                )}" readonly />
              </td>
            </tr>
            <tr>
              <th>지급금액 *</th>
              <td>
                <input type="number" id="editPayableAmount" value="${
                  data.미지급금지급금액
                }" required />
              </td>
            </tr>
            <tr>
              <th>결제방법</th>
              <td>
                <select id="editPayableMethod">
                  <option value="0" ${data.결제방법 === '0' ? 'selected' : ''}>현금</option>
                  <option value="1" ${data.결제방법 === '1' ? 'selected' : ''}>수표</option>
                  <option value="2" ${data.결제방법 === '2' ? 'selected' : ''}>어음</option>
                  <option value="3" ${data.결제방법 === '3' ? 'selected' : ''}>기타</option>
                </select>
              </td>
            </tr>
            <tr>
              <th>만기일자</th>
              <td>
                <input type="date" id="editPayableMaturityDate" value="${
                  data.만기일자 ? formatDate(data.만기일자) : ''
                }" />
              </td>
            </tr>
            <tr>
              <th>어음번호</th>
              <td>
                <input type="text" id="editPayableBillNumber" value="${data.어음번호 || ''}" />
              </td>
            </tr>
            <tr>
              <th>적요</th>
              <td>
                <input type="text" id="editPayableRemark" value="${data.적요 || ''}" />
              </td>
            </tr>
          </table>
          <div class="form-actions">
            <button type="button" onclick="submitPayableEdit()">수정 완료</button>
            <button type="button" onclick="closeModal()">취소</button>
          </div>
        </form>
      </div>
    `;

    showModal('미지급금 수정', modalContent);
  } catch (err) {
    console.error('❌ 수정 폼 로드 에러:', err);
    alert('수정 폼 로드 중 오류가 발생했습니다.');
  }
}

/**
 * 수정 완료
 */
async function submitPayableEdit() {
  try {
    const 매입처코드 = document.getElementById('editPayableSupplierCode').value;
    const 지급일자 = document.getElementById('editPayableDate').value.replace(/-/g, '');
    const 지급금액 = parseFloat(document.getElementById('editPayableAmount').value);
    const 결제방법 = document.getElementById('editPayableMethod').value;
    const 만기일자 = document.getElementById('editPayableMaturityDate').value.replace(/-/g, '');
    const 어음번호 = document.getElementById('editPayableBillNumber').value;
    const 적요 = document.getElementById('editPayableRemark').value;

    if (!지급금액 || 지급금액 <= 0) {
      alert('지급금액을 올바르게 입력하세요.');
      return;
    }

    const response = await fetch(`/api/accounts-payable/${매입처코드}/${지급일자}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        미지급금지급금액: 지급금액,
        결제방법,
        만기일자: 만기일자 || null,
        어음번호: 어음번호 || null,
        적요: 적요 || null,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert('수정되었습니다.');
      closeModal();
      loadAccountsPayable(); // 새로고침
    } else {
      alert('수정 실패: ' + result.message);
    }
  } catch (err) {
    console.error('❌ 수정 에러:', err);
    alert('수정 중 오류가 발생했습니다.');
  }
}

/**
 * 개별 항목 삭제 (rowIndex 기반)
 */
function deleteAccountsPayableByRow(rowIndex) {
  try {
    const data = accountsPayableTable.row(rowIndex).data();
    if (!data) {
      alert('데이터를 찾을 수 없습니다.');
      return;
    }
    // 기존 삭제 함수 호출
    deleteAccountsPayable(data.매입처코드, data.미지급금지급일자);
  } catch (err) {
    console.error('❌ 삭제 에러:', err);
    alert('삭제 중 오류가 발생했습니다.');
  }
}

/**
 * 삭제
 */
async function deleteAccountsPayable(매입처코드, 지급일자) {
  if (!confirm('이 미지급금 내역을 삭제하시겠습니까?')) {
    return;
  }

  try {
    const response = await fetch(`/api/accounts-payable/${매입처코드}/${지급일자}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      alert('삭제되었습니다.');
      loadAccountsPayable(); // 새로고침
    } else {
      alert('삭제 실패: ' + result.message);
    }
  } catch (err) {
    console.error('❌ 삭제 에러:', err);
    alert('삭제 중 오류가 발생했습니다.');
  }
}

/**
 * Google Sheets로 내보내기 (CSV)
 */
function exportAccountsPayableToCSV() {
  try {
    console.log('📊 Google Sheets CSV 내보내기');

    const data = accountsPayableTable.rows({ search: 'applied' }).data().toArray();

    if (data.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = [
      '일련번호',
      '매입처코드',
      '매입처명',
      '지급일자',
      '지급금액',
      '결제방법',
      '만기일자',
      '어음번호',
      '적요',
    ];

    // CSV 데이터 생성
    const rows = data.map((row, index) => {
      const 결제방법 = { 0: '현금', 1: '수표', 2: '어음', 3: '기타' }[row.결제방법] || '';

      return [
        index + 1,
        row.매입처코드,
        row.매입처명 || '',
        formatDateDisplay(row.미지급금지급일자),
        row.미지급금지급금액 || 0,
        결제방법,
        row.만기일자 ? formatDateDisplay(row.만기일자) : '',
        row.어음번호 || '',
        row.적요 || '',
      ];
    });

    // CSV 문자열 생성
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

    // BOM 추가 (한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 다운로드
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `미지급금내역_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV 다운로드 완료:', data.length, '건');
  } catch (err) {
    console.error('❌ CSV 내보내기 에러:', err);
    alert('CSV 내보내기 중 오류가 발생했습니다.');
  }
}

// formatDate, formatDateDisplay, showModal, closeModal 함수는 common.js에서 정의됨

// 페이지 로드 시 초기화
window.addEventListener('load', function () {
  // pageMap에 미지급금관리 페이지 loadFunc 설정
  if (typeof window.pageMap !== 'undefined' && window.pageMap['payable']) {
    window.pageMap['payable'].loadFunc = initAccountsPayablePage;
    console.log('✅ accounts-payable.js 로드 완료 - pageMap.payable.loadFunc 설정됨');
  } else {
    console.warn('⚠️ pageMap이 아직 정의되지 않음 - 나중에 재시도');
  }
});
