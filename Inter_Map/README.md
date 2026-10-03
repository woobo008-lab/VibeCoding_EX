# Inter_Map

React, Vite, Leaflet으로 만든 지도 메모 앱입니다. 지도를 클릭해 카테고리가 있는 메모 핀을 만들고, 핀은 브라우저 로컬 저장소에 자동 저장됩니다.

## 실행

```bash
npm install
npm run dev
```

개발 서버를 실행해야 JSON 파일 저장 기능도 사용할 수 있습니다. JSON 내보내기는 프로젝트의 `json` 폴더에 날짜가 포함된 파일로 저장하며, JSON 가져오기는 같은 폴더에 있는 파일 목록에서 선택합니다. 가져온 핀은 기존 핀에 추가됩니다.

## 기술 정보

- 일반 지도: OpenStreetMap
- 위성 이미지: Esri World Imagery
- 지도 표시 및 상호작용: Leaflet, React-Leaflet
- 개발 서버 JSON API: Vite 서버 미들웨어
