import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import settings from '../../settings.mjs';

import CreateHuman, { Human_GetUserData } from "../../prefabs/human.mjs";
import Donut, { Donut_GetUserData } from "../../prefabs/donut.mjs";

const params = new URLSearchParams(window.location.search);

const e_count = params.get('e_count') ? parseInt(params.get('e_count')) : 20;
const e_donut = 0;
const e_human = 1;
const e_wait = params.get('e_wait') ? parseFloat(params.get('e_wait')) : 0.5;

export default class SensorFunnel extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 0.0 };
		camera.zoom = 25 * 1.333;

		settings.drawJoints = false;

		{
			const {
				b2DefaultBodyDef,
				b2Vec2,
				b2Vec2_zero,
				b2CreateBody,
				b2CreateChain,
				b2DefaultChainDef,
				b2DefaultShapeDef,
				b2CreatePolygonShape,
				b2CreateRevoluteJoint,
				b2DefaultRevoluteJointDef,
				b2MakeBox,
				b2MakeOffsetBox,
				b2BodyType,
				b2Rot_identity
			} = this.box2d;

			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const points = [
				[ -16.8672504, 31.088623 ],	 [ 16.8672485, 31.088623 ],		[ 16.8672485, 17.1978741 ],
				[ 8.26824951, 11.906374 ],	 [ 16.8672485, 11.906374 ],		[ 16.8672485, -0.661376953 ],
				[ 8.26824951, -5.953125 ],	 [ 16.8672485, -5.953125 ],		[ 16.8672485, -13.229126 ],
				[ 3.63799858, -23.151123 ],	 [ 3.63799858, -31.088623 ],	[ -3.63800049, -31.088623 ],
				[ -3.63800049, -23.151123 ], [ -16.8672504, -13.229126 ],	[ -16.8672504, -5.953125 ],
				[ -8.26825142, -5.953125 ],	 [ -16.8672504, -0.661376953 ], [ -16.8672504, 11.906374 ],
				[ -8.26825142, 11.906374 ],	 [ -16.8672504, 17.1978741 ],
			].map( ( [x, y] ) => ({x, y}) );

			const material = {};
			material.friction = 0.2;

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints(points);
			chainDef.isLoop = true;
			chainDef.SetMaterials([material]);
			b2CreateChain( groundId, chainDef );

			let sign = 1.0;
			let y = 14.0;
			for ( let i = 0; i < 3; i++ )
			{
				bodyDef.position.Set(0.0, y);
				bodyDef.type = b2BodyType.b2_dynamicBody;

				const bodyId = b2CreateBody(this.m_worldId, bodyDef);

				const box = b2MakeBox(6.0, 0.5 );
				const shapeDef = b2DefaultShapeDef();
				shapeDef.material.friction = 0.1;
				shapeDef.material.restitution = 1.0;
				shapeDef.density = 1.0;

				b2CreatePolygonShape( bodyId, shapeDef, box );

				const revoluteDef = b2DefaultRevoluteJointDef();
				revoluteDef.bodyIdA = groundId;
				revoluteDef.bodyIdB = bodyId;
				revoluteDef.localAnchorA = bodyDef.position;
				revoluteDef.localAnchorB = b2Vec2_zero;
				revoluteDef.maxMotorTorque = 200.0;
				revoluteDef.motorSpeed = 2.0 * sign;
				revoluteDef.enableMotor = true;

				b2CreateRevoluteJoint( this.m_worldId, revoluteDef );

				y -= 14.0;
				sign = -sign;

				box.delete();
				shapeDef.delete();
				revoluteDef.delete();
			}

			{
				const pos = new b2Vec2(0.0, -30.5);
				const box = b2MakeOffsetBox( 4.0, 1.0, pos, b2Rot_identity );
				const shapeDef = b2DefaultShapeDef();
				shapeDef.isSensor = true;
				shapeDef.enableSensorEvents = true;
				b2CreatePolygonShape( groundId, shapeDef, box );

				pos.delete();
				box.delete();
				shapeDef.delete();
			}

			bodyDef.delete();
			chainDef.delete();
		}

		this.m_type = params.get('m_type') ? parseInt(params.get('m_type')) : e_human;

		this.CreateUI();
		this.Spawn(box2d);
	}

	Spawn(){
		this.m_wait = e_wait;
		this.m_side = -15.0;

		this.m_elements = new Array(e_count).fill(null);
		this.m_isSpawned = new Array(e_count).fill(false);

		this.CreateElement();
	}

	Despawn(){
		for ( let i = 0; i < e_count; i++ )
		{
			this.DestroyElement(i);
		}
	}

	CreateElement()
	{
		let index = -1;
		for ( let i = 0; i < e_count; i++ )
		{
			if ( this.m_isSpawned[i] == false )
			{
				index = i;
				break;
			}
		}

		if ( index == -1 )
		{
			return;
		}

		const center = new this.box2d.b2Vec2(this.m_side, 29.5);

		if ( this.m_type == e_donut )
		{
			const donut = new Donut(this.box2d);
			donut.Spawn( this.m_worldId, center, 1.0, 0, true, index );
			this.m_elements[index] = donut;
		}
		else
		{
			const scale = 2.0;
			const jointFriction = 0.05;
			const jointHertz = 6.0;
			const jointDamping = 0.5;
			const colorize = true;
			const human = CreateHuman( this.box2d, this.m_worldId, center, scale, jointFriction, jointHertz, jointDamping, index + 1, index, colorize );
			human.EnableSensorEvents(true);
			this.m_elements[index] = human;
		}

		this.m_isSpawned[index] = true;
		this.m_side = -this.m_side;

		center.delete();
	}

	DestroyElement(index){
		if ( this.m_elements[index] != null )
		{
			this.m_elements[index].Despawn();
			this.m_elements[index] = null;
		}

		this.m_isSpawned[index] = false;
	}

	Step(){
		const {
			b2World_GetSensorEvents,
			b2Shape_GetBody,
		} = this.box2d;

		super.Step();

		const sensorEvents = b2World_GetSensorEvents( this.m_worldId );

		const deferredDestructions = new Set();

		for ( let i = 0; i < sensorEvents.beginCount; i++ ){
			const event = sensorEvents.GetBeginEvent(i);
			const visitorId = event.visitorShapeId;
			const bodyId = b2Shape_GetBody( visitorId );


			if(this.m_type == e_donut){
				const elementId = Donut_GetUserData(this.box2d, bodyId );
				deferredDestructions.add(elementId);
			} else {
				const elementId = Human_GetUserData(this.box2d, bodyId );
				deferredDestructions.add(elementId);
			}
		}

		deferredDestructions.forEach( elementId => {
			this.DestroyElement(elementId);
		});

		this.m_wait -= 1.0 / settings.hertz;

		if ( this.m_wait <= 0.0 )
		{
			this.CreateElement();
			this.m_wait += e_wait;
		}

		sensorEvents.delete();
	}

	CreateUI(){
		const container = document.getElementById('sample-settings');

		super.CreateUI();

		const PARAMS = {
			shape: e_human,
		};
		this.pane = new Pane({
			title: 'Sample Settings',
  			expanded: true,
			container
		});

		this.pane.addBinding(PARAMS, 'shape', {
			options: {
				e_donut: e_donut,
				e_human: e_human
			},
		}).on('change', (event) => {
			this.Despawn();
			this.m_type = event.value;
			this.Spawn();
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
