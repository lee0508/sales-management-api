// ==========================================
// index.html 에러 수정사항
// ==========================================
// 이 코드를 index.html의 2114번 줄 (execDaumPostcode 함수 다음)에 추가하세요

// 매입처 신규등록 모달 열기
function openSupplierModal() {
    document.getElementById('supplierModal').style.display = 'flex';
    document.getElementById('supplierForm').reset();
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const randomNum = String(Math.floor(Math.random() * 10)).padStart(1, '0');
    const supplierCode = 'S' + year + month + date + randomNum;
    document.getElementById('supplierCode').value = supplierCode;
}

// 매입처 신규등록 모달 닫기
function closeSupplierModal() {
    document.getElementById('supplierModal').style.display = 'none';
}

// 모달 외부 클릭 시 닫기 (매입처)
document.getElementById('supplierModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeSupplierModal();
    }
});

// 매입처 등록 제출
async function submitSupplier(event) {
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

        console.log('전송 데이터:', formData);

        const result = await apiCall('/suppliers', 'POST', formData);

        if (result.success) {
            alert('매입처가 등록되었습니다.');
            closeSupplierModal();
            currentSupplierPage = 1;
            loadSuppliers(1);
        } else {
            alert('등록 실패: ' + result.message);
        }
    } catch (error) {
        console.error('매입처 등록 오류:', error);
        alert('매입처 등록 중 오류가 발생했습니다:\n' + error.message);
    }
}

// 다음 우편번호 검색 (매입처)
function execDaumPostcodeSupplier() {
    new daum.Postcode({
        oncomplete: function (data) {
            var addr = '';
            var extraAddr = '';

            if (data.userSelectedType === 'R') {
                addr = data.roadAddress;
            } else {
                addr = data.jibunAddress;
            }

            if (data.userSelectedType === 'R') {
                if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
                    extraAddr += data.bname;
                }
                if (data.buildingName !== '' && data.apartment === 'Y') {
                    extraAddr += extraAddr !== '' ? ', ' + data.buildingName : data.buildingName;
                }
                if (extraAddr !== '') {
                    extraAddr = ' (' + extraAddr + ')';
                }
                document.getElementById('supplierExtraAddress').value = extraAddr;
            } else {
                document.getElementById('supplierExtraAddress').value = '';
            }

            document.getElementById('supplierZipCode').value = data.zonecode;
            document.getElementById('supplierAddress').value = addr;
            document.getElementById('supplierAddressDetail').focus();
        },
    }).open();
}

// ==========================================
// 기타 수정사항 (find & replace 필요)
// ==========================================

/*
1. 1144번 줄 - 다음 3줄 삭제:
    if (event && event.target) {
        event.target.classList.add('active');
    }

2. 726번 줄 - 함수 정의 수정:
   변경 전: function toggleSelectAllCustomers() {
   변경 후: function toggleSelectAllCustomers(checkbox) {

   그리고 함수 내용을:
   const checkboxes = document.querySelectorAll('.customerCheckbox');
   checkboxes.forEach((cb) => (cb.checked = checkbox.checked));

3. 895번 줄 - 필드명 수정:
   변경 전: <td>${supplier.대표자 || '-'}</td>
   변경 후: <td>${supplier.대표자명 || '-'}</td>

4. colspan 수정 (여러 위치):
   263번 줄: <td colspan="10" class="loading">데이터를 불러오는 중...</td>
   315번 줄: <td colspan="10" class="loading">데이터를 불러오는 중...</td>

5. 8-13번 줄 - 중복 라이브러리 로드 제거 (8-9번 줄 또는 12-13번 줄 중 하나 삭제)
*/
