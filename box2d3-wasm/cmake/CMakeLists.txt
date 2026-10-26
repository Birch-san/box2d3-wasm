cmake_minimum_required(VERSION 3.22)

# Wrapper project for building the Box2D static library with Emscripten.
#
# Since v3.2, Box2D's own CMakeLists force-enables pthreads for Emscripten builds when it is the
# top-level project. That breaks our single-threaded 'compat' flavour, so we build Box2D as a
# subproject instead and pass the threading flags ourselves (see shell/0_build_makefile.sh).
# Being a subproject also means Box2D's samples, unit tests and docs are never configured.
project(box2d3_wasm LANGUAGES C CXX)

if (NOT BOX2D_DIR)
	message(FATAL_ERROR "BOX2D_DIR must point at the box2d source checkout")
endif()

add_subdirectory("${BOX2D_DIR}" box2d)
