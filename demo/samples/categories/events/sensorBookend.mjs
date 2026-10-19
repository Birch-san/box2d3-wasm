import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

// Port of the upstream "Sensor Bookend" sample.
// Shows that sensor begin and end events come in pairs, also when shapes, bodies or events are
// destroyed or disabled. Sensor 1 is static, sensor 2 is dynamic with a solid core, so the two
// sensors can also sense each other.
export default class SensorBooked extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 6.0 };
		camera.zoom = 7.5;

		{
			const {
				b2DefaultBodyDef,
				b2CreateBody,
				b2DefaultShapeDef,
				b2CreateSegmentShape,
				b2Segment,
			} = this.box2d;

			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );
			const shapeDef = b2DefaultShapeDef();

			const groundSegment = new b2Segment();
			groundSegment.point1.Set(-10.0, 0.0);
			groundSegment.point2.Set(10.0, 0.0);
			b2CreateSegmentShape( groundId, shapeDef, groundSegment );

			groundSegment.point1.Set(-10.0, 0.0);
			groundSegment.point2.Set(-10.0, 10.0);
			b2CreateSegmentShape( groundId, shapeDef, groundSegment );

			groundSegment.point1.Set(10.0, 0.0);
			groundSegment.point2.Set(10.0, 10.0);
			b2CreateSegmentShape( groundId, shapeDef, groundSegment );

			bodyDef.delete();
			shapeDef.delete();
			groundSegment.delete();
		}

		this.m_isVisiting1 = false;
		this.m_isVisiting2 = false;
		this.m_sensorsOverlapCount = 0;

		// Body ids are null once the body is destroyed. Shape ids are retained until the end events
		// have been processed, then they are nulled as well.
		this.m_sensorBodyId1 = null;
		this.m_sensorShapeId1 = null;
		this.m_sensorBodyId2 = null;
		this.m_sensorShapeId2 = null;
		this.m_visitorBodyId = null;
		this.m_visitorShapeId = null;

		this.CreateSensor1();
		this.CreateSensor2();
		this.CreateVisitor();

		this.CreateUI();
	}

	CreateSensor1(){
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeSquare,
		} = this.box2d;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Set(-2.0, 1.0);
		this.m_sensorBodyId1 = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.isSensor = true;
		shapeDef.enableSensorEvents = true;

		const box = b2MakeSquare( 1.0 );
		this.m_sensorShapeId1 = b2CreatePolygonShape( this.m_sensorBodyId1, shapeDef, box );

		bodyDef.delete();
		shapeDef.delete();
		box.delete();
	}

	CreateSensor2(){
		const {
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeRoundedBox,
			b2MakeSquare,
		} = this.box2d;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set(2.0, 1.0);
		this.m_sensorBodyId2 = b2CreateBody( this.m_worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.isSensor = true;
		shapeDef.enableSensorEvents = true;

		const roundedBox = b2MakeRoundedBox( 0.5, 0.5, 0.5 );
		this.m_sensorShapeId2 = b2CreatePolygonShape( this.m_sensorBodyId2, shapeDef, roundedBox );

		// Solid middle
		shapeDef.isSensor = false;
		shapeDef.enableSensorEvents = false;
		const box = b2MakeSquare( 0.5 );
		b2CreatePolygonShape( this.m_sensorBodyId2, shapeDef, box );

		bodyDef.delete();
		shapeDef.delete();
		roundedBox.delete();
		box.delete();
	}

	CreateVisitor(){
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

		bodyDef.delete();
		shapeDef.delete();
		circle.delete();
	}

	// Destroys the body, the shape id is retained for the end events
	DestroyVisitor(){
		this.box2d.b2DestroyBody( this.m_visitorBodyId );
		this.m_visitorBodyId = null;
	}

	DestroySensor1(){
		this.box2d.b2DestroyBody( this.m_sensorBodyId1 );
		this.m_sensorBodyId1 = null;
	}

	DestroySensor2(){
		this.box2d.b2DestroyBody( this.m_sensorBodyId2 );
		this.m_sensorBodyId2 = null;
	}

	// B2_ID_EQUALS that tolerates null ids
	IdEquals(a, b){
		return a !== null && b !== null && this.box2d.B2_ID_EQUALS( a, b );
	}

	Step(){
		const {
			b2World_GetSensorEvents,
			b2Shape_IsValid,
		} = this.box2d;

		super.Step();

		const sensorEvents = b2World_GetSensorEvents( this.m_worldId );

		for ( let i = 0; i < sensorEvents.beginCount; i++ )
		{
			const event = sensorEvents.GetBeginEvent(i);

			if ( this.IdEquals( event.sensorShapeId, this.m_sensorShapeId1 ) )
			{
				if ( this.IdEquals( event.visitorShapeId, this.m_visitorShapeId ) )
				{
					console.assert( this.m_isVisiting1 == false );
					this.m_isVisiting1 = true;
				}
				else
				{
					console.assert( this.IdEquals( event.visitorShapeId, this.m_sensorShapeId2 ) );
					this.m_sensorsOverlapCount += 1;
				}
			}
			else
			{
				console.assert( this.IdEquals( event.sensorShapeId, this.m_sensorShapeId2 ) );

				if ( this.IdEquals( event.visitorShapeId, this.m_visitorShapeId ) )
				{
					console.assert( this.m_isVisiting2 == false );
					this.m_isVisiting2 = true;
				}
				else
				{
					console.assert( this.IdEquals( event.visitorShapeId, this.m_sensorShapeId1 ) );
					this.m_sensorsOverlapCount += 1;
				}
			}
		}

		console.assert( this.m_sensorsOverlapCount == 0 || this.m_sensorsOverlapCount == 2 );

		for ( let i = 0; i < sensorEvents.endCount; ++i )
		{
			const event = sensorEvents.GetEndEvent(i);

			if ( this.IdEquals( event.sensorShapeId, this.m_sensorShapeId1 ) )
			{
				if ( this.IdEquals( event.visitorShapeId, this.m_visitorShapeId ) )
				{
					console.assert( this.m_isVisiting1 == true );
					this.m_isVisiting1 = false;
				}
				else
				{
					console.assert( this.IdEquals( event.visitorShapeId, this.m_sensorShapeId2 ) );
					this.m_sensorsOverlapCount -= 1;
				}
			}
			else
			{
				console.assert( this.IdEquals( event.sensorShapeId, this.m_sensorShapeId2 ) );

				if ( this.IdEquals( event.visitorShapeId, this.m_visitorShapeId ) )
				{
					console.assert( this.m_isVisiting2 == true );
					this.m_isVisiting2 = false;
				}
				else
				{
					console.assert( this.IdEquals( event.visitorShapeId, this.m_sensorShapeId1 ) );
					this.m_sensorsOverlapCount -= 1;
				}
			}
		}

		console.assert( this.m_sensorsOverlapCount == 0 || this.m_sensorsOverlapCount == 2 );

		sensorEvents.delete();

		// Nullify invalid shape ids after end events are processed.
		if ( this.m_visitorShapeId !== null && b2Shape_IsValid( this.m_visitorShapeId ) == false )
		{
			this.m_visitorShapeId = null;
		}

		if ( this.m_sensorShapeId1 !== null && b2Shape_IsValid( this.m_sensorShapeId1 ) == false )
		{
			this.m_sensorShapeId1 = null;
		}

		if ( this.m_sensorShapeId2 !== null && b2Shape_IsValid( this.m_sensorShapeId2 ) == false )
		{
			this.m_sensorShapeId2 = null;
		}
	}

	// Adds create/destroy buttons and the event/enable checkboxes for one body
	AddBodyControls(label, eventsLabel, enableLabel, bodyId, shapeId, create, destroy){
		const {
			b2Shape_AreSensorEventsEnabled,
			b2Shape_EnableSensorEvents,
			b2Body_IsEnabled,
			b2Body_Enable,
			b2Body_Disable,
		} = this.box2d;

		if ( bodyId === null )
		{
			this.pane.addButton({
				title: `create ${label}`,
			}).on('click', () => {
				create();
				this.CreateUI();
			});
			return;
		}

		this.pane.addButton({
			title: `destroy ${label}`,
		}).on('click', () => {
			destroy();
			this.CreateUI();
		});

		const PARAMS = {
			[eventsLabel]: b2Shape_AreSensorEventsEnabled( shapeId ),
			[enableLabel]: b2Body_IsEnabled( bodyId ),
		};

		this.pane.addBinding(PARAMS, eventsLabel).on('change', event => {
			b2Shape_EnableSensorEvents( shapeId, event.value );
		});

		this.pane.addBinding(PARAMS, enableLabel).on('change', event => {
			if ( event.value )
			{
				b2Body_Enable( bodyId );
			}
			else
			{
				b2Body_Disable( bodyId );
			}
		});
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

		this.AddBodyControls('visitor', 'visitor events', 'enable visitor body',
			this.m_visitorBodyId, this.m_visitorShapeId,
			() => this.CreateVisitor(), () => this.DestroyVisitor());

		this.pane.addBlade({ view: 'separator' });

		this.AddBodyControls('sensor1', 'sensor 1 events', 'enable sensor1 body',
			this.m_sensorBodyId1, this.m_sensorShapeId1,
			() => this.CreateSensor1(), () => this.DestroySensor1());

		this.pane.addBlade({ view: 'separator' });

		this.AddBodyControls('sensor2', 'sensor2 events', 'enable sensor2 body',
			this.m_sensorBodyId2, this.m_sensorShapeId2,
			() => this.CreateSensor2(), () => this.DestroySensor2());
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		m_textLine = DrawString(5, m_textLine, `visiting 1 == ${this.m_isVisiting1}`);
		m_textLine = DrawString(5, m_textLine, `visiting 2 == ${this.m_isVisiting2}`);
		m_textLine = DrawString(5, m_textLine, `sensors overlap count == ${this.m_sensorsOverlapCount}`);
		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
