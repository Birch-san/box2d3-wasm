import Sample from "../../sample.mjs";

import CreateHuman from "../../prefabs/human.mjs";

const e_columnCount = 5;
const e_rowCount = 5;

// A pile of ragdolls in a box far from the origin, on double precision world positions.
// Port of FarRagdolls from box2d/samples/sample_world.cpp
export default class FarRagdolls extends Sample{
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
			RandomFloatRange,
			SetRandomSeed,
		} = this.box2d;

		// upstream samples start from the same random seed (RAND_SEED)
		SetRandomSeed( 12345 );

		const origin = new b2Pos( 10.0e6, 0.0 );

		camera.center = { x: origin.x, y: origin.y + 6.0 };
		camera.zoom = 10.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Copy( origin );
		const groundId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		const w = 6.0;
		const h = 12.0;
		const segment = new b2Segment();
		// floor
		segment.point1.Set( -w, 0.0 );
		segment.point2.Set( w, 0.0 );
		b2CreateSegmentShape( groundId, shapeDef, segment );
		// left wall
		segment.point1.Set( -w, 0.0 );
		segment.point2.Set( -w, h );
		b2CreateSegmentShape( groundId, shapeDef, segment );
		// right wall
		segment.point1.Set( w, 0.0 );
		segment.point2.Set( w, h );
		b2CreateSegmentShape( groundId, shapeDef, segment );

		this.m_humans = [];

		const scale = 1.0;
		const offset = new b2Vec2( 0.0, 0.0 );
		let index = 0;
		for ( let i = 0; i < e_rowCount; ++i )
		{
			for ( let j = 0; j < e_columnCount; ++j )
			{
				const x = 2.4 * scale * ( j - 0.5 * ( e_columnCount - 1 ) ) + RandomFloatRange( -0.3, 0.3 );
				const y = 2.0 + 2.2 * scale * i;
				const p = b2OffsetPos( origin, offset.Set( x, y ) );
				this.m_humans.push( CreateHuman( this.box2d, this.m_worldId, p, scale, 0.05, 1.0, 0.5, index + 1, null, false ) );
				p.delete();
				index += 1;
			}
		}

		this.m_humanCount = index;

		origin.delete();
		offset.delete();
		bodyDef.delete();
		shapeDef.delete();
		segment.delete();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const { b2IsDoublePrecision } = this.box2d;

		m_textLine = DrawString( 5, m_textLine, b2IsDoublePrecision() ? "Double precision" : "Single precision" );

		const c = this.camera.center;
		m_textLine = DrawString( 5, m_textLine, `${this.m_humanCount} ragdolls piled ${( 0.001 * c.x ).toFixed( 0 )} km from the world origin` );

		return m_textLine;
	}
}
