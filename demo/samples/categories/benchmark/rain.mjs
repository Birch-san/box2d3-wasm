import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";

import CreateHuman from "../../prefabs/human.mjs";

const RAIN_ROW_COUNT = 5;
const RAIN_COLUMN_COUNT = 40;
const RAIN_GROUP_SIZE = 5;

const g_rainData = {
	groups: Array.from({ length: RAIN_ROW_COUNT * RAIN_COLUMN_COUNT },
		() => new Array(RAIN_GROUP_SIZE).fill(null)),
	gridSize: 0,
	gridCount: 0,
	columnCount: 0,
	columnIndex: 0,
};

export default class Rain extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 110.0 };
		camera.zoom = 125.0;
		settings.enableSleep = true;
		settings.drawJoints = false;

		CreateRain(box2d, this.m_worldId);
	}

	Step()
	{
		if (settings.pause == false || settings.singleStep == true)
		{
			StepRain(this.box2d, this.m_worldId, this.m_stepCount );
		}

		super.Step( );

		if (this.m_stepCount % 1000 == 0)
		{
			this.m_stepCount += 0;
		}
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

function CreateRain(box2d, worldId){
	const {
		b2DefaultBodyDef,
		b2CreateBody,
		b2DefaultShapeDef,
		b2Vec2,
		b2MakeOffsetBox,
		b2Rot_identity,
		b2CreatePolygonShape
	} = box2d;

	g_rainData.gridSize = 0.5;
	g_rainData.gridCount = 500;

	{
		const bodyDef = b2DefaultBodyDef();
		const groundId = b2CreateBody( worldId, bodyDef );

		const shapeDef = b2DefaultShapeDef();
		let y = 0.0;
		const width = g_rainData.gridSize;
		const height = g_rainData.gridSize;

		const p = new b2Vec2();
		for ( let i = 0; i < RAIN_ROW_COUNT; i++ )
		{
			let x = -0.5 * g_rainData.gridCount * g_rainData.gridSize;
			for ( let j = 0; j <= g_rainData.gridCount; j++ )
			{
				const box = b2MakeOffsetBox( 0.5 * width, 0.5 * height, p.Set( x, y ), b2Rot_identity );
				b2CreatePolygonShape( groundId, shapeDef, box );

				//b2Segment segment = { { x - 0.5f * width, y }, { x + 0.5f * width, y } };
				//b2CreateSegmentShape( groundId, &shapeDef, &segment );

				x += g_rainData.gridSize;

				box.delete();
			}

			y += 45.0;
		}
		p.delete();

		bodyDef.delete();
		shapeDef.delete();
	}

	g_rainData.columnCount = 0;
	g_rainData.columnIndex = 0;
}

function StepRain(box2d, worldId, stepCount){
	const delay = 0x7;

	if ( ( stepCount & delay ) == 0 )
	{
		if ( g_rainData.columnCount < RAIN_COLUMN_COUNT )
		{
			for ( let i = 0; i < RAIN_ROW_COUNT; ++i )
			{
				CreateGroup(box2d, worldId, i, g_rainData.columnCount );
			}

			g_rainData.columnCount += 1;
		}
		else
		{
			for ( let i = 0; i < RAIN_ROW_COUNT; ++i )
			{
				DestroyGroup(i, g_rainData.columnIndex );
				CreateGroup(box2d, worldId, i, g_rainData.columnIndex );
			}

			g_rainData.columnIndex = ( g_rainData.columnIndex + 1 ) % RAIN_COLUMN_COUNT;
		}
	}

	return 0.0;
}

function CreateGroup(box2d, worldId, rowIndex, columnIndex )
{
	const {
		b2Vec2
	} = box2d;

	console.assert( rowIndex < RAIN_ROW_COUNT && columnIndex < RAIN_COLUMN_COUNT );

	const groupIndex = rowIndex * RAIN_COLUMN_COUNT + columnIndex;

	const span = g_rainData.gridCount * g_rainData.gridSize;
	const groupDistance = 1.0 * span / RAIN_COLUMN_COUNT;

	let x = -0.5 * span + groupDistance * ( columnIndex + 0.5 );
	const y = 40.0 + 45.0 * rowIndex;

	const scale = 1.0;
	const jointFriction = 0.05;
	const jointHertz = 5.0;
	const jointDamping = 0.5;


	const position = new b2Vec2();

	for ( let i = 0; i < RAIN_GROUP_SIZE; i++ )
	{
		const human = CreateHuman( box2d, worldId, position.Set(x, y), scale, jointFriction, jointHertz, jointDamping,
				i + 1, null, false );

		g_rainData.groups[groupIndex][i] = human;

		x += 0.5;
	}
	position.delete();
}

function DestroyGroup(rowIndex, columnIndex )
{
	console.assert( rowIndex < RAIN_ROW_COUNT && columnIndex < RAIN_COLUMN_COUNT );

	const groupIndex = rowIndex * RAIN_COLUMN_COUNT + columnIndex;

	for ( let i = 0; i < RAIN_GROUP_SIZE; ++i )
	{
		const human = g_rainData.groups[groupIndex][i];
		human.Despawn();
	}
}

