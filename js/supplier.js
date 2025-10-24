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
      currentSupplierPage = 1;
      console.log('매입처 목록 새로고침 시작...');
      loadSuppliers(1);
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
