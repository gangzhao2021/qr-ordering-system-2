const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#16382f"/>
  <path fill="#f7f3ea" d="M16 15h14v14H16V15Zm5 5v4h4v-4h-4Zm13-5h14v14H34V15Zm5 5v4h4v-4h-4ZM16 35h14v14H16V35Zm5 5v4h4v-4h-4Zm18-5h5v5h-5v-5Zm-5 5h5v5h-5v-5Zm10 5h5v5h-5v-5Zm-10 5h5v5h-5v-5Z"/>
</svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/svg+xml",
    },
  });
}
