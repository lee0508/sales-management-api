// ✅ 거래명세서관리 스크립트 (transaction.js)
document.addEventListener('DOMContentLoaded', () => {
  // 페이지 로드 시 거래명세서 목록 불러오기
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const startDate = today.toISOString().slice(0, 10);

  document.getElementById('transactionStartDate').value = startDate;
  document.getElementById('transactionEndDate').value = endDate;

  loadTransactions();
});

// ✅ 거래명세서 목록 불러오기
async function loadTransactions() {
  try {
    const startDate = document.getElementById('transactionStartDate').value;
    const endDate = document.getElementById('transactionEndDate').value;
    const status = document.getElementById('transactionStatusFilter').value;

    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    if (status) query.append('status', status);

    const res = await fetch(`http://localhost:3000/api/transactions?${query.toString()}`);
    const data = await res.json();

    if (!data.success) throw new Error('데이터를 불러오지 못했습니다.');

    const tableBody = document.querySelector('#transactionTable tbody');
    tableBody.innerHTML = '';

    const tableData = data.data || [];
    document.getElementById('transactionCount').textContent = tableData.length;

    // ✅ 기존 DataTable 있으면 destroy
    if (window.transactionTableInstance) {
      window.transactionTableInstance.destroy();
    }

    // ✅ DataTable 초기화
    window.transactionTableInstance = $('#transactionTable').DataTable({
      data: tableData,
      columns: [
        {
          data: null,
          render: (data, type, row) =>
            `<input type="checkbox" class="select-transaction" data-id="${row.명세서번호}">`,
          orderable: false,
        },
        { data: '순번', defaultContent: '-' },
        { data: '명세서번호', defaultContent: '-' },
        {
          data: '거래일자',
          render: (data) => (data ? data.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '-'),
        },
        { data: '매출처명', defaultContent: '-' },
        {
          data: '공급가액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '부가세',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '합계금액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        { data: '작성자', defaultContent: '-' },
        {
          data: '상태',
          render: (d) => renderTransactionStatus(d),
        },
        {
          data: null,
          render: (data) =>
            `<button class="btn btn-sm btn-outline" onclick="openTransactionDetailModal('${data.명세서번호}')">보기</button>`,
        },
      ],
      language: {
        lengthMenu: '페이지당 _MENU_ 개씩 보기',
        zeroRecords: '데이터가 없습니다.',
        info: '전체 _TOTAL_개 중 _START_ - _END_',
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
      order: [[1, 'asc']],
      pageLength: 10,
      responsive: true,
      autoWidth: false,
    });

    if (data.data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="11" class="text-center">데이터가 없습니다.</td></tr>';
      document.getElementById('transactionCount').textContent = '0';
      return;
    }
  } catch (err) {
    console.error('❌ 거래명세서 조회 오류:', err);
    alert('거래명세서를 불러오는 중 오류가 발생했습니다.');
  }
}

// ✅ 상태 표시 포맷
function renderTransactionStatus(statusCode) {
  switch (statusCode) {
    case 1:
      return `<span class="badge bg-warning">작성중</span>`;
    case 2:
      return `<span class="badge bg-info">확정</span>`;
    case 3:
      return `<span class="badge bg-success">발행완료</span>`;
    default:
      return `<span class="badge bg-secondary">미지정</span>`;
  }
}

// ✅ 필터 적용 (상태 + 기간)
function filterTransactions() {
  loadTransactions();
}

// ✅ 거래명세서 상세보기
async function openTransactionDetailModal(transactionNo) {
  const modal = document.getElementById('transactionDetailModal');
  modal.style.display = 'block';

  try {
    const res = await fetch(`http://localhost:3000/api/transactions/${transactionNo}`);
    const result = await res.json();

    if (!result.success) throw new Error('상세 정보를 불러올 수 없습니다.');

    const master = result.data.master;
    const details = result.data.details || [];

    document.getElementById('detailTransactionNo').textContent = master.명세서번호 || '-';
    document.getElementById('detailTransactionDate').textContent = master.거래일자
      ? master.거래일자.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      : '-';
    document.getElementById('detailCustomerName').textContent = master.매출처명 || '-';
    document.getElementById('detailUserName').textContent = master.작성자 || '-';

    // ✅ 상세 DataTable 초기화
    if (window.transactionDetailTableInstance) {
      window.transactionDetailTableInstance.destroy();
    }

    window.transactionDetailTableInstance = $('#transactionDetailTable').DataTable({
      data: details,
      columns: [
        { data: '품목코드', defaultContent: '-' },
        { data: '품명', defaultContent: '-' },
        { data: '규격', defaultContent: '-' },
        {
          data: '수량',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '단가',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '공급가액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '세액',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
        {
          data: '합계',
          render: (d) => (d ? d.toLocaleString() : '0'),
          className: 'dt-right',
        },
      ],
      order: [[0, 'asc']],
      pageLength: 10,
    });

    // ✅ 합계 계산
    const total = details.reduce((sum, item) => sum + (item.합계 || 0), 0);
    document.getElementById('transactionDetailTotal').textContent = total.toLocaleString();
  } catch (err) {
    console.error('❌ 거래명세서 상세 조회 오류:', err);
    alert('상세 조회 중 오류가 발생했습니다.');
  }
}

// ✅ 거래명세서 작성 모달 열기
function openTransactionModal() {
  alert('거래명세서 작성 모달 열기 (추후 구현)');
}

// ✅ 거래명세서 상세 닫기
function closeTransactionDetailModal() {
  document.getElementById('transactionDetailModal').style.display = 'none';
}

// ✅ CSV 내보내기 (Google Sheets용)
function exportTransactionsToExcel() {
  if (!window.transactionTableInstance) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const data = window.transactionTableInstance
    .rows()
    .data()
    .toArray()
    .map((row) => ({
      명세서번호: row.명세서번호,
      거래일자: row.거래일자,
      매출처명: row.매출처명,
      공급가액: row.공급가액,
      부가세: row.부가세,
      합계금액: row.합계금액,
      작성자: row.작성자,
      상태: row.상태,
    }));

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [
      '명세서번호,거래일자,매출처명,공급가액,부가세,합계금액,작성자,상태',
      ...data.map((r) =>
        [
          r.명세서번호,
          r.거래일자,
          r.매출처명,
          r.공급가액,
          r.부가세,
          r.합계금액,
          r.작성자,
          r.상태,
        ].join(','),
      ),
    ].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', '거래명세서목록.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
