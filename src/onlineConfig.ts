// 온라인(소셜) 기능 설정 — Firebase Realtime Database 프로젝트 연결 정보.
//
// ── 설정 방법 (1회, 약 5분) ──
// 1. https://console.firebase.google.com 에서 프로젝트 만들기 (이름 자유, 애널리틱스 끔)
// 2. 빌드 → Realtime Database → 데이터베이스 만들기 (지역: asia-southeast1, 테스트 모드)
// 3. 프로젝트 설정(톱니) → 일반 → 내 앱 → 웹 앱(</>) 추가 → 표시되는 firebaseConfig 값을 아래에 붙여넣기
// 4. Realtime Database → 규칙 탭에 docs/party-system.md 의 규칙을 붙여넣고 게시
//
// 이 키들은 공개되어도 되는 클라이언트 식별자다(접근 제어는 DB 규칙이 담당).
// null 이면: 배포본에선 소셜 기능 비활성(코드 초대만 가능), 개발 모드에선 같은 브라우저 탭끼리 동작.

export interface FirebaseConfigShape {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
}

export const FIREBASE_CONFIG: FirebaseConfigShape | null = {
  apiKey: "AIzaSyCXZExNPvC7CE59E2IYaciCiYkfaWGIgjM",
  authDomain: "yunu-game.firebaseapp.com",
  databaseURL: "https://yunu-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "yunu-game",
  appId: "1:266454335125:web:13826697c8a03db9fde59c",
};
