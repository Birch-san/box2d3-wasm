// these typings are provided in case you wish to bypass the NodeJS module specifier
// (i.e. 'box2d3-wasm/double') and import the entrypoint directly.
import type { MainModule, ModuleOptions } from './deluxe-double/Box2D.deluxe-double.js';
export type * from './deluxe-double/Box2D.deluxe-double.js';

export type Box2DModule = MainModule;

/** Double precision (large world) build of box2d3-wasm. */
export default function Box2DFactory(options?: ModuleOptions): Promise<Box2DModule>;
