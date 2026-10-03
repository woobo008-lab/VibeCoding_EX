# AI 컬러 팔레트

테마 단어를 입력하면 Gemini가 어울리는 색상 5개를 만들어 주는 웹 앱입니다. 색상 카드를 눌러 HEX 코드를 복사할 수 있고, 복사되면 짧은 효과음과 알림이 나옵니다.

## 준비하기

1. [Node.js](https://nodejs.org/) 18 이상을 설치합니다.
2. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 Gemini API 키를 발급합니다.
3. 터미널에서 이 프로젝트 폴더로 이동합니다.

```powershell
cd C:\cjs\VibeCoding_EX\AI_C_Pallet
```

## 실행하기

PowerShell에서 API 키를 설정한 후 서버를 실행합니다.

```powershell
$env:GEMINI_API_KEY = "발급받은 API 키"
npm.cmd start
```

서버가 실행되면 브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 테마를 입력하고 **팔레트 생성**을 누르면 색상이 표시됩니다.

서버를 종료하려면 실행 중인 터미널에서 `Ctrl+C`를 누릅니다. 터미널을 닫았다가 다시 실행할 때는 API 키도 다시 설정해야 합니다.

## 사용 방법

- **팔레트 생성**: 테마 단어를 입력해 색상 5개를 만듭니다.
- **셔플**: 같은 테마로 다른 색상 조합을 요청합니다.
- **색상 복사**: 색상 카드를 클릭하거나 키보드로 선택한 뒤 `Enter` 또는 `Space`를 누르면 HEX 코드가 복사됩니다.

복사 기능은 브라우저의 클립보드 권한이 필요합니다. 효과음은 지원되는 브라우저에서 재생됩니다.

## 모델 설정 (선택 사항)

기본 모델은 Gemini Interactions API의 `gemini-3.1-flash-lite`입니다. 다른 사용 가능한 모델을 쓰려면 서버를 실행하기 전에 `GEMINI_MODEL`을 설정합니다.

```powershell
$env:GEMINI_MODEL = "사용할 모델 ID"
npm.cmd start
```

API 키와 모델 설정은 서버를 실행한 터미널의 환경 변수로 관리합니다. API 키를 코드나 저장소에 입력하지 마세요.

## 문제 해결

- **API 키 설정 오류**: `GEMINI_API_KEY`를 설정한 같은 터미널에서 `npm.cmd start`를 실행했는지 확인합니다.
- **HTTP 401 또는 403**: API 키가 올바른지, 해당 프로젝트에서 Gemini API를 사용할 권한이 있는지 확인합니다.
- **HTTP 404**: 모델 ID가 정확하고 Gemini API에서 지원되는지 확인합니다. `GEMINI_MODEL`을 변경했다면 서버를 다시 시작합니다.
- **HTTP 429**: 요청 한도나 사용량 할당량을 확인한 후 잠시 뒤 다시 시도합니다.
- **연결 또는 시간 초과**: 인터넷 연결과 Gemini 서비스 상태를 확인한 후 다시 시도합니다.
- **설정 변경이 반영되지 않음**: `Ctrl+C`로 서버를 종료한 다음 설정을 다시 하고 서버를 실행합니다.

화면에 표시된 오류 메시지에 Gemini의 상세 오류가 포함되어 있다면, 그 내용을 기준으로 설정을 확인하세요. API 키 자체는 다른 사람과 공유하지 마세요.

## 테스트

프로젝트 폴더에서 다음을 실행합니다.

```powershell
npm.cmd test
```

## 프로젝트 파일

- `index.html`: 웹 페이지 구조
- `styles.css`: 화면 디자인과 반응형 레이아웃
- `app.js`: 팔레트 생성, 색상 복사와 효과음
- `server.js`: 웹 서버와 Gemini API 연결
- `server.test.js`: 서버와 API 동작 테스트
