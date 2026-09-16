/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.aladin.co.kr',
      },
      {
        protocol: 'http',
        hostname: 'image.aladin.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'lib.jnu.ac.kr',
      },
      {
        protocol: 'http',
        hostname: 'lib.jnu.ac.kr',
      }
    ],
  },
};

export default nextConfig;
