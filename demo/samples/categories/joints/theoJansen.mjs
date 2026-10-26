import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import Keyboard, { Key } from '../../../utils/keyboard.mjs';

export default class TheoJansen extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 6.0 };
		camera.zoom = 25.0 * 0.5;

		this.m_offset = { x: 0.0, y: 8.0 };
		this.m_motorSpeed = 2.0;
		this.m_enableMotor = true;
		this.m_touchKeyboard = false;
		const pivot = { x: 0.0, y: 0.8 };

		const {
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2CreateBody,
			b2CreateSegmentShape,
			b2CreateCircleShape,
			b2CreatePolygonShape,
			b2Segment,
			b2Circle,
			b2MakeBox,
			b2MakeRot,
			b2Body_GetPosition,
			b2Body_SetTransform,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			b2BodyType,
			B2_PI,
		} = this.box2d;

		// Ground
		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();

			const segment = new b2Segment();
			segment.point1.Set( -50.0, 0.0 );
			segment.point2.Set( 50.0, 0.0 );
			b2CreateSegmentShape( groundId, shapeDef, segment );

			segment.point1.Set( -50.0, 0.0 );
			segment.point2.Set( -50.0, 10.0 );
			b2CreateSegmentShape( groundId, shapeDef, segment );

			segment.point1.Set( 50.0, 0.0 );
			segment.point2.Set( 50.0, 10.0 );
			b2CreateSegmentShape( groundId, shapeDef, segment );

			bodyDef.delete();
			shapeDef.delete();
			segment.delete();
		}

		// Balls
		{
			const circle = new b2Circle();
			circle.center.Set( 0.0, 0.0 );
			circle.radius = 0.25;

			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;

			const shapeDef = b2DefaultShapeDef();
			shapeDef.density = 1.0;

			for ( let i = 0; i < 40; ++i )
			{
				bodyDef.position.Set( -40.0 + 2.0 * i, 0.5 );
				const bodyId = b2CreateBody( this.m_worldId, bodyDef );
				b2CreateCircleShape( bodyId, shapeDef, circle );
			}

			circle.delete();
			bodyDef.delete();
			shapeDef.delete();
		}

		// Chassis
		{
			const box = b2MakeBox( 2.5, 1.0 );

			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Set( pivot.x + this.m_offset.x, pivot.y + this.m_offset.y );
			this.m_chassisId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();
			shapeDef.density = 1.0;
			shapeDef.filter.groupIndex = -1;
			b2CreatePolygonShape( this.m_chassisId, shapeDef, box );

			box.delete();
			bodyDef.delete();
			shapeDef.delete();
		}

		// Wheel
		{
			const circle = new b2Circle();
			circle.center.Set( 0.0, 0.0 );
			circle.radius = 1.6;

			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Set( pivot.x + this.m_offset.x, pivot.y + this.m_offset.y );
			this.m_wheelId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();
			shapeDef.density = 1.0;
			shapeDef.filter.groupIndex = -1;
			b2CreateCircleShape( this.m_wheelId, shapeDef, circle );

			circle.delete();
			bodyDef.delete();
			shapeDef.delete();
		}

		{
			const jointDef = b2DefaultRevoluteJointDef();
			jointDef.base.bodyIdA = this.m_wheelId;
			jointDef.base.bodyIdB = this.m_chassisId;

			const motorPivot = { x: pivot.x + this.m_offset.x, y: pivot.y + this.m_offset.y };
			this.SetLocalFrame( jointDef.base.localFrameA.p, jointDef.base.bodyIdA, motorPivot );
			this.SetLocalFrame( jointDef.base.localFrameB.p, jointDef.base.bodyIdB, motorPivot );

			jointDef.enableMotor = this.m_enableMotor;
			jointDef.motorSpeed = this.m_motorSpeed;
			jointDef.maxMotorTorque = 400.0;
			this.m_motorJointId = b2CreateRevoluteJoint( this.m_worldId, jointDef );

			jointDef.delete();
		}

		const wheelAnchor = { x: pivot.x + 0.0, y: pivot.y - 0.8 };

		this.CreateLeg( -1.0, wheelAnchor );
		this.CreateLeg( 1.0, wheelAnchor );

		// Stagger three leg pairs around the wheel so some feet always touch the ground
		const setWheelAngle = ( angle ) => {
			const position = b2Body_GetPosition( this.m_wheelId );
			const rotation = b2MakeRot( angle );
			b2Body_SetTransform( this.m_wheelId, position, rotation );
			position.delete();
			rotation.delete();
		};

		setWheelAngle( 120.0 * B2_PI / 180.0 );
		this.CreateLeg( -1.0, wheelAnchor );
		this.CreateLeg( 1.0, wheelAnchor );

		setWheelAngle( -120.0 * B2_PI / 180.0 );
		this.CreateLeg( -1.0, wheelAnchor );
		this.CreateLeg( 1.0, wheelAnchor );

		this.CreateUI();
	}

	// target.Set( b2Body_GetLocalPoint( bodyId, worldPoint ) )
	SetLocalFrame( target, bodyId, worldPoint ){
		const {
			b2Vec2,
			b2Body_GetLocalPoint,
		} = this.box2d;

		const p = new b2Vec2( worldPoint.x, worldPoint.y );
		const local = b2Body_GetLocalPoint( bodyId, p );
		target.Copy( local );
		local.delete();
		p.delete();
	}

	CreateLeg( s, wheelAnchor ){
		const {
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2CreateBody,
			b2CreatePolygonShape,
			b2ComputeHull,
			b2MakePolygon,
			b2DefaultDistanceJointDef,
			b2CreateDistanceJoint,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			b2BodyType,
		} = this.box2d;

		const offset = this.m_offset;

		const p1 = { x: 5.4 * s, y: -6.1 };
		const p2 = { x: 7.2 * s, y: -1.2 };
		const p3 = { x: 4.3 * s, y: -1.9 };
		const p4 = { x: 3.1 * s, y: 0.8 };
		const p5 = { x: 6.0 * s, y: 1.5 };
		const p6 = { x: 2.5 * s, y: 3.7 };

		// The hull computation handles the mirrored winding for s < 0
		const vertices1 = [ p1, p2, p3 ];
		const vertices2 = [ { x: 0.0, y: 0.0 }, { x: p5.x - p4.x, y: p5.y - p4.y }, { x: p6.x - p4.x, y: p6.y - p4.y } ];

		const hull1 = b2ComputeHull( vertices1 );
		const hull2 = b2ComputeHull( vertices2 );
		const poly1 = b2MakePolygon( hull1, 0.0 );
		const poly2 = b2MakePolygon( hull2, 0.0 );

		const bodyDef1 = b2DefaultBodyDef();
		bodyDef1.type = b2BodyType.b2_dynamicBody;
		bodyDef1.position.Set( offset.x, offset.y );
		bodyDef1.angularDamping = 10.0;
		const body1 = b2CreateBody( this.m_worldId, bodyDef1 );

		const bodyDef2 = b2DefaultBodyDef();
		bodyDef2.type = b2BodyType.b2_dynamicBody;
		bodyDef2.position.Set( p4.x + offset.x, p4.y + offset.y );
		bodyDef2.angularDamping = 10.0;
		const body2 = b2CreateBody( this.m_worldId, bodyDef2 );

		// Negative group index keeps the legs from colliding with the chassis and wheel
		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.filter.groupIndex = -1;
		b2CreatePolygonShape( body1, shapeDef, poly1 );
		b2CreatePolygonShape( body2, shapeDef, poly2 );

		const toWorld = ( p ) => ( { x: p.x + offset.x, y: p.y + offset.y } );
		const distance = ( a, b ) => Math.hypot( a.x - b.x, a.y - b.y );

		{
			// Soft distance constraints reduce jitter and act like a suspension system
			const jointDef = b2DefaultDistanceJointDef();
			jointDef.enableSpring = true;
			jointDef.hertz = 10.0;
			jointDef.dampingRatio = 0.5;

			jointDef.base.bodyIdA = body1;
			jointDef.base.bodyIdB = body2;

			let anchorA = toWorld( p2 );
			let anchorB = toWorld( p5 );
			this.SetLocalFrame( jointDef.base.localFrameA.p, body1, anchorA );
			this.SetLocalFrame( jointDef.base.localFrameB.p, body2, anchorB );
			jointDef.length = distance( anchorA, anchorB );
			b2CreateDistanceJoint( this.m_worldId, jointDef );

			anchorA = toWorld( p3 );
			anchorB = toWorld( p4 );
			this.SetLocalFrame( jointDef.base.localFrameA.p, body1, anchorA );
			this.SetLocalFrame( jointDef.base.localFrameB.p, body2, anchorB );
			jointDef.length = distance( anchorA, anchorB );
			b2CreateDistanceJoint( this.m_worldId, jointDef );

			jointDef.base.bodyIdB = this.m_wheelId;
			anchorB = toWorld( wheelAnchor );
			this.SetLocalFrame( jointDef.base.localFrameB.p, this.m_wheelId, anchorB );
			jointDef.length = distance( anchorA, anchorB );
			b2CreateDistanceJoint( this.m_worldId, jointDef );

			jointDef.base.bodyIdA = body2;
			anchorA = toWorld( p6 );
			this.SetLocalFrame( jointDef.base.localFrameA.p, body2, anchorA );
			jointDef.length = distance( anchorA, anchorB );
			b2CreateDistanceJoint( this.m_worldId, jointDef );

			jointDef.delete();
		}

		{
			const jointDef = b2DefaultRevoluteJointDef();
			jointDef.base.bodyIdA = body2;
			jointDef.base.bodyIdB = this.m_chassisId;

			const legPivot = toWorld( p4 );
			this.SetLocalFrame( jointDef.base.localFrameA.p, body2, legPivot );
			this.SetLocalFrame( jointDef.base.localFrameB.p, this.m_chassisId, legPivot );
			b2CreateRevoluteJoint( this.m_worldId, jointDef );

			jointDef.delete();
		}

		hull1.delete();
		hull2.delete();
		poly1.delete();
		poly2.delete();
		bodyDef1.delete();
		bodyDef2.delete();
		shapeDef.delete();
	}

	Keyboard(){
		const {
			b2RevoluteJoint_SetTargetMotorSpeed,
			b2RevoluteJoint_IsMotorEnabled,
			b2RevoluteJoint_EnableMotor,
		} = this.box2d;

		if ( Keyboard.IsPressed( Key.A ) )
		{
			b2RevoluteJoint_SetTargetMotorSpeed( this.m_motorJointId, -this.m_motorSpeed );
		}

		if ( Keyboard.IsPressed( Key.S ) )
		{
			b2RevoluteJoint_SetTargetMotorSpeed( this.m_motorJointId, 0.0 );
		}

		if ( Keyboard.IsPressed( Key.D ) )
		{
			b2RevoluteJoint_SetTargetMotorSpeed( this.m_motorJointId, this.m_motorSpeed );
		}

		if ( Keyboard.IsPressed( Key.F ) )
		{
			this.m_enableMotor = !b2RevoluteJoint_IsMotorEnabled( this.m_motorJointId );
			b2RevoluteJoint_EnableMotor( this.m_motorJointId, this.m_enableMotor );

			if ( this.PARAMS )
			{
				this.PARAMS.motor = this.m_enableMotor;
				this.pane?.refresh();
			}
		}
	}

	Step(){
		this.Keyboard();

		super.Step();
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

		const {
			b2RevoluteJoint_EnableMotor,
			b2RevoluteJoint_SetTargetMotorSpeed,
		} = this.box2d;

		this.pane.addButton({
			title: this.m_touchKeyboard ? 'hide touch keyboard' : 'show touch keyboard',
		}).on('click', () => {
			this.m_touchKeyboard = !this.m_touchKeyboard;

			if (this.m_touchKeyboard){
				Keyboard.ShowTouchControls([Key.A, Key.S, Key.D, Key.F]);
			} else {
				Keyboard.HideTouchControls();
			}

			this.CreateUI();
		});

		this.PARAMS = {
			motor: this.m_enableMotor,
			speed: this.m_motorSpeed,
		};

		this.pane.addBinding(this.PARAMS, 'motor').on('change', event => {
			this.m_enableMotor = event.value;
			b2RevoluteJoint_EnableMotor( this.m_motorJointId, this.m_enableMotor );
		});

		this.pane.addBinding(this.PARAMS, 'speed', {
			step: 0.1,
			min: -5.0,
			max: 5.0,
		}).on('change', event => {
			this.m_motorSpeed = event.value;
			b2RevoluteJoint_SetTargetMotorSpeed( this.m_motorJointId, this.m_motorSpeed );
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		m_textLine = DrawString( 5, m_textLine, "Keys: left = a, brake = s, right = d, toggle motor = f" );

		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		Keyboard.HideTouchControls();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
