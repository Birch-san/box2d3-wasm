import Box2DFactory from './deluxe/Box2D.deluxe.mjs';

/** @type {typeof import('./entry.mjs').default} */
export default async (options, ...args) => {
    const box2d = await Box2DFactory(options, ...args);
    // Mirror Box2D's single precision typedefs.
    box2d.b2Pos = box2d.b2Vec2;
    box2d.b2WorldTransform = box2d.b2Transform;
    box2d.b2WorldCastOutput = box2d.b2CastOutput;
    return box2d;
};
