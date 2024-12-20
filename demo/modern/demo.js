
import Box2DDebugDraw from '../utils/debugDraw.js';
import Box2DFactory from '/box2d3-wasm/build/dist/es/entry.mjs';

const Box2DFactory_ = Box2DFactory;
Box2DFactory_().then(box2d => {
  const canvas = document.getElementById("demo-canvas");

  const pixelsPerMeter = 32;
  const subStepCount = 4;

  const cameraOffsetMetres = {
    x: 11,
    y: -12
  };

  const debugDraw = new Box2DDebugDraw(canvas, box2d, pixelsPerMeter);
  debugDraw.offset = cameraOffsetMetres;

  const {
      b2DefaultWorldDef,
      b2WorldDef,
      World,
      b2MakeBox,
      b2Circle,
      b2DefaultBodyDef,
      b2DefaultShapeDef,
      b2BodyType,
      b2Segment,
      b2Vec2,
      b2Rot,
      b2TaskManager,
  } = box2d;


  const worldDef = b2DefaultWorldDef();
  worldDef.workerCount = navigator.hardwareConcurrency - 1 || 3;

  const taskManager = new b2TaskManager(worldDef.workerCount * 4);
  taskManager.AssignToWorld(worldDef);

  worldDef.gravity.Set(0, -10);


  const world = new World(new b2WorldDef(worldDef));



  const bd_ground = new b2DefaultBodyDef();
  const ground = world.CreateBody(bd_ground);

  const shapeDefSegment = b2DefaultShapeDef();
  shapeDefSegment.density = 1.0;
  shapeDefSegment.friction = 0.3;

  {
    const segment = new b2Segment();
    segment.point1 = new b2Vec2(3, -4);
    segment.point2 = new b2Vec2(6, -7);
    ground.CreateSegmentShape(shapeDefSegment, segment);
  }

  {
    const segment = new b2Segment();
    segment.point1 = new b2Vec2(3, -18);
    segment.point2 = new b2Vec2(22, -18)
    ground.CreateSegmentShape(shapeDefSegment, segment);
  }

  const shapeDefDynamic = b2DefaultShapeDef();
  shapeDefDynamic.density = 1.0;
  shapeDefDynamic.friction = 0.3;
  shapeDefDynamic.enableContactEvents = true;
  shapeDefDynamic.enableHitEvents = true;

  const sideLengthMetres = 1;
  const square = b2MakeBox(sideLengthMetres/2, sideLengthMetres/2);
  const circle = new b2Circle();
  circle.radius = sideLengthMetres/2;

  const ZERO = new b2Vec2(0, 0);
  const temp = new b2Vec2(0, 0);

  const rot = new b2Rot();
  rot.SetAngle(0);

  const initPosition = (body, index) => {
    temp.Set(4 + sideLengthMetres*(Math.random()-0.5), sideLengthMetres*index);
    body.SetTransform(temp, rot);
    body.SetLinearVelocity(ZERO);
    body.SetAwake(1);
    body.Enable();
  }

  const bd = new b2DefaultBodyDef();
  bd.type = b2BodyType.b2_dynamicBody;
  bd.position = ZERO;

  const boxCount = 10;
  for (let i = 0; i < boxCount; i++) {

    const body = world.CreateBody(bd);

    i % 2 ? body.CreateCircleShape(shapeDefDynamic, circle) : body.CreatePolygonShape(shapeDefDynamic, square);
    initPosition(body, i);
  }

  let handle;
    (function loop(prevMs) {
      const nowMs = window.performance.now();
      handle = requestAnimationFrame(loop.bind(null, nowMs));
      const deltaMs = nowMs-prevMs;
      world.Step(deltaMs / 1000, subStepCount);

      window.contactData = world.GetContactEvents();

      if(window.contactData.beginCount || window.contactData.endCount || window.contactData.hitCount) {
        console.log(window.contactData.beginCount, window.contactData.endCount, window.contactData.hitCount);
      }


      if(window.contactData.beginCount) {
        // we have some starting contacts
        const arr = window.contactData.GetBeginEvents();
        arr.forEach((contact) => {
          console.log('contact begin', contact.shapeIdA, contact.shapeIdB, contact.manifold);
        });
      }

      debugDraw.drawWorld(world);
    }(window.performance.now()));

});
