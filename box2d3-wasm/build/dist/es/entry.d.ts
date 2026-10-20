// these typings are provided in case you wish to bypass the NodeJS module specifier
// (i.e. 'box2d3-wasm') and import the entrypoint directly.
import type { MainModule, ModuleOptions } from './deluxe/Box2D.deluxe';
export type * from './deluxe/Box2D.deluxe';

/**
 * In single precision Box2D's large world types are aliases of the regular ones, so they are exposed
 * under both names. This lets the same code run against the double precision build (box2d3-wasm/double).
 */
export type Box2DModule = MainModule & {
  b2Pos: MainModule['b2Vec2'];
  b2WorldTransform: MainModule['b2Transform'];
  b2WorldCastOutput: MainModule['b2CastOutput'];
};

export default function Box2DFactory(options?: ModuleOptions): Promise<Box2DModule>;
