$ErrorActionPreference = 'Stop'

$python = Join-Path $PSScriptRoot 'venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw "Virtualenv python not found at $python"
}

# Load .env if present (only fills values that are not already in current shell).
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path $envFile) {
    Get-Content -Path $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            return
        }
        $parts = $line.Split('=', 2)
        if ($parts.Count -ne 2) {
            return
        }
        $name = $parts[0].Trim()
        if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            return
        }
        $value = $parts[1].Trim().Trim('"').Trim("'")
        $existing = (Get-Item -Path ("Env:" + $name) -ErrorAction SilentlyContinue).Value
        if ([string]::IsNullOrWhiteSpace($existing)) {
            Set-Item -Path ("Env:" + $name) -Value $value
        }
    }
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

# Create the target database automatically so checker can run with one command.
if ($env:DB_NAME -notmatch '^[A-Za-z0-9_]+$') {
    throw "DB_NAME contains invalid characters. Use letters, numbers, and underscore only."
}
$mysql = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysql) {
    throw "MySQL CLI not found in PATH. Install MySQL client tools or add mysql.exe to PATH."
}

$createDbSql = "CREATE DATABASE IF NOT EXISTS $($env:DB_NAME) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$env:MYSQL_PWD = $env:DB_PASSWORD
try {
    & $mysql.Source --protocol=TCP -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER -e $createDbSql
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create/access database $($env:DB_NAME). Check DB credentials and privileges."
    }
}
finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

& $python -m flask --app app db upgrade
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $python app.py
