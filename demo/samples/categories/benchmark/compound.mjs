import Sample from "../../sample.mjs";
import settings from "../../settings.mjs";


export default class Compound extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 18.0, y: 115.0 };
		camera.zoom = 25.0 * 5.5;

		const grid = 1.0;

		const height = 100;
		const width = 100;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeOffsetBox,
			b2CreatePolygonShape,
			b2Vec2,
			b2Rot_identity,
			b2BodyType,
			b2Body_ApplyMassFromShapes
		} = this.box2d;


		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );
			const shapeDef = b2DefaultShapeDef();

			const p = new b2Vec2(0.0, 0.0);

			for ( let i = 0; i < height; i++ )
			{
				const y = grid * i;
				for ( let j = i; j < width; j++ )
				{
					const x = grid * j;
					const square = b2MakeOffsetBox( 0.5 * grid, 0.5 * grid, p.Set(x, y), b2Rot_identity );
					b2CreatePolygonShape( groundId, shapeDef, square );
					square.delete();
				}
			}

			for ( let i = 0; i < height; i++ )
			{
				const y = grid * i;
				for ( let j = i; j < width; j++ )
				{
					const x = -grid * j;
					const square = b2MakeOffsetBox( 0.5 * grid, 0.5 * grid, p.Set(x, y), b2Rot_identity );
					b2CreatePolygonShape( groundId, shapeDef, square );
					square.delete();
				}
			}

			bodyDef.delete();
			shapeDef.delete();
			p.delete();
		}

		{
			const span = 20;
			const count = 5;

			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			// defer mass properties to avoid n-squared mass computations
			const shapeDef = b2DefaultShapeDef();
			shapeDef.updateBodyMass = false;

			for ( let m = 0; m < count; m++ )
			{
				const ybody = ( 100.0 + m * span ) * grid;

				for ( let n = 0; n < count; n++ )
				{
					const xbody = -0.5 * grid * count * span + n * span * grid;
					bodyDef.position.Set(xbody, ybody );
					const bodyId = b2CreateBody( this.m_worldId, bodyDef );

					for ( let i = 0; i < span; i++ )
					{
						const y = i * grid;
						const p = new b2Vec2();
						for ( let j = 0; j < span; j++ )
						{
							const x = j * grid;
							const square = b2MakeOffsetBox( 0.5 * grid, 0.5 * grid, p.Set(x, y), b2Rot_identity );
							b2CreatePolygonShape( bodyId, shapeDef, square );

							square.delete();
						}
						p.delete();
					}

					// All shapes have been added so I can efficiently compute the mass properties.
					b2Body_ApplyMassFromShapes( bodyId );
				}
			}

			bodyDef.delete();
			shapeDef.delete();
		}
	}
}
