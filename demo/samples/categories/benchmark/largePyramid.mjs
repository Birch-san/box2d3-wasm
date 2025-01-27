import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";


export default class LargePyramid extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 50.0 };
		camera.zoom = 25.0 * 2.2;
		settings.enableSleep = false;

		this.Spawn();
	}

	Spawn(){
		CreateLargePyramid(this.box2d, this.m_worldId);
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

function CreateLargePyramid(box2d, worldId){
	const {
		b2CreateBody,
		b2CreatePolygonShape,
		b2World_EnableSleeping,
		b2DefaultBodyDef,
		b2DefaultShapeDef,
		b2MakeBox,
		b2MakeSquare,
		b2Vec2,
		b2BodyType,
	} = box2d;

	b2World_EnableSleeping( worldId, false );

	const baseCount = 100;

	{
		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Set(0.0, -1.0);
		const groundId = b2CreateBody( worldId, bodyDef );

		const box = b2MakeBox( 100.0, 1.0 );
		const shapeDef = b2DefaultShapeDef();
		b2CreatePolygonShape( groundId, shapeDef, box );

		bodyDef.delete();
		box.delete();
		shapeDef.delete();
	}

	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;
	bodyDef.enableSleep = false;

	const shapeDef = b2DefaultShapeDef();
	shapeDef.density = 1.0;

	const h = 0.5;
	const box = b2MakeSquare( h );

	const shift = 1.0 * h;

	for ( let i = 0; i < baseCount; i++ )
	{
		const y = ( 2.0 * i + 1.0 ) * shift;

		for ( let j = i; j < baseCount; j++ )
		{
			const x = ( i + 1.0 ) * shift + 2.0 * ( j - i ) * shift - h * baseCount;

			bodyDef.position.Set(x, y);

			const bodyId = b2CreateBody( worldId, bodyDef );
			b2CreatePolygonShape( bodyId, shapeDef, box );
		}
	}

	bodyDef.delete();
	shapeDef.delete();
	box.delete();
}
