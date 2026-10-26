import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample, { ComputeEnergy } from "./lib/restitutionSample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

const m_count = 12;
const m_dropHeight = 10.0;

export default class RotatedBoxRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 4.0 };
		camera.zoom = 14.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2Segment,
			b2CreateSegmentShape,
		} = this.box2d;

		this.m_bodyIds = new Array(m_count).fill(null);
		this.m_startEnergy = new Array(m_count).fill(0.0);
		this.m_restitution = 0.9;
		this.m_friction = 0.0;
		this.m_safetyFactor = 0.5;

		const bodyDef = b2DefaultBodyDef();
		const groundId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		const h = 2.0 * m_count + 1.0;
		const segment = new b2Segment();
		segment.point1.Set( -h, 0.0 );
		segment.point2.Set( h, 0.0 );
		b2CreateSegmentShape( groundId, shapeDef, segment );

		segment.delete();
		shapeDef.delete();
		bodyDef.delete();

		this.CreateScene();

		this.CreateUI();
	}

	CreateScene(){
		const {
			b2DestroyBody,
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeBox,
			b2MakeRot,
			b2CreatePolygonShape,
			B2_PI,
		} = this.box2d;

		for ( let i = 0; i < m_count; ++i )
		{
			if ( this.m_bodyIds[i] !== null )
			{
				b2DestroyBody( this.m_bodyIds[i] );
				this.m_bodyIds[i] = null;
			}
		}

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.safetyFactor = this.m_safetyFactor;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.material.friction = this.m_friction;
		shapeDef.material.restitution = this.m_restitution;

		// Boxes in a negative group never collide with each other.
		shapeDef.filter.groupIndex = -1;

		const box = b2MakeBox( 0.5, 0.5 );

		// A square repeats every quarter turn
		const dq = 0.5 * B2_PI / m_count;
		let x = -1.0 * ( m_count - 1 );

		for ( let i = 0; i < m_count; ++i )
		{
			bodyDef.position.Set( x, m_dropHeight );
			const rot = b2MakeRot( i * dq );
			bodyDef.rotation = rot;
			rot.delete();
			this.m_bodyIds[i] = b2CreateBody( this.m_worldId, bodyDef );
			b2CreatePolygonShape( this.m_bodyIds[i], shapeDef, box );

			const energy = ComputeEnergy( this.box2d, this.m_worldId, [this.m_bodyIds[i]] );
			this.m_startEnergy[i] = energy.linear + energy.angular + energy.potential;

			x += 2.0;
		}

		box.delete();
		shapeDef.delete();
		bodyDef.delete();
	}

	Step(){
		super.Step();

		const h = 1.0 * m_count;
		this.DrawLine( -h, m_dropHeight + 0.5, h, m_dropHeight + 0.5, b2HexColor.b2_colorRed );

		let minPercent = 0.0;
		let maxPercent = 0.0;
		let x = -1.0 * ( m_count - 1 );

		for ( let i = 0; i < m_count; ++i )
		{
			const energy = ComputeEnergy( this.box2d, this.m_worldId, [this.m_bodyIds[i]] );
			const total = energy.linear + energy.angular + energy.potential;

			const percent = this.m_startEnergy[i] != 0.0 ? 100.0 * total / this.m_startEnergy[i] : 0.0;
			minPercent = i == 0 ? percent : Math.min( minPercent, percent );
			maxPercent = i == 0 ? percent : Math.max( maxPercent, percent );

			this.DrawWorldString( x - 0.5, m_dropHeight + 1.5, `${percent.toFixed(1)}%` );
			x += 2.0;
		}

		this.DrawScreenTextLine( `energy: min ${minPercent.toFixed(2)}%, max ${maxPercent.toFixed(2)}% of start` );
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
			restitution: this.m_restitution,
			friction: this.m_friction,
			'safety factor': this.m_safetyFactor,
		};

		this.pane.addBinding(PARAMS, 'restitution', {
			step: 0.1,
			min: 0.0,
			max: 1.0,
		}).on('change', event => {
			this.m_restitution = event.value;
			this.CreateScene();
		});

		this.pane.addBinding(PARAMS, 'friction', {
			step: 0.1,
			min: 0.0,
			max: 1.0,
		}).on('change', event => {
			this.m_friction = event.value;
			this.CreateScene();
		});

		this.pane.addBinding(PARAMS, 'safety factor', {
			step: 0.01,
			min: 0.01,
			max: 0.5,
		}).on('change', event => {
			this.m_safetyFactor = event.value;
			this.CreateScene();
		});

		this.pane.addButton({
			title: 'Reset',
		}).on('click', () => {
			this.CreateScene();
		});

	}
}
