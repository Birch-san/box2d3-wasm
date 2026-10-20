import Sample from "../../sample.mjs";


export default class Kinematic extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 0.0 };
		camera.zoom = 150.0;

		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2Vec2,
			b2DefaultShapeDef,
			b2CreatePolygonShape,
			b2MakeOffsetBox,
			b2Rot_identity,
			b2BodyType,
			b2Body_UpdateMassFromShapes
		} = this.box2d;

		const grid = 1.0;

		const span = 100;

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_kinematicBody;
		bodyDef.angularVelocity = 1.0;

		const shapeDef = b2DefaultShapeDef();
		shapeDef.filter.categoryBits = 1;
		shapeDef.filter.maskBits = 2;

		// defer mass properties to avoid n-squared mass computations
		shapeDef.updateBodyMass = false;

		const bodyId = b2CreateBody( this.m_worldId, bodyDef );

		const p = new b2Vec2();
		for ( let i = -span; i < span; i++ )
		{
			const y = i * grid;
			for ( let j = -span; j < span; j++ )
			{
				const x = j * grid;
				const square = b2MakeOffsetBox( 0.5 * grid, 0.5 * grid, p.Set(x, y), b2Rot_identity );
				b2CreatePolygonShape( bodyId, shapeDef, square );

				square.delete();
			}
		}

		p.delete();
		bodyDef.delete();
		shapeDef.delete();

		// All shapes have been added so I can efficiently compute the mass properties.
		b2Body_UpdateMassFromShapes( bodyId );
	}
}
