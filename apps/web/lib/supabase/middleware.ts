import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          )

          response = NextResponse.next()

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const protectedRoutes = ['/dashboard', '/profile']

  const isProtected = protectedRoutes.some(path =>
    req.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user)
    return NextResponse.redirect(new URL('/login', req.url))

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*']
}