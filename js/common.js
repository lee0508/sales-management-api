/**
 * 공통 유틸리티 함수 (Common Utilities)
 * 여러 모듈에서 공통으로 사용되는 함수들을 정의합니다.
 */

/**
 * 날짜 포맷 변환 (다양한 입력 형식 → YYYY-MM-DD)
 *
 * 지원하는 입력 형식:
 * - YYYYMMDD 문자열 (예: "20251128")
 * - Date 객체
 * - ISO 날짜 문자열 (예: "2025-11-28")
 *
 * @param {string|Date} input - 변환할 날짜 (YYYYMMDD 문자열, Date 객체 등)
 * @returns {string} YYYY-MM-DD 형식의 날짜 문자열, 유효하지 않으면 빈 문자열
 *
 * @example
 * formatDate("20251128")           // "2025-11-28"
 * formatDate(new Date())           // "2025-11-28"
 * formatDate("2025-11-28")         // "2025-11-28"
 * formatDate(null)                 // ""
 */
function formatDate(input) {
  if (!input) return '';

  // YYYYMMDD 숫자/문자열 처리 (예: "20251128", 20251128)
  const raw = String(input).trim();
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  // Date 객체 또는 기타 날짜 문자열 처리
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 날짜 표시 포맷 (YYYYMMDD → YYYY-MM-DD)
 *
 * formatDate와 유사하지만, YYYYMMDD 문자열만 처리합니다.
 * 데이터베이스에서 조회한 날짜를 화면에 표시할 때 사용합니다.
 *
 * @param {string} dateStr - YYYYMMDD 형식의 날짜 문자열
 * @returns {string} YYYY-MM-DD 형식의 날짜 문자열, 유효하지 않으면 빈 문자열
 *
 * @example
 * formatDateDisplay("20251128")    // "2025-11-28"
 * formatDateDisplay("invalid")     // ""
 * formatDateDisplay(null)          // ""
 */
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr);
  if (str.length === 8) {
    return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
  }
  return str;
}

/**
 * 날짜를 YYYYMMDD 형식으로 변환 (Date → YYYYMMDD)
 *
 * API 요청 시 날짜를 데이터베이스 형식(YYYYMMDD)으로 변환할 때 사용합니다.
 *
 * @param {Date|string} input - Date 객체 또는 날짜 문자열
 * @returns {string} YYYYMMDD 형식의 날짜 문자열
 *
 * @example
 * formatDateToYYYYMMDD(new Date())         // "20251128"
 * formatDateToYYYYMMDD("2025-11-28")       // "20251128"
 */
function formatDateToYYYYMMDD(input) {
  if (!input) return '';

  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * 날짜를 input[type="date"]에 사용 가능한 형식으로 변환
 *
 * @param {Date|string} input - Date 객체 또는 날짜 문자열
 * @returns {string} YYYY-MM-DD 형식 (HTML input 태그용)
 *
 * @example
 * formatDateForInput(new Date())           // "2025-11-28"
 * formatDateForInput("20251128")           // "2025-11-28"
 */
function formatDateForInput(input) {
  return formatDate(input);
}

/**
 * 오늘 날짜를 input[type="date"] 형식으로 반환
 *
 * @returns {string} YYYY-MM-DD 형식의 오늘 날짜
 *
 * @example
 * getTodayForInput()  // "2025-11-28"
 */
function getTodayForInput() {
  return formatDate(new Date());
}

/**
 * 숫자를 금액 형식으로 포맷 (천단위 쉼표)
 *
 * @param {number|string} amount - 변환할 금액
 * @returns {string} 천단위 쉼표가 추가된 문자열
 *
 * @example
 * formatCurrency(1234567)          // "1,234,567"
 * formatCurrency("1234567")        // "1,234,567"
 * formatCurrency(null)             // "0"
 */
function formatCurrency(amount) {
  if (amount === undefined || amount === null || amount === '' || isNaN(amount)) {
    return '0';
  }

  const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numValue)) {
    return '0';
  }

  return numValue.toLocaleString('ko-KR');
}

/**
 * 숫자 포맷 (천단위 쉼표)
 * formatCurrency의 alias
 *
 * @param {number|string} num - 변환할 숫자
 * @returns {string} 천단위 쉼표가 추가된 문자열
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('ko-KR');
}

/**
 * 금액 포맷 (천단위 쉼표 + "원" 단위)
 *
 * @param {number|string} amount - 변환할 금액
 * @returns {string} 천단위 쉼표 + "원"이 추가된 문자열
 *
 * @example
 * formatCurrencyKRW(1234567)       // "1,234,567원"
 * formatCurrencyKRW("1234567")     // "1,234,567원"
 * formatCurrencyKRW(null)          // "0원"
 */
function formatCurrencyKRW(amount) {
  if (amount === undefined || amount === null || amount === '' || isNaN(amount)) {
    return '0원';
  }

  const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numValue)) {
    return '0원';
  }

  return numValue.toLocaleString('ko-KR') + '원';
}

/**
 * 사업자번호 포맷 (123-45-67890)
 *
 * @param {string} bizNo - 10자리 사업자번호 (숫자만)
 * @returns {string} 하이픈이 추가된 사업자번호
 *
 * @example
 * formatBusinessNumber("1234567890")   // "123-45-67890"
 */
function formatBusinessNumber(bizNo) {
  if (!bizNo || bizNo.length !== 10) return bizNo;
  return `${bizNo.substring(0, 3)}-${bizNo.substring(3, 5)}-${bizNo.substring(5, 10)}`;
}

/**
 * 전화번호 포맷
 *
 * @param {string} phone - 전화번호 (숫자만 또는 하이픈 포함)
 * @returns {string} 하이픈이 추가된 전화번호
 *
 * @example
 * formatPhoneNumber("01012345678")     // "010-1234-5678"
 * formatPhoneNumber("0212345678")      // "02-1234-5678"
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  // 숫자만 추출
  const numbers = phone.replace(/[^0-9]/g, '');

  // 휴대폰 (010, 011, 016, 017, 018, 019)
  if (numbers.length === 11 && numbers.startsWith('0')) {
    return `${numbers.substring(0, 3)}-${numbers.substring(3, 7)}-${numbers.substring(7, 11)}`;
  }

  // 서울 지역번호 (02)
  if (numbers.length === 10 && numbers.startsWith('02')) {
    return `${numbers.substring(0, 2)}-${numbers.substring(2, 6)}-${numbers.substring(6, 10)}`;
  }

  // 기타 지역번호 (031, 032, 등)
  if (numbers.length === 10) {
    return `${numbers.substring(0, 3)}-${numbers.substring(3, 6)}-${numbers.substring(6, 10)}`;
  }

  return phone;
}

/**
 * 간단한 모달 표시 (재사용)
 *
 * @param {string} title - 모달 제목
 * @param {string} content - 모달 내용 (HTML)
 */
function showModal(title, content) {
  // 기존 모달 제거
  const existingModal = document.getElementById('simpleModal');
  if (existingModal) {
    existingModal.remove();
  }

  // 모달 생성
  const modal = document.createElement('div');
  modal.id = 'simpleModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="close-btn" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'block';
}

/**
 * 모달 닫기
 */
function closeModal() {
  const modal = document.getElementById('simpleModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * 오늘 날짜 범위 계산
 *
 * @param {number} days - 시작일부터 며칠 전까지 (0 = 오늘만)
 * @returns {Object} { start: Date, end: Date }
 *
 * @example
 * getTodayRange(0)     // 오늘만
 * getTodayRange(7)     // 최근 7일
 */
function getTodayRange(days = 0) {
  const end = new Date();
  const start = new Date();
  if (days > 0) {
    start.setDate(start.getDate() - days + 1);
  }
  return { start, end };
}

/**
 * 콘솔 로그 유틸리티 (개발 모드에서만 출력)
 *
 * @param {string} type - 로그 타입 (info, success, error, warn)
 * @param {string} message - 로그 메시지
 * @param  {...any} args - 추가 인자
 */
function log(type, message, ...args) {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isDev) return;

  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warn: '⚠️',
    debug: '🔍',
  };

  const icon = prefix[type] || '📌';
  console.log(`${icon} ${message}`, ...args);
}

// 로그 헬퍼 함수들
window.logInfo = (msg, ...args) => log('info', msg, ...args);
window.logSuccess = (msg, ...args) => log('success', msg, ...args);
window.logError = (msg, ...args) => log('error', msg, ...args);
window.logWarn = (msg, ...args) => log('warn', msg, ...args);
window.logDebug = (msg, ...args) => log('debug', msg, ...args);
