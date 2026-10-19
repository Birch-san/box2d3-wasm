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

### C++ wrapper (box2cpp)

The C++ classes (`World`, `Body`, `Shape`, joints…) come from [box2cpp](https://github.com/HolyBlackCat/box2cpp), which is generated from the Box2D headers. Its published header lags behind Box2D releases, so we generate our own copy into `csrc/generated/box2cpp/box2cpp.h` (committed). After bumping the `box2d` or `box2cpp` submodules, regenerate it (needs `gawk` and `perl`, e.g. `brew install gawk`):

```bash
./shell/generate_box2cpp.sh
```

Small fixes to the upstream generator live in `shell/box2cpp-generator.patch`.

## Run Demos

Inside the `demo` directory, run `yarn` to install `local-web-server` locally.

Then, to start the web server run `yarn serve`.

The samples can also be smoke tested headlessly (each sample is created, stepped, poked with the mouse and destroyed, with Box2D debug assertions enabled when you built with `TARGET_TYPE=Debug`):

```bash
cd ../demo/samples
node smoke_test.mjs            # every sample
node smoke_test.mjs benchmark  # samples whose name or path matches
```

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

## Upgrading to Box2D v3.2

box2d3-wasm follows the Box2D C API names, so most changes come straight from the [Box2D v3.2 release notes](https://github.com/erincatto/box2d/blob/main/docs/release_notes_v320.md). The ones you are most likely to hit from JavaScript:

- **Queries take an origin.** `b2World_OverlapAABB`, `b2World_OverlapShape`, `b2World_CastShape`, `b2World_CastMover` and `b2World_CollideMover` take a `b2Pos` origin as the second argument; the AABB, proxy or capsule is relative to it. Pass `b2Pos_zero` for the old behaviour.
- **Pre-solve was redesigned.** `b2World_SetPreSolveCallback(worldId, preSolve, preContinuous)` takes two callbacks (either may be `null`). `preSolve(shapeIdA, shapeIdB, manifold)` gets the live `b2Manifold`, which you may edit (set `manifold.pointCount = 0` to disable the contact). `preContinuous(shapeIdA, shapeIdB, point, normal)` returns `false` to skip a time of impact event.
- **Joints.** `b2DestroyJoint(jointId)` no longer takes a wake flag. Current values say so (`b2RevoluteJoint_GetCurrentAngle`, `b2PrismaticJoint_GetCurrentTranslation`, `…GetCurrentMotorTorque/Force`), motor speeds are targets (`…SetTargetMotorSpeed`), and the distance joint uses `SetRestLength`/`SetLimits`/`GetLowerLimit`/`GetUpperLimit`. The wheel joint axis is the x-axis of `localFrameA`, motor joint defaults are zero, and the new mover and pogo joints are available.
- **Bodies and shapes.** `b2Body_UpdateMassFromShapes`, `b2Body_GetLocalCenter`, `b2Body_GetWorldCenter`, `b2Body_EnableSleeping`, `b2Body_IsSleepingEnabled`, `b2Body_ComputeBounds`, `b2Shape_GetBounds` and `b2Shape_CastRay(shapeId, origin, translation)` replace the old names. `b2Body_SetTargetTransform` takes a wake flag.
- **Chains.** `b2ChainDef.count` is now `pointCount`, open chains need `ghost1` and `ghost2`, and every segment of an open chain collides.
- **Contacts.** Contact events and `b2ContactData` carry a `contactId`; use `b2Contact_IsValid` and `b2Contact_GetData`. `b2ManifoldPoint.point` was removed.
- **World.** `b2World_SetMaxLinearSpeed`/`GetMaxLinearSpeed` replace the `Maximum` spelling, `b2World_EnableSpeculative` is gone, and `b2WorldDef.contactSpeed`, restitution iterations/propagation and contact recycling (`b2World_SetContactRecycleDistance`) are new. Contact recycling is on by default.
- **Profile and debug draw.** `b2Profile` uses `solverSetup`, `constraints` and `restitution`; `b2DebugDraw.drawContactPoints` is now `drawContacts`.
- **Collision helpers** are verb first: `b2CastRayCircle`, `b2CastShapePolygon`, `b2ComputeShapeDistance`, and `b2Compute*Bounds` replace `b2Compute*AABB`.
- **New:** world snapshots (`b2World_GetSnapshot` returns a `Uint8Array`, `b2World_RestoreFromSnapshot`, `b2CreateWorldFromSnapshot`, `b2World_GetStateHash`), integer user data on bodies, shapes and joints (`b2Body_SetUserData(bodyId, n)`), per-body continuous `safetyFactor`, wind and drag (`b2Shape_ApplyWind`), and joint force/torque thresholds.
- JavaScript callbacks (pre-solve, custom filter, friction and restitution mixing) only work in single-threaded worlds, because they cannot be called from worker threads.

Not bound yet: recording and replay, the standalone dynamic tree, and the double precision large world build.

## Licensing

[Box2D v3][] is licensed under the MIT License by Erin Catto.

box2d3-wasm is licensed under the MIT License by Alex Birch & Erik Sombroek.

[Box2D v3]: https://github.com/erincatto/box2d
[wasm]: https://webassembly.org/
[Node.js and npm]: https://nodejs.org/en/download/
[Emscripten]: https://emscripten.org/docs/getting_started/downloads.html
[Homebrew]: https://brew.sh/
