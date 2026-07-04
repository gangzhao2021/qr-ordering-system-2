const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@qr2/shared"],
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3001";
    return [{ source: "/v1/:path*", destination: `${api}/v1/:path*` }];
  },
};

export default nextConfig;
