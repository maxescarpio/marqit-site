#!/bin/sh
# Copies the static site into www/ for Capacitor
set -e
rm -rf www && mkdir www
for f in *.html *.js *.css *.png *.jpg *.svg *.ico *.json *.txt; do
  case "$f" in package*.json|capacitor.config.json|wrangler.jsonc) continue;; esac
  [ -e "$f" ] && cp "$f" www/
done
for d in artists event-art question-photos; do [ -d "$d" ] && cp -r "$d" www/; done
