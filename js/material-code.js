/**
 * 자재코드관리 (Material Code Management)
 * 자재명별 자재코드 분석 및 통합 관리
 */

let materialCodeTableInstance = null;
let codeDetailTableInstance = null;

/**
 * 자재코드관리 DataTable 초기화
 */
function initMaterialCodeTable() {
  if (materialCodeTableInstance) {
    materialCodeTableInstance.destroy();
  }

  materialCodeTableInstance = $('#materialCodeTable').DataTable({
    data: [],
    order: [], // 서버 정렬 유지 (정렬 비활성화)
    columns: [
      {
        data: null,
        className: 'dt-center',
        render: (data, type, row, meta) => meta.row + 1,
      },
      { data: '자재명', defaultContent: '-' },
      { data: '규격', defaultContent: '-' },
      { data: '단위', defaultContent: '-' },
      {
        data: '코드개수',
        className: 'dt-center',
        render: (data) => {
          const count = Number(data || 0);
          const color = count > 1 ? '#dc3545' : '#28a745';
          return `<span style="color: ${color}; font-weight: 600;">${count}개</span>`;
        },
      },
      {
        data: '매입건수',
        className: 'dt-right',
        render: (data) => formatNumber(data || 0),
      },
      {
        data: '매출건수',
        className: 'dt-right',
        render: (data) => formatNumber(data || 0),
      },
      {
        data: '전체건수',
        className: 'dt-right',
        render: (data) => `<strong>${formatNumber(data || 0)}</strong>`,
      },
      {
        data: '최근거래일',
        className: 'dt-center',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: null,
        className: 'dt-center',
        orderable: false,
        width: '100px',
        render: function (data, type, row) {
          return `
            <button class="btn btn-sm btn-info" onclick="viewCodeDetail('${encodeURIComponent(row.자재명)}', '${encodeURIComponent(row.규격 || '')}')"
                    style="padding: 6px 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
              상세
            </button>
          `;
        },
      },
    ],
    language: {
      emptyTable: '데이터가 없습니다.',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      infoEmpty: '데이터 없음',
      infoFiltered: '(전체 _MAX_개 중 검색결과)',
      lengthMenu: '_MENU_개씩 보기',
      search: '검색:',
      zeroRecords: '검색 결과가 없습니다.',
      paginate: {
        first: '처음',
        last: '마지막',
        next: '다음',
        previous: '이전',
      },
    },
    pageLength: 25,
    lengthMenu: [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, '전체'],
    ],
  });
}

/**
 * 자재코드 검색 (세부코드, 자재명, 규격 개별 검색)
 */
window.searchMaterialCode = async function searchMaterialCode() {
  console.log('===== materialCodeSearchArea > 검색 버튼 클릭 =====');

  const 세부코드 = document.getElementById('materialCodeSearchInput').value.trim();
  const 자재명 = document.getElementById('materialNameSearchInput').value.trim();
  const 규격 = document.getElementById('materialSpecSearchInput').value.trim();

  await loadMaterialCodeList(세부코드, 자재명, 규격);
};

/**
 * 검색 초기화
 */
window.resetCodeSearch = function resetCodeSearch() {
  console.log('===== materialCodeSearchArea > 초기화 버튼 클릭 =====');

  document.getElementById('materialCodeSearchInput').value = '';
  document.getElementById('materialNameSearchInput').value = '';
  document.getElementById('materialSpecSearchInput').value = '';

  if (materialCodeTableInstance) {
    materialCodeTableInstance.clear().draw();
  }

  document.getElementById('materialCodeTotalCount').textContent = '0';
};

/**
 * 자재코드 목록 조회 (자재명별 그룹핑)
 */
async function loadMaterialCodeList(세부코드 = '', 자재명 = '', 규격 = '') {
  try {
    // 검색 조건을 쿼리 파라미터로 추가
    const params = new URLSearchParams();
    if (세부코드) params.append('세부코드', 세부코드);
    if (자재명) params.append('자재명', 자재명);
    if (규격) params.append('규격', 규격);

    let url = '/api/material-codes/analysis';
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('자재코드 목록 조회 실패');
    }

    const result = await response.json();

    if (result.success && result.data) {
      // DataTable 데이터 갱신
      materialCodeTableInstance.clear();
      materialCodeTableInstance.rows.add(result.data);
      materialCodeTableInstance.draw();

      // 총 자재명 수 표시
      document.getElementById('materialCodeTotalCount').textContent = result.data.length;
    } else {
      alert('자재코드 목록 조회에 실패했습니다.');
    }
  } catch (error) {
    console.error('자재코드 목록 조회 에러:', error);
    alert('자재코드 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 자재코드 상세 정보 조회
 */
window.viewCodeDetail = async function viewCodeDetail(자재명, 규격) {
  console.log('===== materialCodeTable > 상세 버튼 클릭 =====');

  try {
    const decodedName = decodeURIComponent(자재명);
    const decodedSpec = decodeURIComponent(규격);

    // API 요청 (자재명과 규격을 쿼리 파라미터로 전달)
    const params = new URLSearchParams({
      자재명: decodedName,
      규격: decodedSpec || '',
    });

    const response = await fetch(`/api/material-codes/detail?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('자재코드 상세 정보 조회 실패');
    }

    const result = await response.json();

    if (result.success && result.data) {
      displayCodeDetailModal(result.data, decodedName, decodedSpec);
    } else {
      alert('자재코드 상세 정보를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('자재코드 상세보기 에러:', error);
    alert('자재코드 상세 정보 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 자재코드 상세 정보 모달 표시
 */
function displayCodeDetailModal(data, 자재명, 규격) {
  // 자재 정보 표시
  document.getElementById('materialCodeDetailName').textContent = 자재명;
  document.getElementById('materialCodeDetailSpec').textContent = 규격 || '-';

  // 상세 테이블 초기화 및 데이터 표시
  if (codeDetailTableInstance) {
    codeDetailTableInstance.destroy();
  }

  codeDetailTableInstance = $('#materialCodeDetailTable').DataTable({
    data: data,
    order: [[5, 'desc']], // 전체건수 기준 내림차순 (인덱스는 동일)
    columns: [
      { data: '분류명', defaultContent: '-' },
      {
        data: '자재코드',
        render: (data) => (data ? data.substring(2) : '-'), // 분류코드(2자리) 제거
      },
      { data: '단위', defaultContent: '-' },
      {
        data: '매입건수',
        className: 'dt-right',
        render: (data) => formatNumber(data || 0),
      },
      {
        data: '매출건수',
        className: 'dt-right',
        render: (data) => formatNumber(data || 0),
      },
      {
        data: '전체건수',
        className: 'dt-right',
        render: (data) => `<strong>${formatNumber(data || 0)}</strong>`,
      },
      {
        data: '최초거래일',
        className: 'dt-center',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: '최근거래일',
        className: 'dt-center',
        render: (data) => {
          if (!data || data.length !== 8) return '-';
          return `${data.substring(0, 4)}-${data.substring(4, 6)}-${data.substring(6, 8)}`;
        },
      },
      {
        data: null,
        className: 'dt-center',
        orderable: false,
        render: (data, type, row, meta) => {
          // 첫 번째 행(전체건수가 가장 많은 자재코드)을 추천으로 표시
          if (meta.row === 0 && row.전체건수 > 0) {
            return '<span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">★ 권장</span>';
          }
          return '-';
        },
      },
    ],
    language: {
      emptyTable: '데이터가 없습니다.',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      paginate: { previous: '이전', next: '다음' },
    },
    pageLength: 10,
    paging: data.length > 10,
    searching: false,
  });

  // 모달 표시
  const modal = document.getElementById('materialCodeDetailModal');
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
}

/**
 * 자재코드 상세 모달 닫기
 */
window.closeCodeDetailModal = function closeCodeDetailModal() {
  console.log('===== materialCodeDetailModal > 닫기 버튼 클릭 =====');

  document.getElementById('materialCodeDetailModal').style.display = 'none';

  if (codeDetailTableInstance) {
    codeDetailTableInstance.destroy();
    codeDetailTableInstance = null;
  }
};

/**
 * 자재명별 코드 분석 모달 열기 (향후 구현)
 */
window.openCodeDuplicateModal = function openCodeDuplicateModal() {
  console.log('===== materialCodeToolbar > 코드분석 버튼 클릭 =====');

  alert('자재명별 코드 분석 기능은 향후 추가될 예정입니다.');
};

// 페이지 로드 시 DataTable 초기화
$(document).ready(function () {
  if ($('#materialCodeTable').length > 0) {
    initMaterialCodeTable();
  }

  // loadMaterialCodeList()는 페이지가 실제로 표시될 때만 호출되도록 전역 함수로 노출
  window.loadMaterialCodePage = function () {
    loadMaterialCodeList();
  };
});
