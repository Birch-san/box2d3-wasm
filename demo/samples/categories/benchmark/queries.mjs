import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";
import b2HexColor from '../../b2HexColor.mjs';

// Query benchmark. A sparse grid of static boxes like the cast sample, a pile of dynamic boxes
// settling on a ground inside it with a kinematic paddle keeping some of them awake, and a few
// static sensors in the pile. Every step runs a fixed set of closest rays, circle casts and box
// overlaps, once with the default filter and once with a mask that hits one category in three.
// The queries are precomputed so only the tree work lands in the step time.

const QUERY_COUNT = 1000;

const g_queryBenchmark = {
	origins: [],
	translations: [],
	paddleId: null,
	stats: {nodeVisits: 0, leafVisits: 0},
	extent: 0.0,
	paddleMinX: 0.0,
	paddleMaxX: 0.0,
};

let g_queryRandomState = 0;

// The queries benchmark scene with one of its queries drawn and the cost of the whole set
export default class Queries extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		CreateQueries(this.box2d, this.m_worldId);

		const extent = g_queryBenchmark.extent;
		camera.center = {x: 0.5 * extent, y: 0.5 * extent };
		camera.zoom = 0.55 * extent;

		this.m_drawIndex = 0;
		this.m_minTime = 1e6;
		this.m_lastTime = 0.0;
		this.m_hitCount = 0;
		this.m_nodeVisits = 0;
		this.m_leafVisits = 0;

		this.CreateUI();
	}

	static GetCapacity(box2d){
		const capacity = new box2d.b2Capacity();
		capacity.staticShapeCount = 28000;
		capacity.dynamicShapeCount = 2200;
		capacity.staticBodyCount = 28000;
		capacity.dynamicBodyCount = 2300;
		capacity.contactCount = 9800;
		capacity.arenaByteCount = 930 * 1024;
		return capacity;
	}

	CreateUI(){
		const container = document.getElementById('sample-settings');

		if(this.pane){
			this.pane.dispose();
		}

		this.pane = new Pane({
			title: 'Sample Settings',
			expanded: true,
			container
		});

		const PARAMS = {
			draw: this.m_drawIndex,
		};

		this.pane.addBinding(PARAMS, 'draw', {
			step: 1,
			min: 0,
			max: QUERY_COUNT - 1,
		}).on('change', event => {
			this.m_drawIndex = event.value;
		});
	}

	Step(){
		const {
			b2RoundDownFloat,
			b2RoundUpFloat,
		} = this.box2d;

		if (settings.pause == false || settings.singleStep)
		{
			const before = {...g_queryBenchmark.stats};
			const ticks = performance.now();
			this.m_hitCount = StepQueries(this.box2d, this.m_worldId, this.m_stepCount);
			this.m_lastTime = performance.now() - ticks;
			this.m_minTime = Math.min( this.m_minTime, this.m_lastTime );
			const after = g_queryBenchmark.stats;
			this.m_nodeVisits = after.nodeVisits - before.nodeVisits;
			this.m_leafVisits = after.leafVisits - before.leafVisits;
		}

		super.Step();

		const origin = g_queryBenchmark.origins[this.m_drawIndex];
		const translation = g_queryBenchmark.translations[this.m_drawIndex];
		const end = {x: origin.x + translation.x, y: origin.y + translation.y};

		this.debugDraw.prepareCanvas();

		this.debugDraw.drawLine({
			data: [origin.x, origin.y, end.x, end.y],
			color: b2HexColor.b2_colorWhite,
		});

		this.debugDraw.drawPoint({
			data: [origin.x, origin.y, 5.0],
			color: b2HexColor.b2_colorGreen,
		});

		this.debugDraw.drawPoint({
			data: [end.x, end.y, 5.0],
			color: b2HexColor.b2_colorRed,
		});

		// The overlap box the same query runs
		const lower = {x: b2RoundDownFloat( origin.x - 5.0 ), y: b2RoundDownFloat( origin.y - 5.0 )};
		const upper = {x: b2RoundUpFloat( origin.x + 5.0 ), y: b2RoundUpFloat( origin.y + 5.0 )};

		this.debugDraw.drawPolygon({
			data: [ lower.x, lower.y,
				upper.x, lower.y,
				upper.x, upper.y,
				lower.x, upper.y ],
			vertexCount: 4,
			color: b2HexColor.b2_colorWhite,
		});

		this.debugDraw.restoreCanvas();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		m_textLine = DrawString( 5, m_textLine, `${QUERY_COUNT} queries of each kind and filter, ${this.m_hitCount} hits` );
		m_textLine = DrawString( 5, m_textLine, `node visits = ${this.m_nodeVisits}, leaf visits = ${this.m_leafVisits}` );
		m_textLine = DrawString( 5, m_textLine, `queries ms = ${this.m_lastTime.toFixed(3)}, min = ${this.m_minTime.toFixed(3)}` );

		return m_textLine;
	}

	Destroy(){
		DestroyQueries();
		super.Destroy();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}

// Repeatable is all this needs to be. Same LCG and float math as upstream so the scene matches.
function QueryRandom( lower, upper )
{
	g_queryRandomState = ( Math.imul( 1664525, g_queryRandomState ) + 1013904223 ) >>> 0;
	const unit = Math.fround( ( g_queryRandomState >>> 8 ) * ( 1.0 / 16777216.0 ) );
	return Math.fround( lower + Math.fround( Math.fround( upper - lower ) * unit ) );
}

function DestroyQueries()
{
	g_queryBenchmark.origins.forEach(origin => origin.delete());
	g_queryBenchmark.translations.forEach(translation => translation.delete());
	g_queryBenchmark.origins = [];
	g_queryBenchmark.translations = [];
	g_queryBenchmark.paddleId = null;
}

function CreateQueries(box2d, worldId)
{
	const {
		b2DefaultBodyDef,
		b2DefaultShapeDef,
		b2CreateBody,
		b2CreatePolygonShape,
		b2CreateSegmentShape,
		b2MakeBox,
		b2MakeSquare,
		b2Segment,
		b2Vec2,
		b2BodyType,
	} = box2d;

	DestroyQueries();

	g_queryRandomState = 1234;

	const extent = 500.0;
	const cellCount = 500;
	const fill = Math.fround( 0.1 );

	// The pile keeps this region of the grid clear
	const pileX = 0.4 * extent;
	const pileY = 0.3 * extent;
	const clear = {
		lowerBound: {x: pileX - 10.0, y: pileY - 10.0},
		upperBound: {x: pileX + 50.0, y: pileY + 60.0},
	};

	const bodyDef = b2DefaultBodyDef();
	const shapeDef = b2DefaultShapeDef();

	for ( let i = 0; i < cellCount; ++i )
	{
		const y = i;
		for ( let j = 0; j < cellCount; ++j )
		{
			const x = j;

			const fillTest = QueryRandom( 0.0, 1.0 );
			const ratio = QueryRandom( 1.0, 5.0 );
			const halfWidth = QueryRandom( 0.05, 0.25 );
			const orientation = QueryRandom( 0.0, 1.0 );
			const category = Math.trunc( QueryRandom( 0.0, 2.999 ) );

			if ( fillTest > fill )
			{
				continue;
			}

			if ( clear.lowerBound.x <= x && x <= clear.upperBound.x && clear.lowerBound.y <= y && y <= clear.upperBound.y )
			{
				continue;
			}

			bodyDef.position.Set( x, y );
			const bodyId = b2CreateBody( worldId, bodyDef );

			const box =
				orientation > 0.5 ? b2MakeBox( Math.fround( ratio * halfWidth ), halfWidth ) : b2MakeBox( halfWidth, Math.fround( ratio * halfWidth ) );
			shapeDef.filter.categoryBits = 1 << category;
			b2CreatePolygonShape( bodyId, shapeDef, box );
			box.delete();
		}
	}

	shapeDef.filter.categoryBits = 1;

	// Ground for the pile
	{
		bodyDef.position.Set( 0.0, 0.0 );
		const groundId = b2CreateBody( worldId, bodyDef );
		const segment = new b2Segment();
		segment.point1.Set( pileX - 10.0, pileY );
		segment.point2.Set( pileX + 50.0, pileY );
		b2CreateSegmentShape( groundId, shapeDef, segment );
		segment.delete();
	}

	// Static sensors sitting in the pile
	{
		const sensorDef = b2DefaultShapeDef();
		sensorDef.isSensor = true;
		const sensorBox = b2MakeSquare( 2.0 );
		for ( let i = 0; i < 8; ++i )
		{
			bodyDef.position.Set( pileX + 4.0 * i, pileY + 2.0 );
			const sensorId = b2CreateBody( worldId, bodyDef );
			b2CreatePolygonShape( sensorId, sensorDef, sensorBox );
		}
		sensorBox.delete();
		sensorDef.delete();
	}

	// The pile, dropped from just above the ground so it settles quickly
	{
		const columnCount = 40;
		const rowCount = 50;
		const spacing = 0.55;
		const box = b2MakeSquare( 0.25 );

		bodyDef.type = b2BodyType.b2_dynamicBody;
		for ( let i = 0; i < rowCount; ++i )
		{
			for ( let j = 0; j < columnCount; ++j )
			{
				bodyDef.position.Set( pileX + spacing * j, pileY + 1.0 + spacing * i );
				const bodyId = b2CreateBody( worldId, bodyDef );
				b2CreatePolygonShape( bodyId, shapeDef, box );
			}
		}
		box.delete();
	}

	// Kinematic paddle sweeping through the bottom of the pile
	{
		bodyDef.type = b2BodyType.b2_kinematicBody;
		bodyDef.position.Set( pileX - 5.0, pileY + 1.2 );
		bodyDef.linearVelocity.Set( 5.0, 0.0 );
		g_queryBenchmark.paddleId = b2CreateBody( worldId, bodyDef );
		const paddle = b2MakeBox( 1.0, 1.0 );
		b2CreatePolygonShape( g_queryBenchmark.paddleId, shapeDef, paddle );
		paddle.delete();
		g_queryBenchmark.paddleMinX = pileX - 5.0;
		g_queryBenchmark.paddleMaxX = pileX + 30.0;
	}

	bodyDef.delete();
	shapeDef.delete();

	// Rays and casts cross the whole world, overlaps are centered on the origins
	for ( let i = 0; i < QUERY_COUNT; ++i )
	{
		const x1 = QueryRandom( 0.0, extent );
		const y1 = QueryRandom( 0.0, extent );
		const x2 = QueryRandom( 0.0, extent );
		const y2 = QueryRandom( 0.0, extent );
		g_queryBenchmark.origins.push( new b2Vec2( x1, y1 ) );
		g_queryBenchmark.translations.push( new b2Vec2( x2 - x1, y2 - y1 ) );
	}

	g_queryBenchmark.stats = {nodeVisits: 0, leafVisits: 0};
	g_queryBenchmark.extent = extent;
}

function StepQueries(box2d, worldId, stepCount)
{
	const {
		b2Body_GetPosition,
		b2Body_SetLinearVelocity,
		b2DefaultQueryFilter,
		b2World_CastRayClosest,
		b2World_CastShape,
		b2World_OverlapAABB,
		b2MakeProxy,
		b2AABB,
		b2Vec2,
		b2Vec2_zero,
	} = box2d;

	const data = g_queryBenchmark;

	// Reverse the paddle at the ends of its sweep
	const paddlePosition = b2Body_GetPosition( data.paddleId );
	if ( paddlePosition.x > data.paddleMaxX )
	{
		const v = new b2Vec2( -5.0, 0.0 );
		b2Body_SetLinearVelocity( data.paddleId, v );
		v.delete();
	}
	else if ( paddlePosition.x < data.paddleMinX )
	{
		const v = new b2Vec2( 5.0, 0.0 );
		b2Body_SetLinearVelocity( data.paddleId, v );
		v.delete();
	}
	paddlePosition.delete();

	const filters = [ b2DefaultQueryFilter(), b2DefaultQueryFilter() ];
	filters[1].maskBits = 1;

	const circle = b2MakeProxy( b2Vec2_zero, 1, 0.1 );

	const aabb = new b2AABB();
	aabb.lowerBound.Set( -5.0, -5.0 );
	aabb.upperBound.Set( 5.0, 5.0 );

	const queryCount = QUERY_COUNT;
	let hitCount = 0;
	const stats = {nodeVisits: 0, leafVisits: 0};

	let fraction = 1.0;
	const castClosest = ( rayCallbackResult ) => {
		fraction = rayCallbackResult.fraction;
		rayCallbackResult.delete();
		return fraction;
	};

	let overlapCount = 0;
	const overlapCounter = () => {
		overlapCount += 1;
		return true;
	};

	for ( let f = 0; f < 2; ++f )
	{
		const filter = filters[f];

		for ( let i = 0; i < queryCount; ++i )
		{
			const result = b2World_CastRayClosest( worldId, data.origins[i], data.translations[i], filter );
			stats.nodeVisits += result.nodeVisits;
			stats.leafVisits += result.leafVisits;
			hitCount += result.hit ? 1 : 0;
			result.delete();
		}

		for ( let i = 0; i < queryCount; ++i )
		{
			fraction = 1.0;
			const castStats = b2World_CastShape( worldId, data.origins[i], circle, data.translations[i], filter, castClosest );
			stats.nodeVisits += castStats.nodeVisits;
			stats.leafVisits += castStats.leafVisits;
			hitCount += fraction < 1.0 ? 1 : 0;
		}

		for ( let i = 0; i < queryCount; ++i )
		{
			overlapCount = 0;
			const overlapStats = b2World_OverlapAABB( worldId, data.origins[i], aabb, filter, overlapCounter );
			stats.nodeVisits += overlapStats.nodeVisits;
			stats.leafVisits += overlapStats.leafVisits;
			hitCount += overlapCount;
		}
	}

	aabb.delete();
	circle.delete();
	filters[0].delete();
	filters[1].delete();

	data.stats.nodeVisits += stats.nodeVisits;
	data.stats.leafVisits += stats.leafVisits;

	return hitCount;
}
