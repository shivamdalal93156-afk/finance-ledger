const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules', 'react-native-css-interop', 'babel.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes('"react-native-worklets/plugin"')) {
    content = content.replace(/"react-native-worklets\/plugin",?/, '');
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched react-native-css-interop/babel.js');
  } else {
    console.log('react-native-css-interop/babel.js is already patched or does not contain worklets plugin');
  }
} else {
  console.log('react-native-css-interop/babel.js not found');
}
