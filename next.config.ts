import type { NextConfig } from "next";

/**
 * Note on the math tools: they used to be static pages under public/math/ and
 * are now Next routes (app/math/fraction-addition and friends). The static
 * copies were removed because anything under public/ is served before any layout
 * runs and `proxy.ts` skips paths with a file extension, so those URLs answered
 * to anyone — no session, no subject, no topic, no per-school tool scope. There
 * are deliberately no redirects for the old *.html URLs: this deploys to a fresh
 * server, so there are no old links to keep working.
 */
const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  output: "standalone",
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
