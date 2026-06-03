import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: { size: string } }
) {
  const size = parseInt(params.size) || 192

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
          borderRadius: size * 0.18,
        }}
      >
        <div
          style={{
            fontSize: size * 0.52,
            lineHeight: 1,
          }}
        >
          ✨
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
