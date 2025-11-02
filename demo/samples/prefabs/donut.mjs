const e_sides = 7;

const donut_userData = {};

export default class Donut {
	constructor(box2d) {
		this.box2d = box2d;
		this.m_bodyIds = [];
		this.m_isSpawned = false;
	}

	Spawn(worldId, position, scale, groupIndex, enableSensorEvents, userData){
		const {
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2DefaultWeldJointDef,
			b2BodyType,
			b2Capsule,
			b2MakeRot,
			b2Body_GetRotation,
			b2InvMulRot,
			b2CreateWeldJoint,
			b2CreateBody,
			b2CreateCapsuleShape,
			B2_PI,
			b2Body_GetPointer
		} = this.box2d;

		console.assert( this.m_isSpawned == false );

		const radius = 1.0 * scale;
		const deltaAngle = 2.0 * B2_PI / e_sides;
		const length = 2.0 * B2_PI * radius / e_sides;

		const capsule = new b2Capsule();
		capsule.center1.Set(0.0, -0.5 * length);
		capsule.center2.Set(0.0, 0.5 * length);
		capsule.radius = 0.25 * scale;

		const center = position;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.enableSensorEvents = enableSensorEvents;
		shapeDef.filter.groupIndex = -groupIndex;
		shapeDef.material.friction = 0.3;

		// Create bodies
		let angle = 0.0;
		for ( let i = 0; i < e_sides; i++ )
		{
			bodyDef.position.Set( radius * Math.cos( angle ) + center.x, radius * Math.sin( angle ) + center.y );

			const rot = b2MakeRot( angle );
			bodyDef.rotation = rot;
			rot.delete();

			this.m_bodyIds[i] = b2CreateBody( worldId, bodyDef );
			b2CreateCapsuleShape( this.m_bodyIds[i], shapeDef, capsule );

			const bodyPointer = b2Body_GetPointer(this.m_bodyIds[i]);
			donut_userData[bodyPointer] = userData;

			angle += deltaAngle;
		}

		// Create joints
		const weldDef = b2DefaultWeldJointDef();
		weldDef.angularHertz = 5.0;
		weldDef.angularDampingRatio = 0.0;
		weldDef.base.localFrameA.p.Set(0.0, 0.5 * length);
		weldDef.base.localFrameB.p.Set(0.0, -0.5 * length);

		let prevBodyId = this.m_bodyIds[e_sides - 1];
		for ( let i = 0; i < e_sides; i++ )
		{
			weldDef.base.bodyIdA = prevBodyId;
			weldDef.base.bodyIdB = this.m_bodyIds[i];
			const rotA = b2Body_GetRotation( prevBodyId );
			const rotB = b2Body_GetRotation( this.m_bodyIds[i] );

			const relativeAngle = b2InvMulRot( rotA, rotB );
			weldDef.base.localFrameA.q.SetAngle(relativeAngle.GetAngle());
			const weldJoint = b2CreateWeldJoint( worldId, weldDef );
			prevBodyId = weldDef.base.bodyIdB;

			rotA.delete();
			rotB.delete();
			relativeAngle.delete();
		}

		this.m_isSpawned = true;

		weldDef.delete();
		bodyDef.delete();
		shapeDef.delete();
		capsule.delete();

	}
	Despawn()
	{
		console.assert( this.m_isSpawned == true );

		const {
			b2DestroyBody,
			b2Body_GetPointer
		} = this.box2d;

		for ( let i = 0; i < e_sides; i++ )
		{
			if(this.m_bodyIds[i]){
				const bodyPointer = b2Body_GetPointer( this.m_bodyIds[i] );
				delete donut_userData[bodyPointer];
				b2DestroyBody( this.m_bodyIds[i] );
			}
		}

		this.m_bodyIds.length = 0;

		this.m_isSpawned = false;
	}
}


export function Donut_GetUserData(box2d, bodyId)
{
	const bodyPointer = box2d.b2Body_GetPointer(bodyId);
	return donut_userData[bodyPointer];
}
