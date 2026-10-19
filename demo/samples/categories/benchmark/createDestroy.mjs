import Sample from "../../sample.mjs";

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

		this.m_createTime = 0.0;
		this.m_destroyTime = 0.0;

		this.m_baseCount = 100;
		this.m_iterations = 10;
		this.m_bodyCount = 0;

		bodyDef.delete();
		box.delete();
		shapeDef.delete();
	}

	CreateScene(){
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DestroyBody,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeRoundedBox,
			b2World_Step,
			b2BodyType
		} = this.box2d;

		let ticks = performance.now();

		for ( let i = 0; i < e_maxBodyCount; i++ )
		{
			if (this.m_bodies[i] !== null)
			{
				b2DestroyBody( this.m_bodies[i] );
				this.m_bodies[i] = null;
			}
		}

		const now = performance.now();
		this.m_destroyTime += now - ticks;
		ticks = now;

		const count = this.m_baseCount;
		const rad = 0.5;
		const shift = rad * 2.0;
		const centerx = shift * count / 2.0;
		const centery = shift / 2.0 + 1.0;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.density = 1.0;
		shapeDef.material.friction = 0.5;

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

		this.m_createTime += performance.now() - ticks;

		this.m_bodyCount = index;

		bodyDef.delete();
		shapeDef.delete();
		box.delete();

		b2World_Step( this.m_worldId, 1.0 / 60.0, 4 );
		this.m_taskSystem?.ClearTasks();
	}

	Step(){
		this.m_createTime = 0.0;
		this.m_destroyTime = 0.0;

		for ( let i = 0; i < this.m_iterations; i++ )
		{
			this.CreateScene();
		}

		super.Step();
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		m_textLine = DrawString( 5, m_textLine, `total: create = ${this.m_createTime.toFixed(3)} ms, destroy = ${this.m_destroyTime.toFixed(3)} ms` );

		if ( this.m_bodyCount > 0 )
		{
			const createPerBody = 1000.0 * this.m_createTime / this.m_iterations / this.m_bodyCount;
			const destroyPerBody = 1000.0 * this.m_destroyTime / this.m_iterations / this.m_bodyCount;
			m_textLine = DrawString( 5, m_textLine, `body: create = ${createPerBody.toFixed(3)} us, destroy = ${destroyPerBody.toFixed(3)} us` );
		}

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
