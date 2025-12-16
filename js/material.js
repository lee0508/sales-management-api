// ✅ 품목/자재 검색 모달 공용 스크립트 (material.js)
// ✅ Prefix 규칙 준수
//
// 📌 네이밍 규칙:
// - 공용 엔티티 컴포넌트: material prefix (예: materialSearchModal, searchMaterialsForModal)
//
// 📌 변경 이력:
// - 2025-12-16: 공용 품목 검색 모달 생성 (customerSearchModal 패턴 적용)
//

/**
 * 품목 검색 모달용 검색 함수 (공용)
 * @description materialSearchModal에서 사용하는 공용 검색 함수
 */
window.searchMaterialsForModal = async function() {
  try {
    const keyword = document.getElementById('materialSearchModalInput').value.trim();

    // API 호출
    let apiUrl = API_BASE_URL + '/materials?pageSize=1000';
    if (keyword) {
      apiUrl += `&search=${encodeURIComponent(keyword)}`;
    }

    const response = await fetch(apiUrl, { credentials: 'include' });
    const result = await response.json();
    const materials = result.data || [];

    // ✅ 품목코드 필드 생성 (분류코드 + 세부코드)
    const processedMaterials = materials.map(material => ({
      ...material,
      품목코드: material.품목코드 || ((material.분류코드 || '') + (material.세부코드 || ''))
    }));

    // DataTable 재사용 패턴
    if (!window.materialSearchTable || typeof window.materialSearchTable.clear !== 'function') {
      // DataTable 인스턴스가 없거나 손상된 경우 재생성
      if ($.fn.DataTable.isDataTable('#materialSearchTable')) {
        $('#materialSearchTable').DataTable().destroy();
      }

      // DataTable 초기화
      window.materialSearchTable = $('#materialSearchTable').DataTable({
        data: [],
        columns: [
          {
            data: '품목코드',
            title: '품목코드',
            defaultContent: '-'
          },
          {
            data: '자재명',
            title: '품목명',
            defaultContent: '-'
          },
          {
            data: '규격',
            title: '규격',
            defaultContent: '-'
          },
          {
            data: '단위',
            title: '단위',
            defaultContent: '-'
          },
          {
            data: null,
            title: '판매단가',
            defaultContent: '0',
            className: 'text-right',
            render: function(_data, _type, row) {
              // ✅ API 응답에 따라 출고단가 또는 출고단가1 사용
              const price = row.출고단가 || row.출고단가1 || 0;
              return price ? '₩' + parseFloat(price).toLocaleString() : '-';
            }
          },
          {
            data: null,
            title: '선택',
            orderable: false,
            className: 'text-center',
            render: function(data, type, row) {
              return `<button onclick='selectMaterialFromModal(${JSON.stringify(row).replace(/'/g, "&#39;")})'
                        class="btn-icon btn-view" style="padding: 6px 12px; font-size: 13px;">
                      선택
                    </button>`;
            }
          }
        ],
        language: {
          lengthMenu: '페이지당 _MENU_ 개씩 보기',
          zeroRecords: '검색 결과가 없습니다',
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
        order: [[1, 'asc']], // 품목명 오름차순
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        responsive: true,
        autoWidth: false,
        paging: true, // 페이지네이션 명시적 활성화
        searching: false, // DataTable 자체 검색 비활성화 (별도 검색창 사용)
        info: true, // 정보 표시
        dom: 'lrtip', // length, processing, table, info, pagination (검색창 제외)
      });
    }

    // DataTable에 데이터 업데이트 (품목코드 필드가 추가된 데이터 사용)
    window.materialSearchTable.clear().rows.add(processedMaterials).draw();

  } catch (error) {
    console.error('품목 검색 오류:', error);
    alert('품목 검색 중 오류가 발생했습니다.');
  }
};

/**
 * 품목 선택 함수 (공용)
 * @param {Object} material - 선택한 품목 객체
 * @description 품목 검색 모달에서 품목 선택 시 호출되는 공용 함수
 */
window.selectMaterialFromModal = function(material) {
  // 호출한 모듈에 따라 다른 처리 (callerContext 활용)
  const caller = window.currentMaterialSearchCaller || 'unknown';

  console.log('✅ 품목 선택:', material);
  console.log('호출자:', caller);

  if (caller === 'quotation') {
    // 견적관리에서 호출한 경우
    if (typeof window.selectQuotationMaterial === 'function') {
      window.selectQuotationMaterial(material);
    }
  } else if (caller === 'quotation_edit') {
    // 견적 수정에서 호출한 경우
    if (typeof window.selectQuotationEditMaterial === 'function') {
      window.selectQuotationEditMaterial(material);
    }
  } else if (caller === 'quotation_material_add') {
    // 견적 품목 추가 모달에서 호출한 경우
    if (typeof window.selectQuotationMaterialAdd === 'function') {
      window.selectQuotationMaterialAdd(material);
    }
  } else if (caller === 'transaction') {
    // 거래명세서에서 호출한 경우
    if (typeof window.selectTransactionMaterial === 'function') {
      window.selectTransactionMaterial(material);
    }
  } else if (caller === 'transaction_edit') {
    // 거래명세서 수정에서 호출한 경우
    if (typeof window.selectTransactionEditMaterial === 'function') {
      window.selectTransactionEditMaterial(material);
    }
  } else if (caller === 'purchase') {
    // 매입전표에서 호출한 경우
    if (typeof window.selectPurchaseMaterial === 'function') {
      window.selectPurchaseMaterial(material);
    }
  } else if (caller === 'purchase_edit') {
    // 매입전표 수정에서 호출한 경우
    if (typeof window.selectPurchaseEditMaterial === 'function') {
      window.selectPurchaseEditMaterial(material);
    }
  } else if (caller === 'order') {
    // 발주관리에서 호출한 경우
    if (typeof window.selectOrderMaterial === 'function') {
      window.selectOrderMaterial(material);
    }
  } else if (caller === 'order_edit') {
    // 발주 수정에서 호출한 경우
    if (typeof window.selectOrderEditMaterial === 'function') {
      window.selectOrderEditMaterial(material);
    }
  }
};

/**
 * 품목 검색 모달 열기 (공용)
 * @param {string} callerContext - 호출한 모듈 식별자 (quotation, transaction, purchase 등)
 * @param {string} initialSearchValue - 초기 검색어 (선택적)
 */
window.openMaterialSearchModal = function(callerContext, initialSearchValue) {
  window.currentMaterialSearchCaller = callerContext || 'unknown';

  const modal = document.getElementById('materialSearchModal');
  if (modal) {
    // 모달 위치 보장
    modal.style.display = 'block';
    modal.style.position = 'fixed';

    // ✅ 드래그 기능 활성화 (최초 1회만 실행)
    const modalContent = document.getElementById('materialSearchModalContent');
    if (!window.materialSearchModalDraggable) {
      // 최초 실행시에만 modal-content에 드래그를 위한 positioning 설정
      if (modalContent) {
        modalContent.style.position = 'absolute';
        modalContent.style.top = '50%';
        modalContent.style.left = '50%';
        modalContent.style.transform = 'translate(-50%, -50%)';
        modalContent.style.margin = '0';
      }

      // makeModalDraggable 함수 호출 (modal-draggable.js에서 로드됨)
      if (typeof makeModalDraggable === 'function') {
        makeModalDraggable('materialSearchModal', 'materialSearchModalHeader');
        window.materialSearchModalDraggable = true;
      }
    }

    // 입력 필드 설정
    const input = document.getElementById('materialSearchModalInput');
    if (input) {
      input.value = initialSearchValue || '';
      input.focus();

      // 초기 검색어가 있으면 자동으로 검색 실행
      if (initialSearchValue && typeof window.searchMaterialsForModal === 'function') {
        setTimeout(() => {
          window.searchMaterialsForModal();
        }, 100);
      }
    }
  }
};

/**
 * 품목 검색 모달 닫기 (공용)
 */
window.closeMaterialSearchModal = function() {
  const modal = document.getElementById('materialSearchModal');
  if (modal) {
    modal.style.display = 'none';
  }
  window.currentMaterialSearchCaller = null;
};

console.log('✅ material.js 로드 완료 - 공용 품목 검색 모달 함수 활성화');
