param([switch]$SiapkanManifest)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$akar = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$daftarPath = Join-Path $akar 'barberbarbar/server/e2e/BERKAS-ZIP.json'
$manifestRel = 'barberbarbar/server/e2e/MANIFEST-SUMBER.json'
$manifestPath = Join-Path $akar $manifestRel
$daftar = Get-Content -Raw -LiteralPath $daftarPath | ConvertFrom-Json
$larangan = @('barberbarbar/server/src/lib/prisma.ts', 'barberbarbar-mobile/src/layar/LayarTambahPelanggan.tsx', 'barberbarbar-mobile/src/layanan/booking.ts')
if (@($daftar | Select-Object -Unique).Count -ne $daftar.Count) { throw 'Path duplikat' }
function Hash-Bytes([byte[]]$data) {
  $alg = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($alg.ComputeHash($data))).Replace('-', '').ToLowerInvariant() }
  finally { $alg.Dispose() }
}
function Tulis-Json($lokasi, $data) {
  [IO.File]::WriteAllText($lokasi, ($data | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
}
function Git-Repo($repo, [string[]]$argumen) {
  $hasil = & git -c "safe.directory=$($repo.Replace('\','/'))" -C $repo @argumen
  if ($LASTEXITCODE -ne 0) { throw 'Pemeriksaan Git gagal' }
  return $hasil
}
foreach ($rel in $daftar) {
  if ($rel -match '(^/|\\|\.\.|(^|/)(\.git|node_modules|backup-database|\.env[^/]*)(/|$)|\.(dump|zip|db)$)' -or $rel -in $larangan) { throw 'Path dilarang' }
  if ($rel -notmatch '^(barberbarbar|barberbarbar-mobile|barberbarbar-customer)/') { throw 'Repository tidak dikenal' }
  $lokasi = [IO.Path]::GetFullPath((Join-Path $akar $rel))
  if (!$lokasi.StartsWith($akar + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path keluar workspace' }
  if ($rel -ne $manifestRel -and !(Test-Path -LiteralPath $lokasi -PathType Leaf)) { throw 'Sumber tidak tersedia' }
}
$sumber = @($daftar | Where-Object { $_ -ne $manifestRel } | ForEach-Object {
  $b = [IO.File]::ReadAllBytes((Join-Path $akar $_))
  [ordered]@{path=$_; bytes=$b.Length; sha256=(Hash-Bytes $b)}
})
if ($SiapkanManifest) {
  Tulis-Json $manifestPath ([ordered]@{jenis='Checksum sumber audit, bukan backup seluruh repository'; pengecualian='Manifest ini tidak memuat hash dirinya; manifest luar ZIP memverifikasi seluruh entry termasuk file ini'; sumber=$sumber})
  Write-Output "PASS manifest sumber disiapkan: $($sumber.Count) file + manifest"
  exit 0
}
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.sumber.Count -ne $sumber.Count) { throw 'Jumlah sumber manifest tidak cocok' }
foreach ($item in $sumber) {
  $lama = @($manifest.sumber | Where-Object { $_.path -eq $item.path })
  if ($lama.Count -ne 1 -or $lama[0].sha256 -ne $item.sha256 -or $lama[0].bytes -ne $item.bytes) { throw 'Sumber berubah sesudah manifest disiapkan' }
}
$commits = [ordered]@{}
foreach ($nama in @('barberbarbar','barberbarbar-mobile','barberbarbar-customer')) {
  $repo = Join-Path $akar $nama
  $branch = Git-Repo $repo @('branch','--show-current')
  if ($branch -ne 'feature/project5-integration') { throw 'Branch tidak sesuai' }
  $head = Git-Repo $repo @('rev-parse','HEAD')
  $remote = Git-Repo $repo @('rev-parse','origin/feature/project5-integration')
  if ($head -ne $remote) { throw 'HEAD dan upstream belum sama' }
  $commits[$nama] = $head
  foreach ($rel in ($daftar | Where-Object { $_.StartsWith($nama + '/') })) {
    $file = $rel.Substring($nama.Length + 1)
    $null = Git-Repo $repo @('ls-files','--error-unmatch','--',$file)
    if (Git-Repo $repo @('diff','HEAD','--',$file)) { throw 'Sumber belum sesuai commit final' }
  }
}
$arsip = Join-Path $akar 'BARBERBARBAR-F13-E2E.zip'
$luar = Join-Path $akar 'BARBERBARBAR-F13-E2E.manifest.json'
$cek = Join-Path $akar 'BARBERBARBAR-F13-E2E.zip.sha256'
foreach ($tujuan in @($arsip,$luar,$cek)) { if (Test-Path -LiteralPath $tujuan) { throw 'Cadangan sudah ada; tidak menimpa backup' } }
$stream = [IO.File]::Open($arsip, [IO.FileMode]::CreateNew)
$zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
try { foreach ($rel in $daftar) { $null = [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $akar $rel), $rel, [IO.Compression.CompressionLevel]::Optimal) } }
finally { $zip.Dispose(); $stream.Dispose() }
$dibaca = [IO.Compression.ZipFile]::OpenRead($arsip)
$entryManifest = @()
try {
  if ($dibaca.Entries.Count -ne $daftar.Count) { throw 'Jumlah entry ZIP tidak cocok' }
  foreach ($entry in $dibaca.Entries) {
    if ($entry.FullName -notin $daftar) { throw 'Entry ZIP tidak dikenal' }
    $inputEntry=$entry.Open(); $memori=New-Object IO.MemoryStream
    try { $inputEntry.CopyTo($memori); $hash=Hash-Bytes $memori.ToArray() }
    finally { $inputEntry.Dispose(); $memori.Dispose() }
    $asliHash=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $akar $entry.FullName)).Hash.ToLowerInvariant()
    if ($hash -ne $asliHash) { throw 'Hash entry ZIP berbeda dari source' }
    $entryManifest += [ordered]@{path=$entry.FullName; bytes=$entry.Length; sha256=$hash}
  }
} finally { $dibaca.Dispose() }
$hashZip=(Get-FileHash -Algorithm SHA256 -LiteralPath $arsip).Hash.ToLowerInvariant()
Tulis-Json $luar ([ordered]@{arsip='BARBERBARBAR-F13-E2E.zip'; sha256=$hashZip; commits=$commits; entries=$entryManifest; semuaEntrySesuaiSource=$true})
[IO.File]::WriteAllText($cek, "$hashZip  BARBERBARBAR-F13-E2E.zip`n", (New-Object Text.UTF8Encoding($false)))
Write-Output "PASS ZIP: $($entryManifest.Count) entry, seluruh SHA256 sesuai source final; $hashZip"
