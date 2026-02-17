$ErrorActionPreference = 'Stop'

$python = Join-Path $PSScriptRoot 'venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw "Virtualenv python not found at $python"
}

# Ensure only one local Flask server owns 127.0.0.1:5000.
$listeners = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $listeners) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -ieq 'python') {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

$required = @('DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME')
$missing = @(
    $required | Where-Object {
        $name = $_
        $value = (Get-Item -Path ("Env:" + $name) -ErrorAction SilentlyContinue).Value
        [string]::IsNullOrWhiteSpace($value)
    }
)
if ($missing.Count -gt 0) {
    throw "Missing environment variables: $($missing -join ', ')"
}

& $python -m flask --app app db upgrade
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $python app.py
