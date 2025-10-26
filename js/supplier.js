// ✅ DataTables 초기화 (매입처관리)
$(document).ready(function () {
  let table;

  function loadSuppliers() {
    // 기존 인스턴스가 있으면 파괴 후 재생성
    if (table) table.destroy();

    // ✅ 공통 초기화 함수 사용 (dataTableInit.js)
    table = initDataTable('supplierTable', 'http://localhost:3000/api/suppliers', [
      {
        // 선택 체크박스
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return '<input type="checkbox" class="supplierCheckbox" data-code="' + row.매입처코드 + '" />';
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
        defaultContent: '-'
      },
      {
        // 사업자번호
        data: '사업자번호',
        defaultContent: '-'
      },
      {
        // 연락처
        data: '전화번호',
        defaultContent: '-'
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
            <div class="action-buttons" id="supplier-actions-${row.매입처코드}">
              <button class="btn-icon btn-view" onclick="viewSupplierDetail('${row.매입처코드}')">상세</button>
              <button class="btn-icon btn-edit" style="display: none;" onclick="editSupplier('${row.매입처코드}')">수정</button>
              <button class="btn-icon btn-delete" style="display: none;" onclick="deleteSupplier('${row.매입처코드}')">삭제</button>
            </div>
          `;
        },
      },
    ]);
  }

  // 최초 로드
  loadSuppliers();

  // 새로고침 버튼
  $('#btnReloadSupplier').on('click', () => table.ajax.reload(null, false));

  // 전체 선택 체크박스
  $(document).on('change', '#selectAllSuppliers', function () {
    const isChecked = $(this).prop('checked');
    $('.supplierCheckbox').prop('checked', isChecked).trigger('change');
  });

  // 개별 체크박스 변경 시
  $(document).on('change', '.supplierCheckbox', function () {
    // 전체 선택 체크박스 상태 업데이트
    const totalCheckboxes = $('.supplierCheckbox').length;
    const checkedCheckboxes = $('.supplierCheckbox:checked').length;
    $('#selectAllSuppliers').prop('checked', totalCheckboxes === checkedCheckboxes);

    // 현재 행의 버튼 표시/숨김 처리
    const supplierCode = $(this).data('code');
    const isChecked = $(this).prop('checked');
    const actionDiv = $('#supplier-actions-' + supplierCode);

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

// 매입처 신규등록 모달 열기
function openSupplierModal() {
  console.log('===== 매입처 신규등록 모달 열기 시작 =====');

  const modal = document.getElementById('supplierModal');
  console.log('매입처 모달 요소:', modal);

  if (!modal) {
    console.error('❌ 매입처 모달을 찾을 수 없습니다!');
    return;
  }

  modal.style.display = 'flex';
  console.log('✅ 모달 display 변경:', modal.style.display);

  const form = document.getElementById('supplierForm');
  console.log('매입처 폼 요소:', form);

  if (form) {
    form.reset();
    console.log('✅ 폼 초기화 완료');
  }

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const randomNum = String(Math.floor(Math.random() * 10)).padStart(1, '0');
  const supplierCode = 'S' + year + month + date + randomNum;

  console.log('생성된 매입처 코드:', supplierCode);

  const codeInput = document.getElementById('supplierCode');
  console.log('매입처 코드 입력 필드:', codeInput);

  if (codeInput) {
    codeInput.value = supplierCode;
    console.log('✅ 매입처 코드 설정 완료:', codeInput.value);
  } else {
    console.error('❌ 매입처 코드 입력 필드를 찾을 수 없습니다!');
  }

  console.log('===== 매입처 신규등록 모달 열기 완료 =====');
}

// 매입처 신규등록 모달 닫기
function closeSupplierModal() {
  console.log('===== 매입처 모달 닫기 =====');
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

    console.log('✅ 매입처 모달 닫기 완료');
  } else {
    console.error('❌ 매입처 모달을 찾을 수 없습니다!');
  }
}

// 모달 외부 클릭 시 닫기 (매입처)
document.addEventListener('DOMContentLoaded', function() {
  const supplierModal = document.getElementById('supplierModal');
  if (supplierModal) {
    supplierModal.addEventListener('click', function (e) {
      if (e.target === this) {
        closeSupplierModal();
      }
    });
    console.log('✅ 매입처 모달 이벤트 리스너 등록 완료');
  } else {
    console.error('❌ supplierModal 요소를 찾을 수 없습니다!');
  }
});

// 매입처 등록 제출
async function submitSupplier(event) {
  console.log('===== 매입처 등록 제출 시작 =====');
  event.preventDefault();

  try {
    const supplierCode = document.getElementById('supplierCode').value.trim();
    console.log('입력된 매입처코드:', supplierCode);

    if (!supplierCode) {
      console.warn('⚠️ 매입처코드가 비어있습니다.');
      alert('매입처코드가 비어있습니다.');
      return;
    }
    if (supplierCode.length > 8) {
      console.warn('⚠️ 매입처코드 길이 초과:', supplierCode.length);
      alert('매입처코드는 8자 이하여야 합니다.');
      return;
    }

    const supplierName = document.getElementById('supplierName').value.trim();
    console.log('입력된 매입처명:', supplierName);

    if (!supplierName) {
      console.warn('⚠️ 매입처명이 비어있습니다.');
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

    console.log('📤 전송할 데이터:', formData);
    console.log('API 호출 시작: POST /suppliers');

    const result = await apiCall('/suppliers', 'POST', formData);

    console.log('📥 API 응답:', result);

    if (result.success) {
      console.log('✅ 매입처 등록 성공!');
      alert('매입처가 등록되었습니다.');
      closeSupplierModal();
      console.log('매입처 목록 새로고침 시작...');
      // DataTable 새로고침
      $('#supplierTable').DataTable().ajax.reload(null, false);
    } else {
      console.error('❌ 매입처 등록 실패:', result.message);
      alert('등록 실패: ' + result.message);
    }
  } catch (error) {
    console.error('❌ 매입처 등록 오류:', error);
    console.error('오류 상세:', {
      message: error.message,
      stack: error.stack,
    });
    alert('매입처 등록 중 오류가 발생했습니다:\n' + error.message);
  }
  console.log('===== 매입처 등록 제출 완료 =====');
}

// 매입처 상세 보기
async function viewSupplierDetail(supplierCode) {
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
      <div style="padding: 12px;">
        <strong>사업자번호</strong><br/>
        ${data.사업자번호 || '-'}
      </div>
      <div style="padding: 12px;">
        <strong>전화번호</strong><br/>
        ${data.전화번호 || '-'}
      </div>
      <div style="padding: 12px;">
        <strong>팩스번호</strong><br/>
        ${data.팩스번호 || '-'}
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
      <div style="padding: 12px;">
        <strong>담당자명</strong><br/>
        ${data.담당자명 || '-'}
      </div>
      <div style="padding: 12px;">
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
  } catch (error) {
    console.error('매입처 상세 조회 오류:', error);
    alert('매입처 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

// 매입처 상세보기 모달 닫기
function closeSupplierDetailModal() {
  document.getElementById('supplierDetailModal').style.display = 'none';
}

// 매입처 수정
async function editSupplier(supplierCode) {
  try {
    console.log('===== 매입처 수정 모달 열기 =====');
    console.log('매입처코드:', supplierCode);

    // 1. API 호출로 매입처 정보 가져오기
    const result = await apiCall(`/suppliers/${supplierCode}`, 'GET');
    console.log('API 응답:', result);

    if (!result.success) {
      throw new Error(result.message || '매입처 정보를 불러올 수 없습니다.');
    }

    const supplier = result.data;
    console.log('조회된 매입처 정보:', supplier);

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

    console.log('✅ 매입처 수정 모달 열기 완료');
  } catch (error) {
    console.error('❌ 매입처 수정 오류:', error);
    alert('매입처 수정 중 오류가 발생했습니다: ' + error.message);
  }
}

// 매입처 수정 API 호출
async function updateSupplier(supplierCode) {
  try {
    console.log('===== 매입처 수정 제출 =====');

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

    console.log('전송할 데이터:', formData);

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
    console.error('❌ 매입처 수정 오류:', error);
    alert('매입처 수정 중 오류가 발생했습니다.');
  }
}

// 매입처 삭제 (모달 열기)
async function deleteSupplier(supplierCode) {
  try {
    console.log('===== 매입처 삭제 모달 열기 =====');
    console.log('매입처코드:', supplierCode);

    // 1. API 호출로 매입처 정보 가져오기
    const result = await apiCall(`/suppliers/${supplierCode}`, 'GET');

    if (!result.success) {
      throw new Error(result.message || '매입처 정보를 불러올 수 없습니다.');
    }

    const supplier = result.data;
    console.log('✅ 매입처 정보 로드 성공:', supplier);

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
    console.log('✅ 삭제 모달 표시 완료');
  } catch (error) {
    console.error('❌ 매입처 삭제 모달 열기 오류:', error);
    alert('매입처 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
  }
}

// 매입처 삭제 모달 닫기
function closeSupplierDeleteModal() {
  document.getElementById('supplierDeleteModal').style.display = 'none';
  document.getElementById('supplierDeleteContent').innerHTML = '';
  window.currentDeleteSupplierCode = null;
}

// 매입처 삭제 확인
async function confirmDeleteSupplier() {
  const supplierCode = window.currentDeleteSupplierCode;

  if (!supplierCode) {
    alert('삭제할 매입처 정보가 없습니다.');
    return;
  }

  try {
    console.log('===== 매입처 삭제 실행 =====');
    console.log('매입처코드:', supplierCode);

    const result = await apiCall(`/suppliers/${supplierCode}`, 'DELETE');

    if (result.success) {
      console.log('✅ 매입처 삭제 성공');
      alert('매입처가 삭제되었습니다.');
      closeSupplierDeleteModal();

      // DataTable 새로고침
      $('#supplierTable').DataTable().ajax.reload(null, false);
    } else {
      console.error('❌ 매입처 삭제 실패:', result.message);
      alert('삭제 실패: ' + result.message);
    }
  } catch (error) {
    console.error('❌ 매입처 삭제 오류:', error);
    alert('매입처 삭제 중 오류가 발생했습니다: ' + error.message);
  }
}
