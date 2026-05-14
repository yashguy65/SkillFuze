import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    
    // Get the base URL for the AI service
    const aiServiceUrl = process.env.AI_SERVICE_URL || process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000'
    
    const response = await fetch(`${aiServiceUrl}/api/v1/ingest/linkedin`, {
      method: 'POST',
      body: formData,
      // Note: Do not set Content-Type header when passing FormData, fetch will automatically
      // set it to multipart/form-data with the correct boundary
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI Service Error:', response.status, errorText)
      return NextResponse.json(
        { detail: `AI service returned status ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('LinkedIn proxy error:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
