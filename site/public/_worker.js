/**
 * Cloudflare Pages _worker.js
 * Proxies /proxy/gateway/* to Railway for ALL HTTP methods (GET, POST, PUT, DELETE, PATCH).
 * Everything else is served from Cloudflare Pages static assets (respects _redirects).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/proxy/gateway/')) {
      const path = url.pathname.replace('/proxy/gateway', '')
      const targetUrl = `https://backforge.up.railway.app${path}${url.search}`

      const headers = new Headers(request.headers)
      headers.delete('host')
      headers.delete('cf-connecting-ip')
      headers.delete('cf-ipcountry')
      headers.delete('cf-ray')
      headers.delete('cf-visitor')

      const isBodyMethod = !['GET', 'HEAD'].includes(request.method.toUpperCase())

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: isBodyMethod ? request.body : undefined,
        redirect: 'follow',
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }

    // Serve static assets (applies _redirects, SPA fallback, etc.)
    return env.ASSETS.fetch(request)
  },
}
