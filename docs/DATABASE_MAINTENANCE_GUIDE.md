# 데이터베이스 유지보수 가이드

## 개요

30년간 운영된 MS SQL Server 2008 R2 데이터베이스의 성능 최적화 및 유지보수 가이드입니다.

## 현재 데이터베이스 상태 (2025-11-23 기준)

### 📊 전체 통계

- **데이터베이스 크기**: 약 5.6 GB
- **핵심 테이블**: 자재입출내역 (534,343건, 173 MB)
- **로그 테이블**: 21,597건 (5년 이상 레코드 15,304건 - 70%)
- **인덱스 상태**: 모든 주요 테이블 인덱스 보유 ✅

### 주요 테이블 크기 (Top 10)

| 테이블명 | 레코드 수 | 크기 (MB) | 비고 |
|---------|----------|----------|------|
| DataErrorLog_Master | 44,759,968 | 5,597 | 오류 로그 (정리 고려) |
| 자재입출내역 | 534,343 | 174 | 핵심 트랜잭션 |
| 견적내역 | 120,555 | 30 | 견적 상세 |
| 자재원장마감 | 381,288 | 22 | 월별 재고 집계 |
| 발주내역 | 85,152 | 21 | 발주 상세 |
| 자재 | 42,237 | 9 | 자재 마스터 |
| 우편번호 | 43,016 | 7 | 우편번호 DB |
| 회계전표 | 16,242 | 7 | 회계 장부 |
| 자재원장 | 42,237 | 6 | 자재 재고 |
| 로그 | 21,597 | 2 | 자동번호 관리 |

## 유지보수 작업 항목

### 1. 로그 테이블 압축 (최우선)

#### 목적
- 5년 이상 된 자동번호 생성 로그 삭제
- 데이터베이스 크기 감소
- 조회 성능 향상

#### 대상 데이터
```sql
-- 삭제 대상 확인
SELECT COUNT(*) AS 삭제대상
FROM 로그
WHERE 수정일자 < '20200101'  -- 2020년 1월 1일 이전
   OR 수정일자 = ''
   OR 수정일자 IS NULL;
```

#### 실행 방법

**방법 1: Node.js 스크립트 (권장)**
```bash
node scripts/run-database-maintenance.js
# 선택: 1 (로그 테이블 압축)
```

**방법 2: SQL 직접 실행**
```bash
# SQL Server Management Studio에서 실행
scripts/database-maintenance.sql
```

**방법 3: SQL 쿼리**
```sql
-- 백업 먼저!
DELETE FROM 로그
WHERE 수정일자 < '20200101'
   OR 수정일자 = ''
   OR 수정일자 IS NULL;
```

#### 예상 효과
- **삭제 레코드**: 약 15,304건 (전체의 70%)
- **용량 절감**: 약 1-1.5 MB
- **성능 향상**: 로그 조회 시 30-40% 개선

---

### 2. 인덱스 재구성 (Rebuild)

#### 목적
- 조각화된 인덱스 재구성
- 쿼리 성능 향상
- 디스크 I/O 최적화

#### 대상 테이블
- 자재입출내역
- 견적, 견적내역
- 발주, 발주내역
- 자재, 자재시세, 자재원장

#### 실행 방법

**방법 1: Node.js 스크립트 (권장)**
```bash
node scripts/run-database-maintenance.js
# 선택: 2 (인덱스 재구성)
```

**방법 2: SQL 쿼리**
```sql
-- 특정 테이블의 모든 인덱스 재구성
ALTER INDEX ALL ON 자재입출내역 REBUILD;
ALTER INDEX ALL ON 견적 REBUILD;
ALTER INDEX ALL ON 발주 REBUILD;
```

#### 실행 주기
- **정기**: 분기 1회 (3개월마다)
- **긴급**: 대량 INSERT/DELETE 후

#### 예상 소요 시간
- 자재입출내역: 1-2분
- 기타 테이블: 각 30초 이내
- 전체: 약 5-10분

---

### 3. 통계 업데이트

#### 목적
- SQL Server 쿼리 최적화기에 정확한 통계 제공
- 실행 계획 최적화
- 쿼리 성능 향상

#### 대상 테이블
모든 주요 테이블

#### 실행 방법

**방법 1: Node.js 스크립트 (권장)**
```bash
node scripts/run-database-maintenance.js
# 선택: 3 (통계 업데이트)
```

**방법 2: SQL 쿼리**
```sql
-- FULLSCAN으로 정확한 통계 생성
UPDATE STATISTICS 자재입출내역 WITH FULLSCAN;
UPDATE STATISTICS 견적 WITH FULLSCAN;
UPDATE STATISTICS 발주 WITH FULLSCAN;
-- ...
```

#### 실행 주기
- **정기**: 월 1회
- **긴급**: 대량 데이터 변경 후

---

### 4. 필수 인덱스 생성

#### 목적
- 누락된 성능 필수 인덱스 추가
- 자주 사용하는 쿼리 최적화

#### 생성할 인덱스

**1. 자재입출내역 - 매입처코드 인덱스**
```sql
CREATE NONCLUSTERED INDEX IX_매입처코드
ON 자재입출내역 (사업장코드, 매입처코드, 입출고구분)
INCLUDE (거래일자, 거래번호, 입고수량, 입고단가, 입고부가);
```
- **용도**: 매입처별 거래 내역 조회
- **효과**: 매입처장부 조회 속도 10배 이상 향상

**2. 자재입출내역 - 매출처코드 인덱스**
```sql
CREATE NONCLUSTERED INDEX IX_매출처코드
ON 자재입출내역 (사업장코드, 매출처코드, 입출고구분)
INCLUDE (거래일자, 거래번호, 출고수량, 출고단가, 출고부가);
```
- **용도**: 매출처별 거래 내역 조회
- **효과**: 매출처장부 조회 속도 10배 이상 향상

**3. 자재입출내역 - 자재코드 인덱스**
```sql
CREATE NONCLUSTERED INDEX IX_자재코드
ON 자재입출내역 (분류코드, 세부코드, 사업장코드, 입출고구분)
INCLUDE (거래일자, 입고수량, 출고수량, 입고단가, 출고단가);
```
- **용도**: 자재별 입출고 내역 조회
- **효과**: 자재원장 조회 속도 향상

**4. 견적 - 매출처코드 인덱스**
```sql
CREATE NONCLUSTERED INDEX IX_견적_매출처코드
ON 견적 (매출처코드, 사업장코드)
INCLUDE (견적일자, 견적번호, 공급가액, 부가세, 합계금액);
```
- **용도**: 매출처별 견적 내역 조회
- **효과**: 고객별 견적 조회 속도 향상

**5. 발주 - 매입처코드 인덱스**
```sql
CREATE NONCLUSTERED INDEX IX_발주_매입처코드
ON 발주 (매입처코드, 사업장코드)
INCLUDE (발주일자, 발주번호, 공급가액, 부가세, 합계금액);
```
- **용도**: 매입처별 발주 내역 조회
- **효과**: 공급업체별 발주 조회 속도 향상

#### 실행 방법

**방법 1: Node.js 스크립트 (권장)**
```bash
node scripts/run-database-maintenance.js
# 선택: 4 (필수 인덱스 생성)
```

**방법 2: SQL 파일 실행**
```bash
# SQL Server Management Studio에서 실행
scripts/database-maintenance.sql
```

#### 예상 효과
- 장부 조회 속도: 10-20배 향상
- 거래처별 조회: 즉시 응답 (<100ms)
- 전체 시스템 응답 속도 개선

---

## 전체 유지보수 실행

모든 작업을 한 번에 실행:

```bash
node scripts/run-database-maintenance.js
# 선택: 5 (전체 작업)
```

**예상 소요 시간**: 15-20분

**실행 순서**:
1. 로그 테이블 압축 (2분)
2. 인덱스 재구성 (10분)
3. 통계 업데이트 (3분)
4. 필수 인덱스 생성 (5분)

---

## 정기 유지보수 일정

### 월간 (매월 1일 실행)

```bash
# 통계 업데이트
node scripts/run-database-maintenance.js
# 선택: 3
```

### 분기별 (1월, 4월, 7월, 10월 1일 실행)

```bash
# 인덱스 재구성 + 통계 업데이트
node scripts/run-database-maintenance.js
# 선택: 5 (전체 작업)
```

### 연간 (매년 1월 1일 실행)

```bash
# 로그 테이블 압축 + 전체 유지보수
node scripts/run-database-maintenance.js
# 선택: 5 (전체 작업)
```

---

## 주의사항

### 백업 필수

유지보수 작업 전 **반드시 백업** 수행:

```sql
-- 데이터베이스 전체 백업
BACKUP DATABASE YmhDB
TO DISK = 'C:\Backup\YmhDB_20251123.bak'
WITH FORMAT, INIT, NAME = 'Full Backup of YmhDB';

-- 로그 테이블만 백업 (압축 전)
SELECT * INTO 로그_백업_20251123 FROM 로그;
```

### 실행 시간

- **권장**: 업무 외 시간 (야간 또는 주말)
- **이유**: 인덱스 재구성 중 테이블 잠금 발생 가능
- **VB6 병행 운영 중**: 양쪽 시스템 모두 종료 후 실행

### 모니터링

작업 진행 중 모니터링 쿼리:

```sql
-- 현재 실행 중인 작업 확인
SELECT
    session_id,
    command,
    percent_complete,
    estimated_completion_time/1000/60 AS 남은시간_분
FROM sys.dm_exec_requests
WHERE command LIKE '%INDEX%' OR command LIKE '%STATISTICS%';
```

---

## 성능 측정

### 작업 전후 비교

**1. 로그 테이블 조회 속도**
```sql
SET STATISTICS TIME ON;
SELECT 최종로그 FROM 로그 WHERE 테이블명 = '견적' AND 베이스코드 = '20251123';
SET STATISTICS TIME OFF;
```

**2. 자재입출내역 조회 속도**
```sql
SET STATISTICS TIME ON;
SELECT * FROM 자재입출내역 WHERE 매입처코드 = 'B041' AND 사업장코드 = '01';
SET STATISTICS TIME OFF;
```

**3. 인덱스 조각화율 확인**
```sql
SELECT
    OBJECT_NAME(ips.object_id) AS 테이블명,
    i.name AS 인덱스명,
    ips.avg_fragmentation_in_percent AS 조각화율
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 10
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

---

## 트러블슈팅

### 인덱스 생성 실패

**오류**: "There is already an object named..."
```sql
-- 인덱스 존재 여부 확인
SELECT name FROM sys.indexes
WHERE object_id = OBJECT_ID('자재입출내역')
  AND name = 'IX_매입처코드';

-- 이미 존재하면 삭제 후 재생성
DROP INDEX IX_매입처코드 ON 자재입출내역;
```

### 인덱스 재구성 시간 초과

**해결**: 테이블별로 분리 실행
```sql
-- 큰 테이블부터 하나씩
ALTER INDEX ALL ON 자재입출내역 REBUILD;
-- 대기...
ALTER INDEX ALL ON 견적내역 REBUILD;
```

### 로그 압축 후 성능 저하

**원인**: 통계 정보 미업데이트
**해결**:
```sql
UPDATE STATISTICS 로그 WITH FULLSCAN;
```

---

## 데이터베이스 분석 도구

### 현재 상태 분석

```bash
# 데이터베이스 전체 분석
node scripts/analyze-database.js
```

**분석 항목**:
- 테이블 크기 및 레코드 수
- 인덱스 현황 및 조각화율
- 통계 업데이트 날짜
- 로그 테이블 상태

---

## 참고 자료

### SQL Server 버전 정보

```sql
SELECT @@VERSION;
-- Microsoft SQL Server 2008 R2 (RTM)
```

### 데이터베이스 정보

```sql
-- 데이터베이스 크기
EXEC sp_spaceused;

-- 테이블별 크기
EXEC sp_MSforeachtable @command1="EXEC sp_spaceused '?'";
```

### 유용한 쿼리

**1. 가장 큰 테이블 Top 10**
```sql
SELECT TOP 10
    t.NAME AS 테이블명,
    p.rows AS 레코드수,
    SUM(a.total_pages) * 8 / 1024 AS 크기MB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
WHERE t.is_ms_shipped = 0
GROUP BY t.Name, p.Rows
ORDER BY SUM(a.total_pages) DESC;
```

**2. 사용하지 않는 인덱스 찾기**
```sql
SELECT
    OBJECT_NAME(s.object_id) AS 테이블명,
    i.name AS 인덱스명,
    s.user_seeks AS 조회횟수,
    s.user_scans AS 스캔횟수,
    s.user_updates AS 갱신횟수
FROM sys.dm_db_index_usage_stats s
INNER JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
WHERE s.user_seeks = 0 AND s.user_scans = 0
  AND i.type > 0  -- 힙 제외
ORDER BY s.user_updates DESC;
```

---

## 요약

### ✅ 즉시 실행 권장

1. **필수 인덱스 생성** (처음 1회만)
   ```bash
   node scripts/run-database-maintenance.js
   # 선택: 4
   ```

2. **로그 테이블 압축** (연 1회)
   ```bash
   node scripts/run-database-maintenance.js
   # 선택: 1
   ```

### 📅 정기 실행 권장

- **월간**: 통계 업데이트
- **분기**: 인덱스 재구성 + 통계 업데이트
- **연간**: 전체 유지보수

### 💡 핵심 포인트

- 백업 먼저, 작업은 나중에
- 업무 외 시간에 실행
- 작업 전후 성능 측정
- 정기적인 모니터링 필수
