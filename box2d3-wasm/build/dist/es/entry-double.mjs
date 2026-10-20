/**
 * Double precision (large world) build of box2d3-wasm: b2Pos and b2WorldTransform hold double
 * precision positions, so worlds can extend far beyond what single precision allows.
 * @import { MainModule, ModuleOptions } from './deluxe-double/Box2D.deluxe-double'
 * @param {ModuleOptions} options
 * @return {Promise<MainModule>}
 */
export default async (options, ...args) => {
    /**
     * This validation expression comes from wasm-feature-detect:
     * https://github.com/GoogleChromeLabs/wasm-feature-detect
     * 
     * Copyright 2019 Google Inc. All Rights Reserved.
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *     http://www.apache.org/licenses/LICENSE-2.0
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const hasSIMD = WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
    /** @type {{ 'default': (options?: unknown) => MainModule) }} */
    const Box2DModule = await (
      (hasSIMD && (typeof window === 'undefined' || window.crossOriginIsolated === true))
        ? import('./deluxe-double/Box2D.deluxe-double.mjs')
        : import('./compat-double/Box2D.compat-double.mjs')
    );
    const { 'default': Box2DFactory } = Box2DModule;
    // awaiting gives us a better stack trace (at the cost of an extra microtask)
    return await Box2DFactory(options, ...args);
  };
