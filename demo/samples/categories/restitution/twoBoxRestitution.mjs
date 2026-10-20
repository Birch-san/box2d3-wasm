import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample, { ComputeEnergy } from "./lib/restitutionSample.mjs";

// Based on https://github.com/erincatto/box2d/discussions/957
export default class TwoBoxRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 3.0 };
		camera.zoom = 5.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2Segment,
			b2DefaultShapeDef,
			b2CreateSegmentShape,
			b2MakeSquare,
			b2BodyType,
			b2CreatePolygonShape,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const segment = new b2Segment();
			segment.point1.Set( -10.0, 0.0 );
			segment.point2.Set( 10.0, 0.0 );
			const shapeDef = b2DefaultShapeDef();
			b2CreateSegmentShape( groundId, shapeDef, segment );

			segment.delete();
			shapeDef.delete();
			bodyDef.delete();
		}

		const box = b2MakeSquare( 0.5 );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.material.restitution = 0.9;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		this.m_bodyIds = [null, null];

		bodyDef.position.Set( 0.0, 0.5 );
		this.m_bodyIds[0] = b2CreateBody( this.m_worldId, bodyDef );
		b2CreatePolygonShape( this.m_bodyIds[0], shapeDef, box );

		bodyDef.position.Set( bodyDef.position.x + 0.1, 6.0 );
		this.m_bodyIds[1] = b2CreateBody( this.m_worldId, bodyDef );
		b2CreatePolygonShape( this.m_bodyIds[1], shapeDef, box );

		box.delete();
		shapeDef.delete();
		bodyDef.delete();

		const energy = ComputeEnergy( this.box2d, this.m_worldId, this.m_bodyIds );
		this.m_startEnergy = energy.linear + energy.angular + energy.potential;
		this.m_peakEnergy = this.m_startEnergy;

		this.CreateUI();
	}

	Step(){
		super.Step();

		const energy = ComputeEnergy( this.box2d, this.m_worldId, this.m_bodyIds );
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
