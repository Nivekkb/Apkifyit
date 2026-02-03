import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.NEXT_OUTPUT === 'export') {
    return NextResponse.json({ error: 'API routes disabled for static export.' }, { status: 404 });
  }
  const { getJob, processQueue } = await import('@/lib/buildQueue');
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  processQueue().catch(console.error);
  return NextResponse.json({ job });
}
