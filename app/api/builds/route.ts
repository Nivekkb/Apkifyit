import { NextRequest, NextResponse } from 'next/server';
type BuildPlan = 'free' | 'pro' | 'studio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.NEXT_OUTPUT === 'export') {
    return NextResponse.json({ error: 'API routes disabled for static export.' }, { status: 404 });
  }
  const [{ listJobs, processQueue }, { getQuotaSnapshot }] = await Promise.all([
    import('@/lib/buildQueue'),
    import('@/lib/buildQuota')
  ]);
  processQueue().catch(console.error);
  const jobs = await listJobs();
  const userId = req.headers.get('x-user-id') || '';
  const deviceId = req.headers.get('x-device-id') || '';
  const planHeader = req.headers.get('x-plan');
  const plan: BuildPlan = planHeader === 'pro' || planHeader === 'studio' ? planHeader : 'free';
  const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const ip = ipHeader.split(',')[0].trim();
  const snapshot = await getQuotaSnapshot({ userId, deviceId, ip, plan });
  return NextResponse.json({ jobs, quota: snapshot });
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Failed to queue build';

export async function POST(req: NextRequest) {
  if (process.env.NEXT_OUTPUT === 'export') {
    return NextResponse.json({ error: 'API routes disabled for static export.' }, { status: 404 });
  }
  try {
    const [{ createJob }, { consumeQuota }] = await Promise.all([
      import('@/lib/buildQueue'),
      import('@/lib/buildQuota')
    ]);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const keystoreFile = formData.get('keystore') as File | null;
    const ksAlias = formData.get('ksAlias') as string | null;
    const ksPass = formData.get('ksPass') as string | null;
    const ksKeyPass = formData.get('ksKeyPass') as string | null;
    const skipZipAlign = formData.get('skipZipAlign') === 'true';
    const userId = req.headers.get('x-user-id') || '';
    const deviceId = req.headers.get('x-device-id') || '';
    const planHeader = req.headers.get('x-plan');
    const plan: BuildPlan = planHeader === 'pro' || planHeader === 'studio' ? planHeader : 'free';
    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const ip = ipHeader.split(',')[0].trim();

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const quotaCheck = await consumeQuota({ userId, deviceId, ip, plan });
    if (!quotaCheck.allowed) {
      const message =
        quotaCheck.reason === 'ip-rate-limit'
          ? 'Too many builds from this network in the last hour. Try again later.'
          : 'Weekly build limit reached for this account or device.';
      return NextResponse.json(
        { error: message, quota: quotaCheck.snapshot },
        { status: 429 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const keystoreBytes = keystoreFile ? Buffer.from(await keystoreFile.arrayBuffer()) : undefined;

    const job = await createJob({
      filename: file.name,
      zipBuffer: bytes,
      keystoreBuffer: keystoreBytes,
      keystoreAlias: ksAlias || undefined,
      keystorePass: ksPass || undefined,
      keystoreKeyPass: ksKeyPass || undefined,
      skipZipAlign
    });

    return NextResponse.json({ job, quota: quotaCheck.snapshot }, { status: 202 });
  } catch (error: unknown) {
    console.error('Queue build failed:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
