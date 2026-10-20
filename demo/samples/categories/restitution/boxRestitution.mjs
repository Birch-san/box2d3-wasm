import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample, { ComputeEnergy } from "./lib/restitutionSample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

const m_impactSpeed = 5.0;

// Similar to MeasureFlatBounce and SpinTest unit tests.
export default class BoxRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 8.0 };
		camera.zoom = 10.0;

		const {
			b2World_SetGravity,
			b2Vec2_zero,
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeBox,
			b2CreatePolygonShape,
		} = this.box2d;

		this.m_boxId = null;
		this.m_restitution = 0.9;
		this.m_spin = 0.0;
		this.m_coefficient = 0.0;
		this.m_startEnergy = 0.0;
		this.m_peakEnergy = 0.0;
		this.m_latched = false;
		this.m_hit = false;

		// Gravity would bias the measured coefficient
		b2World_SetGravity( this.m_worldId, b2Vec2_zero );

		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Set( 0.0, -1.0 );
		const groundId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.material.friction = 0.0;
		shapeDef.material.restitution = 0.0;
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
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeBox,
			b2CreatePolygonShape,
		} = this.box2d;

		if ( this.m_boxId !== null )
		{
			b2DestroyBody( this.m_boxId );
			this.m_boxId = null;
		}

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set( 0.0, 0.25 + 0.5 * m_impactSpeed * ( 1.0 / 60.0 ) );
		bodyDef.linearVelocity.Set( 0.0, -m_impactSpeed );
		bodyDef.angularVelocity = this.m_spin;
		bodyDef.enableSleep = false;
		this.m_boxId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.material.friction = 0.0;
		shapeDef.material.restitution = this.m_restitution;
		shapeDef.enableHitEvents = true;
		const box = b2MakeBox( 1.0, 0.25 );
		b2CreatePolygonShape( this.m_boxId, shapeDef, box );

		box.delete();
		shapeDef.delete();
		bodyDef.delete();

		const energy = ComputeEnergy( this.box2d, this.m_worldId, [this.m_boxId] );
		this.m_startEnergy = energy.linear + energy.angular + energy.potential;
		this.m_peakEnergy = this.m_startEnergy;

		this.m_coefficient = 0.0;
		this.m_latched = false;
		this.m_hit = false;
	}

	Step(){
		const {
			b2World_GetContactEvents,
			b2Body_GetLinearVelocity,
			b2Body_GetAngularVelocity,
			b2Body_GetWorldPoint,
			b2Vec2,
		} = this.box2d;

		super.Step();

		const events = b2World_GetContactEvents( this.m_worldId );
		if ( events.hitCount > 0 )
		{
			this.m_hit = true;
		}
		events.delete();

		const velocity = b2Body_GetLinearVelocity( this.m_boxId );
		const vy = velocity.y;
		velocity.delete();
		const w = b2Body_GetAngularVelocity( this.m_boxId );

		if ( this.m_latched == false && this.m_hit && vy > 0.0 )
		{
			this.m_coefficient = vy / m_impactSpeed;
			this.m_latched = true;
		}

		const localPoint = new b2Vec2( -1.0, -0.25 );
		let p = b2Body_GetWorldPoint( this.m_boxId, localPoint );
		this.DrawPoint( p.x, p.y, 8.0, b2HexColor.b2_colorYellow );
		p.delete();

		localPoint.Set( 1.0, -0.25 );
		p = b2Body_GetWorldPoint( this.m_boxId, localPoint );
		this.DrawPoint( p.x, p.y, 8.0, b2HexColor.b2_colorYellow );
		p.delete();
		localPoint.delete();

		const energy = ComputeEnergy( this.box2d, this.m_worldId, [this.m_boxId] );
		const total = energy.linear + energy.angular + energy.potential;
		this.m_peakEnergy = Math.max( this.m_peakEnergy, total );

		this.DrawScreenTextLine( `vy = ${vy.toFixed(3)} m/s` );

		this.DrawScreenTextLine( `coefficient = ${(vy / m_impactSpeed).toFixed(4)} live (target ${this.m_restitution.toFixed(2)})` );

		if ( this.m_latched )
		{
			this.DrawScreenTextLine( `coefficient = ${this.m_coefficient.toFixed(4)} at first rebound` );
		}

		this.DrawScreenTextLine( `spin in = ${this.m_spin.toFixed(2)}, spin out = ${w.toFixed(4)} (ideal ${(-this.m_spin).toFixed(2)} at e = 1)` );

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

		const PARAMS = {
			restitution: this.m_restitution,
			spin: this.m_spin,
		};

		this.pane.addBinding(PARAMS, 'restitution', {
			step: 0.01,
			min: 0.0,
			max: 1.0,
		}).on('change', event => {
			this.m_restitution = event.value;
			this.CreateScene();
		});

		this.pane.addBinding(PARAMS, 'spin', {
			step: 0.01,
			min: 0.0,
			max: 2.0,
		}).on('change', event => {
			this.m_spin = event.value;
			this.CreateScene();
		});

		this.pane.addButton({
			title: 'Reset',
		}).on('click', () => {
			this.CreateScene();
		});

	}
}
