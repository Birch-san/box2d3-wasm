import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

const ShapeType = {
	e_circleShape: 0,
	e_capsuleShape: 1,
	e_boxShape: 2,
};

const m_segmentCount = 32;
const m_pointCount = m_segmentCount + 3;

// Loose chain segments: a wavy ground built from individual chain segment shapes (no b2ChainId).
// Each segment carries its own ghost vertices so shapes slide smoothly across the joins.
// Mutate raises one vertex at a time and patches the three segments that reference it.
export default class ChainSegment extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 0.0 };
		camera.zoom = 25.0 * 1.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreateChainSegmentShape,
		} = this.box2d;

		this.m_bodyId = null;
		this.m_shapeType = ShapeType.e_circleShape;
		this.m_mutateIndex = 0;
		this.m_points = new Array(m_pointCount);
		this.m_segmentShapes = new Array(m_segmentCount);

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			// Walk right-to-left so the right-perpendicular normal of (point2 - point1) points up.
			for ( let i = 0; i < m_pointCount; ++i )
			{
				const x = 25.0 - 50.0 * i / ( m_pointCount - 1 );
				const y = 1.5 * Math.sin( 0.18 * x );
				this.m_points[i] = { x, y };
			}

			const shapeDef = b2DefaultShapeDef();
			for ( let i = 0; i < m_segmentCount; ++i )
			{
				const chainSegment = this.MakeChainSegment( i );
				this.m_segmentShapes[i] = b2CreateChainSegmentShape( groundId, shapeDef, chainSegment );
				chainSegment.delete();
			}

			bodyDef.delete();
			shapeDef.delete();
		}

		this.Launch();

		this.CreateUI();
	}

	// The segment from m_points[first + 1] to m_points[first + 2] with ghosts m_points[first] and m_points[first + 3]
	MakeChainSegment(first){
		const {
			b2ChainSegment,
		} = this.box2d;

		const p = this.m_points;
		const chainSegment = new b2ChainSegment();
		chainSegment.ghost1.Set( p[first].x, p[first].y );
		chainSegment.segment.point1.Set( p[first + 1].x, p[first + 1].y );
		chainSegment.segment.point2.Set( p[first + 2].x, p[first + 2].y );
		chainSegment.ghost2.Set( p[first + 3].x, p[first + 3].y );
		chainSegment.chainId = -1;
		return chainSegment;
	}

	Launch(){
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DestroyBody,
			b2DefaultShapeDef,
			b2CreateCircleShape,
			b2CreateCapsuleShape,
			b2CreatePolygonShape,
			b2Circle,
			b2Capsule,
			b2MakeSquare,
			b2BodyType,
		} = this.box2d;

		if ( this.m_bodyId != null )
		{
			b2DestroyBody( this.m_bodyId );
		}

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set( -18.0, 5.0 );
		this.m_bodyId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		if ( this.m_shapeType == ShapeType.e_circleShape )
		{
			const circle = new b2Circle();
			circle.center.Set( 0.0, 0.0 );
			circle.radius = 0.25;
			b2CreateCircleShape( this.m_bodyId, shapeDef, circle );
			circle.delete();
		}
		else if ( this.m_shapeType == ShapeType.e_capsuleShape )
		{
			const capsule = new b2Capsule();
			capsule.center1.Set( -0.5, 0.0 );
			capsule.center2.Set( 0.5, 0.0 );
			capsule.radius = 0.25;
			b2CreateCapsuleShape( this.m_bodyId, shapeDef, capsule );
			capsule.delete();
		}
		else
		{
			const box = b2MakeSquare( 0.5 );
			b2CreatePolygonShape( this.m_bodyId, shapeDef, box );
			box.delete();
		}

		bodyDef.delete();
		shapeDef.delete();
	}

	Mutate(){
		const {
			b2Shape_SetChainSegment,
		} = this.box2d;

		// Get an index in [1,pointCount - 2]
		// index 0 and pointCount-1 are ghost vertices and are not mutated
		const index = this.m_mutateIndex + 1;
		console.assert( 1 <= index && index <= m_pointCount - 2 );

		this.m_mutateIndex += 1;
		if ( this.m_mutateIndex == m_segmentCount )
		{
			this.m_mutateIndex = 0;
		}

		this.m_points[index].y += 0.25;

		// the segment that starts at the mutated point
		console.assert( 0 <= index - 1 && index - 1 < m_segmentCount );
		const cs = this.MakeChainSegment( index - 1 );
		b2Shape_SetChainSegment( this.m_segmentShapes[index - 1], cs );
		cs.delete();

		// the segment that ends at the mutated point
		if ( index - 1 > 0 )
		{
			console.assert( 0 <= index - 2 && index - 2 < m_segmentCount );
			const cs2 = this.MakeChainSegment( index - 2 );
			b2Shape_SetChainSegment( this.m_segmentShapes[index - 2], cs2 );
			cs2.delete();
		}

		// the segment that uses the mutated point as its first ghost
		if ( index + 1 < m_pointCount - 2 )
		{
			console.assert( index + 3 < m_pointCount );
			console.assert( 0 <= index && index < m_segmentCount );
			const cs3 = this.MakeChainSegment( index );
			b2Shape_SetChainSegment( this.m_segmentShapes[index], cs3 );
			cs3.delete();
		}
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
			shape: this.m_shapeType,
		};

		this.pane.addBinding(PARAMS, 'shape', {
			options: {
				Circle: ShapeType.e_circleShape,
				Capsule: ShapeType.e_capsuleShape,
				Box: ShapeType.e_boxShape,
			}
		}).on('change', event => {
			this.m_shapeType = event.value;
			this.Launch();
		});

		this.pane.addButton({
			title: 'Launch',
		}).on('click', () => {
			this.Launch();
		});

		this.pane.addButton({
			title: 'Mutate',
		}).on('click', () => {
			this.Mutate();
		});
	}

	Destroy(){
		super.Destroy();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
