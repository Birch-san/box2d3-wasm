import Sample from "../../sample.mjs";

// A pyramid built far from the origin to exercise double precision world positions. The contact
// solver runs in delta space, so the stack settles the same as one at the origin while the body
// transforms hold their full double coordinate.
// Port of FarPyramid from box2d/samples/sample_world.cpp (upstream also suggests recording it and
// opening it in the Replay Viewer, which the web testbed doesn't have).
export default class FarPyramid extends Sample{
	// runs on the double precision (large world) build, box2d3-wasm/double
	static precision = 'double';

	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		const {
			b2Pos,
			b2Vec2,
			b2OffsetPos,
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2CreateBody,
			b2Segment,
			b2CreateSegmentShape,
			b2MakeBox,
			b2CreatePolygonShape,
			b2BodyType,
		} = this.box2d;

		// 1e7 is exactly representable in float, so integer box offsets stay exact and a run here
		// can be compared against one at the origin.
		const origin = new b2Pos( 10.0e6, 0.0 );

		camera.center = { x: origin.x, y: origin.y + 12.0 };
		camera.zoom = 17.0;

		const h = 0.25;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Copy( origin );
		const groundId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		const segment = new b2Segment();
		segment.point1.Set( -40.0, 0.0 );
		segment.point2.Set( 40.0, 0.0 );
		b2CreateSegmentShape( groundId, shapeDef, segment );

		const box = b2MakeBox( h, h );
		bodyDef.type = b2BodyType.b2_dynamicBody;

		const offset = new b2Vec2( 0.0, 0.0 );
		const baseCount = 50;
		for ( let i = 0; i < baseCount; ++i )
		{
			const y = ( 2.0 * i + 1.0 ) * h;
			for ( let j = i; j < baseCount; ++j )
			{
				const x = ( i + 1.0 ) * h + 2.0 * ( j - i ) * h - h * baseCount;
				const position = b2OffsetPos( origin, offset.Set( x, y ) );
				bodyDef.position.Copy( position );
				position.delete();

				const bodyId = b2CreateBody( this.m_worldId, bodyDef );
				b2CreatePolygonShape( bodyId, shapeDef, box );
			}
		}

		origin.delete();
		offset.delete();
		bodyDef.delete();
		shapeDef.delete();
		segment.delete();
		box.delete();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const { b2IsDoublePrecision } = this.box2d;

		m_textLine = DrawString( 5, m_textLine, b2IsDoublePrecision() ? "Double precision" : "Single precision" );

		const c = this.camera.center;
		m_textLine = DrawString( 5, m_textLine, `view center ${( 0.001 * c.x ).toFixed( 0 )} km from world origin` );

		return m_textLine;
	}
}
