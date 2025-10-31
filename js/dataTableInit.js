// ✅ js/dataTableInit.js
function initDataTable(tableId, url, columns) {
  if (!tableId) {
    console.error('initDataTable: tableId is required.');
    return;
  }
  const $table = $('#' + tableId);
  if ($table.length === 0) {
    console.error(`initDataTable: Table element #${tableId} not found.`);
    return;
  }

  return $table.DataTable({
    ajax: { url, dataSrc: 'data' },
    columns,
    language: {
      emptyTable: '데이터가 없습니다.',
      search: '검색:',
      lengthMenu: '페이지당 _MENU_ 개 보기',
      info: '_START_ - _END_ / 총 _TOTAL_건',
      paginate: { previous: '이전', next: '다음' },
    },
    order: [], // 백엔드에서 제공하는 순서 유지
    responsive: true,
    autoWidth: false,
    pageLength: 10,
  });
}
