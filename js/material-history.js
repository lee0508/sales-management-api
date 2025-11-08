/**
 * 자재내역관리 (Material Transaction History Management)
 * 자재입출내역 테이블 CRUD 기능
 */

let materialHistoryTableInstance = null;
let selectedHistoryRecords = [];

/**
 * 자재내역관리 DataTable 초기화
 */
function initMaterialHistoryTable() {
  if (materialHistoryTableInstance) {
    materialHistoryTableInstance.destroy();
  }

  materialHistoryTableInstance = $('#materialHistoryTable').DataTable({
    data: [],
    columns: [
      {
        data: null,
        orderable: false,
        className: 'dt-center',
        render: function (data, type, row) {
          const compositeKey = `${row.사업장코드}_${row.분류코드}_${row.세부코드}_${row.입출고일자}_${row.입출고시간}`;
          return `<input type="checkbox" class="history-checkbox" data-composite-key="${compositeKey}" />`;
        },
      },
      { data: null, render: (data, type, row, meta) => meta.row + 1 },
      {
        data: null,
        render: (data, type, row) => {
          // 세부코드가 이미 분류코드를 포함하고 있는지 확인
          let 세부코드 = row.세부코드 || '';
          // 세부코드 앞 2자리가 분류코드와 같으면 제거
          if (세부코드.substring(0, 2) === row.분류코드) {
            세부코드 = 세부코드.substring(2);
          }
          const 자재코드 = `${row.분류코드}${세부코드}`;
          return 자재코드 || '-';
        },
      },
      { data: '자재명', defaultContent: '-' },
      { data: '규격', defaultContent: '-' },
      { data: '단위', defaultContent: '-' },
      {
        data: '입출고일자',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: '거래일자',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: '입출고구분',
        render: (data) => {
          if (data === 1) {
            return '<span style="background: #28a745; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">입고</span>';
          } else if (data === 2) {
            return '<span style="background: #007bff; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">출고</span>';
          }
          return '-';
        },
      },
      {
        data: null,
        className: 'dt-right',
        render: (data, type, row) => {
          if (row.입출고구분 === 1) {
            return formatNumber(row.입고수량 || 0);
          } else if (row.입출고구분 === 2) {
            return formatNumber(row.출고수량 || 0);
          }
          return '0';
        },
      },
      {
        data: null,
        className: 'dt-right',
        render: (data, type, row) => {
          if (row.입출고구분 === 1) {
            return formatCurrency(row.입고단가 || 0);
          } else if (row.입출고구분 === 2) {
            return formatCurrency(row.출고단가 || 0);
          }
          return '0원';
        },
      },
      {
        data: null,
        render: (data, type, row) => {
          if (row.입출고구분 === 1) {
            return `${row.매입처코드 || '-'}<br/><small>${row.매입처명 || ''}</small>`;
          } else if (row.입출고구분 === 2) {
            return `${row.매출처코드 || '-'}<br/><small>${row.매출처명 || ''}</small>`;
          }
          return '-';
        },
      },
      {
        data: null,
        orderable: false,
        className: 'dt-center',
        render: function (data, type, row) {
          const compositeKey = `${row.사업장코드}_${row.분류코드}_${row.세부코드}_${row.입출고일자}_${row.입출고시간}`;
          return `
            <div class="action-buttons" id="history-actions-${compositeKey}">
              <button class="btn-icon btn-view" onclick="viewHistoryDetail('${compositeKey}')">상세</button>
              <button class="btn-icon btn-edit" style="display: none;" onclick="editMaterialHistory('${compositeKey}')">수정</button>
              <button class="btn-icon btn-delete" style="display: none;" onclick="openDeleteConfirmation('${compositeKey}')">삭제</button>
            </div>
          `;
        },
      },
    ],
    language: {
      emptyTable: '데이터가 없습니다.',
      search: '검색:',
      lengthMenu: '페이지당 _MENU_ 개 보기',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      paginate: { previous: '이전', next: '다음' },
    },
    order: [],
    responsive: true,
    autoWidth: false,
    pageLength: 25,
  });

  setupHistoryCheckboxHandlers();
}

/**
 * 자재내역 목록 조회
 */
async function loadMaterialHistory(searchKeyword = '') {
  try {
    let url = `${API_BASE_URL}/material-history`;
    if (searchKeyword) {
      url += `?search=${encodeURIComponent(searchKeyword)}`;
    }

    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) throw new Error('자재내역 조회 실패');

    const data = await response.json();
    const history = data.data || [];

    if (materialHistoryTableInstance) {
      materialHistoryTableInstance.clear();
      materialHistoryTableInstance.rows.add(history);
      materialHistoryTableInstance.draw();
    }

    // 선택 초기화
    selectedHistoryRecords = [];
    $('.history-checkbox').prop('checked', false);
    $('#selectAllHistory').prop('checked', false);
  } catch (err) {
    console.error('자재내역 조회 에러:', err);
    alert('자재내역 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 검색 기능
 */
function searchMaterialHistory() {
  const keyword = document.getElementById('historyListSearchInput').value.trim();

  // 검색어가 없으면 경고 표시하고 빈 테이블 유지
  if (!keyword) {
    alert('세부코드 또는 자재명을 입력해주세요.');
    return;
  }

  loadMaterialHistory(keyword);
}

/**
 * 검색 초기화
 */
function resetHistorySearch() {
  document.getElementById('historyListSearchInput').value = '';
  loadMaterialHistory();
}

/**
 * 신규 등록 모달 열기
 */
function openNewHistoryModal() {
  const titleElement = document.getElementById('historyModalTitle');
  if (titleElement) {
    titleElement.textContent = '자재입출내역 신규 등록';
  }

  document.getElementById('historyModalMode').value = 'create';
  document.getElementById('historyForm').reset();

  // 현재 날짜 기본값 설정
  const today = new Date().toISOString().substring(0, 10);
  const 입출고일자 = document.getElementById('history입출고일자');
  const 거래일자 = document.getElementById('history거래일자');
  if (입출고일자) 입출고일자.value = today;
  if (거래일자) 거래일자.value = today;

  document.getElementById('historyModal').style.display = 'flex';
}

/**
 * 모달 닫기
 */
function closeHistoryModal() {
  document.getElementById('historyModal').style.display = 'none';
  document.getElementById('historyForm').reset();
}

function closeHistoryDetailModal() {
  document.getElementById('historyDetailModal').style.display = 'none';
}

function closeHistoryDeleteModal() {
  document.getElementById('historyDeleteModal').style.display = 'none';
}

/**
 * 체크박스 핸들러 설정
 */
function setupHistoryCheckboxHandlers() {
  // 전체 선택 체크박스
  $('#selectAllHistory').off('change').on('change', function () {
    const isChecked = $(this).is(':checked');
    $('.history-checkbox').prop('checked', isChecked);

    selectedHistoryRecords = [];
    if (isChecked) {
      $('.history-checkbox').each(function () {
        selectedHistoryRecords.push($(this).data('composite-key'));
      });
    }

    // 모든 행의 버튼 표시 상태 업데이트
    $('.history-checkbox').each(function () {
      const compositeKey = $(this).data('composite-key');
      const actionDiv = $(`#history-actions-${compositeKey}`);

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
  });

  // 개별 체크박스
  $(document).off('change', '.history-checkbox').on('change', '.history-checkbox', function () {
    const compositeKey = $(this).data('composite-key');
    const isChecked = $(this).is(':checked');
    const actionDiv = $(`#history-actions-${compositeKey}`);

    if (isChecked) {
      if (!selectedHistoryRecords.includes(compositeKey)) {
        selectedHistoryRecords.push(compositeKey);
      }
      // 체크됨: 상세 버튼 숨기고 수정/삭제 버튼 표시
      actionDiv.find('.btn-view').hide();
      actionDiv.find('.btn-edit').show();
      actionDiv.find('.btn-delete').show();
    } else {
      const index = selectedHistoryRecords.indexOf(compositeKey);
      if (index > -1) {
        selectedHistoryRecords.splice(index, 1);
      }
      $('#selectAllHistory').prop('checked', false);

      // 체크 해제: 수정/삭제 버튼 숨기고 상세 버튼 표시
      actionDiv.find('.btn-view').show();
      actionDiv.find('.btn-edit').hide();
      actionDiv.find('.btn-delete').hide();
    }
  });
}

/**
 * 삭제 확인 모달 열기
 */
async function openDeleteConfirmation(compositeKey) {
  try {
    const [사업장코드, 분류코드, 세부코드, 입출고일자, 입출고시간] = compositeKey.split('_');

    const url = `${API_BASE_URL}/material-history/${사업장코드}/${분류코드}/${세부코드}/${입출고일자}/${입출고시간}`;
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) throw new Error('상세 조회 실패');

    const data = await response.json();
    const record = data.data;

    // 삭제할 내역 정보 표시
    const 자재코드 = `${record.분류코드}${record.세부코드}`;
    const 입출고구분명 = record.입출고구분 === 1 ? '입고' : '출고';
    const 수량 = record.입출고구분 === 1 ? record.입고수량 : record.출고수량;

    const deleteInfo = `
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; font-size: 14px;">
        <strong>자재코드:</strong>
        <span>${자재코드}</span>
        <strong>자재명:</strong>
        <span>${record.자재명 || '-'}</span>
        <strong>입출고구분:</strong>
        <span>${입출고구분명}</span>
        <strong>입출고일자:</strong>
        <span>${formatDate(record.입출고일자)}</span>
        <strong>수량:</strong>
        <span>${formatNumber(수량 || 0)}</span>
      </div>
    `;

    document.getElementById('historyDeleteInfo').innerHTML = deleteInfo;

    // compositeKey를 전역 변수에 저장
    window.currentDeleteCompositeKey = compositeKey;

    // 모달 표시
    document.getElementById('historyDeleteModal').style.display = 'flex';
  } catch (err) {
    console.error('삭제 모달 에러:', err);
    alert('삭제 준비 중 오류가 발생했습니다: ' + err.message);
  }
}


/**
 * 상세보기 모달
 */
async function viewHistoryDetail(compositeKey) {
  try {
    const [사업장코드, 분류코드, 세부코드, 입출고일자, 입출고시간] = compositeKey.split('_');

    const url = `${API_BASE_URL}/material-history/${사업장코드}/${분류코드}/${세부코드}/${입출고일자}/${입출고시간}`;
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) throw new Error('상세 조회 실패');

    const data = await response.json();
    const record = data.data;

    // 자재코드 처리 (세부코드가 이미 분류코드를 포함하고 있는지 확인)
    let detailCode = record.세부코드 || '';
    if (detailCode.substring(0, 2) === record.분류코드) {
      detailCode = detailCode.substring(2);
    }
    const 자재코드 = `${record.분류코드}${detailCode}`;
    const 입출고구분명 = record.입출고구분 === 1 ? '입고 (매입)' : '출고 (매출)';
    const 수량 = record.입출고구분 === 1 ? record.입고수량 : record.출고수량;
    const 단가 = record.입출고구분 === 1 ? record.입고단가 : record.출고단가;
    const 부가 = record.입출고구분 === 1 ? record.입고부가 : record.출고부가;
    const 거래처코드 = record.입출고구분 === 1 ? record.매입처코드 : record.매출처코드;
    const 거래처명 = record.입출고구분 === 1 ? record.매입처명 : record.매출처명;
    const 합계 = (수량 || 0) * (단가 || 0) + (부가 || 0);

    // 상세 정보 HTML 생성
    const detailHTML = `
      <div style="grid-column: span 2; background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
        <strong>${입출고구분명}</strong>
      </div>
      <div><strong>자재코드:</strong></div>
      <div>${자재코드}</div>
      <div><strong>자재명:</strong></div>
      <div>${record.자재명 || '-'}</div>
      <div><strong>규격:</strong></div>
      <div>${record.규격 || '-'}</div>
      <div><strong>단위:</strong></div>
      <div>${record.단위 || '-'}</div>
      <div><strong>입출고일자:</strong></div>
      <div>${formatDate(record.입출고일자)}</div>
      <div><strong>거래일자:</strong></div>
      <div>${formatDate(record.거래일자)}</div>
      <div><strong>거래번호:</strong></div>
      <div>${record.거래번호 || '-'}</div>
      <div><strong>수량:</strong></div>
      <div style="text-align: right; font-weight: 600;">${formatNumber(수량 || 0)}</div>
      <div><strong>단가:</strong></div>
      <div style="text-align: right; font-weight: 600;">${formatCurrency(단가 || 0)}</div>
      <div><strong>부가세:</strong></div>
      <div style="text-align: right; font-weight: 600;">${formatCurrency(부가 || 0)}</div>
      <div><strong>합계:</strong></div>
      <div style="text-align: right; font-weight: 700; color: #007bff; font-size: 16px;">${formatCurrency(합계)}</div>
      <div><strong>거래처코드:</strong></div>
      <div>${거래처코드 || '-'}</div>
      <div><strong>거래처명:</strong></div>
      <div>${거래처명 || '-'}</div>
      <div><strong>적요:</strong></div>
      <div style="grid-column: span 2; white-space: pre-wrap;">${record.적요 || '-'}</div>
      <div><strong>사용자코드:</strong></div>
      <div>${record.사용자코드 || '-'}</div>
      <div><strong>수정일자:</strong></div>
      <div>${record.수정일자 || '-'}</div>
    `;

    document.getElementById('historyDetailContent').innerHTML = detailHTML;

    // 모달 표시
    document.getElementById('historyDetailModal').style.display = 'flex';
  } catch (err) {
    console.error('상세 조회 에러:', err);
    alert('상세 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

// (이 함수는 위에서 이미 정의되어 있으므로 삭제)

/**
 * 수정 모달 열기
 */
async function editMaterialHistory(compositeKey) {
  try {
    const [사업장코드, 분류코드, 세부코드, 입출고일자, 입출고시간] = compositeKey.split('_');

    const url = `${API_BASE_URL}/material-history/${사업장코드}/${분류코드}/${세부코드}/${입출고일자}/${입출고시간}`;
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) throw new Error('상세 조회 실패');

    const data = await response.json();
    const record = data.data;

    // 폼에 데이터 채우기
    const titleElement = document.getElementById('historyModalTitle');
    if (titleElement) {
      titleElement.textContent = '자재내역 수정';
    }

    document.getElementById('historyModalMode').value = 'edit';
    document.getElementById('historyOriginalCompositeKey').value = compositeKey;

    // 사업장코드는 세션에서 가져오므로 필드에 설정하지 않음
    document.getElementById('history분류코드').value = record.분류코드 || '';
    document.getElementById('history세부코드').value = record.세부코드 || '';
    document.getElementById('history입출고구분').value = record.입출고구분 || '1';
    document.getElementById('history입출고일자').value = formatDateInput(record.입출고일자);
    document.getElementById('history거래일자').value = formatDateInput(record.거래일자);
    document.getElementById('history거래번호').value = record.거래번호 || '';

    if (record.입출고구분 === 1) {
      document.getElementById('history수량').value = record.입고수량 || 0;
      document.getElementById('history단가').value = record.입고단가 || 0;
      document.getElementById('history부가').value = record.입고부가 || 0;
      document.getElementById('history거래처코드').value = record.매입처코드 || '';
    } else {
      document.getElementById('history수량').value = record.출고수량 || 0;
      document.getElementById('history단가').value = record.출고단가 || 0;
      document.getElementById('history부가').value = record.출고부가 || 0;
      document.getElementById('history거래처코드').value = record.매출처코드 || '';
    }

    document.getElementById('history적요').value = record.적요 || '';

    // 모달 표시
    document.getElementById('historyModal').style.display = 'flex';
  } catch (err) {
    console.error('수정 모달 에러:', err);
    alert('수정 모달을 열 수 없습니다: ' + err.message);
  }
}

/**
 * 저장 (생성/수정)
 */
async function saveMaterialHistory() {
  const mode = document.getElementById('historyModalMode').value;

  const formData = {
    사업장코드: document.getElementById('history사업장코드').value.trim(),
    분류코드: document.getElementById('history분류코드').value.trim(),
    세부코드: document.getElementById('history세부코드').value.trim(),
    입출고구분: parseInt(document.getElementById('history입출고구분').value),
    입출고일자: document.getElementById('history입출고일자').value.replace(/-/g, ''),
    거래일자: document.getElementById('history거래일자').value.replace(/-/g, ''),
    거래번호: parseInt(document.getElementById('history거래번호').value) || 0,
    적요: document.getElementById('history적요').value.trim(),
  };

  const 수량 = parseFloat(document.getElementById('history수량').value) || 0;
  const 단가 = parseFloat(document.getElementById('history단가').value) || 0;
  const 부가 = parseFloat(document.getElementById('history부가').value) || 0;
  const 거래처코드 = document.getElementById('history거래처코드').value.trim();

  if (formData.입출고구분 === 1) {
    formData.입고수량 = 수량;
    formData.입고단가 = 단가;
    formData.입고부가 = 부가;
    formData.매입처코드 = 거래처코드;
    formData.출고수량 = 0;
    formData.출고단가 = 0;
    formData.출고부가 = 0;
    formData.매출처코드 = '';
  } else {
    formData.출고수량 = 수량;
    formData.출고단가 = 단가;
    formData.출고부가 = 부가;
    formData.매출처코드 = 거래처코드;
    formData.입고수량 = 0;
    formData.입고단가 = 0;
    formData.입고부가 = 0;
    formData.매입처코드 = '';
  }

  // 필수 항목 검증
  if (!formData.사업장코드 || !formData.분류코드 || !formData.세부코드) {
    alert('사업장코드, 분류코드, 세부코드는 필수 입력 항목입니다.');
    return;
  }

  try {
    let url, method;

    if (mode === 'create') {
      url = `${API_BASE_URL}/material-history`;
      method = 'POST';
    } else {
      const originalKey = document.getElementById('historyOriginalCompositeKey').value;
      const [사업장코드, 분류코드, 세부코드, 입출고일자, 입출고시간] = originalKey.split('_');
      url = `${API_BASE_URL}/material-history/${사업장코드}/${분류코드}/${세부코드}/${입출고일자}/${입출고시간}`;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '저장 실패');
    }

    alert(mode === 'create' ? '등록되었습니다.' : '수정되었습니다.');
    closeHistoryModal();
    loadMaterialHistory();
  } catch (err) {
    console.error('저장 에러:', err);
    alert('저장 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 삭제 확인 모달
 */
function openHistoryDeleteModal(compositeKey = null) {
  if (compositeKey) {
    selectedHistoryRecords = [compositeKey];
  }

  if (selectedHistoryRecords.length === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }

  document.getElementById('historyDeleteCount').textContent = selectedHistoryRecords.length;
  document.getElementById('historyDeleteModal').style.display = 'flex';
}

/**
 * 삭제 확인
 */
async function confirmDeleteHistory() {
  const compositeKey = window.currentDeleteCompositeKey;
  if (!compositeKey) return;

  try {
    const [사업장코드, 분류코드, 세부코드, 입출고일자, 입출고시간] = compositeKey.split('_');

    const url = `${API_BASE_URL}/material-history/${사업장코드}/${분류코드}/${세부코드}/${입출고일자}/${입출고시간}`;
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '삭제 실패');
    }

    alert('자재내역이 삭제되었습니다.');
    closeHistoryDeleteModal();

    // 선택 초기화
    selectedHistoryRecords = [];
    $('.history-checkbox').prop('checked', false);
    $('#selectAllHistory').prop('checked', false);

    // 검색어가 있으면 다시 검색, 없으면 빈 테이블
    const keyword = document.getElementById('historyListSearchInput').value.trim();
    if (keyword) {
      loadMaterialHistory(keyword);
    } else {
      if (window.materialHistoryTableInstance) {
        window.materialHistoryTableInstance.clear().draw();
      }
    }
  } catch (err) {
    console.error('삭제 에러:', err);
    alert('삭제 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 모달 닫기
 */
function closeHistoryModal() {
  document.getElementById('historyModal').style.display = 'none';
  document.getElementById('historyForm').reset();
}

function closeHistoryDetailModal() {
  document.getElementById('historyDetailModal').style.display = 'none';
}

function closeHistoryDeleteModal() {
  document.getElementById('historyDeleteModal').style.display = 'none';
}

/**
 * 날짜 포맷 변환 (YYYYMMDD → YYYY-MM-DD)
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return '-';
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

/**
 * 날짜 포맷 변환 (YYYYMMDD → YYYY-MM-DD for input field)
 */
function formatDateInput(dateStr) {
  if (!dateStr || dateStr.length !== 8) return '';
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

/**
 * 숫자 포맷 (천단위 콤마)
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('ko-KR');
}

/**
 * 통화 포맷 (원화)
 */
function formatCurrency(num) {
  if (num === null || num === undefined) return '0원';
  return Number(num).toLocaleString('ko-KR') + '원';
}

/**
 * Google Sheets로 내보내기
 */
function exportHistoryToGoogleSheets() {
  try {
    console.log('===== Google Sheets로 내보내기 시작 =====');

    // 1. DataTable에서 현재 표시된 데이터 가져오기
    const table = $('#materialHistoryTable').DataTable();
    const dataToExport = table.rows({ search: 'applied' }).data().toArray();

    if (dataToExport.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    console.log(`✅ 내보낼 데이터 수: ${dataToExport.length}건`);

    // 2. CSV 형식으로 변환
    const headers = [
      '순번',
      '자재코드',
      '자재명',
      '규격',
      '단위',
      '입출고일자',
      '거래일자',
      '입출고구분',
      '수량',
      '단가',
      '거래처',
    ];
    let csvContent = '\uFEFF'; // UTF-8 BOM 추가 (엑셀에서 한글 깨짐 방지)
    csvContent += headers.join(',') + '\n';

    dataToExport.forEach((row, index) => {
      // 자재코드 처리 (세부코드가 이미 분류코드를 포함하고 있는지 확인)
      let 세부코드 = row.세부코드 || '';
      if (세부코드.substring(0, 2) === row.분류코드) {
        세부코드 = 세부코드.substring(2);
      }
      const 자재코드 = `${row.분류코드}${세부코드}`;

      // 입출고구분
      const 입출고구분명 = row.입출고구분 === 1 ? '입고' : row.입출고구분 === 2 ? '출고' : '-';

      // 수량 및 단가
      const 수량 = row.입출고구분 === 1 ? row.입고수량 || 0 : row.출고수량 || 0;
      const 단가 = row.입출고구분 === 1 ? row.입고단가 || 0 : row.출고단가 || 0;

      // 거래처
      let 거래처 = '-';
      if (row.입출고구분 === 1 && row.매입처명) {
        거래처 = `${row.매입처코드 || ''} ${row.매입처명}`;
      } else if (row.입출고구분 === 2 && row.매출처명) {
        거래처 = `${row.매출처코드 || ''} ${row.매출처명}`;
      }

      // 날짜 포맷
      const 입출고일자 = row.입출고일자 ? formatDate(row.입출고일자) : '-';
      const 거래일자 = row.거래일자 ? formatDate(row.거래일자) : '-';

      const rowArray = [
        index + 1, // 순번
        자재코드,
        row.자재명 || '-',
        row.규격 || '-',
        row.단위 || '-',
        입출고일자,
        거래일자,
        입출고구분명,
        수량,
        단가,
        거래처,
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
      const filename = `자재내역관리_${today}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ CSV 파일 다운로드 완료:', filename);
      alert(
        `CSV 파일이 다운로드되었습니다.\n\nGoogle Sheets에서:\n1. 파일 > 가져오기\n2. 업로드 탭 선택\n3. 다운로드된 CSV 파일 선택\n4. 가져오기를 클릭하세요.`,
      );
    }
  } catch (error) {
    console.error('❌ CSV 내보내기 오류:', error);
    alert('CSV 파일 생성 중 오류가 발생했습니다: ' + error.message);
  }
}

// 페이지 로드 시 초기화 (데이터는 페이지 표시 시 로드)
$(document).ready(function () {
  initMaterialHistoryTable();
  // loadMaterialHistory()를 여기서 호출하지 않음 - pageMap의 loadFunc에서 호출됨
});
