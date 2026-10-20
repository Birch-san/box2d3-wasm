#!/usr/bin/env bash
# ./shell/generate_box2cpp.sh
# Regenerates csrc/generated/box2cpp/box2cpp.h from the box2d headers, using the box2cpp generator.
#
# box2cpp ships a pre-generated header, but it lags behind box2d releases. So we run its generator
# ourselves against our box2d submodule, with a small patch (shell/box2cpp-generator.patch) for
# header changes the upstream generator does not handle yet. Requires gawk and perl.
set -eo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
B2D_WASM_DIR="$(realpath "$DIR/..")"
MONOREPO_DIR="$(realpath "$B2D_WASM_DIR/..")"
BOX2D_DIR="$(realpath "$MONOREPO_DIR/box2d")"
B2CPP_DIR="$(realpath "$MONOREPO_DIR/box2cpp")"
OUT_DIR="$B2D_WASM_DIR/csrc/generated/box2cpp"

Red='\033[0;31m'
Green='\033[0;32m'
NC='\033[0m' # No Color

if ! command -v gawk >/dev/null; then
  >&2 echo -e "${Red}gawk is required (brew install gawk)${NC}"
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# The generator reads the box2d version from ./box2d, so give it the same layout as its own repo.
cp -R "$B2CPP_DIR/generator" "$WORK_DIR/generator"
ln -s "$BOX2D_DIR" "$WORK_DIR/box2d"
patch -s -d "$WORK_DIR" -p1 < "$DIR/box2cpp-generator.patch"

mkdir -p "$OUT_DIR"
cd "$WORK_DIR"
# Join declarations that span several lines (box2d wraps long parameter lists), then generate.
cat box2d/include/box2d/*.h \
  | perl -pe 'while ((tr/(//) > (tr/)//)) { my $n = <>; last unless defined $n; chomp; $n =~ s/^\s+//; $_ .= " " . $n; }' \
  | gawk -f generator/generate.awk -vsecond_file=tmp.part2 > box2cpp.h
cat tmp.part2 >> box2cpp.h
mv box2cpp.h "$OUT_DIR/box2cpp.h"

>&2 echo -e "${Green}Generated $OUT_DIR/box2cpp.h${NC}"
