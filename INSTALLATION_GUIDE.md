# 제이씨엠전기 웹 판매관리시스템 설치 가이드

**작성일**: 2025-11-17
**대상**: 제이씨엠전기 시스템 관리자
**목적**: VB 시스템과 병행 운영하며 웹 버전 설치

---

## 📋 목차

1. [사전 준비사항](#1-사전-준비사항)
2. [데이터베이스 백업](#2-데이터베이스-백업)
3. [데이터베이스 무결성 테스트](#3-데이터베이스-무결성-테스트)
4. [웹 서버 설치](#4-웹-서버-설치)
5. [애플리케이션 배포](#5-애플리케이션-배포)
6. [환경 설정](#6-환경-설정)
7. [데이터베이스 스키마 업데이트](#7-데이터베이스-스키마-업데이트)
8. [초기 테스트](#8-초기-테스트)
9. [병행 운영 가이드](#9-병행-운영-가이드)
10. [문제 해결](#10-문제-해결)

---

## 1. 사전 준비사항

### 1.1 시스템 요구사항

**서버 환경**:
- Windows Server 2012 이상 (또는 Windows 10/11)
- SQL Server 2012 이상
- 최소 4GB RAM (8GB 권장)
- 최소 10GB 여유 디스크 공간

**네트워크 요구사항**:
- 고정 IP 주소 (내부 네트워크)
- 방화벽 포트 개방: 3000 (Node.js), 1433 (SQL Server)

**소프트웨어 요구사항**:
- Node.js v18 이상 (LTS 버전 권장)
- Git for Windows (선택사항)

### 1.2 설치 체크리스트

- [ ] 관리자 권한 확보
- [ ] 기존 VB 시스템 백업 완료
- [ ] 데이터베이스 백업 완료
- [ ] Node.js 설치 파일 다운로드
- [ ] 웹 애플리케이션 소스 코드 준비
- [ ] 네트워크 접근 권한 확인

---

## 2. 데이터베이스 백업

### 2.1 전체 데이터베이스 백업

**⚠️ 중요**: 설치 작업 전 반드시 데이터베이스 전체 백업을 수행하세요.

#### SQL Server Management Studio (SSMS) 백업 방법:

```sql
-- 1. YmhDB 데이터베이스 우클릭 → Tasks → Back Up...

-- 또는 T-SQL 스크립트 실행:
BACKUP DATABASE [YmhDB]
TO DISK = 'C:\Backup\YmhDB_Backup_20251117.bak'
WITH
    FORMAT,
    MEDIANAME = 'YmhDB_Backup',
    NAME = 'Full Backup of YmhDB - 2025-11-17',
    COMPRESSION,
    STATS = 10;
```

**백업 파일 저장 위치**: `C:\Backup\YmhDB_Backup_YYYYMMDD.bak`

#### 백업 검증:

```sql
-- 백업 파일 내용 확인
RESTORE VERIFYONLY
FROM DISK = 'C:\Backup\YmhDB_Backup_20251117.bak';
```

### 2.2 중요 테이블 개별 백업 (선택사항)

```sql
-- 중요 테이블 데이터 CSV 백업
-- 1. 사용자 테이블
SELECT * FROM 사용자
WHERE 사용구분 = 0;

-- 2. 계정과목 테이블
SELECT * FROM 계정과목
WHERE 사용구분 = 0;

-- 3. 최근 1년 거래내역
SELECT * FROM 자재입출내역
WHERE 거래일자 >= '20240101' AND 사용구분 = 0;
```

**결과를 CSV로 저장**: Results → Save Results As... → CSV

---

## 3. 데이터베이스 무결성 테스트

### 3.1 데이터베이스 일관성 검사

```sql
-- YmhDB 데이터베이스 무결성 검사
USE YmhDB;
GO

DBCC CHECKDB (YmhDB) WITH NO_INFOMSGS;
```

**예상 결과**:
```
CHECKDB found 0 allocation errors and 0 consistency errors in database 'YmhDB'.
DBCC execution completed. If DBCC printed error messages, contact your system administrator.
```

### 3.2 테이블별 데이터 검증

```sql
-- 1. 계정과목 데이터 검증
SELECT
    COUNT(*) AS 총계정수,
    SUM(CASE WHEN 사용구분 = 0 THEN 1 ELSE 0 END) AS 활성계정수,
    SUM(CASE WHEN 합계시산표연결여부 = 'Y' THEN 1 ELSE 0 END) AS 시산표연결계정수
FROM 계정과목;

-- 2. 자재 데이터 검증
SELECT
    COUNT(*) AS 총자재수,
    SUM(CASE WHEN 사용구분 = 0 THEN 1 ELSE 0 END) AS 활성자재수
FROM 자재;

-- 3. 거래내역 데이터 검증 (최근 1개월)
SELECT
    입출고구분,
    CASE WHEN 입출고구분 = 1 THEN '매입'
         WHEN 입출고구분 = 2 THEN '매출'
         ELSE '기타' END AS 구분명,
    COUNT(*) AS 건수,
    SUM(CASE WHEN 입출고구분 = 1 THEN 입고수량 * 입고단가
             WHEN 입출고구분 = 2 THEN 출고수량 * 출고단가 END) AS 총금액
FROM 자재입출내역
WHERE 거래일자 >= CONVERT(VARCHAR(8), DATEADD(MONTH, -1, GETDATE()), 112)
  AND 사용구분 = 0
GROUP BY 입출고구분;

-- 4. 사용자 계정 검증
SELECT
    COUNT(*) AS 총사용자수,
    SUM(CASE WHEN 사용구분 = 0 THEN 1 ELSE 0 END) AS 활성사용자수,
    SUM(CASE WHEN 로그인여부 = 'Y' THEN 1 ELSE 0 END) AS 현재로그인사용자수
FROM 사용자;
```

### 3.3 저장 프로시저 검증

```sql
-- sp합계시산표 저장 프로시저 테스트
EXEC sp합계시산표 @ParBranchCode = '01', @ParDate = '20251117';

-- 결과 확인:
-- - 매입/매출 계정의 계정코드가 정상적으로 표시되는지 확인
-- - 차변/대변 합계가 일치하는지 확인
```

---

## 4. 웹 서버 설치

### 4.1 Node.js 설치

1. **다운로드**:
   - https://nodejs.org/ko/ 접속
   - LTS 버전 다운로드 (v18.x 이상)

2. **설치**:
   ```cmd
   # 다운로드한 node-v18.x.x-x64.msi 실행
   # "Add to PATH" 옵션 체크
   # 설치 완료 후 확인:
   node --version
   npm --version
   ```

3. **예상 출력**:
   ```
   v18.19.0
   10.2.3
   ```

### 4.2 필요한 도구 설치 (선택사항)

```cmd
# Git 설치 (버전 관리용)
# https://git-scm.com/download/win

# PM2 설치 (프로세스 관리 - 운영 환경 권장)
npm install -g pm2
```

---

## 5. 애플리케이션 배포

### 5.1 소스 코드 배포

**방법 1: USB/파일 복사**
```cmd
# 소스 코드를 다음 경로에 복사:
C:\inetpub\wwwroot\sales-management-api\
```

**방법 2: Git Clone (Git 설치된 경우)**
```cmd
cd C:\inetpub\wwwroot\
git clone [저장소 URL] sales-management-api
cd sales-management-api
```

### 5.2 Node.js 의존성 설치

```cmd
cd C:\inetpub\wwwroot\sales-management-api
npm install
```

**예상 출력**:
```
added 150 packages, and audited 151 packages in 15s
found 0 vulnerabilities
```

---

## 6. 환경 설정

### 6.1 환경 변수 파일 생성

```cmd
cd C:\inetpub\wwwroot\sales-management-api
copy .env.template .env
notepad .env
```

### 6.2 .env 파일 설정

```env
# 데이터베이스 설정
DB_USER=sa
DB_PASSWORD=실제DB비밀번호입력
DB_SERVER=localhost
DB_DATABASE=YmhDB
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# 서버 설정
PORT=3000
NODE_ENV=production
BASE_PATH=/sales-management-api

# 보안 설정 (운영 환경용으로 변경 필요!)
SESSION_SECRET=변경필요-랜덤문자열-최소32자
JWT_SECRET=변경필요-랜덤문자열-최소32자
JWT_EXPIRES_IN=24h

# CORS 설정 (서버 IP로 변경)
ALLOWED_ORIGINS=http://localhost:3000,http://서버IP주소:3000,http://127.0.0.1:3000
```

**⚠️ 중요**:
- `DB_PASSWORD`: 실제 SQL Server sa 계정 비밀번호 입력
- `SESSION_SECRET`, `JWT_SECRET`: 운영 환경에서는 반드시 강력한 랜덤 문자열로 변경
- `ALLOWED_ORIGINS`: 서버의 실제 IP 주소로 변경

### 6.3 데이터베이스 연결 테스트

```cmd
cd C:\inetpub\wwwroot\sales-management-api
node scripts/test-db.js
```

**성공 시 출력**:
```
✅ 데이터베이스 연결 성공!
서버: localhost
데이터베이스: YmhDB
```

**실패 시**:
- DB_USER, DB_PASSWORD 확인
- SQL Server가 실행 중인지 확인
- 방화벽에서 1433 포트 개방 확인

---

## 7. 데이터베이스 스키마 업데이트

### 7.1 필수 스키마 변경사항

#### 1) 사용자 비밀번호 해싱 (보안 강화)

**⚠️ 주의**: 기존 VB 시스템과의 호환성을 위해 선택적으로 적용하세요.

```sql
-- 현재 사용자 비밀번호 확인
SELECT 사용자코드, 사용자명, LEN(비밀번호) AS 비밀번호길이
FROM 사용자
WHERE 사용구분 = 0;

-- bcrypt 해시 길이는 60자
-- 만약 LEN(비밀번호) < 20 이면 평문 비밀번호
```

**비밀번호 해싱 스크립트 실행** (선택사항):
```cmd
# 주의: 실행 전 반드시 백업 완료 확인!
node scripts/migrate-passwords.js
```

#### 2) sp합계시산표 저장 프로시저 업데이트

```cmd
# SQL Server Management Studio에서 실행:
# 파일 열기: sp합계시산표_수정본.sql
# 실행 (F5)
```

**변경 내용**:
- 매입/매출 계정을 계정과목 테이블에서 실제 데이터로 가져오기
- 계정코드 빈 문자열 문제 해결

**검증**:
```sql
-- 저장 프로시저 실행 테스트
EXEC sp합계시산표 @ParBranchCode = '01', @ParDate = '20251117';

-- 매입/매출 행에 계정코드가 표시되는지 확인 (예: 3000, 4000)
```

---

## 8. 초기 테스트

### 8.1 서버 시작

#### 개발 모드 (테스트용):
```cmd
cd C:\inetpub\wwwroot\sales-management-api
npm start
```

#### 운영 모드 (PM2 사용 - 권장):
```cmd
cd C:\inetpub\wwwroot\sales-management-api
pm2 start server.js --name "sales-api"
pm2 save
pm2 startup
```

**예상 출력**:
```
Server running on port 3000
Database connected successfully
```

### 8.2 웹 브라우저 접속 테스트

1. **로컬 접속**:
   ```
   http://localhost:3000/sales-management-api/index.html
   ```

2. **네트워크 접속** (다른 PC에서):
   ```
   http://서버IP주소:3000/sales-management-api/index.html
   ```

3. **로그인 테스트**:
   - 사용자 ID: (기존 VB 시스템 계정)
   - 비밀번호: (기존 VB 시스템 비밀번호)

### 8.3 기능별 테스트 체크리스트

#### 8.3.1 기본 기능
- [ ] 로그인/로그아웃
- [ ] 대시보드 통계 조회
- [ ] 매출처/매입처 목록 조회

#### 8.3.2 매출관리
- [ ] 견적서 조회
- [ ] 견적서 작성 (테스트 데이터)
- [ ] 견적서 출력
- [ ] 거래명세서 조회
- [ ] 거래명세서 작성
- [ ] 거래명세서 CSV 내보내기

#### 8.3.3 매입관리
- [ ] 발주서 조회
- [ ] 발주서 작성
- [ ] 발주서 출력
- [ ] 매입전표 조회
- [ ] 매입전표 작성

#### 8.3.4 재고관리
- [ ] 자재 목록 조회
- [ ] 자재 등록/수정
- [ ] 재고 현황 조회

#### 8.3.5 장부관리
- [ ] 일계표 조회
- [ ] 일계표 CSV 내보내기
- [ ] 현금출납관리 조회
- [ ] 현금출납관리 전표 작성
- [ ] 합계잔액시산표 조회
- [ ] 합계잔액시산표 상세보기 (매입/매출/현금)
- [ ] 합계잔액시산표 CSV 내보내기
- [ ] 합계잔액시산표 출력

#### 8.3.6 시스템관리
- [ ] 계정과목 조회/등록
- [ ] 사업장 관리
- [ ] 사용자 관리

---

## 9. 병행 운영 가이드

### 9.1 병행 운영 전략

**목적**: VB 시스템과 웹 시스템을 동시 운영하며 점진적으로 웹 시스템으로 전환

#### Phase 1: 조회 기능 사용 (1주일)
- VB 시스템: 계속 사용 (입력/수정/삭제)
- 웹 시스템: **조회 전용**으로 사용
- 목표: 웹 시스템 안정성 확인, 사용자 적응

#### Phase 2: 특정 업무 전환 (2주일)
- VB 시스템: 핵심 업무 계속 사용
- 웹 시스템: 다음 기능 실제 사용 시작
  - 견적서 작성
  - 거래명세서 작성
  - 매입전표 작성
- 목표: 데이터 일관성 확인

#### Phase 3: 전체 전환 (1개월 후)
- VB 시스템: 백업/참조용
- 웹 시스템: 메인 시스템으로 전환

### 9.2 데이터 일관성 유지 방법

**⚠️ 중요**: 두 시스템이 같은 데이터베이스를 공유하므로 데이터 충돌 방지 필요

#### 규칙 1: 동일 문서 동시 수정 금지
```
예: 견적서 20251117-1을 VB에서 수정 중이면 웹에서 조회만 가능
```

#### 규칙 2: 일일 데이터 정합성 검증
```sql
-- 매일 업무 종료 후 실행
-- 1. 합계잔액시산표 차변/대변 일치 확인
EXEC sp합계시산표 @ParBranchCode = '01', @ParDate = CONVERT(VARCHAR(8), GETDATE(), 112);

-- 2. 재고 수량 일치 확인
SELECT 분류코드, 세부코드, 자재명, 현재고
FROM 자재원장
WHERE 사업장코드 = '01' AND 현재고 < 0;  -- 음수 재고 확인

-- 3. 미지급금/미수금 잔액 확인
-- (미구현 기능 - 추후 개발 예정)
```

#### 규칙 3: 로그 테이블 공유 주의
```sql
-- 로그 테이블(번호 생성)은 두 시스템이 공유
-- VB와 웹에서 동시에 같은 날짜에 문서 작성 시 번호 중복 가능성 있음
-- 해결: 업무 분리 (예: VB는 오전, 웹은 오후)
```

### 9.3 데이터 백업 정책

**일일 백업** (업무 종료 후):
```cmd
# Windows 작업 스케줄러에 등록
# 매일 18:00 실행
sqlcmd -S localhost -U sa -P 비밀번호 -Q "BACKUP DATABASE [YmhDB] TO DISK = 'C:\Backup\YmhDB_Daily_%date:~0,4%%date:~5,2%%date:~8,2%.bak' WITH FORMAT, COMPRESSION"
```

**주간 백업** (매주 일요일):
```
# 별도 외장 하드디스크 또는 네트워크 드라이브에 복사
copy C:\Backup\YmhDB_Daily_*.bak D:\WeeklyBackup\
```

---

## 10. 문제 해결

### 10.1 로그인 실패

**증상**: "로그인 실패" 메시지

**원인 및 해결**:

1. **비밀번호 불일치**
   ```sql
   -- VB 시스템의 평문 비밀번호 확인
   SELECT 사용자코드, 사용자명, 비밀번호
   FROM 사용자
   WHERE 사용자코드 = '입력한사용자코드';
   ```

2. **bcrypt 해싱 적용 후 로그인 실패**
   ```cmd
   # 비밀번호 재설정
   node scripts/hash-password.js "새비밀번호"
   # 출력된 해시값을 데이터베이스에 수동 업데이트
   ```

### 10.2 데이터베이스 연결 실패

**증상**: "Database connection failed"

**해결 방법**:

1. **SQL Server 실행 확인**
   ```cmd
   # Services.msc 실행
   # "SQL Server (MSSQLSERVER)" 서비스 확인
   ```

2. **방화벽 설정**
   ```cmd
   # Windows Defender 방화벽
   # 인바운드 규칙 추가: TCP 1433 포트 허용
   ```

3. **SQL Server 인증 모드 확인**
   ```sql
   -- SSMS에서 확인:
   -- 서버 우클릭 → Properties → Security
   -- "SQL Server and Windows Authentication mode" 선택
   ```

### 10.3 합계잔액시산표 차변/대변 불일치

**증상**: "차변합계 ≠ 대변합계" 경고

**원인**:
- 회계전표 입력 오류
- 자재입출내역 데이터 누락

**해결**:
```sql
-- 1. 차변/대변 합계 확인
EXEC sp합계시산표 @ParBranchCode = '01', @ParDate = '20251117';

-- 2. 현금 계정 거래내역 확인
SELECT 작성일자, 입출구분, 계정코드, 계정명, 입금금액, 출금금액, 적요
FROM 회계전표내역
WHERE 계정코드 = '1000'  -- 현금 계정
  AND 작성일자 >= '20251101'
  AND 사용구분 = 0
ORDER BY 작성일자 DESC;

-- 3. 매입/매출 거래내역 확인
SELECT 거래일자, 입출고구분,
       CASE WHEN 입출고구분 = 1 THEN '매입' ELSE '매출' END AS 구분,
       입고수량 * 입고단가 AS 매입금액,
       출고수량 * 출고단가 AS 매출금액
FROM 자재입출내역
WHERE 거래일자 >= '20251101'
  AND 사용구분 = 0
ORDER BY 거래일자 DESC;
```

### 10.4 웹 페이지 접속 불가

**증상**: "This site can't be reached"

**해결**:

1. **서버 실행 확인**
   ```cmd
   # Node.js 프로세스 확인
   tasklist | findstr node.exe

   # PM2 상태 확인 (PM2 사용 시)
   pm2 status
   ```

2. **포트 충돌 확인**
   ```cmd
   netstat -ano | findstr :3000
   # 다른 프로그램이 3000 포트 사용 중이면 .env의 PORT 변경
   ```

3. **방화벽 설정**
   ```cmd
   # Windows Defender 방화벽
   # 인바운드 규칙 추가: TCP 3000 포트 허용
   ```

### 10.5 한글 깨짐 (CSV 내보내기)

**증상**: CSV 파일을 Excel에서 열면 한글이 깨져 보임

**해결**:
- 현재 코드는 UTF-8 BOM 포함하여 저장됨 (한글 깨짐 방지)
- Excel 2016 이상에서는 자동 인식
- Excel 2013 이하: "데이터 → 텍스트 파일 가져오기 → UTF-8 선택"

### 10.6 상세보기 모달 오류

**증상**: 매출 상세보기 클릭 시 매입 데이터 표시

**해결**:
- sp합계시산표 저장 프로시저 업데이트 확인
- 브라우저 캐시 삭제 (Ctrl + F5)
- 콘솔 로그 확인 (F12 → Console 탭)

---

## 11. 연락처 및 지원

### 11.1 기술 지원

**시스템 개발자**: 장준호
**이메일**: (이메일 주소 입력)
**지원 시간**: 평일 09:00 - 18:00

### 11.2 긴급 문제 대응

**긴급 연락처**: (휴대폰 번호 입력)

**긴급 상황 정의**:
- 시스템 완전 다운
- 데이터베이스 접속 불가
- 중요 데이터 손실

### 11.3 추가 참고 자료

- **프로젝트 문서**: `CLAUDE.md`
- **세션 관리 가이드**: `SESSION_AND_PERMISSION_GUIDE.md`
- **자재 테이블 조인 가이드**: `MATERIAL_TABLE_JOIN_PATTERN.md`
- **재고 마감 가이드**: `MATERIAL_LEDGER_CLOSING.md`

---

## 12. 체크리스트 요약

### 설치 전 체크리스트
- [ ] 데이터베이스 전체 백업 완료
- [ ] 데이터베이스 무결성 검사 완료
- [ ] Node.js 설치 완료
- [ ] 소스 코드 배포 완료
- [ ] .env 환경 설정 완료

### 설치 후 체크리스트
- [ ] 데이터베이스 연결 테스트 성공
- [ ] 저장 프로시저 업데이트 완료
- [ ] 로그인 테스트 성공
- [ ] 주요 기능 테스트 완료 (견적, 발주, 거래명세서, 매입전표)
- [ ] 합계잔액시산표 정상 조회 확인
- [ ] 네트워크 접속 테스트 완료

### 병행 운영 체크리스트
- [ ] 사용자 교육 완료
- [ ] 업무 분리 규칙 수립
- [ ] 일일 백업 스케줄 설정
- [ ] 데이터 정합성 검증 프로세스 수립

---

## 부록 A: SQL Server 방화벽 설정

### Windows Defender 방화벽 규칙 추가

```cmd
# 관리자 권한 명령 프롬프트에서 실행

# SQL Server 포트 (1433) 개방
netsh advfirewall firewall add rule name="SQL Server" dir=in action=allow protocol=TCP localport=1433

# Node.js 웹 서버 포트 (3000) 개방
netsh advfirewall firewall add rule name="Sales API" dir=in action=allow protocol=TCP localport=3000
```

---

## 부록 B: PM2 프로세스 관리 명령어

```cmd
# 서버 시작
pm2 start server.js --name "sales-api"

# 서버 중지
pm2 stop sales-api

# 서버 재시작
pm2 restart sales-api

# 서버 삭제
pm2 delete sales-api

# 로그 확인
pm2 logs sales-api

# 상태 확인
pm2 status

# Windows 재부팅 후 자동 시작 설정
pm2 save
pm2 startup
```

---

## 부록 C: 데이터베이스 복원 절차 (긴급 시)

```sql
-- 1. 기존 연결 종료
USE master;
GO
ALTER DATABASE YmhDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

-- 2. 백업 파일로 복원
RESTORE DATABASE YmhDB
FROM DISK = 'C:\Backup\YmhDB_Backup_20251117.bak'
WITH REPLACE, RECOVERY;
GO

-- 3. 다중 사용자 모드로 전환
ALTER DATABASE YmhDB SET MULTI_USER;
GO

-- 4. 복원 확인
USE YmhDB;
GO
SELECT COUNT(*) FROM 사용자;
SELECT COUNT(*) FROM 자재입출내역;
```

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-17
**작성자**: Claude Code Assistant
