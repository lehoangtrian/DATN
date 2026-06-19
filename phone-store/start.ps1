# Khởi động Phone Store — chạy file này mỗi lần mở máy

Write-Host "Khởi động MongoDB..." -ForegroundColor Yellow
$mongod = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
if (Test-Path $mongod) {
    Start-Process $mongod -ArgumentList "--dbpath C:\data\db" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "MongoDB OK" -ForegroundColor Green
} else {
    Write-Host "Không tìm thấy mongod.exe" -ForegroundColor Red
}

Write-Host "Khởi động Backend (port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot\server'; npm run dev`"" -WindowStyle Normal
Start-Sleep -Seconds 4

Write-Host "Khởi động Frontend (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot\client'; npm run dev`"" -WindowStyle Normal
Start-Sleep -Seconds 4

Write-Host "Mở trình duyệt..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host "Done! http://localhost:5173" -ForegroundColor Green
