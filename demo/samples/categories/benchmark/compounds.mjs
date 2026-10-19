import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";


export default class Compounds extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 50.0 };
		camera.zoom = 25.0 * 2.2;
		settings.enableSleep = false;

		CreateCompounds(this.box2d, this.m_worldId);
	}

	static GetCapacity(box2d){
		const capacity = new box2d.b2Capacity();
		capacity.staticShapeCount = 310;
		capacity.dynamicShapeCount = 6600;
		capacity.staticBodyCount = 1;
		capacity.dynamicBodyCount = 3300;
		capacity.contactCount = 37000;
		capacity.arenaByteCount = 2900 * 1024;
		return capacity;
	}
}

// Each dynamic body is a compound of two triangular polygon shapes.
function CreateCompounds(box2d, worldId){
	const {
		b2DefaultBodyDef,
		b2CreateBody,
		b2DefaultShapeDef,
		b2MakeOffsetBox,
		b2CreatePolygonShape,
		b2CreateSegmentShape,
		b2Segment,
		b2ComputeHull,
		b2MakePolygon,
		b2Vec2,
		b2Rot_identity,
		b2BodyType,
	} = box2d;

	{
		const gridSize = 1.0;

		const bodyDef = b2DefaultBodyDef();
		const groundId = b2CreateBody( worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		const p = new b2Vec2();

		let y = 0.0;
		let x = -40.0 * gridSize;
		for ( let i = 0; i < 81; ++i )
		{
			const box = b2MakeOffsetBox( 0.55 * gridSize, 0.5 * gridSize, p.Set(x, y), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );
			box.delete();
			x += gridSize;
		}

		y = gridSize;
		x = -40.0 * gridSize;
		for ( let i = 0; i < 100; ++i )
		{
			const box = b2MakeOffsetBox( 0.5 * gridSize, 0.55 * gridSize, p.Set(x, y), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );
			box.delete();
			y += gridSize;
		}

		y = gridSize;
		x = 40.0 * gridSize;
		for ( let i = 0; i < 100; ++i )
		{
			const box = b2MakeOffsetBox( 0.5 * gridSize, 0.55 * gridSize, p.Set(x, y), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );
			box.delete();
			y += gridSize;
		}

		const segment = new b2Segment();
		segment.point1.Set(-800.0, -80.0);
		segment.point2.Set(800.0, -80.0);
		b2CreateSegmentShape( groundId, shapeDef, segment );

		segment.delete();
		p.delete();
		bodyDef.delete();
		shapeDef.delete();
	}

	const columnCount = 20;
	const rowCount = 150;

	const leftPoints = [{x: -1.0, y: 0.0}, {x: 0.5, y: 1.0}, {x: 0.0, y: 2.0}];
	const leftHull = b2ComputeHull( leftPoints );
	const left = b2MakePolygon( leftHull, 0.0 );
	leftHull.delete();

	const rightPoints = [{x: 1.0, y: 0.0}, {x: -0.5, y: 1.0}, {x: 0.0, y: 2.0}];
	const rightHull = b2ComputeHull( rightPoints );
	const right = b2MakePolygon( rightHull, 0.0 );
	rightHull.delete();

	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;

	const shapeDef = b2DefaultShapeDef();
	shapeDef.density = 1.0;
	shapeDef.material.friction = 0.5;

	// Match the sample exactly: centery is computed before shift is reset for the compound branch.
	const shift = 2.0;
	const extray = 0.25;
	let side = 0.25;
	const centerx = shift * columnCount / 2.0 - 1.0;
	const centery = 1.15 / 2.0;
	const yStart = 5.0;

	for ( let i = 0; i < columnCount; ++i )
	{
		const x = i * shift - centerx;

		for ( let j = 0; j < rowCount; ++j )
		{
			const y = j * ( shift + extray ) + centery + yStart;

			bodyDef.position.Set( x + side, y );
			side = -side;

			const bodyId = b2CreateBody( worldId, bodyDef );
			b2CreatePolygonShape( bodyId, shapeDef, left );
			b2CreatePolygonShape( bodyId, shapeDef, right );
		}
	}

	left.delete();
	right.delete();
	bodyDef.delete();
	shapeDef.delete();
}
