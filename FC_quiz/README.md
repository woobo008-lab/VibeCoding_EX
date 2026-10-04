# AI 용어 플래시카드

인공지능 핵심 용어 10개를 한 장씩 학습하는 브라우저 플래시카드 앱입니다.

## 실행

`index.html`을 Chrome 등 브라우저에서 열면 학습을 시작할 수 있습니다. Google Drive 저장은 Google OAuth 보안 정책에 따라 설정된 Client ID와 HTTPS 배포 주소가 필요합니다. 스크립트는 브라우저의 `file://` 보안 정책에서 차단될 수 있는 ES 모듈 대신 순서가 지정된 일반 스크립트로 로드됩니다.

## 사용 방법

- 한 번에 한 용어를 보고, 카드를 누르면 뜻과 설명을 확인합니다.
- `암기함`을 누르면 해당 카드가 현재 카드 목록에서 제거됩니다.
- `다시 볼래요`를 누르면 해당 카드를 덱의 맨 뒤로 보냅니다.
- 남은 카드와 암기 완료 수, 진행률 표시줄로 학습 상황을 확인합니다.
- 모든 카드를 암기한 뒤 `위키백과에서 새 카드 10장 만들기`를 누르면 검색 결과로 새 카드 10장을 가져옵니다. 새 카드 생성에는 인터넷 연결이 필요하며, 현재 덱과 겹치는 용어는 제외합니다.
- 새 카드의 답은 위키데이터 한국어 짧은 설명을 우선 사용하고, 설명이 없으면 위키백과 문서의 첫 문장을 간결하게 사용합니다. 문서 요약은 보충 설명으로 표시됩니다.
- `Drive 연결`을 처음 누르면 Google Drive에서 직접 만든 `FC_quiz` 폴더를 선택합니다. 선택한 폴더는 이 브라우저에 기억되며, 이후 `Drive 저장`을 누르면 `ai-flashcards-날짜-시간.json`(예: `ai-flashcards-20261004-1617.json`) 이름의 새 파일을 그 폴더에 만듭니다. 저장할 때마다 다른 파일이 생겨 이전 덱이 보존되며, 같은 분에 다시 저장하면 그 파일만 갱신합니다. `Drive 불러오기`를 누르면 파일 선택 창에서 저장된 파일을 골라 확인 후 현재 덱을 교체합니다.
- 위키백과 기반 카드에는 원문 링크와 CC BY-SA 4.0 출처 표시가 포함됩니다.
- 학습 시작, 카드 뒤집기, 복습, 암기 시 한국어 안내 음성으로 용어와 동작을 읽어 줍니다. 읽기 속도는 2배이며, 상단 버튼으로 안내 음성을 끄거나 다시 켤 수 있습니다.
- 모바일 화면 및 키보드 포커스 지원

## Google Drive 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 선택하거나 새로 만든 다음 **API 및 서비스 → 라이브러리**에서 **Google Drive API**와 **Google Picker API**를 각각 사용 설정합니다.
2. [사용자 인증 정보 페이지](https://console.cloud.google.com/apis/credentials)에서 **사용자 인증 정보 만들기 → API 키**를 선택합니다. 생성된 API Key를 복사합니다.
3. API Key 목록에서 방금 만든 키를 열어 다음처럼 제한한 뒤 저장합니다.
   - **애플리케이션 제한사항:** 웹사이트
   - **웹사이트 제한사항:** `https://woobo008-lab.github.io/*` 와 `https://docs.google.com/*` 를 각각 추가합니다. Picker 창이 `docs.google.com` 안에서 열리므로 두 번째 주소도 꼭 필요합니다.
   - **API 제한사항:** 키 제한을 선택하고 **Google Picker API**와 **Google Drive API**를 허용합니다.
4. **Google Auth Platform → 브랜딩 / 대상**에서 OAuth 동의 화면을 설정하고, 앱을 테스트 중이면 사용할 Google 계정을 테스트 사용자로 추가합니다.
5. **Google Auth Platform → 클라이언트 → 클라이언트 만들기**에서 **웹 애플리케이션** 클라이언트를 만듭니다. **승인된 JavaScript 원본**에 `https://woobo008-lab.github.io` 를 추가합니다. 페이지 경로(`/VibeCoding_EX/FC_quiz/`)는 원본에 넣지 않습니다.
6. [Google Drive 설정](https://developers.google.com/drive/picker/guides/web-picker)에 필요한 Cloud 프로젝트 번호를 확인한 뒤 `js/google-drive-config.js`에 `clientId`, `apiKey`, `appId`를 입력합니다. 현재 `clientId`와 `appId`는 등록되어 있으며, 위에서 만든 **API Key만 `apiKey`에 추가**하면 됩니다. Client ID와 API Key는 브라우저용 공개 식별자입니다. OAuth 클라이언트 비밀 정보는 만들거나 앱에 넣지 않습니다.
7. GitHub 저장소에서 Pages를 **GitHub Actions** 배포로 설정하고 `main` 브랜치에 변경 사항을 푸시하면 앱이 `https://woobo008-lab.github.io/VibeCoding_EX/FC_quiz/`에 배포됩니다. 같은 저장소의 다른 프로젝트와 루트 홈페이지도 함께 배포됩니다.

앱은 `drive.file` 권한만 요청합니다. 첫 연결 때 Google Picker에서 이름이 정확히 `FC_quiz`인 폴더를 선택하고, 폴더 ID는 현재 브라우저에 저장됩니다. 액세스 토큰은 메모리에만 보관되며 페이지를 새로고침하면 Drive에 다시 연결해야 합니다.

## 소스 구조

- `js/flashcards.js`: 플래시카드 데이터와 학습 진행 상태
- `js/ui.js`: 카드 앞뒤 표시와 진행 상황 렌더링
- `js/narration.js`: 브라우저 음성 합성 API를 이용한 한국어 안내 음성
- `js/wikipedia.js`: 위키백과 검색, 위키데이터 짧은 설명 조회 및 새 카드 10장 생성
- `js/deck-io.js`: Google Drive 카드 덱 검증
- `js/google-drive.js`: Google OAuth 인증 및 Drive 덱 저장·불러오기
- `js/google-drive-config.js`: 공개 OAuth Client ID 설정
- `js/main.js`: 버튼 동작과 학습 흐름 연결
- `style.css`: 화면 스타일
- `index.html`: 앱의 화면 구조

용어와 뜻은 `js/flashcards.js`의 `flashcards` 배열에서 수정할 수 있습니다.
