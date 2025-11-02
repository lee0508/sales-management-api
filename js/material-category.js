/**
 * 자재분류관리 (Material Category Management)
 * 자재분류 CRUD 기능
 */

let materialCategoryTableInstance = null;

/**
 * 자재분류관리 DataTable 초기화
 */
function initMaterialCategoryTable() {
  if (materialCategoryTableInstance) {
    materialCategoryTableInstance.destroy();
  }

  materialCategoryTableInstance = $('#materialCategoryTable').DataTable({
    data: [],
    columns: [
      { data: null, render: (data, type, row, meta) => meta.row + 1 },
      { data: '분류코드', defaultContent: '-' },
      { data: '분류명', defaultContent: '-' },
      { data: '적요', defaultContent: '-' },
      {
        data: '수정일자',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: null,
        render: (data, type, row) => {
          return `
            <button class="btn btn-sm btn-primary" onclick="editMaterialCategory('${row.분류코드}')" style="margin-right: 4px;">수정</button>
            <button class="btn btn-sm btn-danger" onclick="deleteMaterialCategory('${row.분류코드}')">삭제</button>
          `;
        },
        orderable: false,
      },
    ],
    language: {
      emptyTable: '등록된 자재분류가 없습니다.',
      search: '검색:',
      lengthMenu: '페이지당 _MENU_ 개 보기',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      paginate: { previous: '이전', next: '다음' },
    },
    order: [[1, 'asc']], // 분류코드 기준 정렬
    responsive: true,
    autoWidth: false,
    pageLength: 25,
  });
}

/**
 * 자재분류 목록 로드
 */
async function loadMaterialCategories() {
  try {
    const response = await fetch('/api/material-categories', {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('자재분류 목록 조회 실패');

    const data = await response.json();
    const categories = data.data || [];

    // DataTable 업데이트
    if (materialCategoryTableInstance) {
      materialCategoryTableInstance.clear();
      materialCategoryTableInstance.rows.add(categories);
      materialCategoryTableInstance.draw();
    }

    // 총 개수 표시
    document.getElementById('totalCategoryCount').textContent = categories.length;
  } catch (err) {
    console.error('자재분류 목록 로드 에러:', err);
    alert('자재분류 목록 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 자재분류 등록 모달 열기
 */
function openNewCategoryModal() {
  document.getElementById('categoryModalTitle').textContent = '자재분류 등록';
  document.getElementById('categoryForm').reset();
  document.getElementById('category분류코드').disabled = false;
  document.getElementById('categoryModalMode').value = 'create';
  document.getElementById('categoryModal').classList.remove('hidden');
}

/**
 * 자재분류 수정 모달 열기
 */
async function editMaterialCategory(분류코드) {
  try {
    const response = await fetch(`/api/material-categories/${분류코드}`, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('자재분류 조회 실패');

    const data = await response.json();
    const category = data.data;

    // 모달 설정
    document.getElementById('categoryModalTitle').textContent = '자재분류 수정';
    document.getElementById('categoryModalMode').value = 'edit';
    document.getElementById('category분류코드').value = category.분류코드;
    document.getElementById('category분류코드').disabled = true; // 수정 시 분류코드 변경 불가
    document.getElementById('category분류명').value = category.분류명;
    document.getElementById('category적요').value = category.적요 || '';

    document.getElementById('categoryModal').classList.remove('hidden');
  } catch (err) {
    console.error('자재분류 조회 에러:', err);
    alert('자재분류 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 자재분류 저장 (등록/수정)
 */
async function saveMaterialCategory() {
  const mode = document.getElementById('categoryModalMode').value;
  const 분류코드 = document.getElementById('category분류코드').value.trim();
  const 분류명 = document.getElementById('category분류명').value.trim();
  const 적요 = document.getElementById('category적요').value.trim();

  // 필수 입력 검증
  if (!분류코드 || !분류명) {
    alert('분류코드와 분류명은 필수입니다.');
    return;
  }

  // 분류코드 길이 검증 (2자리)
  if (분류코드.length !== 2) {
    alert('분류코드는 2자리여야 합니다.');
    return;
  }

  const body = { 분류코드, 분류명, 적요 };
  let url = '/api/material-categories';
  let method = 'POST';

  if (mode === 'edit') {
    url = `/api/material-categories/${분류코드}`;
    method = 'PUT';
  }

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '저장 실패');
    }

    alert(data.message);
    closeCategoryModal();
    loadMaterialCategories();
  } catch (err) {
    console.error('자재분류 저장 에러:', err);
    alert('저장 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 자재분류 삭제
 */
async function deleteMaterialCategory(분류코드) {
  if (!confirm(`분류코드 '${분류코드}'를 삭제하시겠습니까?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/material-categories/${분류코드}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '삭제 실패');
    }

    alert(data.message);
    loadMaterialCategories();
  } catch (err) {
    console.error('자재분류 삭제 에러:', err);
    alert('삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 모달 닫기
 */
function closeCategoryModal() {
  document.getElementById('categoryModal').classList.add('hidden');
  document.getElementById('categoryForm').reset();
}

// 페이지 로드 시 초기화
$(document).ready(function () {
  initMaterialCategoryTable();
  loadMaterialCategories();
});