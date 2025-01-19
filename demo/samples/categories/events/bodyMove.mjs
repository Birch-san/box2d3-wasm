import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import b2HexColor from '../../b2HexColor.mjs';

import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import settings from '../../settings.mjs';

const e_count = 50;

export default class BodyMove extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 2.0, y: 8.0 };
		camera.zoom = 25.0 * 0.55;

		this.m_sleepCount = 0;
		this.m_count = 0;
		this.m_bodyIds = new Array(e_count);
		this.m_sleeping = new Array(e_count);
		this.m_userData = {};

		const {
			b2Vec2,
			b2DefaultBodyDef,
			b2MakeOffsetBox,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeRot,
			B2_PI,
			b2Rot_identity
		} = this.box2d;

		this.m_explosionPosition = new b2Vec2(0.0, -5.0 );
		this.m_explosionRadius = 10.0;
		this.m_explosionMagnitude = 10.0;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();
			shapeDef.friction = 0.1;

			let box = b2MakeOffsetBox( 12.0, 0.1, new b2Vec2(-10.0, -0.1), b2MakeRot( -0.15 * B2_PI ) );
			b2CreatePolygonShape( groundId, shapeDef, box );

			box = b2MakeOffsetBox( 12.0, 0.1, new b2Vec2(10.0, -0.1 ), b2MakeRot( 0.15 * B2_PI ) );
			b2CreatePolygonShape( groundId, shapeDef, box );

			shapeDef.restitution = 0.8;

			box = b2MakeOffsetBox( 0.1, 10.0, new b2Vec2(19.9, 10.0 ), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );

			box = b2MakeOffsetBox( 0.1, 10.0, new b2Vec2(-19.9, 10.0 ), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );

			box = b2MakeOffsetBox( 20.0, 0.1, new b2Vec2(0.0, 20.1 ), b2Rot_identity );
			b2CreatePolygonShape( groundId, shapeDef, box );
		}

		this.CreateUI();
	}

	CreateBodies()
	{
		const {
			b2Capsule,
			b2Circle,
			b2BodyType,
			b2MakeSquare,
			b2CreateCapsuleShape,
			b2CreateCircleShape,
			b2CreatePolygonShape,
			RandomPolygon,
			b2CreateBody,
			b2Body_GetPointer,
			b2DefaultBodyDef,
			b2DefaultShapeDef
		} = this.box2d;

		const capsule = new b2Capsule();
		capsule.center1.Set( -0.25, 0.0 );
		capsule.center2.Set( 0.25, 0.0 );
		capsule.radius = 0.25;

		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.35;

		const square = b2MakeSquare( 0.35 );

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		const shapeDef = b2DefaultShapeDef();

		let x = -5.0, y = 10.0;
		for ( let i = 0; i < 10 && this.m_count < e_count; i++ )
		{
			bodyDef.position.Set(x, y);
			this.m_bodyIds[this.m_count] = b2CreateBody( this.m_worldId, bodyDef );

			const bodyPointer = b2Body_GetPointer( this.m_bodyIds[this.m_count] );
			this.m_userData[bodyPointer] = this.m_count;

			this.m_sleeping[this.m_count] = false;

			const remainder = this.m_count % 4;
			if ( remainder == 0 )
			{
				b2CreateCapsuleShape( this.m_bodyIds[this.m_count], shapeDef, capsule );
			}
			else if ( remainder == 1 )
			{
				// b2CreateCircleShape( this.m_bodyIds[this.m_count], shapeDef, circle );
				b2CreateCapsuleShape( this.m_bodyIds[this.m_count], shapeDef, capsule );

			}
			else if ( remainder == 2 )
			{
				b2CreatePolygonShape( this.m_bodyIds[this.m_count], shapeDef, square );
			}
			else
			{
				const poly = RandomPolygon( 0.75 );
				poly.radius = 0.1;
				b2CreatePolygonShape( this.m_bodyIds[this.m_count], shapeDef, poly );
			}

			this.m_count += 1;
			x += 1.0;
		}
	}

	Despawn(){
		Keyboard.HideTouchControls();
	}

	Step(){
		const {
			b2World_GetBodyEvents,
			b2Body_GetPointer,
		} = this.box2d;

		if ( settings.pause == false && ( this.m_stepCount & 15 ) == 15 && this.m_count < e_count )
			{
				this.CreateBodies();
			}

		super.Step();

		this.debugDraw.prepareCanvas();

		// Process body events
		const bodyEvents = b2World_GetBodyEvents( this.m_worldId );
		const moveEvents = bodyEvents.GetMoveEvents();
		for ( let i = 0; i < bodyEvents.moveCount; ++i )
		{
			// draw the transform of every body that moved (not sleeping)
			const event = moveEvents[i];

			const drawCommandTransform = {
				data: [
					event.transform.p.x,
					event.transform.p.y,
					event.transform.q.s,
					event.transform.q.c
				]
			}

			this.debugDraw.drawTransform( drawCommandTransform );

			// this shows a somewhat contrived way to track body sleeping
			const bodyPointer = b2Body_GetPointer( event.bodyId );
			const bodyIndex = this.m_userData[bodyPointer];

			if ( event.fellAsleep )
			{
				this.m_sleeping[bodyIndex] = true;
				this.m_sleepCount += 1;
			}
			else
			{
				if (this.m_sleeping[bodyIndex] )
				{
					this.m_sleeping[bodyIndex] = false;
					this.m_sleepCount -= 1;
				}
			}
		}

		const drawCircleCommand = {
			data: [
				this.m_explosionPosition.x,
				this.m_explosionPosition.y,
				this.m_explosionRadius
			],
			color: b2HexColor.b2_colorAzure
		}

		this.debugDraw.drawCircle( drawCircleCommand );

		this.debugDraw.restoreCanvas();

		bodyEvents.delete();
		moveEvents.forEach(moveEvent => {
			moveEvent.transform.delete();
		});
	}

	CreateUI(){
		const {
			b2DefaultExplosionDef,
			b2World_Explode
		} = this.box2d;

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
			title: 'Explode',
		}).on('click', () => {
			const def = b2DefaultExplosionDef();
			def.position.Copy(this.m_explosionPosition);
			def.radius = this.m_explosionRadius;
			def.falloff = 0.1;
			def.impulsePerLength = this.m_explosionMagnitude;
			b2World_Explode( this.m_worldId, def );
		});

		const PARAMS = {
			magnitude: this.m_explosionMagnitude,
			radius: this.m_explosionRadius,
		};

		this.pane.addBinding(PARAMS, 'magnitude', {
			step: 0.1,
			min: -20.0,
			max: 20.0,
		}).on('change', event => {
			this.m_explosionMagnitude = event.value;
		});

		this.pane.addBinding(PARAMS, 'radius', {
			step: 0.1,
			min: 1.0,
			max: 20.0,
		}).on('change', event => {
			this.m_explosionRadius = event.value;
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);
		DrawString( 5, m_textLine, `sleep count: ${this.m_sleepCount}` );
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
