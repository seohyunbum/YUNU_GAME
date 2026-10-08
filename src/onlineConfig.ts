// 온라인(소셜) 기능 설정 — Firebase Realtime Database 프로젝트 연결 정보.
//
// ── 설정 방법 (1회, 약 10분 — 상세는 docs/party-system.md §9 Firebase 설정) ──
// 1. https://console.firebase.google.com 에서 프로젝트 만들기 (이름 자유, 애널리틱스 끔)
// 2. 빌드 → Realtime Database → 데이터베이스 만들기 (지역: asia-southeast1, 잠금 모드)
// 3. 빌드 → Authentication → 시작하기 → 로그인 방법 → 익명 사용 설정 (규칙이 모든 쓰기에 로그인을 요구)
// 4. 프로젝트 설정(톱니) → 일반 → 내 앱 → 웹 앱(</>) 추가 → 표시되는 firebaseConfig 값을 아래에 붙여넣기
// 5. 밸런스 관리자 페이지의 관리자 ID 를 Realtime Database 데이터 탭 admins/{ID} = true 로 등록
// 6. Realtime Database → 규칙 탭에 저장소 루트 database.rules.json 내용을 붙여넣고 게시
//
// 이 키들은 공개되어도 되는 클라이언트 식별자다(접근 제어는 DB 규칙 database.rules.json 이 담당).
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
