@REM 当前目录
cd %~dp0

@REM 构建应用
wails build

@REM upx -9 build\bin\acp_desktop.exe
upx -9 build\bin\acp_desktop.exe
