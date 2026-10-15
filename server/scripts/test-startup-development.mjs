// Tidak menjalankan backend/tunnel dan tidak menghentikan proses apa pun.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const file = path.resolve('../scripts/jalankan-barberbarbar.ps1');
const kode = String.raw`
$ErrorActionPreference='Stop'
$e=$null;$t=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($args[0],[ref]$t,[ref]$e)
if($e.Count){throw 'Sintaks launcher tidak valid'}
$fungsi=$ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Pastikan-Identitas'},$true)
Invoke-Expression $fungsi[0].Extent.Text
$entry='C:\workspace\barberbarbar\server\dist\server.js'
$baik=[pscustomobject]@{ExecutablePath='C:\Program Files\nodejs\node.exe';CommandLine='node.exe "'+$entry+'"';ProcessId=123}
Pastikan-Identitas $baik $entry 'fixture'
foreach($command in @('node.exe dist/server.js','node.exe C:\lain\server.js',('node.exe "'+$entry+'.palsu"'))){
 $salah=[pscustomobject]@{ExecutablePath=$baik.ExecutablePath;CommandLine=$command;ProcessId=123}
 $ditolak=$false;try{Pastikan-Identitas $salah $entry 'fixture'}catch{$ditolak=$true}
 if(-not $ditolak){throw 'Identitas salah diterima'}
}
Write-Output 'PASS startup: sintaks valid; identitas absolut benar diterima; relatif/lokasi lain/suffix palsu ditolak.'
`;
// EncodedCommand menerima path sebagai literal aman, tanpa shell interpolation.
const ps = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
  Buffer.from(`& { ${kode} } '${file.replaceAll("'", "''")}'`, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true });
assert.equal(ps.status, 0, ps.stderr);
console.log(ps.stdout.trim());
const dev = await readFile('scripts/dev.mjs', 'utf8');
assert.ok(dev.includes('--watch-path=dist'));
assert.ok(!dev.includes('["--watch",'));
