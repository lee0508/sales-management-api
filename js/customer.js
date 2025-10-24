// ✅ [REPLACE] js/customer.js — 전체 교체
// 주석: DataTables 공통 초기화(initDataTable) 사용 + 서버 응답 스키마 호환 + 상대경로 사용
$(document).ready(function () {
  let table;

  function loadCustomers() {
    // 기존 인스턴스가 있으면 파괴 후 재생성
    if (table) table.destroy();

    // ✅ 공통 초기화 함수 사용 (dataTableInit.js) — server.js의 {data:[...]} 스키마와 호환
    // ✅ 절대 경로 사용하여 포트 3000 서버로 요청
    table = initDataTable('customerTable', 'http://localhost:3000/api/customers', [
      {
        // 선택 체크박스
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return '<input type="checkbox" class="customerCheckbox" data-code="' + row.매출처코드 + '" />';
        },
      },
      {
        // 순번
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row, meta) {
          return meta.row + 1;
        },
      },
      { data: '매출처코드' },
      { data: '매출처명' },
      {
        // 대표자
        data: '대표자명',
        defaultContent: '-'
      },
      {
        // 사업자번호
        data: '사업자번호',
        defaultContent: '-'
      },
      {
        // 연락처
        data: '전화번호',
        defaultContent: '-'
      },
      {
        // 거래상태
        data: '사용구분',
        className: 'text-center',
        render: function (data, type, row) {
          if (data === 0) {
            return '<span class="status-badge status-active">정상거래</span>';
          } else {
            return '<span class="status-badge status-pending">거래보류</span>';
          }
        },
      },
      {
        // 등록일
        data: '수정일자',
        className: 'text-center',
        defaultContent: '-',
        render: function (data, type, row) {
          if (data && data.length === 8) {
            return data.substring(0, 4) + '-' + data.substring(4, 6) + '-' + data.substring(6, 8);
          }
          return data || '-';
        },
      },
      {
        // 관리 버튼
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row) {
          return `
            <div class="action-buttons" id="actions-${row.매출처코드}">
              <button class="btn-icon btn-view" onclick="viewCustomerDetail('${row.매출처코드}')">상세</button>
              <button class="btn-icon btn-edit" style="display: none;" onclick="editCustomer('${row.매출처코드}')">수정</button>
              <button class="btn-icon btn-delete" style="display: none;" onclick="deleteCustomer('${row.매출처코드}')">삭제</button>
            </div>
          `;
        },
      },
    ]);
  }

  // 최초 로드
  loadCustomers();

  // 새로고침 버튼
  $('#btnReload').on('click', () => table.ajax.reload(null, false));

  // 전체 선택 체크박스
  $(document).on('change', '#selectAllCustomers', function () {
    const isChecked = $(this).prop('checked');
    $('.customerCheckbox').prop('checked', isChecked).trigger('change');
  });

  // 개별 체크박스 변경 시
  $(document).on('change', '.customerCheckbox', function () {
    // 전체 선택 체크박스 상태 업데이트
    const totalCheckboxes = $('.customerCheckbox').length;
    const checkedCheckboxes = $('.customerCheckbox:checked').length;
    $('#selectAllCustomers').prop('checked', totalCheckboxes === checkedCheckboxes);

    // 현재 행의 버튼 표시/숨김 처리
    const customerCode = $(this).data('code');
    const isChecked = $(this).prop('checked');
    const actionDiv = $('#actions-' + customerCode);

    if (isChecked) {
      // 체크됨: 상세 버튼 숨기고 수정/삭제 버튼 표시
      actionDiv.find('.btn-view').hide();
      actionDiv.find('.btn-edit').show();
      actionDiv.find('.btn-delete').show();
    } else {
      // 체크 해제: 수정/삭제 버튼 숨기고 상세 버튼 표시
      actionDiv.find('.btn-view').show();
      actionDiv.find('.btn-edit').hide();
      actionDiv.find('.btn-delete').hide();
    }
  });
});
