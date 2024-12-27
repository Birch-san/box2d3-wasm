import Sample from "../sample.mjs";

import camera from '../camera.mjs';
import settings from '../settings.mjs';

export default class SensorFunnel extends Sample{
	constructor(box2d, canvas){
		super(box2d, canvas);

		camera.center = {x: 0.0, y: 0.0 };
		camera.zoom = 15.0;

		settings.drawJoints = false;

		{
			const {
				b2DefaultBodyDef,
				b2Vec2,
				b2Vec2_zero,
				b2CreateBody,
				b2CreateChain,
				b2DefaultChainDef,
				b2DefaultShapeDef,
				b2CreatePolygonShape,
				b2CreateRevoluteJoint,
				b2DefaultRevoluteJointDef,
				b2MakeBox,
				b2MakeOffsetBox,
				b2BodyType,
				b2Rot_identity
			} = box2d;

			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const points = [
				[ -16.8672504, 31.088623 ],	 [ 16.8672485, 31.088623 ],		[ 16.8672485, 17.1978741 ],
				[ 8.26824951, 11.906374 ],	 [ 16.8672485, 11.906374 ],		[ 16.8672485, -0.661376953 ],
				[ 8.26824951, -5.953125 ],	 [ 16.8672485, -5.953125 ],		[ 16.8672485, -13.229126 ],
				[ 3.63799858, -23.151123 ],	 [ 3.63799858, -31.088623 ],	[ -3.63800049, -31.088623 ],
				[ -3.63800049, -23.151123 ], [ -16.8672504, -13.229126 ],	[ -16.8672504, -5.953125 ],
				[ -8.26825142, -5.953125 ],	 [ -16.8672504, -0.661376953 ], [ -16.8672504, 11.906374 ],
				[ -8.26825142, 11.906374 ],	 [ -16.8672504, 17.1978741 ],
			].map( ( [x, y] ) => ({x, y}) );


			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints(points);
			chainDef.isLoop = true;
			chainDef.friction = 0.2;
			b2CreateChain( groundId, chainDef );

			let sign = 1.0;
			let y = 14.0;
			for ( let i = 0; i < 3; ++i )
			{
				bodyDef.position.Set(0.0, y);
				bodyDef.type = b2BodyType.b2_dynamicBody;

				const bodyId = b2CreateBody(this.m_worldId, bodyDef);

				const box = b2MakeBox(6.0, 0.5 );
				const shapeDef = b2DefaultShapeDef();
				shapeDef.friction = 0.1;
				shapeDef.restitution = 1.0;
				shapeDef.density = 1.0;

				b2CreatePolygonShape( bodyId, shapeDef, box );

				const revoluteDef = b2DefaultRevoluteJointDef();
				revoluteDef.bodyIdA = groundId;
				revoluteDef.bodyIdB = bodyId;
				revoluteDef.localAnchorA = bodyDef.position;
				revoluteDef.localAnchorB = b2Vec2_zero;
				revoluteDef.maxMotorTorque = 200.0;
				revoluteDef.motorSpeed = 2.0 * sign;
				revoluteDef.enableMotor = true;

				b2CreateRevoluteJoint( this.m_worldId, revoluteDef );

				y -= 14.0;
				sign = -sign;
			}

			{
				const box = b2MakeOffsetBox( 4.0, 1.0, new b2Vec2(0.0, -30.5), b2Rot_identity );
				const shapeDef = b2DefaultShapeDef();
				shapeDef.isSensor = true;
				b2CreatePolygonShape( groundId, shapeDef, box );
			}
		}

		// m_wait = 0.5f;
		// m_side = -15.0f;
		// m_type = e_human;

		// for ( int i = 0; i < e_count; ++i )
		// {
		// 	m_isSpawned[i] = false;
		// }

		// memset( m_humans, 0, sizeof( m_humans ) );

		// CreateElement();*/
	}
}