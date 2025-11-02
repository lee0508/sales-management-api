/**
 * 자재내역조회 (Material Transaction History)
 * 자재 입출고 이력 조회 기능
 */

let materialHistoryTableInstance = null;

/**
 * 자재내역조회 DataTable 초기화
 */
function initMaterialHistoryTable() {
  if (materialHistoryTableInstance) {
    materialHistoryTableInstance.destroy();
  }

  materialHistoryTableInstance = $('#materialHistoryTable').DataTable({
    data: [],
    columns: [
      { data: null, render: (data, type, row, meta) => meta.row + 1 },
      {
        data: '입출고일자',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: '입출고구분명',
        render: (data, type, row) => {
          const bgColor = row.입출고구분 === 1 ? '#28a745' : '#007bff';
          return `<span style="background: ${bgColor}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${
            data || '-'
          }</span>`;
        },
      },
      {
        data: null,
        render: (data, type, row) => {
          if (row.입출고구분 === 1) {
            // 입고 - 매입처 표시
            return row.매입처명 || '-';
          } else {
            // 출고 - 매출처 표시
            return row.매출처명 || '-';
          }
        },
      },
      {
        data: null,
        render: (data, type, row) => {
          if (row.입출고구분 === 1) {
            return formatNumber(row.입고수량 || 0);
          } else {
            return formatNumber(row.출고수량 || 0);
          }
        },
        className: 'dt-right',
      },
      {
        data: null,
        render: (data, type, row) => {
          if (row.입출고구분 === 1) {
            return formatCurrency(row.입고단가 || 0);
          } else {
            return formatCurrency(row.출고단가 || 0);
          }
        },
        className: 'dt-right',
      },
      {
        data: null,
        render: (data, type, row) => {
          if (row.입출고구분 === 1) {
            return formatCurrency(row.입고합계 || 0);
          } else {
            return formatCurrency(row.출고합계 || 0);
          }
        },
        className: 'dt-right',
      },
      { data: '적요', defaultContent: '-' },
      { data: '사용자명', defaultContent: '-' },
    ],
    language: {
      emptyTable: '데이터가 없습니다.',
      search: '검색:',
      lengthMenu: '페이지당 _MENU_ 개 보기',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      paginate: { previous: '이전', next: '다음' },
    },
    order: [],
    responsive: true,
    autoWidth: false,
    pageLength: 25,
  });
}

/**
 * 자재 검색 및 내역 조회 (통합)
 */
async function searchAndLoadMaterialHistory() {
  const keyword = document.getElementById('historyMaterialSearchInput').value.trim();

  if (!keyword) {
    alert('자재코드 또는 자재명을 입력해주세요.');
    return;
  }

  try {
    // 자재 검색
    const response = await fetch(`/api/materials`, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('자재 조회 실패');

    const data = await response.json();
    let materials = data.data || [];

    // 키워드로 필터링 (세부코드 또는 자재명)
    materials = materials.filter((m) => {
      const 세부코드 = m.자재코드.substring(2); // 분류코드(2) 제거
      return (
        세부코드.toLowerCase().includes(keyword.toLowerCase()) ||
        (m.자재명 && m.자재명.toLowerCase().includes(keyword.toLowerCase()))
      );
    });

    if (materials.length === 0) {
      alert('검색 결과가 없습니다.');
      return;
    }

    // 검색 결과가 1개면 바로 조회
    if (materials.length === 1) {
      const material = materials[0];
      // 자재코드 그대로 저장 (분류코드 + 세부코드)
      document.getElementById('historySelectedMaterialCode').value = material.자재코드;
      document.getElementById('historyMaterialSearchInput').value =
        `${material.자재코드.substring(2)} - ${material.자재명}`;

      // 자동으로 내역 조회
      await loadMaterialHistory();
    } else {
      // 여러 개면 첫 번째 자재로 조회 (또는 선택 UI 표시)
      alert(`${materials.length}개의 자재가 검색되었습니다. 첫 번째 자재로 조회합니다.`);
      const material = materials[0];
      // 자재코드 그대로 저장 (분류코드 + 세부코드)
      document.getElementById('historySelectedMaterialCode').value = material.자재코드;
      document.getElementById('historyMaterialSearchInput').value =
        `${material.자재코드.substring(2)} - ${material.자재명}`;

      // 자동으로 내역 조회
      await loadMaterialHistory();
    }
  } catch (err) {
    console.error('자재 검색 에러:', err);
    alert('자재 검색 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 자재내역 조회
 */
async function loadMaterialHistory() {
  const materialCode = document.getElementById('historySelectedMaterialCode').value.trim();

  if (!materialCode) {
    alert('자재를 선택해주세요.');
    return;
  }

  const startDate = document.getElementById('historyStartDate').value;
  const endDate = document.getElementById('historyEndDate').value;
  const 입출고구분 = document.getElementById('history입출고구분Filter').value;

  try {
    let url = `/api/materials/transaction-history?materialCode=${encodeURIComponent(
      materialCode
    )}`;

    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (입출고구분 && 입출고구분 !== '전체') url += `&입출고구분=${입출고구분}`;

    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) throw new Error('자재내역 조회 실패');

    const data = await response.json();
    const history = data.data || [];

    // DataTable 업데이트
    if (materialHistoryTableInstance) {
      materialHistoryTableInstance.clear();
      materialHistoryTableInstance.rows.add(history);
      materialHistoryTableInstance.draw();
    }

    // 요약 정보 업데이트
    const 총입고수량 = history
      .filter((h) => h.입출고구분 === 1)
      .reduce((sum, h) => sum + (h.입고수량 || 0), 0);
    const 총출고수량 = history
      .filter((h) => h.입출고구분 === 2)
      .reduce((sum, h) => sum + (h.출고수량 || 0), 0);

    document.getElementById('totalInQty').textContent = formatNumber(총입고수량);
    document.getElementById('totalOutQty').textContent = formatNumber(총출고수량);
    document.getElementById('historyCount').textContent = history.length;
  } catch (err) {
    console.error('자재내역 조회 에러:', err);
    alert('자재내역 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 검색 초기화
 */
function resetMaterialHistorySearch() {
  document.getElementById('historySelectedMaterialCode').value = '';
  document.getElementById('historyMaterialSearchInput').value = '';
  document.getElementById('historyStartDate').value = '';
  document.getElementById('historyEndDate').value = '';
  document.getElementById('history입출고구분Filter').value = '전체';

  if (materialHistoryTableInstance) {
    materialHistoryTableInstance.clear().draw();
  }

  document.getElementById('totalInQty').textContent = '0';
  document.getElementById('totalOutQty').textContent = '0';
  document.getElementById('historyCount').textContent = '0';
}

/**
 * 숫자 포맷 (천단위 콤마)
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('ko-KR');
}

/**
 * 통화 포맷 (원화)
 */
function formatCurrency(num) {
  if (num === null || num === undefined) return '0원';
  return Number(num).toLocaleString('ko-KR') + '원';
}

// 페이지 로드 시 초기화
$(document).ready(function () {
  initMaterialHistoryTable();
});