import { strict as assert } from 'assert';
import { cpus } from 'os';
// pthread pool size is set to navigator.hardwareConcurrency, which is not implemented on (for example) Node 20
globalThis.navigator ??= {};
globalThis.navigator.hardwareConcurrency ??= cpus().length;
import Box2DFactory from '../build/dist/es/entry-double.mjs'

// Large world (double precision) build: a pyramid 10,000 km from the origin should behave like
// one at the origin, which single precision cannot do (1 m steps at that distance).
const box2d = await Box2DFactory();

const {
    b2IsDoublePrecision,
    b2DefaultWorldDef,
    b2CreateWorld,
    b2DestroyWorld,
    b2World_Step,
    b2World_CastRayClosest,
    b2World_Draw,
    b2DefaultBodyDef,
    b2DefaultShapeDef,
    b2CreateBody,
    b2CreatePolygonShape,
    b2CreateSegmentShape,
    b2Body_GetPosition,
    b2Body_GetTransform,
    b2Body_SetTransform,
    b2Body_IsAwake,
    b2DefaultQueryFilter,
    b2MakeBox,
    b2OffsetPos,
    b2SubPos,
    b2BodyType,
    b2Segment,
    b2Pos,
    b2Vec2,
    b2Rot_identity,
    DebugDrawCommandBuffer,
} = box2d;

assert(b2IsDoublePrecision());

const timeStep = 1.0 / 60.0;
const subStepCount = 4;

const origin = new b2Pos(10.0e6, 0.0);

// the same pyramid at the world origin and far away must settle the same way
function buildPyramid(worldId, base) {
  const groundDef = b2DefaultBodyDef();
  groundDef.position = base;
  const groundId = b2CreateBody(worldId, groundDef);
  const segment = new b2Segment();
  segment.point1 = new b2Vec2(-40, 0);
  segment.point2 = new b2Vec2(40, 0);
  b2CreateSegmentShape(groundId, b2DefaultShapeDef(), segment);

  const h = 0.25;
  const box = b2MakeBox(h, h);
  const bodyDef = b2DefaultBodyDef();
  bodyDef.type = b2BodyType.b2_dynamicBody;
  const bodies = [];
  const baseCount = 10;
  for (let i = 0; i < baseCount; ++i) {
    const y = (2.0 * i + 1.0) * h;
    for (let j = i; j < baseCount; ++j) {
      const x = (i + 1.0) * h + 2.0 * (j - i) * h - h * baseCount;
      bodyDef.position = b2OffsetPos(base, new b2Vec2(x, y));
      const bodyId = b2CreateBody(worldId, bodyDef);
      b2CreatePolygonShape(bodyId, b2DefaultShapeDef(), box);
      bodies.push(bodyId);
    }
  }
  return bodies;
}

const nearWorld = b2CreateWorld(b2DefaultWorldDef());
const farWorld = b2CreateWorld(b2DefaultWorldDef());
const nearBodies = buildPyramid(nearWorld, new b2Pos(0, 0));
const farBodies = buildPyramid(farWorld, origin);

// positions are stored in double: a quarter metre offset survives 10,000 km out
const top = b2Body_GetPosition(farBodies[farBodies.length - 1]);
assert.equal(top.x - origin.x, b2Body_GetPosition(nearBodies[nearBodies.length - 1]).x);

for (let i = 0; i < 120; ++i) {
  b2World_Step(nearWorld, timeStep, subStepCount);
  b2World_Step(farWorld, timeStep, subStepCount);
}

let maxError = 0;
for (let i = 0; i < nearBodies.length; ++i) {
  const near = b2Body_GetPosition(nearBodies[i]);
  const far = b2SubPos(b2Body_GetPosition(farBodies[i]), origin);
  maxError = Math.max(maxError, Math.abs(near.x - far.x), Math.abs(near.y - far.y));
}
assert(maxError < 1e-3, `far pyramid drifted ${maxError} m from the near one`);

// transforms, teleports and queries keep double precision
const transform = b2Body_GetTransform(farBodies[0]);
assert(transform.p.x > 9.99e6);
b2Body_SetTransform(farBodies[0], new b2Pos(origin.x + 100.125, 5.0), b2Rot_identity);
assert.equal(b2Body_GetPosition(farBodies[0]).x, origin.x + 100.125);

const ray = b2World_CastRayClosest(farWorld, b2OffsetPos(origin, new b2Vec2(0, 20)), new b2Vec2(0, -40), b2DefaultQueryFilter());
assert(ray.hit && Math.abs(ray.point.x - origin.x) < 1e-6, `ray hit ${ray.point.x}`);

// debug draw is emitted relative to an origin near the camera, so it stays precise far away
const commandBuffer = new DebugDrawCommandBuffer(1000);
commandBuffer.SetOrigin(origin.x, origin.y);
b2World_Draw(farWorld, commandBuffer.GetDebugDraw());
assert(commandBuffer.GetCommandsSize() > nearBodies.length);
const stride = commandBuffer.GetCommandStride();
const firstCommand = commandBuffer.GetCommandsData();
for (let i = 0; i < commandBuffer.GetCommandsSize(); ++i) {
  const x = new Float32Array(box2d.HEAPU8.buffer, firstCommand + i * stride + 12, 1)[0];
  assert(Math.abs(x) < 200, `command ${i} is not origin relative: ${x}`);
}
commandBuffer.delete();

assert(b2Body_IsAwake(farBodies[1]) !== undefined);
b2DestroyWorld(nearWorld);
b2DestroyWorld(farWorld);
console.log(`👍 double precision: far pyramid matches the near one to ${maxError.toExponential(1)} m`);
