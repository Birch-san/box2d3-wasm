import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";


export default class ManyTumblers extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 1.0, y: -5.5 };
		camera.zoom = 25.0 * 3.4;
		settings.drawJoints = false;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
		} = this.box2d;

		const bodyDef = b2DefaultBodyDef();
		this.m_groundId = b2CreateBody( this.m_worldId, bodyDef );

		this.m_rowCount = 19;
		this.m_columnCount = 19;

		this.m_tumblerIds = [];
		this.m_positions = [];
		this.m_tumblerCount = 0;

		this.m_bodyIds = [];
		this.m_bodyCount = 0;
		this.m_bodyIndex = 0;

		this.m_angularSpeed = 25.0;

		bodyDef.delete();

		this.CreateUI();
		this.Spawn();
	}

	CreateTumbler(position, index){
		const {
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2Vec2,
			b2MakeOffsetBox,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			B2_PI,
			b2Rot_identity
		} = this.box2d;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_kinematicBody;
		bodyDef.position.Set(position.x, position.y);
		bodyDef.angularVelocity = ( B2_PI / 180.0 ) * this.m_angularSpeed;
		const bodyId = b2CreateBody( this.m_worldId, bodyDef );
		this.m_tumblerIds[index] = bodyId;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 50.0;

		let polygon;
		const p = new b2Vec2();
		polygon = b2MakeOffsetBox( 0.25, 2.0, p.Set(2.0, 0.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );
		polygon.delete();
		polygon = b2MakeOffsetBox( 0.25, 2.0, p.Set(-2.0, 0.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );
		polygon.delete();
		polygon = b2MakeOffsetBox( 2.0, 0.25, p.Set(0.0, 2.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );
		polygon.delete();
		polygon = b2MakeOffsetBox( 2.0, 0.25, p.Set(0.0, -2.0), b2Rot_identity );
		b2CreatePolygonShape( bodyId, shapeDef, polygon );
		polygon.delete();
		p.delete();

		bodyDef.delete();
		shapeDef.delete();
	}

	Step(){
		const {
			b2DefaultShapeDef,
			b2Capsule,
			b2DefaultBodyDef,
			b2CreateBody,
			b2CreateCapsuleShape,
			b2BodyType
		} = this.box2d;

		super.Step();

		if ( this.m_bodyIndex < this.m_bodyCount && ( this.m_stepCount & 0x7 ) == 0 )
		{
			const shapeDef = b2DefaultShapeDef();

			const capsule = new b2Capsule();
			capsule.center1.Set(-0.1, 0.0);
			capsule.center2.Set(0.1, 0.0);
			capsule.radius = 0.075;

			for ( let i = 0; i < this.m_tumblerCount; i++ )
			{
				console.assert( this.m_bodyIndex < this.m_bodyCount );

				const bodyDef = b2DefaultBodyDef();
				bodyDef.type = b2BodyType.b2_dynamicBody;
				bodyDef.position = this.m_positions[i];
				this.m_bodyIds[this.m_bodyIndex] = b2CreateBody( this.m_worldId, bodyDef );
				b2CreateCapsuleShape( this.m_bodyIds[this.m_bodyIndex], shapeDef, capsule );

				this.m_bodyIndex += 1;

				bodyDef.delete();
			}

			shapeDef.delete();
			capsule.delete();
		}
	}

	Spawn(){
		const {
			b2DestroyBody,
			b2Vec2
		} = this.box2d;

		for ( let i = 0; i < this.m_bodyCount; i++ )
		{
			if (this.m_bodyIds[i])
			{
				b2DestroyBody( this.m_bodyIds[i] );
			}
		}

		for ( let i = 0; i < this.m_tumblerCount; i++ )
		{
			b2DestroyBody( this.m_tumblerIds[i] );
		}

		this.m_bodyIds.length = 0;
		this.m_tumblerIds.length = 0;

		this.m_tumblerCount = this.m_rowCount * this.m_columnCount;
		this.m_tumblerIds = new Array( this.m_tumblerCount ).fill(null);
		this.m_positions = new Array( this.m_tumblerCount ).fill(null);

		let index = 0;
		let x = -4.0 * this.m_rowCount;
		for ( let i = 0; i < this.m_rowCount; i++ )
		{
			let y = -4.0 * this.m_columnCount;
			for ( let j = 0; j < this.m_columnCount; j++ )
			{
				this.m_positions[index] = new b2Vec2(x, y);
				this.CreateTumbler( this.m_positions[index], index );
				index++;
				y += 8.0;
			}

			x += 8.0;
		}

		let bodiesPerTumbler = 50;
		this.m_bodyCount = bodiesPerTumbler * this.m_tumblerCount;

		this.m_bodyIds = new Array(this.m_bodyCount).fill(null);

		this.m_bodyIndex = 0;
	}

	CreateUI(){
		const {
			b2Body_SetAngularVelocity,
			b2Body_SetAwake,
			B2_PI
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
			rowCount: this.m_rowCount,
			columnCount: this.m_columnCount,
			speed: this.m_angularSpeed,
		};

		this.pane.addBinding(PARAMS, 'rowCount', {
			step: 1,
			min: 1,
			max: 32,
		}).on('change', event => {
			this.m_rowCount = event.value;
			this.Despawn();
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'rowCount', {
			step: 1,
			min: 1,
			max: 32,
		}).on('change', event => {
			this.m_columnCount = event.value;
			this.Despawn();
			this.Spawn();
		});

		this.pane.addBinding(PARAMS, 'speed', {
			step: 1,
			min: 0,
			max: 100,
		}).on('change', event => {
			this.m_angularSpeed = event.value;
			for ( let i = 0; i < this.m_tumblerCount; i++ )
			{
				b2Body_SetAngularVelocity( this.m_tumblerIds[i], ( B2_PI / 180.0 ) * this.m_angularSpeed );
				b2Body_SetAwake( this.m_tumblerIds[i], true );
			}
		});
	}

	Despawn(){
		this.m_positions.forEach( position => position.delete() );
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
