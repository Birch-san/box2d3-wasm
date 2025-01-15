import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";

const e_maxBaseCount = 100;
const e_maxBodyCount = e_maxBaseCount * ( e_maxBaseCount + 1 ) / 2;

export default class CreateDestroy extends Sample{
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
		const start = performance.now();

		for ( let i = 0; i < this.m_iterations; i++ )
		{
			this.Spawn();
		}

		const end = performance.now();
		this.m_deltaTime = end - start;

		super.Step();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);
		DrawString(5, m_textLine, `milliseconds=${this.m_deltaTime.toFixed(2)}`);
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
