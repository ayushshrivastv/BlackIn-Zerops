import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyToBackend(request: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    const backendBase = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000').replace(
        /\/+$/,
        '',
    );
    const target = new URL(`${backendBase}/api/v1/${path.map(encodeURIComponent).join('/')}`);
    target.search = request.nextUrl.search;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
        redirect: 'manual',
        cache: 'no-store',
        signal: request.signal,
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
export const OPTIONS = proxyToBackend;
