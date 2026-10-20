import Sample from "../../sample.mjs";

import settings from '../../settings.mjs';

/*
	Port of shared/determinism.c from upstream Box2D. The Rollback sample imports these helpers too.

	Upstream expects (single precision) sleep step 299 and hash 0x465F3DF4. The wasm build (deluxe and
	compat, any worker count) is bitwise identical to native Box2D, so it reaches the same values, as
	long as the scene is built from the same float values. Upstream computes the scene in float, JS
	computes in double, so every value that upstream derives with float arithmetic is rounded with
	Math.fround after each operation below. Rounding only once, when the value reaches the wasm side,
	moves 12 of the 80 bodies by one ulp and the run ends at sleep step 278, hash 0x427BF9E6.
*/
export const EXPECTED_SLEEP_STEP = 299;
export const EXPECTED_HASH = 0x465F3DF4;

export function CreateFallingHinges(box2d, worldId){
	const {
		b2DefaultBodyDef,
		b2CreateBody,
		b2MakeBox,
		b2MakeSquare,
		b2DefaultShapeDef,
		b2CreatePolygonShape,
		b2DefaultRevoluteJointDef,
		b2CreateRevoluteJoint,
		b2BodyType,
		B2_PI,
		b2MakeRot,
	} = box2d;

	{
		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Set(0.0, -1.0);
		const groundId = b2CreateBody( worldId, bodyDef );

		const box = b2MakeBox( 40.0, 1.0 );
		const shapeDef = b2DefaultShapeDef();
		b2CreatePolygonShape( groundId, shapeDef, box );

		bodyDef.delete();
		box.delete();
		shapeDef.delete();
	}

	const columnCount = 4;
	const rowCount = 20;
	const bodyCount = rowCount * columnCount;

	const bodyIds = new Array(bodyCount);

	// single precision arithmetic, like the float math in upstream's determinism.c
	const f = Math.fround;

	const h = 0.25;
	// upstream builds a rounded box (h - r, h - r, r) with r = 0.1 * h and then replaces it with a square
	const box = b2MakeSquare( h );

	const shapeDef = b2DefaultShapeDef();

	const jointDef = b2DefaultRevoluteJointDef();
	jointDef.enableLimit = true;
	jointDef.lowerAngle = f( f( -0.1 ) * B2_PI );
	jointDef.upperAngle = f( f( 0.2 ) * B2_PI );
	jointDef.enableSpring = true;
	jointDef.hertz = 1.0;
	jointDef.dampingRatio = 1.0;
	jointDef.enableMotor = true;
	jointDef.maxMotorTorque = 0.25;
	jointDef.base.localFrameA.p.Set( -h, h );
	jointDef.base.localFrameB.p.Set( -h, -h );
	jointDef.base.constraintHertz = 60.0;
	jointDef.base.constraintDampingRatio = 0.0;
	jointDef.base.drawScale = 0.5;

	let bodyIndex = 0;
	// offset is 0.1f in float but 0.1 in double: x + offset * i must be rounded at each step
	const offset = f( f( 0.4 ) * h );
	const dx = f( 10.0 * h );
	const xBase = f( f( -0.5 * dx ) * ( columnCount - 1.0 ) );

	for ( let j = 0; j < columnCount; ++j )
	{
		const x = f( xBase + f( j * dx ) );

		let prevBodyId = null;

		for ( let i = 0; i < rowCount; ++i )
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;

			bodyDef.position.Set(
				f( x + f( offset * i ) ),
				f( h + f( f( 2.0 * h ) * i ) )
			);

			// this tests the deterministic cosine and sine functions
			const angle = ( i & 1 ) == 0 ? -0.1 : 0.1;
			const rot = b2MakeRot( angle );
			bodyDef.rotation = rot;
			rot.delete();

			const bodyId = b2CreateBody( worldId, bodyDef );

			if ( ( i & 1 ) == 0 )
			{
				prevBodyId = bodyId;
			}
			else
			{
				jointDef.base.bodyIdA = prevBodyId;
				jointDef.base.bodyIdB = bodyId;
				b2CreateRevoluteJoint( worldId, jointDef );
				prevBodyId = null;
			}

			b2CreatePolygonShape( bodyId, shapeDef, box );

			console.assert( bodyIndex < bodyCount );
			bodyIds[bodyIndex] = bodyId;

			bodyIndex += 1;

			bodyDef.delete();
		}
	}

	console.assert( bodyIndex == bodyCount );

	box.delete();
	shapeDef.delete();
	jointDef.delete();

	return {
		bodyIds,
		bodyCount,
		stepCount: 0,
		sleepStep: -1,
		hash: 0,
	};
}

// Call once after each world step. Returns true once all bodies are asleep and the hash is computed.
export function UpdateFallingHinges(box2d, worldId, data){
	const {
		b2World_GetBodyEvents,
		b2World_GetAwakeBodyCount,
		b2Body_GetTransform,
		b2Hash,
		B2_HASH_INIT,
	} = box2d;

	if ( data.hash == 0 )
	{
		const bodyEvents = b2World_GetBodyEvents( worldId );

		if ( bodyEvents.moveCount == 0 )
		{
			console.assert( b2World_GetAwakeBodyCount( worldId ) == 0 );

			let hash = B2_HASH_INIT;
			for ( let i = 0; i < data.bodyCount; ++i )
			{
				const transform = b2Body_GetTransform( data.bodyIds[i] );
				hash = b2Hash( hash, transform.ToBytes() );
				transform.delete();
			}

			data.hash = hash;
			data.sleepStep = data.stepCount;
		}

		bodyEvents.delete();
	}

	data.stepCount += 1;

	return data.hash != 0;
}

export function FormatHash(hash){
	return `0x${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

// This sample provides a visual representation of the cross platform determinism unit test.
// The scenario is designed to produce a chaotic result engaging:
// - continuous collision
// - joint limits (approximate atan2)
// - b2MakeRot (approximate sin/cos)
// Once all the bodies go to sleep the step counter and transform hash is emitted which
// can then be transferred to the unit test and tested in GitHub build actions.
// See CrossPlatformTest in the unit tests.
export default class FallingHinges extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 7.5 };
		camera.zoom = 10;
		settings.enableSleep = true;
		settings.drawJoints = true;

		this.m_data = CreateFallingHinges( this.box2d, this.m_worldId );
		this.m_done = false;
	}

	Step(){
		const {
			b2DefaultQueryFilter,
			b2World_OverlapAABB,
			b2World_CastRayClosest,
			b2World_CastRay,
			b2AABB,
			b2Vec2,
			b2Pos_zero,
		} = this.box2d;

		// upstream only advances the hinge data when the world actually stepped
		const didStep = settings.hertz > 0 && ( settings.pause == false || settings.singleStep );

		super.Step();

		if ( didStep && this.m_done == false )
		{
			this.m_done = UpdateFallingHinges( this.box2d, this.m_worldId, this.m_data );

			// Queries in the middle of the simulation must not disturb determinism
			const filter = b2DefaultQueryFilter();
			const scanBox = new b2AABB();
			scanBox.lowerBound.Set( 5.0, 1.0 );
			scanBox.upperBound.Set( 7.0, 2.5 );
			b2World_OverlapAABB( this.m_worldId, b2Pos_zero, scanBox, filter, () => true );
			scanBox.delete();

			const origin = new b2Vec2( 0.0, 12.0 );
			const translation = new b2Vec2( 0.0, -14.0 );

			if ( this.m_stepCount == 30 )
			{
				const result = b2World_CastRayClosest( this.m_worldId, origin, translation, filter );
				result.delete();
			}

			if ( this.m_stepCount < 5 || 100 < this.m_stepCount )
			{
				origin.Set( -10.0, 2.0 );
				translation.Set( 20.0, 0.0 );
				b2World_CastRay( this.m_worldId, origin, translation, filter, (rayCallbackResult) => {
					rayCallbackResult.delete();
					return 1.0;
				});
			}

			origin.delete();
			translation.delete();
			filter.delete();

			if ( this.m_done )
			{
				const match = this.m_data.sleepStep == EXPECTED_SLEEP_STEP && ( this.m_data.hash >>> 0 ) == EXPECTED_HASH;
				console.log( `sleep step = ${this.m_data.sleepStep}, hash = ${FormatHash(this.m_data.hash)}${match ? ' (matches upstream)' : ' (MISMATCH, upstream: sleep step = ' + EXPECTED_SLEEP_STEP + ', hash = ' + FormatHash(EXPECTED_HASH) + ')'}` );
			}
		}
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);
		m_textLine = DrawString(5, m_textLine, `sleep step = ${this.m_data.sleepStep}, hash = ${FormatHash(this.m_data.hash)}`);
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
