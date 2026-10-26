import { strict as assert } from 'assert';
import Box2DFactory from '../build/dist/es/entry-double.mjs';

const b2 = await Box2DFactory({ pthreadCount: 0 });
assert(b2.b2IsDoublePrecision());

// Fractional world positions must survive the JS/wasm boundary far from the origin.
const origin = new b2.b2Pos(10.0e6, 0);
const worldDef = b2.b2DefaultWorldDef();
worldDef.gravity.Set(0, 0);
const worldId = b2.b2CreateWorld(worldDef);
const bodyDef = b2.b2DefaultBodyDef();
bodyDef.type = b2.b2BodyType.b2_dynamicBody;
bodyDef.position.Set(origin.x + 0.125, 5);
const bodyId = b2.b2CreateBody(worldId, bodyDef);
const shapeDef = b2.b2DefaultShapeDef();
const box = b2.b2MakeBox(0.5, 0.5);
b2.b2CreatePolygonShape(bodyId, shapeDef, box);
b2.b2World_Step(worldId, 1 / 60, 4);

const transform = b2.b2Body_GetTransform(bodyId);
assert.equal(transform.p.x, origin.x + 0.125);
const target = new b2.b2Pos(origin.x + 0.375, 5);
b2.b2Body_SetTransform(bodyId, target, b2.b2Rot_identity);
const position = b2.b2Body_GetPosition(bodyId);
assert.equal(position.x, target.x);

const rayOrigin = new b2.b2Pos(target.x, 10);
const translation = new b2.b2Vec2(0, -20);
const filter = b2.b2DefaultQueryFilter();
const ray = b2.b2World_CastRayClosest(worldId, rayOrigin, translation, filter);
assert(ray.hit);
assert.equal(ray.point.x, target.x);

// Our draw buffer narrows positions to floats only after subtracting its origin.
const commands = new b2.DebugDrawCommandBuffer(8);
commands.SetOrigin(origin.x, origin.y);
b2.b2World_Draw(worldId, commands.GetDebugDraw());
assert.equal(commands.GetCommandsSize(), 1);
const data = new Float32Array(b2.HEAPU8.buffer, commands.GetCommandsData() + 12, 1);
assert.equal(data[0], 0.375);

b2.b2DestroyWorld(worldId);
for (const value of [origin, worldDef, bodyDef, shapeDef, box, transform, target,
  position, rayOrigin, translation, filter, ray, commands]) value.delete();
console.log('👍 double precision: positions, transforms, queries and draw buffer');
