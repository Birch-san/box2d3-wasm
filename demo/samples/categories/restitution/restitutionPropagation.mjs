import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample from "./lib/restitutionSample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

const m_columnCount = 3;
const m_dropHeight = 5.0;
const labels = [ "ground", "one crate", "two crates" ];

// A bouncy ball landing on a resting body. Three balls fall together from the same height onto bare
// ground, one crate and two crates. Without restitution propagation the restitution stage only
// visits the ball's own contact, so the rebound is shared with the crate, which is driven into the
// ground and pushed back the next step. With propagation the ground contact under the crate can react
// in the restitution solver. Toggle "bounce propagation" in the Solver folder to compare.
export default class RestitutionPropagation extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 4.0 };
		camera.zoom = 10.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeBox,
			b2CreatePolygonShape,
		} = this.box2d;

		this.m_bodyIds = new Array(2 * m_columnCount).fill(null);
		this.m_ballIds = new Array(m_columnCount).fill(null);
		this.m_crateIds = new Array(m_columnCount).fill(null);
		this.m_restHeight = new Array(m_columnCount).fill(0.0);
		this.m_apex = new Array(m_columnCount).fill(0.0);
		this.m_rebounding = new Array(m_columnCount).fill(false);
		this.m_done = new Array(m_columnCount).fill(false);
		this.m_bodyCount = 0;
		this.m_crateCount = 0;
		this.m_restitution = 0.9;
		this.m_kick = 0.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Set( 0.0, -1.0 );
		const groundId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.material.friction = 0.6;
		const box = b2MakeBox( 40.0, 1.0 );
		b2CreatePolygonShape( groundId, shapeDef, box );

		box.delete();
		shapeDef.delete();
		bodyDef.delete();

		this.CreateScene();

		this.CreateUI();
	}

	CreateScene(){
		const {
			b2DestroyBody,
			b2MakeBox,
			b2Circle,
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2CreateCircleShape,
		} = this.box2d;

		for ( let i = 0; i < this.m_bodyCount; ++i )
		{
			b2DestroyBody( this.m_bodyIds[i] );
			this.m_bodyIds[i] = null;
		}
		this.m_bodyCount = 0;
		this.m_crateCount = 0;
		this.m_kick = 0.0;

		const box = b2MakeBox( 0.5, 0.5 );
		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.5;

		for ( let column = 0; column < m_columnCount; ++column )
		{
			const x = 4.0 * ( column - 1 );

			for ( let k = 0; k < column; ++k )
			{
				const bodyDef = b2DefaultBodyDef();
				bodyDef.type = b2BodyType.b2_dynamicBody;
				bodyDef.position.Set( x, 0.5 + 1.0 * k );
				bodyDef.enableSleep = false;
				const crateId = b2CreateBody( this.m_worldId, bodyDef );

				const shapeDef = b2DefaultShapeDef();
				b2CreatePolygonShape( crateId, shapeDef, box );

				this.m_bodyIds[this.m_bodyCount++] = crateId;
				this.m_crateIds[this.m_crateCount++] = crateId;

				shapeDef.delete();
				bodyDef.delete();
			}

			this.m_restHeight[column] = 0.5 + 1.0 * column;

			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Set( x, this.m_restHeight[column] + m_dropHeight );
			bodyDef.enableSleep = false;
			const ballId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();
			shapeDef.material.restitution = this.m_restitution;
			b2CreateCircleShape( ballId, shapeDef, circle );

			this.m_bodyIds[this.m_bodyCount++] = ballId;
			this.m_ballIds[column] = ballId;
			this.m_apex[column] = 0.0;
			this.m_rebounding[column] = false;
			this.m_done[column] = false;

			shapeDef.delete();
			bodyDef.delete();
		}

		box.delete();
		circle.delete();
	}

	Step(){
		const {
			b2Body_GetLinearVelocity,
			b2Body_GetPosition,
		} = this.box2d;

		super.Step();

		for ( let column = 0; column < m_columnCount; ++column )
		{
			const v = b2Body_GetLinearVelocity( this.m_ballIds[column] );
			const vy = v.y;
			v.delete();

			const p = b2Body_GetPosition( this.m_ballIds[column] );
			const height = p.y - this.m_restHeight[column];
			p.delete();

			// The first rebound apex: the ball starts at rest and falls, so upward velocity means it bounced
			if ( this.m_rebounding[column] == false && vy > 0.0 )
			{
				this.m_rebounding[column] = true;
			}

			if ( this.m_rebounding[column] && this.m_done[column] == false )
			{
				this.m_apex[column] = Math.max( this.m_apex[column], height );
				if ( vy < 0.0 )
				{
					this.m_done[column] = true;
				}
			}

			const x = 4.0 * ( column - 1 );
			this.DrawLine( x - 1.0, this.m_restHeight[column] + m_dropHeight,
				x + 1.0, this.m_restHeight[column] + m_dropHeight, b2HexColor.b2_colorRed );
			if ( this.m_apex[column] > 0.0 )
			{
				this.DrawLine( x - 1.0, this.m_restHeight[column] + this.m_apex[column],
					x + 1.0, this.m_restHeight[column] + this.m_apex[column], b2HexColor.b2_colorGreen );
			}

			this.DrawScreenTextLine( `${labels[column]}: apex ${this.m_apex[column].toFixed(2)} m (${(100.0 * this.m_apex[column] / m_dropHeight).toFixed(0)}% of drop)` );
		}

		for ( let i = 0; i < this.m_crateCount; ++i )
		{
			const v = b2Body_GetLinearVelocity( this.m_crateIds[i] );
			this.m_kick = Math.max( this.m_kick, Math.sqrt( v.x * v.x + v.y * v.y ) );
			v.delete();
		}

		this.DrawScreenTextLine( `peak crate speed ${this.m_kick.toFixed(2)} m/s` );
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
		};

		this.pane.addBinding(PARAMS, 'restitution', {
			step: 0.01,
			min: 0.0,
			max: 1.0,
		}).on('change', event => {
			this.m_restitution = event.value;
			this.CreateScene();
		});

		this.pane.addButton({
			title: 'Reset',
		}).on('click', () => {
			this.CreateScene();
		});

	}
}
