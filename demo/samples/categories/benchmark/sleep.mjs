import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";

const SLEEP_PYRAMID_COUNT = 10;

const g_sleepData = {
	bodyIdA: new Array(SLEEP_PYRAMID_COUNT).fill(null),
	bodyIdB: new Array(SLEEP_PYRAMID_COUNT).fill(null),
};

export default class Sleep extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 20.0 };
		camera.zoom = 25.0 * 6.0;

		CreateSleep(this.box2d, this.m_worldId);
	}

	static GetCapacity(box2d){
		const capacity = new box2d.b2Capacity();
		capacity.staticShapeCount = 1;
		capacity.dynamicShapeCount = 21000;
		capacity.staticBodyCount = 1;
		capacity.dynamicBodyCount = 21000;
		capacity.contactCount = 68000;
		capacity.arenaByteCount = 10000 * 1024;
		return capacity;
	}

	Step(){
		if (settings.pause == false || settings.singleStep)
		{
			StepSleep(this.box2d, this.m_worldId, this.m_stepCount);
		}

		super.Step();
	}
}

// Reports two bodies that are certain to share a touching contact, so the filter joint below always
// lands inside one island.
function CreateSleepPyramid(box2d, worldId, baseCount, extent, centerX, index){
	const {
		b2DefaultBodyDef,
		b2DefaultShapeDef,
		b2MakeSquare,
		b2CreateBody,
		b2CreatePolygonShape,
		b2BodyType
	} = box2d;

	const bodyDef = b2DefaultBodyDef();
	bodyDef.type = b2BodyType.b2_dynamicBody;
	bodyDef.sleepThreshold = 1.0;

	const shapeDef = b2DefaultShapeDef();
	const box = b2MakeSquare( extent );

	for ( let i = 0; i < baseCount; ++i )
	{
		const y = ( 2.0 * i + 1.0 ) * extent;

		for ( let j = i; j < baseCount; ++j )
		{
			const x = ( i + 1.0 ) * extent + 2.0 * ( j - i ) * extent + centerX;
			bodyDef.position.Set( x, y );

			const bodyId = b2CreateBody( worldId, bodyDef );
			b2CreatePolygonShape( bodyId, shapeDef, box );

			if ( i == 0 && j == 0 )
			{
				g_sleepData.bodyIdA[index] = bodyId;
			}
			else if ( i == 1 && j == 1 )
			{
				// Rests on the base body above, so the pair always has a touching contact
				g_sleepData.bodyIdB[index] = bodyId;
			}
		}
	}

	bodyDef.delete();
	shapeDef.delete();
	box.delete();
}

// Stress tests waking and sleeping.
function CreateSleep(box2d, worldId){
	const {
		b2DefaultBodyDef,
		b2CreateBody,
		b2MakeBox,
		b2DefaultShapeDef,
		b2CreatePolygonShape,
	} = box2d;

	g_sleepData.bodyIdA.fill(null);
	g_sleepData.bodyIdB.fill(null);

	const baseCount = 60;
	const extent = 0.5;

	const baseWidth = 2.0 * extent * baseCount;
	const pitch = baseWidth + 8.0 * extent;
	const span = pitch * ( SLEEP_PYRAMID_COUNT - 1 );

	{
		const bodyDef = b2DefaultBodyDef();
		bodyDef.position.Set( 0.0, -1.0 );
		const groundId = b2CreateBody( worldId, bodyDef );

		const box = b2MakeBox( 0.5 * span + baseWidth, 1.0 );
		const shapeDef = b2DefaultShapeDef();
		b2CreatePolygonShape( groundId, shapeDef, box );

		bodyDef.delete();
		box.delete();
		shapeDef.delete();
	}

	for ( let i = 0; i < SLEEP_PYRAMID_COUNT; ++i )
	{
		const centerX = -0.5 * span + i * pitch - 0.5 * baseWidth;
		CreateSleepPyramid( box2d, worldId, baseCount, extent, centerX, i );
	}
}

function StepSleep(box2d, worldId, stepCount){
	const {
		b2Body_IsAwake,
		b2DefaultFilterJointDef,
		b2CreateFilterJoint,
		b2DestroyJoint
	} = box2d;

	for ( let i = 0; i < SLEEP_PYRAMID_COUNT; ++i )
	{
		if ( b2Body_IsAwake( g_sleepData.bodyIdA[i] ) == false )
		{
			// Creating and destroying a joint engages the island splitter
			const jointDef = b2DefaultFilterJointDef();
			jointDef.base.bodyIdA = g_sleepData.bodyIdA[i];
			jointDef.base.bodyIdB = g_sleepData.bodyIdB[i];
			const jointId = b2CreateFilterJoint( worldId, jointDef );
			jointDef.delete();

			// This wakes the island
			b2DestroyJoint( jointId );

			// Only one per step
			break;
		}
	}

	return 0.0;
}
