import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample, { ComputeEnergy } from "./lib/restitutionSample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

export default class SingleCircleRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 5.0 };
		camera.zoom = 8.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2Segment,
			b2Circle,
			b2DefaultShapeDef,
			b2CreateSegmentShape,
			b2BodyType,
			b2CreateCircleShape,
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

		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.5;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.material.restitution = 1.0;
		shapeDef.material.friction = 0.0;
		shapeDef.enableHitEvents = true;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set( 0.0, 10.0 );
		bodyDef.safetyFactor = 0.01;
		this.m_bodyId = b2CreateBody( this.m_worldId, bodyDef );
		b2CreateCircleShape( this.m_bodyId, shapeDef, circle );

		this.m_maxY = bodyDef.position.y;

		circle.delete();
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

		this.DrawLine( -4.0, 10.5, 4.0, 10.5, b2HexColor.b2_colorRed );

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
