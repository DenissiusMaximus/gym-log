// Static guard against calling non-worklet functions on the UI runtime.
//
// Why: Reanimated runs `useAnimatedStyle`, gesture callbacks etc. as worklets. A plain function
// called from there throws on the UI runtime; on Android release that is a fatal error. The Babel
// plugin does not warn about it, so this test finds such calls with the TypeScript type checker.
//
// Limits (a heuristic, not a proof):
// - only direct calls are checked: `f()` and `ns.f()` for a namespace import `ns`; method calls on
//   values (`obj.method()`), `new X()`, tagged templates and calls through aliases are not;
// - a callee counts as safe if it is declared inside the worklet, is a global from a `.d.ts`
//   (Math, Object, ...), comes from react-native-reanimated / react-native-worklets, or is a
//   function with the 'worklet' directive in `src/`. Whatever the function does inside is not
//   followed (a worklet is checked itself, because it is a root);
// - only inline functions are treated as worklet arguments, as in the Babel plugin;
// - `*.web.*` files and tests are not analysed (the web has no UI runtime).
/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');
const PLUGIN = path.join(ROOT, 'node_modules/react-native-worklets/plugin/index.js');
const FIXTURE = 'src/__fixtures__/workletSafety.fixture.tsx';
const EXPECT_MARK = '// expect-violation';
const ALLOWED_MODULES = new Set(['react-native-reanimated', 'react-native-worklets']);

// Copies of the tables in node_modules/react-native-worklets/plugin/index.js; the last test
// compares them with the plugin so that a worklets update does not silently outdate them.
const GESTURE_OBJECTS = new Set([
  'Tap',
  'Pan',
  'Pinch',
  'Rotation',
  'Fling',
  'LongPress',
  'ForceTouch',
  'Native',
  'Manual',
  'Race',
  'Simultaneous',
  'Exclusive',
  'Hover',
]);
const GESTURE_BUILDER_METHODS = new Set([
  'onBegin',
  'onStart',
  'onEnd',
  'onFinalize',
  'onUpdate',
  'onChange',
  'onTouchesDown',
  'onTouchesMove',
  'onTouchesUp',
  'onTouchesCancelled',
]);
const GESTURE_OBJECT_HOOKS = new Set([
  'useTapGesture',
  'usePanGesture',
  'usePinchGesture',
  'useRotationGesture',
  'useFlingGesture',
  'useLongPressGesture',
  'useNativeGesture',
  'useManualGesture',
  'useHoverGesture',
]);
const OBJECT_HOOKS = new Set(['useAnimatedScrollHandler', ...GESTURE_OBJECT_HOOKS]);
const WORKLETIZED_ARGS = new Map<string, number[]>([
  ['useFrameCallback', [0]],
  ['useAnimatedStyle', [0]],
  ['useAnimatedProps', [0]],
  ['createAnimatedPropAdapter', [0]],
  ['useDerivedValue', [0]],
  ['useAnimatedScrollHandler', [0]],
  ['useAnimatedReaction', [0, 1]],
  ['withTiming', [2, 3]],
  ['withSpring', [2, 3]],
  ['withDecay', [1]],
  ['withRepeat', [3]],
  ['runOnUI', [0]],
  ['executeOnUIRuntimeSync', [0]],
  ['scheduleOnUI', [0]],
  ['runOnUISync', [0]],
  ['runOnUIAsync', [0]],
  ['runOnRuntime', [1]],
  ['runOnRuntimeSync', [1]],
  ['runOnRuntimeAsync', [1]],
  ['scheduleOnRuntime', [1]],
  ['runOnRuntimeSyncWithId', [1]],
  ['scheduleOnRuntimeWithId', [1]],
  ...[...GESTURE_OBJECT_HOOKS].map((name): [string, number[]] => [name, [0]]),
  ...[...GESTURE_BUILDER_METHODS].map((name): [string, number[]] => [name, [0]]),
]);

const DRIFT_MESSAGE =
  'таблиці worklet-функцій розійшлися з node_modules/react-native-worklets/plugin/index.js - звір і онови таблиці в тесті';

type Violation = { file: string; line: number; callee: string };

function unwrap(node: ts.Node): ts.Node {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isInlineFunction(node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression {
  const inner = unwrap(node);
  return ts.isArrowFunction(inner) || ts.isFunctionExpression(inner);
}

function hasWorkletDirective(fn: ts.Node): boolean {
  const body = (fn as ts.FunctionLikeDeclaration).body;
  if (!body || !ts.isBlock(body)) return false;
  for (const statement of body.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === 'worklet') return true;
  }
  return false;
}

/** The function a declaration stands for: `function f`, `method()`, or `const f = () => ...`. */
function functionOf(decl: ts.Node): ts.Node | undefined {
  if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) return decl;
  if (ts.isVariableDeclaration(decl) && decl.initializer) {
    const init = unwrap(decl.initializer);
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
  }
  return undefined;
}

function isWorkletDeclaration(decl: ts.Node): boolean {
  const fn = functionOf(decl);
  return fn !== undefined && hasWorkletDirective(fn);
}

function isAppSource(file: ts.SourceFile): boolean {
  const relative = path.relative(ROOT, file.fileName).split(path.sep).join('/');
  return relative.startsWith('src/') && !file.isDeclarationFile;
}

function importModule(decl: ts.Node): string | undefined {
  for (let node: ts.Node | undefined = decl; node; node = node.parent) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) return node.moduleSpecifier.text;
  }
  return undefined;
}

function isImportDeclaration(decl: ts.Node): boolean {
  return ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl);
}

function createAnalyzer(program: ts.Program) {
  const checker = program.getTypeChecker();

  function resolveAlias(symbol: ts.Symbol): ts.Symbol {
    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  }

  /** True when a worklet may call this declaration set. Imports are decided first. */
  function isSafeSymbol(symbol: ts.Symbol | undefined, root: ts.Node): boolean {
    if (!symbol) return true;
    const decls = symbol.declarations ?? [];
    if (decls.length === 0) return true;

    const imported = decls.find(isImportDeclaration);
    if (imported) {
      const module = importModule(imported);
      if (module !== undefined && ALLOWED_MODULES.has(module)) return true;
      const target = resolveAlias(symbol).declarations ?? [];
      return target.some((d) => isAppSource(d.getSourceFile()) && isWorkletDeclaration(d));
    }

    // Globals (Math, requestAnimationFrame) are declared only in .d.ts files.
    if (decls.every((d) => d.getSourceFile().isDeclarationFile)) return true;
    const rootFile = root.getSourceFile();
    if (decls.some((d) => d.getSourceFile() === rootFile && d.pos >= root.pos && d.end <= root.end)) return true;
    return decls.some(isWorkletDeclaration);
  }

  function isSafeCall(call: ts.CallExpression, root: ts.Node): boolean {
    const callee = unwrap(call.expression);
    if (ts.isIdentifier(callee)) return isSafeSymbol(checker.getSymbolAtLocation(callee), root);
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      const owner = checker.getSymbolAtLocation(callee.expression);
      const namespace = owner?.declarations?.find(ts.isNamespaceImport);
      if (!namespace) return true;
      const module = importModule(namespace);
      if (module !== undefined && ALLOWED_MODULES.has(module)) return true;
      const member = checker.getSymbolAtLocation(callee.name);
      const target = member ? (resolveAlias(member).declarations ?? []) : [];
      return target.some((d) => isAppSource(d.getSourceFile()) && isWorkletDeclaration(d));
    }
    return true;
  }

  function isGestureBuilderChain(callee: ts.PropertyAccessExpression): boolean {
    let current: ts.Node = unwrap(callee.expression);
    while (ts.isCallExpression(current)) {
      const inner = unwrap(current.expression);
      if (!ts.isPropertyAccessExpression(inner)) return false;
      if (
        ts.isIdentifier(inner.expression) &&
        inner.expression.text === 'Gesture' &&
        GESTURE_OBJECTS.has(inner.name.text)
      ) {
        return true;
      }
      current = unwrap(inner.expression);
    }
    return false;
  }

  function objectLiteralRoots(arg: ts.Node, roots: Set<ts.Node>) {
    const object = unwrap(arg);
    if (!ts.isObjectLiteralExpression(object)) return;
    const runsOnJS = object.properties.some(
      (p) =>
        ts.isPropertyAssignment(p) &&
        p.name.getText() === 'runOnJS' &&
        p.initializer.kind === ts.SyntaxKind.TrueKeyword,
    );
    if (runsOnJS) return;
    for (const property of object.properties) {
      if (ts.isMethodDeclaration(property)) roots.add(property);
      else if (ts.isPropertyAssignment(property) && isInlineFunction(property.initializer)) {
        roots.add(unwrap(property.initializer));
      }
    }
  }

  /** The functions that run as worklets, plus animateTo callbacks that are not worklets. */
  function collectRoots(file: ts.SourceFile) {
    const roots = new Set<ts.Node>();
    const callbacksWithoutWorklet: ts.Node[] = [];
    const visit = (node: ts.Node) => {
      if (functionOf(node) !== undefined && isWorkletDeclaration(node)) roots.add(functionOf(node)!);
      if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && hasWorkletDirective(node)) roots.add(node);
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression);
        if (ts.isIdentifier(callee)) {
          const name = callee.text;
          for (const index of WORKLETIZED_ARGS.get(name) ?? []) {
            const arg = node.arguments[index];
            if (arg && isInlineFunction(arg)) roots.add(unwrap(arg));
          }
          if (OBJECT_HOOKS.has(name) && node.arguments[0]) objectLiteralRoots(node.arguments[0], roots);
          if (name === 'animateTo') {
            const callback = node.arguments[3];
            if (callback && isInlineFunction(callback) && !hasWorkletDirective(unwrap(callback))) {
              callbacksWithoutWorklet.push(unwrap(callback));
            }
          }
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          GESTURE_BUILDER_METHODS.has(callee.name.text) &&
          isGestureBuilderChain(callee)
        ) {
          const arg = node.arguments[0];
          if (arg && isInlineFunction(arg)) roots.add(unwrap(arg));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    return { roots, callbacksWithoutWorklet };
  }

  function analyse(file: ts.SourceFile): Violation[] {
    const found = new Map<string, Violation>();
    const report = (node: ts.Node, callee: string) => {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      const relative = path.relative(ROOT, file.fileName).split(path.sep).join('/');
      found.set(`${line}:${callee}`, { file: relative, line, callee });
    };
    const { roots, callbacksWithoutWorklet } = collectRoots(file);
    for (const callback of callbacksWithoutWorklet) report(callback, 'animateTo callback without worklet');
    for (const root of roots) {
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && !isSafeCall(node, root)) {
          report(unwrap(node.expression), unwrap(node.expression).getText(file));
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(root, visit);
    }
    return [...found.values()].sort((a, b) => a.line - b.line);
  }

  return { analyse };
}

let analysedFiles: ts.SourceFile[] = [];
let analyze: ReturnType<typeof createAnalyzer>;

beforeAll(() => {
  const configPath = path.join(ROOT, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
  const rootNames = parsed.fileNames.filter((name) => {
    const relative = path.relative(ROOT, name).split(path.sep).join('/');
    return relative.startsWith('src/') && !/\.(test|web)\./.test(relative) && !name.endsWith('.d.ts');
  });
  const program = ts.createProgram({ rootNames, options: { ...parsed.options, noEmit: true } });
  analysedFiles = program
    .getSourceFiles()
    .filter((f) => isAppSource(f) && !/\.(test|web)\./.test(f.fileName));
  analyze = createAnalyzer(program);
}, 120_000);

const fixturePath = path.join(ROOT, FIXTURE);
const isFixture = (file: ts.SourceFile) => path.resolve(file.fileName) === fixturePath;

describe('worklet safety', () => {
  it('src/ has no non-worklet calls inside worklets', () => {
    const violations = analysedFiles.filter((f) => !isFixture(f)).flatMap((f) => analyze.analyse(f));
    expect(violations.map((v) => `${v.file}:${v.line} ${v.callee}`)).toEqual([]);
  }, 120_000);

  it('the negative fixture reports exactly the marked lines', () => {
    const fixture = analysedFiles.find(isFixture);
    expect(fixture).toBeDefined();
    const expected = fixture!
      .getFullText()
      .split(/\r?\n/)
      .flatMap((text, index) => (text.includes(EXPECT_MARK) ? [index + 1] : []));
    expect(expected.length).toBeGreaterThan(0);
    expect(analyze.analyse(fixture!).map((v) => v.line)).toEqual(expected);
  }, 120_000);

  it('the tables match the worklets plugin', () => {
    const source = fs.readFileSync(PLUGIN, 'utf8');
    const setOf = (name: string): string[] => {
      const match = new RegExp(`${name} = (?:/\\* @__PURE__ \\*/ )?new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(source);
      if (!match) throw new Error(`${DRIFT_MESSAGE} (не знайдено ${name})`);
      return [...match[1].matchAll(/"(\w+)"/g)].map((m) => m[1]).sort();
    };
    const mapMatch = /reanimatedFunctionArgsToWorkletize = new Map\(\[([\s\S]*?)\n\s*\]\);/.exec(source);
    if (!mapMatch) throw new Error(`${DRIFT_MESSAGE} (не знайдено reanimatedFunctionArgsToWorkletize)`);
    const literal = [...mapMatch[1].matchAll(/\["(\w+)",\s*\[([\d,\s]*)\]\]/g)].map(
      (m): [string, number[]] => [m[1], m[2].split(',').filter((s) => s.trim() !== '').map(Number)],
    );
    const hooks = setOf('gestureHandlerObjectHooks');
    const builders = setOf('gestureHandlerBuilderMethods');
    const pluginArgs = [
      ...literal,
      ...hooks.map((name): [string, number[]] => [name, [0]]),
      ...builders.map((name): [string, number[]] => [name, [0]]),
    ].sort((a, b) => a[0].localeCompare(b[0]));
    const ownArgs = [...WORKLETIZED_ARGS].sort((a, b) => a[0].localeCompare(b[0]));

    const checks: [string, unknown, unknown][] = [
      ['worklet-аргументи', ownArgs, pluginArgs],
      ['gesture-об\'єкти', [...GESTURE_OBJECTS].sort(), setOf('gestureHandlerGestureObjects')],
      ['методи билдера', [...GESTURE_BUILDER_METHODS].sort(), builders],
      ['хуки з об\'єктом', [...GESTURE_OBJECT_HOOKS].sort(), hooks],
    ];
    for (const [what, own, plugin] of checks) {
      if (JSON.stringify(own) !== JSON.stringify(plugin)) {
        throw new Error(`${DRIFT_MESSAGE}. Розбіжність: ${what}.\nтест: ${JSON.stringify(own)}\nплагін: ${JSON.stringify(plugin)}`);
      }
    }
    if (!/useAnimatedScrollHandler/.test(source)) throw new Error(`${DRIFT_MESSAGE} (useAnimatedScrollHandler)`);
  });
});
