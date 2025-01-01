import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import settings from '../../settings.mjs';
import Keyboard, { Key } from '../../../utils/keyboard.mjs';

const params = new URLSearchParams(window.location.search);

export default class SensorBooked extends Sample{
	constructor(box2d, camera){
		super(box2d, camera);

		camera.center = {x: 0.0, y: 6.0 };
		camera.zoom = 7.5;

		this.m_playerId = null;
		this.m_sensorId = null;


		const {
			b2DefaultBodyDef,
			b2Vec2,
			b2CreateBody,
			b2CreateChain,
			b2DefaultChainDef,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2CreateCapsuleShape,
			b2BodyType,
			b2Rot_identity,
			b2Capsule,
			b2MakeOffsetBox
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const points = new Array(20);
			let x = 10.0;
			for ( let i = 0; i < 20; i++ )
			{
				points[i] = { x, y: 0.0 };
				x -= 1.0;
			}

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints( points );
			chainDef.isLoop = false;

			b2CreateChain( groundId, chainDef );
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.fixedRotation = true;
			bodyDef.position.Set(0.0, 1.0);
			this.m_playerId = b2CreateBody( this.m_worldId, bodyDef );
			const shapeDef = b2DefaultShapeDef();
			shapeDef.friction = 0.3;

			const capsule = new b2Capsule();
			capsule.center1.Set( 0.0, -0.5 );
			capsule.center2.Set( 0.0, 0.5 );
			capsule.radius = 0.5;
			b2CreateCapsuleShape( this.m_playerId, shapeDef, capsule );

			const box = b2MakeOffsetBox( 0.5, 0.25, new b2Vec2(0.0, -1.0 ), b2Rot_identity );
			shapeDef.isSensor = true;
			this.m_sensorId = b2CreatePolygonShape( this.m_playerId, shapeDef, box );
		}

		this.m_overlapCount = 0;
		this.m_overlapPoints = [];

		this.Spawn();
		this.CreateUI();
	}

	Spawn(){
	}

	Despawn(){
	}

	Step(){
		const {
			b2Body_ApplyForceToCenter,
			b2World_GetSensorEvents,
			b2Vec2,
			b2Shape_GetSensorCapacity,
			b2Shape_GetSensorOverlaps,
			B2_ID_EQUALS,
			b2Shape_GetAABB,
			b2AABB_Center,
		} = this.box2d;


		if ( Keyboard.IsDown(Key.A))
		{
			b2Body_ApplyForceToCenter( this.m_playerId, new b2Vec2(-50.0, 0.0 ), true );
		}

		if ( Keyboard.IsDown(Key.D) )
		{
			b2Body_ApplyForceToCenter( this.m_playerId, new b2Vec2(50.0, 0.0 ), true );
		}

		super.Step();

		const sensorEvents = b2World_GetSensorEvents( this.m_worldId );
		const beginEvents = sensorEvents.GetBeginEvents();

		for ( let i = 0; i < beginEvents.length; i++ )
		{
			const event = beginEvents[i];

			console.assert(B2_ID_EQUALS( event.visitorShapeId, this.m_sensorId ) === false);

			if ( B2_ID_EQUALS( event.sensorShapeId, this.m_sensorId ) )
			{
				this.m_overlapCount += 1;
			}
		}

		const endEvents = sensorEvents.GetEndEvents();

		for ( let i = 0; i < endEvents.length; ++i )
		{
			const event = endEvents[i];

			console.assert(B2_ID_EQUALS( event.visitorShapeId, this.m_sensorId ) === false);
			if ( B2_ID_EQUALS( event.sensorShapeId, this.m_sensorId ) )
			{
				this.m_overlapCount -= 1;
			}
		}

		const capacity = b2Shape_GetSensorCapacity( this.m_sensorId );
		const overlaps = b2Shape_GetSensorOverlaps( this.m_sensorId, capacity );

		this.m_overlapPoints.length = 0;

		for ( let i = 0; i < overlaps.length; i++ )
		{
			const shapeId = overlaps[i];
			const aabb = b2Shape_GetAABB( shapeId );
			const point = b2AABB_Center( aabb );
			this.m_overlapPoints.push(point);
		}
	}

	CreateUI(){
		super.CreateUI();

		const container = document.getElementById('sample-settings');


		this.pane = new Pane({
			title: 'Sample Settings',
			expanded: true,
			container
		});

		if(!this.m_sensorBodyId){
			this.pane.addButton({
				title: 'create sensor',
			}).on('click', () => {
				this.CreateSensor();
				this.CreateUI();
			});
		}

	}

	UpdateUI(DrawString, m_textLine, debugDraw){
		super.UpdateUI(DrawString, m_textLine);

		DrawString( 5, m_textLine, `count == ${this.m_overlapCount}`);

		debugDraw.prepareCanvas();

		this.m_overlapPoints.forEach( (point, i) => {
			const drawCommand = {
				data: [point.x, point.y, 10.0],
				color: 0xFFFFFF,
			};
			debugDraw.drawPoint(drawCommand);
		});

		debugDraw.restoreCanvas();
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
