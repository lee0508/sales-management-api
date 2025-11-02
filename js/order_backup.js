/**
 * 발주관리 페이지 - DataTable 구현
 * 견적관리(quotation.js)와 동일한 패턴 적용
 */

$(document).ready(function () {
  let table;

  // ✅ 오늘 날짜 자동 설정
  function setDefaultDates() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // 시작일: 한 달 전
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const startYyyy = monthAgo.getFullYear();
    const startMm = String(monthAgo.getMonth() + 1).padStart(2, '0');
    const startDd = String(monthAgo.getDate()).padStart(2, '0');
    const monthAgoStr = `${startYyyy}-${startMm}-${startDd}`;

    document.getElementById('orderStartDate').value = monthAgoStr;
    document.getElementById('orderEndDate').value = todayStr;

    console.log(`✅ 발주관리 날짜 자동 설정: ${monthAgoStr} ~ ${todayStr}`);
  }

  // 발주 목록 로드 (DataTable 초기화)
  function loadOrders() {
    // 이미 DataTable이 존재하면 파괴
    if (table) {
      table.destroy();
    }

    // 날짜 필터 값 가져오기
    const startDate = document.getElementById('orderStartDate').value.replace(/-/g, '');
    const endDate = document.getElementById('orderEndDate').value.replace(/-/g, '');
    const status = document.getElementById('orderStatusFilter').value;

    // API URL 구성
    let apiUrl = '/api/orders?';
    if (status) {
      apiUrl += `상태코드=${status}&`;
    }
    if (startDate && endDate) {
      apiUrl += `startDate=${startDate}&endDate=${endDate}&`;
    }

    table = initDataTable('orderTable', apiUrl, [
      {
        // 선택 체크박스
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return (
            '<input type="checkbox" class="orderCheckbox" data-date="' +
            row.발주일자 +
            '" data-no="' +
            row.발주번호 +
            '" />'
          );
        },
      },
      {
        // 순번 (자동 생성)
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row, meta) {
          return meta.row + 1;
        },
      },
      {
        // 발주번호
        data: '발주번호',
        className: 'text-center',
        render: function (data, type, row) {
          return `${row.발주일자}-${row.발주번호}`;
        },
      },
      {
        // 매입처명
        data: '매입처명',
        className: 'text-left',
        render: function (data, type, row) {
          return data || '-';
        },
      },
      {
        // 발주일자
        data: '발주일자',
        className: 'text-center',
        render: function (data, type, row) {
          if (!data) return '-';
          // YYYYMMDD -> YYYY-MM-DD 형식 변환
          return data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        },
      },
      {
        // 입고희망일자
        data: '입고희망일자',
        className: 'text-center',
        render: function (data, type, row) {
          if (!data) return '-';
          return data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        },
      },
      {
        // 제목
        data: '제목',
        className: 'text-left',
        render: function (data, type, row) {
          return data || '-';
        },
      },
      {
        // 담당자
        data: '사용자명',
        className: 'text-center',
        render: function (data, type, row) {
          return data || '-';
        },
      },
      {
        // 상태
        data: '상태코드',
        className: 'text-center',
        render: function (data, type, row) {
          // 상태코드: 0=발주대기, 1=발주완료, 2=입고완료
          let statusText = '대기';
          let statusClass = 'status-pending';

          if (data === 1) {
            statusText = '발주완료';
            statusClass = 'status-active';
          } else if (data === 2) {
            statusText = '입고완료';
            statusClass = 'status-completed';
          }

          return '<span class="status-badge ' + statusClass + '">' + statusText + '</span>';
        },
      },
      {
        // 관리 버튼
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          const orderKey = `${row.발주일자}_${row.발주번호}`;
          return `
            <div class="action-buttons" id="actions-${orderKey}">
              <button class="btn-icon btn-view" onclick="viewOrderDetail('${row.발주일자}', ${row.발주번호})" title="상세보기"
                      style="padding: 6px 12px; font-size: 13px; margin-right: 4px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                상세
              </button>
              <button class="btn-icon btn-edit" onclick="editOrder('${row.발주일자}', ${row.발주번호})" title="수정"
                      style="padding: 6px 12px; font-size: 13px; margin-right: 4px; background: #ffc107; color: #000; border: none; border-radius: 4px; cursor: pointer; display: none;">
                수정
              </button>
              <button class="btn-icon btn-delete" onclick="deleteOrder('${row.발주일자}', ${row.발주번호})" title="삭제"
                      style="padding: 6px 12px; font-size: 13px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">
                삭제
              </button>
            </div>
          `;
        },
      },
    ]);

    // 체크박스 전체 선택/해제
    $('#selectAllOrders')
      .off('change')
      .on('change', function () {
        const isChecked = $(this).prop('checked');
        $('.orderCheckbox').prop('checked', isChecked).trigger('change');
      });

    // 개별 체크박스 이벤트 (견적관리와 동일한 패턴)
    $(document).on('change', '.orderCheckbox', function () {
      const orderDate = $(this).data('date');
      const orderNo = $(this).data('no');
      const isChecked = $(this).prop('checked');
      const actionDiv = $(`#actions-${orderDate}_${orderNo}`);

      if (isChecked) {
        // 체크박스 선택 시: 상세 버튼 숨김, 수정/삭제 버튼 표시
        actionDiv.find('.btn-view').hide();
        actionDiv.find('.btn-edit').show();
        actionDiv.find('.btn-delete').show();
      } else {
        // 체크박스 해제 시: 상세 버튼 표시, 수정/삭제 버튼 숨김
        actionDiv.find('.btn-view').show();
        actionDiv.find('.btn-edit').hide();
        actionDiv.find('.btn-delete').hide();
      }
    });

    // 총 발주 수 업데이트
    table.on('draw', function () {
      const info = table.page.info();
      $('#orderCount').text(info.recordsDisplay);
    });
  }

  // 페이지 로드 시 실행
  setDefaultDates(); // 날짜 자동 설정
  loadOrders(); // 데이터 로드

  // 닫기 버튼 이벤트 핸들러
  $('#closeOrderDetailModal').off('click').on('click', closeOrderDetailModal);
  $('#closeOrderModal').off('click').on('click', closeOrderModal);

  // 전역으로 접근 가능하도록 window에 등록
  window.loadOrders = loadOrders;
});

/**
 * 발주 상세보기
 */
async function viewOrderDetail(orderDate, orderNo) {
  try {
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`);

    if (!result.success) {
      alert('발주 정보를 불러올 수 없습니다.');
      return;
    }

    const master = result.data.master;
    const details = result.data.detail || [];

    // 마스터 정보 HTML
    const masterHtml = `
      <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #374151;">기본 정보</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">발주일자</span>
            <span style="color: #1f2937;">${
              master.발주일자 ? master.발주일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'
            }</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">발주번호</span>
            <span style="color: #1f2937;">${master.발주번호 || '-'}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">매입처명</span>
            <span style="color: #1f2937;">${master.매입처명 || '-'}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">사업자번호</span>
            <span style="color: #1f2937;">${master.사업자번호 || '-'}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">입고희망일자</span>
            <span style="color: #1f2937;">${
              master.입고희망일자
                ? master.입고희망일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
                : '-'
            }</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">결제방법</span>
            <span style="color: #1f2937;">${master.결제방법 || '-'}</span>
          </div>
          <div style="grid-column: 1 / -1; display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">제목</span>
            <span style="color: #1f2937;">${master.제목 || '-'}</span>
          </div>
          <div style="grid-column: 1 / -1; display: flex; align-items: flex-start;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">적요</span>
            <span style="color: #1f2937; white-space: pre-wrap;">${master.적요 || '-'}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="font-weight: 500; color: #6b7280; min-width: 120px;">상태</span>
            ${getOrderStatusText(master.상태코드)}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">발주 품목</h3>
        <div style="overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse; background: white;">
            <thead style="background: #f9fafb;">
              <tr>
                <th style="padding: 12px; border-bottom: 2px solid #e5e7eb; text-align: center;">순번</th>
                <th style="padding: 12px; border-bottom: 2px solid #e5e7eb; text-align: left;">자재명</th>
                <th style="padding: 12px; border-bottom: 2px solid #e5e7eb; text-align: center;">규격</th>
                <th style="padding: 12px; border-bottom: 2px solid #e5e7eb; text-align: center;">단위</th>
                <th style="padding: 12px; border-bottom: 2px solid #e5e7eb; text-align: right;">발주량</th>
                <th style="padding: 12px; border-bottom: 2px solid #e5e7eb; text-align: right;">입고단가</th>
                <th style="padding: 12px; border-bottom: 2px solid #e5e7eb; text-align: right;">출고단가</th>
              </tr>
            </thead>
            <tbody>
              ${
                details.length > 0
                  ? details
                      .map(
                        (item, idx) => `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${
                    idx + 1
                  }</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${
                    item.자재명 || '-'
                  }</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${
                    item.규격 || '-'
                  }</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${
                    item.단위 || '-'
                  }</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(
                    item.발주량 || 0
                  ).toLocaleString()}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(
                    item.입고단가 || 0
                  ).toLocaleString()}원</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(
                    item.출고단가 || 0
                  ).toLocaleString()}원</td>
                </tr>
              `,
                      )
                      .join('')
                  : `
                <tr>
                  <td colspan="7" style="padding: 40px; text-align: center; color: #9ca3af;">
                    발주 품목이 없습니다
                  </td>
                </tr>
              `
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 2px solid #e5e7eb;">
        <button onclick="closeOrderDetailModal()" style="
          padding: 12px 24px;
          background: #f3f4f6;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          color: #374151;
          transition: all 0.2s;
        " onmouseover="this.style.background='#e5e7eb';"
           onmouseout="this.style.background='#f3f4f6';">
          닫기
        </button>
      </div>
    `;

    document.getElementById('orderDetailContent').innerHTML = masterHtml;
    document.getElementById('orderDetailModal').style.display = 'flex';
    document.getElementById('orderDetailModal').classList.remove('hidden');
  } catch (error) {
    console.error('발주 상세 조회 오류:', error);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 상세 모달 닫기
 */
function closeOrderDetailModal() {
  document.getElementById('orderDetailModal').style.display = 'none';
  document.getElementById('orderDetailModal').classList.add('hidden');
}

/**
 * 상태코드를 텍스트로 변환
 */
function getOrderStatusText(statusCode) {
  switch (statusCode) {
    case 0:
      return '<span class="status-badge status-pending">발주대기</span>';
    case 1:
      return '<span class="status-badge status-active">발주완료</span>';
    case 2:
      return '<span class="status-badge status-completed">입고완료</span>';
    default:
      return '-';
  }
}

/**
 * 발주 신규 등록 모달 열기
 */
async function openOrderModal() {
  try {
    // 모달 제목 변경
    document.getElementById('orderModalTitle').textContent = '발주서 작성';

    // 폼 초기화
    document.getElementById('orderForm').reset();

    // 사업장 목록 로드
    await loadWorkplacesForOrder();

    // 매입처 목록 로드
    await loadSuppliersForOrder();

    // 오늘 날짜 자동 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;

    // 품목 테이블 초기화
    document.getElementById('orderDetailTableBody').innerHTML = `
      <tr id="orderDetailEmptyRow">
        <td colspan="8" style="padding: 40px; text-align: center; color: #9ca3af;">
          발주 품목을 추가해주세요
        </td>
      </tr>
    `;

    // 폼 제출 이벤트
    document.getElementById('orderForm').onsubmit = async (e) => {
      e.preventDefault();
      await saveOrder();
    };

    // 모달 표시
    document.getElementById('orderModal').style.display = 'flex';
    document.getElementById('orderModal').classList.remove('hidden');
  } catch (error) {
    console.error('❌ 발주 모달 열기 오류:', error);
    alert('발주 모달을 여는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 모달 닫기
 */
function closeOrderModal() {
  document.getElementById('orderModal').style.display = 'none';
  document.getElementById('orderModal').classList.add('hidden');
  document.getElementById('orderForm').reset();
}

/**
 * 사업장 목록 로드 (발주용)
 */
async function loadWorkplacesForOrder() {
  try {
    const result = await apiCall('/workplaces');
    const select = document.getElementById('orderWorkplace');
    select.innerHTML = '<option value="">사업장 선택</option>';

    if (result.success && result.data) {
      result.data.forEach((workplace) => {
        const option = document.createElement('option');
        option.value = workplace.사업장코드;
        option.textContent = `${workplace.사업장코드} - ${workplace.사업장명 || ''}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('사업장 목록 로드 오류:', error);
  }
}

/**
 * 매입처 목록 로드 (발주용)
 */
async function loadSuppliersForOrder() {
  try {
    const result = await apiCall('/suppliers');
    const select = document.getElementById('orderSupplier');
    select.innerHTML = '<option value="">매입처 선택</option>';

    if (result.success && result.data) {
      result.data.forEach((supplier) => {
        const option = document.createElement('option');
        option.value = supplier.매입처코드;
        option.textContent = `${supplier.매입처명 || ''} (${supplier.매입처코드})`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('매입처 목록 로드 오류:', error);
  }
}

/**
 * 발주 품목 행 추가
 */
function addOrderDetailRow() {
  const tbody = document.getElementById('orderDetailTableBody');

  // 빈 행 제거
  const emptyRow = document.getElementById('orderDetailEmptyRow');
  if (emptyRow) {
    emptyRow.remove();
  }

  const rowIndex = tbody.querySelectorAll('tr').length + 1;

  const row = document.createElement('tr');
  row.innerHTML = `
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${rowIndex}</td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <select class="form-control materialSelect" style="width: 100%;" onchange="onMaterialSelected(this)">
        <option value="">자재 선택</option>
      </select>
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
      <input type="text" class="form-control materialSpec" readonly style="width: 100%;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
      <input type="text" class="form-control materialUnit" readonly style="width: 100%;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <input type="number" class="form-control orderQty" value="0" min="0" style="width: 100%; text-align: right;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <input type="number" class="form-control incomingPrice" value="0" min="0" style="width: 100%; text-align: right;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb;">
      <input type="number" class="form-control outgoingPrice" value="0" min="0" style="width: 100%; text-align: right;" />
    </td>
    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
      <button type="button" onclick="removeOrderDetailRow(this)" style="
        padding: 4px 8px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      ">삭제</button>
    </td>
  `;

  tbody.appendChild(row);

  // 자재 목록 로드
  loadMaterialsForRow(row.querySelector('.materialSelect'));
}

/**
 * 발주 품목 행 삭제
 */
function removeOrderDetailRow(button) {
  const row = button.closest('tr');
  const tbody = document.getElementById('orderDetailTableBody');
  row.remove();

  // 순번 재정렬
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((r, idx) => {
    const firstCell = r.querySelector('td:first-child');
    if (firstCell && !r.id) {
      firstCell.textContent = idx + 1;
    }
  });

  // 모든 행이 삭제되면 빈 행 표시
  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr id="orderDetailEmptyRow">
        <td colspan="8" style="padding: 40px; text-align: center; color: #9ca3af;">
          발주 품목을 추가해주세요
        </td>
      </tr>
    `;
  }
}

/**
 * 자재 목록 로드 (품목 행용)
 */
async function loadMaterialsForRow(selectElement) {
  try {
    const result = await apiCall('/materials');
    selectElement.innerHTML = '<option value="">자재 선택</option>';

    if (result.success && result.data) {
      result.data.forEach((material) => {
        const option = document.createElement('option');
        const materialCode = material.분류코드 + material.세부코드;
        option.value = materialCode;
        option.textContent = `${material.자재명 || ''} (${materialCode})`;
        option.dataset.spec = material.규격 || '';
        option.dataset.unit = material.단위 || '';
        selectElement.appendChild(option);
      });
    }
  } catch (error) {
    console.error('자재 목록 로드 오류:', error);
  }
}

/**
 * 자재 선택 시 규격/단위 자동 입력
 */
function onMaterialSelected(selectElement) {
  const row = selectElement.closest('tr');
  const selectedOption = selectElement.options[selectElement.selectedIndex];

  if (selectedOption && selectedOption.value) {
    row.querySelector('.materialSpec').value = selectedOption.dataset.spec || '';
    row.querySelector('.materialUnit').value = selectedOption.dataset.unit || '';
  } else {
    row.querySelector('.materialSpec').value = '';
    row.querySelector('.materialUnit').value = '';
  }
}

/**
 * 발주 저장
 */
async function saveOrder() {
  try {
    // 마스터 데이터 수집
    const orderData = {
      사업장코드: document.getElementById('orderWorkplace').value,
      매입처코드: document.getElementById('orderSupplier').value,
      발주일자: document.getElementById('orderDate').value.replace(/-/g, ''), // YYYYMMDD
      입고희망일자: document.getElementById('orderDeliveryDate').value.replace(/-/g, '') || null,
      결제방법: document.getElementById('orderPaymentMethod').value || null,
      제목: document.getElementById('orderTitle').value,
      적요: document.getElementById('orderRemarks').value || null,
      상태코드: parseInt(document.getElementById('orderStatus').value),
    };

    // 품목 데이터 수집
    const detailRows = document.querySelectorAll(
      '#orderDetailTableBody tr:not(#orderDetailEmptyRow)',
    );
    const details = [];

    detailRows.forEach((row) => {
      const materialSelect = row.querySelector('.materialSelect');
      const orderQty = row.querySelector('.orderQty');
      const incomingPrice = row.querySelector('.incomingPrice');
      const outgoingPrice = row.querySelector('.outgoingPrice');

      if (materialSelect.value) {
        details.push({
          자재코드: materialSelect.value,
          발주량: parseFloat(orderQty.value) || 0,
          입고단가: parseFloat(incomingPrice.value) || 0,
          출고단가: parseFloat(outgoingPrice.value) || 0,
        });
      }
    });

    // 유효성 검사
    if (!orderData.사업장코드) {
      alert('사업장을 선택해주세요.');
      return;
    }
    if (!orderData.매입처코드) {
      alert('매입처를 선택해주세요.');
      return;
    }
    if (!orderData.발주일자) {
      alert('발주일자를 입력해주세요.');
      return;
    }
    if (!orderData.제목) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (details.length === 0) {
      alert('발주 품목을 1개 이상 추가해주세요.');
      return;
    }

    // 서버로 전송
    const requestData = {
      master: orderData,
      details: details,
    };

    const result = await apiCall('/orders', 'POST', requestData);

    if (result.success) {
      alert('발주가 저장되었습니다.');
      closeOrderModal();
      $('#orderTable').DataTable().ajax.reload(null, false);
    } else {
      alert(result.message || '발주 저장에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 발주 저장 오류:', error);
    alert('발주 저장 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 수정 - 모달 열기 (발주내역 포함)
 */
async function editOrder(orderDate, orderNo) {
  console.log(`✅ 발주 수정: ${orderDate}-${orderNo}`);

  try {
    // 현재 발주 정보 조회 (마스터 + 상세)
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`);

    if (!result.success || !result.data) {
      throw new Error('발주 정보를 찾을 수 없습니다.');
    }

    const master = result.data.master;
    const details = result.data.detail || [];

    // 기본 정보 표시 (읽기 전용)
    document.getElementById('editOrderNo').textContent = `${orderDate}-${orderNo}`;
    document.getElementById('editOrderDate').textContent = orderDate.replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    document.getElementById('editSupplierName').textContent = master.매입처명 || '-';

    // 입고희망일자 (YYYYMMDD -> YYYY-MM-DD)
    const deliveryDate = master.입고희망일자 || '';
    if (deliveryDate && deliveryDate.length === 8) {
      document.getElementById('editOrderDeliveryDate').value = `${deliveryDate.substring(
        0,
        4,
      )}-${deliveryDate.substring(4, 6)}-${deliveryDate.substring(6, 8)}`;
    } else {
      document.getElementById('editOrderDeliveryDate').value = '';
    }

    document.getElementById('editOrderPaymentMethod').value = master.결제방법 || '';
    document.getElementById('editOrderStatus').value = master.상태코드 || 0;
    document.getElementById('editOrderTitle').value = master.제목 || '';
    document.getElementById('editOrderRemark').value = master.적요 || '';

    // 모달에 발주일자, 번호 저장 (submit 시 사용)
    const modal = document.getElementById('orderEditModal');
    modal.dataset.orderDate = orderDate;
    modal.dataset.orderNo = orderNo;
    modal.dataset.매입처코드 = master.매입처코드;
    modal.dataset.사업장코드 = master.사업장코드;

    // ✅ 발주내역 DataTable 초기화
    if (window.orderEditDetailDataTable) {
      window.orderEditDetailDataTable.destroy();
    }

    window.orderEditDetailDataTable = $('#orderEditDetailTable').DataTable({
      data: details,
      columns: [
        {
          // 체크박스
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function () {
            return '<input type="checkbox" class="editOrderDetailCheckbox" />';
          },
        },
        {
          // 순번
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function (data, type, row, meta) {
            return meta.row + 1;
          },
        },
        {
          data: '자재코드',
          defaultContent: '-',
        },
        {
          data: '자재명',
          defaultContent: '-',
        },
        {
          data: '규격',
          defaultContent: '-',
        },
        {
          data: '발주량',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          data: '입고단가',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          data: '출고단가',
          defaultContent: 0,
          render: function (data) {
            return (data || 0).toLocaleString();
          },
          className: 'dt-right',
        },
        {
          // 관리 버튼
          data: null,
          orderable: false,
          className: 'dt-center',
          render: function (data, type, row, meta) {
            return `
              <button class="btn-icon" onclick="editOrderDetailRow(${meta.row})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">수정</button>
              <button class="btn-icon" onclick="deleteOrderDetailRow(${meta.row})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
            `;
          },
        },
      ],
      language: {
        lengthMenu: '페이지당 _MENU_ 개씩 보기',
        zeroRecords: '발주 품목이 없습니다',
        info: '전체 _TOTAL_개 중 _START_-_END_개 표시',
        infoEmpty: '데이터 없음',
        infoFiltered: '(전체 _MAX_개 중 검색결과)',
        search: '검색:',
        paginate: {
          first: '처음',
          last: '마지막',
          next: '다음',
          previous: '이전',
        },
      },
      order: [[1, 'asc']], // 순번 오름차순
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      responsive: true,
      autoWidth: false,
      searching: true,
      paging: true,
      info: true,
    });

    console.log(`✅ 발주 수정 DataTable 초기화 완료 (${details.length}건)`);

    // ✅ 전체 선택 체크박스 이벤트
    $('#selectAllEditOrderDetails')
      .off('change')
      .on('change', function () {
        const isChecked = $(this).prop('checked');
        $('.editOrderDetailCheckbox').prop('checked', isChecked);
      });

    // 닫기 버튼 이벤트
    $('#closeOrderEditModalBtn').off('click').on('click', closeOrderEditModal);

    // 모달 표시
    modal.style.display = 'block';
  } catch (err) {
    console.error('❌ 발주 수정 모달 열기 오류:', err);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 발주 수정 모달 닫기
 */
function closeOrderEditModal() {
  const modal = document.getElementById('orderEditModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // DataTable 정리
  if (window.orderEditDetailDataTable) {
    window.orderEditDetailDataTable.destroy();
    window.orderEditDetailDataTable = null;
    $('#orderEditDetailTable tbody').empty();
  }
}

/**
 * 발주 품목 수정 (행 단위)
 */
function editOrderDetailRow(rowIndex) {
  try {
    const table = window.orderEditDetailDataTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 현재 행 데이터 가져오기
    const rowData = table.row(rowIndex).data();
    if (!rowData) {
      alert('행 데이터를 찾을 수 없습니다.');
      return;
    }

    // 모달에 데이터 설정
    document.getElementById('editOrderDetailMaterialName').value = rowData.자재명 || '';
    document.getElementById('editOrderDetailQuantity').value = rowData.발주량 || 0;
    document.getElementById('editOrderDetailInPrice').value = rowData.입고단가 || 0;
    document.getElementById('editOrderDetailOutPrice').value = rowData.출고단가 || 0;

    // 현재 수정 중인 행 인덱스 저장
    window.currentEditOrderDetailRowIndex = rowIndex;

    // 모달 열기
    document.getElementById('orderDetailEditModal').style.display = 'block';

    // 닫기 버튼 이벤트
    $('#closeOrderDetailEditModal').off('click').on('click', closeOrderDetailEditModal);
  } catch (error) {
    console.error('❌ 품목 수정 모달 열기 오류:', error);
    alert('품목 수정 모달을 여는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 품목 수정 모달 닫기
 */
function closeOrderDetailEditModal() {
  document.getElementById('orderDetailEditModal').style.display = 'none';
  window.currentEditOrderDetailRowIndex = null;
}

/**
 * 발주 품목 수정 확인
 */
function confirmEditOrderDetail() {
  try {
    const rowIndex = window.currentEditOrderDetailRowIndex;
    if (rowIndex === null || rowIndex === undefined) {
      alert('수정할 행을 찾을 수 없습니다.');
      return;
    }

    const table = window.orderEditDetailDataTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 수정된 데이터 가져오기
    const 발주량 = parseFloat(document.getElementById('editOrderDetailQuantity').value) || 0;
    const 입고단가 = parseFloat(document.getElementById('editOrderDetailInPrice').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('editOrderDetailOutPrice').value) || 0;

    // 기존 행 데이터 가져오기
    const rowData = table.row(rowIndex).data();

    // 데이터 업데이트
    rowData.발주량 = 발주량;
    rowData.입고단가 = 입고단가;
    rowData.출고단가 = 출고단가;

    // 테이블에 반영
    table.row(rowIndex).data(rowData).draw(false);

    console.log('✅ 품목 수정 완료:', rowData);

    closeOrderDetailEditModal();
  } catch (error) {
    console.error('❌ 품목 수정 오류:', error);
    alert('품목 수정 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 품목 삭제 (행 단위)
 */
function deleteOrderDetailRow(rowIndex) {
  if (!confirm('이 품목을 삭제하시겠습니까?')) {
    return;
  }

  const table = window.orderEditDetailDataTable;
  if (table) {
    table.row(rowIndex).remove().draw();
  }
}

/**
 * 선택된 발주 품목 삭제
 */
function deleteSelectedOrderDetails() {
  const table = window.orderEditDetailDataTable;
  if (!table) return;

  const selectedRows = [];
  $('.editOrderDetailCheckbox:checked').each(function () {
    const row = $(this).closest('tr');
    selectedRows.push(table.row(row));
  });

  if (selectedRows.length === 0) {
    alert('삭제할 품목을 선택해주세요.');
    return;
  }

  if (!confirm(`선택한 ${selectedRows.length}개 품목을 삭제하시겠습니까?`)) {
    return;
  }

  selectedRows.forEach((row) => row.remove());
  table.draw();
}

/**
 * 발주 품목 추가 (수정 모달 내) - 모달 열기
 */
function addOrderDetailRowInEdit() {
  // 초기화
  window.selectedOrderMaterial = null;
  document.getElementById('orderMaterialSearchInput').value = '';
  document.getElementById('orderMaterialSearchResults').style.display = 'none';
  document.getElementById('selectedOrderMaterialInfo').style.display = 'none';
  document.getElementById('addOrderDetailQuantity').value = '1';
  document.getElementById('addOrderDetailInPrice').value = '0';
  document.getElementById('addOrderDetailOutPrice').value = '0';

  // 모달 표시
  document.getElementById('orderDetailAddModal').style.display = 'block';

  // 닫기 버튼 이벤트
  $('#closeOrderDetailAddModal').off('click').on('click', closeOrderDetailAddModal);
}

/**
 * 발주 품목 추가 모달 닫기
 */
function closeOrderDetailAddModal() {
  document.getElementById('orderDetailAddModal').style.display = 'none';
}

/**
 * 자재 검색
 */
async function searchOrderMaterials() {
  try {
    const searchKeyword = document.getElementById('orderMaterialSearchInput').value.trim();

    if (!searchKeyword) {
      alert('검색어를 입력해주세요.');
      return;
    }

    // 자재 검색 API 호출
    const result = await apiCall(`/materials?search=${encodeURIComponent(searchKeyword)}`);

    if (!result.success || !result.data) {
      alert('자재 검색에 실패했습니다.');
      return;
    }

    const materials = result.data;

    if (materials.length === 0) {
      alert('검색 결과가 없습니다.');
      return;
    }

    // 검색 결과 테이블에 표시
    const tbody = document.getElementById('orderMaterialSearchTableBody');
    tbody.innerHTML = '';

    materials.forEach((material) => {
      const row = document.createElement('tr');
      row.style.cursor = 'pointer';
      row.style.transition = 'background 0.2s';
      row.onmouseover = () => (row.style.background = '#f3f4f6');
      row.onmouseout = () => (row.style.background = 'white');
      row.onclick = () => selectOrderMaterial(material);

      row.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
          material.자재코드 || '-'
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
          material.자재명 || '-'
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${
          material.규격 || '-'
        }</td>
      `;

      tbody.appendChild(row);
    });

    // 검색 결과 영역 표시
    document.getElementById('orderMaterialSearchResults').style.display = 'block';
  } catch (error) {
    console.error('❌ 자재 검색 오류:', error);
    alert('자재 검색 중 오류가 발생했습니다.');
  }
}

/**
 * 자재 선택
 */
function selectOrderMaterial(material) {
  window.selectedOrderMaterial = material;

  // 선택된 자재 정보 표시
  document.getElementById('selectedOrderMaterialName').textContent = material.자재명 || '-';
  document.getElementById('selectedOrderMaterialCode').textContent = `품목코드: ${
    material.자재코드 || '-'
  }`;
  document.getElementById('selectedOrderMaterialInfo').style.display = 'block';

  // 검색 결과 숨김
  document.getElementById('orderMaterialSearchResults').style.display = 'none';

  console.log('✅ 자재 선택:', material);
}

/**
 * 선택된 자재 취소
 */
function clearSelectedOrderMaterial() {
  window.selectedOrderMaterial = null;
  document.getElementById('selectedOrderMaterialInfo').style.display = 'none';
}

/**
 * 발주 품목 추가 확인
 */
function confirmAddOrderDetail() {
  try {
    if (!window.selectedOrderMaterial) {
      alert('자재를 선택해주세요.');
      return;
    }

    const 발주량 = parseFloat(document.getElementById('addOrderDetailQuantity').value) || 0;
    const 입고단가 = parseFloat(document.getElementById('addOrderDetailInPrice').value) || 0;
    const 출고단가 = parseFloat(document.getElementById('addOrderDetailOutPrice').value) || 0;

    if (발주량 <= 0) {
      alert('발주량을 입력해주세요.');
      return;
    }

    const table = window.orderEditDetailDataTable;
    if (!table) {
      alert('DataTable을 찾을 수 없습니다.');
      return;
    }

    // 새 행 데이터 생성
    const newRow = {
      자재코드: window.selectedOrderMaterial.자재코드,
      자재명: window.selectedOrderMaterial.자재명,
      규격: window.selectedOrderMaterial.규격,
      발주량: 발주량,
      입고단가: 입고단가,
      출고단가: 출고단가,
    };

    // DataTable에 추가
    table.row.add(newRow).draw();

    console.log('✅ 품목 추가 완료:', newRow);

    // 모달 닫기
    closeOrderDetailAddModal();
  } catch (error) {
    console.error('❌ 품목 추가 오류:', error);
    alert('품목 추가 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 수정 완료
 */
async function submitOrderEdit() {
  try {
    const modal = document.getElementById('orderEditModal');
    const orderDate = modal.dataset.orderDate;
    const orderNo = modal.dataset.orderNo;

    // 수정된 마스터 데이터 수집
    const 입고희망일자 = document.getElementById('editOrderDeliveryDate').value.replace(/-/g, '');
    const 결제방법 = document.getElementById('editOrderPaymentMethod').value;
    const 상태코드 = parseInt(document.getElementById('editOrderStatus').value);
    const 제목 = document.getElementById('editOrderTitle').value;
    const 적요 = document.getElementById('editOrderRemark').value;

    // 유효성 검사
    if (!제목) {
      alert('제목을 입력해주세요.');
      return;
    }

    // 품목 데이터 수집 (DataTable에서)
    const table = window.orderEditDetailDataTable;
    const details = [];

    if (table) {
      const tableData = table.rows().data();
      tableData.each(function (row) {
        details.push({
          자재코드: row.자재코드,
          발주량: parseFloat(row.발주량) || 0,
          입고단가: parseFloat(row.입고단가) || 0,
          출고단가: parseFloat(row.출고단가) || 0,
        });
      });
    }

    console.log('✅ 수정할 데이터:', {
      마스터: { 입고희망일자, 결제방법, 제목, 적요, 상태코드 },
      품목수: details.length,
    });

    // 서버로 전송 (마스터만 수정)
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`, 'PUT', {
      입고희망일자,
      결제방법,
      제목,
      적요,
      상태코드,
    });

    if (result.success) {
      alert(
        `발주가 수정되었습니다.\n\n※ 참고: 현재는 마스터 정보만 수정됩니다.\n품목 변경사항은 추후 구현 예정입니다.`,
      );
      closeOrderEditModal();
      $('#orderTable').DataTable().ajax.reload(null, false);
    } else {
      alert(result.message || '발주 수정에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 발주 수정 오류:', error);
    alert('발주 수정 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 삭제
 */
async function deleteOrder(orderDate, orderNo) {
  try {
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`, 'GET');

    if (!result.success) {
      alert('발주 정보를 불러올 수 없습니다.');
      return;
    }

    const master = result.data.master;

    const deleteContent = document.getElementById('orderDeleteContent');
    deleteContent.innerHTML = `
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <div style="margin-bottom: 12px;"><strong>발주일자:</strong> ${
          master.발주일자 ? master.발주일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'
        }</div>
        <div style="margin-bottom: 12px;"><strong>발주번호:</strong> ${master.발주번호 || '-'}</div>
        <div style="margin-bottom: 12px;"><strong>매입처명:</strong> ${master.매입처명 || '-'}</div>
        <div style="margin-bottom: 12px;"><strong>제목:</strong> ${master.제목 || '-'}</div>
        <div><strong>입고희망일자:</strong> ${
          master.입고희망일자
            ? master.입고희망일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
            : '-'
        }</div>
      </div>
    `;

    // 현재 삭제할 발주 정보 저장
    window.currentDeleteOrderDate = orderDate;
    window.currentDeleteOrderNo = orderNo;

    document.getElementById('orderDeleteModal').style.display = 'flex';
  } catch (error) {
    console.error('❌ 발주 삭제 모달 열기 오류:', error);
    alert('발주 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 삭제 확인
 */
async function confirmDeleteOrder() {
  const orderDate = window.currentDeleteOrderDate;
  const orderNo = window.currentDeleteOrderNo;

  if (!orderDate || !orderNo) {
    alert('삭제할 발주 정보가 없습니다.');
    return;
  }

  try {
    const result = await apiCall(`/orders/${orderDate}/${orderNo}`, 'DELETE');

    if (result.success) {
      alert('발주가 삭제되었습니다.');
      closeOrderDeleteModal();

      // DataTable 새로고침
      $('#orderTable').DataTable().ajax.reload(null, false);
    } else {
      alert(result.message || '발주 삭제에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 발주 삭제 오류:', error);
    alert('발주 삭제 중 오류가 발생했습니다.');
  }
}

/**
 * 발주 삭제 모달 닫기
 */
function closeOrderDeleteModal() {
  document.getElementById('orderDeleteModal').style.display = 'none';
  window.currentDeleteOrderDate = null;
  window.currentDeleteOrderNo = null;
}

/**
 * 필터링 (상태, 날짜 범위) - 조회 버튼 클릭 시
 */
function filterOrders() {
  console.log('✅ 발주 필터링 시작');

  const status = document.getElementById('orderStatusFilter').value;
  const startDate = document.getElementById('orderStartDate').value.replace(/-/g, '');
  const endDate = document.getElementById('orderEndDate').value.replace(/-/g, '');

  console.log(`필터 조건 - 상태: ${status || '전체'}, 기간: ${startDate} ~ ${endDate}`);

  // 날짜 유효성 검사
  if (startDate && endDate && startDate > endDate) {
    alert('시작일이 종료일보다 늦을 수 없습니다.');
    return;
  }

  // DataTable URL 파라미터 업데이트
  const table = $('#orderTable').DataTable();
  let url = '/api/orders?';

  if (status) {
    url += `상태코드=${status}&`;
  }
  if (startDate && endDate) {
    url += `startDate=${startDate}&endDate=${endDate}&`;
  }

  console.log(`API 요청 URL: ${url}`);

  // DataTable 데이터 새로고침
  table.ajax.url(url).load(function (json) {
    console.log(`✅ 발주 데이터 로드 완료: ${json.total || 0}건`);
  });
}

/**
 * Google Sheets로 내보내기 (임시)
 */
function exportOrdersToExcel() {
  alert('Google Sheets 내보내기 기능은 준비 중입니다.');
}
