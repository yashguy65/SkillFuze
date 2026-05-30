import { NextResponse } from 'next/server';

export async function GET() {
  const springBootUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');
  const aiServiceUrl = process.env.AI_SERVICE_URL || process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';

  const [springResponse, aiResponse] = await Promise.all([
    fetch(`${springBootUrl}/health`, { cache: 'no-store' }).catch(() => null),
    fetch(`${aiServiceUrl}/health`, { cache: 'no-store' }).catch(() => null),
  ]);

  const isSpringUp = !!(springResponse && springResponse.ok);
  const isAiUp = !!(aiResponse && aiResponse.ok);

  return NextResponse.json({
    status: isSpringUp && isAiUp ? 'ok' : 'degraded',
    spring: isSpringUp,
    ai: isAiUp,
  });
}
