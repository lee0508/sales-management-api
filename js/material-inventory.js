/**
 * 자재재고관리 (Material Inventory Management)
 * 사업장별 자재 재고 현황 조회 및 관리
 */

let materialInventoryTableInstance = null;

/**
 * 자재재고관리 DataTable 초기화
 */
function initMaterialInventoryTable() {
  console.log('🔧 [initMaterialInventoryTable] 호출 - 관련 ID: #materialInventoryTable');

  if (materialInventoryTableInstance) {
    materialInventoryTableInstance.destroy();
  }

  materialInventoryTableInstance = $('#materialInventoryTable').DataTable({
    data: [],
    columns: [
      { data: null, render: (data, type, row, meta) => meta.row + 1 },
      {
        data: '자재코드',
        render: (data) => data ? data.substring(2) : '-'  // 분류코드(2자리) 제거, 세부코드만 표시
      },
      { data: '자재명', defaultContent: '-' },
      { data: '규격', defaultContent: '-' },
      { data: '단위', defaultContent: '-' },
      {
        data: '현재고',
        render: (data) => {
          const qty = Number(data || 0);
          const color = qty > 0 ? '#28a745' : (qty < 0 ? '#dc3545' : '#6c757d');
          return `<span style="color: ${color}; font-weight: 600;">${formatNumber(qty)}</span>`;
        },
        className: 'dt-right',
      },
      {
        data: '총입고',
        render: (data) => formatNumber(data || 0),
        className: 'dt-right',
      },
      {
        data: '총출고',
        render: (data) => formatNumber(data || 0),
        className: 'dt-right',
      },
      {
        data: '적정재고',
        render: (data) => formatNumber(data || 0),
        className: 'dt-right',
      },
      {
        data: '최저재고',
        render: (data) => formatNumber(data || 0),
        className: 'dt-right',
      },
      {
        data: null,
        render: (data, type, row) => {
          const 현재고 = Number(row.현재고 || 0);
          const 최저재고 = Number(row.최저재고 || 0);
          const 적정재고 = Number(row.적정재고 || 0);

          let status = '정상';
          let color = '#28a745';

          if (현재고 < 최저재고) {
            status = '부족';
            color = '#dc3545';
          } else if (현재고 < 적정재고) {
            status = '주의';
            color = '#ffc107';
          } else if (현재고 > 적정재고 * 1.5) {
            status = '과잉';
            color = '#17a2b8';
          }

          return `<span style="background: ${color}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${status}</span>`;
        },
      },
      {
        data: '최종입고일자',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: '최종출고일자',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
    ],
    language: {
      emptyTable: '데이터가 없습니다.',
      search: '검색:',
      lengthMenu: '페이지당 _MENU_ 개 보기',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      paginate: { previous: '이전', next: '다음' },
    },
    order: [[1, 'asc']],  // 자재코드 기준 정렬
    responsive: true,
    autoWidth: false,
    pageLength: 25,
  });
}

/**
 * 재고 검색 (검색어 포함)
 */
async function searchInventory() {
  console.log('===== inventorySearchArea > 검색 버튼 클릭 =====');

  const searchKeyword = document.getElementById('inventorySearchInput').value.trim();

  await loadMaterialInventory(searchKeyword);
}

/**
 * 재고 현황 조회
 */
async function loadMaterialInventory(searchKeyword = '') {
  const 사업장코드 = document.getElementById('inventoryWorkplaceFilter').value;

  if (!사업장코드) {
    alert('사업장을 선택해주세요.');
    return;
  }

  try {

    // 검색어가 있으면 쿼리 파라미터에 추가
    let url = `/api/inventory/${사업장코드}`;
    if (searchKeyword) {
      url += `?search=${encodeURIComponent(searchKeyword)}`;
    }

    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('재고 현황 조회 실패');

    const data = await response.json();
    const inventory = data.data || [];

    // DataTable 업데이트
    if (materialInventoryTableInstance) {
      materialInventoryTableInstance.clear();
      materialInventoryTableInstance.rows.add(inventory);
      materialInventoryTableInstance.draw();
    }

    // 요약 정보 계산
    const 총자재수 = inventory.length;
    const 부족자재수 = inventory.filter(item => {
      const 현재고 = Number(item.현재고 || 0);
      const 최저재고 = Number(item.최저재고 || 0);
      return 현재고 < 최저재고;
    }).length;
    const 주의자재수 = inventory.filter(item => {
      const 현재고 = Number(item.현재고 || 0);
      const 최저재고 = Number(item.최저재고 || 0);
      const 적정재고 = Number(item.적정재고 || 0);
      return 현재고 >= 최저재고 && 현재고 < 적정재고;
    }).length;

    // 요약 표시
    document.getElementById('totalMaterialCount').textContent = 총자재수;
    document.getElementById('lowStockCount').textContent = 부족자재수;
    document.getElementById('warningStockCount').textContent = 주의자재수;
  } catch (err) {
    console.error('재고 현황 조회 에러:', err);
    alert('재고 현황 조회 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 사업장 목록 로드
 */
async function loadWorkplacesForInventory() {
  try {
    const response = await fetch('/api/workplaces', {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('사업장 조회 실패');

    const data = await response.json();
    const workplaces = data.data || [];

    const select = document.getElementById('inventoryWorkplaceFilter');
    select.innerHTML = '<option value="">사업장 선택</option>';

    workplaces.forEach(wp => {
      const option = document.createElement('option');
      option.value = wp.사업장코드;
      option.textContent = `${wp.사업장명} (${wp.사업장코드})`;
      select.appendChild(option);
    });

    // 첫 번째 사업장 자동 선택 (있는 경우)
    if (workplaces.length > 0) {
      select.value = workplaces[0].사업장코드;
      loadMaterialInventory();
    }
  } catch (err) {
    console.error('사업장 로드 에러:', err);
  }
}

/**
 * 검색 초기화
 */
function resetInventorySearch() {
  console.log('===== inventorySearchArea > 초기화 버튼 클릭 =====');

  document.getElementById('inventoryWorkplaceFilter').value = '';
  document.getElementById('inventorySearchInput').value = '';

  if (materialInventoryTableInstance) {
    materialInventoryTableInstance.clear().draw();
  }

  document.getElementById('totalMaterialCount').textContent = '0';
  document.getElementById('lowStockCount').textContent = '0';
  document.getElementById('warningStockCount').textContent = '0';
}

/**
 * Google Sheets로 재고 현황 내보내기
 */
window.exportInventoryToGoogleSheets = function exportInventoryToGoogleSheets() {
  console.log('===== inventoryActionArea > Google Sheets 내보내기 버튼 클릭 =====');

  try {
    const table = $('#materialInventoryTable').DataTable();
    const dataToExport = table.rows({ search: 'applied' }).data().toArray();

    if (dataToExport.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = [
      '순번',
      '자재코드',
      '자재명',
      '규격',
      '단위',
      '현재고',
      '총입고',
      '총출고',
      '적정재고',
      '최저재고',
      '상태',
      '최종입고일',
      '최종출고일',
    ];

    // CSV 데이터 생성
    let csvContent = headers.join(',') + '\n';

    dataToExport.forEach((row, index) => {
      const 현재고 = Number(row.현재고 || 0);
      const 최저재고 = Number(row.최저재고 || 0);
      const 적정재고 = Number(row.적정재고 || 0);

      let status = '정상';
      if (현재고 < 최저재고) {
        status = '부족';
      } else if (현재고 < 적정재고) {
        status = '주의';
      } else if (현재고 > 적정재고 * 1.5) {
        status = '과잉';
      }

      // 날짜 포맷 변환 (YYYYMMDD -> YYYY-MM-DD)
      const formatDate = (dateStr) => {
        if (!dateStr || dateStr.length !== 8) return '-';
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      };

      const rowData = [
        index + 1,
        `"${row.자재코드?.substring(2) || ''}"`,
        `"${row.자재명 || ''}"`,
        `"${row.규격 || ''}"`,
        `"${row.단위 || ''}"`,
        row.현재고 || 0,
        row.총입고 || 0,
        row.총출고 || 0,
        row.적정재고 || 0,
        row.최저재고 || 0,
        `"${status}"`,
        `"${formatDate(row.최종입고일자)}"`,
        `"${formatDate(row.최종출고일자)}"`,
      ];
      csvContent += rowData.join(',') + '\n';
    });

    // Blob 생성 및 다운로드
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `재고현황_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert('CSV 파일이 다운로드되었습니다. Google Sheets에서 열어보세요.');
  } catch (error) {
    console.error('CSV 내보내기 에러:', error);
    alert('CSV 내보내기 중 오류가 발생했습니다.');
  }
};

// 페이지 로드 시 초기화
$(document).ready(function () {
  if ($('#materialInventoryTable').length > 0) {
    initMaterialInventoryTable();
  }

  // loadWorkplacesForInventory()는 페이지가 실제로 표시될 때만 호출되도록 전역 함수로 노출
  window.loadMaterialInventoryPage = function() {
    loadWorkplacesForInventory();
  };
});