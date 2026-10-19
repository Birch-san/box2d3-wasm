import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import b2HexColor from '../../b2HexColor.mjs';
import settings from '../../settings.mjs';

// This shows how adjusting the CCD safety factor can engage continuous collision at
// lower speeds to avoid the slight overlap that happens with discrete collision detection.
// The best way to run this sample is:
// 1. press pause (P)
// 2. restart (R) or press the Drop button
// 3. then single step
// Then look at the metrics and overlap. The color of the shape gets darker when it is using
// continuous collision detection.
export default class SafetyFactor extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 3.0 };
		camera.zoom = 6.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeBox,
			b2CreatePolygonShape,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set( 0.0, -1.0 );
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();
			const box = b2MakeBox( 20.0, 1.0 );
			b2CreatePolygonShape( groundId, shapeDef, box );

			bodyDef.delete();
			shapeDef.delete();
			box.delete();
		}

		this.m_bodyId = null;
		this.m_extent = 0.5;
		this.m_height = 0.3;
		this.m_safetyFactor = 0.1;
		this.m_overlap = 0.0;

		this.Launch();

		this.CreateUI();
	}

	Launch(){
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DestroyBody,
			b2DefaultShapeDef,
			b2MakeSquare,
			b2CreatePolygonShape,
			b2BodyType,
		} = this.box2d;

		if ( this.m_bodyId != null )
		{
			b2DestroyBody( this.m_bodyId );
		}

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set( 0.0, this.m_height + this.m_extent );
		bodyDef.safetyFactor = this.m_safetyFactor;
		this.m_bodyId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		const box = b2MakeSquare( this.m_extent );
		b2CreatePolygonShape( this.m_bodyId, shapeDef, box );

		bodyDef.delete();
		shapeDef.delete();
		box.delete();

		this.m_overlap = 0.0;
	}

	Step(){
		const {
			b2Body_GetContactData,
		} = this.box2d;

		const didStep = settings.hertz > 0 && ( settings.pause == false || settings.singleStep );

		super.Step();

		if ( didStep )
		{
			// Contacts are computed at the beginning of the step, so the manifold holds the initial separation.
			const contactData = b2Body_GetContactData( this.m_bodyId, 1 );
			if ( contactData.length == 1 )
			{
				const manifold = contactData[0].manifold;
				for ( let j = 0; j < manifold.pointCount; ++j )
				{
					const point = manifold.GetPoint( j );
					this.m_overlap = Math.max( this.m_overlap, -point.separation );
					point.delete();
				}
			}

			for ( const data of contactData )
			{
				data.delete();
			}
		}

		this.debugDraw.prepareCanvas();
		this.debugDraw.drawLine( {
			data: [-3.0, -this.m_overlap, 3.0, -this.m_overlap],
			color: b2HexColor.b2_colorRed,
		} );
		this.debugDraw.restoreCanvas();
	}

	UpdateUI(DrawString, m_textLine){
		const {
			b2Body_GetLinearVelocity,
			b2Length,
		} = this.box2d;

		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const timeStep = settings.hertz > 0.0 ? 1.0 / settings.hertz : 0.0;
		const velocity = b2Body_GetLinearVelocity( this.m_bodyId );
		const motion = timeStep * b2Length( velocity );
		velocity.delete();

		m_textLine = DrawString(5, m_textLine, `actual movement = ${motion.toFixed(3)} m`);
		m_textLine = DrawString(5, m_textLine, `fast movement = ${(this.m_safetyFactor * this.m_extent).toFixed(3)} m`);
		m_textLine = DrawString(5, m_textLine, `overlap = ${this.m_overlap.toFixed(4)} m`);
		return m_textLine;
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
			height: this.m_height,
			safety: this.m_safetyFactor,
		};

		this.pane.addBinding(PARAMS, 'height', {
			step: 0.01,
			min: 0,
			max: 2,
		}).on('change', event => {
			this.m_height = event.value;
			this.Launch();
		});

		this.pane.addBinding(PARAMS, 'safety', {
			step: 0.01,
			min: 0,
			max: 1,
		}).on('change', event => {
			this.m_safetyFactor = event.value;
			this.Launch();
		});

		this.pane.addButton({
			title: 'Drop',
		}).on('click', () => {
			this.Launch();
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
