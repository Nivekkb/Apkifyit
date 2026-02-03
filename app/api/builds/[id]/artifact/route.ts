import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.NEXT_OUTPUT === 'export') {
    return NextResponse.json({ error: 'API routes disabled for static export.' }, { status: 404 });
  }
  const { getArtifactPath, getJob } = await import('@/lib/buildQueue');
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  if (!job.artifact) {
    return NextResponse.json({ error: 'Artifact not available' }, { status: 404 });
  }
  const artifactPath = getArtifactPath(job);
  if (!artifactPath || !existsSync(artifactPath)) {
    return NextResponse.json({ error: 'Artifact missing on disk' }, { status: 404 });
  }
  const buffer = await readFile(artifactPath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${job.artifact.name}"`,
      'X-APK-Size': job.artifact.size.toString(),
      'X-APK-SHA256': job.artifact.sha256,
    }
  });
}
