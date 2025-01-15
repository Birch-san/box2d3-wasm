import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";

export default class JointGrid extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 60.0, y: -57.0 };
		camera.zoom = 25.0 * 2.5;

		settings.enableSleep = false;

		CreateJointGrid( this.box2d, this.m_worldId );

		this.Spawn();
	}
}


function CreateJointGrid(box2d, worldId )
{
	const {
		b2World_EnableSleeping,
		b2DefaultShapeDef,
		b2Circle,
		b2DefaultRevoluteJointDef,
		b2DefaultBodyDef,
		b2CreateBody,
		b2CreateCircleShape,
		b2CreateRevoluteJoint,
		b2BodyType,
	} = box2d;

	b2World_EnableSleeping( worldId, false );

	let N = 70;

	const bodies = new Array(N * N).fill(null);
	let index = 0;

	const shapeDef = b2DefaultShapeDef();
	shapeDef.density = 1.0;
	shapeDef.filter.categoryBits = 2;
	shapeDef.filter.setMaskBits64("4294967293"); // c: ~2u

	const circle = new b2Circle();
	circle.center.Set(0.0, 0.0);
	circle.radius = 0.4;

	const jd = b2DefaultRevoluteJointDef();
	const bodyDef = b2DefaultBodyDef();

	for ( let k = 0; k < N; k++ )
	{
		for ( let i = 0; i < N; i++ )
		{

			if ( k >= N / 2 - 3 && k <= N / 2 + 3 && i == 0 )
			{
				bodyDef.type = b2BodyType.b2_staticBody;
			}
			else
			{
				bodyDef.type = b2BodyType.b2_dynamicBody;
			}

			bodyDef.position.Set(k, -i);

			const body = b2CreateBody( worldId, bodyDef );

			b2CreateCircleShape( body, shapeDef, circle );

			if ( i > 0 )
			{
				jd.bodyIdA = bodies[index - 1];
				jd.bodyIdB = body;
				jd.localAnchorA.Set(0.0, -0.5);
				jd.localAnchorB.Set(0.0, 0.5);
				b2CreateRevoluteJoint( worldId, jd );
			}

			if ( k > 0 )
			{
				jd.bodyIdA = bodies[index - N];
				jd.bodyIdB = body;
				jd.localAnchorA.Set(0.5, 0.0 );
				jd.localAnchorB.Set(-0.5, 0.0 );
				b2CreateRevoluteJoint( worldId, jd );
			}

			bodies[index++] = body;
		}
	}
}
