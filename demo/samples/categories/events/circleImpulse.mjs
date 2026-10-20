import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

// A circle hits the ground at high speed. The hit events report the approach speed, and the contact
// id of the hit event gives access to the contact impulses, so the impulse can be compared with the
// momentum of the circle.
export default class CircleImpulse extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 2.7 };
		camera.zoom = 3.4;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreateSegmentShape,
			b2Segment,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();

			const segment = new b2Segment();
			segment.point1.Set( -10.0, 0.0 );
			segment.point2.Set( 10.0, 0.0 );
			b2CreateSegmentShape( groundId, shapeDef, segment );

			bodyDef.delete();
			shapeDef.delete();
			segment.delete();
		}

		this.m_gravity = 10.0;
		this.m_restitution = 0.25;
		this.m_useGravity = false;
		this.m_useRestitution = false;
		this.m_mass = 1.0;
		this.m_bodyId = null;
		this.m_events = [];

		this.Spawn();
		this.CreateUI();
	}

	Spawn(){
		const {
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DestroyBody,
			b2DefaultShapeDef,
			b2CreateCircleShape,
			b2Circle,
			b2Body_GetMassData,
			b2Body_SetMassData,
		} = this.box2d;

		if ( this.m_bodyId !== null )
		{
			b2DestroyBody( this.m_bodyId );
			this.m_bodyId = null;
		}

		this.m_events.length = 0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.gravityScale = this.m_useGravity ? 1.0 : 0.0;
		bodyDef.linearVelocity.Set( 0.0, -25.0 );
		bodyDef.position.Set( 0.0, 5.5 );

		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.25;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.enableHitEvents = true;
		shapeDef.material.friction = 0.0;
		shapeDef.material.restitution = this.m_useRestitution ? this.m_restitution : 0.0;

		this.m_bodyId = b2CreateBody( this.m_worldId, bodyDef );

		b2CreateCircleShape( this.m_bodyId, shapeDef, circle );

		// Override mass
		const massData = b2Body_GetMassData( this.m_bodyId );
		const ratio = this.m_mass / massData.mass;
		massData.mass = this.m_mass;
		massData.rotationalInertia *= ratio;
		b2Body_SetMassData( this.m_bodyId, massData );

		massData.delete();
		bodyDef.delete();
		circle.delete();
		shapeDef.delete();
	}

	Step(){
		const {
			b2World_GetContactEvents,
			b2Contact_GetData,
		} = this.box2d;

		super.Step();

		this.debugDraw.prepareCanvas();

		const contactEvents = b2World_GetContactEvents( this.m_worldId );
		for ( let i = 0; i < contactEvents.hitCount; i++ )
		{
			const event = contactEvents.GetHitEvent(i);

			this.debugDraw.drawPoint( {data: [event.point.x, event.point.y, 10.0], color: b2HexColor.b2_colorWhite} );

			const data = b2Contact_GetData( event.contactId );

			const e = { impulse: 0.0, totalImpulse: 0.0, speed: event.approachSpeed };
			if ( data.manifold.pointCount > 0 )
			{
				const point = data.manifold.GetPoint(0);
				e.impulse = point.normalImpulse;
				e.totalImpulse = point.totalNormalImpulse;
				point.delete();
			}
			this.m_events.push( e );

			data.delete();
			event.delete();
		}
		contactEvents.delete();

		this.debugDraw.restoreCanvas();
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
			gravity: this.m_useGravity,
			restitution: this.m_useRestitution,
		};

		this.pane.addBinding(PARAMS, 'gravity').on('change', event => {
			this.m_useGravity = event.value;
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'restitution').on('change', event => {
			this.m_useRestitution = event.value;
			this.Spawn();
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const g = this.m_useGravity ? this.m_gravity : 0.0;
		const r = this.m_useRestitution ? this.m_restitution : 0.0;
		m_textLine = DrawString( 5, m_textLine, `mass = ${this.m_mass}, gravity = ${g}, restitution = ${r}` );

		for ( const e of this.m_events )
		{
			m_textLine = DrawString( 5, m_textLine, `hit speed = ${fmt(e.speed)}, hit momentum = ${fmt(this.m_mass * e.speed)}, final impulse = ${fmt(e.impulse)}, total impulse = ${fmt(e.totalImpulse)}` );
		}

		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}

// like printf %g
function fmt(value){
	return Number(value.toPrecision(6)).toString();
}
