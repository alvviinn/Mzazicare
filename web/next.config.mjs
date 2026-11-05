/** @type {import('next').NextConfig} */
// Built as plain static files (`output: 'export'` -> out/), so it can be hosted free on Azure Static Web Apps.
// Every page runs in the browser and talks to the Django API at NEXT_PUBLIC_API_URL.
const nextConfig = { reactStrictMode: true, output: 'export', trailingSlash: true, images: { unoptimized: true } };

export default nextConfig;
