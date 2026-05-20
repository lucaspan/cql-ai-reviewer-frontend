import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // e.g. https://dev-shr-ue1-aws-apigw01.devhcloud.bmogc.net/jdev-sbx/api
  const apiBaseUrl = env.VITE_API_BASE_URL;
  const url = new URL(apiBaseUrl);
  const proxyTarget = url.origin; // https://dev-shr-ue1-aws-apigw01.devhcloud.bmogc.net
  const apiPath = url.pathname; // /jdev-sbx/api
  const apiHost = env.VITE_API_HOST; // 3yp41aaw87.execute-api.us-east-1.amazonaws.com

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            Host: apiHost,
          },
          rewrite: (path) => path.replace(/^\/api/, apiPath),
        },
      },
    },
  };
});
