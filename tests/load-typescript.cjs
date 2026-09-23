const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
module.exports = function loadTypescript(entry, overrides = {}) {
  const modules = new Map();
  function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    new Function('require', 'module', 'exports', code)(
      (name) =>
        Object.hasOwn(overrides, name)
          ? overrides[name]
          : name.startsWith('.')
            ? load(path.resolve(path.dirname(file), name + '.ts'))
            : require(name),
      module,
      module.exports,
    );
    return module.exports;
  }
  return load(entry);
};
