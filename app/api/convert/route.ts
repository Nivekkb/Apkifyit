import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  const tempDir = join(os.tmpdir(), `apkifyit-${Date.now()}`);
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const keystoreFile = formData.get('keystore') as File | null;
    const ksAlias = formData.get('ksAlias') as string | null;
    const ksPass = formData.get('ksPass') as string | null;
    const ksKeyPass = formData.get('ksKeyPass') as string | null;
    const skipZipAlign = formData.get('skipZipAlign') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    await mkdir(tempDir, { recursive: true });

    const zipPath = join(tempDir, 'input.zip');
    const apkPath = join(tempDir, 'input.apk');
    const bytes = await file.arrayBuffer();
    await writeFile(zipPath, Buffer.from(bytes));
    await writeFile(apkPath, Buffer.from(bytes));

    const outDir = join(tempDir, 'out');
    await mkdir(outDir, { recursive: true });

    let command = `java -jar /home/code/uber-apk-signer.jar -a ${apkPath} -o ${outDir}`;

    if (skipZipAlign) {
      command += ' --skipZipAlign';
    }

    if (keystoreFile && ksAlias && ksPass) {
      const ksPath = join(tempDir, 'user.keystore');
      const ksBytes = await keystoreFile.arrayBuffer();
      await writeFile(ksPath, Buffer.from(ksBytes));
      command += ` --ks ${ksPath} --ksAlias ${ksAlias} --ksPass ${ksPass}`;
      if (ksKeyPass) {
        command += ` --ksKeyPass ${ksKeyPass}`;
      }
    }

    await execPromise(command);

    const files = await execPromise(`ls ${outDir}`);
    const signedApkName = files.stdout.trim().split('\n').find(f => f.endsWith('.apk'));
    
    if (!signedApkName) {
      throw new Error('Failed to generate signed APK. Ensure the ZIP is a valid Android project structure or APK.');
    }

    const signedApkPath = join(outDir, signedApkName);
    const signedApkBuffer = await readFile(signedApkPath);

    // Extract SHA-256 hash for verification
    let sha256 = "Unknown";
    try {
      const verifyOutput = await execPromise(`java -jar /home/code/uber-apk-signer.jar -y -a ${signedApkPath} --verbose`);
      const match = verifyOutput.stdout.match(/SHA256: ([a-fA-F0-9: ]+)/);
      if (match) sha256 = match[1].trim();
    } catch (e) {
      console.error('Verification error:', e);
    }
    
    return new NextResponse(signedApkBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${signedApkName}" `,
        'X-APK-Size': signedApkBuffer.length.toString(),
        'X-APK-SHA256': sha256,
      },
    });

  } catch (error: any) {
    console.error('Conversion error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  } finally {
    rm(tempDir, { recursive: true, force: true }).catch(console.error);
  }
}
