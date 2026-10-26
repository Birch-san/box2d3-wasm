import { strict as assert } from 'assert';
import Box2DFactory from '../build/dist/es/entry.mjs'

const box2d = await Box2DFactory({ pthreadCount: 3 });

// Contact generations use all 32 bits when crossing the JS/wasm boundary.
const contactId = { index1: 1, world0: 0, padding: 0, generation: 0x10000 };
assert(box2d.B2_ID_EQUALS(contactId, { ...contactId }));
assert(!box2d.B2_ID_EQUALS(contactId, { ...contactId, generation: 0 }));

const B2_SECRET_COOKIE = 1152023;
const timeStep = 1.0 / 60.0;
const subStepCount = 4;

// C Interface
(() => {
  const worldDef = box2d.b2DefaultWorldDef();
  assert(worldDef.internalValue === B2_SECRET_COOKIE);
  const worldId = box2d.b2CreateWorld(worldDef);

  const square = box2d.b2MakeBox(1, 1);

  const bd = box2d.b2DefaultBodyDef();
  bd.type = box2d.b2BodyType.b2_dynamicBody;
  bd.position = new box2d.b2Vec2(0, 0);

  const bodyId = box2d.b2CreateBody(worldId, bd);

  const shapeDef = box2d.b2DefaultShapeDef();
  shapeDef.density = 1.0;
  shapeDef.material.friction = 0.3;

  box2d.b2CreatePolygonShape(bodyId, shapeDef, square);

  for (let i = 0; i < 90; ++i)
  {
    box2d.b2World_Step(worldId, timeStep, subStepCount);
  }
  const position = box2d.b2Body_GetPosition(bodyId);
  const rotation = box2d.b2Body_GetRotation(bodyId);
  // free fall for 1.5s under -10 m/s^2 gravity
  assert(Math.abs(position.y + 0.5 * 10 * 1.5 * 1.5) < 0.5, `unexpected fall height ${position.y}`);
  assert(Math.abs(box2d.b2Rot_GetAngle(rotation)) < 1e-6);
  box2d.b2DestroyWorld(worldId);
  console.log('👍 C interface: body fell to', position.y.toFixed(3));
})();


// CPP Interface
(() => {
  const worldDef = box2d.b2DefaultWorldDef();
  assert(worldDef.internalValue === B2_SECRET_COOKIE);

  const world = new box2d.World(new box2d.b2WorldDef(worldDef));

  const square = box2d.b2MakeBox(1, 1);

  const bd = box2d.b2DefaultBodyDef();
  bd.type = box2d.b2BodyType.b2_dynamicBody;
  bd.position = new box2d.b2Vec2(0, 0);

  const shapeDef = box2d.b2DefaultShapeDef();
  shapeDef.density = 1.0;
  shapeDef.material.friction = 0.3;

  const body = world.CreateBody(new box2d.b2BodyDef(bd));
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
  const worldId = box2d.b2CreateWorld(box2d.b2DefaultWorldDef());

  const groundDef = box2d.b2DefaultBodyDef();
  const groundId = box2d.b2CreateBody(worldId, groundDef);
  const groundShapeId = box2d.b2CreatePolygonShape(groundId, box2d.b2DefaultShapeDef(), box2d.b2MakeBox(20, 1));

  const bd = box2d.b2DefaultBodyDef();
  bd.type = box2d.b2BodyType.b2_dynamicBody;
  bd.position = new box2d.b2Vec2(0, 3);
  const boxId = box2d.b2CreateBody(worldId, bd);
  const shapeDef = box2d.b2DefaultShapeDef();
  shapeDef.enableContactEvents = true;
  shapeDef.enablePreSolveEvents = true;
  box2d.b2CreatePolygonShape(boxId, shapeDef, box2d.b2MakeBox(0.5, 0.5));

  let preSolveCalls = 0;
  const preSolveHandle = box2d.b2World_SetPreSolveCallback(worldId, (shapeIdA, shapeIdB, manifold) => {
    preSolveCalls++;
    assert(manifold.pointCount <= 2);
  }, null);

  let beginContactId = null;
  for (let i = 0; i < 120 && beginContactId === null; ++i)
  {
    box2d.b2World_Step(worldId, timeStep, subStepCount);
    const events = box2d.b2World_GetContactEvents(worldId);
    if (events.beginCount > 0) {
      beginContactId = events.GetBeginEvent(0).contactId;
    }
  }
  assert(beginContactId !== null, 'expected a begin touch event');
  assert(box2d.b2Contact_IsValid(beginContactId));
  const contactData = box2d.b2Contact_GetData(beginContactId);
  assert(contactData.manifold.pointCount > 0);
  assert(preSolveCalls > 0, 'expected pre-solve callbacks');
  box2d.b2World_SetPreSolveCallback(worldId, null, null);
  box2d.b2World_DeleteCallback(preSolveHandle);

  // queries now take an origin
  const box = new box2d.b2AABB();
  box.lowerBound = new box2d.b2Vec2(-1, -1);
  box.upperBound = new box2d.b2Vec2(1, 1);
  let overlaps = 0;
  box2d.b2World_OverlapAABB(worldId, box2d.b2Pos_zero, box, box2d.b2DefaultQueryFilter(), () => { overlaps++; return true; });
  assert(overlaps >= 1);
  const ray = box2d.b2World_CastRayClosest(worldId, new box2d.b2Vec2(5, 10), new box2d.b2Vec2(0, -20), box2d.b2DefaultQueryFilter());
  assert(ray.hit && ray.shapeId.index1 === groundShapeId.index1);

  // joints use local frames and renamed accessors
  const jd = box2d.b2DefaultRevoluteJointDef();
  jd.base.bodyIdA = groundId;
  jd.base.bodyIdB = boxId;
  const revoluteId = box2d.b2CreateRevoluteJoint(worldId, jd);
  assert(box2d.b2Joint_IsValid(revoluteId));
  assert(typeof box2d.b2RevoluteJoint_GetCurrentAngle(revoluteId) === 'number');
  box2d.b2DestroyJoint(revoluteId);
  assert(!box2d.b2Joint_IsValid(revoluteId));

  const dd = box2d.b2DefaultDistanceJointDef();
  dd.base.bodyIdA = groundId;
  dd.base.bodyIdB = boxId;
  dd.length = 2;
  const distanceId = box2d.b2CreateDistanceJoint(worldId, dd);
  assert(Math.abs(box2d.b2DistanceJoint_GetRestLength(distanceId) - 2) < 1e-6);
  box2d.b2DestroyJoint(distanceId);

  // snapshot round trip restores the exact state
  const snapshot = box2d.b2World_GetSnapshot(worldId);
  assert(snapshot instanceof Uint8Array && snapshot.length > 0);
  const hashBefore = box2d.b2World_GetStateHash(worldId);
  const yBefore = box2d.b2Body_GetPosition(boxId).y;
  for (let i = 0; i < 30; ++i) box2d.b2World_Step(worldId, timeStep, subStepCount);
  assert(box2d.b2World_RestoreFromSnapshot(worldId, snapshot));
  assert.equal(box2d.b2World_GetStateHash(worldId), hashBefore);
  assert.equal(box2d.b2Body_GetPosition(boxId).y, yBefore);

  // debug draw produces commands
  const commandBuffer = new box2d.DebugDrawCommandBuffer(1000);
  box2d.b2World_Draw(worldId, commandBuffer.GetDebugDraw());
  assert(commandBuffer.GetCommandsSize() >= 2);
  commandBuffer.delete();

  box2d.b2DestroyWorld(worldId);
  console.log('👍 v3.2 features: contact ids, pre-solve, queries, joints, snapshots, debug draw');
})();


// Patched upstream bugs (see patches/box2d)
(() => {
  const worldId = box2d.b2CreateWorld(box2d.b2DefaultWorldDef());
  const groundId = box2d.b2CreateBody(worldId, box2d.b2DefaultBodyDef());
  box2d.b2CreatePolygonShape(groundId, box2d.b2DefaultShapeDef(), box2d.b2MakeBox(20, 1));

  const bd = box2d.b2DefaultBodyDef();
  bd.type = box2d.b2BodyType.b2_dynamicBody;
  bd.position = new box2d.b2Vec2(0, 2);
  const bodyId = box2d.b2CreateBody(worldId, bd);
  box2d.b2CreatePolygonShape(bodyId, box2d.b2DefaultShapeDef(), box2d.b2MakeBox(0.5, 0.5));

  // mover and pogo joints have no constraint torque or separation, this used to assert
  const moverDef = box2d.b2DefaultMoverJointDef();
  moverDef.base.bodyIdA = groundId;
  moverDef.base.bodyIdB = bodyId;
  const moverId = box2d.b2CreateMoverJoint(worldId, moverDef);
  const pogoDef = box2d.b2DefaultPogoJointDef();
  pogoDef.base.bodyIdA = groundId;
  pogoDef.base.bodyIdB = bodyId;
  pogoDef.normal = new box2d.b2Vec2(0, 1);
  pogoDef.restLength = 1.5;
  const pogoId = box2d.b2CreatePogoJoint(worldId, pogoDef);
  box2d.b2World_Step(worldId, timeStep, subStepCount);
  for (const jointId of [moverId, pogoId]) {
    assert.equal(box2d.b2Joint_GetConstraintTorque(jointId), 0);
    assert.equal(box2d.b2Joint_GetLinearSeparation(jointId), 0);
    assert.equal(box2d.b2Joint_GetAngularSeparation(jointId), 0);
  }
  const commandBuffer = new box2d.DebugDrawCommandBuffer(1000);
  const debugDraw = commandBuffer.GetDebugDraw();
  debugDraw.drawJoints = true;
  debugDraw.drawJointExtras = true;
  box2d.b2World_Draw(worldId, debugDraw);
  commandBuffer.delete();

  // b2World_CollideMover points are relative to the query origin and on the shape surface
  const boxDef = box2d.b2DefaultBodyDef();
  boxDef.position = new box2d.b2Vec2(30, 5);
  boxDef.rotation = box2d.b2MakeRot(0.5 * Math.PI);
  const boxBodyId = box2d.b2CreateBody(worldId, boxDef);
  box2d.b2CreatePolygonShape(boxBodyId, box2d.b2DefaultShapeDef(), box2d.b2MakeBox(2, 1));
  const circleDef = box2d.b2DefaultBodyDef();
  circleDef.position = new box2d.b2Vec2(40, 5);
  const circleBodyId = box2d.b2CreateBody(worldId, circleDef);
  const circle = new box2d.b2Circle();
  circle.radius = 1;
  box2d.b2CreateCircleShape(circleBodyId, box2d.b2DefaultShapeDef(), circle);

  const collide = (origin, centerX) => {
    const mover = new box2d.b2Capsule();
    mover.center1 = new box2d.b2Vec2(centerX, -0.25);
    mover.center2 = new box2d.b2Vec2(centerX, 0.25);
    mover.radius = 0.5;
    const points = [];
    box2d.b2World_CollideMover(worldId, origin, mover, box2d.b2DefaultQueryFilter(), (shapeId, result) => {
      points.push({ x: result.point.x, y: result.point.y, normal: result.plane.normal });
      return true;
    });
    return points;
  };
  // the rotated box is 1 wide in x, so its right face is at x = 31
  const boxHits = collide(new box2d.b2Pos(30, 5), 1.45);
  assert.equal(boxHits.length, 1);
  assert(Math.abs(boxHits[0].x - 1) < 1e-4 && Math.abs(boxHits[0].y) < 0.6, `box point ${JSON.stringify(boxHits[0])}`);
  const circleHits = collide(new box2d.b2Pos(40, 5), -1.45);
  assert.equal(circleHits.length, 1);
  assert(Math.abs(circleHits[0].x + 1) < 1e-4 && Math.abs(circleHits[0].y) < 1e-4, `circle point ${JSON.stringify(circleHits[0])}`);

  box2d.b2DestroyWorld(worldId);
  console.log('👍 patches: mover/pogo joint torque and separation, collide mover points');
})();


// Chain materials keep Box2D's defaults for fields that are not given, from plain objects or b2SurfaceMaterial
(() => {
  const worldId = box2d.b2CreateWorld(box2d.b2DefaultWorldDef());
  const groundId = box2d.b2CreateBody(worldId, box2d.b2DefaultBodyDef());
  const points = [{ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 5 }];

  const plainDef = box2d.b2DefaultChainDef();
  plainDef.SetPoints(points);
  plainDef.isLoop = true;
  plainDef.SetMaterials([{ customColor: 0x8FBC8F }]);
  const plainChainId = box2d.b2CreateChain(groundId, plainDef);
  const plain = box2d.b2Chain_GetSurfaceMaterial(plainChainId, 0);
  assert(Math.abs(plain.friction - 0.6) < 1e-6, `friction ${plain.friction}`);
  assert.equal(plain.customColor, 0x8FBC8F);

  const material = box2d.b2DefaultSurfaceMaterial();
  material.restitution = 0.5;
  const embindDef = box2d.b2DefaultChainDef();
  embindDef.SetPoints(points);
  embindDef.isLoop = true;
  embindDef.SetMaterials([material]);
  const embindChainId = box2d.b2CreateChain(groundId, embindDef);
  assert.equal(box2d.b2Chain_GetSurfaceMaterial(embindChainId, 2).restitution, 0.5);

  box2d.b2DestroyWorld(worldId);
  console.log('👍 chain materials keep defaults');
})();


// Threading via the enkiTS task system
(() => {
  const taskSystem = new box2d.TaskSystem(3);
  const worldId = box2d.b2CreateThreadedWorld(box2d.b2DefaultWorldDef(), taskSystem);

  box2d.b2CreatePolygonShape(box2d.b2CreateBody(worldId, box2d.b2DefaultBodyDef()), box2d.b2DefaultShapeDef(), box2d.b2MakeBox(50, 1));

  const shapeDef = box2d.b2DefaultShapeDef();
  const square = box2d.b2MakeBox(0.4, 0.4);
  for (let i = 0; i < 16; ++i) {
    const bd = box2d.b2DefaultBodyDef();
    bd.type = box2d.b2BodyType.b2_dynamicBody;
    bd.position = new box2d.b2Vec2(-4 + (i % 8), 1.4 + 0.8 * Math.floor(i / 8));
    const bodyId = box2d.b2CreateBody(worldId, bd);
    box2d.b2CreatePolygonShape(bodyId, shapeDef, square);
  }

  let maxTasks = 0;
  for (let i = 0; i < 2; ++i) {
    box2d.b2World_Step(worldId, timeStep, subStepCount);
    maxTasks = Math.max(maxTasks, taskSystem.GetActiveTaskCount());
    taskSystem.ClearTasks();
  }
  const counters = box2d.b2World_GetCounters(worldId);
  assert(maxTasks > 0, 'expected tasks to be scheduled');
  assert(counters.contactCount > 0);

  box2d.b2DestroyWorld(worldId);
  taskSystem.delete();
  console.log(`👍 threaded world: ${counters.contactCount} contacts, up to ${maxTasks} tasks per step`);
})();
