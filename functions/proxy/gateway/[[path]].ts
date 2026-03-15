/**
 * Cloudflare Pages Function — proxy /proxy/gateway/* → Railway backend
 * Supports all HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS)
 */
export async function onRequest({
  request,
}: {
  request: Request
}): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/proxy\/gateway/, '') || '/'
  const targetUrl = `https://backforge.up.railway.app${path}${url.search}`

  // Strip Cloudflare-injected headers that would confuse the upstream
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
