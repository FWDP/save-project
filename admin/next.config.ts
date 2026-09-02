import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The JavaScript compiler API keeps clean-checkout verification reliable
    // in restricted runners while preserving full TypeScript build checks.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
