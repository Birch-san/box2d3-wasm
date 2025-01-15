import Sample from "../../sample.mjs";


export default class Tumbler extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 1.5, y: 10.0 };
		camera.zoom = 25.0 * 0.6;

		this.Spawn();
	}

	Spawn(){
		CreateTumbler(this.box2d, this.m_worldId);
	}

	Destroy(){
		super.Destroy();
		this.Despawn();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}

function CreateTumbler(box2d, worldId){
	const {
		b2CreateBody,
		b2CreatePolygonShape,
		b2CreateRevoluteJoint,
		b2DefaultBodyDef,
		b2DefaultRevoluteJointDef,
		b2DefaultShapeDef,
		b2MakeBox,
		b2MakeOffsetBox,
		b2Vec2,
		b2Rot_identity,
		b2BodyType,
		B2_PI
	} = box2d;

	let groundId;
	{
		const bodyDef = b2DefaultBodyDef();
		groundId = b2CreateBody( worldId, bodyDef );
	}

	{
		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position = new b2Vec2(0.0, 10.0);
		const bodyId = b2CreateBody( worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 50.0;

		let polygon;
		polygon = b2MakeOffsetBox( 0.5, 10.0, new b2Vec2(10.0, 0.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );
		polygon = b2MakeOffsetBox( 0.5, 10.0, new b2Vec2(-10.0, 0.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );
		polygon = b2MakeOffsetBox( 10.0, 0.5, new b2Vec2(0.0, 10.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );
		polygon = b2MakeOffsetBox( 10.0, 0.5, new b2Vec2(0.0, -10.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );

		const motorSpeed = 25.0;

		const jd = b2DefaultRevoluteJointDef();
		jd.bodyIdA = groundId;
		jd.bodyIdB = bodyId;
		jd.localAnchorA = new b2Vec2(0.0, 10.0);
		jd.localAnchorB = new b2Vec2(0.0, 0.0);
		jd.referenceAngle = 0.0;
		jd.motorSpeed = ( B2_PI / 180.0 ) * motorSpeed;
		jd.maxMotorTorque = 1e8;
		jd.enableMotor = true;

		b2CreateRevoluteJoint( worldId, jd );
	}

	const gridCount = 45;

	const polygon = b2MakeBox( 0.125, 0.125 );
	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;
	const shapeDef = b2DefaultShapeDef();

	let y = -0.2 * gridCount + 10.0;
	for (let i = 0; i < gridCount; i++ )
	{
		let x = -0.2 * gridCount;

		for ( let j = 0; j < gridCount; j++ )
		{
			bodyDef.position = new b2Vec2(x, y );
			const bodyId = b2CreateBody( worldId, bodyDef );

			b2CreatePolygonShape( bodyId, shapeDef, polygon );

			x += 0.4;
		}

		y += 0.4;
	}
}
