import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import settings from '../../settings.mjs';

import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import b2HexColor from '../../b2HexColor.mjs';
import CreateHuman from "../../prefabs/human.mjs";
import Donut from "../../prefabs/donut.mjs";

// Upstream uses 600 cycles (10 in debug builds): a 24 km world with ~290k static shapes and ~28k
// dynamic bodies. That takes too long to build in the browser, so the default here is smaller and
// the cycle count can be changed in the sample settings. Kept across restarts (R).
const defaultCycleCount = 60;
const maxCycleCount = 600;
let s_cycleCount = defaultCycleCount;

// Port of the Car prefab from box2d/samples/car.cpp
class Car {
	constructor(box2d) {
		this.box2d = box2d;
		this.m_chassisId = null;
		this.m_rearWheelId = null;
		this.m_frontWheelId = null;
		this.m_rearAxleId = null;
		this.m_frontAxleId = null;
		this.m_isSpawned = false;
	}

	Spawn( worldId, position, scale, hertz, dampingRatio, torque, userData )
	{
		console.assert( this.m_isSpawned == false );

		const {
			b2ComputeHull,
			b2MakePolygon,
			b2DefaultShapeDef,
			b2DefaultBodyDef,
			b2CreateBody,
			b2CreatePolygonShape,
			b2CreateCircleShape,
			b2Circle,
			b2Vec2,
			b2Body_GetLocalPoint,
			b2DefaultWheelJointDef,
			b2CreateWheelJoint,
			b2MakeRot,
			b2BodyType,
			B2_PI,
		} = this.box2d;

		const vertices = [
			{ x: -1.5, y: -0.5 }, { x: 1.5, y: -0.5 }, { x: 1.5, y: 0.0 }, { x: 0.0, y: 0.9 }, { x: -1.15, y: 0.9 }, { x: -1.5, y: 0.2 },
		].map( ( v ) => ( { x: v.x * 0.85 * scale, y: v.y * 0.85 * scale } ) );

		const hull = b2ComputeHull( vertices );
		const chassis = b2MakePolygon( hull, 0.15 * scale );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0 / scale;
		shapeDef.material.friction = 0.2;

		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = 0.4 * scale;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		if ( userData != null )
		{
			bodyDef.userData = userData;
		}
		bodyDef.position.Set( position.x, position.y + 1.0 * scale );
		this.m_chassisId = b2CreateBody( worldId, bodyDef );
		b2CreatePolygonShape( this.m_chassisId, shapeDef, chassis );

		shapeDef.density = 2.0 / scale;
		shapeDef.material.friction = 1.5;
		shapeDef.material.rollingResistance = 0.1;

		const rearPivot = { x: position.x - 1.0 * scale, y: position.y + 0.35 * scale };
		bodyDef.position.Set( rearPivot.x, rearPivot.y );
		bodyDef.allowFastRotation = true;
		this.m_rearWheelId = b2CreateBody( worldId, bodyDef );
		b2CreateCircleShape( this.m_rearWheelId, shapeDef, circle );

		const frontPivot = { x: position.x + 1.0 * scale, y: position.y + 0.4 * scale };
		bodyDef.position.Set( frontPivot.x, frontPivot.y );
		bodyDef.allowFastRotation = true;
		this.m_frontWheelId = b2CreateBody( worldId, bodyDef );
		b2CreateCircleShape( this.m_frontWheelId, shapeDef, circle );

		// The wheel joint axis is the x-axis of localFrameA, so rotate it to point up
		const axisRotation = b2MakeRot( 0.5 * B2_PI );
		const pivot = new b2Vec2( 0.0, 0.0 );

		const jointDef = b2DefaultWheelJointDef();

		const createAxle = ( wheelId, wheelPivot ) => {
			jointDef.base.bodyIdA = this.m_chassisId;
			jointDef.base.bodyIdB = wheelId;
			jointDef.base.localFrameA.q = axisRotation;
			const localA = b2Body_GetLocalPoint( jointDef.base.bodyIdA, pivot.Set( wheelPivot.x, wheelPivot.y ) );
			const localB = b2Body_GetLocalPoint( jointDef.base.bodyIdB, pivot );
			jointDef.base.localFrameA.p.Copy( localA );
			jointDef.base.localFrameB.p.Copy( localB );
			localA.delete();
			localB.delete();
			jointDef.motorSpeed = 0.0;
			jointDef.maxMotorTorque = torque;
			jointDef.enableMotor = true;
			jointDef.hertz = hertz;
			jointDef.dampingRatio = dampingRatio;
			jointDef.lowerTranslation = -0.25 * scale;
			jointDef.upperTranslation = 0.25 * scale;
			jointDef.enableLimit = true;
			return b2CreateWheelJoint( worldId, jointDef );
		};

		this.m_rearAxleId = createAxle( this.m_rearWheelId, rearPivot );
		this.m_frontAxleId = createAxle( this.m_frontWheelId, frontPivot );

		this.m_isSpawned = true;

		hull.delete();
		chassis.delete();
		shapeDef.delete();
		circle.delete();
		bodyDef.delete();
		axisRotation.delete();
		pivot.delete();
		jointDef.delete();
	}

	Despawn()
	{
		console.assert( this.m_isSpawned == true );

		const {
			b2DestroyJoint,
			b2DestroyBody,
		} = this.box2d;

		b2DestroyJoint( this.m_rearAxleId );
		b2DestroyJoint( this.m_frontAxleId );
		b2DestroyBody( this.m_rearWheelId );
		b2DestroyBody( this.m_frontWheelId );
		b2DestroyBody( this.m_chassisId );

		this.m_isSpawned = false;
	}

	SetSpeed( speed )
	{
		const {
			b2WheelJoint_SetTargetMotorSpeed,
			b2Joint_WakeBodies,
		} = this.box2d;

		b2WheelJoint_SetTargetMotorSpeed( this.m_rearAxleId, speed );
		b2WheelJoint_SetTargetMotorSpeed( this.m_frontAxleId, speed );
		b2Joint_WakeBodies( this.m_rearAxleId );
	}

	SetTorque( torque )
	{
		this.box2d.b2WheelJoint_SetMaxMotorTorque( this.m_rearAxleId, torque );
		this.box2d.b2WheelJoint_SetMaxMotorTorque( this.m_frontAxleId, torque );
	}

	SetHertz( hertz )
	{
		this.box2d.b2WheelJoint_SetSpringHertz( this.m_rearAxleId, hertz );
		this.box2d.b2WheelJoint_SetSpringHertz( this.m_frontAxleId, hertz );
	}

	SetDampingRatio( dampingRatio )
	{
		this.box2d.b2WheelJoint_SetSpringDampingRatio( this.m_rearAxleId, dampingRatio );
		this.box2d.b2WheelJoint_SetSpringDampingRatio( this.m_frontAxleId, dampingRatio );
	}
}

// Box2D's roundf rounds halfway cases away from zero
function roundf( x ){
	return Math.sign( x ) * Math.round( Math.abs( x ) );
}

// The renamed "Large World" sample: a long strip of static tiles with boxes, ragdolls and donuts
// along the way, a car to drive and explosions sweeping through.
export default class Tiles extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		settings.drawJoints = false;

		this.m_car = new Car( this.box2d );
		this.m_groundIds = [];
		this.m_boxIds = [];
		this.m_humans = [];
		this.m_donuts = [];

		this.m_explosionDef = this.box2d.b2DefaultExplosionDef();

		this.m_speed = 0.0;
		this.m_explode = true;
		this.m_followCar = false;
		this.m_touchKeyboard = false;

		this.CreateScene( s_cycleCount );

		camera.center = { x: this.m_viewPosition.x, y: this.m_viewPosition.y };
		camera.zoom = 25.0 * 1.0;

		this.CreateUI();
	}

	CreateScene( cycleCount ){
		const {
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2CreateBody,
			b2CreatePolygonShape,
			b2MakeOffsetBox,
			b2MakeBox,
			b2Vec2,
			b2Rot_identity,
			b2BodyType,
			B2_PI,
		} = this.box2d;

		this.m_period = 40.0;
		const omega = 2.0 * B2_PI / this.m_period;
		this.m_cycleCount = cycleCount;
		this.m_gridSize = 1.0;
		this.m_gridCount = Math.trunc( this.m_cycleCount * this.m_period / this.m_gridSize );

		const xStart = -0.5 * ( this.m_cycleCount * this.m_period );

		this.m_viewPosition = { x: xStart, y: 15.0 };

		{
			const bodyDef = b2DefaultBodyDef();
			const shapeDef = b2DefaultShapeDef();

			// Setting this to false significantly reduces the cost of creating
			// static bodies and shapes.
			shapeDef.invokeContactCreation = false;

			const center = new b2Vec2( 0.0, 0.0 );

			const height = 4.0;
			let xBody = xStart;
			let xShape = xStart;

			let groundId = null;

			for ( let i = 0; i < this.m_gridCount; ++i )
			{
				// Create a new body regularly so that shapes are not too far from the body origin.
				// Most algorithms in Box2D work in local coordinates, but contact points are computed
				// relative to the body origin.
				// This makes a noticeable improvement in stability far from the origin.
				if ( i % 10 == 0 )
				{
					bodyDef.position.x = xBody;
					groundId = b2CreateBody( this.m_worldId, bodyDef );
					this.m_groundIds.push( groundId );
					xShape = 0.0;
				}

				let y = 0.0;

				const ycount = roundf( height * Math.cos( omega * xBody ) ) + 12;

				for ( let j = 0; j < ycount; ++j )
				{
					const square = b2MakeOffsetBox( 0.4 * this.m_gridSize, 0.4 * this.m_gridSize, center.Set( xShape, y ), b2Rot_identity );
					square.radius = 0.1;
					b2CreatePolygonShape( groundId, shapeDef, square );
					square.delete();

					y += this.m_gridSize;
				}

				xBody += this.m_gridSize;
				xShape += this.m_gridSize;
			}

			center.delete();
			bodyDef.delete();
			shapeDef.delete();
		}

		let humanIndex = 0;
		const position = new b2Vec2( 0.0, 0.0 );
		for ( let cycleIndex = 0; cycleIndex < this.m_cycleCount; ++cycleIndex )
		{
			const xbase = ( 0.5 + cycleIndex ) * this.m_period + xStart;

			const remainder = cycleIndex % 3;
			if ( remainder == 0 )
			{
				const bodyDef = b2DefaultBodyDef();
				bodyDef.type = b2BodyType.b2_dynamicBody;
				bodyDef.position.Set( xbase - 3.0, 10.0 );

				const shapeDef = b2DefaultShapeDef();
				const box = b2MakeBox( 0.3, 0.2 );

				for ( let i = 0; i < 10; ++i )
				{
					bodyDef.position.y = 10.0;
					for ( let j = 0; j < 5; ++j )
					{
						const bodyId = b2CreateBody( this.m_worldId, bodyDef );
						b2CreatePolygonShape( bodyId, shapeDef, box );
						this.m_boxIds.push( bodyId );
						bodyDef.position.y += 0.5;
					}
					bodyDef.position.x += 0.6;
				}

				bodyDef.delete();
				shapeDef.delete();
				box.delete();
			}
			else if ( remainder == 1 )
			{
				position.Set( xbase - 2.0, 10.0 );
				for ( let i = 0; i < 5; ++i )
				{
					const human = CreateHuman( this.box2d, this.m_worldId, position, 1.5, 0.05, 0.0, 0.0, humanIndex + 1, null, false );
					this.m_humans.push( human );
					humanIndex += 1;
					position.x += 1.0;
				}
			}
			else
			{
				position.Set( xbase - 4.0, 12.0 );

				for ( let i = 0; i < 5; ++i )
				{
					const donut = new Donut( this.box2d );
					donut.Spawn( this.m_worldId, position, 0.75, 0, false, null );
					this.m_donuts.push( donut );
					position.x += 2.0;
				}
			}
		}
		position.delete();

		this.m_car.Spawn( this.m_worldId, { x: xStart + 20.0, y: 40.0 }, 10.0, 2.0, 0.7, 2000.0, null );

		this.m_cycleIndex = 0;
		this.m_explosionPosition = { x: ( 0.5 + this.m_cycleIndex ) * this.m_period + xStart, y: 7.0 };
	}

	DestroyScene(){
		const {
			b2DestroyBody,
		} = this.box2d;

		if ( this.m_car.m_isSpawned )
		{
			this.m_car.Despawn();
		}

		this.m_humans.forEach( ( human ) => human.Despawn() );
		this.m_humans.length = 0;

		this.m_donuts.forEach( ( donut ) => donut.Despawn() );
		this.m_donuts.length = 0;

		this.m_boxIds.forEach( ( bodyId ) => b2DestroyBody( bodyId ) );
		this.m_boxIds.length = 0;

		this.m_groundIds.forEach( ( bodyId ) => b2DestroyBody( bodyId ) );
		this.m_groundIds.length = 0;
	}

	Rebuild( cycleCount ){
		this.MouseUp();
		this.DestroyScene();
		this.CreateScene( cycleCount );
		this.camera.center = { x: this.m_viewPosition.x, y: this.m_viewPosition.y };
	}

	Step(){
		const {
			b2Body_GetPosition,
			b2World_Explode,
		} = this.box2d;

		const span = 0.5 * ( this.m_period * this.m_cycleCount );
		let timeStep = settings.hertz > 0.0 ? 1.0 / settings.hertz : 0.0;

		if ( settings.pause && settings.singleStep == false )
		{
			timeStep = 0.0;
		}

		this.m_viewPosition.x += timeStep * this.m_speed;
		this.m_viewPosition.x = Math.min( Math.max( this.m_viewPosition.x, -span ), span );

		if ( this.m_speed != 0.0 )
		{
			this.camera.center = { x: this.m_viewPosition.x, y: this.m_viewPosition.y };
		}

		if ( this.m_followCar )
		{
			const p = b2Body_GetPosition( this.m_car.m_chassisId );
			this.camera.center.x = p.x;
			p.delete();
		}

		const radius = 2.0;
		// Upstream only advances the step counter while running, so don't explode while paused
		if ( ( this.m_stepCount & 0x1 ) == 0x1 && this.m_explode && timeStep > 0.0 )
		{
			this.m_explosionPosition.x = ( 0.5 + this.m_cycleIndex ) * this.m_period - span;

			const def = this.m_explosionDef;
			def.position.Set( this.m_explosionPosition.x, this.m_explosionPosition.y );
			def.radius = radius;
			def.falloff = 0.1;
			def.impulsePerLength = 1.0;
			b2World_Explode( this.m_worldId, def );

			this.m_cycleIndex = ( this.m_cycleIndex + 1 ) % this.m_cycleCount;
		}

		if ( Keyboard.IsDown( Key.A ) )
		{
			this.m_car.SetSpeed( 20.0 );
		}

		if ( Keyboard.IsDown( Key.S ) )
		{
			this.m_car.SetSpeed( 0.0 );
		}

		if ( Keyboard.IsDown( Key.D ) )
		{
			this.m_car.SetSpeed( -5.0 );
		}

		super.Step();

		if ( this.m_explode )
		{
			this.debugDraw.prepareCanvas();
			this.debugDraw.drawCircle({
				data: [ this.m_explosionPosition.x, this.m_explosionPosition.y, radius ],
				color: b2HexColor.b2_colorAzure,
			});
			this.debugDraw.restoreCanvas();
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
				Keyboard.ShowTouchControls([Key.A, Key.S, Key.D]);
			} else {
				Keyboard.HideTouchControls();
			}

			this.CreateUI();
		});

		this.PARAMS = {
			speed: this.m_speed,
			explode: this.m_explode,
			followCar: this.m_followCar,
			cycles: this.m_cycleCount,
		};

		this.pane.addBinding(this.PARAMS, 'speed', {
			step: 1,
			min: -400.0,
			max: 400.0,
		}).on('change', event => {
			this.m_speed = event.value;
		});

		this.pane.addButton({
			title: 'stop',
		}).on('click', () => {
			this.m_speed = 0.0;
			this.PARAMS.speed = 0.0;
			this.pane.refresh();
		});

		this.pane.addBinding(this.PARAMS, 'explode').on('change', event => {
			this.m_explode = event.value;
		});

		this.pane.addBinding(this.PARAMS, 'followCar', {
			label: 'follow car',
		}).on('change', event => {
			this.m_followCar = event.value;
		});

		// Not in upstream: the world is rebuilt with this many 40 m cycles (upstream uses 600)
		this.pane.addBinding(this.PARAMS, 'cycles', {
			step: 1,
			min: 3,
			max: maxCycleCount,
		}).on('change', event => {
			if ( event.last === false || event.value == this.m_cycleCount )
			{
				return;
			}
			s_cycleCount = event.value;
			this.Rebuild( s_cycleCount );
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const worldSize = this.m_gridSize * this.m_gridCount / 1000.0;
		m_textLine = DrawString( 5, m_textLine, `world size = ${+worldSize.toPrecision(6)} kilometers` );
		m_textLine = DrawString( 5, m_textLine, "Car keys: a = left, s = stop, d = right" );

		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		Keyboard.HideTouchControls();

		this.m_explosionDef.delete();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
