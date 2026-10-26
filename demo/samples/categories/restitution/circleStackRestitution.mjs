import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import RestitutionSample, { ComputeEnergy } from "./lib/restitutionSample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

const m_impactSpeed = 5.0;
const m_maxStackCount = 3;

// Similar to MeasureSupportedBounce unit test.
export default class CircleStackRestitution extends RestitutionSample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 2.5 };
		camera.zoom = 6.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeBox,
			b2CreatePolygonShape,
		} = this.box2d;

		this.m_bodyIds = new Array(m_maxStackCount + 1).fill(null);
		this.m_impactorId = null;
		this.m_bodyCount = 0;
		this.m_stackCount = 2;
		this.m_restitution = 1.0;
		this.m_startHeight = 0.0;
		this.m_coefficient = 0.0;
		this.m_startEnergy = 0.0;
		this.m_peakEnergy = 0.0;
		this.m_gravity = false;
		this.m_latched = false;
		this.m_hit = false;

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

	CreateBall(y, velocityY, restitution, hitEvents){
		const {
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DefaultShapeDef,
			b2Circle,
			b2CreateCircleShape,
		} = this.box2d;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set( 0.0, y );
		bodyDef.linearVelocity.Set( 0.0, velocityY );
		bodyDef.enableSleep = false;
		const bodyId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.material.friction = 0.0;
		shapeDef.material.restitution = restitution;
		shapeDef.enableHitEvents = hitEvents;
		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.5;
		b2CreateCircleShape( bodyId, shapeDef, circle );

		circle.delete();
		shapeDef.delete();
		bodyDef.delete();

		return bodyId;
	}

	CreateScene(){
		const {
			b2DestroyBody,
			b2World_SetGravity,
			b2Vec2,
			b2Vec2_zero,
		} = this.box2d;

		for ( let i = 0; i < this.m_bodyCount; ++i )
		{
			b2DestroyBody( this.m_bodyIds[i] );
			this.m_bodyIds[i] = null;
		}
		this.m_bodyCount = 0;

		if ( this.m_gravity )
		{
			const gravity = new b2Vec2( 0.0, -10.0 );
			b2World_SetGravity( this.m_worldId, gravity );
			gravity.delete();
		}
		else
		{
			b2World_SetGravity( this.m_worldId, b2Vec2_zero );
		}

		for ( let i = 0; i < this.m_stackCount; ++i )
		{
			this.m_bodyIds[this.m_bodyCount] = this.CreateBall( 0.5 + 1.0 * i, 0.0, 0.0, false );
			this.m_bodyCount += 1;
		}

		// Start half a step of travel above contact so the impact lands mid step, matching the test
		this.m_startHeight = 0.5 + 1.0 * this.m_stackCount + 0.5 * m_impactSpeed * ( 1.0 / 60.0 );

		this.m_impactorId = this.CreateBall( this.m_startHeight, -m_impactSpeed, this.m_restitution, true );
		this.m_bodyIds[this.m_bodyCount] = this.m_impactorId;
		this.m_bodyCount += 1;

		const energy = ComputeEnergy( this.box2d, this.m_worldId, this.m_bodyIds.slice(0, this.m_bodyCount) );
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
		} = this.box2d;

		super.Step();

		const events = b2World_GetContactEvents( this.m_worldId );
		if ( events.hitCount > 0 )
		{
			this.m_hit = true;
		}
		events.delete();

		const velocity = b2Body_GetLinearVelocity( this.m_impactorId );
		const vy = velocity.y;
		velocity.delete();

		// The rebound only means something once the impact has happened and the impactor is leaving
		if ( this.m_latched == false && this.m_hit && vy > 0.0 )
		{
			this.m_coefficient = vy / m_impactSpeed;
			this.m_latched = true;
		}

		let supportSpeed = 0.0;
		for ( let i = 0; i < this.m_stackCount; ++i )
		{
			const v = b2Body_GetLinearVelocity( this.m_bodyIds[i] );
			supportSpeed = Math.max( supportSpeed, Math.sqrt( v.x * v.x + v.y * v.y ) );
			v.delete();
		}

		this.DrawLine( -2.0, this.m_startHeight, 2.0, this.m_startHeight, b2HexColor.b2_colorRed );

		const energy = ComputeEnergy( this.box2d, this.m_worldId, this.m_bodyIds.slice(0, this.m_bodyCount) );
		const total = energy.linear + energy.angular + energy.potential;
		this.m_peakEnergy = Math.max( this.m_peakEnergy, total );

		this.DrawScreenTextLine( `impactor vy = ${vy.toFixed(3)} m/s` );

		this.DrawScreenTextLine( `coefficient = ${(vy / m_impactSpeed).toFixed(4)} live (target ${this.m_restitution.toFixed(2)})` );

		if ( this.m_latched )
		{
			this.DrawScreenTextLine( `coefficient = ${this.m_coefficient.toFixed(4)} at first rebound` );
		}

		this.DrawScreenTextLine( `support speed = ${supportSpeed.toFixed(4)} m/s` );

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
			stack: this.m_stackCount,
			gravity: this.m_gravity,
		};

		this.pane.addBinding(PARAMS, 'restitution', {
			step: 0.01,
			min: 0.0,
			max: 1.0,
		}).on('change', event => {
			this.m_restitution = event.value;
			this.CreateScene();
		});

		this.pane.addBinding(PARAMS, 'stack', {
			step: 1,
			min: 0,
			max: m_maxStackCount,
		}).on('change', event => {
			this.m_stackCount = event.value;
			this.CreateScene();
		});

		this.pane.addBinding(PARAMS, 'gravity').on('change', event => {
			this.m_gravity = event.value;
			this.CreateScene();
		});

		this.pane.addButton({
			title: 'Reset',
		}).on('click', () => {
			this.CreateScene();
		});

	}
}
