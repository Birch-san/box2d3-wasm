#!/usr/bin/env bash
# FLAVOUR=simd TARGET_TYPE=Debug ./shell/1_build_wasm.sh
set -eo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
B2D_WASM_DIR="$(realpath "$DIR/..")"
MONOREPO_DIR="$(realpath "$B2D_WASM_DIR/..")"
BOX2D_DIR="$(realpath "$MONOREPO_DIR/box2d")"
B2CPP_DIR="$(realpath "$MONOREPO_DIR/box2cpp")"
ENKITS_DIR="$(realpath "$MONOREPO_DIR/enkiTS")"
CMAKEBUILD_DIR="$(realpath "$B2D_WASM_DIR/cmake-build-$FLAVOUR")"
BUILD_DIR="$(realpath "$B2D_WASM_DIR/build")"
CSRC_DIR="$(realpath "$B2D_WASM_DIR/csrc")"

Red='\033[0;31m'
Green='\033[0;32m'
Blue='\033[0;34m'
Purple='\033[0;35m'
NC='\033[0m' # No Color

BASENAME="Box2D.$FLAVOUR"
FLAVOUR_EMCC_OPTS=()
FLAVOUR_LINK_OPTS=()
case "$FLAVOUR" in
  compat)
    ;;
  deluxe)
    FLAVOUR_EMCC_OPTS=(
      ${FLAVOUR_EMCC_OPTS[@]}
      # SIMD
      -msimd128
      -msse2 # probably not necessary now that we're past emmake, unless our glue code adds more SSE
      # threading
      -pthread
      -s USE_PTHREADS=1
      -s PTHREAD_POOL_SIZE=pthreadCount
    )
    FLAVOUR_LINK_OPTS=(
      ${FLAVOUR_LINK_OPTS[@]}
      -pthread
      -s USE_PTHREADS=1
      -s PTHREAD_POOL_SIZE='_emscripten_num_logical_cores()'
    )
    ;;
  *)
    >&2 echo -e "${Red}FLAVOUR not set.${NC}"
    >&2 echo -e "Please set FLAVOUR to 'compat' or 'deluxe'. For example, with:"
    >&2 echo -e "${Purple}export FLAVOUR='deluxe'${NC}"
    exit 1
    ;;
esac

# we used to use -s ENVIRONMENT=web for a slightly smaller build, until Node.js compatibility was requested in https://github.com/Birch-san/box2d-wasm/issues/8
EMCC_OPTS=(
  -std=c++20 # required for box2cpp
  # -fno-rtti # not compatible with embind
  -s MODULARIZE=1
  -s EXPORT_NAME=Box2D
  -s ALLOW_TABLE_GROWTH=1
  -s FILESYSTEM=0
  # -s SUPPORT_LONGJMP=0 # this causes 'undefined symbol: _emscripten_stack_restore'
  -s EXPORTED_FUNCTIONS=_malloc,_free
  -s ALLOW_MEMORY_GROWTH=1
  ${FLAVOUR_EMCC_OPTS[@]}
  )
DEBUG_OPTS=(
  -g3
  -gsource-map
)
RELEASE_OPTS=(-O3)

case "$TARGET_TYPE" in
  Debug)
    LIBARCHIVE="libbox2dd.a"
    EMCC_OPTS=(
      ${EMCC_OPTS[@]}
      ${DEBUG_OPTS[@]}
      -s ASSERTIONS=2
      # -s DEMANGLE_SUPPORT=1 # deprecated
      )
    ;;

  RelWithDebInfo)
    LIBARCHIVE="libbox2d.a"
    # consider setting --source-map-base if you know where
    # Box2D will be served from.
    EMCC_OPTS=(
      ${EMCC_OPTS[@]}
      ${RELEASE_OPTS[@]}
      ${DEBUG_OPTS[@]}
      )
    ;;
  
  Release)
    LIBARCHIVE="libbox2d.a"
    EMCC_OPTS=(
      ${EMCC_OPTS[@]}
      ${RELEASE_OPTS[@]}
      -flto
      --closure 1
      -s IGNORE_CLOSURE_COMPILER_ERRORS=1
      -s EXPORTED_RUNTIME_METHODS=['stackSave','stackRestore','stackAlloc']
      -s STACK_OVERFLOW_CHECK=2
      )
    ;;
  
  *)
    >&2 echo -e "${Red}TARGET_TYPE not set.${NC}"
    >&2 echo -e "Please set TARGET_TYPE to 'Debug' or 'Release'. For example, with:"
    >&2 echo -e "${Purple}export TARGET_TYPE='Debug'${NC}"
    exit 1
    ;;
esac
>&2 echo -e "TARGET_TYPE is $TARGET_TYPE"

ES_DIR="$BUILD_DIR/dist/es/$FLAVOUR"
ES_FILE="$ES_DIR/$BASENAME.mjs"
ES_TSD="$ES_DIR/$BASENAME.d.ts"

mkdir -p "$BUILD_DIR" "$ES_DIR"

>&2 echo -e "${Blue}Building...${NC}"
set -x
emcc -lembind \
"$CSRC_DIR/glue.cpp" \
"$CSRC_DIR/threading.cpp" \
"$CSRC_DIR/debugDraw.cpp" \
"$ENKITS_DIR/src/TaskScheduler.cpp" \
"$CMAKEBUILD_DIR/src/$LIBARCHIVE" \
-I "$BOX2D_DIR/include" \
-I "$ENKITS_DIR/src" \
-I "$B2CPP_DIR/include" \
"${EMCC_OPTS[@]}" \
-s ALLOW_MEMORY_GROWTH=1 \
-s EXPORT_ES6=1 \
"${DEBUG_OPTS[@]}" \
"${FLAVOUR_LINK_OPTS[@]}" \
-o "$ES_FILE" \
--emit-tsd "$ES_TSD"
{ set +x; } 2>/dev/null
>&2 echo -e "${Blue}Built bare WASM${NC}"

ES_PRECURSOR="$ES_DIR/$BASENAME.orig.mjs"
ES_TSD_PRECURSOR="$ES_DIR/$BASENAME.orig.d.ts"
>&2 echo -e "${Blue}Building ES module, $ES_DIR/$BASENAME.{mjs,wasm}${NC}"
set -x
cp "$ES_FILE" "$ES_PRECURSOR"
cp "$ES_TSD" "$ES_TSD_PRECURSOR"

# TODO: make awk error if any of the text replacements fail to match anything, to protect us when emscripten updates.
case "$FLAVOUR" in
  compat)
    # all of our text replacements are just for disabling/tuning deluxe functionality. compat flavour doesn't need any text replacements.
    ;;
  deluxe)
    awk -f "$DIR/modify_emscripten_mjs.$FLAVOUR.awk" \
    -v module_arg_template="$BUILD_DIR/module-arg.template.mjs" \
    -v allocate_unused_worker_template="$BUILD_DIR/allocate-unused-worker.template.mjs" \
    "$ES_PRECURSOR" > "$ES_FILE"
    ;;
esac
awk -f "$DIR/modify_emscripten_dts.awk" -v template="$BUILD_DIR/Box2D.template.d.ts" "$ES_TSD_PRECURSOR" > "$ES_TSD"

{ set +x; } 2>/dev/null
>&2 echo -e "${Green}Successfully built $ES_DIR/$BASENAME.{js,wasm}${NC}\n"
