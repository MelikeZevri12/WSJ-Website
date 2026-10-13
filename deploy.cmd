@echo off
rem Uploads the website to the VPS (trips.worldschoolingjourneys.com).
rem Run from Command Prompt:  deploy
rem First builds the finished pages (shared navbar/footer filled in, see
rem tools\build.js), leaving out the admin dashboard (stays on this PC), the
rem local test server, design mockups, build tools and git/log files.
cd /d "%~dp0"
set ARCHIVE=%TEMP%\wsj-site.tgz
set BUILD=%TEMP%\wsj-site-build
node tools\build.js "%BUILD%"
if errorlevel 1 goto :fail
tar -czf "%ARCHIVE%" -C "%BUILD%" .
if errorlevel 1 goto :fail
scp "%ARCHIVE%" melike@178.105.202.222:/tmp/wsj-site.tgz
if errorlevel 1 goto :fail
rem Windows tar records folders as read-only - reset them to writable before and after unpacking, and don't copy Windows permissions
ssh melike@178.105.202.222 "mkdir -p ~/apps/website && chmod -R u+w ~/apps/website && tar --warning=no-unknown-keyword --no-same-permissions --no-overwrite-dir -xzf /tmp/wsj-site.tgz -C ~/apps/website && chmod -R u+w,a+rX ~/apps/website && rm /tmp/wsj-site.tgz && echo Uploaded: && ls ~/apps/website"
if errorlevel 1 goto :fail
del "%ARCHIVE%"
rmdir /s /q "%BUILD%"
echo.
echo Done - https://trips.worldschoolingjourneys.com
goto :eof
:fail
echo.
echo Upload failed - see the message above.
exit /b 1
