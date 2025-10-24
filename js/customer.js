/**
 * 매출처 모달 열기 (신규 등록)
 */
function openCustomerModal() {
  console.log('===== 매출처 신규 등록 모달 열기 =====');

  const modal = document.getElementById('customerModal');
  if (!modal) {
    console.error('❌ 모달을 찾을 수 없습니다.');
    return;
  }

  // 모달 제목 설정
  const modalTitle = modal.querySelector('h2');
  if (modalTitle) {
    modalTitle.textContent = '매출처 신규등록';
  }

  // 폼 초기화
  const form = document.getElementById('customerForm');
  form.reset();

  // 모드 설정 (신규 등록)
  form.removeAttribute('data-mode');
  form.removeAttribute('data-customer-code');

  // 모달 표시
  modal.style.display = 'flex';

  console.log('✅ 매출처 신규 등록 모달 열기 완료');
}

/**
 * 매출처 모달 닫기
 */
function closeCustomerModal() {
  console.log('===== 매출처 모달 닫기 =====');

  const modal = document.getElementById('customerModal');
  if (!modal) {
    console.error('❌ 모달을 찾을 수 없습니다.');
    return;
  }

  // 모달 숨기기
  modal.style.display = 'none';

  // 폼 초기화
  const form = document.getElementById('customerForm');
  form.reset();
  form.removeAttribute('data-mode');
  form.removeAttribute('data-customer-code');

  console.log('✅ 매출처 모달 닫기 완료');
}

// 모달 외부 클릭 시 닫기
document.addEventListener('DOMContentLoaded', function () {
  const customerModal = document.getElementById('customerModal');
  if (customerModal) {
    customerModal.addEventListener('click', function (e) {
      if (e.target === this) {
        closeCustomerModal();
      }
    });
    console.log('✅ 매출처 모달 이벤트 리스너 등록 완료');
  } else {
    console.error('❌ customerModal 요소를 찾을 수 없습니다!');
  }
});

// 매출처 등록 제출
// index.html의 submitCustomer 함수 - 업데이트 버전

/**
 * 매출처 등록/수정 폼 제출 처리 (수정된 버전)
 * @param {Event} event - 폼 제출 이벤트
 */
async function submitCustomer(event) {
  event.preventDefault();

  try {
    console.log('===== 매출처 등록/수정 시작 =====');

    const form = event.target;
    const mode = form.getAttribute('data-mode') || 'create'; // 'create' 또는 'edit'
    const customerCode = form.getAttribute('data-customer-code');

    console.log('모드:', mode);
    console.log('매출처코드:', customerCode);

    // 폼 데이터 수집
    const formData = {
      사업장코드: currentUser.사업장코드,
      매출처코드: document.getElementById('customerCode').value.trim() || null,
      매출처명: document.getElementById('customerName').value.trim(),
      대표자명: document.getElementById('ceoName').value.trim(),
      사업자번호: document.getElementById('businessNo').value.trim(),
      업태: document.getElementById('businessType').value.trim(),
      업종: document.getElementById('businessCategory').value.trim(),
      전화번호: document.getElementById('phone').value.trim(),
      팩스번호: document.getElementById('fax').value.trim(),
      우편번호: document.getElementById('zipCode').value.trim(),
      주소: document.getElementById('address').value.trim(),
      번지: document.getElementById('addressDetail').value.trim(),
      은행코드: document.getElementById('bankCode').value,
      계좌번호: document.getElementById('accountNo').value.trim(),
      담당자: document.getElementById('managerName').value.trim(),
      사용구분: parseInt(document.getElementById('status').value),
      비고: document.getElementById('remark').value.trim(),
      작성자: currentUser.사용자코드,
    };

    console.log('전송 데이터:', formData);

    // API 호출
    let result;
    if (mode === 'edit') {
      // 수정 모드
      result = await apiCall(`/customers/${customerCode}`, 'PUT', formData);
    } else {
      // 등록 모드
      result = await apiCall('/customers', 'POST', formData);
    }

    if (!result.success) {
      throw new Error(result.message || '처리에 실패했습니다.');
    }

    console.log('✅ 처리 성공:', result);

    // 성공 메시지
    alert(
      mode === 'edit'
        ? '매출처가 성공적으로 수정되었습니다.'
        : '매출처가 성공적으로 등록되었습니다.',
    );

    // 모달 닫기
    closeCustomerModal();

    // 목록 새로고침
    await loadCustomers(currentCustomerPage);

    console.log('✅ 매출처 목록 새로고침 완료');
  } catch (error) {
    console.error('❌ 매출처 등록/수정 오류:', error);
    alert('처리 중 오류가 발생했습니다: ' + error.message);
  }
}
