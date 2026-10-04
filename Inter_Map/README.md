# Inter_Map

React, Vite, Leaflet으로 만든 지도 메모 앱입니다. 지도를 클릭해 카테고리가 있는 메모 핀을 만들고, 핀은 브라우저 로컬 저장소에 자동 저장됩니다.

## 실행

```bash
npm install
npm run dev
```

핀 목록에서 JSON을 다운로드해 백업하거나, JSON 파일을 선택해 가져올 수 있습니다. 가져온 핀은 현재 목록에 추가되며 새 ID가 지정됩니다.

## 배포

저장소의 `master` 브랜치에 푸시하면 GitHub Actions가 사이트를 빌드하고 `dist`를 GitHub Pages에 배포합니다. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정해야 합니다. 수동 배포는 Actions 탭에서 **Deploy to GitHub Pages** 워크플로의 **Run workflow**를 실행하세요.

로컬에서 빌드할 수도 있습니다.

```bash
npm run build
```

빌드 결과는 `dist`에 생성됩니다. `dist/index.html`은 배포 진입점이며, 앱 자산 경로는 저장소 하위 경로에서도 동작하도록 상대 경로로 생성됩니다.

핀은 브라우저별 로컬 저장소에 저장되므로 다른 브라우저나 기기와 자동 동기화되지 않습니다. 브라우저 간 핀 이동은 한 브라우저에서 JSON을 내보낸 뒤 다른 브라우저에서 해당 파일을 가져오세요.

## 기술 정보

- 일반 지도: OpenStreetMap
- 위성 이미지: Esri World Imagery
- 지도 표시 및 상호작용: Leaflet, React-Leaflet
- 브라우저 저장소 및 JSON 파일 다운로드/가져오기
