const fs = require('fs');
const path = require('path');

// 수정할 파일 목록
const files = [
  'js/transaction.js',
  'js/purchase.js',
  'js/quotation.js',
  'js/order.js',
  'js/customer.js',
  'js/supplier.js'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ 파일 없음: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: fetch with method but no credentials
  // fetch('url', { method: 'POST', headers: {...} }) -> add credentials
  const pattern1 = /fetch\([^,]+,\s*\{([^}]*method:\s*['"][^'"]+['"][^}]*)\}\)/g;

  content = content.replace(pattern1, (match) => {
    // 이미 credentials가 있으면 건너뜀
    if (match.includes('credentials:')) {
      return match;
    }

    // credentials 추가
    modified = true;
    return match.replace(/\{([^}]*)\}/, (m, inside) => {
      // headers 다음에 credentials 추가
      if (inside.includes('headers:')) {
        return `{${inside.trim()},\n      credentials: 'include',}`;
      } else {
        return `{${inside.trim()},\n      credentials: 'include'}`;
      }
    });
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 수정 완료: ${file}`);
  } else {
    console.log(`⏭️  수정 불필요: ${file}`);
  }
});

console.log('\n✅ 모든 파일 처리 완료');
