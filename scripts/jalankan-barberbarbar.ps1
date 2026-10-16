# Satu launcher development; ngrok hanya opt-in. Tidak menghentikan proses existing.
[CmdletBinding()]
param([string]$Stage2 = '', [switch]$Ngrok, [switch]$TanpaNgrok,
      [switch]$HanyaBackend, [switch]$Periksa)
$ErrorActionPreference = 'Stop'
$kunci = $null
$memilikiKunci = $false
function Pemilik-Port([int]$Port) {
    $ids = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $Port |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($ids.Count -gt 1) { throw "Port $Port dimiliki beberapa proses; periksa manual." }
    if ($ids.Count -eq 1) { return Get-CimInstance Win32_Process -Filter "ProcessId=$($ids[0])" }
}
function Pastikan-Identitas($Proses, [string]$Berkas, [string]$Nama) {
    if (-not $Proses -or -not $Proses.ExecutablePath -or
        (Split-Path $Proses.ExecutablePath -Leaf) -ne 'node.exe' -or
        -not $Proses.CommandLine -or
        $Proses.CommandLine.Replace('/', '\') -notmatch ('(?i)(?:^|\s|")' + [Regex]::Escape($Berkas.Replace('/', '\')) + '(?:"|\s|$)')) {
        throw "${Nama}: identitas tidak cocok dengan entrypoint absolut workspace. Tidak menjalankan duplikat atau menghentikan proses. Periksa PID secara manual."
    }
    Write-Host "[AKTIF] $Nama PID $($Proses.ProcessId)"
}
function Mulai-Node([string]$Nama, [string]$Berkas, [string]$Folder, [int]$Port) {
    $pemilik = Pemilik-Port $Port
    if ($pemilik) { Pastikan-Identitas $pemilik $Berkas $Nama; return }
    if ($Periksa) { throw "$Nama belum aktif pada port $Port." }
    Start-Process -FilePath $script:node -ArgumentList ('"' + $Berkas + '"') -WorkingDirectory $Folder `
        -WindowStyle Hidden -RedirectStandardOutput (Join-Path $script:log "$Nama.out.log") `
        -RedirectStandardError (Join-Path $script:log "$Nama.err.log") | Out-Null
    for ($i=0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 250
        $pemilik = Pemilik-Port $Port
        if ($pemilik) { Pastikan-Identitas $pemilik $Berkas $Nama; return }
    }
    throw "$Nama belum siap; periksa log privat $script:log."
}
function Periksa-Webhook([string]$Origin) {
    & $script:node (Join-Path $script:backend 'scripts\periksa-webhook-development.mjs') $Origin
    if ($LASTEXITCODE -ne 0) { throw "Jalur webhook belum siap pada $Origin." }
}
function Mulai-Aplikasi([string]$Nama, [string]$Folder, [string]$Program, [string[]]$Argumen, [int]$Port) {
    if (Pemilik-Port $Port) {
        Write-Host "[LEWATI] $Nama port $Port sudah dipakai; tidak membuat proses kedua."
        return
    }
    if ($Periksa) { return }
    Start-Process -FilePath $Program -ArgumentList $Argumen -WorkingDirectory $Folder -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $script:log "$Nama.out.log") `
        -RedirectStandardError (Join-Path $script:log "$Nama.err.log") | Out-Null
}
try {
    if ($Ngrok -and $TanpaNgrok) { throw 'Pilih -Ngrok atau -TanpaNgrok.' }
    if (-not $Stage2) { $Stage2 = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
    $akar = (Resolve-Path -LiteralPath $Stage2).Path
    $repo = Join-Path $akar 'barberbarbar'
    $script:backend = Join-Path $repo 'server'
    if (-not (Test-Path -LiteralPath (Join-Path $backend 'package.json'))) { throw 'Lokasi backend tidak valid.' }
    $script:node = (Get-Command node.exe -ErrorAction Stop).Source
    # Mutex menyerialkan dua launcher bersamaan, tanpa menyimpan credential/PID basi.
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $id = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($backend.ToLowerInvariant()))).Replace('-', '') }
    finally { $sha.Dispose() }
    $kunci = New-Object Threading.Mutex($false, "Local\BARBERBARBAR-$id")
    try { $memilikiKunci = $kunci.WaitOne(0) } catch [Threading.AbandonedMutexException] { $memilikiKunci = $true }
    if (-not $memilikiKunci) { throw 'Launcher workspace sedang berjalan; tidak membuat proses duplikat.' }
    $script:log = Join-Path $env:LOCALAPPDATA 'BARBERBARBAR\development'
    if (-not $Periksa) { New-Item -ItemType Directory -Force -Path $log | Out-Null }
    $entry = Join-Path $backend 'dist\server.js'
    $existing = Pemilik-Port 3000
    if (-not $existing -and -not $Periksa) {
        Push-Location $backend
        try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build backend gagal.' } }
        finally { Pop-Location }
    }
    Mulai-Node 'backend' $entry $backend 3000
    $respons = Invoke-RestMethod -Uri 'http://127.0.0.1:3000' -TimeoutSec 10
    if ($respons.pesan -ne 'Barbershop Management API berjalan') { throw 'Respons backend tidak sesuai.' }
    Periksa-Webhook 'http://127.0.0.1:3000'
    # Proxy tetap lokal; hanya satu route POST JSON dapat diteruskan.
    Mulai-Node 'proxy-webhook' (Join-Path $backend 'scripts\jalankan-proxy-webhook.mjs') $backend 3001
    Periksa-Webhook 'http://127.0.0.1:3001'
    $tunnelAda = $null -ne (Pemilik-Port 4040)
    if ($Ngrok -or $tunnelAda) {
        if (-not $tunnelAda) {
            if ($Periksa) { throw 'Ngrok belum aktif.' }
            $exe = (Get-Command ngrok.exe -ErrorAction SilentlyContinue).Source
            if (-not $exe -and (Test-Path -LiteralPath 'C:\laragon\bin\ngrok\ngrok.exe')) { $exe = 'C:\laragon\bin\ngrok\ngrok.exe' }
            if (-not $exe) { throw 'Ngrok belum tersedia. Tidak memasang software otomatis.' }
            Start-Process -FilePath $exe -ArgumentList @('http','3001','--inspect=false') -WorkingDirectory $backend -WindowStyle Hidden `
                -RedirectStandardOutput (Join-Path $log 'ngrok.out.log') -RedirectStandardError (Join-Path $log 'ngrok.err.log') | Out-Null
        }
        $tunnels = $null
        for ($i=0; $i -lt 40; $i++) {
            try { $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2; break }
            catch { Start-Sleep -Milliseconds 250 }
        }
        $pemilikNgrok = Pemilik-Port 4040
        if (-not $pemilikNgrok -or (Split-Path $pemilikNgrok.ExecutablePath -Leaf) -ne 'ngrok.exe') { throw 'Identitas agent ngrok tidak sesuai.' }
        $aman = @($tunnels.tunnels | Where-Object {
            $tujuan = $null
            [Uri]::TryCreate($_.config.addr, [UriKind]::Absolute, [ref]$tujuan) -and
            $tujuan.Host -in @('localhost','127.0.0.1') -and $tujuan.Port -eq 3001 -and $_.proto -eq 'https'
        })
        if ($aman.Count -ne 1 -or @($tunnels.tunnels | Where-Object { $_.proto -eq 'https' }).Count -ne 1) {
            throw 'Forwarding ngrok tidak tepat: wajib satu tunnel HTTPS menuju loopback port 3001. Tidak mengubah/menghentikan tunnel existing.'
        }
        Periksa-Webhook $aman[0].public_url
        Write-Host "[SIAP] Notification URL Sandbox: $($aman[0].public_url)/midtrans/notifications"
    } else { Write-Host '[OPSIONAL] Ngrok tidak dijalankan. Gunakan -Ngrok hanya untuk pengujian pembayaran.' }
    if (-not $HanyaBackend) {
        $npmCli = Join-Path (Split-Path $node -Parent) 'node_modules\npm\bin\npm-cli.js'
        Mulai-Aplikasi 'web' (Join-Path $repo 'client') $node @(('"'+$npmCli+'"'),'run','dev') 5173
        Mulai-Aplikasi 'customer-web' (Join-Path $akar 'barberbarbar-customer-web') $node @(('"'+$npmCli+'"'),'run','dev') 5175
        foreach ($app in @(@{Nama='staff';Repo='barberbarbar-mobile';Port=8081})) {
            $folder = Join-Path $akar $app.Repo
            Mulai-Aplikasi $app.Nama $folder $node @(('"'+(Join-Path $folder 'node_modules\expo\bin\cli')+'"'),'start','--lan','--port',[string]$app.Port) $app.Port
        }
    }
    Write-Host "[SIAP] Backend 3000; proxy 3001. Log privat: $log"
    if (-not $HanyaBackend) { Write-Host '[APLIKASI] Web Admin http://127.0.0.1:5173; Customer Web http://127.0.0.1:5175; Expo Staff 8081. Customer Native merupakan arsip dan tidak dijalankan.' }
    Write-Host 'Backend existing tidak di-build/restart otomatis. Laptop/tunnel mati berarti webhook tidak tersedia; bukan uptime Production.'
} catch { Write-Error $_.Exception.Message -ErrorAction Continue; exit 1 }
finally { if ($memilikiKunci) { $kunci.ReleaseMutex() }; if ($kunci) { $kunci.Dispose() } }
