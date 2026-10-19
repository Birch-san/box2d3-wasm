import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample, { ComputeEnergy } from "./lib/restitutionSample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

// Tests how a single bouncing box behaves.
export default class SingleBoxRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 5.0 };
		camera.zoom = 8.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2Segment,
			b2DefaultShapeDef,
			b2CreateSegmentShape,
			b2MakeBox,
			b2BodyType,
			b2CreatePolygonShape,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const segment = new b2Segment();
			segment.point1.Set( -4.0, 0.0 );
			segment.point2.Set( 4.0, 0.0 );
			const shapeDef = b2DefaultShapeDef();
			b2CreateSegmentShape( groundId, shapeDef, segment );

			segment.delete();
			shapeDef.delete();
			bodyDef.delete();
		}

		this.m_height = 5.0;
		this.m_maxY = 5.0;

		const box = b2MakeBox( 0.5, 0.5 );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.material.restitution = 1.0;
		shapeDef.material.friction = 0.0;
		shapeDef.enableHitEvents = true;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set( 0.0, this.m_height );
		bodyDef.safetyFactor = 0.01;
		this.m_bodyId = b2CreateBody( this.m_worldId, bodyDef );
		b2CreatePolygonShape( this.m_bodyId, shapeDef, box );

		box.delete();
		shapeDef.delete();
		bodyDef.delete();

		const energy = ComputeEnergy( this.box2d, this.m_worldId, [this.m_bodyId] );
		this.m_startEnergy = energy.linear + energy.angular + energy.potential;
		this.m_peakEnergy = this.m_startEnergy;

		this.CreateUI();
	}

	Step(){
		const {
			b2World_GetContactEvents,
			b2Body_GetPosition,
		} = this.box2d;

		super.Step();

		this.DrawLine( -4.0, this.m_height + 0.5, 4.0, this.m_height + 0.5, b2HexColor.b2_colorRed );

		const events = b2World_GetContactEvents( this.m_worldId );

		const p = b2Body_GetPosition( this.m_bodyId );
		if ( events.hitCount == 1 )
		{
			this.m_maxY = p.y;
		}
		else
		{
			this.m_maxY = Math.max( this.m_maxY, p.y );
		}

		p.delete();
		events.delete();

		this.DrawScreenTextLine( `maxY = ${this.m_maxY.toFixed(2)}` );

		const energy = ComputeEnergy( this.box2d, this.m_worldId, [this.m_bodyId] );
		const total = energy.linear + energy.angular + energy.potential;
		this.m_peakEnergy = Math.max( this.m_peakEnergy, total );

		this.DrawEnergyText( energy, this.m_startEnergy, this.m_peakEnergy );
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
