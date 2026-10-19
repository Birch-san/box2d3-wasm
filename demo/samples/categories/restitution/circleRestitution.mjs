import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample from "./lib/restitutionSample.mjs";

const m_count = 10;

export default class CircleRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 5.0 };
		camera.zoom = 10.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2Segment,
			b2Circle,
			b2DefaultShapeDef,
			b2CreateSegmentShape,
			b2BodyType,
			b2Body_SetName,
			b2CreateCircleShape,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const h = 2.0 * m_count;
			const segment = new b2Segment();
			segment.point1.Set( -h, 0.0 );
			segment.point2.Set( h, 0.0 );
			const shapeDef = b2DefaultShapeDef();

			b2CreateSegmentShape( groundId, shapeDef, segment );

			segment.delete();
			shapeDef.delete();
			bodyDef.delete();
		}

		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.5;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.material.restitution = 0.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		const dr = 1.0 / ( m_count > 1 ? m_count - 1 : 1 );
		let x = -1.0 * ( m_count - 1 );
		const dx = 2.0;

		for ( let i = 0; i < m_count; ++i )
		{
			// b2BodyDef.name is not bound, so name the bodies after creation
			const name = shapeDef.material.restitution.toFixed(2);

			bodyDef.position.Set( x, 1.0 );
			let bodyId = b2CreateBody( this.m_worldId, bodyDef );
			b2Body_SetName( bodyId, name );

			b2CreateCircleShape( bodyId, shapeDef, circle );

			bodyDef.position.Set( x, 4.0 );
			bodyId = b2CreateBody( this.m_worldId, bodyDef );
			b2Body_SetName( bodyId, name );

			b2CreateCircleShape( bodyId, shapeDef, circle );

			shapeDef.material.restitution += dr;
			x += dx;
		}

		circle.delete();
		shapeDef.delete();
		bodyDef.delete();

		this.CreateUI();
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

	}
}
