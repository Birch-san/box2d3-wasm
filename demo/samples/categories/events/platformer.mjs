import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import settings from '../../settings.mjs';

export default class Platformer extends Sample{
	constructor(box2d, camera, debugDraw){
		if(settings.workerCount > 1){
			/*
			In Emscripten with pthreads, WebAssembly worker threads cannot directly call JavaScript functions or access JS objects; callbacks must be proxied to the main thread.
			*/
			console.warn("PreSolve is not compatible with multiple workers");
			settings.workerCount = 1;
		}
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.5, y: 7.5 };
		camera.zoom = 25.0 * 0.4;

		this.m_radius;
		this.m_force = 25.0;
		this.m_impulse = 25.0;
		this.m_jumpDelay = 0.25;
		this.m_jumping = false;
		this.m_movingPlatformId = null;
		this.m_playerId = null;
		this.m_playerShapeId = null;

		const {
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2CreateCapsuleShape,
			b2CreatePolygonShape,
			b2CreateSegmentShape,
			b2MakeBox,
			b2Segment,
			b2World_SetPreSolveCallback,
			b2DefaultShapeDef,
			b2Capsule
		} = this.box2d;

		this.m_callback = b2World_SetPreSolveCallback( this.m_worldId, this.PreSolve);

		// Ground
		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );
			const shapeDef = b2DefaultShapeDef();
			const segment = new b2Segment();
			segment.point1.Set(-20.0, 0.0);
			segment.point2.Set(20.0, 0.0);

			b2CreateSegmentShape( groundId, shapeDef, segment );

			bodyDef.delete();
			shapeDef.delete();
			segment.delete();
		}

		// Static Platform
		// This tests pre-solve with continuous collision
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_staticBody;
			bodyDef.position.Set(-6.0, 6.0);
			const bodyId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();

			// Need to turn this on to get the callback
			shapeDef.enablePreSolveEvents = true;

			const box = b2MakeBox( 2.0, 0.5 );
			b2CreatePolygonShape( bodyId, shapeDef, box );

			bodyDef.delete();
			shapeDef.delete();
			box.delete();
		}

		// Moving Platform
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_kinematicBody;
			bodyDef.position.Set(0.0, 6.0);
			bodyDef.linearVelocity.Set(2.0, 0.0);
			this.m_movingPlatformId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();

			// Need to turn this on to get the callback
			shapeDef.enablePreSolveEvents = true;

			const box = b2MakeBox( 3.0, 0.5 );
			b2CreatePolygonShape( this.m_movingPlatformId, shapeDef, box );

			bodyDef.delete();
			shapeDef.delete();
			box.delete();
		}

		// Player
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.motionLocks.angularZ = true;
			bodyDef.linearDamping = 0.5;
			bodyDef.position.Set(0.0, 1.0);
			this.m_playerId = b2CreateBody( this.m_worldId, bodyDef );

			this.m_radius = 0.5;
			const capsule = new b2Capsule();
			capsule.center1.Set( 0.0, -0.5 );
			capsule.center2.Set( 0.0, 0.5 );
			capsule.radius = this.m_radius;
			const shapeDef = b2DefaultShapeDef();
			shapeDef.material.friction = 0.1;

			this.m_playerShapeId = b2CreateCapsuleShape( this.m_playerId, shapeDef, capsule );

			bodyDef.delete();
			shapeDef.delete();
			capsule.delete();
		}

		this.m_force = 25.0;
		this.m_impulse = 25.0;
		this.m_jumpDelay = 0.25;
		this.m_jumping = false;
		this.canJump = false;
		this.platformContactData = null;

		this.CreateUI();
	}

	PreSolve = ( shapeIdA, shapeIdB, point, normal ) =>
	{

		const {
			b2Shape_IsValid,
			B2_ID_EQUALS,
		} = this.box2d;

		console.assert( b2Shape_IsValid( shapeIdA ) );
		console.assert( b2Shape_IsValid( shapeIdB ) );

		let sign = 0.0;
		if ( B2_ID_EQUALS( shapeIdA, this.m_playerShapeId ) )
		{
			sign = -1.0;
		}
		else if ( B2_ID_EQUALS( shapeIdB, this.m_playerShapeId ) )
		{
			sign = 1.0;
		}
		else
		{
			// not colliding with the player, enable contact
			return true;
		}

		if ( sign * normal.y > 0.95 )
		{
			return true;
		}

		// normal points down, disable contact
		return false;
	}

	Despawn(){
		Keyboard.HideTouchControls();

		const {
			b2World_DeleteCallback
		} = this.box2d;

		b2World_DeleteCallback(this.m_callback );
	}

	Step(){
		const {
			b2Body_GetLinearVelocity,
			b2Body_GetContactCapacity,
			b2Body_GetContactData,
			b2Shape_GetBody,
			b2Body_ApplyForceToCenter,
			b2Body_ApplyLinearImpulseToCenter,
			b2Body_SetLinearVelocity,
			b2Body_GetPosition,
			B2_ID_EQUALS,
			b2Vec2
		} = this.box2d;

		let canJump = false;
		const velocity = b2Body_GetLinearVelocity( this.m_playerId );
		if ( this.m_jumpDelay == 0.0 && this.m_jumping == false && velocity.y < 0.01 )
		{
			let capacity = b2Body_GetContactCapacity( this.m_playerId );
			capacity = Math.min( capacity, 4 );
			const contactData = b2Body_GetContactData( this.m_playerId, capacity );

			for ( let i = 0; i < contactData.length; i++ )
			{
				const bodyIdA = b2Shape_GetBody( contactData[i].shapeIdA );
				let sign = 0.0;
				if ( B2_ID_EQUALS( bodyIdA, this.m_playerId ) )
				{
					// normal points from A to B
					sign = -1.0;
				}
				else
				{
					sign = 1.0;
				}

				const shouldBeAbleToJump = sign * contactData[i].manifold.normal.y > 0.9;

				contactData[i].delete();

				if ( shouldBeAbleToJump )
				{
					canJump = true;
					break;
				}
			}
		}
		velocity.delete();

		// A kinematic body is moved by setting its velocity. This
		// ensure friction works correctly.
		const platformPosition = b2Body_GetPosition( this.m_movingPlatformId );
		const force = new b2Vec2();
		if ( platformPosition.x < -15.0 )
		{
			b2Body_SetLinearVelocity( this.m_movingPlatformId, force.Set(2.0, 0.0) );
		}
		else if ( platformPosition.x > 15.0 )
		{
			b2Body_SetLinearVelocity( this.m_movingPlatformId, force.Set(-2.0, 0.0) );
		}

		if ( Keyboard.IsDown(Key.A) )
		{
			b2Body_ApplyForceToCenter( this.m_playerId, force.Set(-this.m_force, 0.0 ), true );
		}

		if ( Keyboard.IsDown(Key.D) )
		{
			b2Body_ApplyForceToCenter( this.m_playerId, force.Set(this.m_force, 0.0 ), true );
		}
		platformPosition.delete();
		force.delete();

		if ( Keyboard.IsPressed(Key.Space) )
		{
			if ( canJump )
			{
				const force = new b2Vec2(0.0, this.m_impulse );
				b2Body_ApplyLinearImpulseToCenter( this.m_playerId, force, true );
				this.m_jumpDelay = 0.5;
				this.m_jumping = true;
				force.delete();
			}
		}
		else
		{
			this.m_jumping = false;
		}


		super.Step();

		this.platformContactData = b2Body_GetContactData( this.m_movingPlatformId, 1 );
		this.canJump = canJump;

		if ( settings.hertz > 0.0 )
		{
			this.m_jumpDelay = Math.max( 0.0, this.m_jumpDelay - 1.0 / settings.hertz );
		}
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

		this.pane.addButton({
			title: this.m_touchKeyboard ? 'hide touch keyboard' : 'show touch keyboard',
		}).on('click', () => {
			this.m_touchKeyboard = !this.m_touchKeyboard;

			if (this.m_touchKeyboard){
				Keyboard.ShowTouchControls([Key.A, Key.D, Key.Space]);
			} else {
				Keyboard.HideTouchControls();
			}

			this.CreateUI();
		});

		const PARAMS = {
			force: this.m_force,
			impulse: this.m_impulse,
		};

		this.pane.addBinding(PARAMS, 'force', {
			step: 0.1,
			min: 0.0,
			max: 50.0,
		}).on('change', event => {
			this.m_force = event.value;
		});

		this.pane.addBinding(PARAMS, 'impulse', {
			step: 0.1,
			min: 0.0,
			max: 50.0,
		}).on('change', event => {
			this.m_impulse = event.value;
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const contactCount = this.platformContactData?.length;
		const pointCount = this.platformContactData?.[0]?.manifold?.pointCount || 0;
		this.platformContactData?.[0]?.delete();

		m_textLine = DrawString( 5, m_textLine, `Platform contact count = ${contactCount}, point count = ${pointCount}`);
		m_textLine = DrawString( 5, m_textLine, "Movement: A/D/Space" );
		m_textLine = DrawString( 5, m_textLine, `Can jump = ${this.canJump ? "true" : "false"}`);

		m_textLine = DrawString( 5, m_textLine, "*** Note: PreSolve is not compatible with workers, only single threaded. ***" );
	}

	Destroy(){
		super.Destroy();
		this.Despawn();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
