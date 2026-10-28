import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DEV-ONLY local bypass (never active on Vercel preview/prod builds).
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next({
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

  // Skip auth for NextAuth routes, assets, login, public charts,
  // the MC proxy (/api/mc/*), gateway health, and the MCP manager
  // — the proxy attaches the MC x-mc-token server-side so the
  // browser never sees it.
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/mc') ||
    pathname.startsWith('/api/dashboard') ||
    pathname.startsWith('/api/board') ||
    pathname.startsWith('/api/mcp') ||
    pathname.startsWith('/api/gateway-health') ||
    pathname.startsWith('/api/garden') ||
    pathname.startsWith('/api/agents') ||
    pathname.startsWith('/api/agent-bus') ||
    pathname.startsWith('/api/hermes/') ||
    pathname.startsWith('/api/home') ||
    pathname.startsWith('/api/hq/') ||
    pathname.startsWith('/api/terminal') ||
    pathname.startsWith('/api/artifacts') ||
    pathname.startsWith('/api/workspaces') ||
    pathname.startsWith('/api/upload') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/login'
  ) {
    return NextResponse.next({
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

  // Allow internal agent calls with shared secret
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && internalSecret === process.env.INTERNAL_API_SECRET) {
    return NextResponse.next({
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

  // Check NextAuth JWT session
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    redirect.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return redirect;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
