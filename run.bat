@Echo off

:Main
cd build
node -r tsconfig-paths/register src/dwl.js
pause


goto Main