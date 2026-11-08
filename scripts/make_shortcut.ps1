# Create the "Pit Pal" shortcut (Desktop + Start menu) with the Pit Pal app icon.
# It runs PitPal.bat with its console minimised, so only Rev shows over the game.
# Run once from the repo root in a normal PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\make_shortcut.ps1
# Then right-click the Desktop shortcut > Show more options > Pin to taskbar (Windows does not let programs pin themselves).
$repo = Split-Path -Parent $PSScriptRoot
$bat  = Join-Path $repo 'PitPal.bat'
$icon = Join-Path $repo 'pitpal\assets\icon\pitpal.ico'
if (-not (Test-Path $icon)) { throw "icon missing: build it with  uv run --no-project --with pillow python pitpal/tools/make_icon.py" }
$shell = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('Programs')) ''))
foreach ($dir in $places) {
    $lnk = $shell.CreateShortcut((Join-Path $dir 'Pit Pal.lnk'))
    $lnk.TargetPath       = "$env:SystemRoot\System32\cmd.exe"
    $lnk.Arguments        = "/c `"`"$bat`"`""
    $lnk.WorkingDirectory = $repo
    $lnk.IconLocation     = "$icon,0"
    $lnk.WindowStyle      = 7          # minimised: the coach's console stays out of the way
    $lnk.Description      = 'Pit Pal: Rev, the coach and the phone receiver'
    $lnk.Save()
    Write-Host "created $(Join-Path $dir 'Pit Pal.lnk')"
}
