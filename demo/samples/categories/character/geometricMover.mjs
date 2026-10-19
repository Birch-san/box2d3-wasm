import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import b2HexColor from '../../b2HexColor.mjs';

import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import settings from '../../settings.mjs';

import { CollisionBits, DrawPogo, FLT_MAX, GetLengthAndNormalize, ParsePath, SetLocalAnchors } from './shared/utils.mjs';

const GeometricMoverDefaults = {
	position: { x: 0.0, y: 0.0 },
	capsule: { center1: { x: 0.0, y: -0.5 }, center2: { x: 0.0, y: 0.5 }, radius: 0.3 },
	// b2DefaultQueryFilter()
	filter: { categoryBits: 0x0001, maskBits: CollisionBits.AllBits },
	jumpSpeed: 10.0,
	maxSpeed: 6.0,
	minSpeed: 0.1,
	stopSpeed: 3.0,
	accelerate: 20.0,
	airSteer: 0.2,
	friction: 8.0,
	gravity: 30.0,
	pogoRestLength: 0.9,
	pogoHertz: 5.0,
	pogoDampingRatio: 0.8,
};

// Optional shape user data read by GeometricMover when it gathers collision planes.
// Shapes without user data are treated as rigid and fully clipping.
export class MoverShapeUserData {
	constructor(maxPush = FLT_MAX, clipVelocity = true) {
		// Distance limit on the push this surface may apply to the mover. FLT_MAX is rigid.
		// Use a small value for surfaces that must not shove the mover, such as an elevator
		// that would otherwise push it through the floor.
		this.maxPush = maxPush;

		// False keeps the velocity along this surface, which is what soft collision needs.
		this.clipVelocity = clipVelocity;
	}
}

// Geometric character mover (port of box2d/samples/geometric_mover.cpp). The capsule is
// moved by casting and by solving collision planes, so the game keeps full control of the motion.
//
// A pogo spring holds the capsule above the ground so it can move up steps.
//
// Shape user data is an integer in the bindings. The mover reads it as a key into
// m_shapeUserData, register a MoverShapeUserData with AddShapeUserData() and store the key
// in b2ShapeDef.userData. Zero means no user data.
export class GeometricMover {
	static m_planeCapacity = 8;

	constructor(box2d) {
		this.box2d = box2d;

		const {
			b2Capsule,
			b2QueryFilter,
			b2DefaultQueryFilter,
			b2Vec2,
		} = box2d;

		this.m_jumpSpeed = 10.0;
		this.m_maxSpeed = 6.0;
		this.m_minSpeed = 0.1;
		this.m_stopSpeed = 3.0;
		this.m_accelerate = 20.0;

		// Fraction of the ground acceleration available in the air.
		this.m_airSteer = 0.2;

		// Ground friction in units of 1/time.
		this.m_friction = 8.0;

		// The mover is not simulated so it needs its own gravity.
		this.m_gravity = 30.0;

		this.m_pogoRestLength = 0.9;
		this.m_pogoHertz = 5.0;
		this.m_pogoDampingRatio = 0.8;

		// Downward force applied to whatever the pogo stick is resting on.
		this.m_pogoGroundForce = 50.0;

		// Push touched rigid bodies out of the way by solving a normal constraint against
		// each collision plane. Without this the mover slides along a crate instead of
		// shoving it.
		this.m_pushBodies = true;

		// The capsule is relative to the mover position.
		this.m_capsule = new b2Capsule();
		this.m_capsule.center1.Set(0.0, -0.5);
		this.m_capsule.center2.Set(0.0, 0.5);
		this.m_capsule.radius = 0.3;

		this.m_filter = b2DefaultQueryFilter();
		this.m_castFilter = new b2QueryFilter();

		this.m_worldId = null;

		// The center of the capsule.
		this.m_position = { x: 0.0, y: 0.0 };
		this.m_velocity = { x: 0.0, y: 0.0 };
		this.m_pogoVelocity = 0.0;

		// Surfaces steeper than this are not ground.
		this.m_minGroundNormalY = 0.7;
		this.m_onGround = false;

		// Planes from the last solve, kept for debug drawing. These are plain objects shaped like
		// b2CollisionPlane, which is what b2SolvePlanes and b2ClipVector read.
		this.m_planes = [];
		this.m_planeExtras = [];
		this.m_planeCount = 0;
		this.m_totalIterations = 0;

		this.m_pogoOrigin = { x: 0.0, y: 0.0 };
		this.m_pogoTranslation = { x: 0.0, y: 0.0 };
		this.m_pogoFraction = 1.0;
		this.m_pogoHit = false;

		// key 0 is reserved for shapes without user data
		this.m_shapeUserData = [null];

		// scratch vectors for passing values to the bindings
		this.m_vecA = new b2Vec2();
		this.m_vecB = new b2Vec2();

		this.m_planeResultFcn = (shapeId, planeResult) => this.PlaneResultFcn(shapeId, planeResult);
	}

	// Place the mover. The capsule and tuning may be changed at any time.
	Create(worldId, def) {
		def = { ...GeometricMoverDefaults, ...def };

		this.m_capsule.center1.Set(def.capsule.center1.x, def.capsule.center1.y);
		this.m_capsule.center2.Set(def.capsule.center2.x, def.capsule.center2.y);
		this.m_capsule.radius = def.capsule.radius;
		this.m_filter.categoryBits = def.filter.categoryBits;
		this.m_filter.maskBits = def.filter.maskBits;
		this.m_jumpSpeed = def.jumpSpeed;
		this.m_maxSpeed = def.maxSpeed;
		this.m_minSpeed = def.minSpeed;
		this.m_stopSpeed = def.stopSpeed;
		this.m_accelerate = def.accelerate;
		this.m_airSteer = def.airSteer;
		this.m_friction = def.friction;
		this.m_gravity = def.gravity;
		this.m_pogoRestLength = def.pogoRestLength;
		this.m_pogoHertz = def.pogoHertz;
		this.m_pogoDampingRatio = def.pogoDampingRatio;
		this.m_minGroundNormalY = 0.7;

		this.m_worldId = worldId;
		this.m_position = { x: def.position.x, y: def.position.y };
		this.m_velocity = { x: 0.0, y: 0.0 };
		this.m_pogoVelocity = 0.0;
		this.m_onGround = false;
		this.m_planes.length = 0;
		this.m_planeExtras.length = 0;
		this.m_planeCount = 0;
		this.m_totalIterations = 0;
		this.m_pogoFraction = 1.0;
		this.m_pogoHit = false;
	}

	// Frees the embind objects owned by the mover.
	Destroy() {
		this.m_capsule.delete();
		this.m_filter.delete();
		this.m_castFilter.delete();
		this.m_vecA.delete();
		this.m_vecB.delete();
		this.m_planes.length = 0;
		this.m_planeExtras.length = 0;
		this.m_planeCount = 0;
	}

	// Returns the key to store in b2ShapeDef.userData (or pass to b2Shape_SetUserData).
	AddShapeUserData(userData) {
		this.m_shapeUserData.push(userData);
		return this.m_shapeUserData.length - 1;
	}

	// Jump if grounded. Returns false when airborne.
	Jump() {
		if (this.m_onGround == false) {
			return false;
		}

		this.m_velocity.y = this.m_jumpSpeed;
		this.m_onGround = false;
		return true;
	}

	CastCallback(rayCallbackResult, context) {
		const { point, normal, fraction } = rayCallbackResult;

		context.point = { x: point.x, y: point.y };
		context.normal = { x: normal.x, y: normal.y };
		context.bodyId = this.box2d.b2Shape_GetBody(rayCallbackResult.shapeId);
		context.fraction = fraction;
		context.hit = true;

		rayCallbackResult.delete();

		return fraction;
	}

	PlaneResultFcn(shapeId, planeResult) {
		const { b2Shape_GetUserData } = this.box2d;

		// The plane and point of the b2PlaneResult value object are copies owned by JS
		const { plane, point } = planeResult;

		console.assert(planeResult.hit == true);

		let maxPush = FLT_MAX;
		let clipVelocity = true;
		const userData = this.m_shapeUserData[b2Shape_GetUserData(shapeId)] ?? null;
		if (userData != null) {
			maxPush = userData.maxPush;
			clipVelocity = userData.clipVelocity;
		}

		if (this.m_planeCount < GeometricMover.m_planeCapacity) {
			this.m_planes[this.m_planeCount] = {
				plane: { normal: { x: plane.normal.x, y: plane.normal.y }, offset: plane.offset },
				pushLimit: maxPush,
				push: 0.0,
				clipVelocity,
			};

			// The plane point is relative to the origin passed to the collide call
			this.m_planeExtras[this.m_planeCount] = {
				point: { x: this.m_position.x + point.x, y: this.m_position.y + point.y },
				shapeId,
			};
			this.m_planeCount += 1;
		}

		plane.delete();
		point.delete();

		return true;
	}

	// Solve a normal constraint between the mover and each touched rigid body. This is the
	// same velocity constraint the solver uses for a contact, except the mover is treated as
	// having infinite mass, so all of the impulse lands on the body.
	PushBodies() {
		const {
			b2Shape_GetBody,
			b2Body_GetType,
			b2BodyType,
			b2Body_GetMass,
			b2Body_GetRotationalInertia,
			b2Body_GetWorldCenter,
			b2Body_GetLinearVelocity,
			b2Body_GetAngularVelocity,
			b2Body_ApplyLinearImpulse,
		} = this.box2d;

		for (let i = 0; i < this.m_planeCount; ++i) {
			const bodyId = b2Shape_GetBody(this.m_planeExtras[i].shapeId);
			if (b2Body_GetType(bodyId) !== b2BodyType.b2_dynamicBody) {
				continue;
			}

			// Plane normals point at the mover
			const point = this.m_planeExtras[i].point;
			const normal = { x: -this.m_planes[i].plane.normal.x, y: -this.m_planes[i].plane.normal.y };

			const invMassA = 0.0;

			const massB = b2Body_GetMass(bodyId);
			const invMassB = massB > 0.0 ? 1.0 / massB : 0.0;

			const inertiaB = b2Body_GetRotationalInertia(bodyId);
			const invIB = inertiaB > 0.0 ? 1.0 / inertiaB : 0.0;

			const center = b2Body_GetWorldCenter(bodyId);
			const rB = { x: point.x - center.x, y: point.y - center.y };
			center.delete();

			const rnB = rB.x * normal.y - rB.y * normal.x;
			const kNormal = invMassA + invMassB + invIB * rnB * rnB;
			const normalMass = kNormal > 0.0 ? 1.0 / kNormal : 0.0;

			const v = b2Body_GetLinearVelocity(bodyId);
			const vB = { x: v.x, y: v.y };
			v.delete();

			const omegaB = b2Body_GetAngularVelocity(bodyId);
			const vrB = { x: vB.x - omegaB * rB.y, y: vB.y + omegaB * rB.x };
			const vn = (vrB.x - this.m_velocity.x) * normal.x + (vrB.y - this.m_velocity.y) * normal.y;

			// Push only, a separating body is left alone
			const impulse = Math.max(-normalMass * vn, 0.0);

			const P = { x: impulse * normal.x, y: impulse * normal.y };
			this.m_velocity.x -= invMassA * P.x;
			this.m_velocity.y -= invMassA * P.y;

			b2Body_ApplyLinearImpulse(bodyId, this.m_vecA.Set(P.x, P.y), this.m_vecB.Set(point.x, point.y), true);
		}
	}

	// Advance the mover. Throttle is the horizontal input on [-1, 1].
	// Movement follows the Quake ground and air model:
	// https://github.com/id-Software/Quake/blob/master/QW/client/pmove.c#L390
	Update(timeStep, throttle) {
		const {
			b2World_CastRay,
			b2SpringDamper,
			b2Body_ApplyForce,
			b2World_CollideMover,
			b2SolvePlanes,
			b2World_CastMover,
			b2ClipVector,
		} = this.box2d;

		const velocity = this.m_velocity;
		const position = this.m_position;

		// Friction
		const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
		if (speed < this.m_minSpeed) {
			velocity.x = 0.0;
			velocity.y = 0.0;
		}
		else if (this.m_onGround) {
			// Linear damping above stopSpeed and fixed reduction below stopSpeed
			const control = speed < this.m_stopSpeed ? this.m_stopSpeed : speed;

			// friction has units of 1/time
			const drop = control * this.m_friction * timeStep;
			const newSpeed = Math.max(0.0, speed - drop);
			velocity.x *= newSpeed / speed;
			velocity.y *= newSpeed / speed;
		}

		const desired = GetLengthAndNormalize(this.m_maxSpeed * throttle, 0.0);
		const desiredDirection = desired.normal;
		let desiredSpeed = desired.length;

		if (desiredSpeed > this.m_maxSpeed) {
			desiredSpeed = this.m_maxSpeed;
		}

		// Accelerate
		const currentSpeed = velocity.x * desiredDirection.x + velocity.y * desiredDirection.y;
		const addSpeed = desiredSpeed - currentSpeed;
		if (addSpeed > 0.0) {
			const steer = this.m_onGround ? 1.0 : this.m_airSteer;
			let accelSpeed = steer * this.m_accelerate * this.m_maxSpeed * timeStep;
			if (accelSpeed > addSpeed) {
				accelSpeed = addSpeed;
			}

			velocity.x += accelSpeed * desiredDirection.x;
			velocity.y += accelSpeed * desiredDirection.y;
		}

		// The probe reaches past the rest length so the spring can be stretched
		const rayLength = this.m_onGround ? 2.0 * this.m_pogoRestLength : this.m_pogoRestLength;
		const translation = { x: 0.0, y: -rayLength };
		const center1 = this.m_capsule.center1;
		const origin = { x: position.x + center1.x, y: position.y + center1.y };

		const castResult = { hit: false, fraction: 1.0, point: null, normal: null, bodyId: null };
		b2World_CastRay(this.m_worldId, this.m_vecA.Set(origin.x, origin.y), this.m_vecB.Set(translation.x, translation.y),
			this.m_filter, (rayCallbackResult) => this.CastCallback(rayCallbackResult, castResult));

		this.m_pogoOrigin = origin;
		this.m_pogoTranslation = translation;
		this.m_pogoFraction = castResult.hit ? castResult.fraction : 1.0;
		this.m_pogoHit = castResult.hit;

		// Avoid snapping to ground if still going up
		const haveGround = castResult.hit && castResult.normal.y > this.m_minGroundNormalY;

		if (this.m_onGround == false) {
			this.m_onGround = haveGround && velocity.y <= 0.01;
		}
		else {
			this.m_onGround = haveGround;
		}

		if (this.m_onGround == false) {
			velocity.y -= this.m_gravity * timeStep;
			this.m_pogoVelocity = 0.0;
		}
		else {
			velocity.y = 0.0;

			const pogoCurrentLength = castResult.fraction * rayLength;

			const offset = pogoCurrentLength - this.m_pogoRestLength;
			this.m_pogoVelocity = b2SpringDamper(this.m_pogoHertz, this.m_pogoDampingRatio, offset, this.m_pogoVelocity, timeStep);

			b2Body_ApplyForce(castResult.bodyId, this.m_vecA.Set(0.0, -this.m_pogoGroundForce),
				this.m_vecB.Set(castResult.point.x, castResult.point.y), true);
		}

		const target = {
			x: position.x + timeStep * velocity.x,
			y: position.y + timeStep * velocity.y + timeStep * this.m_pogoVelocity,
		};

		this.m_totalIterations = 0;
		const tolerance = 0.01;

		// Don't cast against other movers.
		const categoryBits = this.m_filter.categoryBits;
		this.m_castFilter.categoryBits = categoryBits;
		this.m_castFilter.maskBits = (this.m_filter.maskBits & ~categoryBits) >>> 0;

		for (let iteration = 0; iteration < 5; ++iteration) {
			this.m_planeCount = 0;
			this.m_planes.length = 0;
			this.m_planeExtras.length = 0;

			b2World_CollideMover(this.m_worldId, this.m_vecA.Set(position.x, position.y), this.m_capsule, this.m_filter, this.m_planeResultFcn);
			const result = b2SolvePlanes(this.m_vecB.Set(target.x - position.x, target.y - position.y), this.m_planes);

			this.m_totalIterations += result.iterationCount;
			const solveDelta = { x: result.delta.x, y: result.delta.y };
			result.delete();

			const fraction = b2World_CastMover(this.m_worldId, this.m_vecA.Set(position.x, position.y), this.m_capsule,
				this.m_vecB.Set(solveDelta.x, solveDelta.y), this.m_castFilter);

			const delta = { x: fraction * solveDelta.x, y: fraction * solveDelta.y };
			position.x += delta.x;
			position.y += delta.y;

			if (delta.x * delta.x + delta.y * delta.y < tolerance * tolerance) {
				break;
			}
		}

		if (this.m_pushBodies) {
			this.PushBodies();
		}

		// Stop pushing into surfaces so speed can't accumulate against a wall
		const clipped = b2ClipVector(this.m_vecA.Set(velocity.x, velocity.y), this.m_planes);
		velocity.x = clipped.x;
		velocity.y = clipped.y;
		clipped.delete();
	}
}

export default class GeometricMoverSample extends Sample {
	constructor(box2d, camera, debugDraw) {
		super(box2d, camera, debugDraw);

		camera.center = { x: 20.0, y: 9.0 };
		camera.zoom = 10.0;

		settings.drawJoints = false;

		const {
			b2Vec2,
			b2Transform,
			b2Circle,
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultChainDef,
			b2CreateChain,
			b2DefaultShapeDef,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			b2MakeBox,
			b2MakeSquare,
			b2BodyType,
			b2CreatePolygonShape,
			b2CreateCapsuleShape,
			b2CreateCircleShape,
		} = this.box2d;

		this.m_elevatorBase = { x: 112.0, y: 10.0 };
		this.m_elevatorAmplitude = 4.0;

		this.m_mover = new GeometricMover(this.box2d);
		this.m_mover.Create(this.m_worldId, {
			position: { x: 0.0, y: 8.0 },
			capsule: { center1: { x: 0.0, y: -0.5 }, center2: { x: 0.0, y: 0.5 }, radius: 0.3 },
			filter: { categoryBits: CollisionBits.MoverBit, maskBits: CollisionBits.StaticBit | CollisionBits.DynamicBit | CollisionBits.MoverBit },
		});

		this.m_friendlyShape = new MoverShapeUserData();
		this.m_elevatorShape = new MoverShapeUserData();
		this.m_elevatorId = null;

		const pivot = new b2Vec2();

		let groundId1;
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(0.0, 0.0);
			groundId1 = b2CreateBody(this.m_worldId, bodyDef);

			const path =
				"M -34.395834,201.08333 H 293.68751 v -47.625 h -2.64584 l -10.58333,7.9375 -13.22916,7.9375 -13.24648,5.29167 " +
				"-31.73269,7.9375 -21.16667,2.64583 -23.8125,10.58333 -15.875,2e-5 v -3.96875 l -17.19792,2e-5 v 2.64582 l " +
				"-17.19791,0 v -1.32292 h -3.96875 v -1.32292 h -3.96875 v -1.32292 h -3.96875 v -1.32291 h -3.96875 v -1.32292 " +
				"h -3.96875 v -1.32292 h -3.96875 v -1.32291 l -3.968754,0 v -1.32292 h -3.96875 v -1.32292 h -3.968751 v " +
				"-1.32291 h -3.96875 v -1.32292 h -3.96875 v -1.32292 h -3.96875 v -1.32291 h -3.96875 v -1.32292 l -3.96875,0 v " +
				"-1.32292 h -3.968751 v -1.32291 h -3.96875 l -2e-6,-1.32294 H 52.916669 L 39.6875,177.27083 h -5.291667 l " +
				"-7.937499,5.29167 H 15.875001 l -47.625002,-50.27083 v -26.45834 h -2.645834 l 10e-7,95.25";

			const offset = { x: -50.0, y: -200.0 };
			const scale = 0.2;

			const points = ParsePath(path, offset, scale, false);

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints(points);
			chainDef.isLoop = true;

			b2CreateChain(groundId1, chainDef);

			bodyDef.delete();
			chainDef.delete();
		}

		let groundId2;
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(98.0, 0.0);
			groundId2 = b2CreateBody(this.m_worldId, bodyDef);

			const path =
				"M 2.6458333,201.08333 H 399.52085 v -23.8125 h -23.8125 l 21.16667,18.52084 -232.83335,-1e-5 -0.0575,2.64584 h " +
				"-5.29166 v -2.64583 l -7.86855,-1e-5 -0.0114,-2.64583 h -2.64583 l -2.64583,2.64584 h -7.9375 l " +
				"-2.64584,2.64583 -2.58891,-2.64584 -10.64031,2e-5 v -2.64583 l -7.9375,0 v -2.64584 l -7.9375,0 v -2.64583 l " +
				"-7.9375,0 v -2.64583 l -7.9375,0 v -2.64583 l -7.937501,-1e-5 v -2.64584 l -7.9375,1e-5 v -2.64583 l " +
				"-7.937501,-2e-5 V 174.625 l -7.937501,1e-5 v -2.64584 l -5.291669,0 -7.9375,-2.64584 -7.9375,-2.64583 " +
				"-5.291667,-5.29167 H 21.166667 L 13.229167,158.75 5.2916668,153.45833 H 2.6458334 l -10e-8,47.625";

			const offset = { x: 0.0, y: -200.0 };
			const scale = 0.2;

			const points = ParsePath(path, offset, scale, false);

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints(points);
			chainDef.isLoop = true;

			b2CreateChain(groundId2, chainDef);

			bodyDef.delete();
			chainDef.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(32.0, 4.5);

			const shapeDef = b2DefaultShapeDef();
			this.m_friendlyShape.maxPush = 0.025;
			this.m_friendlyShape.clipVelocity = false;

			shapeDef.filter.categoryBits = CollisionBits.MoverBit;
			shapeDef.filter.maskBits = CollisionBits.AllBits;
			shapeDef.filter.groupIndex = 0;
			shapeDef.userData = this.m_mover.AddShapeUserData(this.m_friendlyShape);
			const bodyId = b2CreateBody(this.m_worldId, bodyDef);
			b2CreateCapsuleShape(bodyId, shapeDef, this.m_mover.m_capsule);

			bodyDef.delete();
			shapeDef.delete();
		}

		{
			const box = b2MakeBox(0.55, 0.125);

			const shapeDef = b2DefaultShapeDef();

			const jointDef = b2DefaultRevoluteJointDef();
			jointDef.maxMotorTorque = 10.0;
			jointDef.enableMotor = true;
			jointDef.hertz = 3.0;
			jointDef.dampingRatio = 0.8;
			jointDef.enableSpring = true;

			const xBase = 48.7;
			const yBase = 9.2;
			const count = 50;
			let prevBodyId = groundId1;
			for (let i = 0; i < count; ++i) {
				const bodyDef = b2DefaultBodyDef();
				bodyDef.type = b2BodyType.b2_dynamicBody;
				bodyDef.position.Set(xBase + 0.5 + 1.0 * i, yBase);
				bodyDef.angularDamping = 0.2;
				const bodyId = b2CreateBody(this.m_worldId, bodyDef);
				b2CreatePolygonShape(bodyId, shapeDef, box);

				pivot.Set(xBase + 1.0 * i, yBase);
				jointDef.base.bodyIdA = prevBodyId;
				jointDef.base.bodyIdB = bodyId;
				SetLocalAnchors(this.box2d, jointDef, pivot);
				b2CreateRevoluteJoint(this.m_worldId, jointDef);

				prevBodyId = bodyId;

				bodyDef.delete();
			}

			pivot.Set(xBase + 1.0 * count, yBase);
			jointDef.base.bodyIdA = prevBodyId;
			jointDef.base.bodyIdB = groundId2;
			SetLocalAnchors(this.box2d, jointDef, pivot);
			b2CreateRevoluteJoint(this.m_worldId, jointDef);

			box.delete();
			shapeDef.delete();
			jointDef.delete();
		}

		for (let i = 0; i < 5; ++i) {
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Set(7.0, 7.0 + 0.5 * i);
			const bodyId = b2CreateBody(this.m_worldId, bodyDef);

			const shapeDef = b2DefaultShapeDef();
			shapeDef.filter.categoryBits = CollisionBits.DynamicBit;
			shapeDef.filter.maskBits = CollisionBits.AllBits;
			shapeDef.filter.groupIndex = 0;
			shapeDef.material.restitution = 0.7;
			shapeDef.material.rollingResistance = 0.2;

			const circle = new b2Circle();
			circle.center.Set(0.0, 0.0);
			circle.radius = 0.25;
			b2CreateCircleShape(bodyId, shapeDef, circle);

			bodyDef.delete();
			shapeDef.delete();
			circle.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_kinematicBody;
			bodyDef.position.Set(this.m_elevatorBase.x, this.m_elevatorBase.y - this.m_elevatorAmplitude);
			this.m_elevatorId = b2CreateBody(this.m_worldId, bodyDef);

			this.m_elevatorShape.maxPush = 0.1;
			this.m_elevatorShape.clipVelocity = true;

			const shapeDef = b2DefaultShapeDef();
			shapeDef.filter.categoryBits = CollisionBits.DynamicBit;
			shapeDef.filter.maskBits = CollisionBits.AllBits;
			shapeDef.filter.groupIndex = 0;
			shapeDef.userData = this.m_mover.AddShapeUserData(this.m_elevatorShape);

			const box = b2MakeBox(2.0, 0.1);
			b2CreatePolygonShape(this.m_elevatorId, shapeDef, box);

			bodyDef.delete();
			shapeDef.delete();
			box.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.x = 140.0;
			const a = 0.25;
			const square = b2MakeSquare(a);
			const shapeDef = b2DefaultShapeDef();
			shapeDef.filter.categoryBits = CollisionBits.DynamicBit;
			shapeDef.filter.maskBits = CollisionBits.AllBits;
			shapeDef.filter.groupIndex = 0;
			for (let i = 0; i < 10; ++i) {
				bodyDef.position.y = (2.0 * i + 1.0) * a + 1.0;
				const bodyId = b2CreateBody(this.m_worldId, bodyDef);
				b2CreatePolygonShape(bodyId, shapeDef, square);
			}

			bodyDef.delete();
			square.delete();
			shapeDef.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(160.0, 5.0);
			bodyDef.type = b2BodyType.b2_dynamicBody;
			const body = b2CreateBody(this.m_worldId, bodyDef);

			const box = b2MakeBox(0.1, 4.0);
			const shapeDef = b2DefaultShapeDef();
			shapeDef.density = 1.0;
			b2CreatePolygonShape(body, shapeDef, box);

			pivot.Set(bodyDef.position.x, bodyDef.position.y + 4.0);
			const jointDef = b2DefaultRevoluteJointDef();
			jointDef.base.bodyIdA = groundId2;
			jointDef.base.bodyIdB = body;
			SetLocalAnchors(this.box2d, jointDef, pivot);
			jointDef.enableMotor = true;
			jointDef.motorSpeed = 1.0;
			jointDef.maxMotorTorque = 500.0;

			b2CreateRevoluteJoint(this.m_worldId, jointDef);

			bodyDef.delete();
			box.delete();
			shapeDef.delete();
			jointDef.delete();
		}

		pivot.delete();

		this.m_elevatorTransform = new b2Transform();
		this.m_elevatorTransform.q.SetAngle(0.0);

		this.m_jumpReleased = true;
		this.m_lockCamera = true;
		this.m_time = 0.0;
		this.m_touchKeyboard = false;

		this.CreateUI();
	}

	Step() {
		const {
			B2_PI,
			b2Body_SetTargetTransform,
		} = this.box2d;

		let pause = false;
		if (settings.pause) {
			pause = settings.singleStep !== true;
		}

		let timeStep = settings.hertz > 0.0 ? 1.0 / settings.hertz : 0.0;
		if (pause) {
			timeStep = 0.0;
		}

		if (timeStep > 0.0) {
			this.m_elevatorTransform.p.Set(
				this.m_elevatorBase.x,
				this.m_elevatorAmplitude * Math.cos(1.0 * this.m_time + B2_PI) + this.m_elevatorBase.y,
			);

			const wake = true;
			b2Body_SetTargetTransform(this.m_elevatorId, this.m_elevatorTransform, timeStep, wake);
		}

		this.m_time += timeStep;

		super.Step();

		const mover = this.m_mover;

		if (pause == false) {
			let throttle = 0.0;

			if (Keyboard.IsDown(Key.A)) {
				throttle -= 1.0;
			}

			if (Keyboard.IsDown(Key.D)) {
				throttle += 1.0;
			}

			if (Keyboard.IsDown(Key.Space)) {
				if (this.m_jumpReleased && mover.Jump()) {
					this.m_jumpReleased = false;
				}
			}
			else {
				this.m_jumpReleased = true;
			}

			mover.Update(timeStep, throttle);
		}

		this.debugDraw.prepareCanvas();

		DrawPogo(this.debugDraw, mover.m_pogoOrigin, mover.m_pogoTranslation, mover.m_pogoFraction, mover.m_pogoHit);

		const position = mover.m_position;

		// q = identity
		this.debugDraw.drawTransform({ data: [position.x, position.y, 0.0, 1.0] });

		const capsule = mover.m_capsule;
		const radius = capsule.radius;

		const count = mover.m_planeCount;
		for (let i = 0; i < count; ++i) {
			const plane = mover.m_planes[i].plane;
			const p1 = {
				x: position.x + (plane.offset - radius) * plane.normal.x,
				y: position.y + (plane.offset - radius) * plane.normal.y,
			};
			const p2 = { x: p1.x + 0.1 * plane.normal.x, y: p1.y + 0.1 * plane.normal.y };
			this.debugDraw.drawPoint({ data: [p1.x, p1.y, 5.0], color: b2HexColor.b2_colorYellow });
			this.debugDraw.drawLine({ data: [p1.x, p1.y, p2.x, p2.y], color: b2HexColor.b2_colorYellow });
		}

		const center1 = capsule.center1;
		const center2 = capsule.center2;
		const p1 = { x: position.x + center1.x, y: position.y + center1.y };
		const p2 = { x: position.x + center2.x, y: position.y + center2.y };

		const color = mover.m_onGround ? b2HexColor.b2_colorOrange : b2HexColor.b2_colorAquamarine;
		this.debugDraw.drawSolidCapsule({ data: [p1.x, p1.y, p2.x, p2.y, radius], color });
		this.debugDraw.drawLine({
			data: [position.x, position.y, position.x + mover.m_velocity.x, position.y + mover.m_velocity.y],
			color: b2HexColor.b2_colorPurple,
		});

		this.debugDraw.restoreCanvas();

		if (this.m_lockCamera) {
			this.camera.center.x = position.x;
		}
	}

	CreateUI() {
		const container = document.getElementById('sample-settings');

		if (this.pane) {
			this.pane.dispose();
		}

		this.pane = new Pane({
			title: 'Sample Settings',
			expanded: true,
			container
		});

		this.pane.addButton({
			title: this.m_touchKeyboard ? 'hide touch keyboard' : 'show touch keyboard',
		}).on('click', () => {
			this.m_touchKeyboard = !this.m_touchKeyboard;

			if (this.m_touchKeyboard) {
				Keyboard.ShowTouchControls([Key.A, Key.D, Key.Space]);
			} else {
				Keyboard.HideTouchControls();
			}

			this.CreateUI();
		});

		const mover = this.m_mover;

		const PARAMS = {
			jumpSpeed: mover.m_jumpSpeed,
			minSpeed: mover.m_minSpeed,
			maxSpeed: mover.m_maxSpeed,
			stopSpeed: mover.m_stopSpeed,
			accelerate: mover.m_accelerate,
			friction: mover.m_friction,
			gravity: mover.m_gravity,
			airSteer: mover.m_airSteer,
			pogoHertz: mover.m_pogoHertz,
			pogoDamping: mover.m_pogoDampingRatio,
			pushBodies: mover.m_pushBodies,
			lockCamera: this.m_lockCamera,
		};

		this.pane.addBinding(PARAMS, 'jumpSpeed', { label: 'Jump Speed', step: 1, min: 0, max: 40 }).on('change', event => { mover.m_jumpSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'minSpeed', { label: 'Min Speed', step: 0.01, min: 0, max: 1 }).on('change', event => { mover.m_minSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'maxSpeed', { label: 'Max Speed', step: 1, min: 0, max: 20 }).on('change', event => { mover.m_maxSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'stopSpeed', { label: 'Stop Speed', step: 0.1, min: 0, max: 10 }).on('change', event => { mover.m_stopSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'accelerate', { label: 'Accelerate', step: 1, min: 0, max: 100 }).on('change', event => { mover.m_accelerate = event.value; });
		this.pane.addBinding(PARAMS, 'friction', { label: 'Friction', step: 0.1, min: 0, max: 10 }).on('change', event => { mover.m_friction = event.value; });
		this.pane.addBinding(PARAMS, 'gravity', { label: 'Gravity', step: 0.1, min: 0, max: 100 }).on('change', event => { mover.m_gravity = event.value; });
		this.pane.addBinding(PARAMS, 'airSteer', { label: 'Air Steer', step: 0.01, min: 0, max: 1 }).on('change', event => { mover.m_airSteer = event.value; });
		this.pane.addBinding(PARAMS, 'pogoHertz', { label: 'Pogo Hertz', step: 1, min: 0, max: 30 }).on('change', event => { mover.m_pogoHertz = event.value; });
		this.pane.addBinding(PARAMS, 'pogoDamping', { label: 'Pogo Damping', step: 0.1, min: 0, max: 4 }).on('change', event => { mover.m_pogoDampingRatio = event.value; });

		this.pane.addBlade({ view: 'separator' });

		this.pane.addBinding(PARAMS, 'pushBodies', { label: 'Push Bodies' }).on('change', event => { mover.m_pushBodies = event.value; });
		this.pane.addBinding(PARAMS, 'lockCamera', { label: 'Lock Camera' }).on('change', event => { this.m_lockCamera = event.value; });
	}

	UpdateUI(DrawString, m_textLine) {
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const mover = this.m_mover;
		const p = mover.m_position;
		m_textLine = DrawString(5, m_textLine, "left/right/jump = A/D/Space");
		m_textLine = DrawString(5, m_textLine, `position ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
		m_textLine = DrawString(5, m_textLine, `velocity ${mover.m_velocity.x.toFixed(2)} ${mover.m_velocity.y.toFixed(2)}`);
		m_textLine = DrawString(5, m_textLine, `iterations ${mover.m_totalIterations}`);

		return m_textLine;
	}

	Destroy() {
		Keyboard.HideTouchControls();

		super.Destroy();

		this.m_mover.Destroy();
		this.m_elevatorTransform.delete();

		if (this.pane) {
			this.pane.dispose();
			this.pane = null;
		}
	}
}
