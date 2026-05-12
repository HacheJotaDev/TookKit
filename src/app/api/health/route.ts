import { NextResponse } from 'next/server'


export async function GET() {
  let dbStatus = 'not_configured'
  
  try {
    const { prisma, hasDatabaseUrl } = await import('@/lib/prisma')
    if (hasDatabaseUrl) {
      await prisma.$queryRaw`SELECT 1`
      dbStatus = 'connected'
    }
  } catch {
    dbStatus = 'error'
  }

  return NextResponse.json({
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  })
}
