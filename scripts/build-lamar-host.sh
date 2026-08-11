#!/bin/sh
set -eu

npm run build

rm -rf lamar-dist
mkdir -p lamar-dist/lamar
cp -f dist/lamar/index.html lamar-dist/index.html
cp -Rf public/lamar/. lamar-dist/lamar/
cp -f public/favicon.ico lamar-dist/favicon.ico
