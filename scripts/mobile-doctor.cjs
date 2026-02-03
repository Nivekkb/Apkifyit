const fs = require('fs');
const path = require('path');

const checks = [];

const androidStudio = '/home/oem/android/sdk/android-studio/bin/studio.sh';
checks.push({
  name: 'Android Studio',
  ok: fs.existsSync(androidStudio),
  value: androidStudio
});

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/home/oem/android/sdk';
checks.push({
  name: 'ANDROID_HOME',
  ok: fs.existsSync(androidHome),
  value: androidHome
});

const javaHome = process.env.JAVA_HOME || '';
checks.push({
  name: 'JAVA_HOME',
  ok: Boolean(javaHome && fs.existsSync(javaHome)),
  value: javaHome || '(not set)'
});

console.log('\nDroidForge Mobile Doctor');
console.log('------------------------');

let hasError = false;
for (const check of checks) {
  const status = check.ok ? 'OK' : 'MISSING';
  if (!check.ok) hasError = true;
  console.log(`${status}  ${check.name}: ${check.value}`);
}

if (hasError) {
  process.exit(1);
}
