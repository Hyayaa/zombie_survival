# AGENTS.md

## 프로젝트

이 저장소는 실시간 탑뷰 픽셀 좀비 생존 웹게임이다.

기존 녹픽던 또는 nokpick-dungeon-expanded 프로젝트와 완전히 무관한 독립 프로젝트다.
다른 저장소의 코드, 에셋, 브랜치, 설계를 가져오거나 수정하지 않는다.

기술 구성:

- Phaser 3
- TypeScript
- Vite
- Vitest
- HTML/CSS
- localStorage
- GitHub Pages

## Git 작업 기준

저장소:

- Hyayaa/zombie_survival

현재 개발 브랜치:

- feature/vertical-slice

현재 Draft PR:

- #1

별도 지시가 없다면:

- 새 브랜치를 만들지 않는다.
- 새 Pull Request를 만들지 않는다.
- main에 병합하지 않는다.
- 강제 push하지 않는다.
- 현재 feature/vertical-slice 브랜치에 이어서 작업한다.
- ZIP 파일을 다운로드하거나 결과물로 만들지 않는다.

작업 시작 시 반드시 실행한다.

```bash
git status
git branch --show-current
git fetch origin
git log --oneline origin/main -5
git log --oneline origin/feature/vertical-slice -5
```

working tree가 clean인지 먼저 확인한다.

원격 변경을 받을 때는 다음만 사용한다.

```bash
git pull --ff-only origin feature/vertical-slice
```

## 현재 주요 시스템

이미 구현된 다음 시스템을 불필요하게 다시 설계하지 않는다.

- 128×128 대형 도시 맵
- 가로·세로·대각선 도로
- 대각선 건물과 문
- 마우스 휠 카메라 확대·축소
- 커서 방향 카메라 이동
- 낮·밤 방향성 시야
- 타일당 8×8 픽셀 전장의 안개
- full map 전장의 안개
- local minimap 확대·축소
- 구조 가능한 동료 4명
- 동료 formation, pathfinding, catch-up
- 일반 좀비와 runner
- 좀비의 문·바리케이드 공격
- 문과 바리케이드 체력
- 코드 기반 PixelEffectSystem
- WorldObjectRegistry
- InteractionSystem
- 단일 상호작용 대상 흰색 외곽선
- 개발자 모드
- 제작 시스템
- 저장과 불러오기
- GitHub Pages

기존 구조를 유지할 수 있다면 전면 재작성보다 국소적인 수정을 우선한다.

## 코드 작업 원칙

- 관련 파일부터 읽고 수정한다.
- 화면 표현과 게임 규칙을 분리한다.
- 모든 게임 규칙을 WorldScene 하나에 몰아넣지 않는다.
- 매 프레임 불필요한 배열 생성, filter, map, sort를 피한다.
- 공격 이펙트에 외부 sprite를 사용하지 않는다.
- 픽셀 렌더링에서 antialias와 blur를 사용하지 않는다.
- 외곽선과 이펙트는 retained object 또는 pool을 사용한다.
- gameplay RNG와 visual RNG를 분리한다.
- 기존 save migration을 함부로 제거하지 않는다.
- 기존 테스트를 삭제하거나 약화해서 통과시키지 않는다.

## 검증

변경 전후 다음 명령을 사용한다.

```bash
npm install
npm run typecheck
npm run test
npm run build
```

브라우저 플레이 검증:

```bash
npm run dev
```

production 검증:

```bash
npm run build
npm run preview
```

커밋 전에 반드시 실행한다.

```bash
git status
git diff --check
npm run typecheck
npm run test
npm run build
```

## 커밋과 push

- 변경은 1~3개의 논리적인 커밋으로 정리한다.
- 의미 없는 중간 커밋을 많이 만들지 않는다.
- 별도 지시가 있을 때만 push한다.
- push 대상은 feature/vertical-slice다.
- 기존 Draft PR #1을 사용한다.
- 새 PR을 만들지 않는다.
