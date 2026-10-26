import { strict as assert } from 'assert';
import { cpus } from 'os';
// pthread pool size is set to navigator.hardwareConcurrency, which is not implemented on (for example) Node 20
globalThis.navigator ??= {};
globalThis.navigator.hardwareConcurrency ??= cpus().length;
import Box2DFactory from '../build/dist/es/entry.mjs'

const box2d = await Box2DFactory();

// Contact generations use all 32 bits when crossing the JS/wasm boundary.
const contactId = { index1: 1, world0: 0, padding: 0, generation: 0x10000 };
assert(box2d.B2_ID_EQUALS(contactId, { ...contactId }));
assert(!box2d.B2_ID_EQUALS(contactId, { ...contactId, generation: 0 }));

const B2_SECRET_COOKIE = 1152023;
const timeStep = 1.0 / 60.0;
const subStepCount = 4;

// C Interface
(() => {
  const {
      b2DefaultWorldDef,
      b2CreateWorld,
      b2DestroyWorld,
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

  const worldDef = b2DefaultWorldDef();
  assert(worldDef.internalValue === B2_SECRET_COOKIE);
  const worldId = b2CreateWorld(worldDef);

  const square = b2MakeBox(1, 1);

  const bd = b2DefaultBodyDef();
  bd.type = b2BodyType.b2_dynamicBody;
  bd.position = new b2Vec2(0, 0);

  const bodyId = b2CreateBody(worldId, bd);

  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = 1.0;
  shapeDef.material.friction = 0.3;

  b2CreatePolygonShape(bodyId, shapeDef, square);

  for (let i = 0; i < 90; ++i)
  {
    b2World_Step(worldId, timeStep, subStepCount);
  }
  const position = b2Body_GetPosition(bodyId);
  const rotation = b2Body_GetRotation(bodyId);
  // free fall for 1.5s under -10 m/s^2 gravity
  assert(Math.abs(position.y + 0.5 * 10 * 1.5 * 1.5) < 0.5, `unexpected fall height ${position.y}`);
  assert(Math.abs(b2Rot_GetAngle(rotation)) < 1e-6);
  b2DestroyWorld(worldId);
  console.log('👍 C interface: body fell to', position.y.toFixed(3));
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
      b2Vec2
  } = box2d;

  const worldDef = b2DefaultWorldDef();
  assert(worldDef.internalValue === B2_SECRET_COOKIE);

  const world = new World(new b2WorldDef(worldDef));

  const square = b2MakeBox(1, 1);

  const bd = b2DefaultBodyDef();
  bd.type = b2BodyType.b2_dynamicBody;
  bd.position = new b2Vec2(0, 0);

  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = 1.0;
  shapeDef.material.friction = 0.3;

  const body = world.CreateBody(new b2BodyDef(bd));
  body.CreatePolygonShape(shapeDef, square);

  for (let i = 0; i < 90; ++i)
  {
    world.Step(timeStep, subStepCount);
  }
  const position = body.GetPosition();
  assert(position.y < -10);
  assert(Math.abs(body.GetWorldCenter().y - position.y) < 1e-4);
  body.UpdateMassFromShapes();
  console.log('👍 C++ interface: body fell to', position.y.toFixed(3));
})();


// Box2D v3.2 features: contact ids, joints, queries with an origin, snapshots, pre-solve
(() => {
  const {
      b2DefaultWorldDef,
      b2CreateWorld,
      b2DestroyWorld,
      b2World_Step,
      b2World_GetContactEvents,
      b2World_OverlapAABB,
      b2World_CastRayClosest,
      b2World_GetSnapshot,
      b2World_RestoreFromSnapshot,
      b2World_GetStateHash,
      b2World_SetPreSolveCallback,
      b2World_DeleteCallback,
      b2Contact_IsValid,
      b2Contact_GetData,
      b2MakeBox,
      b2DefaultBodyDef,
      b2DefaultShapeDef,
      b2CreatePolygonShape,
      b2CreateBody,
      b2Body_GetPosition,
      b2DefaultRevoluteJointDef,
      b2CreateRevoluteJoint,
      b2RevoluteJoint_GetCurrentAngle,
      b2DefaultDistanceJointDef,
      b2CreateDistanceJoint,
      b2DistanceJoint_GetRestLength,
      b2DestroyJoint,
      b2Joint_IsValid,
      b2DefaultQueryFilter,
      b2BodyType,
      b2AABB,
      b2Vec2,
      b2Pos_zero,
      DebugDrawCommandBuffer,
      b2World_Draw,
  } = box2d;

  const worldId = b2CreateWorld(b2DefaultWorldDef());

  const groundDef = b2DefaultBodyDef();
  const groundId = b2CreateBody(worldId, groundDef);
  const groundShapeId = b2CreatePolygonShape(groundId, b2DefaultShapeDef(), b2MakeBox(20, 1));

  const bd = b2DefaultBodyDef();
  bd.type = b2BodyType.b2_dynamicBody;
  bd.position = new b2Vec2(0, 3);
  const boxId = b2CreateBody(worldId, bd);
  const shapeDef = b2DefaultShapeDef();
  shapeDef.enableContactEvents = true;
  shapeDef.enablePreSolveEvents = true;
  b2CreatePolygonShape(boxId, shapeDef, b2MakeBox(0.5, 0.5));

  let preSolveCalls = 0;
  const preSolveHandle = b2World_SetPreSolveCallback(worldId, (shapeIdA, shapeIdB, manifold) => {
    preSolveCalls++;
    assert(manifold.pointCount <= 2);
  }, null);

  let beginContactId = null;
  for (let i = 0; i < 120 && beginContactId === null; ++i)
  {
    b2World_Step(worldId, timeStep, subStepCount);
    const events = b2World_GetContactEvents(worldId);
    if (events.beginCount > 0) {
      beginContactId = events.GetBeginEvent(0).contactId;
    }
  }
  assert(beginContactId !== null, 'expected a begin touch event');
  assert(b2Contact_IsValid(beginContactId));
  const contactData = b2Contact_GetData(beginContactId);
  assert(contactData.manifold.pointCount > 0);
  assert(preSolveCalls > 0, 'expected pre-solve callbacks');
  b2World_SetPreSolveCallback(worldId, null, null);
  b2World_DeleteCallback(preSolveHandle);

  // queries now take an origin
  const box = new b2AABB();
  box.lowerBound = new b2Vec2(-1, -1);
  box.upperBound = new b2Vec2(1, 1);
  let overlaps = 0;
  b2World_OverlapAABB(worldId, b2Pos_zero, box, b2DefaultQueryFilter(), () => { overlaps++; return true; });
  assert(overlaps >= 1);
  const ray = b2World_CastRayClosest(worldId, new b2Vec2(5, 10), new b2Vec2(0, -20), b2DefaultQueryFilter());
  assert(ray.hit && ray.shapeId.index1 === groundShapeId.index1);

  // joints use local frames and renamed accessors
  const jd = b2DefaultRevoluteJointDef();
  jd.base.bodyIdA = groundId;
  jd.base.bodyIdB = boxId;
  const revoluteId = b2CreateRevoluteJoint(worldId, jd);
  assert(b2Joint_IsValid(revoluteId));
  assert(typeof b2RevoluteJoint_GetCurrentAngle(revoluteId) === 'number');
  b2DestroyJoint(revoluteId);
  assert(!b2Joint_IsValid(revoluteId));

  const dd = b2DefaultDistanceJointDef();
  dd.base.bodyIdA = groundId;
  dd.base.bodyIdB = boxId;
  dd.length = 2;
  const distanceId = b2CreateDistanceJoint(worldId, dd);
  assert(Math.abs(b2DistanceJoint_GetRestLength(distanceId) - 2) < 1e-6);
  b2DestroyJoint(distanceId);

  // snapshot round trip restores the exact state
  const snapshot = b2World_GetSnapshot(worldId);
  assert(snapshot instanceof Uint8Array && snapshot.length > 0);
  const hashBefore = b2World_GetStateHash(worldId);
  const yBefore = b2Body_GetPosition(boxId).y;
  for (let i = 0; i < 30; ++i) b2World_Step(worldId, timeStep, subStepCount);
  assert(b2World_RestoreFromSnapshot(worldId, snapshot));
  assert.equal(b2World_GetStateHash(worldId), hashBefore);
  assert.equal(b2Body_GetPosition(boxId).y, yBefore);

  // debug draw produces commands
  const commandBuffer = new DebugDrawCommandBuffer(1000);
  b2World_Draw(worldId, commandBuffer.GetDebugDraw());
  assert(commandBuffer.GetCommandsSize() >= 2);
  commandBuffer.delete();

  b2DestroyWorld(worldId);
  console.log('👍 v3.2 features: contact ids, pre-solve, queries, joints, snapshots, debug draw');
})();


// Patched upstream bugs (see patches/box2d)
(() => {
  const {
      b2DefaultWorldDef,
      b2CreateWorld,
      b2DestroyWorld,
      b2World_Step,
      b2World_Draw,
      b2World_CollideMover,
      b2DefaultBodyDef,
      b2DefaultShapeDef,
      b2CreateBody,
      b2CreatePolygonShape,
      b2CreateCircleShape,
      b2MakeBox,
      b2MakeRot,
      b2DefaultMoverJointDef,
      b2CreateMoverJoint,
      b2DefaultPogoJointDef,
      b2CreatePogoJoint,
      b2Joint_GetConstraintTorque,
      b2Joint_GetLinearSeparation,
      b2Joint_GetAngularSeparation,
      b2DefaultQueryFilter,
      b2BodyType,
      b2Capsule,
      b2Circle,
      b2Vec2,
      b2Pos,
      DebugDrawCommandBuffer,
  } = box2d;

  const worldId = b2CreateWorld(b2DefaultWorldDef());
  const groundId = b2CreateBody(worldId, b2DefaultBodyDef());
  b2CreatePolygonShape(groundId, b2DefaultShapeDef(), b2MakeBox(20, 1));

  const bd = b2DefaultBodyDef();
  bd.type = b2BodyType.b2_dynamicBody;
  bd.position = new b2Vec2(0, 2);
  const bodyId = b2CreateBody(worldId, bd);
  b2CreatePolygonShape(bodyId, b2DefaultShapeDef(), b2MakeBox(0.5, 0.5));

  // mover and pogo joints have no constraint torque or separation, this used to assert
  const moverDef = b2DefaultMoverJointDef();
  moverDef.base.bodyIdA = groundId;
  moverDef.base.bodyIdB = bodyId;
  const moverId = b2CreateMoverJoint(worldId, moverDef);
  const pogoDef = b2DefaultPogoJointDef();
  pogoDef.base.bodyIdA = groundId;
  pogoDef.base.bodyIdB = bodyId;
  pogoDef.normal = new b2Vec2(0, 1);
  pogoDef.restLength = 1.5;
  const pogoId = b2CreatePogoJoint(worldId, pogoDef);
  b2World_Step(worldId, timeStep, subStepCount);
  for (const jointId of [moverId, pogoId]) {
    assert.equal(b2Joint_GetConstraintTorque(jointId), 0);
    assert.equal(b2Joint_GetLinearSeparation(jointId), 0);
    assert.equal(b2Joint_GetAngularSeparation(jointId), 0);
  }
  const commandBuffer = new DebugDrawCommandBuffer(1000);
  const debugDraw = commandBuffer.GetDebugDraw();
  debugDraw.drawJoints = true;
  debugDraw.drawJointExtras = true;
  b2World_Draw(worldId, debugDraw);
  commandBuffer.delete();

  // b2World_CollideMover points are relative to the query origin and on the shape surface
  const boxDef = b2DefaultBodyDef();
  boxDef.position = new b2Vec2(30, 5);
  boxDef.rotation = b2MakeRot(0.5 * Math.PI);
  const boxBodyId = b2CreateBody(worldId, boxDef);
  b2CreatePolygonShape(boxBodyId, b2DefaultShapeDef(), b2MakeBox(2, 1));
  const circleDef = b2DefaultBodyDef();
  circleDef.position = new b2Vec2(40, 5);
  const circleBodyId = b2CreateBody(worldId, circleDef);
  const circle = new b2Circle();
  circle.radius = 1;
  b2CreateCircleShape(circleBodyId, b2DefaultShapeDef(), circle);

  const collide = (origin, centerX) => {
    const mover = new b2Capsule();
    mover.center1 = new b2Vec2(centerX, -0.25);
    mover.center2 = new b2Vec2(centerX, 0.25);
    mover.radius = 0.5;
    const points = [];
    b2World_CollideMover(worldId, origin, mover, b2DefaultQueryFilter(), (shapeId, result) => {
      points.push({ x: result.point.x, y: result.point.y, normal: result.plane.normal });
      return true;
    });
    return points;
  };
  // the rotated box is 1 wide in x, so its right face is at x = 31
  const boxHits = collide(new b2Pos(30, 5), 1.45);
  assert.equal(boxHits.length, 1);
  assert(Math.abs(boxHits[0].x - 1) < 1e-4 && Math.abs(boxHits[0].y) < 0.6, `box point ${JSON.stringify(boxHits[0])}`);
  const circleHits = collide(new b2Pos(40, 5), -1.45);
  assert.equal(circleHits.length, 1);
  assert(Math.abs(circleHits[0].x + 1) < 1e-4 && Math.abs(circleHits[0].y) < 1e-4, `circle point ${JSON.stringify(circleHits[0])}`);

  b2DestroyWorld(worldId);
  console.log('👍 patches: mover/pogo joint torque and separation, collide mover points');
})();


// Chain materials keep Box2D's defaults for fields that are not given, from plain objects or b2SurfaceMaterial
(() => {
  const {
      b2DefaultWorldDef,
      b2CreateWorld,
      b2DestroyWorld,
      b2CreateBody,
      b2DefaultBodyDef,
      b2DefaultChainDef,
      b2CreateChain,
      b2Chain_GetSurfaceMaterial,
      b2DefaultSurfaceMaterial,
  } = box2d;

  const worldId = b2CreateWorld(b2DefaultWorldDef());
  const groundId = b2CreateBody(worldId, b2DefaultBodyDef());
  const points = [{ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 5 }];

  const plainDef = b2DefaultChainDef();
  plainDef.SetPoints(points);
  plainDef.isLoop = true;
  plainDef.SetMaterials([{ customColor: 0x8FBC8F }]);
  const plainChainId = b2CreateChain(groundId, plainDef);
  const plain = b2Chain_GetSurfaceMaterial(plainChainId, 0);
  assert(Math.abs(plain.friction - 0.6) < 1e-6, `friction ${plain.friction}`);
  assert.equal(plain.customColor, 0x8FBC8F);

  const material = b2DefaultSurfaceMaterial();
  material.restitution = 0.5;
  const embindDef = b2DefaultChainDef();
  embindDef.SetPoints(points);
  embindDef.isLoop = true;
  embindDef.SetMaterials([material]);
  const embindChainId = b2CreateChain(groundId, embindDef);
  assert.equal(b2Chain_GetSurfaceMaterial(embindChainId, 2).restitution, 0.5);

  b2DestroyWorld(worldId);
  console.log('👍 chain materials keep defaults');
})();


// Threading via the enkiTS task system
(() => {
  const {
      b2DefaultWorldDef,
      b2CreateThreadedWorld,
      b2DestroyWorld,
      b2World_Step,
      b2World_GetCounters,
      TaskSystem,
      b2MakeBox,
      b2DefaultBodyDef,
      b2DefaultShapeDef,
      b2CreatePolygonShape,
      b2CreateBody,
      b2Body_GetPosition,
      b2BodyType,
      b2Vec2,
  } = box2d;

  const taskSystem = new TaskSystem(3);
  const worldId = b2CreateThreadedWorld(b2DefaultWorldDef(), taskSystem);

  b2CreatePolygonShape(b2CreateBody(worldId, b2DefaultBodyDef()), b2DefaultShapeDef(), b2MakeBox(50, 1));

  const shapeDef = b2DefaultShapeDef();
  const square = b2MakeBox(0.4, 0.4);
  const bodies = [];
  for (let i = 0; i < 400; ++i) {
    const bd = b2DefaultBodyDef();
    bd.type = b2BodyType.b2_dynamicBody;
    bd.position = new b2Vec2(-20 + (i % 40), 2 + Math.floor(i / 40));
    const bodyId = b2CreateBody(worldId, bd);
    b2CreatePolygonShape(bodyId, shapeDef, square);
    bodies.push(bodyId);
  }

  let maxTasks = 0;
  for (let i = 0; i < 120; ++i) {
    b2World_Step(worldId, timeStep, subStepCount);
    maxTasks = Math.max(maxTasks, taskSystem.GetActiveTaskCount());
    taskSystem.ClearTasks();
  }
  const counters = b2World_GetCounters(worldId);
  assert(maxTasks > 0, 'expected tasks to be scheduled');
  assert(counters.contactCount > 0);
  assert(bodies.every((bodyId) => b2Body_GetPosition(bodyId).y > 0), 'boxes should rest on the ground');

  b2DestroyWorld(worldId);
  taskSystem.delete();
  console.log(`👍 threaded world: ${counters.contactCount} contacts, up to ${maxTasks} tasks per step`);
})();
