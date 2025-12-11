/**
 * 계정과목관리 (Account Management)
 * - DataTables.js 제거
 * - 순수 JavaScript + CommonTable 기반으로 재구현
 *
 * 주요 기능
 *  1. 계정 목록 조회 / 검색
 *  2. 상세보기 모달
 *  3. 신규 등록 / 수정 / 삭제
 */

// ✅ 공통으로 사용할 전역 변수
let accountTable = null; // CommonTable 인스턴스
let currentSearchKeyword = ''; // 현재 검색 키워드

/**
 * ✅ 계정과목 목록 테이블 초기화 (CommonTable 인스턴스 생성)
 */
function initAccountTable() {
  // 이미 생성된 경우 재사용
  if (accountTable) return;

  // CommonTable 인스턴스 생성
  accountTable = new CommonTable('accountTable', {
    mode: 'list', // 기본 목록 모드
    apiUrl: `${API_BASE_URL}/accounts`, // 기본 API URL
    rowsPerPage: 10,
    enablePagination: true,

    // ✅ 체크박스 사용 설정
    enableCheckbox: true, // 첫 번째 컬럼에 체크박스 자동 추가
    checkboxSingleSelect: false, // 여러 행 선택 허용
    selectAllCheckboxId: 'selectAllAccounts', // 헤더의 전체 선택 체크박스
    // checkboxClass: 'accountCheckbox', // ✅ 여기만 추가
    checkboxClass: 'row-checkbox',
    checkboxDataAttributes: {
      // 체크박스에 data-code="계정코드" 부여
      code: '계정코드',
    },

    // ✅ 컬럼 정의 (헤더 순서에 맞춰야 합니다)
    columns: [
      {
        // 순번
        field: 'rowNumber',
        label: '순번',
        align: 'center',
        sortable: false,
        // index는 필터링된 전체 데이터 기준 0부터 시작
        render: (value, row, index) => index + 1,
      },
      {
        // 계정코드
        field: '계정코드',
        label: '계정코드',
        align: 'center',
      },
      {
        // 계정명
        field: '계정명',
        label: '계정명',
        align: 'left',
      },
      {
        // 합계시산표연결여부
        field: '합계시산표연결여부',
        label: '합계시산표',
        align: 'center',
        render: (value) => {
          if (value === 'Y') {
            return '<span class="status-badge status-active">연결</span>';
          }
          return '<span class="status-badge status-pending">미연결</span>';
        },
      },
      {
        // 적요
        field: '적요',
        label: '적요',
        align: 'left',
        defaultValue: '-',
      },
      {
        // 사용구분
        field: '사용구분',
        label: '사용구분',
        align: 'center',
        render: (value) => {
          if (value === 0) {
            return '<span class="status-badge status-active">사용중</span>';
          }
          return '<span class="status-badge status-pending">미사용</span>';
        },
      },
      {
        // 수정일자
        field: '수정일자',
        label: '수정일자',
        align: 'center',
        render: (value) => {
          if (value && value.length === 8) {
            // YYYYMMDD → YYYY-MM-DD
            return value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
          }
          return value || '-';
        },
      },
      {
        // 관리 버튼 영역
        field: 'actions',
        label: '관리',
        align: 'center',
        sortable: false,
        render: (value, row) => {
          const code = row.계정코드 || '';
          const name = row.계정명 || '';

          // 처음에는 상세 버튼만 보이고, 수정/삭제는 숨김
          return `
            <div class="action-buttons" id="actions-${code}">
              <button class="btn-icon btn-view"
                title="상세"
                onclick="viewAccountDetail('${code}')">
                상세
              </button>
              <button class="btn-icon btn-edit"
                title="수정"
                style="display: none;"
                onclick="editAccount('${code}')">
                수정
              </button>
              <button class="btn-icon btn-delete"
                title="삭제"
                style="display: none;"
                onclick="deleteAccount('${code}', '${name}')">
                삭제
              </button>
            </div>
          `;
        },
      },
    ],

    // ✅ 체크박스 상태 변경 시 호출 (한 행 또는 전체 선택 시)
    onCheckboxChange: (checkbox, isChecked) => {
      const code = checkbox.dataset.code;
      if (!code) return;

      const actionDiv = document.getElementById(`actions-${code}`);
      if (!actionDiv) return;

      const btnView = actionDiv.querySelector('.btn-view');
      const btnEdit = actionDiv.querySelector('.btn-edit');
      const btnDelete = actionDiv.querySelector('.btn-delete');

      if (isChecked) {
        // 체크된 경우 : 상세 숨기고 수정/삭제 노출
        if (btnView) btnView.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnDelete) btnDelete.style.display = 'inline-flex';
      } else {
        // 체크 해제 시 : 수정/삭제 숨기고 상세 노출
        if (btnView) btnView.style.display = 'inline-flex';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
      }
    },

    // 데이터가 바뀔 때마다 호출 (필요하면 통계 등 처리 가능)
    onDataChange: (data) => {
      console.log('📊 계정과목 데이터 변경 - 건수:', data.length);
    },

    // 데이터 없을 때 표시 문구
    noDataMessage: '등록된 계정과목이 없습니다.',
  });

  console.log('✅ Account CommonTable 초기화 완료');
}

/**
 * ✅ 계정과목 목록 로드
 *  - searchKeyword가 있으면 서버 검색
 *  - 없으면 전체 목록
 */
async function loadAccounts(searchKeyword = '') {
  try {
    // 테이블 인스턴스 준비
    initAccountTable();

    currentSearchKeyword = searchKeyword;

    const params = {};
    if (searchKeyword) {
      params.search = searchKeyword;
    }

    // CommonTable의 load 사용
    //  - apiUrl은 options에 이미 설정되어 있으므로 URL 생략 가능
    await accountTable.load(undefined, params);
  } catch (error) {
    console.error('❌ 계정과목 목록 로드 오류:', error);
    alert('계정과목 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

// ✅ 메뉴 시스템에서 호출할 수 있도록 전역에 노출
// index.html → showPage('account-catagory') → loadFunc에서 loadAccounts() 호출
window.loadAccounts = loadAccounts;

/**
 * ✅ 검색 버튼에서 호출되는 함수
 *  - 검색어가 비어 있으면 전체 목록
 *  - 검색어가 있으면 서버 측 검색
 */
window.searchAccounts = function () {
  const input = document.getElementById('accountListSearchInput');
  const keyword = (input?.value || '').trim();

  console.log('🔍 계정과목 검색:', keyword);
  loadAccounts(keyword);
};

/**
 * ✅ 검색 초기화 버튼에서 호출되는 함수
 *  - 검색어 입력창 초기화
 *  - 전체 목록 재조회
 */
window.resetAccountSearch = function () {
  const input = document.getElementById('accountListSearchInput');
  if (input) {
    input.value = '';
  }
  console.log('🔄 계정과목 검색 초기화');
  loadAccounts('');
};

// ✅ DOM 로드 후 Enter 키 이벤트 바인딩
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('accountListSearchInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.searchAccounts();
      }
    });
  }

  console.log('✅ account.js DOMContentLoaded 이벤트 바인딩 완료');
});

/* ------------------------------------------------------
 * 아래부터는 기존에 사용하시던
 *  - 상세보기
 *  - 신규 등록
 *  - 수정
 *  - 삭제
 *  관련 로직은 거의 그대로 사용하고,
 *  목록 새로고침 부분만 CommonTable 기반 loadAccounts() 호출로 유지합니다.
 * ----------------------------------------------------*/

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
  const accountStatus = parseInt(document.getElementById('accountStatus').value, 10);

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
      // ✅ 현재 검색 조건 유지한 채 목록 새로고침
      loadAccounts(currentSearchKeyword);
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
  const accountStatus = parseInt(document.getElementById('editAccountStatus').value, 10);

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
  document.getElementById(
    'accountDeleteInfo',
  ).textContent = `계정코드: ${accountCode} (${accountName})`;

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

console.log('✅ account.js (CommonTable 버전) 로드 완료');
