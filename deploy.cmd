@echo off
rem Uploads the website to the VPS (trips.worldschoolingjourneys.com).
rem Run from Command Prompt:  deploy
rem Leaves out the admin dashboard (stays on this PC), the local test server,
rem design mockups and git/log files.
cd /d "%~dp0"
set ARCHIVE=%TEMP%\wsj-site.tgz
tar -czf "%ARCHIVE%" --exclude=.git --exclude=.github --exclude=admin.html --exclude=server.js --exclude=templates --exclude=*.log --exclude=desktop.ini --exclude=deploy.cmd --exclude=.gitignore --exclude=.gitattributes --exclude=.htaccess .
if errorlevel 1 goto :fail
scp "%ARCHIVE%" melike@178.105.202.222:/tmp/wsj-site.tgz
if errorlevel 1 goto :fail
ssh melike@178.105.202.222 "mkdir -p ~/apps/website && tar -xzf /tmp/wsj-site.tgz -C ~/apps/website && rm /tmp/wsj-site.tgz && echo Uploaded: && ls ~/apps/website"
if errorlevel 1 goto :fail
del "%ARCHIVE%"
echo.
echo Done - https://trips.worldschoolingjourneys.com
goto :eof
:fail
echo.
echo Upload failed - see the message above.
exit /b 1
