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

class Human {
	constructor(box2d) {
		this.box2d = box2d;
		this.bones = [];
		this.scale = 1.0;
		this.isSpawned = false;
	}

	DestroyHuman()
	{
		console.assert( this.isSpawned == true );

		for ( let i = 0; i < boneId_count; ++i )
		{
			this.box2d.b2DestroyJoint( this.bones[i].jointId );
		}
		for ( let i = 0; i < boneId_count; ++i )
		{
			this.box2d.b2DestroyBody( this.bones[i].bodyId );
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
				b2RevoluteJoint_EnableMotor( this.bones[i].jointId, false );
			}
		}
		else
		{
			for ( let i = 1; i < boneId_count; ++i )
			{
				b2RevoluteJoint_EnableMotor( this.bones[i].jointId, true );
				const scale = this.scale * this.bones[i].frictionScale;
				b2RevoluteJoint_SetMaxMotorTorque( this.bones[i].jointId, scale * torque );
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
				b2RevoluteJoint_EnableSpring( this.bones[i].jointId, false );
			}
		}
		else
		{
			for ( let i = 1; i < boneId_count; ++i )
			{
				b2RevoluteJoint_EnableSpring( this.bones[i].jointId, true );
				b2RevoluteJoint_SetSpringHertz( this.bones[i].jointId, hertz );
			}
		}
	}

	SetJointDampingRatio(dampingRatio)
	{
		console.assert( this.isSpawned == true );

		for ( let i = 1; i < boneId_count; ++i )
		{
			b2RevoluteJoint_SetSpringDampingRatio( this.bones[i].jointId, dampingRatio );
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
		b2RevoluteJointDef,
		b2CreateRevoluteJoint,
		b2Body_GetLocalPoint,
		b2ComputeHull,
		b2MakePolygon,
		b2CreatePolygonShape,
		b2Vec2,
		B2_PI
	} = box2d;

	const human = new Human();

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

	if(userData) bodyDef.SetUserData(userData);

	const shapeDef = b2DefaultShapeDef();
	shapeDef.friction = 0.2;
	shapeDef.filter.groupIndex = -groupIndex;
	shapeDef.filter.categoryBits = 2;
	shapeDef.filter.maskBits = ( 1 | 2 );

	const footShapeDef = shapeDef;
	footShapeDef.friction = 0.05;

	// feet don't collide with ragdolls
	footShapeDef.filter.categoryBits = 2;
	footShapeDef.filter.maskBits = 1;

	if ( colorize )
	{
		footShapeDef.customColor = b2HexColor.b2_colorSaddleBrown;
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

		bodyDef.linearDamping = 0.0;
		bone.bodyId = b2CreateBody( worldId, bodyDef );

		if ( colorize )
		{
			shapeDef.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.02 * s);
		capsule.center2.Set(0.0, 0.02 * s);
		capsule.radius = 0.095 * s;
		b2CreateCapsuleShape( bone.bodyId, shapeDef, capsule );
	}

	{
		// torso
		const bone = human.bones[boneId_torso];
		bone.parentIndex = boneId_hip;

		bodyDef.position.Set(0.0, 1.2 * s).Add(position);
		bodyDef.linearDamping = 0.0;
		bodyDef.type = b2BodyType.b2_staticBody;
		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.5;
		bodyDef.type = b2BodyType.b2_dynamicBody;

		if (colorize) {
			shapeDef.customColor = shirtColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.135 * s);
		capsule.center2.Set(0.0, 0.135 * s);
		capsule.radius = 0.09 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.0 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;

		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);

		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.25 * B2_PI;
		jointDef.upperAngle = 0.0;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;


		bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
	}
	return human;

	// head
	{
		const bone = human.bones[boneId_head];
		bone.parentIndex = boneId_torso;

		bodyDef.position.Set(0.0, 1.475 * s).Add(position);
		bodyDef.linearDamping = 0.1;

		bone.bodyId = b2CreateBody(worldId, bodyDef);
		bone.frictionScale = 0.25;

		if (colorize) {
			shapeDef.customColor = skinColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.038 * s);
		capsule.center2.Set(0.0, 0.039 * s);
		capsule.radius = 0.075 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		//// neck
		// capsule = { { 0.0f, -0.12f * s }, { 0.0f, -0.08f * s }, 0.05f * s };
		// b2CreateCapsuleShape( bone->bodyId, &shapeDef, &capsule );

		const pivot = new b2Vec2(0.0, 1.4 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.3 * B2_PI;
		jointDef.upperAngle = 0.1 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.06 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 0.9 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.05 * B2_PI;
		jointDef.upperAngle = 0.4 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = pantColor;
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
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.5 * B2_PI;
		jointDef.upperAngle = -0.02 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.06 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 0.9 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.05 * B2_PI;
		jointDef.upperAngle = 0.4 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = pantColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.155 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.045 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		// Add foot polygon
		b2CreatePolygonShape(bone.bodyId, footShapeDef, footPolygon);

		const pivot = new b2Vec2(0.0, 0.625 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.5 * B2_PI;
		jointDef.upperAngle = -0.02 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = shirtColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.035 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.35 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.1 * B2_PI;
		jointDef.upperAngle = 0.8 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = skinColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.03 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.1 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
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

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = shirtColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.035 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.35 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
		jointDef.enableLimit = enableLimit;
		jointDef.lowerAngle = -0.1 * B2_PI;
		jointDef.upperAngle = 0.8 * B2_PI;
		jointDef.enableMotor = enableMotor;
		jointDef.maxMotorTorque = bone.frictionScale * maxTorque;
		jointDef.enableSpring = hertz > 0.0;
		jointDef.hertz = hertz;
		jointDef.dampingRatio = dampingRatio;
		jointDef.drawSize = drawSize;

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
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
			shapeDef.customColor = skinColor;
		}

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.125 * s);
		capsule.center2.Set(0.0, 0.125 * s);
		capsule.radius = 0.03 * s;
		b2CreateCapsuleShape(bone.bodyId, shapeDef, capsule);

		const pivot = new b2Vec2(0.0, 1.1 * s).Add(position);
		const jointDef = new b2RevoluteJointDef();
		jointDef.bodyIdA = human.bones[bone.parentIndex].bodyId;
		jointDef.bodyIdB = bone.bodyId;
		jointDef.localAnchorA = b2Body_GetLocalPoint(jointDef.bodyIdA, pivot);
		jointDef.localAnchorB = b2Body_GetLocalPoint(jointDef.bodyIdB, pivot);
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

		// bone.jointId = b2CreateRevoluteJoint(worldId, jointDef);
	}

	human.isSpawned = true;
}
