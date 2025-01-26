import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import b2HexColor from '../../b2HexColor.mjs';

const e_rayCast = 0;
const e_circleCast = 1;
const e_overlap = 2;

export default class Cast extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 500.0, y: 500.0 };
		camera.zoom = 25.0 * 21;

		const {
			RandomVec2
		} = this.box2d;

		this.m_queryType = e_circleCast;
		this.m_ratio = 5.0;
		this.m_grid = 1.0;
		this.m_fill = 0.1;
		this.m_rowCount = 500;
		this.m_columnCount = 500;
		this.m_minTime = 1e6;
		this.m_drawIndex = 0;
		this.m_topDown = false;
		this.m_buildTime = 0.0;
		this.m_radius = 0.1;

		const sampleCount = 10000;
		this.m_origins = new Array(sampleCount).fill(null);
		this.m_translations = new Array(sampleCount).fill(null);
		const extent = this.m_rowCount * this.m_grid;

		// Pre-compute rays to avoid randomizer overhead
		for ( let i = 0; i < sampleCount; i++ )
		{
			const rayStart = RandomVec2( 0.0, extent );
			const rayEnd = RandomVec2( 0.0, extent );

			this.m_origins[i] = rayStart;
			this.m_translations[i] = rayEnd.Sub(rayStart);
		}

		this.Spawn();
		this.CreateUI();
	}

	Spawn(){
		const {
			b2DefaultWorldDef,
			b2CreateWorld,
			b2DestroyWorld,
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			RandomFloatRange,
			b2CreateBody,
			b2MakeBox,
			RandomIntRange,
			b2CreatePolygonShape,
			b2World_RebuildStaticTree,
			RandomFloat
		} = this.box2d;

		b2DestroyWorld( this.m_worldId );
		const worldDef = b2DefaultWorldDef();
		this.m_worldId = b2CreateWorld( worldDef );

		const timer = performance.now();

		const bodyDef = b2DefaultBodyDef();
		const shapeDef = b2DefaultShapeDef();

		let y = 0.0;

		for ( let i = 0; i < this.m_rowCount; i++ )
		{
			let x = 0.0;

			for ( let j = 0; j < this.m_columnCount; j++ )
			{
				const fillTest = RandomFloatRange( 0.0, 1.0 );
				if ( fillTest <= this.m_fill )
				{
					bodyDef.position.Set(x, y);
					const bodyId = b2CreateBody( this.m_worldId, bodyDef );

					const ratio = RandomFloatRange( 1.0, this.m_ratio );
					const halfWidth = RandomFloatRange( 0.05, 0.25 );

					let box;
					if ( RandomFloat() > 0.0 )
					{
						box = b2MakeBox( ratio * halfWidth, halfWidth );
					}
					else
					{
						box = b2MakeBox( halfWidth, ratio * halfWidth );
					}

					const category = RandomIntRange( 0, 2 );
					shapeDef.filter.categoryBits = 1 << category;
					if ( category == 0 )
					{
						shapeDef.customColor = b2HexColor.b2_colorBox2DBlue;
					}
					else if ( category == 1 )
					{
						shapeDef.customColor = b2HexColor.b2_colorBox2DYellow;
					}
					else
					{
						shapeDef.customColor = b2HexColor.b2_colorBox2DGreen;
					}

					b2CreatePolygonShape( bodyId, shapeDef, box );

					box.delete();
				}

				x += this.m_grid;
			}

			y += this.m_grid;
		}

		if ( this.m_topDown )
		{
			b2World_RebuildStaticTree( this.m_worldId );
		}

		this.m_buildTime = performance.now() - timer;
		this.m_minTime = 1e6;

		worldDef.delete();
		bodyDef.delete();
		shapeDef.delete();
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
			query: this.m_queryType,
			rows: this.m_rowCount,
			columns: this.m_columnCount,
			fill: this.m_fill,
			grid: this.m_grid,
			ratio: this.m_ratio,
			'top down': this.m_topDown,
			drawIndex: this.m_drawIndex,
		};

		this.pane.addBinding(PARAMS, 'query', {
			options: {
				e_rayCast: e_rayCast,
				e_circleCast: e_circleCast,
				e_overlap: e_overlap,
			},
		}).on('change', (event) => {
			this.m_queryType = event.value;


			if ( this.m_queryType == e_overlap )
			{
				this.m_radius = 5.0;
			}
			else
			{
				this.m_radius = 0.1;
			}


			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'rows', {
			step: 1,
			min: 0,
			max: this.m_rowCount,
		}).on('change', event => {
			this.m_rowCount = event.value;
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'columns', {
			step: 1,
			min: 0,
			max: this.m_rowCount,
		}).on('change', event => {
			this.m_columnCount = event.value;
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'fill', {
			step: 0.01,
			min: 0,
			max: 1,
		}).on('change', event => {
			this.m_fill = event.value;
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'grid', {
			step: 0.01,
			min: 0.5,
			max: 2.0,
		}).on('change', event => {
			this.m_grid = event.value;
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'ratio', {
			step: 0.1,
			min: 1.0,
			max: 10.0,
		}).on('change', event => {
			this.m_ratio = event.value;
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'top down')
		.on('change', event => {
			this.m_topDown = event.value;
			this.Spawn();
		});

		this.pane.addButton({
			title: 'draw next',
		}).on('click', () => {
			this.m_drawIndex = ( this.m_drawIndex + 1 ) % this.m_origins.length;
		});
	}

	CastCallback( rayCallbackResult, context )
	{
		const {point, fraction} = rayCallbackResult;

		const result = context;
		result.point = {x: point.x, y: point.y};
		result.fraction = fraction;
		result.hit = true;

		rayCallbackResult.delete();

		return fraction;
	}

	OverlapCallback( overlapCallbackResult, context )
	{
		const {
			b2Shape_GetAABB,
			b2AABB_Center
		} = this.box2d;

		const {shapeId} = overlapCallbackResult;

		const result = context;
		if ( result.count < 32 )
		{
			const aabb = b2Shape_GetAABB( shapeId );
			const center = b2AABB_Center( aabb );

			result.points[result.count] = {x: center.x, y: center.y};
			result.count += 1;

			aabb.delete();
			center.delete();
		}

		return true;
	}

	Step()
	{
		const {
			b2DefaultQueryFilter,
			b2World_CastRayClosest,
			b2World_CastCircle,
			b2Circle,
			b2Transform,
			b2World_OverlapAABB,
			b2AABB,
			b2Lerp,
			b2Vec2,
		} = this.box2d;

		super.Step();
		this.debugDraw.prepareCanvas();

		const filter = b2DefaultQueryFilter();
		filter.maskBits = 1;
		let hitCount = 0;
		let nodeVisits = 0;
		let leafVisits = 0;
		let ms = 0.0;
		const sampleCount = this.m_origins.length;

		if ( this.m_queryType == e_rayCast )
		{
			const timer = performance.now();

			let drawResult = {};

			for ( let i = 0; i < sampleCount; i++ )
			{
				const origin = this.m_origins[i];
				const translation = this.m_translations[i];

				const result = b2World_CastRayClosest( this.m_worldId, origin, translation, filter );

				if ( i == this.m_drawIndex )
				{
					drawResult = {point: {x: result.point.x, y: result.point.y}, hit: result.hit};
				}


				nodeVisits += result.nodeVisits;
				leafVisits += result.leafVisits;
				hitCount += result.hit ? 1 : 0;

				result.delete();
			}

			ms = performance.now() - timer;

			this.m_minTime = Math.min( this.m_minTime, ms );

			const p1 = this.m_origins[this.m_drawIndex];
			const p2 = p1.Clone().Add(this.m_translations[this.m_drawIndex]);

			const drawSegmentCommand = {
				data: [p1.x, p1.y, p2.x, p2.y],
				color: b2HexColor.b2_colorWhite,
			};
			this.debugDraw.drawSegment(drawSegmentCommand);

			const drawPointCommand = {
				data: [p1.x, p1.y, 5.0],
				color: b2HexColor.b2_colorGreen,
			};
			this.debugDraw.drawPoint(drawPointCommand);

			drawPointCommand.data = [p2.x, p2.y, 5.0];
			drawPointCommand.color = b2HexColor.b2_colorRed;

			this.debugDraw.drawPoint(drawPointCommand);


			if ( drawResult.hit )
			{
				drawPointCommand.data = [drawResult.point.x, drawResult.point.y, 5.0];
				drawPointCommand.color = b2HexColor.b2_colorWhite;
				this.debugDraw.drawPoint(drawPointCommand);
			}

			p2.delete();
		}
		else if ( this.m_queryType == e_circleCast )
		{
			const timer = performance.now();

			const circle = new b2Circle();
			circle.center.Set( 0.0, 0.0 );
			circle.radius = this.m_radius;

			let drawResult = {};

			for ( let i = 0; i < sampleCount; i++ )
			{

				const origin = new b2Transform();
				origin.p.Copy( this.m_origins[i] );
				origin.q.c = 1.0;
				origin.q.s = 0.0;

				const translation = this.m_translations[i];

				const result = {};
				const traversalResult =
					b2World_CastCircle( this.m_worldId, circle, origin, translation, filter,
										(rayCallbackResult) => this.CastCallback(rayCallbackResult, result));


				if ( i == this.m_drawIndex )
				{
					drawResult = result;
				}

				nodeVisits += traversalResult.nodeVisits;
				leafVisits += traversalResult.leafVisits;
				hitCount += result.hit ? 1 : 0;

				origin.delete();
			}

			ms = performance.now() - timer;

			this.m_minTime = Math.min( this.m_minTime, ms );

			const p1 = this.m_origins[this.m_drawIndex];
			const p2 = p1.Clone().Add(this.m_translations[this.m_drawIndex]);

			const drawSegmentCommand = {
				data: [p1.x, p1.y, p2.x, p2.y],
				color: b2HexColor.b2_colorWhite,
			};
			this.debugDraw.drawSegment(drawSegmentCommand);

			const drawPointCommand = {
				data: [p1.x, p1.y, 5.0],
				color: b2HexColor.b2_colorGreen,
			};
			this.debugDraw.drawPoint(drawPointCommand);

			drawPointCommand.data = [p2.x, p2.y, 5.0];
			drawPointCommand.color = b2HexColor.b2_colorRed;

			this.debugDraw.drawPoint(drawPointCommand);

			if ( drawResult.hit )
			{
				const t = b2Lerp( p1, p2, drawResult.fraction );

				const drawCircleCommand = {
					data: [t.x, t.y, this.m_radius],
					color: b2HexColor.b2_colorWhite,
				};

				this.debugDraw.drawCircle(drawCircleCommand);

				drawPointCommand.data = [drawResult.point.x, drawResult.point.y, 5.0];
				drawPointCommand.color = b2HexColor.b2_colorWhite;
				this.debugDraw.drawPoint(drawPointCommand);

				t.delete();
			}

			circle.delete();
			p2.delete();
		}
		else if ( this.m_queryType == e_overlap )
		{
			const timer = performance.now();

			let drawResult = {};
			const extent = new b2Vec2(this.m_radius, this.m_radius );

			for ( let i = 0; i < sampleCount; i++ )
			{
				const result = {
					count: 0,
					points: new Array(32).fill(null),
				};

				const origin = this.m_origins[i];
				const aabb = new b2AABB();
				aabb.lowerBound.Copy( origin ).Sub( extent );
				aabb.upperBound.Copy( origin ).Add( extent );

				result.count = 0;
				const traversalResult = b2World_OverlapAABB( this.m_worldId, aabb, filter,
															  (overlapCallbackResult) => this.OverlapCallback(overlapCallbackResult, result) );
				if ( i == this.m_drawIndex )
				{
					drawResult = result;
				}

				nodeVisits += traversalResult.nodeVisits;
				leafVisits += traversalResult.leafVisits;
				hitCount += result.count;

				aabb.delete();
			}

			ms = performance.now() - timer;

			this.m_minTime = Math.min( this.m_minTime, ms );

			const origin = this.m_origins[this.m_drawIndex];
			const aabb = new b2AABB();
			aabb.lowerBound.Copy( origin ).Sub( extent );
			aabb.upperBound.Copy( origin ).Add( extent );

			const drawAABBCommand = {
				data: [ aabb.lowerBound.x, aabb.lowerBound.y,
				aabb.upperBound.x, aabb.lowerBound.y,
				aabb.upperBound.x, aabb.upperBound.y,
				aabb.lowerBound.x, aabb.upperBound.y ],
				vertexCount: 4,
				color: b2HexColor.b2_colorWhite,
			};

			this.debugDraw.drawPolygon(drawAABBCommand);

			for ( let i = 0; i < drawResult.count; i++ )
			{
				const drawPointCommand = {
					data: [drawResult.points[i].x, drawResult.points[i].y, 5],
					color: b2HexColor.b2_colorHotPink,
				};

				this.debugDraw.drawPoint(drawPointCommand);
			}

			extent.delete();
			aabb.delete();
		}

		this.hitCount = hitCount;
		this.nodeVisits = nodeVisits;
		this.leafVisits = leafVisits;
		this.ms = ms;

		this.debugDraw.restoreCanvas();

		filter.delete();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		m_textLine = DrawString( 5, m_textLine, `build time ms = ${this.m_buildTime}` );

		m_textLine = DrawString( 5, m_textLine, `hit count = ${this.hitCount}, node visits = ${this.nodeVisits}, leaf visits = ${this.leafVisits}`);

		m_textLine = DrawString( 5, m_textLine, `total ms = ${this.ms}`,  );

		m_textLine = DrawString( 5, m_textLine, `min total ms = ${this.m_minTime}` );

		const aveRayCost = 1000.0 * this.m_minTime / this.m_origins.length;
		m_textLine = DrawString( 5, m_textLine, `average us = ${aveRayCost}` );

		return m_textLine;
	}

	Despawn(){
		this.m_origins.forEach(origin => origin.delete());
		this.m_translations.forEach(translation => translation.delete());
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
