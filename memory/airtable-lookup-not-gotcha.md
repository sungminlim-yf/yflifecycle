---
name: airtable-lookup-not-gotcha
description: Airtable formula 함정 — 체크박스 lookup에 NOT()을 쓰면 항상 false. !=1 비교를 써라
metadata: 
  node_type: memory
  type: reference
  originSessionId: 34fbf19a-f00e-4b75-b7c0-ce3ac4282213
---

Airtable formula에서 **체크박스(또는 단일값) lookup 필드에 `NOT()`을 직접 쓰면 안 된다.**

lookup은 값을 항상 **배열**로 반환한다. 연결된 레코드가 있으면 체크박스가 꺼져 있어도 `[null]`(또는 `[0]`)이 든 배열을 돌려준다. `NOT()`은 "내용이 있는 배열"을 truthy로 취급하므로 → 연결 레코드가 있는 모든 행에서 `NOT(lookup)` = false. 결과적으로 식 전체가 항상 false가 된다.

**증상**: lookup을 조건에 넣은 formula가 (참이어야 할 행 포함) 전부 0/false.

**해결**: `NOT({lookup})` 대신 **`{lookup} != 1`** (또는 `= 1`) 비교를 쓴다. 비교 연산자는 단일값 lookup을 스칼라로 강제 변환하므로 정상 동작한다.
- 체크됨 `[1]` → `1 != 1` = false (hold → 출하불가)
- 꺼짐 `[null]` → `null != 1` = true (통과)
- 연결 없음(게스트) `빈 배열` → blank != 1 = true (통과)

실제 적용 사례: 오더 테이블 `출하 가능`(fldeJ55Vgc1N8qufE) = `AND({오더 상태}='접수', NOT({오더 Hold}), {고객 Hold (from 고객)}!=1)`. `오더 Hold`는 이 테이블의 **진짜 체크박스**라 `NOT()` 정상 / `고객 Hold (from 고객)`는 **lookup**이라 `!=1` 필수. (2026-05-31 발견·수정)

이 base는 lookup·rollup·formula가 많으니(`airtable-base` 참조) 다른 체크박스 lookup 조건에도 동일 패턴 적용. 참고로 MCP `create_field`는 lookup/rollup 생성 불가, `update_field`는 singleSelect 옵션 변경 불가 → 그건 UI 작업.
