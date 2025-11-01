import Sample from "../../sample.mjs";

import Keyboard from '../../../utils/keyboard.mjs';
import settings from '../../settings.mjs';

const e_columns = 4;
const e_rows = 30;

/*
	Note, hash differs from C version due to different float precision (f32 vs f64)
	But the wasm build should be deterministic cross-browser / cross-platform
*/

export default class FallingHinges extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 7.5 };
		camera.zoom = 10;
		settings.enableSleep = true;
		settings.drawJoints = true;

		this.m_bodies = new Array(e_columns * e_rows);
		this.m_hash = 0;
		this.m_sleepStep = -1;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2MakeBox,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			b2MakeRoundedBox,
			b2BodyType,
			B2_PI,
			b2MakeRot,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Set(0.0, -1.0);
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const box = b2MakeBox( 20.0, 1.0 );
			const shapeDef = b2DefaultShapeDef();
			b2CreatePolygonShape( groundId, shapeDef, box );

			bodyDef.delete();
			box.delete();
			shapeDef.delete();
		}

		const h = 0.25;
		const r = 0.1 * h;
		const box = b2MakeRoundedBox( h - r, h - r, r );

		const shapeDef = b2DefaultShapeDef();
		shapeDef.material.friction = 0.3;

		const offset = 0.4 * h;
		const dx = 10.0 * h;
		const xroot = -0.5 * dx * ( e_columns - 1.0 );

		const jointDef = b2DefaultRevoluteJointDef();
		jointDef.enableLimit = true;
		jointDef.lowerAngle = -0.1 * B2_PI;
		jointDef.upperAngle = 0.2 * B2_PI;
		jointDef.enableSpring = true;
		jointDef.hertz = 0.5;
		jointDef.dampingRatio = 0.5;
		jointDef.base.localFrameA.p.Set(h, h );
		jointDef.base.localFrameB.p.Set(offset, -h);
		jointDef.drawSize = 0.1;

		let bodyIndex = 0;
		let bodyCount = e_rows * e_columns;

		for ( let j = 0; j < e_columns; j++ )
		{
			let x = xroot + j * dx;

			let prevBodyId = null;

			for ( let i = 0; i < e_rows; i++ )
			{
				const bodyDef = b2DefaultBodyDef();
				bodyDef.type = b2BodyType.b2_dynamicBody;

				bodyDef.position.Set(
					x + offset * i,
					h + 2.0 * h * i
				);

				// this tests the deterministic cosine and sine functions
				const rot = b2MakeRot( 0.1 * i - 1.0 );
				bodyDef.rotation = rot;
				rot.delete();

				const bodyId = b2CreateBody( this.m_worldId, bodyDef );

				if ((i & 1) == 0)
				{
					prevBodyId = bodyId;
				}
				else
				{
					jointDef.base.bodyIdA = prevBodyId;
					jointDef.base.bodyIdB = bodyId;
					b2CreateRevoluteJoint( this.m_worldId, jointDef );
					prevBodyId = null;
				}

				b2CreatePolygonShape( bodyId, shapeDef, box );

				console.assert( bodyIndex < bodyCount );
				this.m_bodies[bodyIndex] = bodyId;

				bodyIndex += 1;

				bodyDef.delete();
			}
		}

		box.delete();
		shapeDef.delete();
		jointDef.delete();

		this.CreateUI();
	}

	Despawn(){
		Keyboard.HideTouchControls();
	}

	Step(){
		const {
			b2World_GetBodyEvents,
			b2Body_GetTransform,
			b2Hash,
			B2_HASH_INIT,
		} = this.box2d;

		super.Step();

		if(this.m_hash === 0){
			const bodyEvents = b2World_GetBodyEvents( this.m_worldId );

			if ( bodyEvents.moveCount == 0 )
			{
				let hash = B2_HASH_INIT;

				const bodyCount = e_rows * e_columns;
				for ( let i = 0; i < bodyCount; i++ )
				{
					const xf = b2Body_GetTransform( this.m_bodies[i] );
					//printf( "%d %.9f %.9f %.9f %.9f\n", i, xf.p.x, xf.p.y, xf.q.c, xf.q.s );
					hash = b2Hash( hash, xf.ToBytes() );
					xf.delete();
				}

				this.m_sleepStep = this.m_stepCount - 1;
				this.m_hash = hash;
			}

			bodyEvents.delete();
		}
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);
		DrawString(5, m_textLine, `sleep step = ${this.m_sleepStep}, hash = 0x${this.m_hash.toString(16)}`);
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
