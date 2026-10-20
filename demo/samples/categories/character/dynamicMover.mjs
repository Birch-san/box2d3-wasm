import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import b2HexColor from '../../b2HexColor.mjs';

import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import settings from '../../settings.mjs';

import { CollisionBits, DrawPogo, GetLengthAndNormalize, ParsePath, SetLocalAnchors } from './shared/utils.mjs';

const DynamicMoverDefaults = {
	position: { x: 0.0, y: 0.0 },
	capsule: { center1: { x: 0.0, y: 0.0 }, center2: { x: 0.0, y: 0.0 }, radius: 0.0 },
	density: 1.0,
	// b2DefaultFilter()
	filter: { categoryBits: 0x0001, maskBits: CollisionBits.AllBits, groupIndex: 0 },
	jumpSpeed: 7.0,
	maxSpeed: 6.0,
	minSpeed: 0.1,
	stopSpeed: 3.0,
	accelerate: 20.0,
	airSteer: 0.5,
	friction: 8.0,
	gravityScale: 1.5,
	maxGroundForce: 70.0,
	maxAirForce: 20.0,
	pogoRestLength: 0.9,
	pogoHertz: 5.0,
	pogoDampingRatio: 0.8,
	pogoCompressionScale: 100.0,
	pogoTensionScale: 100.0,
	enablePreSolveEvents: false,
};

function EmptyCastResult() {
	return { point: { x: 0.0, y: 0.0 }, normal: { x: 0.0, y: 0.0 }, bodyId: null, fraction: 0.0, hit: false };
}

// Dynamic character mover (port of box2d/samples/dynamic_mover.cpp). The capsule is a rigid
// body with a locked rotation, so it collides and is pushed like everything else in the world.
// A mover joint drives it to the target velocity and a pogo joint holds it above the ground so
// it can climb steps without touching the capsule.
//
// The dynamic mover should be vendored into your project so you can alter it to meet
// your game's specific needs.
//
// This system is inspired by Tom Waterson's presentation:
// https://www.youtube.com/watch?v=_jRLlTDqoGI
export class DynamicMover {
	constructor(box2d) {
		this.box2d = box2d;

		this.m_jumpSpeed = 5.0;
		this.m_maxSpeed = 6.0;
		this.m_minSpeed = 0.1;
		this.m_stopSpeed = 3.0;
		this.m_accelerate = 20.0;

		// Fraction of the ground acceleration available in the air.
		this.m_airSteer = 0.2;

		// Ground friction in units of 1/time.
		this.m_friction = 8.0;

		// A character usually wants to fall faster than the rest of the world.
		this.m_gravityScale = 1.5;

		// Force budget the mover joint has for reaching the target velocity. The air value
		// is small so the character keeps its momentum while jumping.
		this.m_maxGroundForce = 70.0;
		this.m_maxAirForce = 20.0;

		this.m_pogoRestLength = 0.9;
		this.m_pogoHertz = 5.0;
		this.m_pogoDampingRatio = 0.8;

		// Pogo force limits as a multiple of the mover weight.
		this.m_pogoCompressionScale = 100.0;
		this.m_pogoTensionScale = 100.0;

		// Surfaces steeper than this are not ground.
		this.m_minGroundNormalY = 0.7;

		this.m_capsule = { center1: { x: 0.0, y: -0.5 }, center2: { x: 0.0, y: 0.5 }, radius: 0.3 };
		this.m_filter = { ...DynamicMoverDefaults.filter };

		this.m_worldId = null;
		this.m_groundId = null;
		this.m_moverId = null;
		this.m_moverJointId = null;
		this.m_pogoJointId = null;

		this.m_castResult = EmptyCastResult();

		this.m_velocity = { x: 0.0, y: 0.0 };
		this.m_onGround = false;
		this.m_walkable = false;
		this.m_jumping = false;
		this.m_jumpTicks = 0;

		// Pogo joint state, carried across the joint being recreated each solve.
		this.m_pogoImpulse = 0.0;
		this.m_pogoVelocity = 0.0;
		this.m_pogoLength = 0.0;

		// Ground probe from the last solve, kept for debug drawing. The probe ends at
		// the origin plus the fraction of the translation.
		this.m_pogoOrigin = { x: 0.0, y: 0.0 };
		this.m_pogoTranslation = { x: 0.0, y: 0.0 };
		this.m_pogoFraction = 1.0;
		this.m_pogoHit = false;

		// scratch objects for passing values to the bindings, freed by Destroy()
		this.m_vecA = new box2d.b2Vec2();
		this.m_vecB = new box2d.b2Vec2();
		this.m_queryFilter = new box2d.b2QueryFilter();
	}

	Create(worldId, def) {
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2BodyType,
			b2DefaultShapeDef,
			b2Capsule,
			b2CreateCapsuleShape,
			b2DefaultMoverJointDef,
			b2CreateMoverJoint,
		} = this.box2d;

		def = { ...DynamicMoverDefaults, ...def };

		this.m_capsule = {
			center1: { ...def.capsule.center1 },
			center2: { ...def.capsule.center2 },
			radius: def.capsule.radius,
		};
		this.m_filter = { ...DynamicMoverDefaults.filter, ...def.filter };
		this.m_jumpSpeed = def.jumpSpeed;
		this.m_maxSpeed = def.maxSpeed;
		this.m_minSpeed = def.minSpeed;
		this.m_stopSpeed = def.stopSpeed;
		this.m_accelerate = def.accelerate;
		this.m_airSteer = def.airSteer;
		this.m_friction = def.friction;
		this.m_gravityScale = def.gravityScale;
		this.m_maxGroundForce = def.maxGroundForce;
		this.m_maxAirForce = def.maxAirForce;
		this.m_pogoRestLength = def.pogoRestLength;
		this.m_pogoHertz = def.pogoHertz;
		this.m_pogoDampingRatio = def.pogoDampingRatio;
		this.m_pogoCompressionScale = def.pogoCompressionScale;
		this.m_pogoTensionScale = def.pogoTensionScale;
		this.m_minGroundNormalY = 0.7;

		this.m_worldId = worldId;
		this.m_velocity = { x: 0.0, y: 0.0 };
		this.m_onGround = false;
		this.m_walkable = false;
		this.m_jumping = false;
		this.m_pogoImpulse = 0.0;
		this.m_pogoVelocity = 0.0;
		this.m_pogoLength = 0.0;
		this.m_pogoJointId = null;

		const bodyDef = b2DefaultBodyDef();
		this.m_groundId = b2CreateBody(worldId, bodyDef);

		// Position is the center of the capsule.
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set(def.position.x, def.position.y);
		bodyDef.gravityScale = this.m_gravityScale;
		bodyDef.motionLocks.angularZ = true;
		bodyDef.enableSleep = false;
		// note: bodyDef.name = "mover" is not bound

		this.m_moverId = b2CreateBody(worldId, bodyDef);

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = def.density;

		// The mover joint and the pogo joint handle all the movement, surface friction would fight them
		shapeDef.material.friction = 0.0;
		shapeDef.filter.categoryBits = this.m_filter.categoryBits;
		shapeDef.filter.maskBits = this.m_filter.maskBits;
		shapeDef.filter.groupIndex = this.m_filter.groupIndex;
		shapeDef.enablePreSolveEvents = def.enablePreSolveEvents;

		const capsule = new b2Capsule();
		capsule.center1.Set(this.m_capsule.center1.x, this.m_capsule.center1.y);
		capsule.center2.Set(this.m_capsule.center2.x, this.m_capsule.center2.y);
		capsule.radius = this.m_capsule.radius;
		b2CreateCapsuleShape(this.m_moverId, shapeDef, capsule);

		const moverDef = b2DefaultMoverJointDef();
		moverDef.linearVelocity.Set(this.m_velocity.x, this.m_velocity.y);
		moverDef.maxVelocityForce.Set(this.m_maxGroundForce, 0.0);
		moverDef.base.bodyIdA = this.m_groundId;
		moverDef.base.bodyIdB = this.m_moverId;
		moverDef.base.collideConnected = true;

		this.m_moverJointId = b2CreateMoverJoint(worldId, moverDef);

		bodyDef.delete();
		shapeDef.delete();
		capsule.delete();
		moverDef.delete();
	}

	// Destroys the mover bodies (the world must still exist) and frees the embind objects
	// owned by the mover. Upstream only destroys the bodies, the world takes care of the rest.
	Destroy() {
		const {
			b2DestroyBody,
			b2Body_IsValid,
		} = this.box2d;

		if (this.m_moverId !== null && b2Body_IsValid(this.m_moverId)) {
			b2DestroyBody(this.m_moverId);
		}

		if (this.m_groundId !== null && b2Body_IsValid(this.m_groundId)) {
			b2DestroyBody(this.m_groundId);
		}

		this.m_groundId = null;
		this.m_moverId = null;

		// Joints are implicitly destroyed.
		this.m_moverJointId = null;
		this.m_pogoJointId = null;

		this.m_vecA?.delete();
		this.m_vecB?.delete();
		this.m_queryFilter?.delete();
		this.m_vecA = null;
		this.m_vecB = null;
		this.m_queryFilter = null;
	}

	// Gravity scale is used to size the pogo forces, so change it here.
	SetGravityScale(gravityScale) {
		this.m_gravityScale = gravityScale;

		if (this.m_moverId !== null) {
			this.box2d.b2Body_SetGravityScale(this.m_moverId, gravityScale);
		}
	}

	// Jump if grounded. Returns false when airborne.
	Jump() {
		const {
			b2Body_IsValid,
			b2Body_GetWorldPointVelocity,
			b2Body_GetMass,
			b2Body_GetLinearVelocity,
			b2Body_ApplyLinearImpulseToCenter,
		} = this.box2d;

		if (this.m_onGround == false || this.m_walkable == false) {
			return false;
		}

		let surfaceVelocity = 0.0;
		if (this.m_castResult.bodyId !== null && b2Body_IsValid(this.m_castResult.bodyId)) {
			const point = this.m_castResult.point;
			const v = b2Body_GetWorldPointVelocity(this.m_castResult.bodyId, this.m_vecA.Set(point.x, point.y));
			surfaceVelocity = v.y;
			v.delete();
		}

		const mass = b2Body_GetMass(this.m_moverId);
		const linearVelocity = b2Body_GetLinearVelocity(this.m_moverId);
		const vy = linearVelocity.y;
		linearVelocity.delete();

		// Remove the pogo constraint velocity but add the surface velocity.
		const dv = Math.max(0.0, this.m_jumpSpeed - vy) + surfaceVelocity;
		b2Body_ApplyLinearImpulseToCenter(this.m_moverId, this.m_vecA.Set(0.0, mass * dv), true);

		// This removes the pogo step down on the next update.
		this.m_onGround = false;
		this.m_walkable = false;
		this.m_jumping = true;
		this.m_jumpTicks = 0;
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

	// Advance the mover. Throttle is the horizontal input on [-1, 1].
	// Movement follows the Quake ground and air model:
	// https://github.com/id-Software/Quake/blob/master/QW/client/pmove.c#L390
	//
	// onGround - controls friction, mover max force, and pogo step-down extension
	// walkable - controls air steer
	// jumping - blocks the pogo from pulling down
	Update(timeStep, throttle) {
		const {
			b2Body_GetPosition,
			b2Body_GetLinearVelocity,
			b2Body_GetLocalPoint,
			b2Body_GetMass,
			b2World_CastRay,
			b2World_GetGravity,
			b2MoverJoint_SetMaxVelocityForce,
			b2MoverJoint_SetLinearVelocity,
			b2Joint_IsValid,
			b2PogoJoint_GetCurrentLength,
			b2PogoJoint_GetImpulse,
			b2PogoJoint_GetCurrentSpeed,
			b2DestroyJoint,
			b2DefaultPogoJointDef,
			b2CreatePogoJoint,
		} = this.box2d;

		// Reach further while grounded so the spring can find the ground over a step
		const stepDownLength = this.m_pogoRestLength;
		const rayLength = this.m_onGround ? this.m_pogoRestLength + stepDownLength : this.m_pogoRestLength;
		const translation = { x: 0.0, y: -rayLength };

		const p = b2Body_GetPosition(this.m_moverId);
		const position = { x: p.x, y: p.y };
		p.delete();

		const origin = { x: position.x + this.m_capsule.center1.x, y: position.y + this.m_capsule.center1.y };

		this.m_queryFilter.categoryBits = this.m_filter.categoryBits;
		this.m_queryFilter.maskBits = this.m_filter.maskBits;

		const castResult = EmptyCastResult();
		this.m_castResult = castResult;
		b2World_CastRay(this.m_worldId, this.m_vecA.Set(origin.x, origin.y), this.m_vecB.Set(translation.x, translation.y),
			this.m_queryFilter, (rayCallbackResult) => this.CastCallback(rayCallbackResult, castResult));

		this.m_pogoOrigin = origin;
		this.m_pogoTranslation = translation;
		this.m_pogoFraction = castResult.hit ? castResult.fraction : 1.0;
		this.m_pogoHit = castResult.hit;

		// Should jumping end?
		if (this.m_jumping) {
			this.m_jumpTicks += 1;

			// Jump ticks allow time for the jump to leave the ground. Otherwise jumping ends
			// when the character approaches the current ground.
			if (this.m_jumpTicks > 2 && castResult.hit &&
				this.m_velocity.x * castResult.normal.x + this.m_velocity.y * castResult.normal.y <= 0.0) {
				this.m_jumping = false;
			}
		}

		if (castResult.hit) {
			// The cast can still hit while jumping.
			this.m_onGround = this.m_jumping == false;

			// Is the ground too steep to walk?
			this.m_walkable = castResult.normal.y >= this.m_minGroundNormalY;
		}
		else {
			this.m_onGround = false;
			this.m_walkable = false;
		}

		const v = b2Body_GetLinearVelocity(this.m_moverId);
		const velocity = { x: v.x, y: v.y };
		v.delete();
		this.m_velocity = velocity;

		// Friction
		if (this.m_onGround) {
			const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
			if (speed < this.m_minSpeed) {
				velocity.x = 0.0;
			}
			else {
				// Linear damping above stopSpeed and fixed reduction below stopSpeed
				const control = speed < this.m_stopSpeed ? this.m_stopSpeed : speed;

				// friction has units of 1/time
				const drop = control * this.m_friction * timeStep;
				const newSpeed = Math.max(0.0, speed - drop);
				velocity.x *= newSpeed / speed;
			}
		}

		// Mover force
		if (this.m_onGround) {
			const maxForce = this.m_walkable ? this.m_maxGroundForce : 0.0;
			b2MoverJoint_SetMaxVelocityForce(this.m_moverJointId, this.m_vecA.Set(maxForce, 0.0));
		}
		else {
			b2MoverJoint_SetMaxVelocityForce(this.m_moverJointId, this.m_vecA.Set(this.m_maxAirForce, 0.0));
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
			const steer = this.m_walkable ? 1.0 : this.m_airSteer;
			let accelSpeed = steer * this.m_accelerate * this.m_maxSpeed * timeStep;
			if (accelSpeed > addSpeed) {
				accelSpeed = addSpeed;
			}

			velocity.x += accelSpeed * desiredDirection.x;
		}

		// The pogo joint is rebuilt every solve because it may land on a different body
		if (this.m_pogoJointId !== null && b2Joint_IsValid(this.m_pogoJointId)) {
			this.m_pogoLength = b2PogoJoint_GetCurrentLength(this.m_pogoJointId);
			this.m_pogoImpulse = b2PogoJoint_GetImpulse(this.m_pogoJointId);
			this.m_pogoVelocity = b2PogoJoint_GetCurrentSpeed(this.m_pogoJointId);

			b2DestroyJoint(this.m_pogoJointId);
			this.m_pogoJointId = null;
		}

		if (castResult.hit == true) {
			const moverMass = b2Body_GetMass(this.m_moverId);
			const gravity = b2World_GetGravity(this.m_worldId);
			const moverWeight = this.m_gravityScale * Math.sqrt(gravity.x * gravity.x + gravity.y * gravity.y) * moverMass;
			gravity.delete();

			const pogoDef = b2DefaultPogoJointDef();
			const localPoint = b2Body_GetLocalPoint(castResult.bodyId, this.m_vecA.Set(castResult.point.x, castResult.point.y));
			pogoDef.base.localFrameA.p.Copy(localPoint);
			localPoint.delete();
			pogoDef.base.localFrameB.p.Set(this.m_capsule.center1.x, this.m_capsule.center1.y);
			pogoDef.normal.Set(castResult.normal.x, castResult.normal.y);
			pogoDef.base.bodyIdA = castResult.bodyId;
			pogoDef.base.bodyIdB = this.m_moverId;
			pogoDef.base.collideConnected = true;
			pogoDef.restLength = this.m_pogoRestLength;
			pogoDef.hertz = this.m_pogoHertz;
			pogoDef.dampingRatio = this.m_pogoDampingRatio;
			pogoDef.maxCompressionForce = this.m_pogoCompressionScale * moverWeight;

			// Warm start from the joint that was just destroyed
			pogoDef.impulse = this.m_pogoImpulse;
			pogoDef.velocity = this.m_pogoVelocity;

			if (this.m_jumping) {
				// Don't allow the pogo to pull down
				pogoDef.maxTensionForce = 0.0;
			}
			else {
				// The pogo can pull down at a multiple of the gravity force.
				pogoDef.maxTensionForce = this.m_pogoTensionScale * moverWeight;
			}

			this.m_pogoJointId = b2CreatePogoJoint(this.m_worldId, pogoDef);

			pogoDef.delete();
		}
		else {
			this.m_pogoImpulse = 0.0;
			this.m_pogoVelocity = 0.0;
		}

		b2MoverJoint_SetLinearVelocity(this.m_moverJointId, this.m_vecA.Set(velocity.x, velocity.y));
	}
}

export default class DynamicMoverSample extends Sample {
	constructor(box2d, camera, debugDraw) {
		if (settings.workerCount > 1) {
			// The pre-solve callback runs in JavaScript, which worker threads cannot call.
			console.warn("PreSolve is not compatible with multiple workers");
			settings.workerCount = 1;
		}

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
			b2CreateCircleShape,
			b2World_SetPreSolveCallback,
		} = this.box2d;

		this.m_elevatorBase = { x: 112.0, y: 10.0 };
		this.m_elevatorAmplitude = 4.0;

		// This is the mover the player controls
		this.m_mover = new DynamicMover(this.box2d);
		this.m_mover.Create(this.m_worldId, {
			position: { x: 0.0, y: 8.0 },
			capsule: { center1: { x: 0.0, y: -0.5 }, center2: { x: 0.0, y: 0.5 }, radius: 0.3 },
			filter: { categoryBits: CollisionBits.MoverBit, maskBits: CollisionBits.StaticBit | CollisionBits.DynamicBit },
			enablePreSolveEvents: true,
		});

		this.m_elevatorId = null;

		const pivot = new b2Vec2();

		let groundId1;
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(0.0, 0.0);
			groundId1 = b2CreateBody(this.m_worldId, bodyDef);

			// alternative test map:
			// "M -34.4,201.08 H 293.69 V 34.4 L -21.17,198.44 H -31.75 l -0,-92.6 h -2.65 l 0,95.25"
			const path =
				"M -34.395834,201.08333 H 293.68751 v -47.625 h -2.64584 l -10.58333,7.9375 -13.22916,7.9375 -13.24648,5.29167 " +
				"-31.73269,7.9375 -21.16667,2.64583 -23.8125,13.22919 -15.875,2e-5 0,-6.61461 -17.19792,2e-5 v 2.64582 h " +
				"-17.19791 v -1.32292 h -3.96875 v -1.32292 h -3.96875 v -1.32292 h -3.96875 v -1.32291 h -3.96875 v -1.32292 h " +
				"-3.96875 v -1.32292 h -3.96875 v -1.32291 h -3.968754 v -1.32292 h -3.96875 v -1.32292 h -3.968751 v -1.32291 h " +
				"-3.96875 v -1.32292 h -3.96875 v -1.32292 h -3.96875 v -1.32291 h -3.96875 v -1.32292 h -3.96875 v -1.32292 h " +
				"-3.968751 v -1.32291 h -3.96875 l -2e-6,-1.32294 H 52.916669 L 39.6875,177.27083 h -5.291667 l " +
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

			const shapeDef = b2DefaultShapeDef();
			shapeDef.filter.categoryBits = CollisionBits.DynamicBit;
			shapeDef.filter.maskBits = CollisionBits.AllBits;
			shapeDef.filter.groupIndex = 0;

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
			bodyDef.position.Set(160.0, 4.0);
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

		this.m_preSolve = true;
		this.m_preSolveCallback = null;

		// This is used for one-way collision on the kinematic elevator. But pre-solve doesn't work with recording.
		if (this.m_preSolve) {
			this.m_preSolveCallback = b2World_SetPreSolveCallback(this.m_worldId, this.PreSolve, this.PreContinuous);
		}

		this.m_elevatorTransform = new b2Transform();
		this.m_elevatorTransform.q.SetAngle(0.0);

		this.m_position = { x: 0.0, y: 8.0 };
		this.m_jumpReleased = true;
		this.m_lockCamera = true;
		this.m_time = 0.0;
		this.m_touchKeyboard = false;

		this.CreateUI();
	}

	// The manifold is the live b2Manifold, edit it in place and never delete it.
	PreSolve = (shapeIdA, shapeIdB, manifold) => {
		const {
			b2Shape_GetBody,
			B2_ID_EQUALS,
		} = this.box2d;

		const idA = b2Shape_GetBody(shapeIdA);
		const idB = b2Shape_GetBody(shapeIdB);

		if (B2_ID_EQUALS(idA, this.m_elevatorId) && B2_ID_EQUALS(idB, this.m_mover.m_moverId)) {
			if (manifold.normal.y < 0.0) {
				manifold.pointCount = 0;
			}
		}
		else if (B2_ID_EQUALS(idA, this.m_mover.m_moverId) && B2_ID_EQUALS(idB, this.m_elevatorId)) {
			if (manifold.normal.y > 0.0) {
				manifold.pointCount = 0;
			}
		}
	}

	// point and normal are b2Vec2 copies owned by this callback
	PreContinuous = (shapeIdA, shapeIdB, point, normal) => {
		const {
			b2Shape_GetBody,
			B2_ID_EQUALS,
		} = this.box2d;

		const normalY = normal.y;
		point.delete();
		normal.delete();

		const idA = b2Shape_GetBody(shapeIdA);
		const idB = b2Shape_GetBody(shapeIdB);

		if (B2_ID_EQUALS(idA, this.m_elevatorId) && B2_ID_EQUALS(idB, this.m_mover.m_moverId)) {
			if (normalY < 0.0) {
				return false;
			}

			return true;
		}

		if (B2_ID_EQUALS(idA, this.m_mover.m_moverId) && B2_ID_EQUALS(idB, this.m_elevatorId)) {
			if (normalY > 0.0) {
				return false;
			}

			return true;
		}

		return true;
	}

	Step() {
		const {
			B2_PI,
			b2Body_SetTargetTransform,
			b2Body_GetPosition,
		} = this.box2d;

		let pause = false;
		if (settings.pause) {
			pause = settings.singleStep !== true;
		}

		let timeStep = settings.hertz > 0.0 ? 1.0 / settings.hertz : 0.0;
		if (pause) {
			timeStep = 0.0;
		}

		if (timeStep > 0.0 && this.m_elevatorId !== null) {
			this.m_elevatorTransform.p.Set(
				this.m_elevatorBase.x,
				this.m_elevatorAmplitude * Math.cos(1.0 * this.m_time + B2_PI) + this.m_elevatorBase.y,
			);

			const wake = true;
			b2Body_SetTargetTransform(this.m_elevatorId, this.m_elevatorTransform, timeStep, wake);
		}

		this.m_time += timeStep;

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

		super.Step();

		const p = b2Body_GetPosition(mover.m_moverId);
		const position = { x: p.x, y: p.y };
		p.delete();
		this.m_position = position;

		this.debugDraw.prepareCanvas();

		DrawPogo(this.debugDraw, mover.m_pogoOrigin, mover.m_pogoTranslation, mover.m_pogoFraction, mover.m_pogoHit);

		const color = mover.m_onGround ? b2HexColor.b2_colorOrange : b2HexColor.b2_colorAquamarine;
		this.debugDraw.drawLine({
			data: [position.x, position.y, position.x + mover.m_velocity.x, position.y + mover.m_velocity.y],
			color,
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
			gravityScale: mover.m_gravityScale,
			airSteer: mover.m_airSteer,
			pogoHertz: mover.m_pogoHertz,
			pogoDamping: mover.m_pogoDampingRatio,
			lockCamera: this.m_lockCamera,
		};

		this.pane.addBinding(PARAMS, 'jumpSpeed', { label: 'Jump Speed', step: 1, min: 0, max: 40 }).on('change', event => { mover.m_jumpSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'minSpeed', { label: 'Min Speed', step: 0.01, min: 0, max: 1 }).on('change', event => { mover.m_minSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'maxSpeed', { label: 'Max Speed', step: 1, min: 0, max: 20 }).on('change', event => { mover.m_maxSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'stopSpeed', { label: 'Stop Speed', step: 0.1, min: 0, max: 10 }).on('change', event => { mover.m_stopSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'accelerate', { label: 'Accelerate', step: 1, min: 0, max: 100 }).on('change', event => { mover.m_accelerate = event.value; });
		this.pane.addBinding(PARAMS, 'friction', { label: 'Friction', step: 0.1, min: 0, max: 10 }).on('change', event => { mover.m_friction = event.value; });
		this.pane.addBinding(PARAMS, 'gravityScale', { label: 'Gravity Scale', step: 0.1, min: 0, max: 4 }).on('change', event => { mover.SetGravityScale(event.value); });
		this.pane.addBinding(PARAMS, 'airSteer', { label: 'Air Steer', step: 0.01, min: 0, max: 1 }).on('change', event => { mover.m_airSteer = event.value; });
		this.pane.addBinding(PARAMS, 'pogoHertz', { label: 'Pogo Hertz', step: 1, min: 0, max: 30 }).on('change', event => { mover.m_pogoHertz = event.value; });
		this.pane.addBinding(PARAMS, 'pogoDamping', { label: 'Pogo Damping', step: 0.1, min: 0, max: 4 }).on('change', event => { mover.m_pogoDampingRatio = event.value; });

		this.pane.addBlade({ view: 'separator' });

		this.pane.addBinding(PARAMS, 'lockCamera', { label: 'Lock Camera' }).on('change', event => { this.m_lockCamera = event.value; });
	}

	UpdateUI(DrawString, m_textLine) {
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const mover = this.m_mover;
		const position = this.m_position;
		const normalY = mover.m_castResult.hit ? mover.m_castResult.normal.y : 0.0;

		m_textLine = DrawString(5, m_textLine, "left/right/jump = A/D/Space");
		m_textLine = DrawString(5, m_textLine, `position ${position.x.toFixed(2)} ${position.y.toFixed(2)}`);
		m_textLine = DrawString(5, m_textLine, `velocity ${mover.m_velocity.x.toFixed(2)} ${mover.m_velocity.y.toFixed(2)}`);
		m_textLine = DrawString(5, m_textLine, `pogo: impulse ${mover.m_pogoImpulse.toFixed(3)}, velocity ${mover.m_pogoVelocity.toFixed(3)}`);
		m_textLine = DrawString(5, m_textLine, `pogo: length = ${mover.m_pogoLength.toFixed(2)}/${mover.m_pogoRestLength.toFixed(2)}`);
		m_textLine = DrawString(5, m_textLine, `on ground: ${mover.m_onGround ? 1 : 0}`);
		m_textLine = DrawString(5, m_textLine, `walkable: ${mover.m_walkable ? 1 : 0}, normal y: ${normalY.toFixed(3)}/${mover.m_minGroundNormalY.toFixed(3)}`);
		m_textLine = DrawString(5, m_textLine, `jumping/ticks: ${mover.m_jumping ? 1 : 0}/${mover.m_jumpTicks}`);

		return m_textLine;
	}

	Destroy() {
		Keyboard.HideTouchControls();

		// Destroys the mover bodies while the world is still alive and frees the mover's embind objects
		this.m_mover.Destroy();

		super.Destroy();

		this.m_elevatorTransform.delete();

		// The world is gone, so the callbacks can no longer be called
		if (this.m_preSolveCallback !== null) {
			this.box2d.b2World_DeleteCallback(this.m_preSolveCallback);
			this.m_preSolveCallback = null;
		}

		if (this.pane) {
			this.pane.dispose();
			this.pane = null;
		}
	}
}
