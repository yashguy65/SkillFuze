import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{
    path: string[]
  }>
}

export async function handleProxy(req: NextRequest, props: RouteParams) {
  const { path } = await props.params;
  const springBootUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080')
  const joinedPath = path.join('/')
  const { search } = req.nextUrl
  const url = `${springBootUrl}/api/chat/${joinedPath}${search}`
  
  const headers = new Headers(req.headers)
  headers.delete('host')
  
  const requestOptions: RequestInit = {
    method: req.method,
    headers: headers,
  }
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestOptions.body = await req.text()
  }
  
  try {
    const res = await fetch(url, requestOptions)
    const data = await res.text()
    
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (error) {
    console.error(`Proxy failure to ${url}:`, error)
    return NextResponse.json({ error: 'Proxy failed to backend service' }, { status: 502 })
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PUT,
  handleProxy as DELETE,
  handleProxy as PATCH
}
