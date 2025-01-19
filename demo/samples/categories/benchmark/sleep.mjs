import Sample from "../../sample.mjs";

const e_maxBaseCount = 100;
const e_maxBodyCount = e_maxBaseCount * ( e_maxBaseCount + 1 ) / 2;

export default class Sleep extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 50.0 };
		camera.zoom = 25.0 * 2.2;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2MakeBox,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
		} = this.box2d;

		const groundSize = 100.0;

		const bodyDef = b2DefaultBodyDef();
		const groundId = b2CreateBody( this.m_worldId, bodyDef );

		const box = b2MakeBox( groundSize, 1.0 );
		const shapeDef = b2DefaultShapeDef();
		b2CreatePolygonShape( groundId, shapeDef, box );

		this.m_bodies = new Array(e_maxBodyCount).fill(null);

		this.m_baseCount = 100;
		this.m_iterations = 10;
		this.m_bodyCount = 0;

		this.m_awake = false;

		this.m_wakeTotal = 0.0;
		this.m_wakeCount = 0;

		this.m_sleepTotal = 0.0;
		this.m_sleepCount = 0;

		this.Spawn();
	}

	Spawn(){
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DestroyBody,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeRoundedBox,
			b2BodyType
		} = this.box2d;

		for ( let i = 0; i < e_maxBodyCount; i++ )
		{
			if (this.m_bodies[i] !== null)
			{
				b2DestroyBody( this.m_bodies[i] );
				this.m_bodies[i] = null;
			}
		}

		const count = this.m_baseCount;
		const rad = 0.5;
		const shift = rad * 2.0;
		const centerx = shift * count / 2.0;
		const centery = shift / 2.0 + 1.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.friction = 0.5;

		const h = 0.5;
		const box = b2MakeRoundedBox( h, h, 0.0 );

		let index = 0;

		for ( let i = 0; i < count; i++ )
		{
			const y = i * shift + centery;

			for ( let j = i; j < count; j++ )
			{
				const x = 0.5 * i * shift + ( j - i ) * shift - centerx;
				bodyDef.position.Set(x, y);

				console.assert( index < e_maxBodyCount );
				this.m_bodies[index] = b2CreateBody( this.m_worldId, bodyDef );
				b2CreatePolygonShape( this.m_bodies[index], shapeDef, box );

				index += 1;
			}
		}

		this.m_bodyCount = index;
	}

	Step(){
		const {
			b2Body_SetAwake,
		} = this.box2d;

		let start = performance.now();

		const b2GetMillisecondsAndReset = () => {
			const end = performance.now();
			const ms = end - start;
			start = end;
			return ms
		}

		for ( let i = 0; i < this.m_iterations; i++ )
		{
			b2Body_SetAwake( this.m_bodies[0], this.m_awake );
			if ( this.m_awake )
			{
				this.m_wakeTotal += b2GetMillisecondsAndReset();
				this.m_wakeCount += 1;
			}
			else
			{
				this.m_sleepTotal += b2GetMillisecondsAndReset();
				this.m_sleepCount += 1;
			}
			this.m_awake = !this.m_awake;
		}

		super.Step();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		if ( this.m_wakeCount > 0 )
		{
			m_textLine += DrawString( 5, m_textLine, `wake ave = ${(this.m_wakeTotal / this.m_wakeCount).toFixed(6)} ms`);
		}

		if ( this.m_sleepCount > 0 )
		{
			m_textLine += DrawString( 5, m_textLine, `sleep ave = ${(this.m_sleepTotal / this.m_sleepCount).toFixed(6)} ms` );
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
