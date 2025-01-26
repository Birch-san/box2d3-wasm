import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";


export default class ManyPyramids extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 16.0, y: 110.0 };
		camera.zoom = 25.0 * 5;
		settings.enableSleep = false;

		this.Spawn();
	}

	Spawn(){
		CreateManyPyramids(this.box2d, this.m_worldId);
	}

	Destroy(){
		this.Despawn();
		super.Destroy();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}

function CreateSmallPyramid(box2d, worldId, baseCount, extent, centerX, baseY )
{
	const {
		b2DefaultBodyDef,
		b2DefaultShapeDef,
		b2MakeSquare,
		b2CreateBody,
		b2CreatePolygonShape,
		b2BodyType
	} = box2d;

	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;

	const shapeDef = b2DefaultShapeDef();

	const box = b2MakeSquare( extent );

	for ( let i = 0; i < baseCount; i++ )
	{
		const y = ( 2.0 * i + 1.0 ) * extent + baseY;

		for ( let j = i; j < baseCount; j++ )
		{
			let x = ( i + 1.0 ) * extent + 2.0 * ( j - i ) * extent + centerX - 0.5;
			bodyDef.position.Set(x, y);

			const bodyId = b2CreateBody( worldId, bodyDef );
			b2CreatePolygonShape( bodyId, shapeDef, box );
		}
	}

	bodyDef.delete();
	shapeDef.delete();
	box.delete();
}

function CreateManyPyramids( box2d, worldId )
{
	const {
		b2DefaultBodyDef,
		b2DefaultShapeDef,
		b2World_EnableSleeping,
		b2CreateBody,
		b2CreateSegmentShape,
		b2Segment,
	} = box2d;

	b2World_EnableSleeping( worldId, false );

	const baseCount = 10;
	const extent = 0.5;
	const rowCount = 20;
	const columnCount = 20;

	const bodyDef = b2DefaultBodyDef();
	const groundId = b2CreateBody( worldId, bodyDef );

	const groundDeltaY = 2.0 * extent * ( baseCount + 1.0 );
	const groundWidth = 2.0 * extent * columnCount * ( baseCount + 1.0 );
	const shapeDef = b2DefaultShapeDef();

	let groundY = 0.0;

	for ( let i = 0; i < rowCount; i++ )
	{
		const segment = new b2Segment();
		segment.point1.Set( -0.5 * 2.0 * groundWidth, groundY );
		segment.point2.Set( 0.5 * 2.0 * groundWidth, groundY );
		b2CreateSegmentShape( groundId, shapeDef, segment );
		groundY += groundDeltaY;

		segment.delete();
	}

	const baseWidth = 2.0 * extent * baseCount;
	let baseY = 0.0;

	for ( let i = 0; i < rowCount; i++ )
	{
		for ( let j = 0; j < columnCount; j++ )
		{
			const centerX = -0.5 * groundWidth + j * ( baseWidth + 2.0 * extent ) + extent;
			CreateSmallPyramid(box2d, worldId, baseCount, extent, centerX, baseY );
		}

		baseY += groundDeltaY;
	}

	bodyDef.delete();
	shapeDef.delete();
}
