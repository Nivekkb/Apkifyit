import { NextRequest, NextResponse } from 'next/server';
type BuildPlan = 'free' | 'pro' | 'studio';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Internal Server Error';

export async function POST(req: NextRequest) {
  if (process.env.NEXT_OUTPUT === 'export') {
    return NextResponse.json({ error: 'API routes disabled for static export.' }, { status: 404 });
  }
  try {
    const [{ runAndroidBuild }, { consumeQuota }] = await Promise.all([
      import('@/lib/buildRunner'),
      import('@/lib/buildQuota')
    ]);
    const formData = await req.formData();
    const file = formData.get('file') as File;
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

    const bytes = await file.arrayBuffer();
    const keystoreBytes = keystoreFile ? Buffer.from(await keystoreFile.arrayBuffer()) : undefined;
    const result = await runAndroidBuild({
      zipBuffer: Buffer.from(bytes),
      keystore: keystoreBytes && ksAlias && ksPass ? {
        buffer: keystoreBytes,
        alias: ksAlias,
        pass: ksPass,
        keyPass: ksKeyPass || undefined
      } : undefined,
      skipZipAlign
    });

    return new NextResponse(new Uint8Array(result.apkBuffer), {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${result.apkName}" `,
        'X-APK-Size': result.apkBuffer.length.toString(),
        'X-APK-SHA256': result.sha256,
      },
    });

  } catch (error: unknown) {
    console.error('Conversion error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
