/**
 * 자재분류관리 (Material Category Management)
 * 자재분류 CRUD 기능 - 매출처관리 패턴 적용
 */

let materialCategoryTableInstance = null;
let currentSearchKeyword = ''; // 현재 검색 키워드
let categoryToDelete = null; // 삭제할 분류 정보 저장

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
      {
        // 선택 체크박스
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return (
            '<input type="checkbox" class="category-checkbox" data-code="' + row.분류코드 + '" />'
          );
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
      { data: '분류코드', className: 'text-center' },
      { data: '분류명' },
      { data: '적요', defaultContent: '-' },
      {
        // 사용구분
        data: '사용구분',
        className: 'text-center',
        render: function (data, type, row) {
          if (data === 0) {
            return '<span class="status-badge status-active">사용중</span>';
          } else if (data === 9) {
            return '<span class="status-badge status-deleted">삭제됨</span>';
          } else {
            return '<span class="status-badge status-pending">사용안함</span>';
          }
        },
      },
      {
        // 수정일자
        data: '수정일자',
        className: 'text-center',
        defaultContent: '-',
        render: function (data) {
          if (!data || data.length !== 8) return '-';
          return data.substring(0, 4) + '-' + data.substring(4, 6) + '-' + data.substring(6, 8);
        },
      },
      {
        // 관리 버튼
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return `
            <div class="action-buttons" id="categoryActions-${row.분류코드}">
              <button class="btn-icon categoryBtnView" onclick="viewCategoryDetail('${row.분류코드}')">상세</button>
              <button class="btn-icon categoryBtnEdit" style="display: none;" onclick="editMaterialCategory('${row.분류코드}')">수정</button>
              <button class="btn-icon categoryBtnDelete" style="display: none;" onclick="openCategoryDeleteModal('${row.분류코드}')">삭제</button>
            </div>
          `;
        },
      },
    ],
    language: {
      emptyTable: '등록된 자재분류가 없습니다.',
      search: '검색:',
      lengthMenu: '페이지당 _MENU_ 개 보기',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      paginate: { previous: '이전', next: '다음' },
    },
    order: [[2, 'asc']], // 분류코드 기준 정렬
    responsive: true,
    autoWidth: false,
    pageLength: 25,
  });

  // 체크박스 이벤트 핸들러
  setupCategoryCheckboxHandlers();
}

/**
 * 체크박스 이벤트 핸들러 설정
 */
function setupCategoryCheckboxHandlers() {
  // 전체 선택 체크박스
  $('#selectAllCategories').off('change.categoryPage').on('change.categoryPage', function () {
    const isChecked = $(this).prop('checked');
    $('.category-checkbox').prop('checked', isChecked);
    updateCategoryActionButtons();
  });

  // 개별 체크박스 (이벤트 위임)
  $('#materialCategoryTable').off('change.categoryPage').on('change.categoryPage', '.category-checkbox', function () {
    updateCategoryActionButtons();

    // 전체 선택 체크박스 상태 업데이트
    const totalCheckboxes = $('.category-checkbox').length;
    const checkedCheckboxes = $('.category-checkbox:checked').length;
    $('#selectAllCategories').prop('checked', totalCheckboxes === checkedCheckboxes);
  });
}

/**
 * 체크박스 선택 상태에 따라 액션 버튼 표시/숨김
 */
function updateCategoryActionButtons() {
  const checkedBoxes = $('.category-checkbox:checked');

  checkedBoxes.each(function () {
    const code = $(this).data('code');
    $(`#categoryActions-${code} .categoryBtnView`).hide();
    $(`#categoryActions-${code} .categoryBtnEdit`).show();
    $(`#categoryActions-${code} .categoryBtnDelete`).show();
  });

  // 선택 해제된 항목은 상세 버튼만 표시
  $('.category-checkbox:not(:checked)').each(function () {
    const code = $(this).data('code');
    $(`#categoryActions-${code} .categoryBtnView`).show();
    $(`#categoryActions-${code} .categoryBtnEdit`).hide();
    $(`#categoryActions-${code} .categoryBtnDelete`).hide();
  });
}

/**
 * 자재분류 목록 로드
 */
async function loadMaterialCategories(searchKeyword = '') {
  try {
    let url = API_BASE_URL + '/material-categories';
    if (searchKeyword) {
      url += `?search=${encodeURIComponent(searchKeyword)}`;
    }

    const response = await fetch(url, {
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

    // 체크박스 상태 초기화
    $('#selectAllCategories').prop('checked', false);
  } catch (err) {
    console.error('자재분류 목록 로드 에러:', err);
    alert('자재분류 목록 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 검색 기능
 */
function searchMaterialCategories() {
  console.log('===== categoryListArea > 검색 버튼 클릭 =====');

  const keyword = $('#categoryListSearchInput').val().trim();
  currentSearchKeyword = keyword;
  loadMaterialCategories(keyword);
}

/**
 * 검색 초기화
 */
function resetCategorySearch() {
  console.log('===== categoryListArea > 초기화 버튼 클릭 =====');

  $('#categoryListSearchInput').val('');
  currentSearchKeyword = '';
  loadMaterialCategories();
}

/**
 * 자재분류 상세보기
 */
async function viewCategoryDetail(분류코드) {
  console.log('===== materialCategoryTable > 상세 버튼 클릭 =====');

  try {
    const response = await fetch(API_BASE_URL + `/material-categories/${분류코드}`, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('자재분류 조회 실패');

    const data = await response.json();
    const category = data.data;

    // 상세 정보 HTML 생성
    const detailHtml = `
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #6c757d; font-size: 12px;">분류코드</label>
        <p style="margin: 0; font-size: 16px; font-weight: 500;">${category.분류코드}</p>
      </div>
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #6c757d; font-size: 12px;">분류명</label>
        <p style="margin: 0; font-size: 16px; font-weight: 500;">${category.분류명}</p>
      </div>
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; grid-column: span 2;">
        <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #6c757d; font-size: 12px;">적요</label>
        <p style="margin: 0; font-size: 14px;">${category.적요 || '-'}</p>
      </div>
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #6c757d; font-size: 12px;">사용구분</label>
        <p style="margin: 0; font-size: 14px;">
          ${category.사용구분 === 0 ? '<span class="status-badge status-active">사용중</span>' : '<span class="status-badge status-pending">사용안함</span>'}
        </p>
      </div>
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #6c757d; font-size: 12px;">수정일자</label>
        <p style="margin: 0; font-size: 14px;">${category.수정일자 ? category.수정일자.substring(0, 4) + '-' + category.수정일자.substring(4, 6) + '-' + category.수정일자.substring(6, 8) : '-'}</p>
      </div>
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #6c757d; font-size: 12px;">사용자코드</label>
        <p style="margin: 0; font-size: 14px;">${category.사용자코드 || '-'}</p>
      </div>
    `;

    $('#categoryDetailContent').html(detailHtml);
    $('#categoryDetailModal').show();
  } catch (err) {
    console.error('자재분류 상세 조회 에러:', err);
    alert('자재분류 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 상세보기 모달 닫기
 */
function closeCategoryDetailModal() {
  console.log('===== categoryDetailModal > 닫기 버튼 클릭 =====');

  $('#categoryDetailModal').hide();
}

/**
 * 자재분류 등록 모달 열기
 */
function openNewCategoryModal() {
  console.log('===== categoryToolbar > 신규 등록 버튼 클릭 =====');

  document.getElementById('categoryModalTitle').textContent = '자재분류 등록';
  document.getElementById('categoryForm').reset();
  document.getElementById('category분류코드').disabled = false;
  document.getElementById('categoryModalMode').value = 'create';
  document.getElementById('categoryModal').style.display = 'flex';
}

/**
 * 자재분류 수정 모달 열기
 */
async function editMaterialCategory(분류코드) {
  console.log('===== materialCategoryTable > 수정 버튼 클릭 =====');

  try {
    const response = await fetch(API_BASE_URL + `/material-categories/${분류코드}`, {
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

    document.getElementById('categoryModal').style.display = 'flex';
  } catch (err) {
    console.error('자재분류 조회 에러:', err);
    alert('자재분류 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 자재분류 저장 (등록/수정)
 */
async function saveMaterialCategory() {
  console.log('===== categoryModal > 저장 버튼 클릭 =====');

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
  let url = API_BASE_URL + '/material-categories';
  let method = 'POST';

  if (mode === 'edit') {
    url = API_BASE_URL + `/material-categories/${분류코드}`;
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
    loadMaterialCategories(currentSearchKeyword);
  } catch (err) {
    console.error('자재분류 저장 에러:', err);
    alert('저장 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 삭제 확인 모달 열기
 */
async function openCategoryDeleteModal(분류코드) {
  console.log('===== materialCategoryTable > 삭제 버튼 클릭 =====');

  try {
    const response = await fetch(API_BASE_URL + `/material-categories/${분류코드}`, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('자재분류 조회 실패');

    const data = await response.json();
    categoryToDelete = data.data;

    // 삭제 확인 정보 표시
    const deleteInfoHtml = `
      <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 14px;">
        <div style="font-weight: 600; color: #6b7280;">분류코드:</div>
        <div style="font-weight: 500;">${categoryToDelete.분류코드}</div>
        <div style="font-weight: 600; color: #6b7280;">분류명:</div>
        <div style="font-weight: 500;">${categoryToDelete.분류명}</div>
        <div style="font-weight: 600; color: #6b7280;">적요:</div>
        <div>${categoryToDelete.적요 || '-'}</div>
      </div>
    `;

    $('#categoryDeleteInfo').html(deleteInfoHtml);
    $('#categoryDeleteModal').show();
  } catch (err) {
    console.error('자재분류 조회 에러:', err);
    alert('자재분류 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 삭제 확인 모달 닫기
 */
function closeCategoryDeleteModal() {
  console.log('===== categoryDeleteModal > 닫기 버튼 클릭 =====');

  $('#categoryDeleteModal').hide();
  categoryToDelete = null;
}

/**
 * 자재분류 삭제 확정
 */
async function confirmDeleteCategory() {
  console.log('===== categoryDeleteModal > 삭제하기 버튼 클릭 =====');

  if (!categoryToDelete) {
    alert('삭제할 분류 정보가 없습니다.');
    return;
  }

  try {
    const response = await fetch(API_BASE_URL + `/material-categories/${categoryToDelete.분류코드}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '삭제 실패');
    }

    alert(data.message);
    closeCategoryDeleteModal();
    loadMaterialCategories(currentSearchKeyword);
  } catch (err) {
    console.error('자재분류 삭제 에러:', err);
    alert('삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 모달 닫기
 */
function closeCategoryModal() {
  console.log('===== categoryModal > 닫기 버튼 클릭 =====');

  document.getElementById('categoryModal').style.display = 'none';
  document.getElementById('categoryForm').reset();
}

/**
 * Google Sheets로 내보내기
 */
function exportCategoriesToGoogleSheets() {
  console.log('===== categoryToolbar > Google Sheets 내보내기 버튼 클릭 =====');

  try {

    // 1. DataTable에서 현재 표시된 데이터 가져오기
    const table = $('#materialCategoryTable').DataTable();
    const dataToExport = table.rows({ search: 'applied' }).data().toArray();

    if (dataToExport.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // 2. CSV 형식으로 변환
    const headers = ['순번', '분류코드', '분류명', '적요', '사용구분', '수정일자', '사용자코드'];
    let csvContent = '\uFEFF'; // UTF-8 BOM 추가 (엑셀에서 한글 깨짐 방지)
    csvContent += headers.join(',') + '\n';

    dataToExport.forEach((row, index) => {
      // 사용구분 변환
      const 사용구분 = row.사용구분 === 0 ? '사용중' : '사용안함';

      // 수정일자 포맷
      let 수정일자 = '-';
      if (row.수정일자 && row.수정일자.length === 8) {
        수정일자 = `${row.수정일자.substring(0, 4)}-${row.수정일자.substring(4, 6)}-${row.수정일자.substring(6, 8)}`;
      }

      const rowArray = [
        index + 1, // 순번
        row.분류코드,
        row.분류명,
        row.적요 || '-',
        사용구분,
        수정일자,
        row.사용자코드 || '-',
      ];

      // CSV 특수문자 처리
      const csvRow = rowArray.map((field) => {
        const fieldStr = String(field);
        if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
          return '"' + fieldStr.replace(/"/g, '""') + '"';
        }
        return fieldStr;
      });

      csvContent += csvRow.join(',') + '\n';
    });

    // 3. Blob 생성 및 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `자재분류관리_${today}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(
        `CSV 파일이 다운로드되었습니다.\n\nGoogle Sheets에서:\n1. 파일 > 가져오기\n2. 업로드 탭 선택\n3. 다운로드된 CSV 파일 선택\n4. 가져오기를 클릭하세요.`,
      );
    }
  } catch (error) {
    console.error('CSV 내보내기 오류:', error);
    alert('CSV 파일 생성 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * Enter 키로 검색
 */
$(document).ready(function () {
  $('#categoryListSearchInput').on('keypress', function (e) {
    if (e.which === 13) {
      searchMaterialCategories();
    }
  });
});

// 전역 함수로 노출 (페이지 표시될 때 호출됨)
window.initMaterialCategoryTable = initMaterialCategoryTable;
window.loadMaterialCategories = loadMaterialCategories;
window.searchMaterialCategories = searchMaterialCategories;
window.resetCategorySearch = resetCategorySearch;
window.viewCategoryDetail = viewCategoryDetail;
window.closeCategoryDetailModal = closeCategoryDetailModal;
window.openNewCategoryModal = openNewCategoryModal;
window.editMaterialCategory = editMaterialCategory;
window.saveMaterialCategory = saveMaterialCategory;
window.openCategoryDeleteModal = openCategoryDeleteModal;
window.closeCategoryDeleteModal = closeCategoryDeleteModal;
window.confirmDeleteCategory = confirmDeleteCategory;
window.closeCategoryModal = closeCategoryModal;
window.exportCategoriesToGoogleSheets = exportCategoriesToGoogleSheets;

// ============================================
// 중복 자재 분석 기능
// ============================================

let duplicateMaterialTableInstance = null;
let duplicateDetailTableInstance = null;

/**
 * 중복 자재 분석 모달 열기
 */
async function openDuplicateMaterialModal() {
  console.log('===== categoryToolbar > 중복자재분석 버튼 클릭 =====');

  try {

    // 모달 표시
    document.getElementById('duplicateMaterialModal').classList.remove('hidden');

    // 중복 자재 데이터 로드
    const response = await fetch('/api/materials/duplicate-analysis', {
      credentials: 'include',
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '중복 자재 조회 실패');
    }

    const duplicates = result.data || [];
    const summary = result.summary || {};

    // 요약 정보 업데이트
    document.getElementById('duplicateGroupCount').textContent = summary.duplicateGroups || 0;
    document.getElementById('duplicateMaterialCount').textContent = summary.totalDuplicates || 0;

    // DataTable 초기화
    if (duplicateMaterialTableInstance) {
      duplicateMaterialTableInstance.destroy();
    }

    duplicateMaterialTableInstance = $('#duplicateMaterialTable').DataTable({
      data: duplicates,
      columns: [
        {
          // 순번
          data: null,
          orderable: false,
          className: 'text-center',
          render: function (data, type, row, meta) {
            return meta.row + 1;
          },
        },
        { data: '자재명' },
        {
          data: '규격',
          render: function (data) {
            return data || '-';
          },
        },
        {
          data: '중복개수',
          className: 'text-center',
          render: function (data) {
            return `<span style="color: #dc3545; font-weight: 600;">${data}</span>`;
          },
        },
        {
          data: '자재코드목록',
          render: function (data) {
            if (!data) return '-';
            const codes = data.split(', ');
            if (codes.length > 3) {
              return codes.slice(0, 3).join(', ') + ` 외 ${codes.length - 3}개`;
            }
            return data;
          },
        },
        {
          // 상세보기 버튼
          data: null,
          orderable: false,
          className: 'text-center',
          render: function (data, type, row) {
            return `
              <button
                onclick="viewDuplicateDetail('${row.자재명}', '${row.규격 || ''}')"
                style="
                  padding: 6px 12px;
                  background: #007bff;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  font-size: 13px;
                  cursor: pointer;
                "
                onmouseover="this.style.background='#0056b3';"
                onmouseout="this.style.background='#007bff';">
                상세보기
              </button>
            `;
          },
        },
      ],
      order: [[3, 'desc']], // 중복개수 내림차순
      pageLength: 20,
      language: {
        emptyTable: '중복된 자재가 없습니다.',
        info: '총 _TOTAL_개 중복 그룹',
        infoEmpty: '중복 그룹 없음',
        search: '검색:',
        paginate: {
          first: '처음',
          last: '마지막',
          next: '다음',
          previous: '이전',
        },
      },
    });
  } catch (error) {
    console.error('중복 자재 분석 오류:', error);
    alert('중복 자재 조회 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 중복 자재 분석 모달 닫기
 */
function closeDuplicateMaterialModal() {
  console.log('===== duplicateMaterialModal > 닫기 버튼 클릭 =====');

  document.getElementById('duplicateMaterialModal').classList.add('hidden');

  if (duplicateMaterialTableInstance) {
    duplicateMaterialTableInstance.destroy();
    duplicateMaterialTableInstance = null;
  }
}

/**
 * 중복 자재 상세 정보 보기
 */
async function viewDuplicateDetail(자재명, 규격) {
  console.log('===== duplicateMaterialTable > 상세보기 버튼 클릭 =====');

  try {

    // 자재 정보 표시
    document.getElementById('detailMaterialName').textContent = 자재명;
    document.getElementById('detailMaterialSpec').textContent = 규격 || '(없음)';

    // 모달 표시
    document.getElementById('duplicateDetailModal').classList.remove('hidden');

    // 상세 데이터 로드
    const params = new URLSearchParams();
    params.append('자재명', 자재명);
    params.append('규격', 규격 || '');

    const response = await fetch(`/api/materials/duplicate-detail?${params.toString()}`, {
      credentials: 'include',
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '상세 정보 조회 실패');
    }

    const details = result.data || [];

    // DataTable 초기화
    if (duplicateDetailTableInstance) {
      duplicateDetailTableInstance.destroy();
    }

    duplicateDetailTableInstance = $('#duplicateDetailTable').DataTable({
      data: details,
      columns: [
        { data: '자재코드', className: 'text-center' },
        { data: '단위', className: 'text-center' },
        {
          data: '매입건수',
          className: 'text-right',
          render: function (data) {
            return (data || 0).toLocaleString();
          },
        },
        {
          data: '매출건수',
          className: 'text-right',
          render: function (data) {
            return (data || 0).toLocaleString();
          },
        },
        {
          data: '전체거래건수',
          className: 'text-right',
          render: function (data) {
            return `<strong style="color: #007bff;">${(data || 0).toLocaleString()}</strong>`;
          },
        },
        {
          data: '최초거래일',
          className: 'text-center',
          render: function (data) {
            if (!data) return '-';
            return data.substring(0, 4) + '-' + data.substring(4, 6) + '-' + data.substring(6, 8);
          },
        },
        {
          data: '최근거래일',
          className: 'text-center',
          render: function (data) {
            if (!data) return '-';
            return data.substring(0, 4) + '-' + data.substring(4, 6) + '-' + data.substring(6, 8);
          },
        },
        {
          // 추천 표시
          data: null,
          className: 'text-center',
          orderable: false,
          render: function (data, type, row, meta) {
            if (meta.row === 0) {
              // 첫 번째 행 (거래 건수가 가장 많음)
              return '<span style="color: #28a745; font-weight: 600;">✅ 추천</span>';
            }
            return '-';
          },
        },
      ],
      order: [[4, 'desc']], // 전체거래건수 내림차순
      pageLength: 10,
      paging: false,
      searching: false,
      info: false,
      language: {
        emptyTable: '데이터가 없습니다.',
      },
    });
  } catch (error) {
    console.error('중복 자재 상세 조회 오류:', error);
    alert('상세 정보 조회 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 중복 자재 상세 모달 닫기
 */
function closeDuplicateDetailModal() {
  console.log('===== duplicateDetailModal > 닫기 버튼 클릭 =====');

  document.getElementById('duplicateDetailModal').classList.add('hidden');

  if (duplicateDetailTableInstance) {
    duplicateDetailTableInstance.destroy();
    duplicateDetailTableInstance = null;
  }
}

// 전역 함수로 노출
window.openDuplicateMaterialModal = openDuplicateMaterialModal;
window.closeDuplicateMaterialModal = closeDuplicateMaterialModal;
window.viewDuplicateDetail = viewDuplicateDetail;
window.closeDuplicateDetailModal = closeDuplicateDetailModal;
