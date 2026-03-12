import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) =>
    initOpenNextCloudflareForDev(),
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
