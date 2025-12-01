/**
 * 자재내역관리 (Material Management)
 * 자재 테이블 CRUD 기능
 */

let materialHistoryTableInstance = null;
let selectedMaterials = [];

/**
 * 자재 목록 DataTable 초기화
 */
function initMaterialHistoryTable() {
  if (materialHistoryTableInstance) {
    materialHistoryTableInstance.destroy();
  }

  materialHistoryTableInstance = $('#materialHistoryTable').DataTable({
    data: [],
    order: [], // 입력 순서 유지
    columns: [
      {
        data: null,
        orderable: false,
        className: 'dt-center',
        width: '40px',
        render: function (data, type, row) {
          return `<input type="checkbox" class="material-checkbox" data-code="${
            row.분류코드 + row.세부코드
          }" />`;
        },
      },
      {
        data: null,
        className: 'dt-center',
        render: (data, type, row, meta) => meta.row + 1,
      },
      {
        data: '분류코드',
        render: (data) => {
          // 자재코드에서 사업장코드 + 분류코드 제거하고 순수 세부코드만 표시
          // if (data && data.length >= 2) {
          //   return data.substring(2); // 앞 4자리(사업장코드2 + 분류코드2) 제거
          // }
          return data || '-';
        },
      },
      {
        data: '세부코드',
        render: (data) => {
          // 자재코드에서 사업장코드 + 분류코드 제거하고 순수 세부코드만 표시
          // if (data && data.length >= 2) {
          //   return data.substring(2); // 앞 4자리(사업장코드2 + 분류코드2) 제거
          // }
          return data || '-';
        },
      },
      {
        data: '자재명',
        defaultContent: '-',
        render: (data, type, row) => {
          if (row.사용구분 === 9) {
            return `<span style="color: #dc3545; text-decoration: line-through;">${
              data || '-'
            }</span> <span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 8px; font-size: 10px; margin-left: 4px;">삭제됨</span>`;
          }
          return data || '-';
        },
      },
      { data: '규격', defaultContent: '-' },
      { data: '단위', defaultContent: '-' },
      {
        data: '과세구분',
        className: 'dt-center',
        render: (data) => {
          if (data === 1) {
            return '<span style="background: #007bff; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px;">과세</span>';
          } else if (data === 0) {
            return '<span style="background: #6c757d; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px;">면세</span>';
          }
          return '-';
        },
      },
      {
        data: '입고단가1',
        className: 'dt-right',
        render: (data) => formatCurrency(data || 0),
      },
      {
        data: '출고단가1',
        className: 'dt-right',
        render: (data) => formatCurrency(data || 0),
      },
      {
        data: null,
        className: 'dt-center',
        orderable: false,
        width: '200px',
        render: function (data, type, row) {
          const 자재코드 = row.분류코드 + row.세부코드;
          const uniqueId = `material-history-actions-${자재코드}`;

          // 삭제된 자재는 상세 버튼만 표시
          if (row.사용구분 === 9) {
            return `
              <div id="${uniqueId}" style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                <button class="btn-detail" onclick="viewMaterialDetail('${자재코드}')"
                        style="padding: 6px 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                  상세
                </button>
                <span style="color: #999; font-size: 12px; margin-left: 8px;">삭제된 자재</span>
              </div>
            `;
          }

          // 정상 자재 - 기본적으로 상세 버튼만 표시, 수정/삭제는 숨김
          return `
            <div id="${uniqueId}" style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn-detail" onclick="viewMaterialDetail('${자재코드}')"
                      style="padding: 6px 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                상세
              </button>
              <button class="btn-edit" onclick="editMaterial('${자재코드}')"
                      style="padding: 6px 12px; background: #ffc107; color: #333; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; display: none;">
                수정
              </button>
              <button class="btn-delete" onclick="deleteMaterial('${자재코드}')"
                      style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; display: none;">
                삭제
              </button>
            </div>
          `;
        },
      },
    ],
    language: {
      emptyTable: '검색 버튼을 눌러 자재를 조회하세요.',
      info: '전체 _TOTAL_개 중 _START_~_END_번째',
      infoEmpty: '데이터 없음',
      infoFiltered: '(전체 _MAX_개 중 검색결과)',
      lengthMenu: '_MENU_개씩 보기',
      search: '검색:',
      zeroRecords: '검색 결과가 없습니다.',
      paginate: {
        first: '처음',
        last: '마지막',
        next: '다음',
        previous: '이전',
      },
    },
    pageLength: 25,
    lengthMenu: [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, '전체'],
    ],
    // dom: '<"top d-flex justify-content-between"<"left"l><"right"f>>rt<"bottom"ip>',
  });

  // 체크박스 전체 선택/해제
  $('#selectAllMaterials').on('change', function () {
    const isChecked = $(this).prop('checked');
    $('.material-checkbox').prop('checked', isChecked);
    updateMaterialHistoryButtonStates();
  });

  // 개별 체크박스 변경 이벤트
  $('#materialHistoryTable tbody').on('change', '.material-checkbox', function () {
    updateMaterialHistoryButtonStates();
  });

  console.log('✅ 자재 목록 DataTable 초기화 완료');
}

/**
 * 체크박스 상태에 따라 버튼 표시/숨김 처리
 */
function updateMaterialHistoryButtonStates() {
  console.log('🔍 updateMaterialHistoryButtonStates 호출됨');

  const checkboxes = document.querySelectorAll('.material-checkbox');
  const checkedCount = Array.from(checkboxes).filter((cb) => cb.checked).length;

  console.log(`체크된 항목 수: ${checkedCount}`);

  checkboxes.forEach((checkbox, index) => {
    const isChecked = checkbox.checked;
    const fullCode = checkbox.getAttribute('data-code'); // 이미 분류코드+세부코드 형태
    const actionsDivId = `material-history-actions-${fullCode}`;
    const actionsDiv = document.getElementById(actionsDivId);

    console.log(
      `체크박스 index=${index}, checked=${isChecked}, actionsDivId=${actionsDivId}, found=${!!actionsDiv}`,
    );

    if (actionsDiv) {
      const detailBtn = actionsDiv.querySelector('.btn-detail');
      const editBtn = actionsDiv.querySelector('.btn-edit');
      const deleteBtn = actionsDiv.querySelector('.btn-delete');

      console.log(
        `  버튼 찾기: detailBtn=${!!detailBtn}, editBtn=${!!editBtn}, deleteBtn=${!!deleteBtn}`,
      );

      if (detailBtn && editBtn && deleteBtn) {
        if (isChecked && checkedCount === 1) {
          // 1개만 체크된 경우 → 상세 버튼 숨김, 수정/삭제 버튼 표시
          detailBtn.style.display = 'none';
          editBtn.style.display = 'inline-block';
          deleteBtn.style.display = 'inline-block';
          console.log('  ✅ 수정/삭제 버튼 표시, 상세 버튼 숨김');
        } else {
          // 체크 안됨 또는 2개 이상 체크된 경우 → 상세 버튼만 표시
          detailBtn.style.display = 'inline-block';
          editBtn.style.display = 'none';
          deleteBtn.style.display = 'none';
          console.log('  ✅ 상세 버튼만 표시');
        }
      }
    }
  });
}

/**
 * 자재 목록 조회
 */
async function loadMaterialList(searchKeyword = '') {
  try {
    console.log('🔍 자재 목록 조회 시작:', searchKeyword);

    // 자재내역관리에서는 삭제된 자재(사용구분=9)도 포함하여 조회
    const url = searchKeyword
      ? `/api/materials?search=${encodeURIComponent(searchKeyword)}&includeDeleted=true`
      : '/api/materials?includeDeleted=true';

    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('자재 목록 조회 실패');
    }

    const result = await response.json();

    if (result.success && result.data) {
      console.log(`✅ 자재 ${result.data.length}건 조회 성공`);

      // DataTable 데이터 갱신
      materialHistoryTableInstance.clear();
      materialHistoryTableInstance.rows.add(result.data);
      materialHistoryTableInstance.draw();
    } else {
      alert('자재 목록 조회에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 자재 목록 조회 에러:', error);
    alert('자재 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 검색 기능
 */
window.searchMaterialHistory = function searchMaterialHistory() {
  const keyword = document.getElementById('historyListSearchInput').value.trim();
  loadMaterialList(keyword);
};

/**
 * 검색 초기화
 */
window.resetHistorySearch = function resetHistorySearch() {
  document.getElementById('historyListSearchInput').value = '';
  materialHistoryTableInstance.clear().draw();
  console.log('🔄 검색 초기화 완료');
};

/**
 * 신규 자재 등록 모달 열기
 */
window.openNewHistoryModal = function openNewHistoryModal() {
  // 모달 제목 설정
  const titleElement = document.getElementById('historyModalTitle');
  if (titleElement) {
    titleElement.textContent = '자재 신규 등록';
  }

  // 폼 초기화
  document.getElementById('historyForm').reset();

  // 저장 버튼 이벤트 설정
  const saveBtn = document.getElementById('saveHistoryBtn');
  if (saveBtn) {
    saveBtn.onclick = saveMaterial;
  }

  // 모달 표시
  document.getElementById('historyModal').style.display = 'flex';
};

/**
 * 자재 저장 (신규 등록)
 */
async function saveMaterial() {
  try {
    const 분류코드 = document.getElementById('history분류코드').value.trim();
    const 세부코드 = document.getElementById('history세부코드').value.trim();
    const 자재명 = document.getElementById('history자재명').value.trim();
    const 바코드 = document.getElementById('history바코드')?.value.trim() || '';
    const 규격 = document.getElementById('history규격')?.value.trim() || '';
    const 단위 = document.getElementById('history단위')?.value.trim() || '';
    const 폐기율 = parseFloat(document.getElementById('history폐기율')?.value || 0);
    const 과세구분 = parseInt(document.getElementById('history과세구분')?.value || 1);
    const 적요 = document.getElementById('history적요')?.value.trim() || '';

    // 필수 항목 검증
    if (!분류코드 || !세부코드 || !자재명) {
      alert('분류코드, 세부코드, 자재명은 필수 입력 항목입니다.');
      return;
    }

    const requestBody = {
      분류코드,
      세부코드,
      자재명,
      바코드,
      규격,
      단위,
      폐기율,
      과세구분,
      적요,
    };

    console.log('📤 자재 등록 요청:', requestBody);

    const response = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (result.success) {
      alert('자재가 등록되었습니다.');
      closeHistoryModal();
      searchMaterialHistory(); // 목록 새로고침
    } else {
      alert(result.message || '자재 등록에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 자재 등록 에러:', error);
    alert('자재 등록 중 오류가 발생했습니다.');
  }
}

/**
 * 자재 수정 모달 열기
 */
window.editMaterial = async function editMaterial(자재코드) {
  try {
    console.log('✏️ 자재 수정 모달 열기:', 자재코드);

    // 자재 상세 정보 조회
    const response = await fetch(`/api/materials/${자재코드}/detail`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('자재 정보 조회 실패');
    }

    const result = await response.json();

    if (result.success && result.data.material) {
      const material = result.data.material;

      // 모달 제목 설정
      const titleElement = document.getElementById('historyModalTitle');
      if (titleElement) {
        titleElement.textContent = '자재 수정';
      }

      // 폼에 데이터 채우기
      document.getElementById('history분류코드').value = material.분류코드 || '';
      document.getElementById('history분류코드').readOnly = true; // 수정 불가
      document.getElementById('history세부코드').value = material.세부코드 || '';
      document.getElementById('history세부코드').readOnly = true; // 수정 불가
      document.getElementById('history자재명').value = material.자재명 || '';
      document.getElementById('history바코드').value = material.바코드 || '';
      document.getElementById('history규격').value = material.규격 || '';
      document.getElementById('history단위').value = material.단위 || '';
      document.getElementById('history폐기율').value = material.폐기율 || 0;
      document.getElementById('history과세구분').value = material.과세구분 || 1;
      document.getElementById('history적요').value = material.적요 || '';

      // 저장 버튼 이벤트 설정
      const saveBtn = document.getElementById('saveHistoryBtn');
      if (saveBtn) {
        saveBtn.onclick = () => updateMaterial(자재코드);
      }

      // 모달 표시
      document.getElementById('historyModal').style.display = 'flex';
    } else {
      alert('자재 정보를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('❌ 자재 수정 모달 열기 에러:', error);
    alert('자재 정보 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 자재 업데이트
 */
async function updateMaterial(자재코드) {
  try {
    const 자재명 = document.getElementById('history자재명').value.trim();
    const 바코드 = document.getElementById('history바코드')?.value.trim() || '';
    const 규격 = document.getElementById('history규격')?.value.trim() || '';
    const 단위 = document.getElementById('history단위')?.value.trim() || '';
    const 폐기율 = parseFloat(document.getElementById('history폐기율')?.value || 0);
    const 과세구분 = parseInt(document.getElementById('history과세구분')?.value || 1);
    const 적요 = document.getElementById('history적요')?.value.trim() || '';

    // 필수 항목 검증
    if (!자재명) {
      alert('자재명은 필수 입력 항목입니다.');
      return;
    }

    const requestBody = {
      자재명,
      바코드,
      규격,
      단위,
      폐기율,
      과세구분,
      적요,
    };

    console.log('📤 자재 수정 요청:', 자재코드, requestBody);

    const response = await fetch(`/api/materials/${자재코드}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (result.success) {
      alert('자재가 수정되었습니다.');
      closeHistoryModal();
      searchMaterialHistory(); // 목록 새로고침
    } else {
      alert(result.message || '자재 수정에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 자재 수정 에러:', error);
    alert('자재 수정 중 오류가 발생했습니다.');
  }
}

/**
 * 자재 삭제
 */
window.deleteMaterial = async function deleteMaterial(자재코드) {
  // 삭제할 자재 정보 표시
  const deleteInfo = document.getElementById('historyDeleteInfo');
  deleteInfo.innerHTML = `
    <div style="font-size: 14px; color: #333;">
      <strong>자재코드:</strong> ${자재코드.substring(4)}<br>
      <p style="margin-top: 8px; color: #666; font-size: 13px;">
        이 작업은 자재의 사용구분을 9로 변경합니다.
      </p>
    </div>
  `;

  // 삭제할 자재코드 저장
  window.materialToDelete = 자재코드;

  // 모달창 표시
  document.getElementById('historyDeleteModal').style.display = 'flex';
};

/**
 * 삭제 모달 닫기
 */
window.closeHistoryDeleteModal = function closeHistoryDeleteModal() {
  document.getElementById('historyDeleteModal').style.display = 'none';
  window.materialToDelete = null;
};

/**
 * 삭제 확인 처리
 */
window.confirmDeleteHistory = async function confirmDeleteHistory() {
  if (!window.materialToDelete) {
    return;
  }

  try {
    console.log('🗑️ 자재 삭제 요청:', window.materialToDelete);

    const response = await fetch(`/api/materials/${window.materialToDelete}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const result = await response.json();

    if (result.success) {
      alert('자재가 삭제되었습니다.');
      closeHistoryDeleteModal();
      searchMaterialHistory(); // 목록 새로고침
    } else {
      alert(result.message || '자재 삭제에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 자재 삭제 에러:', error);
    alert('자재 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 자재 상세보기 모달 열기
 */
window.viewMaterialDetail = async function viewMaterialDetail(자재코드) {
  try {
    console.log('🔍 자재 상세보기:', 자재코드);

    const response = await fetch(`/api/materials/${자재코드}/detail`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('자재 상세 정보 조회 실패');
    }

    const result = await response.json();

    if (result.success && result.data) {
      console.log('✅ 자재 상세 정보 조회 성공:', result.data);
      displayMaterialDetailModal(result.data);
    } else {
      alert('자재 상세 정보를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('❌ 자재 상세보기 에러:', error);
    alert('자재 상세 정보 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 자재 상세 정보 모달 표시
 */
function displayMaterialDetailModal(data) {
  const { material, prices, ledger, transactions } = data;

  // 기본 정보 HTML 생성
  const basicInfoHtml = `
    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #333;">📦 자재 기본 정보</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <div><strong>자재코드:</strong> ${material.세부코드 || '-'}</div>
        <div><strong>분류명:</strong> ${material.분류명 || '-'}</div>
        <div><strong>자재명:</strong> ${material.자재명 || '-'}</div>
        <div><strong>규격:</strong> ${material.규격 || '-'}</div>
        <div><strong>단위:</strong> ${material.단위 || '-'}</div>
        <div><strong>바코드:</strong> ${material.바코드 || '-'}</div>
        <div><strong>폐기율:</strong> ${material.폐기율 || 0}%</div>
        <div><strong>과세구분:</strong> ${material.과세구분 === 1 ? '과세' : '면세'}</div>
        <div style="grid-column: 1 / -1;"><strong>적요:</strong> ${material.적요 || '-'}</div>
      </div>
    </div>
  `;

  // 자재시세 정보 HTML 생성
  let pricesHtml = `
    <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #333;">💰 자재시세 (매입처별 단가)</h3>
  `;

  if (prices && prices.length > 0) {
    pricesHtml += `<table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f1f1f1;">
          <th style="padding: 8px; border: 1px solid #ddd;">매입처</th>
          <th style="padding: 8px; border: 1px solid #ddd;">적용일자</th>
          <th style="padding: 8px; border: 1px solid #ddd;">입고단가</th>
          <th style="padding: 8px; border: 1px solid #ddd;">출고단가</th>
          <th style="padding: 8px; border: 1px solid #ddd;">마진율</th>
        </tr>
      </thead>
      <tbody>`;

    prices.forEach((price) => {
      pricesHtml += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${
            price.매입처명 || price.매입처코드 || '-'
          }</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${
            price.적용일자 || '-'
          }</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(
            price.입고단가 || 0,
          )}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(
            price.출고단가 || 0,
          )}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatNumber(
            price.마진율 || 0,
          )}%</td>
        </tr>
      `;
    });

    pricesHtml += `</tbody></table>`;
  } else {
    pricesHtml += `<p style="color: #999;">등록된 자재시세 정보가 없습니다.</p>`;
  }

  pricesHtml += `</div>`;

  // 자재원장 정보 HTML 생성
  let ledgerHtml = `
    <div style="background: #d1ecf1; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #333;">📊 자재원장 (실제 단가 및 재고)</h3>
  `;

  if (ledger) {
    ledgerHtml += `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div><strong>주매입처:</strong> ${ledger.주매입처명 || ledger.주매입처코드 || '-'}</div>
        <div><strong>적정재고:</strong> ${formatNumber(ledger.적정재고 || 0)}</div>
        <div><strong>최저재고:</strong> ${formatNumber(ledger.최저재고 || 0)}</div>
        <div><strong>입고단가1:</strong> ${formatCurrency(ledger.입고단가1 || 0)}</div>
        <div><strong>입고단가2:</strong> ${formatCurrency(ledger.입고단가2 || 0)}</div>
        <div><strong>입고단가3:</strong> ${formatCurrency(ledger.입고단가3 || 0)}</div>
        <div><strong>출고단가1:</strong> ${formatCurrency(ledger.출고단가1 || 0)}</div>
        <div><strong>출고단가2:</strong> ${formatCurrency(ledger.출고단가2 || 0)}</div>
        <div><strong>출고단가3:</strong> ${formatCurrency(ledger.출고단가3 || 0)}</div>
        <div><strong>최종입고일:</strong> ${ledger.최종입고일자 || ''}</div>
        <div><strong>최종출고일:</strong> ${ledger.최종출고일자 || ''}</div>
        <div style="grid-column: 1 / -1;"><strong>비고:</strong> ${ledger.비고란 || '-'}</div>
      </div>
    `;
  } else {
    ledgerHtml += `<p style="color: #999;">등록된 자재원장 정보가 없습니다.</p>`;
  }

  ledgerHtml += `</div>`;

  // 입출고 이력 HTML 생성
  let transactionsHtml = `
    <div style="background: #d4edda; padding: 16px; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #333;">📋 입출고 이력 (최근 20건)</h3>
  `;

  if (transactions && transactions.length > 0) {
    transactionsHtml += `<div style="max-height: 400px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead style="position: sticky; top: 0; background: #fff;">
          <tr style="background: #f1f1f1;">
            <th style="padding: 6px; border: 1px solid #ddd;">구분</th>
            <th style="padding: 6px; border: 1px solid #ddd;">거래일자</th>
            <th style="padding: 6px; border: 1px solid #ddd;">거래처</th>
            <th style="padding: 6px; border: 1px solid #ddd;">수량</th>
            <th style="padding: 6px; border: 1px solid #ddd;">단가</th>
            <th style="padding: 6px; border: 1px solid #ddd;">공급가액</th>
            <th style="padding: 6px; border: 1px solid #ddd;">적요</th>
          </tr>
        </thead>
        <tbody>`;

    transactions.forEach((tx) => {
      const 구분Badge =
        tx.입출고구분 === 1
          ? '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">입고</span>'
          : '<span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">출고</span>';

      const 수량 = tx.입출고구분 === 1 ? tx.입고수량 : tx.출고수량;
      const 단가 = tx.입출고구분 === 1 ? tx.입고단가 : tx.출고단가;
      const 공급가액 = tx.입출고구분 === 1 ? tx.입고공급가액 : tx.출고공급가액;

      transactionsHtml += `
        <tr>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${구분Badge}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${
            tx.거래일자 || '-'
          }</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${tx.거래처명 || '-'}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${formatNumber(
            수량 || 0,
          )}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${formatCurrency(
            단가 || 0,
          )}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${formatCurrency(
            공급가액 || 0,
          )}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${tx.적요 || '-'}</td>
        </tr>
      `;
    });

    transactionsHtml += `</tbody></table></div>`;
  } else {
    transactionsHtml += `<p style="color: #999;">입출고 이력이 없습니다.</p>`;
  }

  transactionsHtml += `</div>`;

  // 모달에 HTML 삽입
  const detailContent = document.getElementById('historyDetailContent');
  if (detailContent) {
    detailContent.innerHTML = basicInfoHtml + pricesHtml + ledgerHtml + transactionsHtml;
  }

  // 모달 표시
  document.getElementById('historyDetailModal').style.display = 'flex';
}

/**
 * 상세보기 모달 닫기
 */
window.closeHistoryDetailModal = function closeHistoryDetailModal() {
  document.getElementById('historyDetailModal').style.display = 'none';
};

/**
 * 등록/수정 모달 닫기
 */
window.closeHistoryModal = function closeHistoryModal() {
  document.getElementById('historyModal').style.display = 'none';
  document.getElementById('historyForm').reset();

  // readOnly 속성 제거
  document.getElementById('history분류코드').readOnly = false;
  document.getElementById('history세부코드').readOnly = false;
};

/**
 * Google Sheets 내보내기
 */
window.exportHistoryToGoogleSheets = function exportHistoryToGoogleSheets() {
  try {
    console.log('===== Google Sheets로 내보내기 시작 =====');

    const table = $('#materialHistoryTable').DataTable();
    const dataToExport = table.rows({ search: 'applied' }).data().toArray();

    if (dataToExport.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = [
      '순번',
      '분류명',
      '자재코드',
      '자재명',
      '규격',
      '단위',
      '과세구분',
      '입고단가1',
      '출고단가1',
    ];

    // CSV 데이터 생성
    let csvContent = headers.join(',') + '\n';

    dataToExport.forEach((row, index) => {
      const rowData = [
        index + 1,
        `"${row.분류명 || ''}"`,
        `"${row.자재코드?.substring(4) || ''}"`,
        `"${row.자재명 || ''}"`,
        `"${row.규격 || ''}"`,
        `"${row.단위 || ''}"`,
        row.과세구분 === 1 ? '과세' : '면세',
        row.입고단가1 || 0,
        row.출고단가1 || 0,
      ];
      csvContent += rowData.join(',') + '\n';
    });

    // Blob 생성 및 다운로드
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `자재목록_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV 파일 다운로드 완료');
    alert('CSV 파일이 다운로드되었습니다. Google Sheets에서 열어보세요.');
  } catch (error) {
    console.error('❌ CSV 내보내기 에러:', error);
    alert('CSV 내보내기 중 오류가 발생했습니다.');
  }
};

// formatDate, formatNumber, formatCurrencyKRW 함수는 common.js에서 정의됨

/**
 * formatCurrency는 common.js의 formatCurrencyKRW를 사용
 * (material-history.js에서는 "원" 단위가 필요하므로 별칭 사용)
 * Note: formatCurrency가 common.js에서 이미 정의되어 있으면 그것을 사용
 */
if (typeof formatCurrency === 'undefined') {
  window.formatCurrency = formatCurrencyKRW;
}

// 페이지 로드 시 DataTable 초기화
$(document).ready(function () {
  if ($('#materialHistoryTable').length > 0) {
    initMaterialHistoryTable();
    console.log('✅ 자재내역관리 페이지 로드 완료');
  }
});
