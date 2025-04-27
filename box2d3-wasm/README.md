# box2d3-wasm

[Box2D v3][] ported to the web via [wasm][]!

## Online Demos
- [box2d v3 samples](https://birch-san.github.io/box2d3-wasm/demo/samples)
- [pyramid drop demo](https://birch-san.github.io/box2d3-wasm/demo/modern/?threading=1&pyramidHeight=100&hd=0)
*You can change the size of the pyramid by editing the "pyramidHeight" URL parameter. Set it to 101 for a pyramid with 5,050 boxes!*

## Usage

### Web Usage

See the [pyramid drop demo code](demo/modern/demo.js) for an example of how to use box2d3-wasm in a Web browser. You'll need to serve the assets correctly in order to access performance features such as threading. See the [Serving Requirements](#serving-requirements) section below.

### NodeJS Usage

See the [integration test code](integration-test/index.mjs) for an example of how to use box2d3-wasm via NodeJS. There'll be no graphics; you probably only want the NodeJS approach if you're building server-side physics or you intend to build your own native GUI.

### Available on npm

Install as an [npm package](https://www.npmjs.com/package/box2d3-wasm):

```bash
npm i --save box2d3-wasm
```

## Build from Source Pre-Requisites

Install [Node.js and npm][].

emscripten seems to go bang if you PATH a local typescript, so I had to make it global.

Install typescript and yarn.

```bash
npm i -g typescript
npm i -g yarn
```

Next, install [Emscripten][]. On macOS, you can use [Homebrew][] to install it.

```bash
brew install emscripten
```

Clone the repository with submodules:

```bash
git clone --recurse-submodules https://github.com/Birch-san/box2d3-wasm.git
```

## Build

Run the following commands:

```bash
FLAVOUR=deluxe TARGET_TYPE=Debug ./shell/0_build_makefile.sh
emmake make -j8 -C cmake-build-deluxe
FLAVOUR=deluxe TARGET_TYPE=Debug ./shell/1_build_wasm.sh
```

## Run Demos

Inside the `demo` directory, run `yarn` to install `local-web-server` locally.

Then, to start the web server run `yarn serve`.

## Serving Requirements

Note that the server runs with the following CORS headers:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

These policies are required for the Box2D3 WebAssembly module to run with threading, because it uses the SharedArrayBuffer feature which requires an isolated context for security reasons.

Regardless of whether you use threading: you may need web server customizations (or good defaults) to serve WASM assets with the correct MIME type (`application/wasm`).

## Run Tests

```bash
node integration-test/index.mjs
```

## Release

From `box2d3-wasm` package's directory,

```bash
git clean -dfx build cmake-build-deluxe cmake-build-compat

FLAVOUR=deluxe TARGET_TYPE=Release ./shell/0_build_makefile.sh
emmake make -j8 -C cmake-build-deluxe
FLAVOUR=deluxe TARGET_TYPE=Release ./shell/1_build_wasm.sh

FLAVOUR=compat TARGET_TYPE=Release ./shell/0_build_makefile.sh
emmake make -j8 -C cmake-build-compat
FLAVOUR=compat TARGET_TYPE=Release ./shell/1_build_wasm.sh

# e.g. major | minor | patch, see https://docs.npmjs.com/cli/v10/commands/npm-version
npm version minor
npm publish
```

## Licensing

[Box2D v3][] is licensed under the MIT License by Erin Catto.

box2d3-wasm is licensed under the MIT License by Alex Birch & Erik Sombroek.

[Box2D v3]: https://github.com/erincatto/box2d
[wasm]: https://webassembly.org/
[Node.js and npm]: https://nodejs.org/en/download/
[Emscripten]: https://emscripten.org/docs/getting_started/downloads.html
[Homebrew]: https://brew.sh/
