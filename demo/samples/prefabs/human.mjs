import b2HexColor from '../b2HexColor.mjs';


const boneId_hip = 0;
const boneId_torso = 1;
const boneId_head = 2;
const boneId_upperLeftLeg = 3;
const boneId_lowerLeftLeg = 4;
const boneId_upperRightLeg = 5;
const boneId_lowerRightLeg = 6;
const boneId_upperLeftArm = 7;
const boneId_lowerLeftArm = 8;
const boneId_upperRightArm = 9;
const boneId_lowerRightArm = 10;
const boneId_count = 11;

const human_userData = {};

class Human {
	constructor(box2d) {
		this.box2d = box2d;
		this.bones = [];
		this.scale = 1.0;
		this.isSpawned = false;
	}

	Despawn()
	{
		console.assert( this.isSpawned == true );

		for ( let i = 0; i < boneId_count; ++i )
		{
			if (this.bones[i].jointId){
				this.box2d.b2DestroyJoint( this.bones[i].jointId, false );
			}
		}
		for ( let i = 0; i < boneId_count; ++i )
		{
			if (this.bones[i].bodyId){
				const bodyPointer = this.box2d.b2Body_GetPointer( this.bones[i].bodyId );
				delete human_userData[bodyPointer];
				this.box2d.b2DestroyBody( this.bones[i].bodyId );
			}
		}
		this.bones.length = 0;

		this.isSpawned = false;
	}

	SetVelocity(velocity )
	{
		for ( let i = 0; i < boneId_count; ++i )
		{
			const bodyId = this.bones[i].bodyId;

			this.box2d.b2Body_SetLinearVelocity( bodyId, velocity );
		}
	}

	ApplyRandomAngularImpulse(magnitude )
	{
		console.assert( this.isSpawned == true );
		const impulse = this.box2d.RandomFloatRange( -magnitude, magnitude );
		this.box2d.b2Body_ApplyAngularImpulse( this.bones[boneId_torso].bodyId, impulse, true );
	}

	SetJointFrictionTorque(torque)
	{
		console.assert( this.isSpawned == true );
		if ( torque == 0.0 )
		{
			for ( let i = 1; i < boneId_count; ++i )
			{
				this.box2d.b2RevoluteJoint_EnableMotor( this.bones[i].jointId, false );
			}
		}
		else
		{
			for ( let i = 1; i < boneId_count; ++i )
			{
				this.box2d.b2RevoluteJoint_EnableMotor( this.bones[i].jointId, true );
				const scale = this.scale * this.bones[i].frictionScale;
				this.box2d.b2RevoluteJoint_SetMaxMotorTorque( this.bones[i].jointId, scale * torque );
			}
		}
	}

	SetJointSpringHertz(hertz)
	{
		console.assert( this.isSpawned == true );
		if ( hertz == 0.0 )
		{
			for ( let i = 1; i < boneId_count; ++i )
			{
				this.box2d.b2RevoluteJoint_EnableSpring( this.bones[i].jointId, false );
			}
		}
		else
		{
			for ( let i = 1; i < boneId_count; ++i )
			{
				this.box2d.b2RevoluteJoint_EnableSpring( this.bones[i].jointId, true );
				this.box2d.b2RevoluteJoint_SetSpringHertz( this.bones[i].jointId, hertz );
			}
		}
	}

	SetJointDampingRatio(dampingRatio)
	{
		console.assert( this.isSpawned == true );

		for ( let i = 1; i < boneId_count; ++i )
		{
			this.box2d.b2RevoluteJoint_SetSpringDampingRatio( this.bones[i].jointId, dampingRatio );
		}
	}

	EnableSensorEvents(enable)
	{
		console.assert( this.isSpawned == true );
		const bodyId = this.bones[boneId_torso].bodyId;

		const shapes = this.box2d.b2Body_GetShapes( bodyId,  1);
		const count = shapes.length;
		if ( count == 1 )
		{
			this.box2d.b2Shape_EnableSensorEvents( shapes[0], enable );
		}
	}

}

class Bone {
	constructor() {
		this.bodyId;
		this.jointId;
		this.frictionScale;
		this.parentIndex;
	}
}

export default function CreateHuman(box2d, worldId, position, scale, frictionTorque, hertz, dampingRatio, groupIndex, userData, colorize )
{
	const {
		b2DefaultBodyDef,
		b2BodyType,
		b2DefaultShapeDef,
		b2CreateBody,
		b2Capsule,
		b2CreateCapsuleShape,
		b2DefaultRevoluteJointDef,
		b2CreateRevoluteJoint,
		b2Body_GetLocalPoint,
		b2ComputeHull,
		b2MakePolygon,
		b2CreatePolygonShape,
		b2Vec2,
		B2_PI
	} = box2d;

	const human = new Human(box2d);

	for ( let i = 0; i < boneId_count; i++ )
	{
		const bone = new Bone();
		bone.bodyId = box2d.b2_nullBodyId;
		bone.jointId = box2d.b2_nullJointId;
		bone.frictionScale = 1.0;
		bone.parentIndex = -1;
		human.bones[i] = bone;
	}

	human.scale = scale;

	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;
	bodyDef.sleepThreshold = 0.1;

	const shapeDef = b2DefaultShapeDef();
	shapeDef.material.friction = 0.2;
	shapeDef.filter.groupIndex = -groupIndex;
	shapeDef.filter.categoryBits = 2;
	shapeDef.filter.maskBits = ( 1 | 2 );

	const footShapeDef = b2DefaultShapeDef();
	footShapeDef.material.friction = 0.05;
	// feet don't collide with ragdolls
	footShapeDef.filter.categoryBits = 2;
	footShapeDef.filter.maskBits = 1;

	if ( colorize )
	{
		footShapeDef.material.customColor = b2HexColor.b2_colorSaddleBrown;
	}

	const s = scale;
	const maxTorque = frictionTorque * s;
	const enableMotor = true;
	const enableLimit = true;
	const drawSize = 0.05;

	const shirtColor = b2HexColor.b2_colorMediumTurquoise;
	const pantColor = b2HexColor.b2_colorDodgerBlue;

	const skinColors = [ b2HexColor.b2_colorNavajoWhite, b2HexColor.b2_colorLightYellow, b2HexColor.b2_colorPeru, b2HexColor.b2_colorTan ];
	const skinColor = skinColors[groupIndex % 4];

	// hip
	{
		const bone = human.bones[boneId_hip];
		bone.parentIndex = -1;

		bodyDef.position.Set(0.0, 0.95 * s).Add(position);
		// bodyDef.position.Add(position);

		bodyDef.linearDamping = 0.0;
		bodyDef.name = "hip";
		bone.bodyId = b2CreateBody( worldId, bodyDef );

		if ( colorize )
		{
			shapeDef.material.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.02 * s);
		capsule.center2.Set(0.0, 0.02 * s);
		capsule.radius = 0.095 * s;
		b2CreateCapsuleShape( bone.bodyId, shapeDef, capsule );

		capsule.delete();
	}

	// torso
	{
		const bone = human.bones[boneId_torso];
		bone.parentIndex = boneId_hip;

		bodyDef.position.Set(0.0, 1.2 * s).Add(position);
		// bodyDef.position.Add(position);
		bodyDef.linearDamping = 0.0;
		bodyDef.name = "torso";
		// bodyDef.type = b2BodyType.b2_staticBody;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.5;
		bodyDef.type = b2BodyType.b2_dynamicBody;

		if (colorize) {
			shapeDef.material.customColor = shirtColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.135 * s);
		capsule.center2.Set(0.0, 0.135 * s);
		capsule.radius = 0.09 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.0 * s).Add(position);

		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.25 * B2_PI;
		jointDef.upperAngle = 0.0;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.base.drawScale = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// head
	{
		const bone = human.bones[boneId_head];
		bone.parentIndex = boneId_torso;

		bodyDef.position.Set(0.0, 1.475 * s);
		bodyDef.position.Add(position);
		bodyDef.linearDamping = 0.1;
		bodyDef.name = "head";

		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.25;

		if (colorize) {
			shapeDef.material.customColor = skinColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.038 * s);
		capsule.center2.Set(0.0, 0.039 * s);
		capsule.radius = 0.075 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		//// neck
		// capsule = { { 0.0f, -0.12f * s }, { 0.0f, -0.08f * s }, 0.05f * s };
		// b2CreateCapsuleShape( bone->bodyId, &shapeDef, &capsule );

		const pivot = new b2Vec2(0.0, 1.4 * s);
		pivot.Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.3 * B2_PI;
		jointDef.upperAngle = 0.1 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// upper left leg
	{
		const bone = human.bones[boneId_upperLeftLeg];
		bone.parentIndex = boneId_hip;

		bodyDef.position.Set(0.0, 0.775 * s).Add(position);
		bodyDef.linearDamping = 0.0;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 1.0;

		if (colorize) {
			shapeDef.material.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.06 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 0.9 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.05 * B2_PI;
		jointDef.upperAngle = 0.4 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	const points = [
		new b2Vec2(-0.03 * s, -0.185 * s),
		new b2Vec2(0.11 * s, -0.185 * s),
		new b2Vec2(0.11 * s, -0.16 * s),
		new b2Vec2(-0.03 * s, -0.14 * s)
	];

	const footHull = b2ComputeHull(points);
	const footPolygon = b2MakePolygon( footHull, 0.015 * s );

	// lower left leg
	{
		const bone = human.bones[boneId_lowerLeftLeg];
		bone.parentIndex = boneId_upperLeftLeg;

		bodyDef.position.Set(0.0, 0.475 * s).Add(position);
		bodyDef.linearDamping = 0.0;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.5;

		if (colorize) {
			shapeDef.material.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.155 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.045 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		// b2Polygon box = b2MakeOffsetBox(0.1f * s, 0.03f * s, {0.05f * s, -0.175f * s}, 0.0f);
		// b2CreatePolygonShape(bone->bodyId, &shapeDef, &box);

		// capsule = { { -0.02f * s, -0.175f * s }, { 0.13f * s, -0.175f * s }, 0.03f * s };
		// b2CreateCapsuleShape( bone->bodyId, &footShapeDef, &capsule );

		b2CreatePolygonShape(bone.bodyId, footShapeDef, footPolygon);

		const pivot = new b2Vec2(0.0, 0.625 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.5 * B2_PI;
		jointDef.upperAngle = -0.02 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// upper right leg
	{
		const bone = human.bones[boneId_upperRightLeg];
		bone.parentIndex = boneId_hip;

		bodyDef.position.Set(0.0, 0.775 * s).Add(position);
		bodyDef.linearDamping = 0.0;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 1.0;

		if (colorize) {
			shapeDef.material.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.06 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 0.9 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.05 * B2_PI;
		jointDef.upperAngle = 0.4 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// lower right leg
	{
		const bone = human.bones[boneId_lowerRightLeg];
		bone.parentIndex = boneId_upperRightLeg;

		bodyDef.position.Set(0.0, 0.475 * s).Add(position);
		bodyDef.linearDamping = 0.0;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.5;

		if (colorize) {
			shapeDef.material.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.155 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.045 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		// Add foot polygon
		b2CreatePolygonShape(bone.bodyId, footShapeDef, footPolygon);

		const pivot = new b2Vec2(0.0, 0.625 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.5 * B2_PI;
		jointDef.upperAngle = -0.02 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// upper left arm
	{
		const bone = human.bones[boneId_upperLeftArm];
		bone.parentIndex = boneId_torso;
		bone.frictionScale = 0.5;

		bodyDef.position.Set(0.0, 1.225 * s).Add(position);
		bodyDef.linearDamping = 0.0;
		bone.bodyId = b2CreateBody(worldId, bodyDef);

		if (colorize) {
			shapeDef.material.customColor = shirtColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.035 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.35 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.1 * B2_PI;
		jointDef.upperAngle = 0.8 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// lower left arm
	{
		const bone = human.bones[boneId_lowerLeftArm];
		bone.parentIndex = boneId_upperLeftArm;

		bodyDef.position.Set(0.0, 0.975 * s).Add(position);
		bodyDef.linearDamping = 0.1;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.1;

		if (colorize) {
			shapeDef.material.customColor = skinColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.03 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.1 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.referenceAngle = 0.25 * B2_PI;
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.2 * B2_PI;
		jointDef.upperAngle = 0.3 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// upper right arm
	{
		const bone = human.bones[boneId_upperRightArm];
		bone.parentIndex = boneId_torso;

		bodyDef.position.Set(0.0, 1.225 * s).Add(position);
		bodyDef.linearDamping = 0.0;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.5;

		if (colorize) {
			shapeDef.material.customColor = shirtColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.035 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.35 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.1 * B2_PI;
		jointDef.upperAngle = 0.8 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// lower right arm
	{
		const bone = human.bones[boneId_lowerRightArm];
		bone.parentIndex = boneId_upperRightArm;

		bodyDef.position.Set(0.0, 0.975 * s).Add(position);
		bodyDef.linearDamping = 0.1;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.1;

		if (colorize) {
			shapeDef.material.customColor = skinColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.03 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.1 * s).Add(position);
		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.base.bodyIdB = bone.bodyId;

		const localPosA = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
		const localPosB = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);

		jointDef.base.localFrameA.p.Copy(localPosA);
		jointDef.base.localFrameB.p.Copy(localPosB);
		jointDef.referenceAngle = 0.25 * B2_PI;
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.2 * B2_PI;
		jointDef.upperAngle = 0.3 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);

		capsule.delete();
		pivot.delete();
		jointDef.delete();
		localPosA.delete();
		localPosB.delete();
	}

	// clean up
	points.forEach(point => point.delete());
	footHull.delete();
	footPolygon.delete();
	bodyDef.delete();
	shapeDef.delete();
	footShapeDef.delete();

	// set user data
	human.bones.forEach(bone => {
		const bodyPointer = box2d.b2Body_GetPointer(bone.bodyId);
		human_userData[bodyPointer] = userData;
	});

	human.isSpawned = true;
	return human;
}

export function Human_GetUserData(box2d, bodyId)
{
	const bodyPointer = box2d.b2Body_GetPointer(bodyId);
	return human_userData[bodyPointer];
}
