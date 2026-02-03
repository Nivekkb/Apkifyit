import { writeFile, mkdir, readFile, rm, cp, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import AdmZip from 'adm-zip';

const execPromise = promisify(exec);

export type KeystoreInput = {
  buffer: Buffer;
  alias?: string;
  pass?: string;
  keyPass?: string;
};

export type BuildOptions = {
  zipBuffer: Buffer;
  keystore?: KeystoreInput;
  skipZipAlign?: boolean;
};

export type BuildResult = {
  apkBuffer: Buffer;
  apkName: string;
  sha256: string;
};

const resolveSignerJar = () => {
  const candidates = [
    process.env.APKSIGNER_JAR,
    process.env.APK_SIGNER_JAR,
    join(process.cwd(), 'uber-apk-signer.jar'),
    join(process.cwd(), '..', 'uber-apk-signer.jar')
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`APK signer JAR not found. Tried: ${candidates.join(', ')}`);
};

export const runAndroidBuild = async (options: BuildOptions): Promise<BuildResult> => {
  const tempDir = join(os.tmpdir(), `droidforge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    const jarPath = resolveSignerJar();

    await mkdir(tempDir, { recursive: true });

    const zipPath = join(tempDir, 'input.zip');
    const apkPath = join(tempDir, 'input.apk');
    await writeFile(zipPath, options.zipBuffer);
    await writeFile(apkPath, options.zipBuffer);

    const zip = new AdmZip(options.zipBuffer);
    const isBundle = !!zip.getEntry('droidforge.bundle.json');
    let unsignedApkPath = apkPath;

    if (isBundle) {
      const templateDir = join(process.cwd(), 'android-template');
      if (!existsSync(templateDir)) {
        throw new Error('Android template missing. Expected android-template folder in build engine.');
      }

      const buildDir = join(tempDir, 'android-project');
      await cp(templateDir, buildDir, { recursive: true });
      await rm(join(buildDir, 'app/src/main/java/com/droidforge/template'), {
        recursive: true,
        force: true
      });

      const readZipText = (name: string) => {
        const entry = zip.getEntry(name);
        return entry ? entry.getData().toString('utf8') : '';
      };

      const bundleMeta = JSON.parse(readZipText('droidforge.bundle.json') || '{}');
      const project = JSON.parse(readZipText('project.json') || '{}');
      const buildSettings = JSON.parse(readZipText('build-settings.json') || '{}');

      const appName = bundleMeta.name || project.name || 'DroidForge Studio App';
      const packageName = buildSettings.packageName || 'com.droidforge.app';
      const versionName = buildSettings.versionName || '1.0.0';
      const versionCode = Number(buildSettings.versionCode) || 1;

      const replacePlaceholders = async (filePath: string) => {
        const data = await readFile(filePath, 'utf8');
        const updated = data
          .replace(/\{\{PACKAGE\}\}/g, packageName)
          .replace(/\{\{APP_NAME\}\}/g, appName)
          .replace(/\{\{VERSION_NAME\}\}/g, versionName)
          .replace(/\{\{VERSION_CODE\}\}/g, String(versionCode));
        await writeFile(filePath, updated);
      };

      await replacePlaceholders(join(buildDir, 'app/build.gradle.kts'));
      await replacePlaceholders(join(buildDir, 'app/src/main/AndroidManifest.xml'));
      await replacePlaceholders(join(buildDir, 'app/src/main/res/values/strings.xml'));

      const srcRoot = join(buildDir, 'app/src/main/java');
      const packagePath = packageName.split('.').join('/');
      const targetDir = join(srcRoot, packagePath);
      await mkdir(targetDir, { recursive: true });
      const mainActivity = `package ${packageName}\n\nimport android.os.Bundle\nimport androidx.appcompat.app.AppCompatActivity\n\nclass MainActivity : AppCompatActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContentView(R.layout.activity_main)\n    }\n}\n`;
      await writeFile(join(targetDir, 'MainActivity.kt'), mainActivity);

      const assetsDir = join(buildDir, 'app/src/main/assets/droidforge');
      await mkdir(assetsDir, { recursive: true });
      const bundleFiles = [
        'droidforge.bundle.json',
        'project.json',
        'build-settings.json',
        'data.json',
        'AndroidManifest.xml'
      ];
      for (const name of bundleFiles) {
        const entry = zip.getEntry(name);
        if (entry) {
          await writeFile(join(assetsDir, name), entry.getData());
        }
      }

      const screenEntries = zip.getEntries().filter(e => e.entryName.startsWith('screens/'));
      if (screenEntries.length > 0) {
        const screensDir = join(assetsDir, 'screens');
        await mkdir(screensDir, { recursive: true });
        for (const entry of screenEntries) {
          const fileName = entry.entryName.replace(/^screens\//, '');
          if (!fileName) continue;
          await writeFile(join(screensDir, fileName), entry.getData());
        }
      }

      const webEntries = zip.getEntries().filter(e => e.entryName.startsWith('web/'));
      if (webEntries.length > 0) {
        const webDir = join(buildDir, 'app/src/main/assets/web');
        await mkdir(webDir, { recursive: true });
        for (const entry of webEntries) {
          const fileName = entry.entryName.replace(/^web\//, '');
          if (!fileName) continue;
          await writeFile(join(webDir, fileName), entry.getData());
        }
      }

      const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (!androidHome) {
        throw new Error('ANDROID_HOME or ANDROID_SDK_ROOT is not set. Install Android SDK and set the environment variable.');
      }

      const sdkPath = androidHome.replace(/\\/g, '/');
      await writeFile(join(buildDir, 'local.properties'), `sdk.dir=${sdkPath}\n`);

      const gradleCmd = process.env.GRADLE_CMD || (process.env.GRADLE_HOME ? join(process.env.GRADLE_HOME, 'bin', 'gradle') : 'gradle');
      await execPromise(`${gradleCmd} -p ${buildDir} :app:assembleRelease`, {
        env: { ...process.env, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome }
      });

      const apkOutputDir = join(buildDir, 'app/build/outputs/apk/release');
      const apkFiles = existsSync(apkOutputDir) ? await readdir(apkOutputDir) : [];
      const unsignedName = apkFiles.find(f => f.endsWith('.apk'));
      if (!unsignedName) {
        throw new Error('Gradle build completed but no APK was found in the release output.');
      }
      unsignedApkPath = join(apkOutputDir, unsignedName);
    }

    const outDir = join(tempDir, 'out');
    await mkdir(outDir, { recursive: true });

    let command = `java -jar ${jarPath} -a ${unsignedApkPath} -o ${outDir}`;

    if (options.skipZipAlign) {
      command += ' --skipZipAlign';
    }

    if (options.keystore?.buffer && options.keystore.alias && options.keystore.pass) {
      const ksPath = join(tempDir, 'user.keystore');
      await writeFile(ksPath, options.keystore.buffer);
      command += ` --ks ${ksPath} --ksAlias ${options.keystore.alias} --ksPass ${options.keystore.pass}`;
      if (options.keystore.keyPass) {
        command += ` --ksKeyPass ${options.keystore.keyPass}`;
      }
    }

    await execPromise(command);

    const files = await execPromise(`ls ${outDir}`);
    const signedApkName = files.stdout.trim().split('\n').find(f => f.endsWith('.apk'));
    if (!signedApkName) {
      throw new Error('Failed to generate signed APK. Ensure the ZIP is a valid DroidForge Studio bundle, Android project, or APK.');
    }

    const signedApkPath = join(outDir, signedApkName);
    const signedApkBuffer = await readFile(signedApkPath);

    let sha256 = 'Unknown';
    try {
      const verifyOutput = await execPromise(`java -jar ${jarPath} -y -a ${signedApkPath} --verbose`);
      const match = verifyOutput.stdout.match(/SHA256: ([a-fA-F0-9: ]+)/);
      if (match) sha256 = match[1].trim();
    } catch (error) {
      console.error('Verification error:', error);
    }

    return {
      apkBuffer: signedApkBuffer,
      apkName: signedApkName,
      sha256
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(console.error);
  }
};
