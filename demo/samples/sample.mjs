import settings, {DEFAULT_SETTINGS} from './settings.mjs';

export default class Sample{
	constructor(box2d, camera, debugDraw){

		// Object.assign(settings, DEFAULT_SETTINGS);

		this.box2d = box2d;
		this.debugDraw = debugDraw;
		this.camera = camera;

		this.m_groundBodyId = null;
		this.m_mouseJointId = null;

		const {
			b2DefaultWorldDef,
			b2CreateWorld,
			b2CreateThreadedWorld,
		} = box2d;

		this.worldDef = b2DefaultWorldDef();
		this.worldDef.enableSleep = settings.enableSleep;

		if(settings.workerCount > 1){
			this.m_taskSystem = new TaskSystem(settings.workerCount);
			this.m_worldId = b2CreateThreadedWorld(this.worldDef, this.m_taskSystem);
		} else {
			this.m_worldId = b2CreateWorld(this.worldDef);
		}

		this.m_stepCount = 0;

		this.pane = null;
	}

	Step(){
		const {
			b2World_EnableSleeping,
			b2World_EnableWarmStarting,
			b2World_EnableContinuous,
			b2World_Step,
		} = this.box2d;

		let timeStep = settings.hertz > 0.0 ? 1.0 / settings.hertz : 0.0;

		if ( settings.pause )
		{
			if ( settings.singleStep )
			{
				settings.singleStep = false;
			}
			else
			{
				timeStep = 0.0;
			}
		}

		b2World_EnableSleeping( this.m_worldId, settings.enableSleep );
		b2World_EnableWarmStarting( this.m_worldId, settings.enableWarmStarting );
		b2World_EnableContinuous( this.m_worldId, settings.enableContinuous );

		for ( let i = 0; i < 1; ++i )
		{
			b2World_Step( this.m_worldId, timeStep, settings.subStepCount );
			this.m_taskSystem?.ClearTasks();
		}

		this.debugDraw.Draw(this.m_worldId, this.camera);

		this.m_stepCount++;
	}

	QueryCallback(shapeId, context)
	{
		const {
			b2Shape_GetBody,
			b2Body_GetType,
			b2Shape_TestPoint,
			b2BodyType,
		} = this.box2d;

		const bodyId = b2Shape_GetBody( shapeId );
		const bodyType = b2Body_GetType( bodyId );
		if ( bodyType != b2BodyType.b2_dynamicBody )
		{
			return true;
		}

		const overlap = b2Shape_TestPoint( shapeId, context.point );
		if ( overlap )
		{
			context.bodyId = bodyId;
			return false;
		}

		return true;
	}

	MouseDown(p){
		const {
			b2AABB,
			b2Vec2,
			b2World_OverlapAABB,
			b2DefaultQueryFilter,
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultMouseJointDef,
			b2Body_SetAwake,
			b2CreateMouseJoint,
			b2Body_GetMass,
		} = this.box2d;

		const box = new b2AABB();
		const d = new b2Vec2(0.001, 0.001);
		box.lowerBound.Copy(p).Sub(d);
		box.upperBound.Copy(p).Add(d);

		const queryContext = { point: p, bodyId: null };
		b2World_OverlapAABB( this.m_worldId, box, new b2DefaultQueryFilter(), (shapeId) => this.QueryCallback(shapeId, queryContext));

		if(queryContext.bodyId){
			const bodyDef = b2DefaultBodyDef();
			this.m_groundBodyId = b2CreateBody( this.m_worldId, bodyDef );

			const mouseDef = new b2DefaultMouseJointDef();
			mouseDef.bodyIdA = this.m_groundBodyId;
			mouseDef.bodyIdB = queryContext.bodyId;
			mouseDef.target = queryContext.point;
			mouseDef.hertz = 5.0;
			mouseDef.dampingRatio = 0.7;
			mouseDef.maxForce = 1000.0 * b2Body_GetMass( queryContext.bodyId );
			this.m_mouseJointId = b2CreateMouseJoint( this.m_worldId, mouseDef );

			b2Body_SetAwake( queryContext.bodyId, true );
			return true;
		}
	}
	MouseUp(){
		const {
			b2DestroyJoint,
			b2DestroyBody,
		} = this.box2d;

		if(this.m_mouseJointId){
			b2DestroyJoint(this.m_mouseJointId);
			this.m_mouseJointId = null;
		}

		if(this.m_groundBodyId){
			b2DestroyBody(this.m_groundBodyId);
			this.m_groundBodyId = null;
		}
	}
	MouseMove(p){
		const {
			b2Joint_IsValid,
			b2MouseJoint_SetTarget,
			b2Joint_GetBodyB,
			b2Body_SetAwake,
		} = this.box2d;

		if (this.m_mouseJointId !== null && b2Joint_IsValid( this.m_mouseJointId ) == false ) {
			// The world or attached body was destroyed.
			this.m_mouseJointId = null;
		}
		if (this.m_mouseJointId !== null) {
			b2MouseJoint_SetTarget( this.m_mouseJointId, p );
			const bodyIdB = b2Joint_GetBodyB( this.m_mouseJointId );
			b2Body_SetAwake( bodyIdB, true );
		}
	}

	Spawn(){}
	Despawn(){}
	CreateUI(){}
	UpdateUI(){}
	Destroy(){}
}
