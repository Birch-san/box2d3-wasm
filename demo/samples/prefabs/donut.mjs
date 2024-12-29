const e_sides = 7;

export default class Donut {
	constructor(box2d) {
		this.box2d = box2d;
		this.m_bodyIds = [];
		this.m_isSpawned = false;
	}

	Spawn(worldId, position, scale, groupIndex, userData){
		const {
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2DefaultWeldJointDef,
			b2BodyType,
			b2Capsule,
			b2MakeRot,
			b2Body_GetRotation,
			b2RelativeAngle,
			b2CreateWeldJoint,
			b2CreateBody,
			b2CreateCapsuleShape,
			B2_PI
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
		bodyDef.SetUserData( userData );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.filter.groupIndex = -groupIndex;
		shapeDef.friction = 0.3;

		// Create bodies
		let angle = 0.0;
		for ( let i = 0; i < e_sides; i++ )
		{
			bodyDef.position.Set( radius * Math.cos( angle ) + center.x, radius * Math.sin( angle ) + center.y );
			bodyDef.rotation = b2MakeRot( angle );

			this.m_bodyIds[i] = b2CreateBody( worldId, bodyDef );
			b2CreateCapsuleShape( this.m_bodyIds[i], shapeDef, capsule );

			angle += deltaAngle;
		}

		// Create joints
		const weldDef = b2DefaultWeldJointDef();
		weldDef.angularHertz = 5.0;
		weldDef.angularDampingRatio = 0.0;
		weldDef.localAnchorA.Set(0.0, 0.5 * length);
		weldDef.localAnchorB.Set(0.0, -0.5 * length);

		let prevBodyId = this.m_bodyIds[e_sides - 1];
		for ( let i = 0; i < e_sides; i++ )
		{
			weldDef.bodyIdA = prevBodyId;
			weldDef.bodyIdB = this.m_bodyIds[i];
			const rotA = b2Body_GetRotation( prevBodyId );
			const rotB = b2Body_GetRotation( this.m_bodyIds[i] );
			weldDef.referenceAngle = b2RelativeAngle( rotB, rotA );
			b2CreateWeldJoint( worldId, weldDef );
			prevBodyId = weldDef.bodyIdB;
		}

		this.m_isSpawned = true;
	}
	Despawn()
	{
		console.assert( this.m_isSpawned == true );

		const {
			b2DestroyBody,
		} = this.box2d;

		for ( let i = 0; i < e_sides; i++ )
		{
			if(this.m_bodyIds[i]){
				b2DestroyBody( this.m_bodyIds[i] );
			}
		}

		this.m_bodyIds.length = 0;

		this.m_isSpawned = false;
	}
}
