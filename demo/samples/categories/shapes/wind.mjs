import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import b2HexColor from '../../b2HexColor.mjs';
import settings from '../../settings.mjs';

const ShapeType = {
	e_circleShape: 0,
	e_capsuleShape: 1,
	e_boxShape: 2,
};

const m_maxCount = 60;

// A chain of bodies hanging from a spring loaded hinge, pushed around by noisy wind.
// Wind is applied per shape with b2Shape_ApplyWind, using drag and lift coefficients.
export default class Wind extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 1.0 };
		camera.zoom = 2.0;

		const {
			b2Vec2,
			b2DefaultBodyDef,
			b2CreateBody
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			this.m_groundId = b2CreateBody( this.m_worldId, bodyDef );

			bodyDef.delete();
		}

		this.m_shapeType = ShapeType.e_capsuleShape;
		this.m_wind = new b2Vec2( 6.0, 0.0 );
		this.m_drag = 1.0;
		this.m_lift = 0.75;
		this.m_count = 10;
		this.m_noise = new b2Vec2( 0.0, 0.0 );

		this.m_bodyIds = new Array(m_maxCount).fill(null);

		this.CreateScene();

		this.CreateUI();
	}

	CreateScene()
	{
		const {
			b2Capsule,
			b2Circle,
			b2BodyType,
			b2CreateCapsuleShape,
			b2CreateCircleShape,
			b2CreatePolygonShape,
			b2CreateBody,
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2MakeBox,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			b2DestroyBody,
		} = this.box2d;

		for ( let i = 0; i < m_maxCount; ++i )
		{
			if ( this.m_bodyIds[i] != null )
			{
				b2DestroyBody( this.m_bodyIds[i] );
				this.m_bodyIds[i] = null;
			}
		}

		const radius = 0.1;
		const circle = new b2Circle();
		circle.center.Set( 0.0, 0.0 );
		circle.radius = radius;

		const capsule = new b2Capsule();
		capsule.center1.Set( 0.0, -radius );
		capsule.center2.Set( 0.0, radius );
		capsule.radius = 0.25 * radius;

		const box = b2MakeBox( 0.25 * radius, 1.25 * radius );

		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.base.bodyIdA = this.m_groundId;
		jointDef.base.localFrameA.p.Set( 0.0, 2.0 + radius );
		jointDef.base.drawScale = 0.1;
		jointDef.hertz = 0.1;
		jointDef.dampingRatio = 0.0;
		jointDef.enableSpring = true;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 20.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.gravityScale = 0.5;
		bodyDef.enableSleep = false;

		for ( let i = 0; i < this.m_count; ++i )
		{
			bodyDef.position.Set( 0.0, 2.0 - 2.0 * radius * i );
			this.m_bodyIds[i] = b2CreateBody( this.m_worldId, bodyDef );

			if ( this.m_shapeType == ShapeType.e_circleShape )
			{
				b2CreateCircleShape( this.m_bodyIds[i], shapeDef, circle );
			}
			else if ( this.m_shapeType == ShapeType.e_capsuleShape )
			{
				b2CreateCapsuleShape( this.m_bodyIds[i], shapeDef, capsule );
			}
			else
			{
				b2CreatePolygonShape( this.m_bodyIds[i], shapeDef, box );
			}

			jointDef.base.bodyIdB = this.m_bodyIds[i];
			jointDef.base.localFrameB.p.Set( 0.0, radius );
			b2CreateRevoluteJoint( this.m_worldId, jointDef );

			jointDef.base.bodyIdA = this.m_bodyIds[i];
			jointDef.base.localFrameA.p.Set( 0.0, -radius );
		}

		circle.delete();
		capsule.delete();
		box.delete();
		jointDef.delete();
		shapeDef.delete();
		bodyDef.delete();
	}

	Despawn(){
		this.m_wind.delete();
		this.m_noise.delete();
	}

	Step(){
		const {
			b2GetLengthAndNormalize,
			b2MulSV,
			b2Add,
			b2Body_GetShapes,
			b2Shape_ApplyWind,
			RandomVec2,
			b2Lerp,
		} = this.box2d;

		let windLine = null;

		if ( settings.pause == false || settings.singleStep )
		{
			const { length: speed, normal: direction } = b2GetLengthAndNormalize( this.m_wind );
			const windDirection = b2Add( direction, this.m_noise );
			const wind = b2MulSV( speed, windDirection );

			for ( let i = 0; i < this.m_count; ++i )
			{
				const shapeIds = b2Body_GetShapes( this.m_bodyIds[i], 1 );
				for ( let j = 0; j < shapeIds.length; ++j )
				{
					b2Shape_ApplyWind( shapeIds[j], wind, this.m_drag, this.m_lift, true );
				}
			}

			const rand = RandomVec2( -0.3, 0.3 );
			const noise = b2Lerp( this.m_noise, rand, 0.05 );
			this.m_noise.Copy( noise );

			windLine = [0.0, 0.0, 0.2 * wind.x, 0.2 * wind.y];

			direction.delete();
			windDirection.delete();
			wind.delete();
			rand.delete();
			noise.delete();
		}

		super.Step();

		if ( windLine != null )
		{
			this.debugDraw.prepareCanvas();
			this.debugDraw.drawLine( { data: windLine, color: b2HexColor.b2_colorFuchsia } );
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

		const PARAMS = {
			shape: this.m_shapeType,
			wind: { x: this.m_wind.x, y: this.m_wind.y },
			drag: this.m_drag,
			lift: this.m_lift,
			count: this.m_count,
		};

		this.pane.addBinding(PARAMS, 'shape', {
			options: {
				Circle: ShapeType.e_circleShape,
				Capsule: ShapeType.e_capsuleShape,
				Box: ShapeType.e_boxShape,
			}
		}).on('change', event => {
			this.m_shapeType = event.value;
			this.CreateScene();
		});

		this.pane.addBinding(PARAMS, 'wind', {
			x: { step: 0.1, min: -20, max: 20 },
			y: { step: 0.1, min: -20, max: 20, inverted: true },
		}).on('change', event => {
			this.m_wind.Set( event.value.x, event.value.y );
		});

		this.pane.addBinding(PARAMS, 'drag', {
			step: 0.01,
			min: 0,
			max: 1,
		}).on('change', event => {
			this.m_drag = event.value;
		});

		this.pane.addBinding(PARAMS, 'lift', {
			step: 0.01,
			min: 0,
			max: 4,
		}).on('change', event => {
			this.m_lift = event.value;
		});

		this.pane.addBinding(PARAMS, 'count', {
			step: 1,
			min: 1,
			max: m_maxCount,
		}).on('change', event => {
			this.m_count = event.value;
			this.CreateScene();
		});
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
