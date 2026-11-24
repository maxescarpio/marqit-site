#!/bin/sh
# Rebuilds app.min.js (what index.html loads) from app.js.
# Run after every edit to app.js, then bump the ?v= on the app.min.js script tag in index.html.
set -e
npx --yes esbuild@0.24 app.js --minify --target=es2018 --banner:js='/* Copyright (c) 2026 Grand Media Group LLC. All rights reserved. Marqit is a trademark of Grand Media Group LLC. */' --outfile=app.min.js
