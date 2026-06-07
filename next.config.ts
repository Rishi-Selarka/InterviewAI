import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Strict Mode double-invokes effects in development, which makes the
  // VideoSDK meeting connection join twice (duplicate participant tiles). The
  // VideoSDK React integration does not support that double-invoke, so we disable
  // Strict Mode. The meeting join is still guarded to be idempotent in
  // src/features/video/MeetingView.tsx.
  reactStrictMode: false,
};

export default nextConfig;
