import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import settings from '../../settings.mjs';
import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import b2HexColor from '../../b2HexColor.mjs';

const e_count = 20;
const FLT_EPSILON = 1.19209290e-7;

export default class Contacts extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 0.0 };
		camera.zoom = 25.0 * 1.75;

		this.m_playerId = null;
		this.m_coreShapeId = null;

		const {
			b2DefaultBodyDef,
			b2Vec2,
			b2CreateBody,
			b2CreateCircleShape,
			b2Circle,
			b2BodyType,
			b2DefaultShapeDef,
			b2DefaultChainDef,
			b2CreateChain,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const points = [[40.0, -40.0], [-40.0, -40.0], [-40.0, 40.0], [40.0, 40.0]].map( ( [x, y] ) => ({x, y}) );

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints( points );
			chainDef.isLoop = true;

			b2CreateChain( groundId, chainDef );
		}

		// Player
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.gravityScale = 0.0;
			bodyDef.linearDamping = 0.5;
			bodyDef.angularDamping = 0.5;
			bodyDef.isBullet = true;
			this.m_playerId = b2CreateBody( this.m_worldId, bodyDef );
			const circle = new b2Circle();
			circle.center.Set(0.0, 0.0);
			circle.radius = 1.0;
			const shapeDef = b2DefaultShapeDef();

			// Enable contact events for the player shape
			shapeDef.enableContactEvents = true;

			this.m_coreShapeId = b2CreateCircleShape( this.m_playerId, shapeDef, circle );
		}

		this.m_debrisIds = new Array(e_count);
		this.m_bodyUserData = {};
		for ( let i = 0; i < e_count; i++ )
		{
			this.m_debrisIds[i] = null;
		}

		this.m_wait = 0.5;
		this.m_force = 200.0;

		this.m_touchKeyboard = false;

		this.CreateUI();
	}

	SpawnDebris()
	{
		const {
			b2DefaultBodyDef,
			b2BodyType,
			b2CreateBody,
			b2DefaultShapeDef,
			b2CreateCircleShape,
			b2CreateCapsuleShape,
			b2CreatePolygonShape,
			b2MakeBox,
			b2MakeRot,
			b2Circle,
			b2Capsule,
			RandomFloatRange,
			B2_PI,
			b2Body_GetPointer,
		} = this.box2d;

		let index = -1;
		for ( let i = 0; i < e_count; i++ )
		{
			if (this.m_debrisIds[i] === null)
			{
				index = i;
				break;
			}
		}

		if ( index == -1 )
		{
			return;
		}

		// Debris
		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;
		bodyDef.position.Set(RandomFloatRange( -38.0, 38.0 ), RandomFloatRange( -38.0, 38.0 ));
		bodyDef.rotation = b2MakeRot( RandomFloatRange( -B2_PI, B2_PI ) );
		bodyDef.linearVelocity.Set(RandomFloatRange( -5.0, 5.0 ), RandomFloatRange( -5.0, 5.0 ));
		bodyDef.angularVelocity = RandomFloatRange( -1.0, 1.0 );
		bodyDef.gravityScale = 0.0;

		this.m_debrisIds[index] = b2CreateBody( this.m_worldId, bodyDef );

		// store userdata
		const bodyPointer = b2Body_GetPointer( this.m_debrisIds[index] );
		this.m_bodyUserData[bodyPointer] = index;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.restitution = 0.8;

		// No events when debris hits debris
		shapeDef.enableContactEvents = false;

		if ( ( index + 1 ) % 3 == 0 )
		{
			const circle = new b2Circle();
			circle.center.Set(0.0, 0.0);
			circle.radius = 0.5;
			b2CreateCircleShape( this.m_debrisIds[index], shapeDef, circle );
		}
		else if ( ( index + 1 ) % 2 == 0 )
		{
			const capsule = new b2Capsule();
			capsule.center1.Set( 0.0, -0.25 );
			capsule.center2.Set( 0.0, 0.25 );
			capsule.radius = 0.25;
			b2CreateCapsuleShape( this.m_debrisIds[index], shapeDef, capsule );
		}
		else
		{
			const box = b2MakeBox( 0.4, 0.6 );
			b2CreatePolygonShape( this.m_debrisIds[index], shapeDef, box );
		}
	}

	Despawn(){
		Keyboard.HideTouchControls();
	}

	Step(){
		const {
			b2Body_GetPosition,
			b2Body_ApplyForce,
			b2Vec2,
			b2World_GetContactEvents,
			b2Shape_GetBody,
			b2Shape_GetContactCapacity,
			b2Shape_GetContactData,
			b2Length,
			B2_ID_EQUALS,
			b2Body_GetPointer,
			b2DestroyBody,
			b2DestroyShape,
			b2Body_ApplyMassFromShapes,
			b2Body_GetShapes,
			b2InvMulTransforms,
			b2TransformPoint,
			b2Shape_GetType,
			b2Shape_GetCircle,
			b2Shape_GetCapsule,
			b2Shape_GetPolygon,
			b2Body_GetTransform,
			b2Body_GetShapeCount,
			b2DefaultShapeDef,
			b2CreateCircleShape,
			b2CreateCapsuleShape,
			b2CreatePolygonShape,
			b2ShapeType,
			b2TransformPolygon
		} = this.box2d;


		const position = b2Body_GetPosition( this.m_playerId );

		if ( Keyboard.IsDown(Key.A) )
		{
			b2Body_ApplyForce( this.m_playerId, new b2Vec2(-this.m_force, 0.0), position, true );
		}

		if ( Keyboard.IsDown(Key.D) )
		{
			b2Body_ApplyForce( this.m_playerId, new b2Vec2(this.m_force, 0.0), position, true );
		}

		if ( Keyboard.IsDown(Key.W) )
		{
			b2Body_ApplyForce( this.m_playerId, new b2Vec2(0.0, this.m_force), position, true );
		}

		if ( Keyboard.IsDown(Key.S) )
		{
			b2Body_ApplyForce( this.m_playerId, new b2Vec2(0.0, -this.m_force), position, true );
		}

		super.Step();

		this.debugDraw.prepareCanvas();

		const debrisToAttach = [];
		const shapesToDestroy = [];
		let attachCount = 0;
		let destroyCount = 0;

		// Process contact begin touch events.
		const contactEvents = b2World_GetContactEvents( this.m_worldId );
		const beginEvents = contactEvents.GetBeginEvents();

		for ( let i = 0; i < beginEvents.length; i++ )
		{
			const event = beginEvents[i];
			const bodyIdA = b2Shape_GetBody( event.shapeIdA );
			const bodyIdB = b2Shape_GetBody( event.shapeIdB );

			// The begin touch events have the contact manifolds, but the impulses are zero. This is because the manifolds
			// are gathered before the contact solver is run.

			// We can get the final contact data from the shapes. The manifold is shared by the two shapes, so we just need the
			// contact data from one of the shapes. Choose the one with the smallest number of contacts.

			const capacityA = b2Shape_GetContactCapacity( event.shapeIdA );
			const capacityB = b2Shape_GetContactCapacity( event.shapeIdB );

			if ( capacityA < capacityB )
			{
				// The count may be less than the capacity
				const contactData = b2Shape_GetContactData( event.shapeIdA, capacityA );
				const countA = contactData.length;

				console.assert( countA >= 1 );

				for ( let j = 0; j < countA; j++ )
				{
					const idA = contactData[j].shapeIdA;
					const idB = contactData[j].shapeIdB;
					if ( B2_ID_EQUALS( idA, event.shapeIdB ) || B2_ID_EQUALS( idB, event.shapeIdB ) )
					{
						console.assert( B2_ID_EQUALS( idA, event.shapeIdA ) || B2_ID_EQUALS( idB, event.shapeIdA ) );

						const manifold = contactData[j].manifold;
						const normal = manifold.normal;
						console.assert( Math.abs( b2Length( normal ) - 1.0 ) < 4.0 * FLT_EPSILON );

						for ( let k = 0; k < manifold.pointCount; k++ )
						{
							const point = manifold.GetPoint(k);

							const p1 = point.point;
							const offset = new b2Vec2().Copy(normal).MulSV(point.maxNormalImpulse);
							const p2 = new b2Vec2().Copy(point.point).Add(offset);

							this.debugDraw.drawSegment( {data: [p1.x, p1.y, p2.x, p2.y], color: b2HexColor.b2_colorBlueViolet});
							this.debugDraw.drawPoint( {data: [p1.x, p1.y, 100.0], color:b2HexColor.b2_colorWhite} );
						}
					}
				}
			}
			else
			{
				// The count may be less than the capacity
				const contactData = b2Shape_GetContactData( event.shapeIdB, capacityB );
				const countB = contactData.length;

				for ( let j = 0; j < countB; j++ )
				{
					const idA = contactData[j].shapeIdA;
					const idB = contactData[j].shapeIdB;

					if ( B2_ID_EQUALS( idA, event.shapeIdA ) || B2_ID_EQUALS( idB, event.shapeIdA ) )
					{
						console.assert( B2_ID_EQUALS( idA, event.shapeIdB ) || B2_ID_EQUALS( idB, event.shapeIdB ) );


						const manifold = contactData[j].manifold;
						const normal = manifold.normal;
						console.assert( Math.abs( b2Length( normal ) - 1.0 ) < 4.0 * FLT_EPSILON );

						for ( let k = 0; k < manifold.pointCount; k++ )
						{
							const point = manifold.GetPoint(k);

							const p1 = point.point;
							const offset = new b2Vec2().Copy(normal).MulSV(point.maxNormalImpulse);
							const p2 = new b2Vec2().Copy(point.point).Add(offset);

							this.debugDraw.drawSegment( {data:[p1.x, p1.y, p2.x, p2.y], color: b2HexColor.b2_colorYellowGreen} );
							this.debugDraw.drawPoint( {data: [p1.x, p1.y, 10.0], color: b2HexColor.b2_colorWhite} );
						}
					}
				}
			}

			if ( B2_ID_EQUALS( bodyIdA, this.m_playerId ) )
			{
				const userDataB = this.m_bodyUserData[b2Body_GetPointer( bodyIdB )];
				if ( userDataB === undefined )
				{
					if ( B2_ID_EQUALS( event.shapeIdA, this.m_coreShapeId ) == false && destroyCount < e_count )
					{
						// player non-core shape hit the wall

						let found = false;
						for ( let j = 0; j < destroyCount; ++j )
						{
							if ( B2_ID_EQUALS( event.shapeIdA, shapesToDestroy[j] ) )
							{
								found = true;
								break;
							}
						}

						// avoid double deletion
						if ( found == false )
						{
							shapesToDestroy[destroyCount] = event.shapeIdA;
							destroyCount += 1;
						}
					}
				}
				else if ( attachCount < e_count )
				{
					debrisToAttach[attachCount] = userDataB;
					attachCount += 1;
				}
			}
			else
			{
				// Only expect events for the player
				console.assert( B2_ID_EQUALS( bodyIdB, this.m_playerId ) );
				const userDataA = this.m_bodyUserData[b2Body_GetPointer( bodyIdA )];
				if ( userDataA === undefined )
				{
					if ( B2_ID_EQUALS( event.shapeIdB, this.m_coreShapeId ) == false && destroyCount < e_count )
					{
						// player non-core shape hit the wall

						let found = false;
						for ( let j = 0; j < destroyCount; j++ )
						{
							if ( B2_ID_EQUALS( event.shapeIdB, shapesToDestroy[j] ) )
							{
								found = true;
								break;
							}
						}

						// avoid double deletion
						if ( found == false )
						{
							shapesToDestroy[destroyCount] = event.shapeIdB;
							destroyCount += 1;
						}
					}
				}
				else if ( attachCount < e_count )
				{
					debrisToAttach[attachCount] = userDataA;
					attachCount += 1;
				}
			}
		}

		// Attach debris to player body
		for ( let i = 0; i < attachCount; ++i )
		{
			let index = debrisToAttach[i];

			const debrisId = this.m_debrisIds[index];
			if ( debrisId == null )
			{
				continue;
			}

			const playerTransform = b2Body_GetTransform( this.m_playerId );
			const debrisTransform = b2Body_GetTransform( debrisId );
			const relativeTransform = b2InvMulTransforms( playerTransform, debrisTransform );

			const shapeCount = b2Body_GetShapeCount( debrisId );
			if ( shapeCount == 0 )
			{
				continue;
			}

			let shapeId;
			const shapes = b2Body_GetShapes( debrisId, 1 );
			shapeId = shapes[0];

			const type = b2Shape_GetType( shapeId );

			const shapeDef = b2DefaultShapeDef();
			shapeDef.enableContactEvents = true;

			switch ( type )
			{
				case b2ShapeType.b2_circleShape:
				{
					const circle = b2Shape_GetCircle( shapeId );
					circle.center = b2TransformPoint( relativeTransform, circle.center );

					b2CreateCircleShape( this.m_playerId, shapeDef, circle );
				}
				break;

				case b2ShapeType.b2_capsuleShape:
				{
					const capsule = b2Shape_GetCapsule( shapeId );
					capsule.center1 = b2TransformPoint( relativeTransform, capsule.center1 );
					capsule.center2 = b2TransformPoint( relativeTransform, capsule.center2 );

					b2CreateCapsuleShape( this.m_playerId, shapeDef, capsule );
				}
				break;

				case b2ShapeType.b2_polygonShape:
				{
					const originalPolygon = b2Shape_GetPolygon( shapeId );
					const polygon = b2TransformPolygon( relativeTransform, originalPolygon );

					b2CreatePolygonShape( this.m_playerId, shapeDef, polygon );
				}
				break;

				default:
					console.assert( false );
			}

			delete this.m_bodyUserData[b2Body_GetPointer( debrisId )];
			b2DestroyBody( debrisId );
			this.m_debrisIds[index] = null;
		}

		for ( let i = 0; i < destroyCount; ++i )
		{
			const updateMass = false;
			b2DestroyShape( shapesToDestroy[i], updateMass );
		}

		if ( destroyCount > 0 )
		{
			// Update mass just once
			b2Body_ApplyMassFromShapes( this.m_playerId );
		}


		if ( settings.hertz > 0.0 )
		{
			this.m_wait -= 1.0 / settings.hertz;
			if ( this.m_wait < 0.0 )
			{
				this.SpawnDebris();
				this.m_wait += 0.5;
			}
		}

		this.debugDraw.restoreCanvas();
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
				Keyboard.ShowTouchControls([Key.W, Key.A, Key.S, Key.D]);
			} else {
				Keyboard.HideTouchControls();
			}

			this.CreateUI();
		});

		const PARAMS = {
			force: this.m_force,
		};

		this.pane.addBinding(PARAMS, 'force', {
			step: 0.1,
			min: 100,
			max: 500,
		}).on('change', event => {
			this.m_force = event.value;
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		DrawString(5, m_textLine, 'move using WASD');

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
