// js/transaction.js
// 거래명세서관리 프론트엔드 연동 코드
// - server.js의 /api/transactions, /api/transactions/:date/:no, /api/transactions/price-history 등을 사용

document.addEventListener('DOMContentLoaded', () => {
  // 화면 요소 참조
  const txnDate = document.getElementById('transactionDate');
  const customerSelect = document.getElementById('customerSelect');

  // 오늘 날짜 기본 설정 (YYYY-MM-DD)
  txnDate.value = new Date().toISOString().slice(0, 10);

  // 매출처 select 박스 로드
  loadCustomersForSelect();

  // 초기 로드: 오늘 날짜 기준
  loadTransactions();
});

/* ------------- 유틸: 날짜 포맷 변환 ------------- */
/**
 * YYYY-MM-DD -> YYYYMMDD
 */
function dateToYYYYMMDD(dateStr) {
  return dateStr ? dateStr.replace(/-/g, '') : '';
}

/* ------------- 거래명세서 목록 로드 ------------- */
// 거래명세서 목록 불러오기
async function loadTransactions() {
  const date = document.getElementById('transactionDate').value;
  const customer = document.getElementById('customerSelect').value;
  const txnNo = document.getElementById('transactionNo').value.trim(); // 거래명세서번호 추가

  const qs = new URLSearchParams();
  const startDate = dateToYYYYMMDD(date);
  const endDate = startDate;

  // 거래명세서번호가 우선순위
  if (txnNo !== '') {
    qs.set('transactionNo', txnNo);
  } else {
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    if (customer) qs.set('customerCode', customer);
  }

  try {
    const res = await fetch(`/api/transactions?${qs.toString()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || '거래명세서 로드 실패');
    renderTransactionHeader(json.data);
  } catch (err) {
    console.error(err);
    const tbody = document.getElementById('transactionHeaderBody');
    tbody.innerHTML = `<tr><td colspan="9" class="error">거래명세서 로드 중 오류가 발생했습니다.</td></tr>`;
  }
}

/* ------------- 거래명세서 헤더 렌더링 ------------- */
function renderTransactionHeader(items) {
  const tbody = document.getElementById('transactionHeaderBody');
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading">조회 결과가 없습니다.</td></tr>`;
    // 상세 초기화
    document.getElementById(
      'transactionDetailBody',
    ).innerHTML = `<tr><td colspan="10" class="loading">거래명세서를 선택하세요.</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((row) => {
      // 입출고번호가 소수일 수 있으니 안전하게 출력
      const no = row.입출고번호 || '';
      return `
      <tr onclick="loadTransactionDetails('${row.입출고일자}','${no}')">
        <td><input type="checkbox" /></td>
        <td>${row.입출고번호}</td>
        <td>${formatYYYYMMDD(row.입출고일자)}</td>
        <td>${row.매출처명 || row.매출처코드 || ''}</td>
        <td>${numWithCommas(row.공급가액 || 0)}</td>
        <td>${numWithCommas(row.부가세 || 0)}</td>
        <td>${numWithCommas(row.합계금액 || 0)}</td>
        <td></td>
        <td></td>
      </tr>
    `;
    })
    .join('');
}

/* ------------- 거래상세(디테일) 로드 ------------- */
async function loadTransactionDetails(date, no) {
  if (!date || !no) return;
  try {
    const res = await fetch(`/api/transactions/${date}/${no}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || '상세 조회 실패');

    renderTransactionDetail(json.data);
  } catch (err) {
    console.error(err);
    document.getElementById(
      'transactionDetailBody',
    ).innerHTML = `<tr><td colspan="10" class="error">상세조회 오류</td></tr>`;
  }
}

/* ------------- 거래상세 렌더링 ------------- */
function renderTransactionDetail(details) {
  const tbody = document.getElementById('transactionDetailBody');
  if (!details || details.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading">상세내역이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = details
    .map((d) => {
      const amount = (d.수량 || 0) * (d.단가 || 0);
      const vat = d.부가세 || 0;
      const total = amount + vat;
      const code = d.자재코드 || '';
      return `
      <tr>
        <td>${code}</td>
        <td>${d.자재명 || ''}</td>
        <td>${d.규격 || ''}</td>
        <td>${d.단위 || ''}</td>
        <td><input type="number" value="${d.수량 || 0}" onchange="onQtyOrPriceChange(this)" /></td>
        <td><input type="number" value="${d.단가 || 0}" onchange="onQtyOrPriceChange(this)" /></td>
        <td class="cell-supply">${numWithCommas(amount)}</td>
        <td class="cell-vat">${numWithCommas(vat)}</td>
        <td class="cell-total">${numWithCommas(total)}</td>
        <td><button class="btn btn-secondary" onclick="openPriceModal('${code}')">단가조회</button></td>
      </tr>
    `;
    })
    .join('');
}

/* ------------- 수량/단가 변경시 재계산 (프론트 계산용) ------------- */
function onQtyOrPriceChange(el) {
  // el은 수량 혹은 단가 input. 같은 행에서 수량,단가 읽어 계산
  const tr = el.closest('tr');
  const qtyInput = tr.querySelector('input[type="number"]');
  const priceInput = tr.querySelectorAll('input[type="number"]')[1] || qtyInput;
  const qty = parseFloat(qtyInput.value || 0);
  const price = parseFloat(priceInput.value || 0);
  const amount = qty * price;
  const vat = Math.round(amount * 0.1); // 기본 10% VAT 가정 (DB/설정에 따라 변경 가능)
  const total = amount + vat;

  tr.querySelector('.cell-supply').textContent = numWithCommas(amount);
  tr.querySelector('.cell-vat').textContent = numWithCommas(vat);
  tr.querySelector('.cell-total').textContent = numWithCommas(total);
}

/* ------------- 자재조회 모달 연동 ------------- */
async function searchItems() {
  const q = document.getElementById('itemSearch').value || '';
  try {
    const res = await fetch(`/api/materials?search=${encodeURIComponent(q)}`);
    const json = await res.json();
    const body = document.getElementById('itemTableBody');
    if (!json.success || !json.data || json.data.length === 0) {
      body.innerHTML = `<tr><td colspan="5">검색 결과가 없습니다.</td></tr>`;
      return;
    }

    body.innerHTML = json.data
      .map(
        (m) => `
      <tr>
        <td>${m.자재코드 || m.분류코드 + m.세부코드}</td>
        <td>${m.자재명}</td>
        <td>${m.규격}</td>
        <td>${m.단위}</td>
        <td><button class="btn btn-success" onclick="selectItem('${m.분류코드 + m.세부코드}','${
          m.자재명
        }','${m.규격}','${m.단위}')">선택</button></td>
      </tr>
    `,
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
}

function selectItem(code, name, spec, unit) {
  // 신규등록 모달의 품목 리스트 영역에 행 추가
  const container = document.getElementById('newTransactionItems');
  const idx = Date.now();
  const tr = document.createElement('div');
  tr.className = 'new-item-row';
  tr.innerHTML = `
    <div>${code} - ${name} (${spec}) [${unit}]</div>
    <div style="display:flex; gap:8px; margin-top:6px;">
      <input type="number" class="item-qty" placeholder="수량" value="1" />
      <input type="number" class="item-price" placeholder="단가" value="0" />
      <button class="btn btn-secondary" onclick="openPriceModal('${code}')">단가조회</button>
      <button class="btn btn-danger" onclick="this.closest('.new-item-row').remove()">삭제</button>
    </div>
  `;
  container.appendChild(tr);
  closeItemModal();
}

/* ------------- 매출처조회 모달 연동 ------------- */
async function searchCustomers() {
  const q = document.getElementById('customerSearch').value || '';
  try {
    const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page=1&pageSize=50`);
    const json = await res.json();
    const body = document.getElementById('customerTableBodyModal');
    if (!json.success || !json.data || json.data.length === 0) {
      body.innerHTML = `<tr><td colspan="5">검색 결과가 없습니다.</td></tr>`;
      return;
    }
    body.innerHTML = json.data
      .map(
        (c) => `
      <tr>
        <td>${c.매출처코드}</td>
        <td>${c.매출처명}</td>
        <td>${c.사업자번호}</td>
        <td>${c.전화번호 || ''}</td>
        <td><button class="btn btn-success" onclick="selectCustomerFromModal('${c.매출처코드}','${
          c.매출처명
        }')">선택</button></td>
      </tr>
    `,
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
}

function selectCustomerFromModal(code, name) {
  document.getElementById('newCustomerName').value = `${name} (${code})`;
  // 모달 닫기
  closeCustomerModal();
}

/* ------------- 단가조회(최근1년) 모달 ------------- */
async function openPriceModal(materialCode) {
  // 현재 신규등록 모달에서 선택된 매출처 코드가 필요 — 우선 새 거래 등록 모달의 매출처 입력에서 파싱
  // 또는 거래명세서 상세에서 바로 호출하는 경우, 선택된 거래의 매출처 코드를 함께 전달하도록 개선 필요
  // 여기서는 우선 transactionModal 내 input이나 customerSelect값을 우선 시도
  const customerVal =
    (document.getElementById('newCustomerName') &&
      document.getElementById('newCustomerName').value) ||
    document.getElementById('customerSelect').value;
  let customerCode = '';

  // newCustomerName 값이 "매출처명 (코드)" 형식이면 코드 추출
  if (customerVal && customerVal.includes('(') && customerVal.includes(')')) {
    const m = customerVal.match(/\(([^)]+)\)$/);
    if (m) customerCode = m[1];
  } else {
    customerCode = customerVal; // select에서 가져온 값일 수 있음
  }

  if (!customerCode) {
    alert('단가를 조회할 매출처를 먼저 선택하세요.');
    return;
  }

  try {
    // 모달 오픈 UI
    document.getElementById('priceModal').classList.remove('hidden');
    document.getElementById(
      'priceTableBody',
    ).innerHTML = `<tr><td colspan="5" class="loading">불러오는 중...</td></tr>`;

    // 호출: /api/transactions/price-history?customerCode=...&materialCode=...
    const qs = new URLSearchParams({ customerCode, materialCode });
    const res = await fetch(`/api/transactions/price-history?${qs.toString()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || '단가 조회 실패');

    const tbody = document.getElementById('priceTableBody');
    if (!json.data || json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">조회 결과가 없습니다.</td></tr>`;
      return;
    }
    tbody.innerHTML = json.data
      .map(
        (r) => `
      <tr>
        <td>${formatYYYYMMDD(r.입출고일자)}</td>
        <td>${r.매출처명 || ''}</td>
        <td>${r.자재명 || ''}</td>
        <td>${numWithCommas(r.수량 || 0)}</td>
        <td>${numWithCommas(r.단가 || 0)}</td>
      </tr>
    `,
      )
      .join('');
  } catch (err) {
    console.error(err);
    document.getElementById(
      'priceTableBody',
    ).innerHTML = `<tr><td colspan="5" class="error">단가 조회 중 오류</td></tr>`;
  }
}

/* 모달 닫기 함수들 (index.html에 있는 id와 매칭) */
function closePriceModal() {
  document.getElementById('priceModal').classList.add('hidden');
}
function openItemModal() {
  document.getElementById('itemModal').classList.remove('hidden');
}
function closeItemModal() {
  document.getElementById('itemModal').classList.add('hidden');
}
function opensupplierModal() {
  document.getElementById('customerModal').classList.remove('hidden');
}
function closeCustomerModal() {
  document.getElementById('customerModal').classList.add('hidden');
}
function openTransactionModal() {
  document.getElementById('transactionModal').classList.remove('hidden');
}
function closeTransactionModal() {
  document.getElementById('transactionModal').classList.add('hidden');
}

/* ------------- 매출처 select 박스 로드 ------------- */
async function loadCustomersForSelect() {
  try {
    const res = await fetch('/api/customers?page=1&pageSize=500'); // 적당히 큰 pageSize
    const json = await res.json();
    const select = document.getElementById('customerSelect');
    if (!json.success) return;
    // 기본 옵션 유지(전체)
    for (const c of json.data) {
      const opt = document.createElement('option');
      opt.value = c.매출처코드;
      opt.textContent = c.매출처명;
      select.appendChild(opt);
    }
  } catch (err) {
    console.error(err);
  }
}

/* ------------- 기타 유틸 함수 ------------- */
function numWithCommas(x) {
  if (x === null || x === undefined) return '0';
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // return Number(x).toLocaleString();
}

function formatYYYYMMDD(s) {
  if (!s) return '';
  const str = String(s);
  if (str.length !== 8) return str;
  return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
}

async function printTransaction() {
  if (!selectedTransaction) {
    alert('출력할 거래명세서를 선택하세요.');
    return;
  }

  const { date, no } = selectedTransaction;
  const res = await fetch(`/api/transactions/${date}/${no}/print`);
  const json = await res.json();
  if (!json.success) {
    alert('거래명세서 데이터를 불러올 수 없습니다.');
    return;
  }

  const tx = json.data.header;
  const items = json.data.details;

  // 새 창으로 인쇄폼 열기
  const printWin = window.open('', '_blank');
  let html = `
  <html><head>
    <title>거래명세서 (${tx.매출처명})</title>
    <style>
      body { font-family: "Malgun Gothic", sans-serif; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #333; padding: 4px; text-align: center; }
      .title { font-size: 20px; font-weight: bold; text-align:center; margin:10px 0; }
    </style>
  </head><body>
    <div class="title">거래명세서</div>
    <div><strong>거래처명:</strong> ${tx.매출처명}</div>
    <div><strong>거래일자:</strong> ${formatYYYYMMDD(tx.입출고일자)} / <strong>번호:</strong> ${
    tx.입출고번호
  }</div>
    <br>
    <table>
      <thead>
        <tr><th>품목</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계금액</th></tr>
      </thead>
      <tbody>
        ${items
          .map(
            (d) => `
          <tr>
            <td>${d.자재명}</td><td>${d.규격}</td><td>${d.단위}</td>
            <td>${d.수량}</td><td>${numWithCommas(d.단가)}</td>
            <td>${numWithCommas(d.공급가액)}</td><td>${numWithCommas(d.부가세)}</td>
            <td>${numWithCommas(d.합계금액)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
    <br>
    <div style="text-align:right;">
      <strong>합계금액:</strong> ${numWithCommas(tx.총합계)} 원
    </div>
  </body></html>`;

  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  printWin.print();
}

async function generateTaxInvoice() {
  if (!selectedTransaction) {
    alert('세금계산서를 발행할 거래명세서를 선택하세요.');
    return;
  }

  const { date, no } = selectedTransaction;
  if (!confirm(`거래명세서 [${date}-${no}] 에 대한 세금계산서를 발행하시겠습니까?`)) return;

  const res = await fetch('/api/taxinvoice/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, no }),
  });
  const json = await res.json();
  if (json.success) {
    alert(`세금계산서가 발행되었습니다. 번호: ${json.data.invoiceNo}`);
  } else {
    alert('세금계산서 발행 실패: ' + json.message);
  }
}

// 거래명세서 미리보기
async function openPreviewModal(date, no) {
  try {
    const res = await fetch(`/api/transactions/${date}/${no}/print`);
    const json = await res.json();
    if (!json.success) throw new Error('데이터 로드 실패');

    const header = json.data.header;
    const items = json.data.details;

    document.getElementById('previewDate').textContent = formatYYYYMMDD(header.입출고일자);
    document.getElementById('previewNo').textContent = header.입출고번호;
    document.getElementById('previewCustomer').textContent = header.매출처명;

    // 테이블 렌더링
    const tbody = document.getElementById('previewBody');
    tbody.innerHTML = items
      .map(
        (d) => `
      <tr>
        <td>${d.자재명}</td>
        <td>${d.규격 || ''}</td>
        <td>${d.단위 || ''}</td>
        <td>${d.수량}</td>
        <td>${numWithCommas(d.단가)}</td>
        <td>${numWithCommas(d.공급가액)}</td>
        <td>${numWithCommas(d.부가세)}</td>
        <td>${numWithCommas(d.합계금액)}</td>
      </tr>`,
      )
      .join('');

    // 합계
    document.getElementById('previewSubtotal').textContent = numWithCommas(header.공급가액);
    document.getElementById('previewTax').textContent = numWithCommas(header.부가세);
    document.getElementById('previewTotal').textContent = numWithCommas(header.총합계);

    // 모달 표시
    document.getElementById('previewModal').style.display = 'block';
  } catch (err) {
    alert('미리보기 로드 중 오류 발생: ' + err.message);
  }
}

function closePreviewModal() {
  document.getElementById('previewModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

// 인쇄 버튼 클릭시
function printPreview() {
  const printContent = document.querySelector('#previewModal .modal-content').innerHTML;
  const newWindow = window.open('', '_blank');
  newWindow.document.write(`
    <html>
    <head><title>거래명세서 인쇄</title>
    <style>
      body { font-family: 'Malgun Gothic', sans-serif; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #333; padding: 4px; text-align: center; }
      h2 { text-align: center; }
    </style></head>
    <body>${printContent}</body></html>`);
  newWindow.document.close();
  newWindow.print();
}
