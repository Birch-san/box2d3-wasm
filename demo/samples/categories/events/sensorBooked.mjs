import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import settings from '../../settings.mjs';

export default class SensorBooked extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 6.0 };
		camera.zoom = 7.5;

		settings.drawJoints = false;

		{
			const {
				b2DefaultBodyDef,
				b2Vec2,
				b2CreateBody,
				b2DefaultShapeDef,
				b2CreateSegmentShape,
				b2Segment,
			} = this.box2d;

			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );
			const shapeDef = b2DefaultShapeDef();

			const groundSegment = new b2Segment();
			groundSegment.point1 = new b2Vec2(-10, 0);
			groundSegment.point2 = new b2Vec2(10, 0);
			b2CreateSegmentShape( groundId, shapeDef, groundSegment );

			groundSegment.point1 = new b2Vec2(-10, 0);
			groundSegment.point2 = new b2Vec2(-10, 10);
			b2CreateSegmentShape( groundId, shapeDef, groundSegment );

			groundSegment.point1 = new b2Vec2(10, 0);
			groundSegment.point2 = new b2Vec2(10, 10);
			b2CreateSegmentShape( groundId, shapeDef, groundSegment );

		}

		this.m_sensorBodyId = null;
		this.m_sensorShapeId = null;
		this.m_visitorBodyId = null;
		this.m_visitorShapeId = null;

		this.m_isVisiting = false;

		this.Spawn();
		this.CreateUI();
	}

	Spawn(){
		this.m_isVisiting = false;

		this.CreateSensor();

		this.CreateVisitor();
	}

	CreateSensor(){
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeSquare,
		} = this.box2d;

		const bodyDef = b2DefaultBodyDef();

		bodyDef.position.Set(0.0, 1.0);
		this.m_sensorBodyId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.isSensor = true;
		const box = b2MakeSquare( 1.0 );
		this.m_sensorShapeId = b2CreatePolygonShape( this.m_sensorBodyId, shapeDef, box );
	}

	CreateVisitor()
	{
		const {
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreateCircleShape,
			b2Circle,
		} = this.box2d;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Set(-4.0, 1.0);
		bodyDef.type = b2BodyType.b2_dynamicBody;

		this.m_visitorBodyId = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.enableSensorEvents = true;

		const circle = new b2Circle();
		circle.center.Set(0.0, 0.0);
		circle.radius = 0.5;

		this.m_visitorShapeId = b2CreateCircleShape( this.m_visitorBodyId, shapeDef, circle );
	}

	DestroySensor(){
		const {
			b2DestroyBody
		} = this.box2d;

		if (this.m_sensorBodyId){
			b2DestroyBody(this.m_sensorBodyId);
			this.m_sensorBodyId = null;
			this.m_sensorShapeId = null;
		}
	}

	DestroyVisitor(){
		const {
			b2DestroyBody
		} = this.box2d;

		if (this.m_visitorBodyId){
			b2DestroyBody(this.m_visitorBodyId);
			this.m_visitorBodyId = null;
			this.m_visitorShapeId = null;
		}
	}

	Despawn(){
		this.DestroySensor();
		this.DestroyVisitor();
	}

	Step(){
		const {
			b2World_GetSensorEvents,
			b2Shape_IsValid,
			B2_ID_EQUALS
		} = this.box2d;

		super.Step();

		const sensorEvents = b2World_GetSensorEvents( this.m_worldId );

		for ( let i = 0; i < sensorEvents.beginCount; i++ )
		{
			const event = sensorEvents.GetBeginEvent(i);
			if ( B2_ID_EQUALS( event.visitorShapeId, this.m_visitorShapeId ) )
			{
				console.assert( this.m_isVisiting == false );
				this.m_isVisiting = true;
			}
		}


		for ( let i = 0; i < sensorEvents.endCount; ++i )
		{
			const event = sensorEvents.GetEndEvent(i);

			const wasVisitorDestroyed = b2Shape_IsValid( event.visitorShapeId ) == false;
			if ( wasVisitorDestroyed || B2_ID_EQUALS( event.visitorShapeId, this.m_visitorShapeId ) )
			{
				console.assert( this.m_isVisiting == true );
				this.m_isVisiting = false;
			}
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

		if(!this.m_sensorBodyId){
			this.pane.addButton({
				title: 'create sensor',
			}).on('click', () => {
				this.CreateSensor();
				this.CreateUI();
			});
		} else {
			this.pane.addButton({
				title: 'destroy sensor',
			}).on('click', () => {
				this.DestroySensor();
				this.CreateUI();
			});
		}

		if(!this.m_visitorBodyId){
			this.pane.addButton({
				title: 'create visitor',
			}).on('click', () => {
				this.CreateVisitor();
				this.CreateUI();
			});
		} else {
			this.pane.addButton({
				title: 'destroy visitor',
			}).on('click', () => {
				this.DestroyVisitor();
				this.CreateUI();
			});
		}

		super.CreateUI();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		DrawString(5, m_textLine, 'visiting === ' + this.m_isVisiting.toString());
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
