import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";


export default class Smash extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 60.0, y: 6.0 };
		camera.zoom = 25.0 * 1.6;

		this.Spawn();
	}

	Spawn(){
		CreateSmash(this.box2d, this.m_worldId);
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

function CreateSmash( box2d, worldId )
{
	const {
		b2World_SetGravity,
		b2MakeBox,
		b2DefaultBodyDef,
		b2BodyType,
		b2CreateBody,
		b2DefaultShapeDef,
		b2CreatePolygonShape,
		b2Vec2_zero,
		b2MakeSquare
	} = box2d;

	b2World_SetGravity( worldId, b2Vec2_zero );

	{
		const box = b2MakeBox( 4.0, 4.0 );

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set(-20.0, 0.0);
		bodyDef.linearVelocity.Set(40.0, 0.0);
		const bodyId = b2CreateBody( worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 8.0;
		b2CreatePolygonShape( bodyId, shapeDef, box );

		box.delete();
		bodyDef.delete();
		shapeDef.delete();
	}

	const d = 0.4;
	const box = b2MakeSquare( 0.5 * d );

	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;
	bodyDef.isAwake = false;

	const shapeDef = b2DefaultShapeDef();

	const columns = 120;
	const rows = 80;

	for ( let i = 0; i < columns; i++ )
	{
		for ( let j = 0; j < rows; j++ )
		{
			bodyDef.position.Set(i * d + 30.0, ( j - rows / 2.0 ) * d);
			const bodyId = b2CreateBody( worldId, bodyDef );
			b2CreatePolygonShape( bodyId, shapeDef, box );
		}
	}

	box.delete();
	bodyDef.delete();
	shapeDef.delete();
}
