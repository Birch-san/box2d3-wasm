import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import b2HexColor from '../../b2HexColor.mjs';

import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import settings from '../../settings.mjs';

const ShapeUserData = function () {
	this.maxPush = 0;
	this.clipVelocity = false;
};

const CollisionBits = {
	StaticBit: 0x0001,
	MoverBit: 0x0002,
	DynamicBit: 0x0004,
	DebrisBit: 0x0008,
	AllBits: '4294967295', // c: ~0u
};

const PogoShape =
{
	PogoPoint: 0,
	PogoCircle: 1,
	PogoSegment: 2,
};

const g_userdata = {};

export default class Mover extends Sample {
	constructor(box2d, camera, debugDraw) {
		super(box2d, camera, debugDraw);

		camera.center = { x: 20.0, y: 9.0 };
		camera.zoom = 10.0;

		settings.drawJoints = false;

		const {
			b2Transform,
			b2Vec2,
			b2Capsule,
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultChainDef,
			b2DefaultShapeDef,
			b2DefaultRevoluteJointDef,
			b2MakeBox,
			b2BodyType,
			b2CreatePolygonShape,
			b2Body_GetLocalPoint,
			b2CreateRevoluteJoint,
			b2CreateCapsuleShape,
			b2Circle,
			b2CreateChain,
			b2CreateCircleShape,
			b2Body_GetPointer
		} = this.box2d;

		this.m_transform = new b2Transform();
		this.m_transform.p.Set(2.0, 8.0);
		this.m_transform.q.SetAngle(0.0);
		this.m_velocity = new b2Vec2();
		this.m_capsule = new b2Capsule();
		this.m_capsule.center1.Set(0.0, -0.5);
		this.m_capsule.center2.Set(0.0, 0.5);
		this.m_capsule.radius = 0.3;

		this.m_planeCapacity = 8;
		this.m_elevatorBase = new b2Vec2(112.0, 10.0);
		this.m_elevatorAmplitude = 4.0;

		this.m_jumpSpeed = 10.0;
		this.m_maxSpeed = 6.0;
		this.m_minSpeed = 0.1;
		this.m_stopSpeed = 3.0;
		this.m_accelerate = 20.0;
		this.m_airSteer = 0.2;
		this.m_friction = 8.0;
		this.m_gravity = 30.0;
		this.m_pogoHertz = 5.0;
		this.m_pogoDampingRatio = 0.8;

		this.m_pogoShape = PogoShape.PogoSegment;

		this.m_elevatorId;
		this.m_ballId;
		this.m_friendlyShape = new ShapeUserData();
		this.m_elevatorShape = new ShapeUserData();
		this.m_planes = [];
		this.m_planeCount = 0;
		this.m_totalIterations = 0;
		this.m_pogoVelocity = 0;
		this.m_time = 0.0;
		this.m_onGround = false;
		this.m_jumpReleased = false;
		this.m_lockCamera = false;

		this.groundId1 = null;
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(0.0, 0.0);
			this.groundId1 = b2CreateBody(this.m_worldId, bodyDef);

			const path =
				"M 2.6458333,201.08333 H 293.68751 v -47.625 h -2.64584 l -10.58333,7.9375 -13.22916,7.9375 -13.24648,5.29167 " +
				"-31.73269,7.9375 -21.16667,2.64583 -23.8125,10.58333 H 142.875 v -5.29167 h -5.29166 v 5.29167 H 119.0625 v " +
				"-2.64583 h -2.64583 v -2.64584 h -2.64584 v -2.64583 H 111.125 v -2.64583 H 84.666668 v -2.64583 h -5.291666 v " +
				"-2.64584 h -5.291667 v -2.64583 H 68.791668 V 174.625 h -5.291666 v -2.64584 H 52.916669 L 39.6875,177.27083 H " +
				"34.395833 L 23.8125,185.20833 H 15.875 L 5.2916669,187.85416 V 153.45833 H 2.6458333 v 47.625";


			const offset = new b2Vec2(-50.0, -200.0);
			const scale = 0.2;

			const points = ParsePath(path, offset, scale, false);

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints(points);
			chainDef.isLoop = true;

			b2CreateChain(this.groundId1, chainDef);

			bodyDef.delete();
			chainDef.delete();
			offset.delete();
		}

		this.groundId2 = null;
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(98.0, 0.0);
			this.groundId2 = b2CreateBody(this.m_worldId, bodyDef);

			const path =
				"M 2.6458333,201.08333 H 293.68751 l 0,-23.8125 h -23.8125 l 21.16667,21.16667 h -23.8125 l -39.68751,-13.22917 " +
				"-26.45833,7.9375 -23.8125,2.64583 h -13.22917 l -0.0575,2.64584 h -5.29166 v -2.64583 l -7.86855,-1e-5 " +
				"-0.0114,-2.64583 h -2.64583 l -2.64583,2.64584 h -7.9375 l -2.64584,2.64583 -2.58891,-2.64584 h -13.28609 v " +
				"-2.64583 h -2.64583 v -2.64584 l -5.29167,1e-5 v -2.64583 h -2.64583 v -2.64583 l -5.29167,-1e-5 v -2.64583 h " +
				"-2.64583 v -2.64584 h -5.291667 v -2.64583 H 92.60417 V 174.625 h -5.291667 v -2.64584 l -34.395835,1e-5 " +
				"-7.9375,-2.64584 -7.9375,-2.64583 -5.291667,-5.29167 H 21.166667 L 13.229167,158.75 5.2916668,153.45833 H " +
				"2.6458334 l -10e-8,47.625";


			const offset = new b2Vec2(0.0, -200.0);
			const scale = 0.2;

			const points = ParsePath(path, offset, scale, false);

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints(points);
			chainDef.isLoop = true;

			b2CreateChain(this.groundId2, chainDef);

			bodyDef.delete();
			chainDef.delete();
			offset.delete();
		}

		{
			const box = b2MakeBox(0.5, 0.125);

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
			let prevBodyId = this.groundId1;
			for (let i = 0; i < count; ++i) {
				const bodyDef = b2DefaultBodyDef();
				bodyDef.type = b2BodyType.b2_dynamicBody;
				bodyDef.position.Set(xBase + 0.5 + 1.0 * i, yBase);
				bodyDef.angularDamping = 0.2;
				const bodyId = b2CreateBody(this.m_worldId, bodyDef);
				b2CreatePolygonShape(bodyId, shapeDef, box);

				const pivot = new b2Vec2(xBase + 1.0 * i, yBase);
				jointDef.bodyIdA = prevBodyId;
				jointDef.bodyIdB = bodyId;

				let lp = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
				jointDef.localAnchorA.Copy(lp);
				lp.delete();
				lp = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
				jointDef.localAnchorB.Copy(lp);
				lp.delete();
				b2CreateRevoluteJoint(this.m_worldId, jointDef);

				prevBodyId = bodyId;

				bodyDef.delete();
				pivot.delete();
			}

			const pivot = new b2Vec2(xBase + 1.0 * count, yBase);
			jointDef.bodyIdA = prevBodyId;
			jointDef.bodyIdB = this.groundId2;
			let lp = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
			jointDef.localAnchorA.Copy(lp);
			lp.delete();
			lp = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
			jointDef.localAnchorB.Copy(lp);
			lp.delete();
			b2CreateRevoluteJoint(this.m_worldId, jointDef);

			box.delete();
			shapeDef.delete();
			jointDef.delete();
			pivot.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(32.0, 4.5);

			const shapeDef = b2DefaultShapeDef();
			this.m_friendlyShape.maxPush = 0.025;
			this.m_friendlyShape.clipVelocity = false;

			shapeDef.filter.categoryBits = CollisionBits.MoverBit;
			shapeDef.filter.setMaskBits64(CollisionBits.AllBits);
			const bodyId = b2CreateBody(this.m_worldId, bodyDef);
			const shapeId = b2CreateCapsuleShape(bodyId, shapeDef, this.m_capsule);

			// this is how we set user data on a shapeId
			const shapePointer = b2Body_GetPointer(shapeId);
			g_userdata[shapePointer] = this.m_friendlyShape;

			bodyDef.delete();
			shapeDef.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Set(7.0, 7.0);
			const bodyId = b2CreateBody(this.m_worldId, bodyDef);

			const shapeDef = b2DefaultShapeDef();
			shapeDef.filter.categoryBits = CollisionBits.DebrisBit;
			shapeDef.filter.setMaskBits64(CollisionBits.AllBits);
			shapeDef.material.restitution = 0.7;
			shapeDef.material.rollingResistance = 0.2;

			const circle = new b2Circle();
			circle.radius = 0.3;
			this.m_ballId = b2CreateCircleShape(bodyId, shapeDef, circle);

			bodyDef.delete();
			shapeDef.delete();
			circle.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_kinematicBody;
			bodyDef.position.Set(this.m_elevatorBase.x, this.m_elevatorBase.y - this.m_elevatorAmplitude);
			this.m_elevatorId = b2CreateBody(this.m_worldId, bodyDef);

			this.m_elevatorShape = new ShapeUserData();
			this.m_elevatorShape.maxPush = 0.1;
			this.m_elevatorShape.clipVelocity = true;

			const shapeDef = b2DefaultShapeDef();
			shapeDef.filter.categoryBits = CollisionBits.DynamicBit;
			shapeDef.filter.setMaskBits64(CollisionBits.AllBits);

			const box = b2MakeBox(2.0, 0.1);
			const shapeId = b2CreatePolygonShape(this.m_elevatorId, shapeDef, box);

			const shapePointer = b2Body_GetPointer(shapeId);
			g_userdata[shapePointer] = this.m_elevatorShape;

			bodyDef.delete();
			shapeDef.delete();
			box.delete();
		}

		this.m_totalIterations = 0;
		this.m_pogoVelocity = 0.0;
		this.m_onGround = false;
		this.m_jumpReleased = true;
		this.m_lockCamera = true;
		this.m_planeCount = 0;
		this.m_time = 0.0;

		this.CreateUI();
	}

	// https://github.com/id-Software/Quake/blob/master/QW/client/pmove.c#L390
	SolveMove(timeStep, throttle) {
		const {
			b2Vec2,
			b2Circle,
			b2Length,
			b2TransformPoint,
			b2MaxFloat,
			b2Dot,
			b2Segment,
			b2QueryFilter,
			b2World_CastShape,
			B2_PI,
			b2Body_ApplyForce,
			b2World_CollideMover,
			b2LengthSquared,
			b2Normalize,
			b2MakeProxy,
			b2Capsule,
			b2SolvePlanes,
			b2World_CastMover,
			b2ClipVector
		} = this.box2d;

		// Friction
		const speed = b2Length(this.m_velocity);
		if (speed < this.m_minSpeed) {
			this.m_velocity.Set(0, 0);
		}
		else if (this.m_onGround) {
			// Linear damping above stopSpeed and fixed reduction below stopSpeed
			const control = speed < this.m_stopSpeed ? this.m_stopSpeed : speed;

			// friction has units of 1/time
			const drop = control * this.m_friction * timeStep;
			const newSpeed = b2MaxFloat(0.0, speed - drop);
			this.m_velocity.MulSV(newSpeed / speed);
		}

		const desiredVelocity = new b2Vec2(this.m_maxSpeed * throttle, 0.0);
		let desiredSpeed = b2Length(desiredVelocity);
		const desiredDirection = b2Normalize(desiredVelocity);

		if (desiredSpeed > this.m_maxSpeed) {
			desiredSpeed = this.m_maxSpeed;
		}

		if (this.m_onGround) {
			this.m_velocity.Set(this.m_velocity.x, 0.0);
		}

		// Accelerate
		const currentSpeed = b2Dot(this.m_velocity, desiredDirection);
		const addSpeed = desiredSpeed - currentSpeed;
		if (addSpeed > 0.0) {
			const steer = this.m_onGround ? 1.0 : this.m_airSteer;
			let accelSpeed = steer * this.m_accelerate * this.m_maxSpeed * timeStep;
			if (accelSpeed > addSpeed) {
				accelSpeed = addSpeed;
			}

			const velocityAdd = desiredDirection.Clone().MulSV(accelSpeed);
			this.m_velocity.Add(velocityAdd);
			velocityAdd.delete();
		}


		this.m_velocity.Set(this.m_velocity.x, this.m_velocity.y - this.m_gravity * timeStep);

		const pogoRestLength = 3.0 * this.m_capsule.radius;
		const rayLength = pogoRestLength + this.m_capsule.radius;
		const origin = b2TransformPoint(this.m_transform, this.m_capsule.center1);
		const circle = new b2Circle();
		circle.center = origin;
		circle.radius = 0.5 * this.m_capsule.radius;
		const segmentOffset = new b2Vec2(0.75 * this.m_capsule.radius, 0.0);

		const segment = new b2Segment();
		segment.point1.Set(origin.x - segmentOffset.x, origin.y - segmentOffset.y);
		segment.point2.Set(origin.x + segmentOffset.x, origin.y + segmentOffset.y);

		let proxy;
		const translation = new b2Vec2();
		const pogoFilter = new b2QueryFilter();
		pogoFilter.categoryBits = CollisionBits.MoverBit;
		pogoFilter.maskBits = CollisionBits.StaticBit | CollisionBits.DynamicBit;

		const castResult = {
			hit: false,
		};


		if (this.m_pogoShape == PogoShape.PogoPoint) {
			proxy = b2MakeProxy(origin, 1, 0.0);
			translation.Set(0.0, -rayLength);
		}
		else if (this.m_pogoShape == PogoShape.PogoCircle) {
			proxy = b2MakeProxy(origin, 1, circle.radius);
			translation.Set(0.0, -rayLength + circle.radius);
		}
		else {
			proxy = b2MakeProxy(segment.point1, 2, 0.0);
			translation.Set(0.0, -rayLength);
		}



		b2World_CastShape(this.m_worldId, proxy, translation, pogoFilter, (rayCallbackResult) => this.CastCallback(rayCallbackResult, castResult));

		// Avoid snapping to ground if still going up
		if (this.m_onGround == false) {
			this.m_onGround = castResult.hit && this.m_velocity.y <= 0.01;
		}
		else {
			this.m_onGround = castResult.hit;
		}

		if (castResult.hit == false) {
			this.m_pogoVelocity = 0.0;

			const delta = translation;

			this.debugDraw.drawSegment({
				data: [
					origin.x,
					origin.y,
					origin.x + delta.x,
					origin.y + delta.y,
				],
				color: b2HexColor.b2_colorGray
			});

			if (this.m_pogoShape == PogoShape.PogoPoint) {
				this.debugDraw.drawPoint({
					data: [
						origin.x + delta.x,
						origin.y + delta.y,
						10.0,
					],
					color: b2HexColor.b2_colorGray
				});
			}
			else if (this.m_pogoShape == PogoShape.PogoCircle) {
				this.debugDraw.drawCircle({
					data: [
						origin.x + delta.x,
						origin.y + delta.y,
						circle.radius,
					],
					color: b2HexColor.b2_colorGray
				});
			}
			else {
				this.debugDraw.drawSegment({
					data: [
						segment.point1.x + delta.x,
						segment.point1.y + delta.y,
						segment.point2.x + delta.x,
						segment.point2.y + delta.y,
					],
					color: b2HexColor.b2_colorGray
				});
			}
		}
		else {
			const pogoCurrentLength = castResult.fraction * rayLength;

			const zeta = this.m_pogoDampingRatio;
			const hertz = this.m_pogoHertz;
			const omega = 2.0 * B2_PI * hertz;
			const omegaH = omega * timeStep;

			this.m_pogoVelocity = (this.m_pogoVelocity - omega * omegaH * (pogoCurrentLength - pogoRestLength)) /
				(1.0 + 2.0 * zeta * omegaH + omegaH * omegaH);

			const delta = new b2Vec2().Copy(translation).MulSV(castResult.fraction);
			this.debugDraw.drawSegment({
				data: [
					origin.x,
					origin.y,
					origin.x + delta.x,
					origin.y + delta.y,
				],
				color: b2HexColor.b2_colorGray
			});

			if (this.m_pogoShape == PogoShape.PogoPoint) {
				this.debugDraw.drawPoint({
					data: [
						origin.x + delta.x,
						origin.y + delta.y,
						10.0,
					],
					color: b2HexColor.b2_colorPlum
				});
			}
			else if (this.m_pogoShape == PogoShape.PogoCircle) {
				this.debugDraw.drawCircle({
					data: [
						origin.x + delta.x,
						origin.y + delta.y,
						circle.radius,
					],
					color: b2HexColor.b2_colorPlum
				});
			}
			else {
				this.debugDraw.drawSegment({
					data: [
						segment.point1.x + delta.x,
						segment.point1.y + delta.y,
						segment.point2.x + delta.x,
						segment.point2.y + delta.y,
					],
					color: b2HexColor.b2_colorPlum
				});
			}

			const force = new b2Vec2(0.0, -50.0);

			const point = new b2Vec2(castResult.point.x, castResult.point.y);

			b2Body_ApplyForce(castResult.bodyId, force, point, true);

			delta.delete();
			force.delete();
			point.delete();
		}

		const velocityAdd = new b2Vec2().Copy(this.m_velocity).MulSV(timeStep);
		const pogoVelocityAdd = new b2Vec2(0.0, 1.0).MulSV(timeStep * this.m_pogoVelocity);
		const target = new b2Vec2().Copy(this.m_transform.p).Add(velocityAdd).Add(pogoVelocityAdd);

		// Mover overlap filter
		const collideFilter = new b2QueryFilter();
		collideFilter.categoryBits = CollisionBits.MoverBit;
		collideFilter.maskBits = CollisionBits.StaticBit | CollisionBits.DynamicBit | CollisionBits.MoverBit;

		// Movers don't sweep against other movers, allows for soft collision
		const castFilter = new b2QueryFilter();
		castFilter.categoryBits = CollisionBits.MoverBit;
		castFilter.maskBits = CollisionBits.StaticBit | CollisionBits.DynamicBit;

		this.m_totalIterations = 0;
		const tolerance = 0.01;

		for (let iteration = 0; iteration < 5; ++iteration) {
			this.m_planeCount = 0;
			this.m_planes.forEach((plane) => plane.delete());
			this.m_planes.length = 0;

			const mover = new b2Capsule();

			let tp = b2TransformPoint(this.m_transform, this.m_capsule.center1);
			mover.center1.Copy(tp);
			tp.delete();
			tp = b2TransformPoint(this.m_transform, this.m_capsule.center2)
			mover.center2.Copy(tp);
			tp.delete();
			mover.radius = this.m_capsule.radius;

			b2World_CollideMover(this.m_worldId, mover, collideFilter, (shape, result) => this.PlaneResultFcn(shape, result));
			const result = b2SolvePlanes(target, this.m_planes);

			this.m_totalIterations += result.iterationCount;

			const moverTranslation = new b2Vec2().Copy(result.position).Sub(this.m_transform.p);

			const fraction = b2World_CastMover(this.m_worldId, mover, moverTranslation, castFilter);

			const delta = new b2Vec2().Copy(moverTranslation).MulSV(fraction);
			this.m_transform.p.Add(delta);

			mover.delete();
			moverTranslation.delete();
			result.delete();

			const ls = b2LengthSquared(delta);
			delta.delete();
			if (ls < tolerance * tolerance) {
				break;
			}
		}

		const cv = b2ClipVector(this.m_velocity, this.m_planes);
		this.m_velocity.Copy(cv);

		desiredVelocity.delete();
		desiredDirection.delete();
		origin.delete();
		circle.delete();
		segmentOffset.delete();
		segment.delete();
		translation.delete();
		pogoFilter.delete();
		proxy.delete();
		velocityAdd.delete();
		pogoVelocityAdd.delete();
		target.delete();
		collideFilter.delete();
		castFilter.delete();
		cv.delete();
	}

	CastCallback(rayCallbackResult, context) {
		const { point, fraction } = rayCallbackResult;

		const result = context;
		result.point = { x: point.x, y: point.y };
		result.fraction = fraction;
		result.bodyId = this.box2d.b2Shape_GetBody(rayCallbackResult.shapeId);
		result.hit = true;

		rayCallbackResult.delete();

		return fraction;
	}

	PlaneResultFcn(shapeId, planeResult) {
		const { b2IsValidPlane, b2CollisionPlane, b2Body_GetPointer } = this.box2d;

		console.assert(planeResult.hit == true);

		let maxPush = Number.MAX_VALUE;
		let clipVelocity = true;

		const shapePointer = b2Body_GetPointer(shapeId);
		const userData = g_userdata[shapePointer];
		if (userData != null) {
			maxPush = userData.maxPush;
			clipVelocity = userData.clipVelocity;
		}

		if (this.m_planeCount < this.m_planeCapacity) {
			console.assert(b2IsValidPlane(planeResult.plane));

			const collisionPlane = new b2CollisionPlane();
			collisionPlane.plane.offset = planeResult.plane.offset;
			collisionPlane.plane.normal.Copy(planeResult.plane.normal);
			collisionPlane.pushLimit = maxPush;
			collisionPlane.push = 0.0;
			collisionPlane.clipVelocity = clipVelocity;

			this.m_planes[this.m_planeCount] = collisionPlane;
			this.m_planeCount += 1;
		}

		return true;
	}

	Kick(overlapResult) {
		const {
			b2Shape_GetBody,
			b2Body_GetType,
			b2BodyType,
			b2Body_GetWorldCenterOfMass,
			b2Normalize,
			b2Body_ApplyLinearImpulseToCenter,
			b2Vec2
		} = this.box2d;

		const { shapeId } = overlapResult;

		const bodyId = b2Shape_GetBody(shapeId);
		const type = b2Body_GetType(bodyId);

		if (type != b2BodyType.b2_dynamicBody) {
			return true;
		}

		const center = b2Body_GetWorldCenterOfMass(bodyId);

		const normalizedCenter = new b2Vec2().Copy(center).Sub(this.m_transform.p);
		const direction = b2Normalize(normalizedCenter);
		const impulse = new b2Vec2(2.0 * direction.x, 2.0);
		b2Body_ApplyLinearImpulseToCenter(bodyId, impulse, true);

		normalizedCenter.delete();
		direction.delete();
		impulse.delete();
		center.delete();

		return true;
	}

	Keyboard() {
		const {
			b2Vec2,
			b2TransformPoint,
			b2MakeProxy,
			b2QueryFilter,
			b2World_OverlapShape,
			b2Circle
		} = this.box2d;
		if (Keyboard.IsPressed(Key.K)) {
			const offset = new b2Vec2(0.0, this.m_capsule.center1.y - 3.0 * this.m_capsule.radius);
			const point = b2TransformPoint(this.m_transform, offset);

			const circle = new b2Circle();
			circle.center = point;
			circle.radius = 0.5;

			const proxy = b2MakeProxy(circle.center, 1, circle.radius);
			const filter = new b2QueryFilter();
			filter.categoryBits = CollisionBits.MoverBit;
			filter.maskBits = CollisionBits.DebrisBit;

			b2World_OverlapShape(this.m_worldId, proxy, filter, (overlapResult) => this.Kick(overlapResult));

			this.debugDraw.drawCircle({
				data: [
					circle.center.x,
					circle.center.y,
					circle.radius,
				],
				color: b2HexColor.b2_colorGoldenRod
			});

			offset.delete();
			point.delete();
			circle.delete();
			proxy.delete();
			filter.delete();
		}
	}


	Despawn() {
		this.m_transform.delete();
		this.m_velocity.delete();
		this.m_capsule.delete();
		this.m_elevatorBase.delete();
		this.m_planes.forEach((plane) => plane.delete());
		this.m_planes.length = 0;
	}

	Step() {
		const {
			B2_PI,
			b2Body_SetTargetTransform,
			b2Vec2,
			b2TransformPoint,
			b2Transform
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
			const point = new b2Vec2(
				this.m_elevatorBase.x,
				this.m_elevatorAmplitude * Math.cos(1.0 * this.m_time + B2_PI) + this.m_elevatorBase.y,
			);

			const transform = new b2Transform();
			transform.p.Copy(point);

			b2Body_SetTargetTransform(this.m_elevatorId, transform, timeStep);

			point.delete();
			transform.delete();
		}

		this.m_time += timeStep;

		super.Step();

		this.debugDraw.prepareCanvas();

		this.Keyboard();

		if (pause == false) {
			let throttle = 0.0;

			if (Keyboard.IsDown(Key.A)) {
				throttle -= 1.0;
			}

			if (Keyboard.IsDown(Key.D)) {
				throttle += 1.0;
			}

			if (Keyboard.IsDown(Key.Space)) {
				if (this.m_onGround == true && this.m_jumpReleased) {
					this.m_velocity.Set(this.m_velocity.x, this.m_jumpSpeed);
					this.m_onGround = false;
					this.m_jumpReleased = false;
				}
			}
			else {
				this.m_jumpReleased = true;
			}

			this.SolveMove(timeStep, throttle);
		}

		let count = this.m_planeCount;
		for (let i = 0; i < count; ++i) {
			const plane = this.m_planes[i].plane;
			const p1 = new b2Vec2().Copy(plane.normal).MulSV(plane.offset - this.m_capsule.radius).Add(this.m_transform.p);
			const p2 = new b2Vec2().Copy(plane.normal).MulSV(0.1).Add(p1);

			this.debugDraw.drawPoint({
				data: [
					p1.x,
					p1.y,
					5.0,
				],
				color: b2HexColor.b2_colorYellow
			});

			this.debugDraw.drawSegment({
				data: [
					p1.x,
					p1.y,
					p2.x,
					p2.y,
				],
				color: b2HexColor.b2_colorYellow
			});

			p1.delete();
			p2.delete();
		}

		const p1 = b2TransformPoint(this.m_transform, this.m_capsule.center1);
		const p2 = b2TransformPoint(this.m_transform, this.m_capsule.center2);

		const color = this.m_onGround ? b2HexColor.b2_colorOrange : b2HexColor.b2_colorAquamarine;
		this.debugDraw.drawSolidCapsule({
			data: [
				p1.x,
				p1.y,
				p2.x,
				p2.y,
				this.m_capsule.radius,
			],
			color
		});

		this.debugDraw.drawSegment({
			data: [
				this.m_transform.p.x,
				this.m_transform.p.y,
				this.m_transform.p.x + this.m_velocity.x,
				this.m_transform.p.y + this.m_velocity.y,
			],
			color: b2HexColor.b2_colorPurple
		});

		p1.delete();
		p2.delete();

		if (this.m_lockCamera) {
			this.camera.center.x = this.m_transform.p.x;
		}
		this.debugDraw.restoreCanvas();

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

			if (this.m_touchKeyboard){
				Keyboard.ShowTouchControls([Key.A, Key.D, Key.Space, Key.K]);
			} else {
				Keyboard.HideTouchControls();
			}

			this.CreateUI();
		});

		const PARAMS = {
			jumpSpeed: this.m_jumpSpeed,
			minSpeed: this.m_minSpeed,
			maxSpeed: this.m_maxSpeed,
			stopSpeed: this.m_stopSpeed,
			accelerate: this.m_accelerate,
			friction: this.m_friction,
			gravity: this.m_gravity,
			airSteer: this.m_airSteer,
			pogoHertz: this.m_pogoHertz,
			pogoDamping: this.m_pogoDampingRatio,
			pogoShape: this.m_pogoShape,
			lockCamera: this.m_lockCamera,
		};

		this.pane.addBinding(PARAMS, 'jumpSpeed', { step: 0.1, min: 0, max: 40 }).on('change', event => { this.m_jumpSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'minSpeed', { step: 0.1, min: 0, max: 1 }).on('change', event => { this.m_minSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'maxSpeed', { step: 0.1, min: 0, max: 20 }).on('change', event => { this.m_maxSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'stopSpeed', { step: 0.1, min: 0, max: 10 }).on('change', event => { this.m_stopSpeed = event.value; });
		this.pane.addBinding(PARAMS, 'accelerate', { step: 0.1, min: 0, max: 100 }).on('change', event => { this.m_accelerate = event.value; });
		this.pane.addBinding(PARAMS, 'friction', { step: 0.1, min: 0, max: 10 }).on('change', event => { this.m_friction = event.value; });
		this.pane.addBinding(PARAMS, 'gravity', { step: 0.1, min: 0, max: 100 }).on('change', event => { this.m_gravity = event.value; });
		this.pane.addBinding(PARAMS, 'airSteer', { step: 0.1, min: 0, max: 1 }).on('change', event => { this.m_airSteer = event.value; });
		this.pane.addBinding(PARAMS, 'pogoHertz', { step: 0.1, min: 0, max: 30 }).on('change', event => { this.m_pogoHertz = event.value; });
		this.pane.addBinding(PARAMS, 'pogoDamping', { step: 0.1, min: 0, max: 4 }).on('change', event => { this.m_pogoDampingRatio = event.value; });

		this.pane.addBinding(PARAMS, 'pogoShape', {
			options: {
				point: PogoShape.PogoPoint,
				circle: PogoShape.PogoCircle,
				segment: PogoShape.PogoSegment,
			},
		}).on('change', (event) => {
			this.m_pogoShape = event.value;
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'lockCamera').on('change', (event) => {
			this.m_lockCamera = event.value;
			this.Spawn();
		});

		super.CreateUI();
	}

	UpdateUI(DrawString, m_textLine) {
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const p = this.m_transform.p;
		m_textLine = DrawString(5, m_textLine, `position ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
		m_textLine = DrawString(5, m_textLine, `velocity ${this.m_velocity.x.toFixed(2)} ${this.m_velocity.y.toFixed(2)}`);
		m_textLine = DrawString(5, m_textLine, `iterations ${this.m_totalIterations}`);
	}

	Destroy() {
		this.Despawn();
		super.Destroy();

		if (this.pane) {
			this.pane.dispose();
			this.pane = null;
		}
	}
}

function ParsePath(svgPath, offset = { x: 0, y: 0 }, scale = 1, reverseOrder = false) {
	const points = [];
	let currentPoint = { x: 0, y: 0 };
	let ptr = 0;
	let command = svgPath[ptr];

	function skipWhitespace() {
		while (ptr < svgPath.length && /\s/.test(svgPath[ptr])) {
			ptr++;
		}
	}

	while (ptr < svgPath.length) {
		if (!(/[0-9\-]/.test(svgPath[ptr]))) {
			command = svgPath[ptr];
			if ("MLHVmlhv".includes(command)) {
				ptr += 1;
				skipWhitespace();
			} else if (command === 'z' || command === 'Z') {
				break;
			}
		}

		let x = 0, y = 0;

		function parseNumber() {
			let start = ptr;
			while (ptr < svgPath.length && /[-0-9.eE]/.test(svgPath[ptr])) {
				ptr++;
			}
			return parseFloat(svgPath.slice(start, ptr));
		}

		switch (command) {
			case 'M':
			case 'L':
				x = parseNumber();
				if (svgPath[ptr] === ',') ptr++;
				y = parseNumber();
				currentPoint = { x, y };
				break;
			case 'H':
				x = parseNumber();
				currentPoint.x = x;
				break;
			case 'V':
				y = parseNumber();
				currentPoint.y = y;
				break;
			case 'm':
			case 'l':
				x = parseNumber();
				if (svgPath[ptr] === ',') ptr++;
				y = parseNumber();
				currentPoint.x += x;
				currentPoint.y += y;
				break;
			case 'h':
				x = parseNumber();
				currentPoint.x += x;
				break;
			case 'v':
				y = parseNumber();
				currentPoint.y += y;
				break;
			default:
				// skip unknown command
				ptr++;
				continue;
		}

		points.push({
			x: scale * (currentPoint.x + offset.x),
			y: -scale * (currentPoint.y + offset.y)
		});

		skipWhitespace();
	}

	if (reverseOrder) {
		points.reverse();
	}

	return points;
}
