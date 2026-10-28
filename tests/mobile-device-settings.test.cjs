const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
function source(file) {
  return ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(node, predicate) {
  if (predicate(node)) return node;
  return ts.forEachChild(node, child => find(child, predicate));
}

test('native stack follows device orientation rather than inheriting a portrait lock', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  assert.equal(config.expo.orientation, 'default');
  const file = source('src/app/_layout.tsx');
  const options = find(file, node => ts.isJsxAttribute(node) && node.name.getText(file) === 'screenOptions');
  const orientation = find(options, node => ts.isPropertyAssignment(node) && node.name.getText(file) === 'orientation');
  assert.ok(orientation, 'Stack must explicitly follow device orientation, including existing native projects');
  assert.equal(orientation.initializer.text, 'default');
});

test('receipt capture explicitly disables the shutter sound', () => {
  const file = source('src/app/receipt-camera.tsx');
  const capture = find(file, node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'takePictureAsync');
  assert.ok(capture, 'receipt camera capture is present');
  // Evaluate the actual options passed to the native camera, not a duplicate fixture.
  const options = new Function(`return (${capture.arguments[0].getText(file)});`)();
  assert.equal(options.shutterSound, false);
  assert.equal(options.quality, 0.8);
});
