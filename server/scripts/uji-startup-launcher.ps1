param([string]$Repo, [string]$Fixture, [int]$PidRelatif, [int]$PidAbsolut, [int]$PortFixture)
$ErrorActionPreference = 'Stop'
. (Join-Path $Repo 'scripts\identitas-node.ps1')
$script:node = (Get-Command node.exe).Source
$script:log = $env:TEMP
$e=$null; $t=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $Repo 'scripts\jalankan-barberbarbar.ps1'),[ref]$t,[ref]$e)
if($e.Count){throw 'Sintaks launcher tidak valid'}
foreach($f in $ast.EndBlock.Statements | Where-Object {$_ -is [Management.Automation.Language.FunctionDefinitionAst]}) {
    Invoke-Expression $f.Extent.Text
}
function Wajib($Kondisi, [string]$Pesan) { if(-not $Kondisi){throw $Pesan} }
function Harus-Ditolak([scriptblock]$Kerja) {
    $gagal=$false;try{& $Kerja}catch{$gagal=$true};Wajib $gagal 'Proses tidak sah diterima'
}
$relatif=Get-CimInstance Win32_Process -Filter "ProcessId=$PidRelatif"
$absolut=Get-CimInstance Win32_Process -Filter "ProcessId=$PidAbsolut"
Pastikan-Identitas $relatif $Fixture 'fixture-relatif'
Pastikan-Identitas $absolut $Fixture 'fixture-absolut'
Wajib ((Baca-IdentitasNode $relatif).Entry -ieq $Fixture) 'cwd proses relatif salah'
Write-Output 'PASS identitas nyata: absolut dan cwd relatif watcher; folder mengandung spasi'

# A foreign node HTTP server even returns the expected API greeting: still reject.
Wajib ((Invoke-RestMethod -Uri "http://127.0.0.1:$PortFixture").pesan -eq 'Barbershop Management API berjalan') 'Fixture HTTP salah'
Harus-Ditolak { Pastikan-Identitas $relatif (Join-Path $Repo 'server\dist\server.js') 'backend' }
$tidakLengkap=[pscustomobject]@{ProcessId=$PidRelatif;ExecutablePath=$script:node;CommandLine=$null;CreationDate=$relatif.CreationDate}
Harus-Ditolak { Pastikan-Identitas $tidakLengkap $Fixture 'backend' }
$tidakTerbaca=[pscustomobject]@{ProcessId=2147483647;ExecutablePath=$script:node;CommandLine='node.exe ./server.js';CreationDate=$relatif.CreationDate}
Harus-Ditolak { Pastikan-Identitas $tidakTerbaca $Fixture 'backend' }
$pidBerganti=[pscustomobject]@{ProcessId=$PidRelatif;ExecutablePath=$relatif.ExecutablePath;CommandLine=$relatif.CommandLine;CreationDate=$relatif.CreationDate.AddSeconds(-1)}
Harus-Ditolak { Pastikan-Identitas $pidBerganti $Fixture 'backend' }
$exePalsu=[pscustomobject]@{ProcessId=$PidRelatif;ExecutablePath='C:\Windows\node.exe';CommandLine=$relatif.CommandLine;CreationDate=$relatif.CreationDate}
Harus-Ditolak { Pastikan-Identitas $exePalsu $Fixture 'backend' }
foreach($cmd in @(('node.exe -e "0" "'+$Fixture+'"'),('node.exe other.js "'+$Fixture+'"'),('node.exe "'+$Fixture+'.palsu"'))){
    $palsu=[pscustomobject]@{ProcessId=$PidRelatif;ExecutablePath=$script:node;CommandLine=$cmd;CreationDate=$relatif.CreationDate}
    Harus-Ditolak { Pastikan-Identitas $palsu $Fixture 'backend' }
}
Write-Output 'PASS guard: proses lain dengan HTTP sama, identitas hilang/tidak terbaca, eval, argumen dan suffix palsu ditolak'
Wajib ($null -ne (Cari-WatcherBackend $Fixture)) 'Watcher fixture nyata tidak ditemukan'
function Get-CimInstance {
    param($ClassName,$Filter)
    if($Filter -eq "Name='node.exe'") {
        return [pscustomobject]@{ProcessId=2147483647;CommandLine='node.exe --watch ./server.js';ExecutablePath=$null;CreationDate=Get-Date}
    }
    return CimCmdlets\Get-CimInstance -ClassName $ClassName -Filter $Filter
}
Harus-Ditolak { Cari-WatcherBackend $Fixture }
Remove-Item -LiteralPath Function:\Get-CimInstance
Write-Output 'PASS pencarian watcher: proses nyata ditemukan; watcher tidak terverifikasi memblokir startup'

# Replace process/port primitives only in this isolated test process.
$script:pemilikMock=$absolut
$script:mulaiMock=0
function Pemilik-Port([int]$Port) { return $script:pemilikMock }
function Start-Process { $script:mulaiMock++; $script:pemilikMock=$absolut }
function Start-Sleep { }
function Cari-WatcherBackend { return $null }
$Periksa=$false
$script:pemilikMock=$relatif
Harus-Ditolak { Mulai-Node 'backend' (Join-Path $Repo 'server\dist\server.js') (Join-Path $Repo 'server') 3000 }
Wajib ($script:mulaiMock -eq 0) 'Port aplikasi lain menyebabkan spawn'
$script:pemilikMock=$null
Mulai-Node 'backend' $Fixture (Split-Path $Fixture) 3000
Wajib ($script:mulaiMock -eq 1) 'Startup kosong bukan satu proses'
Mulai-Node 'backend' $Fixture (Split-Path $Fixture) 3000
$Periksa=$true
Mulai-Node 'backend' $Fixture (Split-Path $Fixture) 3000
Wajib ($script:mulaiMock -eq 1) 'Launcher berulang membuat proses ganda'
Write-Output 'PASS startup kosong dan pemanggilan berulang: satu spawn saja (port/proses mock, bukan server pengguna)'

$script:pemilikMock=$null
function Cari-WatcherBackend { return $relatif }
$script:tickMock=0
function Start-Sleep { $script:tickMock++; if($script:tickMock -eq 2){$script:pemilikMock=$absolut} }
$Periksa=$false
Mulai-Node 'backend' $Fixture (Split-Path $Fixture) 3000
Wajib ($script:mulaiMock -eq 1 -and $script:tickMock -eq 2) 'Restart menyebabkan duplicate spawn'
$script:pemilikMock=$null
function Start-Sleep { }
Harus-Ditolak { Mulai-Node 'backend' $Fixture (Split-Path $Fixture) 3000 }
Wajib ($script:mulaiMock -eq 1) 'Watcher tidak siap menyebabkan duplicate spawn'
Write-Output 'PASS restart: tunggu watcher, terima listener baru; timeout tetap fail-closed tanpa spawn'

# Verify all-off orchestration without opening 3000 or touching user processes.
$script:aplikasiMock=@();$script:pemilikMock=$null;$script:mulaiMock=0;$script:nodeCalls=@()
function Pemilik-Port { return $null }
function Cari-WatcherBackend { return $null }
function Mulai-Node($Nama,$Berkas,$Folder,$Port) { $script:nodeCalls+=@{Nama=$Nama;Berkas=$Berkas;Port=$Port} }
function Mulai-Aplikasi($Nama,$Folder,$Program,$Argumen,$Port) { $script:aplikasiMock+=@{Nama=$Nama;Folder=$Folder;Port=$Port} }
function Periksa-Webhook { }
function Invoke-RestMethod { return @{pesan='Barbershop Management API berjalan'} }
function npm.cmd { $global:LASTEXITCODE=0 }
$Stage2=Split-Path $Repo;$Ngrok=$false;$TanpaNgrok=$true;$HanyaBackend=$false;$Periksa=$false
$PSScriptRoot=Join-Path $Repo 'scripts'
$kunci=$null;$memilikiKunci=$false
function New-Item { }
$utama=$ast.EndBlock.Statements | Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}
Invoke-Expression $utama.Extent.Text
Wajib ($script:nodeCalls.Count -eq 2 -and $script:aplikasiMock.Count -eq 3) 'Orkestrasi startup tidak lengkap'
Wajib (($script:aplikasiMock.Nama -join ',') -eq 'web,customer-web,staff') 'Target aplikasi berubah'
foreach($a in $script:aplikasiMock){Wajib ([IO.Path]::IsPathRooted($a.Folder)) 'Working directory bukan absolut'}
Write-Output 'PASS semua server mati (orkestrasi mock): backend, proxy, Admin5173, Customer5175 dan Expo Staff8081; tanpa Native'
