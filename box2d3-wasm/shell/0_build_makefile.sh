#!/usr/bin/env bash
# FLAVOUR=simd TARGET_TYPE=Debug ./shell/0_build_makefile.sh
set -eo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BOX2D_DIR="$(realpath "$DIR/../../box2d")"
ENKITS_DIR="$DIR/../csrc/extern/enkiTS"

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

# Add enkiTS download and setup
setup_enkits() {
    echo -e "\nSetting up enkiTS..."
    if [ ! -d "$ENKITS_DIR" ]; then
        mkdir -p "$ENKITS_DIR"
        # Clone enkiTS repository
        git clone --depth 1 https://github.com/dougbinks/enkiTS.git "$ENKITS_DIR.tmp"

        # Copy the entire src directory
        mkdir -p "$ENKITS_DIR"
        cp -r "$ENKITS_DIR.tmp/src" "$ENKITS_DIR/"

        # Clean up temporary clone
        rm -rf "$ENKITS_DIR.tmp"

        echo "enkiTS files downloaded and set up in $ENKITS_DIR"
    else
        echo "enkiTS files already exist in $ENKITS_DIR"
    fi
}
setup_enkits

CMAKE_OPTS=()
CMAKE_CXX_FLAGS=()
CMAKE_C_FLAGS=()
case "$FLAVOUR" in
  standard)
    # maybe we don't need to disable SIMD? seems to compile fine
    # CMAKE_OPTS=(${CMAKE_OPTS[@]} -DBOX2D_ENABLE_SIMD=OFF)
    ;;
  simd)
    # this is ON by default but let's be explicit
    CMAKE_OPTS=(${CMAKE_OPTS[@]} -DBOX2D_ENABLE_SIMD=ON)
    CMAKE_CXX_FLAGS=(${CMAKE_CXX_FLAGS[@]} "-msimd128 -pthread -matomics -mbulk-memory")
    CMAKE_C_FLAGS=(${CMAKE_C_FLAGS[@]} "-pthread -matomics -mbulk-memory")
    CMAKE_OPTS=(${CMAKE_OPTS[@]} "-DCMAKE_EXE_LINKER_FLAGS=-pthread -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4 -s ALLOW_MEMORY_GROWTH=1")
    ;;
  *)
    >&2 echo -e "${Red}FLAVOUR not set.${NC}"
    >&2 echo -e "Please set FLAVOUR to 'standard' or 'simd'. For example, with:"
    >&2 echo -e "${Purple}export FLAVOUR='simd'${NC}"
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
emcmake cmake \
-DCMAKE_BUILD_TYPE="$TARGET_TYPE" \
-DCMAKE_CXX_FLAGS="${CMAKE_CXX_FLAGS[@]}" \
-DCMAKE_C_FLAGS="${CMAKE_C_FLAGS[@]}" \
-B"cmake-build" \
-S"$BOX2D_DIR" \
"${CMAKE_OPTS[@]}" \
-DBOX2D_VALIDATE=OFF \
-DBOX2D_SAMPLES=OFF \
-DBOX2D_UNIT_TESTS=OFF \
-DBOX2D_DOCS=OFF
