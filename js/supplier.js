// ✅ DataTables 초기화 (매입처관리)
$(document).ready(function () {
  let table;
  let currentSearchParams = { 매입처코드: '', 매입처명: '' }; // 현재 검색 조건 저장

  function loadSuppliers(매입처코드 = '', 매입처명 = '') {
    // 기존 인스턴스가 있으면 파괴 후 재생성
    if (table) table.destroy();

    // API URL에 검색 파라미터 추가 (pageSize=10000으로 전체 데이터 조회)
    let apiUrl = API_BASE_URL + '/suppliers?pageSize=10000';

    const params = [];
    if (매입처코드) params.push(`매입처코드=${encodeURIComponent(매입처코드)}`);
    if (매입처명) params.push(`매입처명=${encodeURIComponent(매입처명)}`);

    if (params.length > 0) {
      apiUrl += `&${params.join('&')}`;
    }

    // ✅ 공통 초기화 함수 사용 (dataTableInit.js)
    table = initDataTable('supplierTable', apiUrl, [
      {
        // 선택 체크박스
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return (
            '<input type="checkbox" class="supplierRowCheck" data-code="' + row.매입처코드 + '" />'
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
      { data: '매입처코드' },
      { data: '매입처명' },
      {
        // 대표자
        data: '대표자명',
        defaultContent: '-',
      },
      {
        // 사업자번호
        data: '사업자번호',
        defaultContent: '-',
      },
      {
        // 연락처
        data: '전화번호',
        defaultContent: '-',
      },
      {
        // 거래상태
        data: '사용구분',
        className: 'text-center',
        render: function (data, type, row) {
          if (data === 0) {
            return '<span class="status-badge status-active">정상거래</span>';
          } else {
            return '<span class="status-badge status-pending">거래보류</span>';
          }
        },
      },
      {
        // 등록일
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
            <div class="action-buttons" id="supplierActions-${row.매입처코드}">
              <button class="btn-icon supplierBtnView" onclick="viewSupplierDetail('${row.매입처코드}')">상세</button>
              <button class="btn-icon supplierBtnEdit" style="display: none;" onclick="editSupplier('${row.매입처코드}')">수정</button>
              <button class="btn-icon supplierBtnDelete" style="display: none;" onclick="deleteSupplier('${row.매입처코드}')">삭제</button>
            </div>
          `;
        },
      },
    ]);

    // ✅ DataTable이 다시 그려질 때마다 전체선택 상태 동기화
    table.on('draw', function () {
      const isSelectAllChecked = $('#supplierSelectAll').prop('checked');

      // 전체선택 상태에 따라 현재 페이지의 모든 체크박스 동기화
      $('.supplierRowCheck').prop('checked', isSelectAllChecked);

      // 각 체크박스 상태에 따라 버튼 표시/숨김 처리
      $('.supplierRowCheck').each(function () {
        const supplierCode = $(this).data('code');
        const isChecked = $(this).prop('checked');
        const actionDiv = $('#supplierActions-' + supplierCode);

        if (isChecked) {
          actionDiv.find('.supplierBtnView').hide();
          actionDiv.find('.supplierBtnEdit').show();
          actionDiv.find('.supplierBtnDelete').show();
        } else {
          actionDiv.find('.supplierBtnView').show();
          actionDiv.find('.supplierBtnEdit').hide();
          actionDiv.find('.supplierBtnDelete').hide();
        }
      });
    });
  }

  // 전역 함수로 노출 (페이지 표시될 때 showPage()에서 호출됨)
  window.loadSuppliers = loadSuppliers;

  // 새로고침 버튼 (현재 HTML에 없음 - 필요시 추가)
  // $('#supplierBtnReload').on('click', () => table.ajax.reload(null, false));

  // 전체 선택 체크박스
  $(document)
    .off('change.supplierPage', '#supplierSelectAll')
    .on('change.supplierPage', '#supplierSelectAll', function () {
      const isChecked = $(this).prop('checked');
      $('.supplierRowCheck').prop('checked', isChecked).trigger('change');
    });

  // 개별 체크박스 변경 시
  $(document)
    .off('change.supplierPage', '.supplierRowCheck')
    .on('change.supplierPage', '.supplierRowCheck', function () {
      // 전체 선택 체크박스 상태 업데이트
      const totalCheckboxes = $('.supplierRowCheck').length;
      const checkedCheckboxes = $('.supplierRowCheck:checked').length;
      $('#supplierSelectAll').prop('checked', totalCheckboxes === checkedCheckboxes);

      // 현재 행의 버튼 표시/숨김 처리
      const supplierCode = $(this).data('code');
      const isChecked = $(this).prop('checked');
      const actionDiv = $('#supplierActions-' + supplierCode);

      if (isChecked) {
        // 체크됨: 상세 버튼 숨기고 수정/삭제 버튼 표시
        actionDiv.find('.supplierBtnView').hide();
        actionDiv.find('.supplierBtnEdit').show();
        actionDiv.find('.supplierBtnDelete').show();
      } else {
        // 체크 해제: 수정/삭제 버튼 숨기고 상세 버튼 표시
        actionDiv.find('.supplierBtnView').show();
        actionDiv.find('.supplierBtnEdit').hide();
        actionDiv.find('.supplierBtnDelete').hide();
      }
    });

  // Enter 키 이벤트 처리
  $('#supplierSearchInput')
    .off('keypress.supplierPage')
    .on('keypress.supplierPage', function (e) {
      if (e.which === 13) {
        // Enter key
        e.preventDefault();
        searchSuppliers();
      }
    });

  // 검색 함수를 전역으로 노출
  window.searchSuppliers = function () {
    console.log('===== supplierPage > 검색 버튼 클릭 =====');

    const 매입처코드 = $('#supplierCodeSearchInput').val().trim();
    const 매입처명 = $('#supplierNameSearchInput').val().trim();

    currentSearchParams = { 매입처코드, 매입처명 };
    loadSuppliers(매입처코드, 매입처명);
  };

  // 검색 초기화 함수를 전역으로 노출
  window.resetSupplierSearch = function () {
    console.log('===== supplierPage > 초기화 버튼 클릭 =====');

    $('#supplierCodeSearchInput').val('');
    $('#supplierNameSearchInput').val('');
    currentSearchParams = { 매입처코드: '', 매입처명: '' };
    loadSuppliers('', '');
  };
});

// 매입처 신규등록 모달 열기
function openSupplierModal() {
  console.log('===== supplierPage > 신규 등록 버튼 클릭 =====');

  const modal = document.getElementById('supplierModal');

  if (!modal) {
    return;
  }

  modal.style.display = 'flex';

  const form = document.getElementById('supplierForm');

  if (form) {
    form.reset();
  }

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const randomNum = String(Math.floor(Math.random() * 10)).padStart(1, '0');
  const supplierCode = 'S' + year + month + date + randomNum;

  const codeInput = document.getElementById('supplierCode');

  if (codeInput) {
    codeInput.value = supplierCode;
  }

  // 드래그 기능 활성화 (최초 1회만 실행)
  if (typeof makeModalDraggable === 'function' && !window.supplierModalDraggable) {
    makeModalDraggable('supplierModal', 'supplierModalHeader');
    window.supplierModalDraggable = true;
  }
}

// 매입처 신규등록 모달 닫기
function closeSupplierModal() {
  console.log('===== supplierModal > 닫기 버튼 클릭 =====');
  const modal = document.getElementById('supplierModal');
  if (modal) {
    modal.style.display = 'none';

    // 폼 초기화
    const form = document.getElementById('supplierForm');
    if (form) {
      form.reset();
      form.onsubmit = submitSupplier; // 원래 이벤트로 복구
    }

    // 모달 제목 원래대로
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
      modalTitle.textContent = '매입처 신규등록';
    }

    // 매입처코드 입력 필드 readonly 해제
    const codeInput = document.getElementById('supplierCode');
    if (codeInput) {
      codeInput.readOnly = false;
    }
  }
}

// 모달 외부 클릭 시 닫기 (매입처)
document.addEventListener('DOMContentLoaded', function () {
  const supplierModal = document.getElementById('supplierModal');
  if (supplierModal) {
    supplierModal.addEventListener('click', function (e) {
      if (e.target === this) {
        closeSupplierModal();
      }
    });
  }
});

// 매입처 등록 제출
async function submitSupplier(event) {
  console.log('===== supplierModal > 저장 버튼 클릭 =====');
  event.preventDefault();

  try {
    const supplierCode = document.getElementById('supplierCode').value.trim();

    if (!supplierCode) {
      alert('매입처코드가 비어있습니다.');
      return;
    }
    if (supplierCode.length > 8) {
      alert('매입처코드는 8자 이하여야 합니다.');
      return;
    }

    const supplierName = document.getElementById('supplierName').value.trim();

    if (!supplierName) {
      alert('매입처명은 필수입니다.');
      return;
    }

    const formData = {
      사업장코드: currentUser.사업장코드 || '01',
      매입처코드: supplierCode,
      매입처명: supplierName,
      대표자명: document.getElementById('supplierCeoName').value.trim() || '',
      사업자번호: document.getElementById('supplierBusinessNo').value.trim() || '',
      전화번호: document.getElementById('supplierPhone').value.trim() || '',
      팩스번호: document.getElementById('supplierFax').value.trim() || '',
      우편번호: document.getElementById('supplierZipCode').value.trim() || '',
      주소: document.getElementById('supplierAddress').value.trim() || '',
      번지: document.getElementById('supplierAddressDetail').value.trim() || '',
      업태: document.getElementById('supplierBusinessType').value.trim() || '',
      업종: document.getElementById('supplierBusinessCategory').value.trim() || '',
      은행코드: document.getElementById('supplierBankCode').value || '',
      계좌번호: document.getElementById('supplierAccountNo').value.trim() || '',
      담당자명: document.getElementById('supplierManagerName').value.trim() || '',
      사용구분: parseInt(document.getElementById('supplierStatus').value) || 0,
      비고란: document.getElementById('supplierRemark').value.trim() || '',
    };

    const result = await apiCall('/suppliers', 'POST', formData);

    if (result.success) {
      alert('매입처가 등록되었습니다.');
      closeSupplierModal();
      // DataTable 새로고침
      $('#supplierTable').DataTable().ajax.reload(null, false);
    } else {
      alert('등록 실패: ' + result.message);
    }
  } catch (error) {
    console.error('매입처 등록 오류:', error);
    alert('매입처 등록 중 오류가 발생했습니다:\n' + error.message);
  }
}

// 매입처 상세 보기
async function viewSupplierDetail(supplierCode) {
  console.log('===== supplierTable > 상세 버튼 클릭 =====');

  try {
    const result = await apiCall(`/suppliers/${supplierCode}`);

    if (!result.success) {
      alert('매입처 정보를 불러올 수 없습니다.');
      return;
    }

    const data = result.data;

    // 상세 정보 HTML 생성
    const detailHtml = `
      <div style="grid-column: 1 / -1; padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <strong>매입처코드:</strong> ${data.매입처코드}
      </div>
      <div style="padding: 12px;">
        <strong>매입처명</strong><br/>
        ${data.매입처명 || '-'}
      </div>
      <div style="padding: 12px;">
        <strong>대표자명</strong><br/>
        ${data.대표자명 || '-'}
      </div>
      <div style="grid-column: 1 / -1;padding: 12px; background: #f8f9fa; margin-bottom: 8px;">
        <strong>사업자번호</strong><br/>
        ${data.사업자번호 || '-'}
      </div>
      <div style="padding: 12px;">
        <strong>업태</strong><br/>
        ${data.업태 || '-'}
      </div>
      <div style="padding: 12px;">
        <strong>업종</strong><br/>
        ${data.업종 || '-'}
      </div>
      <div style="grid-column: 1 / -1; padding: 12px;">
        <strong>전화번호</strong><br/>
        ${data.전화번호 || '-'}
      </div>
      <div style="grid-column: 1 / -1; padding: 12px;">
        <strong>팩스번호</strong><br/>
        ${data.팩스번호 || '-'}
      </div>
      <div style="grid-column: 1 / -1; padding: 12px;">
        <strong>주소</strong><br/>
        ${data.주소 || ''} ${data.번지 || ''}
      </div>
      <div style="padding: 12px;">
        <strong>은행</strong><br/>
        ${data.은행코드 || '-'}
      </div>
      <div style="padding: 12px;">
        <strong>계좌번호</strong><br/>
        ${data.계좌번호 || '-'}
      </div>
      <div style="grid-column: 1 / -1;padding: 12px;">
        <strong>담당자명</strong><br/>
        ${data.담당자명 || '-'}
      </div>
      <div style="grid-column: 1 / -1;padding: 12px;">
        <strong>거래상태</strong><br/>
        <span class="status-badge ${data.사용구분 === 0 ? 'status-active' : 'status-pending'}">
          ${data.사용구분 === 0 ? '정상거래' : '거래보류'}
        </span>
      </div>
      <div style="grid-column: 1 / -1; padding: 12px;">
        <strong>비고</strong><br/>
        ${data.비고란 || '-'}
      </div>
    `;

    document.getElementById('supplierDetailContent').innerHTML = detailHtml;
    document.getElementById('supplierDetailModal').style.display = 'flex';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.supplierDetailModalDraggable) {
      makeModalDraggable('supplierDetailModal', 'supplierDetailModalHeader');
      window.supplierDetailModalDraggable = true;
    }
  } catch (error) {
    console.error('매입처 상세 조회 오류:', error);
    alert('매입처 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

// 매입처 상세보기 모달 닫기
function closeSupplierDetailModal() {
  console.log('===== supplierDetailModal > 닫기 버튼 클릭 =====');
  document.getElementById('supplierDetailModal').style.display = 'none';
}

// 매입처 수정
async function editSupplier(supplierCode) {
  console.log('===== supplierTable > 수정 버튼 클릭 =====');

  try {
    // 1. API 호출로 매입처 정보 가져오기
    const result = await apiCall(`/suppliers/${supplierCode}`, 'GET');

    if (!result.success) {
      throw new Error(result.message || '매입처 정보를 불러올 수 없습니다.');
    }

    const supplier = result.data;

    // 2. 모달 열기
    const modal = document.getElementById('supplierModal');
    if (!modal) {
      throw new Error('모달을 찾을 수 없습니다.');
    }

    // 3. 폼 제목 변경
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
      modalTitle.textContent = '매입처 수정';
    }

    // 4. 폼 필드에 값 설정
    document.getElementById('supplierCode').value = supplier.매입처코드 || '';
    document.getElementById('supplierCode').readOnly = true; // 코드 수정 불가
    document.getElementById('supplierName').value = supplier.매입처명 || '';
    document.getElementById('supplierCeoName').value = supplier.대표자명 || '';
    document.getElementById('supplierBusinessNo').value = supplier.사업자번호 || '';
    document.getElementById('supplierBusinessType').value = supplier.업태 || '';
    document.getElementById('supplierBusinessCategory').value = supplier.업종 || '';
    document.getElementById('supplierPhone').value = supplier.전화번호 || '';
    document.getElementById('supplierFax').value = supplier.팩스번호 || '';
    document.getElementById('supplierZipCode').value = supplier.우편번호 || '';
    document.getElementById('supplierAddress').value = supplier.주소 || '';
    document.getElementById('supplierAddressDetail').value = supplier.번지 || '';
    document.getElementById('supplierBankCode').value = supplier.은행코드 || '';
    document.getElementById('supplierAccountNo').value = supplier.계좌번호 || '';
    document.getElementById('supplierManagerName').value = supplier.담당자명 || '';
    document.getElementById('supplierStatus').value = supplier.사용구분 || 0;
    document.getElementById('supplierRemark').value = supplier.비고란 || '';

    // 5. 폼 제출 이벤트 변경 (수정 모드)
    const form = document.getElementById('supplierForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await updateSupplier(supplierCode);
    };

    // 6. 모달 표시
    modal.style.display = 'flex';

    // 드래그 기능 활성화 (최초 1회만 실행)
    if (typeof makeModalDraggable === 'function' && !window.supplierModalDraggable) {
      makeModalDraggable('supplierModal', 'supplierModalHeader');
      window.supplierModalDraggable = true;
    }
  } catch (error) {
    console.error('매입처 수정 오류:', error);
    alert('매입처 수정 중 오류가 발생했습니다: ' + error.message);
  }
}

// 매입처 수정 API 호출
async function updateSupplier(supplierCode) {
  console.log('===== supplierModal > 저장 버튼 클릭 =====');

  try {
    const formData = {
      매입처명: document.getElementById('supplierName').value.trim(),
      대표자명: document.getElementById('supplierCeoName').value.trim() || '',
      사업자번호: document.getElementById('supplierBusinessNo').value.trim() || '',
      전화번호: document.getElementById('supplierPhone').value.trim() || '',
      팩스번호: document.getElementById('supplierFax').value.trim() || '',
      우편번호: document.getElementById('supplierZipCode').value.trim() || '',
      주소: document.getElementById('supplierAddress').value.trim() || '',
      번지: document.getElementById('supplierAddressDetail').value.trim() || '',
      업태: document.getElementById('supplierBusinessType').value.trim() || '',
      업종: document.getElementById('supplierBusinessCategory').value.trim() || '',
      은행코드: document.getElementById('supplierBankCode').value || '',
      계좌번호: document.getElementById('supplierAccountNo').value.trim() || '',
      담당자명: document.getElementById('supplierManagerName').value.trim() || '',
      사용구분: parseInt(document.getElementById('supplierStatus').value) || 0,
      비고란: document.getElementById('supplierRemark').value.trim() || '',
    };

    const result = await apiCall(`/suppliers/${supplierCode}`, 'PUT', formData);

    if (result.success) {
      alert('매입처가 수정되었습니다.');
      closeSupplierModal();

      // 폼 제출 이벤트 원래대로 복구
      document.getElementById('supplierForm').onsubmit = submitSupplier;

      // DataTable 새로고침
      $('#supplierTable').DataTable().ajax.reload(null, false);
    } else {
      alert('수정 실패: ' + result.message);
    }
  } catch (error) {
    console.error('매입처 수정 오류:', error);
    alert('매입처 수정 중 오류가 발생했습니다.');
  }
}

// 매입처 삭제 (모달 열기)
async function deleteSupplier(supplierCode) {
  console.log('===== supplierTable > 삭제 버튼 클릭 =====');

  try {
    // 1. API 호출로 매입처 정보 가져오기
    const result = await apiCall(`/suppliers/${supplierCode}`, 'GET');

    if (!result.success) {
      throw new Error(result.message || '매입처 정보를 불러올 수 없습니다.');
    }

    const supplier = result.data;

    // 2. 삭제할 매입처 정보를 모달에 표시
    const deleteContent = document.getElementById('supplierDeleteContent');
    deleteContent.innerHTML = `
      <div style="
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #dee2e6;
          ">
        <div style="margin-bottom: 12px;">
          <strong style="color: #495057;">매입처코드:</strong>
          <span style="margin-left: 8px; color: #212529;">${supplier.매입처코드}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #495057;">매입처명:</strong>
          <span style="margin-left: 8px; color: #212529;">${supplier.매입처명 || '-'}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #495057;">대표자명:</strong>
          <span style="margin-left: 8px; color: #212529;">${supplier.대표자명 || '-'}</span>
        </div>
        <div>
          <strong style="color: #495057;">사업자번호:</strong>
          <span style="margin-left: 8px; color: #212529;">${supplier.사업자번호 || '-'}</span>
        </div>
      </div>
    `;

    // 3. 삭제 확인 버튼에 매입처코드 저장
    window.currentDeleteSupplierCode = supplierCode;

    // 4. 모달 표시
    document.getElementById('supplierDeleteModal').style.display = 'flex';
  } catch (error) {
    console.error('매입처 삭제 모달 열기 오류:', error);
    alert('매입처 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
  }
}

// 매입처 삭제 모달 닫기
function closeSupplierDeleteModal() {
  console.log('===== supplierDeleteModal > 닫기 버튼 클릭 =====');

  document.getElementById('supplierDeleteModal').style.display = 'none';
  document.getElementById('supplierDeleteContent').innerHTML = '';
  window.currentDeleteSupplierCode = null;
}

// 매입처 삭제 확인
async function confirmDeleteSupplier() {
  console.log('===== supplierDeleteModal > 삭제하기 버튼 클릭 =====');

  const supplierCode = window.currentDeleteSupplierCode;

  if (!supplierCode) {
    alert('삭제할 매입처 정보가 없습니다.');
    return;
  }

  try {
    const result = await apiCall(`/suppliers/${supplierCode}`, 'DELETE');

    if (result.success) {
      alert('매입처가 삭제되었습니다.');
      closeSupplierDeleteModal();

      // DataTable 새로고침
      $('#supplierTable').DataTable().ajax.reload(null, false);
    } else {
      alert('삭제 실패: ' + result.message);
    }
  } catch (error) {
    console.error('매입처 삭제 오류:', error);
    alert('매입처 삭제 중 오류가 발생했습니다: ' + error.message);
  }
}
