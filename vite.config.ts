import { defineConfig } from "vite";

// GitHub Pages 는 https://seohyunbum.github.io/YUNU_GAME/ 하위에 서빙되므로
// 프로덕션 빌드만 base 를 저장소 경로로 둔다. dev/테스트 하니스는 루트(/) 그대로.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/YUNU_GAME/" : "/",
}));
