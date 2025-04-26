#!/usr/bin/env bash
# FLAVOUR=deluxe TARGET_TYPE=Debug ./shell/0_build_makefile.sh
set -eo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BOX2D_DIR="$(realpath "$DIR/../../box2d")"

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
-B"cmake-build-$FLAVOUR" \
-S"$BOX2D_DIR" \
"${CMAKE_OPTS[@]}" \
-DBOX2D_VALIDATE=OFF \
-DBOX2D_SAMPLES=OFF \
-DBOX2D_UNIT_TESTS=OFF \
-DBOX2D_DOCS=OFF
