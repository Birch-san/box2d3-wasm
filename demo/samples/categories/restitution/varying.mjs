import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample from "./lib/restitutionSample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

const ShapeType = {
	e_circleShape: 0,
	e_boxShape: 1,
};

const m_count = 40;

// Restitution is approximate since Box2D uses speculative collision
export default class VaryingRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 4.0, y: 17.0 };
		camera.zoom = 27.5;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2Segment,
			b2DefaultShapeDef,
			b2CreateSegmentShape,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const h = 1.0 * m_count;
			const segment = new b2Segment();
			segment.point1.Set( -h, 0.0 );
			segment.point2.Set( h, 0.0 );
			const shapeDef = b2DefaultShapeDef();
			b2CreateSegmentShape( groundId, shapeDef, segment );

			segment.delete();
			shapeDef.delete();
			bodyDef.delete();
		}

		this.m_bodyIds = new Array(m_count).fill(null);
		this.m_shapeType = ShapeType.e_circleShape;

		this.CreateBodies();

		this.CreateUI();
	}

	CreateBodies(){
		const {
			b2DestroyBody,
			b2Circle,
			b2MakeBox,
			b2DefaultShapeDef,
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2Body_SetName,
			b2CreateCircleShape,
			b2CreatePolygonShape,
		} = this.box2d;

		for ( let i = 0; i < m_count; ++i )
		{
			if ( this.m_bodyIds[i] !== null )
			{
				b2DestroyBody( this.m_bodyIds[i] );
				this.m_bodyIds[i] = null;
			}
		}

		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.5;

		const box = b2MakeBox( 0.5, 0.5 );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.material.restitution = 0.0;
		shapeDef.material.friction = 0.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		const dr = 1.0 / ( m_count > 1 ? m_count - 1 : 1 );
		let x = -1.0 * ( m_count - 1 );
		const dx = 2.0;

		for ( let i = 0; i < m_count; ++i )
		{
			bodyDef.position.Set( x, 40.0 );
			const bodyId = b2CreateBody( this.m_worldId, bodyDef );
			// b2BodyDef.name is not bound, so name the body after creation
			b2Body_SetName( bodyId, shapeDef.material.restitution.toFixed(2) );

			this.m_bodyIds[i] = bodyId;

			if ( this.m_shapeType == ShapeType.e_circleShape )
			{
				b2CreateCircleShape( bodyId, shapeDef, circle );
			}
			else
			{
				b2CreatePolygonShape( bodyId, shapeDef, box );
			}

			shapeDef.material.restitution += dr;
			x += dx;
		}

		circle.delete();
		box.delete();
		shapeDef.delete();
		bodyDef.delete();
	}

	Step(){
		super.Step();

		const h = 1.0 * m_count;
		this.DrawLine( -h, 40.5, h, 40.5, b2HexColor.b2_colorRed );
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
				Box: ShapeType.e_boxShape,
			}
		}).on('change', event => {
			this.m_shapeType = event.value;
			this.CreateBodies();
		});

		this.pane.addButton({
			title: 'Reset',
		}).on('click', () => {
			this.CreateBodies();
		});

	}
}
