import settings from './settings.mjs';

export default class Sample{
	constructor(box2d, camera, debugDraw){
		this.box2d = box2d;
		this.debugDraw = debugDraw;
		this.camera = camera;

		this.m_mouseBodyId = null;
		this.m_mouseJointId = null;
		this.m_mouseForceScale = 100.0;
		this.m_mousePoint = new box2d.b2Vec2(0, 0);

		const {
			b2DefaultWorldDef,
			b2CreateWorld,
			b2CreateThreadedWorld,
			TaskSystem
		} = box2d;

		const worldDef = b2DefaultWorldDef();
		worldDef.enableSleep = settings.enableSleep;

		if(settings.workerCount > 1){
			this.m_taskSystem = new TaskSystem(settings.workerCount);
			this.m_worldId = b2CreateThreadedWorld(worldDef, this.m_taskSystem);
		} else {
			this.m_worldId = b2CreateWorld(worldDef);
		}

		this.m_stepCount = 0;

		this.m_totalProfile = {...profileInterface};
		this.m_maxProfile = {...profileInterface};
		this.m_aveProfile = {...profileInterface};

		this.pane = null;

		worldDef.delete();
	}

	Step(){
		const {
			b2World_EnableSleeping,
			b2World_EnableWarmStarting,
			b2World_EnableContinuous,
			b2World_Step,
			b2Joint_IsValid,
			b2Transform,
			b2Rot_identity,
			b2Body_SetTargetTransform,
			b2DestroyBody,
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

		if ( this.m_mouseJointId !== null && b2Joint_IsValid( this.m_mouseJointId ) == false )
		{
			// The world or attached body was destroyed.
			this.m_mouseJointId = null;

			if ( this.m_mouseBodyId !== null)
			{
				b2DestroyBody( this.m_mouseBodyId );
				this.m_mouseBodyId = null;
			}
		}

		if ( this.m_mouseBodyId !== null && timeStep > 0.0 )
		{
			const xf = new b2Transform();
			xf.p = this.m_mousePoint;
			xf.q = b2Rot_identity;
			b2Body_SetTargetTransform( this.m_mouseBodyId, xf, timeStep );

			xf.delete();
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

	QueryCallback(overlapCallbackResult, context)
	{
		const {
			b2Shape_GetBody,
			b2Body_GetType,
			b2Shape_TestPoint,
			b2BodyType,
		} = this.box2d;

		const {shapeId} = overlapCallbackResult;

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
			b2DefaultMotorJointDef,
			b2Body_SetAwake,
			b2Body_GetMassData,
			b2Length,
			b2World_GetGravity,
			b2Body_GetLocalPoint,
			b2CreateMotorJoint,
			b2BodyType
		} = this.box2d;

		const box = new b2AABB();
		const d = new b2Vec2(0.001, 0.001);
		box.lowerBound.Copy(p).Sub(d);
		box.upperBound.Copy(p).Add(d);

		this.m_mousePoint.Copy(p);

		const queryContext = { point: p, bodyId: null };

		const filter = b2DefaultQueryFilter();
		b2World_OverlapAABB( this.m_worldId, box, filter, (overlapCallbackResult) => this.QueryCallback(overlapCallbackResult, queryContext));
		filter.delete();

		box.delete();
		d.delete();

		if(queryContext.bodyId){
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_kinematicBody;
			bodyDef.position.Copy(this.m_mousePoint);
			bodyDef.enableSleep = false;
			this.m_mouseBodyId = b2CreateBody( this.m_worldId, bodyDef );

			const jointDef = b2DefaultMotorJointDef();
			jointDef.base.bodyIdA = this.m_mouseBodyId;
			jointDef.base.bodyIdB = queryContext.bodyId;
			const localPointB = b2Body_GetLocalPoint( queryContext.bodyId, p )
			jointDef.base.localFrameB.p.Copy( localPointB );
			jointDef.linearHertz = 7.5;
			jointDef.linearDampingRatio = 1.0;

			const massData = b2Body_GetMassData( queryContext.bodyId );
			const g = b2Length( b2World_GetGravity( this.m_worldId ) );
			const mg = massData.mass * g;

			jointDef.maxSpringForce = this.m_mouseForceScale * mg;


			if ( massData.mass > 0.0 )
			{
				const lever = Math.sqrt( massData.rotationalInertia / massData.mass );
				jointDef.maxVelocityTorque = 0.25 * lever * mg;
			}

			this.m_mouseJointId = b2CreateMotorJoint( this.m_worldId, jointDef );

			bodyDef.delete();
			jointDef.delete();
			localPointB.delete();
			massData.delete();

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
			b2DestroyJoint(this.m_mouseJointId, true);
			this.m_mouseJointId = null;
		}

		if(this.m_mouseBodyId){
			b2DestroyBody(this.m_mouseBodyId);
			this.m_mouseBodyId = null;
		}
	}
	MouseMove(p){
		const {
			b2Joint_IsValid,
		} = this.box2d;

		if (this.m_mouseJointId !== null && b2Joint_IsValid( this.m_mouseJointId ) == false ) {
			// The world or attached body was destroyed.
			this.m_mouseJointId = null;
		}

		this.m_mousePoint.Copy(p);
	}

	HandleProfile(DrawString, m_textLine){
		const {
			b2World_GetProfile
		} = this.box2d;
		const profile = b2World_GetProfile( this.m_worldId );

		this.m_totalProfile.step += profile.step;
		this.m_totalProfile.pairs += profile.pairs;
		this.m_totalProfile.collide += profile.collide;
		this.m_totalProfile.solve += profile.solve;
		this.m_totalProfile.prepareStages += profile.prepareStages;
		this.m_totalProfile.solveConstraints += profile.solveConstraints;
		this.m_totalProfile.prepareConstraints += profile.prepareConstraints;
		this.m_totalProfile.integrateVelocities += profile.integrateVelocities;
		this.m_totalProfile.warmStart += profile.warmStart;
		this.m_totalProfile.solveImpulses += profile.solveImpulses;
		this.m_totalProfile.integratePositions += profile.integratePositions;
		this.m_totalProfile.relaxImpulses += profile.relaxImpulses;
		this.m_totalProfile.applyRestitution += profile.applyRestitution;
		this.m_totalProfile.storeImpulses += profile.storeImpulses;
		this.m_totalProfile.splitIslands += profile.splitIslands;
		this.m_totalProfile.transforms += profile.transforms;
		this.m_totalProfile.jointEvents += profile.jointEvents;
		this.m_totalProfile.hitEvents += profile.hitEvents;
		this.m_totalProfile.refit += profile.refit;
		this.m_totalProfile.bullets += profile.bullets;
		this.m_totalProfile.sleepIslands += profile.sleepIslands;
		this.m_totalProfile.sensors += profile.sensors;

		this.m_maxProfile.step = Math.max(this.m_maxProfile.step, profile.step);
		this.m_maxProfile.pairs = Math.max(this.m_maxProfile.pairs, profile.pairs);
		this.m_maxProfile.collide = Math.max(this.m_maxProfile.collide, profile.collide);
		this.m_maxProfile.solve = Math.max(this.m_maxProfile.solve, profile.solve);
		this.m_maxProfile.prepareStages = Math.max(this.m_maxProfile.prepareStages, profile.prepareStages);
		this.m_maxProfile.solveConstraints = Math.max(this.m_maxProfile.solveConstraints, profile.solveConstraints);
		this.m_maxProfile.prepareConstraints = Math.max(this.m_maxProfile.prepareConstraints, profile.prepareConstraints);
		this.m_maxProfile.integrateVelocities = Math.max(this.m_maxProfile.integrateVelocities, profile.integrateVelocities);
		this.m_maxProfile.warmStart = Math.max(this.m_maxProfile.warmStart, profile.warmStart);
		this.m_maxProfile.solveImpulses = Math.max(this.m_maxProfile.solveImpulses, profile.solveImpulses);
		this.m_maxProfile.integratePositions = Math.max(this.m_maxProfile.integratePositions, profile.integratePositions);
		this.m_maxProfile.relaxImpulses = Math.max(this.m_maxProfile.relaxImpulses, profile.relaxImpulses);
		this.m_maxProfile.applyRestitution = Math.max(this.m_maxProfile.applyRestitution, profile.applyRestitution);
		this.m_maxProfile.storeImpulses = Math.max(this.m_maxProfile.storeImpulses, profile.storeImpulses);
		this.m_maxProfile.splitIslands = Math.max(this.m_maxProfile.splitIslands, profile.splitIslands);
		this.m_maxProfile.transforms = Math.max(this.m_maxProfile.transforms, profile.transforms);
		this.m_maxProfile.jointEvents = Math.max(this.m_maxProfile.jointEvents, profile.jointEvents);
		this.m_maxProfile.hitEvents = Math.max(this.m_maxProfile.hitEvents, profile.hitEvents);
		this.m_maxProfile.refit = Math.max(this.m_maxProfile.refit, profile.refit);
		this.m_maxProfile.bullets = Math.max(this.m_maxProfile.bullets, profile.bullets);
		this.m_maxProfile.sleepIslands = Math.max(this.m_maxProfile.sleepIslands, profile.sleepIslands);
		this.m_maxProfile.sensors = Math.max(this.m_maxProfile.sensors, profile.sensors);

		if(settings.profile){
			this.m_aveProfile.step = this.m_totalProfile.step / this.m_stepCount;
			this.m_aveProfile.pairs = this.m_totalProfile.pairs / this.m_stepCount;
			this.m_aveProfile.collide = this.m_totalProfile.collide / this.m_stepCount;
			this.m_aveProfile.solve = this.m_totalProfile.solve / this.m_stepCount;
			this.m_aveProfile.prepareStages = this.m_totalProfile.prepareStages / this.m_stepCount;
			this.m_aveProfile.solveConstraints = this.m_totalProfile.solveConstraints / this.m_stepCount;
			this.m_aveProfile.prepareConstraints = this.m_totalProfile.prepareConstraints / this.m_stepCount;
			this.m_aveProfile.integrateVelocities = this.m_totalProfile.integrateVelocities / this.m_stepCount;
			this.m_aveProfile.warmStart = this.m_totalProfile.warmStart / this.m_stepCount;
			this.m_aveProfile.solveImpulses = this.m_totalProfile.solveImpulses / this.m_stepCount;
			this.m_aveProfile.integratePositions = this.m_totalProfile.integratePositions / this.m_stepCount;
			this.m_aveProfile.relaxImpulses = this.m_totalProfile.relaxImpulses / this.m_stepCount;
			this.m_aveProfile.applyRestitution = this.m_totalProfile.applyRestitution / this.m_stepCount;
			this.m_aveProfile.storeImpulses = this.m_totalProfile.storeImpulses / this.m_stepCount;
			this.m_aveProfile.splitIslands = this.m_totalProfile.splitIslands / this.m_stepCount;
			this.m_aveProfile.transforms = this.m_totalProfile.transforms / this.m_stepCount;
			this.m_aveProfile.jointEvents = this.m_totalProfile.jointEvents / this.m_stepCount;
			this.m_aveProfile.hitEvents = this.m_totalProfile.hitEvents / this.m_stepCount;
			this.m_aveProfile.refit = this.m_totalProfile.refit / this.m_stepCount;
			this.m_aveProfile.bullets = this.m_totalProfile.bullets / this.m_stepCount;
			this.m_aveProfile.sleepIslands = this.m_totalProfile.sleepIslands / this.m_stepCount;
			this.m_aveProfile.sensors = this.m_totalProfile.sensors / this.m_stepCount;

			m_textLine = DrawString(5, m_textLine, `step [ave] (max) = ${profile.step.toFixed(2)} [${this.m_aveProfile.step.toFixed(2)}] (${this.m_maxProfile.step.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `pairs [ave] (max) = ${profile.pairs.toFixed(2)} [${this.m_aveProfile.pairs.toFixed(2)}] (${this.m_maxProfile.pairs.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `collide [ave] (max) = ${profile.collide.toFixed(2)} [${this.m_aveProfile.collide.toFixed(2)}] (${this.m_maxProfile.collide.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `solve [ave] (max) = ${profile.solve.toFixed(2)} [${this.m_aveProfile.solve.toFixed(2)}] (${this.m_maxProfile.solve.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `prepare tasks [ave] (max) = ${profile.prepareStages.toFixed(2)} [${this.m_aveProfile.prepareStages.toFixed(2)}] (${this.m_maxProfile.prepareStages.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `solve constraints [ave] (max) = ${profile.solveConstraints.toFixed(2)} [${this.m_aveProfile.solveConstraints.toFixed(2)}] (${this.m_maxProfile.solveConstraints.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `prepare constraints [ave] (max) = ${profile.prepareConstraints.toFixed(2)} [${this.m_aveProfile.prepareConstraints.toFixed(2)}] (${this.m_maxProfile.prepareConstraints.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `integrate velocities [ave] (max) = ${profile.integrateVelocities.toFixed(2)} [${this.m_aveProfile.integrateVelocities.toFixed(2)}] (${this.m_maxProfile.integrateVelocities.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `warm start [ave] (max) = ${profile.warmStart.toFixed(2)} [${this.m_aveProfile.warmStart.toFixed(2)}] (${this.m_maxProfile.warmStart.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `solve impulses [ave] (max) = ${profile.solveImpulses.toFixed(2)} [${this.m_aveProfile.solveImpulses.toFixed(2)}] (${this.m_maxProfile.solveImpulses.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `integrate positions [ave] (max) = ${profile.integratePositions.toFixed(2)} [${this.m_aveProfile.integratePositions.toFixed(2)}] (${this.m_maxProfile.integratePositions.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `relax impulses [ave] (max) = ${profile.relaxImpulses.toFixed(2)} [${this.m_aveProfile.relaxImpulses.toFixed(2)}] (${this.m_maxProfile.relaxImpulses.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `apply restitution [ave] (max) = ${profile.applyRestitution.toFixed(2)} [${this.m_aveProfile.applyRestitution.toFixed(2)}] (${this.m_maxProfile.applyRestitution.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `store impulses [ave] (max) = ${profile.storeImpulses.toFixed(2)} [${this.m_aveProfile.storeImpulses.toFixed(2)}] (${this.m_maxProfile.storeImpulses.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `split islands [ave] (max) = ${profile.splitIslands.toFixed(2)} [${this.m_aveProfile.splitIslands.toFixed(2)}] (${this.m_maxProfile.splitIslands.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `update transforms [ave] (max) = ${profile.transforms.toFixed(2)} [${this.m_aveProfile.transforms.toFixed(2)}] (${this.m_maxProfile.transforms.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `joint events [ave] (max) = ${profile.jointEvents.toFixed(2)} [${this.m_aveProfile.jointEvents.toFixed(2)}] (${this.m_maxProfile.jointEvents.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `hit events [ave] (max) = ${profile.hitEvents.toFixed(2)} [${this.m_aveProfile.hitEvents.toFixed(2)}] (${this.m_maxProfile.hitEvents.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `refit BVH [ave] (max) = ${profile.refit.toFixed(2)} [${this.m_aveProfile.refit.toFixed(2)}] (${this.m_maxProfile.refit.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `sleep islands [ave] (max) = ${profile.sleepIslands.toFixed(2)} [${this.m_aveProfile.sleepIslands.toFixed(2)}] (${this.m_maxProfile.sleepIslands.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `bullets [ave] (max) = ${profile.bullets.toFixed(2)} [${this.m_aveProfile.bullets.toFixed(2)}] (${this.m_maxProfile.bullets.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `sensors [ave] (max) = ${profile.sensors.toFixed(2)} [${this.m_aveProfile.sensors.toFixed(2)}] (${this.m_maxProfile.sensors.toFixed(2)})`);
		}
		profile.delete();
		return m_textLine;
	}

	Spawn(){}
	Despawn(){}
	CreateUI(){}
	UpdateUI(DrawString, m_textLine){
		m_textLine = this.HandleProfile(DrawString, m_textLine);
		return m_textLine;
	}
	Destroy(){
		const {
			b2DestroyWorld
		} = this.box2d;
		b2DestroyWorld(this.m_worldId);

		this.m_taskSystem?.ClearTasks();
		this.m_taskSystem?.delete();

		this.m_mousePoint.delete();
	}
}

const profileInterface = {
	step: 0,
	pairs: 0,
	collide: 0,
	solve: 0,
	prepareStages: 0,
	solveConstraints: 0,
	prepareConstraints: 0,
	integrateVelocities: 0,
	warmStart: 0,
	solveImpulses: 0,
	integratePositions: 0,
	relaxImpulses: 0,
	applyRestitution: 0,
	storeImpulses: 0,
	splitIslands: 0,
	transforms: 0,
	sensorHits: 0,
	jointEvents: 0,
	hitEvents: 0,
	refit: 0,
	bullets: 0,
	sleepIslands: 0,
	sensors: 0,
};
