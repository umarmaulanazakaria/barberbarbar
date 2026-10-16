if (-not ('Barberbarbar.IdentitasProses' -as [type])) {
    Add-Type -Path (Join-Path $PSScriptRoot 'IdentitasProses.cs')
}
function Jalur-Normal([string]$Jalur) {
    if (-not [IO.Path]::IsPathRooted($Jalur) -or $Jalur -notmatch '^(?:[A-Za-z]:[\\/]|\\\\)') {
        throw 'Path absolut tidak dapat dipastikan.'
    }
    return [IO.Path]::GetFullPath($Jalur).TrimEnd('\', '/')
}
function Baca-IdentitasNode($Proses) {
    if (-not $Proses -or -not $Proses.ExecutablePath -or -not $Proses.CommandLine -or
        -not $Proses.CreationDate -or
        (Jalur-Normal $Proses.ExecutablePath) -ine (Jalur-Normal $script:node)) { return }
    $argumenNode = [Barberbarbar.IdentitasProses]::Argumen($Proses.CommandLine)
    $indeksEntry = 1
    $watcher = $false
    while ($indeksEntry -lt $argumenNode.Count -and $argumenNode[$indeksEntry].StartsWith('-')) {
        $opsiNode = $argumenNode[$indeksEntry]
        if ($opsiNode -eq '--watch' -or $opsiNode.StartsWith('--watch-path=')) { $watcher = $true }
        elseif ($opsiNode -ne '--watch-preserve-output') { return }
        $indeksEntry++
    }
    # Exact script position, not an arbitrary matching argument after another script/eval.
    if ($indeksEntry -ne $argumenNode.Count - 1) { return }
    $entryNode = $argumenNode[$indeksEntry]
    if (-not [IO.Path]::IsPathRooted($entryNode)) {
        $cwdNode = [Barberbarbar.IdentitasProses]::DirektoriKerja([int]$Proses.ProcessId)
        $entryNode = Join-Path (Jalur-Normal $cwdNode) $entryNode
    }
    $entryNode = Jalur-Normal $entryNode
    $segar = Get-CimInstance Win32_Process -Filter "ProcessId=$($Proses.ProcessId)" -ErrorAction Stop
    if (-not $segar -or $segar.CreationDate -ne $Proses.CreationDate -or
        $segar.CommandLine -cne $Proses.CommandLine -or $segar.ExecutablePath -ine $Proses.ExecutablePath) {
        throw 'Identitas proses berubah saat diperiksa; coba kembali setelah restart selesai.'
    }
    return [pscustomobject]@{ Entry=$entryNode; Watcher=$watcher; Proses=$segar }
}
function Cari-WatcherBackend([string]$Berkas) {
    foreach ($calon in @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop)) {
        if ($calon.CommandLine -notmatch '--watch(?:\s|=|-path=)' -or $calon.CommandLine -notmatch 'server\.js') { continue }
        $identitas = Baca-IdentitasNode $calon
        if (-not $identitas) { throw 'Watcher Node ditemukan tetapi identitasnya tidak dapat diverifikasi; tidak memulai backend tambahan.' }
        if ($identitas -and $identitas.Watcher -and $identitas.Entry -ieq (Jalur-Normal $Berkas)) { return $calon }
    }
}
