import { strict as assert } from 'assert';
import { cpus } from 'os';
// pthread pool size is set to navigator.hardwareConcurrency, which is not implemented on (for example) Node 20
globalThis.navigator ??= {};
globalThis.navigator.hardwareConcurrency ??= cpus().length;
import Box2DFactory from '../build/dist/es/entry.mjs'

const box2d = await Box2DFactory();

// C Interface
(() => {
  const {
      b2DefaultWorldDef,
      b2CreateWorld,
      b2World_Step,
      b2MakeBox,
      b2DefaultBodyDef,
      b2DefaultShapeDef,
      b2CreatePolygonShape,
      b2CreateBody,
      b2Body_GetPosition,
      b2Body_GetRotation,
      b2Rot_GetAngle,
      b2BodyType,
      b2Vec2,
  } = box2d;

  const B2_SECRET_COOKIE = 1152023;
  const worldDef = b2DefaultWorldDef();
  assert(worldDef.internalValue === B2_SECRET_COOKIE);
  const worldId = b2CreateWorld(worldDef);
  console.log('hello', worldId);

  const sideLengthMetres = 1;
  const square = b2MakeBox(sideLengthMetres, sideLengthMetres);
  console.log('square', square)

  const zero = new b2Vec2(0, 0);

  const bd = new b2DefaultBodyDef();
  bd.type = b2BodyType.b2_dynamicBody;
  bd.position = zero;

  const bodyId = b2CreateBody(worldId, bd);

  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = 1.0;
  shapeDef.material.friction = 0.3;

  const shapeId = b2CreatePolygonShape(bodyId, shapeDef, square);

  console.log('shapeId', shapeId)

  const timeStep = 1.0 / 60.0;
  const subStepCount = 4;

  console.log('bodyId', bodyId)

  for (let i = 0; i < 90; ++i)
  {
    b2World_Step(worldId, timeStep, subStepCount);
    const position = b2Body_GetPosition(bodyId);
    const rotation = b2Body_GetRotation(bodyId);
    console.log(position.x, position.y, b2Rot_GetAngle(rotation));
  }
})();


// CPP Interface
(() => {
  const {
      b2DefaultWorldDef,
      b2WorldDef,
      World,
      b2MakeBox,
      b2DefaultBodyDef,
      b2DefaultShapeDef,
      b2BodyDef,
      b2BodyType,
      b2Rot_GetAngle,
      b2Vec2
  } = box2d;

  const B2_SECRET_COOKIE = 1152023;
  const worldDef = b2DefaultWorldDef();
  assert(worldDef.internalValue === B2_SECRET_COOKIE);
  
  const world = new World(new b2WorldDef(worldDef));

  const sideLengthMetres = 1;
  const square = b2MakeBox(sideLengthMetres, sideLengthMetres);
  console.log('square', square);

  const zero = new b2Vec2(0, 0);

  const bd = new b2DefaultBodyDef();
  bd.type = b2BodyType.b2_dynamicBody;
  bd.position = zero;

  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = 1.0;
  shapeDef.material.friction = 0.3;

  const body = world.CreateBody(new b2BodyDef(bd));
  body.CreatePolygonShape(shapeDef, square);

  const timeStep = 1.0 / 60.0;
  const subStepCount = 4;

  for (let i = 0; i < 90; ++i)
  {
    world.Step(timeStep, subStepCount);
    const position = body.GetPosition();
    const rotation = body.GetRotation();
    console.log(position.x, position.y, b2Rot_GetAngle(rotation));
  }
})();


/*
import Box2DFactory from 'box2d-wasm';
import { assertFloatEqual } from './assertFloatEqual';

const {
  b2BodyDef,
  b2_dynamicBody,
  b2PolygonShape,
  b2Vec2,
  b2World,
  destroy,
  getPointer,
  LeakMitigator,
  NULL
}: typeof Box2D & EmscriptenModule = await Box2DFactory();

const { freeFromCache } = LeakMitigator;
const { recordLeak, freeLeaked } = new LeakMitigator();

const gravity = new b2Vec2(0, 10);
const world = new b2World(gravity);

const sideLengthMetres = 1;
const square = new b2PolygonShape();
square.SetAsBox(sideLengthMetres/2, sideLengthMetres/2);

const zero = new b2Vec2(0, 0);

const bd = new b2BodyDef();
bd.set_type(b2_dynamicBody);
bd.set_position(zero);

const body = recordLeak(world.CreateBody(bd));
destroy(bd);
freeFromCache(body.CreateFixture(square, 1));
destroy(square);
body.SetTransform(zero, 0);
body.SetLinearVelocity(zero);
destroy(zero);
body.SetAwake(true);
body.SetEnabled(true);

const timeStepMillis = 1/60;
const velocityIterations = 1;
const positionIterations = 1;
const floatCompareTolerance = 0.01;

const iterations = 6;
for (let i=0; i<iterations; i++) {
  const timeElapsedMillis = timeStepMillis*i;
  {
    const {y} = body.GetLinearVelocity();
    assertFloatEqual(y, gravity.y*timeElapsedMillis, floatCompareTolerance);
    {
      const {y} = body.GetPosition();
      assertFloatEqual(y, 0.5*gravity.y*timeElapsedMillis**2, floatCompareTolerance);
    }
  }
  world.Step(timeStepMillis, velocityIterations, positionIterations);
}

destroy(gravity);

for (let body = recordLeak(world.GetBodyList()); getPointer(body) !== getPointer(NULL); body = recordLeak(body.GetNext())) {
  world.DestroyBody(body);
}

destroy(world);
freeLeaked();

console.log(`👍 Ran ${iterations} iterations of a falling body. Body had the expected position on each iteration.`);*/
