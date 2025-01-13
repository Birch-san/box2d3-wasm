import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import CreateHuman from "../../prefabs/human.mjs";


const e_shapes = {
	e_circleShape: 0,
	e_capsuleShape: 1,
	e_mixShape: 2,
	e_compoundShape: 3,
	e_humanShape: 4,
};

const e_maxColumns = 26;
const e_maxRows = 150;

export default class Barrel extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 8.0, y: 53.0 };
		camera.zoom = 25.0 * 2.35;


		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2Vec2,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeOffsetBox,
			b2Rot_identity,
			b2CreateSegmentShape,
			b2Segment
		} = this.box2d;

		{
			const gridSize = 1.0;

			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();

			let y = 0.0;
			let x = -40.0 * gridSize;
			for ( let i = 0; i < 81; ++i )
			{
				const box = b2MakeOffsetBox( 0.5 * gridSize, 0.5 * gridSize, new b2Vec2(x, y), b2Rot_identity );
				b2CreatePolygonShape( groundId, shapeDef, box );
				x += gridSize;
			}

			y = gridSize;
			x = -40.0 * gridSize;
			for ( let i = 0; i < 100; ++i )
			{
				const box = b2MakeOffsetBox( 0.5 * gridSize, 0.5 * gridSize, new b2Vec2(x, y), b2Rot_identity );
				b2CreatePolygonShape( groundId, shapeDef, box );
				y += gridSize;
			}

			y = gridSize;
			x = 40.0 * gridSize;
			for ( let i = 0; i < 100; ++i )
			{
				const box = b2MakeOffsetBox( 0.5 * gridSize, 0.5 * gridSize, new b2Vec2(x, y), b2Rot_identity );
				b2CreatePolygonShape( groundId, shapeDef, box );
				y += gridSize;
			}

			const segment = new b2Segment();
			segment.point1.Set(-800.0, -80.0);
			segment.point2.Set(800.0, -80.0);
			b2CreateSegmentShape( groundId, shapeDef, segment );
		}

		this.m_shapeType = e_shapes.e_compoundShape;
		this.m_bodies = new Array(e_maxRows * e_maxColumns).fill(null);
		this.m_humans = new Array(e_maxRows * e_maxColumns).fill(null);

		this.Spawn();

		this.CreateUI();
	}

	Spawn(){
		const {
			b2DestroyBody,
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2Circle,
			b2CreateCircleShape,
			b2Capsule,
			b2CreateCapsuleShape,
			b2ComputeHull,
			b2MakePolygon,
			b2MakeBox,
			b2Vec2,
			b2CreatePolygonShape,
			b2DefaultShapeDef,
			RandomFloatRange
		} = this.box2d;

		for ( let i = 0; i < e_maxRows * e_maxColumns; i++ )
		{
			if ( this.m_bodies[i] !== null )
			{
				b2DestroyBody( this.m_bodies[i] );
				this.m_bodies[i] = null;
			}

			if ( this.m_humans[i]?.isSpawned )
			{
				this.m_humans[i].Despawn();
				this.m_humans[i] = null;
			}
		}

		let m_columnCount = e_maxColumns;
		let m_rowCount = e_maxRows;

		if ( this.m_shapeType == e_shapes.e_compoundShape )
		{
			m_columnCount = 20;
		}
		else if ( this.m_shapeType == e_shapes.e_humanShape )
		{
			m_rowCount = 30;
		}

		let rad = 0.5;

		let shift = 1.15;
		let centerx = shift * m_columnCount / 2.0;
		let centery = shift / 2.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		// todo eliminate this once rolling resistance is added
		if ( this.m_shapeType == e_shapes.e_mixShape )
		{
			bodyDef.angularDamping = 0.3;
		}

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.friction = 0.5;

		const capsule = new b2Capsule();
		capsule.center1.Set(-0.25, 0.0);
		capsule.center2.Set(0.25, 0.0);
		capsule.radius = 0.25;

		const circle = new b2Circle();
		circle.center.Set(0.0, 0.0);
		circle.radius = rad;

		const points = [{x: -0.1, y: -0.5}, {x: 0.1, y: -0.5}, {x: 0.0, y: 0.5}];
		const wedgeHull = b2ComputeHull( points );
		const wedge = b2MakePolygon( wedgeHull, 0.0 );

		const vertices = [{x: -1.0, y: 0.0}, {x: 0.5, y: 1.0}, {x: 0.0, y: 2.0}];
		let hull = b2ComputeHull( vertices);
		const left = b2MakePolygon( hull, 0.0 );

		vertices[0] = {x: 1.0, y: 0.0};
		vertices[1] = {x: -0.5, y: 1.0};
		vertices[2] = {x: 0.0, y: 2.0};
		hull = b2ComputeHull( vertices );
		const right = b2MakePolygon( hull, 0.0 );

		// b2Polygon top = b2MakeOffsetBox(0.8f, 0.2f, {0.0f, 0.8f}, 0.0f);
		// b2Polygon leftLeg = b2MakeOffsetBox(0.2f, 0.5f, {-0.6f, 0.5f}, 0.0f);
		// b2Polygon rightLeg = b2MakeOffsetBox(0.2f, 0.5f, {0.6f, 0.5f}, 0.0f);

		let side = -0.1;
		let extray = 0.5;

		if ( this.m_shapeType == e_shapes.e_compoundShape )
		{
			extray = 0.25;
			side = 0.25;
			shift = 2.0;
			centerx = shift * m_columnCount / 2.0 - 1.0;
		}
		else if ( this.m_shapeType == e_shapes.e_humanShape )
		{
			extray = 0.5;
			side = 0.55;
			shift = 2.5;
			centerx = shift * m_columnCount / 2.0;
		}

		let index = 0;
		let yStart = this.m_shapeType == e_shapes.e_humanShape ? 2.0 : 100.0;

		for ( let i = 0; i < m_columnCount; i++ )
		{
			let x = i * shift - centerx;

			for ( let j = 0; j < m_rowCount; j++ )
			{
				let y = j * ( shift + extray ) + centery + yStart;

				bodyDef.position = new b2Vec2( x + side, y );
				side = -side;

				if ( this.m_shapeType == e_shapes.e_circleShape )
				{
					this.m_bodies[index] = b2CreateBody( this.m_worldId, bodyDef );
					circle.radius = RandomFloatRange( 0.25, 0.75 );
					b2CreateCircleShape( this.m_bodies[index], shapeDef, circle );
				}
				else if ( this.m_shapeType == e_shapes.e_capsuleShape )
				{
					this.m_bodies[index] = b2CreateBody( this.m_worldId, bodyDef );
					capsule.radius = RandomFloatRange( 0.25, 0.5 );
					const length = RandomFloatRange( 0.25, 1.0 );
					capsule.center1 = new b2Vec2(0.0, -0.5 * length );
					capsule.center2 = new b2Vec2(0.0, 0.5 * length );
					b2CreateCapsuleShape( this.m_bodies[index], shapeDef, capsule );
				}
				else if ( this.m_shapeType == e_shapes.e_mixShape )
				{
					this.m_bodies[index] = b2CreateBody( this.m_worldId, bodyDef );

					let mod = index % 3;
					if ( mod == 0 )
					{
						circle.radius = RandomFloatRange( 0.25, 0.75 );
						b2CreateCircleShape( this.m_bodies[index], shapeDef, circle );
					}
					else if ( mod == 1 )
					{
						capsule.radius = RandomFloatRange( 0.25, 0.5 );
						const length = RandomFloatRange( 0.25, 1.0 );
						capsule.center1 = new b2Vec2(0.0, -0.5 * length );
						capsule.center2 = new b2Vec2(0.0, 0.5 * length );
						b2CreateCapsuleShape( this.m_bodies[index], shapeDef, capsule );
					}
					else if ( mod == 2 )
					{
						const width = RandomFloatRange( 0.1, 0.5 );
						const height = RandomFloatRange( 0.5, 0.75 );
						const box = b2MakeBox( width, height );

						// Don't put a function call into a macro.
						const value = RandomFloatRange( -1.0, 1.0 );
						box.radius = 0.25 * Math.max( 0.0, value );
						b2CreatePolygonShape( this.m_bodies[index], shapeDef, box );
					}
					else
					{
						wedge.radius = RandomFloatRange( 0.1, 0.25 );
						b2CreatePolygonShape( this.m_bodies[index], shapeDef, wedge );
					}
				}
				else if ( this.m_shapeType == e_shapes.e_compoundShape )
				{
					this.m_bodies[index] = b2CreateBody( this.m_worldId, bodyDef );

					b2CreatePolygonShape( this.m_bodies[index], shapeDef, left );
					b2CreatePolygonShape( this.m_bodies[index], shapeDef, right );
					// b2CreatePolygonShape(this.m_bodies[index], &shapeDef, &top);
					// b2CreatePolygonShape(this.m_bodies[index], &shapeDef, &leftLeg);
					// b2CreatePolygonShape(this.m_bodies[index], &shapeDef, &rightLeg);
				}
				else if ( this.m_shapeType == e_shapes.e_humanShape )
				{
					const scale = 3.5;
					const jointFriction = 0.05;
					const jointHertz = 5.0;
					const jointDamping = 0.5;
					const human = CreateHuman( this.box2d, this.m_worldId, bodyDef.position, scale, jointFriction, jointHertz, jointDamping,
							index + 1, null, false );
					this.m_humans[index] = human;
				}

				index += 1;
			}
		}
	}


	Despawn(){
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
			shape: this.m_shapeType,
		};

		this.pane.addBinding(PARAMS, 'shape', {
			options: {
				'Circle': e_shapes.e_circleShape,
				'Capsule': e_shapes.e_capsuleShape,
				'Mix': e_shapes.e_mixShape,
				'Compound': e_shapes.e_compoundShape,
				'Human': e_shapes.e_humanShape,
			}
		}).on('change', event => {
			this.m_shapeType = event.value;
			this.Despawn();
			this.Spawn();
		});

		this.pane.addButton({title: 'Reset Scene'}).on('click', () => {
			this.Despawn();
			this.Spawn();
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
