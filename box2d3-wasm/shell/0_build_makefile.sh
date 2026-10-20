#!/usr/bin/env bash
# FLAVOUR=deluxe TARGET_TYPE=Debug ./shell/0_build_makefile.sh
# PRECISION=double builds Box2D's large world mode into cmake-build-$FLAVOUR-double (default: single)
set -eo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
B2D_WASM_DIR="$(realpath "$DIR/..")"
BOX2D_DIR="$(realpath "$DIR/../../box2d")"
CMAKE_WRAPPER_DIR="$(realpath "$DIR/../cmake")"
PATCHED_BOX2D_DIR="$B2D_WASM_DIR/build/box2d-src"

# This script just does what the README says, except with some extra validation and interactivity.
# If you're more interested in going through step-by-step, and avoiding rebuilds of files you've 
# already built: you'll probably prefer to cherry-pick lines from the README.

Red='\033[0;31m'
Purple='\033[0;35m'
NC='\033[0m' # No Color

# if ! [[ "$PWD" -ef "$DIR" ]]; then
#   >&2 echo -e "${Red}This script is meant to be run from <repository_root>/box2d-wasm${NC}"
#   exit 1
# fi

CMAKE_OPTS=()
CFLAGS=()
CXXFLAGS=()
case "$FLAVOUR" in
  compat)
    CMAKE_OPTS=(${CMAKE_OPTS[@]} -DBOX2D_DISABLE_SIMD=ON)
    ;;
  deluxe)
    # BOX2D_DISABLE_SIMD is probably OFF by default but let's be explicit
    CMAKE_OPTS=(${CMAKE_OPTS[@]} -DBOX2D_DISABLE_SIMD=OFF)
    # NOTE: -msimd128 -msse2 flags are probably redundant; I think box2d applies those for us now.
    # https://github.com/erincatto/box2d/blob/0f2b0246f39594e93fcc8dde0fe0bb1b20b403f9/src/CMakeLists.txt#L170
    # but I think it should be harmless to have the options duplicated.
    CFLAGS=(${CFLAGS[@]} -msimd128 -msse2 -pthread -s USE_PTHREADS=1)
    CXXFLAGS=(${CXXFLAGS[@]} -msimd128 -msse2 -pthread -s USE_PTHREADS=1)
    ;;
  *)
    >&2 echo -e "${Red}FLAVOUR not set.${NC}"
    >&2 echo -e "Please set FLAVOUR to 'compat' or 'deluxe'. For example, with:"
    >&2 echo -e "${Purple}export FLAVOUR='deluxe'${NC}"
    exit 1
    ;;
esac

BUILD_NAME="$FLAVOUR"
case "${PRECISION:-single}" in
  single)
    ;;
  double)
    BUILD_NAME="$FLAVOUR-double"
    CMAKE_OPTS=(${CMAKE_OPTS[@]} -DBOX2D_DOUBLE_PRECISION=ON)
    ;;
  *)
    >&2 echo -e "${Red}PRECISION must be 'single' or 'double'.${NC}"
    exit 1
    ;;
esac

# Box2D is built from a patched copy of the submodule, so the submodule itself stays clean.
# The patches fix upstream bugs, see patches/box2d.
>&2 echo -e '\nCopying and patching Box2D sources'
rm -rf "$PATCHED_BOX2D_DIR"
mkdir -p "$PATCHED_BOX2D_DIR"
cp -Rp "$BOX2D_DIR/CMakeLists.txt" "$BOX2D_DIR/include" "$BOX2D_DIR/src" "$PATCHED_BOX2D_DIR/"
for PATCH in "$B2D_WASM_DIR"/patches/box2d/*.patch; do
  >&2 echo -e "applying $(basename "$PATCH")"
  patch -s -p1 -d "$PATCHED_BOX2D_DIR" < "$PATCH"
done

>&2 echo -e '\nGenerating Makefile with emcmake'

case "$TARGET_TYPE" in
  RelWithDebInfo | Release | Debug)
    ;;
  *)
    >&2 echo -e "${Red}TARGET_TYPE not set.${NC}"
    >&2 echo -e "Please set TARGET_TYPE to 'Debug', 'Release', or 'RelWithDebInfo'. For example, with:"
    >&2 echo -e "${Purple}export TARGET_TYPE='Debug'${NC}"
    exit 1
    ;;
esac
>&2 echo -e "TARGET_TYPE is $TARGET_TYPE"

set -x
CFLAGS="${CFLAGS[@]}" \
CXXFLAGS="${CXXFLAGS[@]}" \
emcmake cmake \
-DCMAKE_BUILD_TYPE="$TARGET_TYPE" \
-B"cmake-build-$BUILD_NAME" \
-S"$CMAKE_WRAPPER_DIR" \
-DBOX2D_DIR="$PATCHED_BOX2D_DIR" \
"${CMAKE_OPTS[@]}" \
-DBOX2D_VALIDATE=OFF
