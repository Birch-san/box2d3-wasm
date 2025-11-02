import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import Keyboard from '../../../utils/keyboard.mjs';

const SPINNER_POINT_COUNT = 360;

const e_shapes = {
	e_capsule: 0,
	e_circle: 1,
	e_polygon: 2,
	e_mix: 3
};

export default class Spinner extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 32.0 };
		camera.zoom = 42.0;

		this.m_bodyCount = 3000;
		this.m_bodies = [];
		this.m_revoluteJoint = null;
		this.m_shape = e_shapes.e_mix;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2MakeRot,
			b2Vec2,
			b2RotateVector,
			b2DefaultChainDef,
			b2CreateChain,
			b2MakeRoundedBox,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			B2_PI,
			b2BodyType
		} = this.box2d;

		let groundId;
		{
			const bodyDef = b2DefaultBodyDef();
			groundId = b2CreateBody( this.m_worldId, bodyDef );

			const points = new Array(SPINNER_POINT_COUNT);

			const q = b2MakeRot( -2.0 * B2_PI / SPINNER_POINT_COUNT );
			const p = new b2Vec2(40.0, 0.0);
			for ( let i = 0; i < SPINNER_POINT_COUNT; i++ )
			{
				points[i] = {x: p.x, y: p.y + 32.0 };
				const pRotated = b2RotateVector( q, p );
				p.Copy(pRotated);
				pRotated.delete();
			}

			const material = {}
			material.friction = 0.1;

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints(points);
			chainDef.isLoop = true;
			chainDef.SetMaterials([material]);

			b2CreateChain( groundId, chainDef );

			q.delete();
			p.delete();
			bodyDef.delete();
			chainDef.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Set(0.0, 12.0);
			bodyDef.enableSleep = false;

			const spinnerId = b2CreateBody( this.m_worldId, bodyDef );

			const box = b2MakeRoundedBox( 0.4, 20.0, 0.2 );
			const shapeDef = b2DefaultShapeDef();
			shapeDef.material.friction = 0.0;
			b2CreatePolygonShape( spinnerId, shapeDef, box );

			const motorSpeed = 5.0;
			// const maxMotorTorque = 40000.0;
			const maxMotorTorque = Number.MAX_VALUE;
			const jointDef = b2DefaultRevoluteJointDef();
			jointDef.base.bodyIdA = groundId;
			jointDef.base.bodyIdB = spinnerId;
			jointDef.base.localFrameA.p.Copy(bodyDef.position);
			jointDef.enableMotor = true;
			jointDef.motorSpeed = motorSpeed;
			jointDef.maxMotorTorque = maxMotorTorque;

			this.m_revoluteJoint = b2CreateRevoluteJoint( this.m_worldId, jointDef );

			bodyDef.delete();
			box.delete();
			shapeDef.delete();
			jointDef.delete();
		}

		this.Spawn();

		this.CreateUI();
	}

	Spawn(){
		const {
			b2Capsule,
			b2Circle,
			b2MakeSquare,
			b2DefaultBodyDef,
			b2BodyType,
			b2DefaultShapeDef,
			b2CreateBody,
			b2CreateCapsuleShape,
			b2CreateCircleShape,
			b2CreatePolygonShape,
		} = this.box2d;

		const capsule = new b2Capsule();
		capsule.center1.Set(-0.25, 0.0);
		capsule.center2.Set(0.25, 0.0);
		capsule.radius = 0.25;

		const circle = new b2Circle();
		circle.radius = 0.35;
		const square = b2MakeSquare( 0.35 );

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		const shapeDef = b2DefaultShapeDef();
		shapeDef.material.friction = 0.1;
		shapeDef.material.restitution = 0.1;
		shapeDef.density = 0.25;


		let x = -24.0, y = 2.0;
		for ( let i = 0; i < this.m_bodyCount; i++ )
		{
			bodyDef.position.Set(x, y );
			const bodyId = b2CreateBody( this.m_worldId, bodyDef );

			this.m_bodies.push( bodyId );

			switch ( this.m_shape ) {
				case e_shapes.e_capsule:
					b2CreateCapsuleShape( bodyId, shapeDef, capsule );
					break;
				case e_shapes.e_circle:
					b2CreateCircleShape( bodyId, shapeDef, circle );
					break;
				case e_shapes.e_polygon:
					b2CreatePolygonShape( bodyId, shapeDef, square );
					break
				case e_shapes.e_mix:
					{
						let remainder = i % 3;
						if ( remainder == 0 )
						{
							b2CreateCapsuleShape( bodyId, shapeDef, capsule );
						}
						else if ( remainder == 1 )
						{
							b2CreateCircleShape( bodyId, shapeDef, circle );
						}
						else if ( remainder == 2 )
						{
							b2CreatePolygonShape( bodyId, shapeDef, square );
						}
						break;
					}
			}

			x += 1.0;

			if ( x > 24.0 )
			{
				x = -24.0;
				y += 1.0;
			}
		}

		capsule.delete();
		circle.delete();
		square.delete();
		bodyDef.delete();
		shapeDef.delete();
	}


	Despawn(){
		const {
			b2DestroyBody,
		} = this.box2d;

		for ( let i = 0; i < this.m_bodies.length; i++ )
		{
			b2DestroyBody( this.m_bodies[i] );
		}
		this.m_bodies.length = 0;


		Keyboard.HideTouchControls();
	}

	Step(){
		super.Step();
	}

	CreateUI(){
		const {
			b2RevoluteJoint_SetMaxMotorTorque
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

		const PARAMS = {
			bodyCount: this.m_bodyCount,
			shape: e_shapes.e_mix,
			motorTorque: 40000.0,
		};

		this.pane.addBinding(PARAMS, 'bodyCount', {
			step: 10,
			min: 100,
			max: 10000,
		}).on('change', event => {
			this.m_bodyCount = event.value;
			this.Despawn();
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'shape', {
			options: {
				Capsule: e_shapes.e_capsule,
				Circle: e_shapes.e_circle,
				Box: e_shapes.e_polygon,
				Mix: e_shapes.e_mix,
			}
		}).on('change', event => {
			this.m_shape = event.value;
			this.Despawn();
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'motorTorque', {
			step: 1000,
			min: 1000,
			max: 200000,
		}).on('change', event => {
			b2RevoluteJoint_SetMaxMotorTorque(this.m_revoluteJoint, event.value);
		});
	}

	Destroy(){
		this.Despawn();
		super.Destroy();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
