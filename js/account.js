/**
 * 계정과목관리 (Account Management)
 * 매출처관리와 동일한 패턴으로 구현
 */

$(document).ready(function () {
  let table;
  let currentSearchKeyword = ''; // 현재 검색 키워드 저장

  function loadAccounts(searchKeyword = '') {
    // 기존 인스턴스가 있으면 파괴 후 재생성
    if (table) table.destroy();

    // API URL에 검색 파라미터 추가
    let apiUrl = API_BASE_URL + '/accounts';
    if (searchKeyword) {
      apiUrl += `?search=${encodeURIComponent(searchKeyword)}`;
    }

    // ✅ 공통 초기화 함수 사용 (dataTableInit.js)
    table = initDataTable('accountTable', apiUrl, [
      {
        // 선택 체크박스
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return '<input type="checkbox" class="accountCheckbox" data-code="' + row.계정코드 + '" />';
        },
      },
      {
        // 순번
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row, meta) {
          return meta.row + 1;
        },
      },
      { data: '계정코드' },
      { data: '계정명' },
      {
        // 합계시산표연결여부
        data: '합계시산표연결여부',
        className: 'text-center',
        render: function (data, type, row) {
          if (data === 'Y') {
            return '<span class="status-badge status-active">연결</span>';
          } else {
            return '<span class="status-badge status-pending">미연결</span>';
          }
        },
      },
      {
        // 적요
        data: '적요',
        defaultContent: '-',
      },
      {
        // 사용구분
        data: '사용구분',
        className: 'text-center',
        render: function (data, type, row) {
          if (data === 0) {
            return '<span class="status-badge status-active">사용중</span>';
          } else {
            return '<span class="status-badge status-pending">미사용</span>';
          }
        },
      },
      {
        // 수정일자
        data: '수정일자',
        className: 'text-center',
        defaultContent: '-',
        render: function (data, type, row) {
          if (data && data.length === 8) {
            return data.substring(0, 4) + '-' + data.substring(4, 6) + '-' + data.substring(6, 8);
          }
          return data || '-';
        },
      },
      {
        // 관리 버튼
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return `
            <div class="action-buttons" id="actions-${row.계정코드}">
              <button class="btn-icon btn-view" onclick="viewAccountDetail('${row.계정코드}')">상세</button>
              <button class="btn-icon btn-edit" style="display: none;" onclick="editAccount('${row.계정코드}')">수정</button>
              <button class="btn-icon btn-delete" style="display: none;" onclick="deleteAccount('${row.계정코드}', '${row.계정명}')">삭제</button>
            </div>
          `;
        },
      },
    ]);
  }

  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadAccounts = loadAccounts;

  // 새로고침 버튼
  $('#btnAccountReload').on('click', () => table.ajax.reload(null, false));

  // 전체 선택 체크박스
  $(document).on('change', '#selectAllAccounts', function () {
    const isChecked = $(this).prop('checked');
    $('.accountCheckbox').prop('checked', isChecked).trigger('change');
  });

  // 개별 체크박스 변경 시
  $(document).on('change', '.accountCheckbox', function () {
    // 전체 선택 체크박스 상태 업데이트
    const totalCheckboxes = $('.accountCheckbox').length;
    const checkedCheckboxes = $('.accountCheckbox:checked').length;
    $('#selectAllAccounts').prop('checked', totalCheckboxes === checkedCheckboxes);

    // 현재 행의 버튼 표시/숨김 처리
    const accountCode = $(this).data('code');
    const isChecked = $(this).prop('checked');
    const actionDiv = $('#actions-' + accountCode);

    if (isChecked) {
      // 체크됨: 상세 버튼 숨기고 수정/삭제 버튼 표시
      actionDiv.find('.btn-view').hide();
      actionDiv.find('.btn-edit').show();
      actionDiv.find('.btn-delete').show();
    } else {
      // 체크 해제: 수정/삭제 버튼 숨기고 상세 버튼 표시
      actionDiv.find('.btn-view').show();
      actionDiv.find('.btn-edit').hide();
      actionDiv.find('.btn-delete').hide();
    }
  });

  // Enter 키 이벤트 처리
  $('#accountListSearchInput').on('keypress', function (e) {
    if (e.which === 13) {
      // Enter key
      e.preventDefault();
      searchAccounts();
    }
  });

  // 검색 함수를 전역으로 노출
  window.searchAccounts = function () {
    const keyword = $('#accountListSearchInput').val().trim();
    console.log('🔍 계정과목 검색:', keyword);
    currentSearchKeyword = keyword;
    loadAccounts(keyword);
  };

  // 검색 초기화 함수를 전역으로 노출
  window.resetAccountSearch = function () {
    console.log('🔄 계정과목 검색 초기화');
    $('#accountListSearchInput').val('');
    currentSearchKeyword = '';
    loadAccounts('');
  };
});

/**
 * 계정과목 상세보기
 */
async function viewAccountDetail(accountCode) {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/${accountCode}`);
    const result = await response.json();

    if (!result.success) {
      alert('계정과목 정보를 불러올 수 없습니다.');
      return;
    }

    const account = result.data;

    // 상세 정보 표시
    document.getElementById('detailAccountCode').textContent = account.계정코드 || '-';
    document.getElementById('detailAccountName').textContent = account.계정명 || '-';
    document.getElementById('detailAccountTrialBalance').textContent =
      account.합계시산표연결여부 === 'Y' ? '연결' : '미연결';
    document.getElementById('detailAccountDescription').textContent = account.적요 || '-';
    document.getElementById('detailAccountStatus').textContent =
      account.사용구분 === 0 ? '사용중' : '미사용';
    document.getElementById('detailAccountModifiedDate').textContent = account.수정일자
      ? account.수정일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      : '-';

    // 모달 표시
    document.getElementById('accountDetailModal').style.display = 'flex';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.accountDetailModalDraggable) {
      makeModalDraggable('accountDetailModal', 'accountDetailModalHeader');
      window.accountDetailModalDraggable = true;
    }
  } catch (error) {
    console.error('❌ 계정과목 상세 조회 오류:', error);
    alert('계정과목 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 계정과목 상세 모달 닫기
 */
function closeAccountDetailModal() {
  document.getElementById('accountDetailModal').style.display = 'none';
}

/**
 * 계정과목 신규 등록 모달 열기
 */
function openAccountModal() {
  // 입력 필드 초기화
  document.getElementById('accountCode').value = '';
  document.getElementById('accountName').value = '';
  document.getElementById('accountTrialBalance').value = 'Y';
  document.getElementById('accountDescription').value = '';
  document.getElementById('accountStatus').value = '0';

  // 모달 표시
  document.getElementById('accountCreateModal').style.display = 'flex';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.accountCreateModalDraggable) {
    makeModalDraggable('accountCreateModal', 'accountCreateModalHeader');
    window.accountCreateModalDraggable = true;
  }
}

/**
 * 계정과목 신규 등록 모달 닫기
 */
function closeAccountModal() {
  document.getElementById('accountCreateModal').style.display = 'none';
}

/**
 * 계정과목 신규 등록
 */
async function saveAccount() {
  const accountCode = document.getElementById('accountCode').value.trim();
  const accountName = document.getElementById('accountName').value.trim();
  const accountTrialBalance = document.getElementById('accountTrialBalance').value;
  const accountDescription = document.getElementById('accountDescription').value.trim();
  const accountStatus = parseInt(document.getElementById('accountStatus').value);

  // 유효성 검사
  if (!accountCode) {
    alert('계정코드를 입력해주세요.');
    document.getElementById('accountCode').focus();
    return;
  }

  if (accountCode.length !== 4) {
    alert('계정코드는 4자리여야 합니다.');
    document.getElementById('accountCode').focus();
    return;
  }

  if (!accountName) {
    alert('계정명을 입력해주세요.');
    document.getElementById('accountName').focus();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        계정코드: accountCode,
        계정명: accountName,
        합계시산표연결여부: accountTrialBalance,
        적요: accountDescription,
        사용구분: accountStatus,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert('계정과목이 등록되었습니다.');
      closeAccountModal();
      loadAccounts(currentSearchKeyword); // 목록 새로고침
    } else {
      alert('등록 실패: ' + (result.message || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('❌ 계정과목 등록 오류:', error);
    alert('계정과목 등록 중 오류가 발생했습니다.');
  }
}

/**
 * 계정과목 수정 모달 열기
 */
async function editAccount(accountCode) {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts/${accountCode}`);
    const result = await response.json();

    if (!result.success) {
      alert('계정과목 정보를 불러올 수 없습니다.');
      return;
    }

    const account = result.data;

    // 수정 폼에 데이터 채우기
    document.getElementById('editAccountCode').value = account.계정코드;
    document.getElementById('editAccountName').value = account.계정명;
    document.getElementById('editAccountTrialBalance').value = account.합계시산표연결여부;
    document.getElementById('editAccountDescription').value = account.적요 || '';
    document.getElementById('editAccountStatus').value = account.사용구분;

    // 모달 표시
    document.getElementById('accountEditModal').style.display = 'flex';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.accountEditModalDraggable) {
      makeModalDraggable('accountEditModal', 'accountEditModalHeader');
      window.accountEditModalDraggable = true;
    }
  } catch (error) {
    console.error('❌ 계정과목 수정 모달 오류:', error);
    alert('계정과목 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 계정과목 수정 모달 닫기
 */
function closeAccountEditModal() {
  document.getElementById('accountEditModal').style.display = 'none';
}

/**
 * 계정과목 수정 저장
 */
async function updateAccount() {
  const accountCode = document.getElementById('editAccountCode').value.trim();
  const accountName = document.getElementById('editAccountName').value.trim();
  const accountTrialBalance = document.getElementById('editAccountTrialBalance').value;
  const accountDescription = document.getElementById('editAccountDescription').value.trim();
  const accountStatus = parseInt(document.getElementById('editAccountStatus').value);

  // 유효성 검사
  if (!accountName) {
    alert('계정명을 입력해주세요.');
    document.getElementById('editAccountName').focus();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/accounts/${accountCode}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        계정명: accountName,
        합계시산표연결여부: accountTrialBalance,
        적요: accountDescription,
        사용구분: accountStatus,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert('계정과목이 수정되었습니다.');
      closeAccountEditModal();
      loadAccounts(currentSearchKeyword); // 목록 새로고침
    } else {
      alert('수정 실패: ' + (result.message || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('❌ 계정과목 수정 오류:', error);
    alert('계정과목 수정 중 오류가 발생했습니다.');
  }
}

/**
 * 계정과목 삭제 - 모달 열기
 */
let selectedAccountForDelete = null;

function deleteAccount(accountCode, accountName) {
  openAccountDeleteModal(accountCode, accountName);
}

/**
 * 계정과목 삭제 모달 열기
 */
function openAccountDeleteModal(accountCode, accountName) {
  selectedAccountForDelete = { code: accountCode, name: accountName };

  // 모달에 계정 정보 표시
  document.getElementById('accountDeleteInfo').textContent =
    `계정코드: ${accountCode} (${accountName})`;

  // 모달 표시
  document.getElementById('accountDeleteModal').style.display = 'flex';

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.accountDeleteModalDraggable) {
    makeModalDraggable('accountDeleteModal', 'accountDeleteModalHeader');
    window.accountDeleteModalDraggable = true;
  }
}

/**
 * 계정과목 삭제 모달 닫기
 */
function closeAccountDeleteModal() {
  document.getElementById('accountDeleteModal').style.display = 'none';
  selectedAccountForDelete = null;
}

/**
 * 계정과목 삭제 확인 및 실행
 */
async function confirmAccountDelete() {
  if (!selectedAccountForDelete) {
    return;
  }

  const accountCode = selectedAccountForDelete.code;

  try {
    const response = await fetch(`${API_BASE_URL}/accounts/${accountCode}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const result = await response.json();

    if (result.success) {
      alert('계정과목이 삭제되었습니다.');
      closeAccountDeleteModal();
      loadAccounts(currentSearchKeyword); // 목록 새로고침
    } else {
      alert('삭제 실패: ' + (result.message || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('❌ 계정과목 삭제 오류:', error);
    alert('계정과목 삭제 중 오류가 발생했습니다.');
  }
}

console.log('✅ account.js 로드 완료');
