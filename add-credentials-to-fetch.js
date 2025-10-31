const fs = require('fs');
const path = require('path');

// 수정할 파일
const filePath = path.join(__dirname, 'js', 'transaction.js');

let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
const modifiedLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  // await fetch( 로 시작하는 줄 찾기
  if (line.trim().match(/const\s+\w+\s+=\s+await\s+fetch\(/)) {
    // 이미 credentials가 있는지 체크
    let hasCredentials = false;
    let j = i;

    // 다음 5줄 정도 확인
    while (j < Math.min(i + 5, lines.length)) {
      if (lines[j].includes('credentials:')) {
        hasCredentials = true;
        break;
      }
      if (lines[j].includes(');')) break;
      j++;
    }

    // credentials가 없고, 단순 fetch(url) 형태인 경우
    if (!hasCredentials && line.includes(');')) {
      // fetch(url); -> fetch(url, { credentials: 'include' });
      modifiedLines.push(line.replace(');', ', { credentials: \'include\' });'));
      console.log(`✅ Line ${i + 1}: 단순 fetch에 credentials 추가`);
      i++;
      continue;
    }

    // credentials가 없고, fetch(url, { 형태인 경우 (다음 줄에 옵션이 있음)
    if (!hasCredentials && (line.includes(', {') || lines[i + 1]?.trim() === '{')) {
      modifiedLines.push(line);
      i++;

      // 옵션 객체 안에서 적절한 위치 찾기
      let foundHeaders = false;
      while (i < lines.length) {
        const currentLine = lines[i];
        modifiedLines.push(currentLine);

        // headers 다음에 credentials 추가
        if (currentLine.includes('headers:') && !foundHeaders) {
          foundHeaders = true;
          // headers 객체가 끝나는 곳 찾기
          let depth = 0;
          let headerEndIndex = i;
          for (let k = i; k < lines.length; k++) {
            if (lines[k].includes('{')) depth++;
            if (lines[k].includes('}')) {
              depth--;
              if (depth === 0) {
                headerEndIndex = k;
                break;
              }
            }
          }

          // headers 끝난 다음 줄에 credentials 추가
          if (headerEndIndex > i) {
            i = headerEndIndex;
            modifiedLines.push(lines[i]);
            modifiedLines.push("      credentials: 'include', // 세션 쿠키 포함");
            console.log(`✅ Line ${i + 1}: headers 다음에 credentials 추가`);
            i++;
            continue;
          }
        }

        // fetch 옵션 객체가 끝나면 빠져나감
        if (currentLine.includes('});')) {
          break;
        }

        i++;
      }
      i++;
      continue;
    }
  }

  modifiedLines.push(line);
  i++;
}

fs.writeFileSync(filePath, modifiedLines.join('\n'), 'utf8');
console.log('\n✅ transaction.js 수정 완료!');
