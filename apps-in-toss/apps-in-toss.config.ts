import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "wolgeup-simulator",
  brand: {
    // 월급루팡 시뮬레이터 브랜드 컬러 (노랑)
    primaryColor: "#ffd23f",
  },
  permissions: [],
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
    allowsInlineMediaPlayback: true,
  },
});
