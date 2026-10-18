import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(new URL('../../client/package.json', import.meta.url)), ts = require('typescript');
const stage = path.resolve('../..'), files = [];
async function jalan(p) { for (const e of await readdir(p, { withFileTypes: true })) {
  if (['node_modules', '.git', 'dist', '.expo', 'generated'].includes(e.name)) continue;
  const f = path.join(p, e.name); if (e.isDirectory()) await jalan(f); else if (/\.(tsx?|mjs|json|html)$/.test(f) && !f.endsWith('package-lock.json') && !f.includes(`${path.sep}finalization${path.sep}`) && !f.includes(`${path.sep}e2e${path.sep}`)) files.push(f);
} }
for (const r of ['barberbarbar', 'barberbarbar-mobile', 'barberbarbar-customer-web']) await jalan(path.join(stage, r));
const sumber = new Map(await Promise.all(files.map(async f => [f, await readFile(f, 'utf8')]))), edges = new Map(), literals = new Map();
function resolve(f, p) { if (!p.startsWith('.')) return; const base = path.resolve(path.dirname(f), p).replace(/\.js$/, ''); return [base, ...['.ts', '.tsx', '.mjs', '/index.ts', '/index.tsx'].map(x => base + x)].find(x => sumber.has(x)); }
for (const [file, text] of sumber) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), deps = new Set(), kata = new Set();
  const visit = node => {
    if (ts.isStringLiteralLike(node)) kata.add(node.text);
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) { const target = resolve(file, node.moduleSpecifier.text); if (target) deps.add(target); }
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) { const target = resolve(file, node.arguments[0].text); if (target) deps.add(target); }
    ts.forEachChild(node, visit);
  }; visit(ast); edges.set(file, deps); literals.set(file, kata);
}
const rel = f => path.relative(stage, f).split(path.sep).join('/');
const graph = [];
for (const [nama, roots, prefix] of [
  ['backend', ['barberbarbar/server/src/server.ts', 'barberbarbar/server/src/seed.ts'], 'barberbarbar/server/src/'],
  ['web', ['barberbarbar/client/src/main.tsx'], 'barberbarbar/client/src/'],
  ['staff', ['barberbarbar-mobile/index.ts'], 'barberbarbar-mobile/src/'],
  ['customer', ['barberbarbar-customer-web/src/main.tsx'], 'barberbarbar-customer-web/src/'],
]) {
  const reached = new Set(), todo = roots.map(f => path.join(stage, f)); while (todo.length) { const f = todo.pop(); if (reached.has(f)) continue; reached.add(f); todo.push(...(edges.get(f) ?? [])); }
  const code = [...sumber.keys()].filter(f => rel(f).startsWith(prefix) && /\.tsx?$/.test(f));
  graph.push({ nama, roots, files: code.length, reachable: code.filter(f => reached.has(f)).length, kandidat: code.filter(f => !reached.has(f)).map(rel), batas: 'Unreached bukan bukti final dead code: declaration global/manual tool/test/external consumer harus ditinjau sebelum penghapusan.' });
}
const paket = [];
for (const folder of ['barberbarbar/server', 'barberbarbar/client', 'barberbarbar-mobile', 'barberbarbar-customer-web']) {
  const pkg = JSON.parse(await readFile(path.join(stage, folder, 'package.json'), 'utf8'));
  for (const nama of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const pengguna = [...literals].filter(([f, strs]) => rel(f).startsWith(folder + '/') && !f.endsWith('package.json') && !f.endsWith('audit-referensi-workspace.mjs') && [...strs].some(s => s === nama || s.startsWith(nama + '/') || s.includes(`node_modules/${nama}/`))).map(([f]) => rel(f));
    paket.push({ project: folder, nama, pengguna, packageScripts: Object.values(pkg.scripts ?? {}).filter(s => s.includes(nama)), catatan: 'Nol literal tidak cukup untuk menghapus toolchain/type/plugin; periksa config dan entrypoint.' });
  }
}
await mkdir('../docs/cleanup', { recursive: true }); await writeFile('../docs/cleanup/ANALISIS-REFERENSI.json', JSON.stringify({ graph, paket }, null, 2));
console.log(JSON.stringify({ graph, kandidatDependencyServer: paket.filter(p => p.project.endsWith('/server') && ['eslint', 'tsx'].includes(p.nama)) }));
