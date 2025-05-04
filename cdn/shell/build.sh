#!/usr/bin/env bash
set -eo pipefail
DIR="$(dirname "$(realpath "$0")")"
CDN_DIR="$(realpath "$DIR/..")"
REPO_ROOT="$(realpath "$CDN_DIR/..")"
VERSION="$(node -p "require('$REPO_ROOT/box2d3-wasm/package.json').version")"
WORKSPACE="$CDN_DIR/workspace"
DIST="$CDN_DIR/dist"
DISTVER="$DIST/$VERSION"
mkdir -p "$WORKSPACE" "$DISTVER"
cd "$WORKSPACE"
npm i "box2d3-wasm@$VERSION"
cp -r "$WORKSPACE/node_modules/box2d3-wasm/build/dist/es" "$DISTVER/es"
echo "Copied output to $DISTVER/es"