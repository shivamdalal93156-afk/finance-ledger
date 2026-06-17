const fs = require('fs');
const path = require('path');

// Try both local node_modules (non-hoisted / EAS) and monorepo root node_modules (hoisted)
const paths = [
  path.join(__dirname, 'node_modules', 'react-native-css-interop', 'babel.js'),
  path.join(__dirname, '..', '..', 'node_modules', 'react-native-css-interop', 'babel.js')
];

let found = false;

for (const targetFile of paths) {
  if (fs.existsSync(targetFile)) {
    found = true;
    let content = fs.readFileSync(targetFile, 'utf8');
    if (content.includes('"react-native-worklets/plugin"')) {
      content = content.replace(/"react-native-worklets\/plugin",?/, '');
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log(`Successfully patched: ${targetFile}`);
    } else {
      console.log(`react-native-css-interop/babel.js at ${targetFile} is already patched or does not contain worklets plugin`);
    }
  }
}

if (!found) {
  console.log('react-native-css-interop/babel.js not found in any of the search paths:', paths);
}
