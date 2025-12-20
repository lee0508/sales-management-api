// ========================================
// 이전단가 조회 기능 (거래명세서용)
// ========================================

let tempTransactionMaterial = null;
let tempTransactionEditMaterial = null;

// 이전단가 조회 모달 열기
function showTransactionPriceHistory(material) {
  try {
    const 매출처코드 = document.getElementById('transactionCreateCustomerCode').value;

    if (!매출처코드) {
      alert('먼저 매출처를 선택해주세요.');
      return;
    }

    // 임시로 자재 정보 저장
    tempTransactionMaterial = material;

    // 자재 정보 표시
    document.getElementById('transactionPriceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('transactionPriceHistoryMaterialCode').textContent =
      `[${material.자재코드}] ${material.규격 || ''}`;

    // 이전 거래 이력 로드
    loadTransactionPriceHistory(material.자재코드, 매출처코드);

    // 모달 표시
    document.getElementById('transactionPriceHistoryModal').style.display = 'block';

    console.log('✅ 이전단가 조회 모달 열기:', material.자재명);
  } catch (err) {
    console.error('❌ 이전단가 조회 모달 오류:', err);
    alert('이전단가 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

// 이전단가 조회 모달 닫기
function closeTransactionPriceHistoryModal() {
  document.getElementById('transactionPriceHistoryModal').style.display = 'none';
  tempTransactionMaterial = null;
}

// 이전 거래 이력 로드 (실제 출고가)
async function loadTransactionPriceHistory(materialCode, customerCode) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(materialCode)}/price-history/${encodeURIComponent(customerCode)}`
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이전 거래 이력을 불러올 수 없습니다.');
    }

    const history = result.data || [];
    const tbody = document.getElementById('transactionPriceHistoryTableBody');

    if (history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">
            이전 거래 이력이 없습니다
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = history
      .map(
        (item) => `
      <tr onclick="selectTransactionPriceFromHistory(${item.출고단가})" style="
        cursor: pointer;
        border-bottom: 1px solid #e5e7eb;
        transition: background 0.15s;
      " onmouseover="this.style.background='#f0f9ff';"
         onmouseout="this.style.background='white';">
        <td style="padding: 10px;">${item.입출고일자 ? item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'}</td>
        <td style="padding: 10px; text-align: right;">${(item.출고수량 || 0).toLocaleString()}</td>
        <td style="padding: 10px; text-align: right; font-weight: 600; color: #2563eb;">
          ${(item.출고단가 || 0).toLocaleString()}원
        </td>
        <td style="padding: 10px; text-align: right;">${(item.출고합계 || 0).toLocaleString()}원</td>
        <td style="padding: 10px; color: #6b7280; font-size: 12px;">${item.적요 || '-'}</td>
      </tr>
    `
      )
      .join('');

    console.log('✅ 이전 거래 이력 로드 완료:', history.length, '건');
  } catch (err) {
    console.error('❌ 이전 거래 이력 로드 오류:', err);

    const tbody = document.getElementById('transactionPriceHistoryTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 20px; text-align: center; color: #ef4444;">
          이력을 불러오는 중 오류가 발생했습니다
        </td>
      </tr>
    `;
  }
}

// 이전 단가 선택 (거래명세서 작성 - 자재 검색 모달에서 사용)
function selectTransactionPriceFromHistory(price) {
  if (!tempTransactionMaterial) {
    alert('자재 정보를 찾을 수 없습니다.');
    return;
  }

  const 수량 = prompt(`${tempTransactionMaterial.자재명}\n수량을 입력하세요:`, '1');

  if (!수량 || isNaN(수량) || parseFloat(수량) <= 0) {
    alert('유효한 수량을 입력해주세요.');
    return;
  }

  // 자재코드에서 분류코드(2자리)만 제거, 세부코드 표시
  const 세부코드 =
    tempTransactionMaterial.자재코드.length > 2
      ? tempTransactionMaterial.자재코드.substring(2)
      : tempTransactionMaterial.자재코드;

  // 상세내역 추가
  newTransactionDetails.push({
    자재코드: tempTransactionMaterial.자재코드,
    세부코드: 세부코드,
    자재명: tempTransactionMaterial.자재명,
    규격: tempTransactionMaterial.규격,
    수량: parseFloat(수량),
    단가: price,
  });

  renderNewTransactionDetailTable();
  closeTransactionPriceHistoryModal();
  closeTransactionMaterialSearchModal();

  console.log('✅ 이전단가로 자재 추가:', {
    자재명: tempTransactionMaterial.자재명,
    수량: parseFloat(수량),
    단가: price,
  });
}

// ========================================
// 이전단가 조회 기능 (거래명세서 수정용)
// ========================================

// 거래명세서 수정 - 이전단가 조회 모달 열기
function showTransactionEditPriceHistory(material) {
  try {
    // 거래명세서 수정 모달에서 매출처코드 가져오기
    const firstDetail = window.currentEditingTransaction?.details[0];
    const 매출처코드 = firstDetail?.매출처코드;

    if (!매출처코드) {
      alert('매출처 정보를 찾을 수 없습니다.');
      return;
    }

    // 임시로 자재 정보 저장
    tempTransactionEditMaterial = material;

    // 자재 정보 표시
    document.getElementById('transactionEditPriceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('transactionEditPriceHistoryMaterialCode').textContent =
      `[${material.자재코드}] ${material.규격 || ''}`;

    // 이전 거래 이력 로드
    loadTransactionEditPriceHistory(material.자재코드, 매출처코드);

    // 모달 표시
    document.getElementById('transactionEditPriceHistoryModal').style.display = 'block';

    console.log('✅ 거래명세서 수정 - 이전단가 조회 모달 열기:', material.자재명);
  } catch (err) {
    console.error('❌ 이전단가 조회 모달 오류:', err);
    alert('이전단가 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

// 거래명세서 수정 - 이전단가 조회 모달 닫기
function closeTransactionEditPriceHistoryModal() {
  document.getElementById('transactionEditPriceHistoryModal').style.display = 'none';
  tempTransactionEditMaterial = null;
}

// 거래명세서 수정 - 이전 거래 이력 로드
async function loadTransactionEditPriceHistory(materialCode, customerCode) {
  try {
    const response = await fetch(
      `/api/materials/${encodeURIComponent(materialCode)}/price-history/${encodeURIComponent(customerCode)}`
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '이전 거래 이력을 불러올 수 없습니다.');
    }

    const history = result.data || [];
    const tbody = document.getElementById('transactionEditPriceHistoryTableBody');

    if (history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">
            이전 거래 이력이 없습니다
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = history
      .map(
        (item) => `
      <tr onclick="selectTransactionEditPriceFromHistory(${item.출고단가})" style="
        cursor: pointer;
        border-bottom: 1px solid #e5e7eb;
        transition: background 0.15s;
      " onmouseover="this.style.background='#f0f9ff';"
         onmouseout="this.style.background='white';">
        <td style="padding: 10px;">${item.입출고일자 ? item.입출고일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'}</td>
        <td style="padding: 10px; text-align: right;">${(item.출고수량 || 0).toLocaleString()}</td>
        <td style="padding: 10px; text-align: right; font-weight: 600; color: #2563eb;">
          ${(item.출고단가 || 0).toLocaleString()}원
        </td>
        <td style="padding: 10px; text-align: right;">${(item.출고합계 || 0).toLocaleString()}원</td>
        <td style="padding: 10px; color: #6b7280; font-size: 12px;">${item.적요 || '-'}</td>
      </tr>
    `
      )
      .join('');

    console.log('✅ 거래명세서 수정 - 이전 거래 이력 로드 완료:', history.length, '건');
  } catch (err) {
    console.error('❌ 이전 거래 이력 로드 오류:', err);

    const tbody = document.getElementById('transactionEditPriceHistoryTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 20px; text-align: center; color: #ef4444;">
          이력을 불러오는 중 오류가 발생했습니다
        </td>
      </tr>
    `;
  }
}

// 거래명세서 수정 - 이전 단가 선택하여 자재 추가
function selectTransactionEditPriceFromHistory(price) {
  if (!tempTransactionEditMaterial) {
    alert('자재 정보를 찾을 수 없습니다.');
    return;
  }

  // 단가를 자재 추가 폼에 자동 입력
  document.getElementById('transactionAddDetailPrice').value = price;

  // 자재 정보를 선택된 자재로 설정
  window.selectedTransactionMaterial = tempTransactionEditMaterial;

  // 선택된 자재 정보 표시
  document.getElementById('transactionSelectedMaterialName').textContent = tempTransactionEditMaterial.자재명 || '-';
  document.getElementById('transactionSelectedMaterialCode').textContent = tempTransactionEditMaterial.자재코드 || '-';

  // 수량은 기본값 1 유지
  document.getElementById('transactionAddDetailQuantity').value = 1;

  // 공급가액 계산
  calculateTransactionDetailAmount();

  // 검색 결과 숨기고 선택된 자재 정보 표시
  document.getElementById('transactionMaterialSearchResults').style.display = 'none';
  document.getElementById('transactionSelectedMaterialInfo').style.display = 'block';

  // 이전단가 모달 닫기
  closeTransactionEditPriceHistoryModal();

  console.log('✅ 거래명세서 수정 - 이전단가로 자재 선택:', {
    자재명: tempTransactionEditMaterial.자재명,
    단가: price,
  });
}

// ========================================
// 이전단가 조회 기능 (거래명세서 작성 모달 - 버튼 클릭용)
// ========================================

// 거래명세서 작성 - 이전단가 버튼 클릭 (선택된 자재 필요)
function showNewTransactionPriceHistory() {
  // 선택된 자재가 있는지 확인
  if (!window.newSelectedTransactionMaterial) {
    alert('먼저 자재를 검색하여 선택해주세요.');
    return;
  }

  const material = window.newSelectedTransactionMaterial;
  const 매출처코드 = document.getElementById('transactionCreateCustomerCode').value;

  if (!매출처코드) {
    alert('먼저 매출처를 선택해주세요.');
    return;
  }

  try {
    // 임시로 자재 정보 저장
    tempTransactionMaterial = material;

    // 자재 정보 표시
    document.getElementById('transactionPriceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('transactionPriceHistoryMaterialCode').textContent =
      `[${material.자재코드}] ${material.규격 || ''}`;

    // 이전 거래 이력 로드
    loadTransactionPriceHistory(material.자재코드, 매출처코드);

    // 모달 표시
    document.getElementById('transactionPriceHistoryModal').style.display = 'block';

    console.log('✅ 거래명세서 작성 - 이전단가 조회 모달 열기:', material.자재명);
  } catch (err) {
    console.error('❌ 이전단가 조회 모달 오류:', err);
    alert('이전단가 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

// 이전 단가 선택 - 거래명세서 작성용
function selectNewTransactionPriceFromHistory(price) {
  if (!tempTransactionMaterial) {
    alert('자재 정보를 찾을 수 없습니다.');
    return;
  }

  // 단가를 자재 추가 폼에 자동 입력
  document.getElementById('newTransactionAddDetailPrice').value = price;

  // 공급가액 자동 계산
  calculateNewTransactionDetailAmount();

  // 이전단가 모달 닫기
  closeTransactionPriceHistoryModal();

  console.log('✅ 거래명세서 작성 - 이전단가 선택:', {
    자재명: tempTransactionMaterial.자재명,
    단가: price,
  });
}

// ========================================
// 이전단가 조회 기능 (거래명세서 수정 모달 - 버튼 클릭용)
// ========================================

// 거래명세서 수정 - 이전단가 버튼 클릭 (선택된 자재 필요)
function showTransactionEditPriceHistoryButton() {
  // 선택된 자재가 있는지 확인
  if (!window.selectedTransactionMaterial) {
    alert('먼저 자재를 검색하여 선택해주세요.');
    return;
  }

  const material = window.selectedTransactionMaterial;

  // 거래명세서 수정 모달에서 매출처코드 가져오기
  const firstDetail = window.currentEditingTransaction?.details[0];
  const 매출처코드 = firstDetail?.매출처코드;

  if (!매출처코드) {
    alert('매출처 정보를 찾을 수 없습니다.');
    return;
  }

  try {
    // 임시로 자재 정보 저장
    tempTransactionEditMaterial = material;

    // 자재 정보 표시
    document.getElementById('transactionEditPriceHistoryMaterialName').textContent = material.자재명;
    document.getElementById('transactionEditPriceHistoryMaterialCode').textContent =
      `[${material.자재코드}] ${material.규격 || ''}`;

    // 이전 거래 이력 로드
    loadTransactionEditPriceHistory(material.자재코드, 매출처코드);

    // 모달 표시
    document.getElementById('transactionEditPriceHistoryModal').style.display = 'block';

    console.log('✅ 거래명세서 수정 - 이전단가 버튼 클릭:', material.자재명);
  } catch (err) {
    console.error('❌ 이전단가 조회 모달 오류:', err);
    alert('이전단가 조회 중 오류가 발생했습니다: ' + err.message);
  }
}