import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";

const g_junkyardData = {
	pusherId: null,
};

export default class Junkyard extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 8.0, y: 25.0 };
		camera.zoom = 60.0;

		CreateJunkyard(this.box2d, this.m_worldId);
	}

	static GetCapacity(box2d){
		const capacity = new box2d.b2Capacity();
		capacity.staticShapeCount = 290;
		capacity.dynamicShapeCount = 8800;
		capacity.staticBodyCount = 1;
		capacity.dynamicBodyCount = 8900;
		capacity.contactCount = 38000;
		capacity.arenaByteCount = 3700 * 1024;
		return capacity;
	}

	Step(){
		if (settings.pause == false || settings.singleStep)
		{
			StepJunkyard(this.box2d, this.m_worldId, this.m_stepCount);
		}

		super.Step();
	}
}

function CreateJunkyard(box2d, worldId){
	const {
		b2DefaultBodyDef,
		b2CreateBody,
		b2DefaultShapeDef,
		b2MakeOffsetBox,
		b2CreatePolygonShape,
		b2ComputeCosSin,
		b2ComputeHull,
		b2MakePolygon,
		b2Vec2,
		b2Rot_identity,
		b2BodyType,
		B2_PI,
	} = box2d;

	{
		const gridSize = 1.0;

		const bodyDef = b2DefaultBodyDef();
		const groundId = b2CreateBody( worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		const p = new b2Vec2();

		let y = 0.0;
		let x = -80.0 * gridSize;
		for ( let i = 0; i < 161; ++i )
		{
			const box = b2MakeOffsetBox( 0.55 * gridSize, 0.5 * gridSize, p.Set(x, y), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );
			box.delete();
			x += gridSize;
		}

		y = gridSize;
		x = -80.0 * gridSize;
		for ( let i = 0; i < 50; ++i )
		{
			const box = b2MakeOffsetBox( 0.5 * gridSize, 0.55 * gridSize, p.Set(x, y), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );
			box.delete();
			y += gridSize;
		}

		y = gridSize;
		x = 80.0 * gridSize;
		for ( let i = 0; i < 50; ++i )
		{
			const box = b2MakeOffsetBox( 0.5 * gridSize, 0.55 * gridSize, p.Set(x, y), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );
			box.delete();
			y += gridSize;
		}

		p.delete();
		bodyDef.delete();
		shapeDef.delete();
	}

	const columnCount = 200;
	const rowCount = 40;

	const radius = 0.25;
	let polygon;
	{
		// Fibonacci sphere algorithm
		const phi = B2_PI * ( Math.sqrt( 5.0 ) - 1.0 );
		const points = [];

		for ( let i = 0; i < 5; ++i )
		{
			const theta = phi * i;
			const cs = b2ComputeCosSin( theta );
			points.push({x: radius * cs.cosine, y: radius * cs.sine});
			cs.delete();
		}

		const hull = b2ComputeHull( points );
		polygon = b2MakePolygon( hull, 0.0 );
		hull.delete();
	}

	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;
	const shapeDef = b2DefaultShapeDef();

	let side = -0.1;
	const yStart = 15.0;

	for ( let i = 0; i < columnCount; ++i )
	{
		const x = 1.5 * ( 2.0 * i - columnCount ) * radius;

		for ( let j = 0; j < rowCount; ++j )
		{
			const y = 4.0 * j * radius + yStart;

			bodyDef.position.Set( x + side, y );
			side = -side;

			const bodyId = b2CreateBody( worldId, bodyDef );
			b2CreatePolygonShape( bodyId, shapeDef, polygon );
		}
	}

	bodyDef.type = b2BodyType.b2_kinematicBody;
	bodyDef.position.Set( 0.0, 0.0 );
	g_junkyardData.pusherId = b2CreateBody( worldId, bodyDef );

	const p = new b2Vec2( 0.0, 4.0 );
	const box = b2MakeOffsetBox( 2.0, 4.0, p, b2Rot_identity );
	b2CreatePolygonShape( g_junkyardData.pusherId, shapeDef, box );

	p.delete();
	box.delete();
	polygon.delete();
	bodyDef.delete();
	shapeDef.delete();
}

function StepJunkyard(box2d, worldId, stepCount){
	const {
		b2ComputeCosSin,
		b2Transform,
		b2Rot_identity,
		b2Body_SetTargetTransform,
	} = box2d;

	const timeStep = 1.0 / 60.0;
	const time = timeStep * stepCount;
	const cs = b2ComputeCosSin( 0.2 * time );

	const target = new b2Transform();
	target.p.Set( 60.0 * cs.sine, 0.0 );
	target.q = b2Rot_identity;
	b2Body_SetTargetTransform( g_junkyardData.pusherId, target, timeStep, true );

	target.delete();
	cs.delete();

	return 0.0;
}
