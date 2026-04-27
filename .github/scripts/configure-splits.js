const fs = require('fs');
const path = 'android/app/build.gradle';
let content = fs.readFileSync(path, 'utf8');
const config = [
  'splits {',
  '  abi {',
  '    enable true',
  '    reset()',
  '    include "armeabi-v7a", "arm64-v8a", "x86_64"',
  '    universalApk false',
  '  }',
  '}',
].join('\n');
content = content.replace(/(^\s*buildTypes)/m, config + '\n' + '$1');
fs.writeFileSync(path, content);
console.log('ABI splits configured');
