import settings from './settings.mjs';

export default class Sample{
	constructor(box2d, camera, debugDraw){
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

		this.m_totalProfile = {...profileInterface};
		this.m_maxProfile = {...profileInterface};
		this.m_aveProfile = {...profileInterface};

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
		b2World_OverlapAABB( this.m_worldId, box, b2DefaultQueryFilter(), (shapeId) => this.QueryCallback(shapeId, queryContext));

		if(queryContext.bodyId){
			const bodyDef = b2DefaultBodyDef();
			this.m_groundBodyId = b2CreateBody( this.m_worldId, bodyDef );

			const mouseDef = b2DefaultMouseJointDef();
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

		box.delete();
		d.delete();
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


	toMB = (bytes) => (bytes / 1048576).toFixed(4);

	HandleProfile(DrawString, m_textLine){
		const {
			b2World_GetProfile
		} = this.box2d;
		const profile = b2World_GetProfile( this.m_worldId );

		this.m_totalProfile.step += profile.step;
		this.m_totalProfile.pairs += profile.pairs;
		this.m_totalProfile.collide += profile.collide;
		this.m_totalProfile.solve += profile.solve;
		this.m_totalProfile.buildIslands += profile.buildIslands;
		this.m_totalProfile.solveConstraints += profile.solveConstraints;
		this.m_totalProfile.prepareTasks += profile.prepareTasks;
		this.m_totalProfile.solverTasks += profile.solverTasks;
		this.m_totalProfile.prepareConstraints += profile.prepareConstraints;
		this.m_totalProfile.integrateVelocities += profile.integrateVelocities;
		this.m_totalProfile.warmStart += profile.warmStart;
		this.m_totalProfile.solveVelocities += profile.solveVelocities;
		this.m_totalProfile.integratePositions += profile.integratePositions;
		this.m_totalProfile.relaxVelocities += profile.relaxVelocities;
		this.m_totalProfile.applyRestitution += profile.applyRestitution;
		this.m_totalProfile.storeImpulses += profile.storeImpulses;
		this.m_totalProfile.finalizeBodies += profile.finalizeBodies;
		this.m_totalProfile.sleepIslands += profile.sleepIslands;
		this.m_totalProfile.splitIslands += profile.splitIslands;
		this.m_totalProfile.hitEvents += profile.hitEvents;
		this.m_totalProfile.broadphase += profile.broadphase;
		this.m_totalProfile.continuous += profile.continuous;

		this.m_maxProfile.step = Math.max(this.m_maxProfile.step, profile.step);
		this.m_maxProfile.pairs = Math.max(this.m_maxProfile.pairs, profile.pairs);
		this.m_maxProfile.collide = Math.max(this.m_maxProfile.collide, profile.collide);
		this.m_maxProfile.solve = Math.max(this.m_maxProfile.solve, profile.solve);
		this.m_maxProfile.buildIslands = Math.max(this.m_maxProfile.buildIslands, profile.buildIslands);
		this.m_maxProfile.solveConstraints = Math.max(this.m_maxProfile.solveConstraints, profile.solveConstraints);
		this.m_maxProfile.prepareTasks = Math.max(this.m_maxProfile.prepareTasks, profile.prepareTasks);
		this.m_maxProfile.solverTasks = Math.max(this.m_maxProfile.solverTasks, profile.solverTasks);
		this.m_maxProfile.prepareConstraints = Math.max(this.m_maxProfile.prepareConstraints, profile.prepareConstraints);
		this.m_maxProfile.integrateVelocities = Math.max(this.m_maxProfile.integrateVelocities, profile.integrateVelocities);
		this.m_maxProfile.warmStart = Math.max(this.m_maxProfile.warmStart, profile.warmStart);
		this.m_maxProfile.solveVelocities = Math.max(this.m_maxProfile.solveVelocities, profile.solveVelocities);
		this.m_maxProfile.integratePositions = Math.max(this.m_maxProfile.integratePositions, profile.integratePositions);
		this.m_maxProfile.relaxVelocities = Math.max(this.m_maxProfile.relaxVelocities, profile.relaxVelocities);
		this.m_maxProfile.applyRestitution = Math.max(this.m_maxProfile.applyRestitution, profile.applyRestitution);
		this.m_maxProfile.storeImpulses = Math.max(this.m_maxProfile.storeImpulses, profile.storeImpulses);
		this.m_maxProfile.finalizeBodies = Math.max(this.m_maxProfile.finalizeBodies, profile.finalizeBodies);
		this.m_maxProfile.sleepIslands = Math.max(this.m_maxProfile.sleepIslands, profile.sleepIslands);
		this.m_maxProfile.splitIslands = Math.max(this.m_maxProfile.splitIslands, profile.splitIslands);
		this.m_maxProfile.hitEvents = Math.max(this.m_maxProfile.hitEvents, profile.hitEvents);
		this.m_maxProfile.broadphase = Math.max(this.m_maxProfile.broadphase, profile.broadphase);
		this.m_maxProfile.continuous = Math.max(this.m_maxProfile.continuous, profile.continuous);

		if(settings.profile){
			this.m_aveProfile.step = this.m_totalProfile.step / this.m_stepCount;
			this.m_aveProfile.pairs = this.m_totalProfile.pairs / this.m_stepCount;
			this.m_aveProfile.collide = this.m_totalProfile.collide / this.m_stepCount;
			this.m_aveProfile.solve = this.m_totalProfile.solve / this.m_stepCount;
			this.m_aveProfile.buildIslands = this.m_totalProfile.buildIslands / this.m_stepCount;
			this.m_aveProfile.solveConstraints = this.m_totalProfile.solveConstraints / this.m_stepCount;
			this.m_aveProfile.prepareTasks = this.m_totalProfile.prepareTasks / this.m_stepCount;
			this.m_aveProfile.solverTasks = this.m_totalProfile.solverTasks / this.m_stepCount;
			this.m_aveProfile.prepareConstraints = this.m_totalProfile.prepareConstraints / this.m_stepCount;
			this.m_aveProfile.integrateVelocities = this.m_totalProfile.integrateVelocities / this.m_stepCount;
			this.m_aveProfile.warmStart = this.m_totalProfile.warmStart / this.m_stepCount;
			this.m_aveProfile.solveVelocities = this.m_totalProfile.solveVelocities / this.m_stepCount;
			this.m_aveProfile.integratePositions = this.m_totalProfile.integratePositions / this.m_stepCount;
			this.m_aveProfile.relaxVelocities = this.m_totalProfile.relaxVelocities / this.m_stepCount;
			this.m_aveProfile.applyRestitution = this.m_totalProfile.applyRestitution / this.m_stepCount;
			this.m_aveProfile.storeImpulses = this.m_totalProfile.storeImpulses / this.m_stepCount;
			this.m_aveProfile.finalizeBodies = this.m_totalProfile.finalizeBodies / this.m_stepCount;
			this.m_aveProfile.sleepIslands = this.m_totalProfile.sleepIslands / this.m_stepCount;
			this.m_aveProfile.splitIslands = this.m_totalProfile.splitIslands / this.m_stepCount;
			this.m_aveProfile.hitEvents = this.m_totalProfile.hitEvents / this.m_stepCount;
			this.m_aveProfile.broadphase = this.m_totalProfile.broadphase / this.m_stepCount;
			this.m_aveProfile.continuous = this.m_totalProfile.continuous / this.m_stepCount;

			m_textLine = DrawString(5, m_textLine, `WASM Memory in MB {allocated} [free] (total): {${this.toMB(this.box2d.mallinfo_get_allocated_space())}} [${this.toMB(this.box2d.mallinfo_get_free_space())}] (${this.toMB(this.box2d.mallinfo_get_total_space())})`);
			m_textLine = DrawString(5, m_textLine, `step [ave] (max) = ${profile.step.toFixed(2)} [${this.m_aveProfile.step.toFixed(2)}] (${this.m_maxProfile.step.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `pairs [ave] (max) = ${profile.pairs.toFixed(2)} [${this.m_aveProfile.pairs.toFixed(2)}] (${this.m_maxProfile.pairs.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `collide [ave] (max) = ${profile.collide.toFixed(2)} [${this.m_aveProfile.collide.toFixed(2)}] (${this.m_maxProfile.collide.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `solve [ave] (max) = ${profile.solve.toFixed(2)} [${this.m_aveProfile.solve.toFixed(2)}] (${this.m_maxProfile.solve.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `build islands [ave] (max) = ${profile.buildIslands.toFixed(2)} [${this.m_aveProfile.buildIslands.toFixed(2)}] (${this.m_maxProfile.buildIslands.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `solve constraints [ave] (max) = ${profile.solveConstraints.toFixed(2)} [${this.m_aveProfile.solveConstraints.toFixed(2)}] (${this.m_maxProfile.solveConstraints.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `prepare tasks [ave] (max) = ${profile.prepareTasks.toFixed(2)} [${this.m_aveProfile.prepareTasks.toFixed(2)}] (${this.m_maxProfile.prepareTasks.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `solver tasks [ave] (max) = ${profile.solverTasks.toFixed(2)} [${this.m_aveProfile.solverTasks.toFixed(2)}] (${this.m_maxProfile.solverTasks.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `prepare constraints [ave] (max) = ${profile.prepareConstraints.toFixed(2)} [${this.m_aveProfile.prepareConstraints.toFixed(2)}] (${this.m_maxProfile.prepareConstraints.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `integrate velocities [ave] (max) = ${profile.integrateVelocities.toFixed(2)} [${this.m_aveProfile.integrateVelocities.toFixed(2)}] (${this.m_maxProfile.integrateVelocities.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `warm start [ave] (max) = ${profile.warmStart.toFixed(2)} [${this.m_aveProfile.warmStart.toFixed(2)}] (${this.m_maxProfile.warmStart.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `solve velocities [ave] (max) = ${profile.solveVelocities.toFixed(2)} [${this.m_aveProfile.solveVelocities.toFixed(2)}] (${this.m_maxProfile.solveVelocities.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `integrate positions [ave] (max) = ${profile.integratePositions.toFixed(2)} [${this.m_aveProfile.integratePositions.toFixed(2)}] (${this.m_maxProfile.integratePositions.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `relax velocities [ave] (max) = ${profile.relaxVelocities.toFixed(2)} [${this.m_aveProfile.relaxVelocities.toFixed(2)}] (${this.m_maxProfile.relaxVelocities.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `apply restitution [ave] (max) = ${profile.applyRestitution.toFixed(2)} [${this.m_aveProfile.applyRestitution.toFixed(2)}] (${this.m_maxProfile.applyRestitution.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `store impulses [ave] (max) = ${profile.storeImpulses.toFixed(2)} [${this.m_aveProfile.storeImpulses.toFixed(2)}] (${this.m_maxProfile.storeImpulses.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `finalize bodies [ave] (max) = ${profile.finalizeBodies.toFixed(2)} [${this.m_aveProfile.finalizeBodies.toFixed(2)}] (${this.m_maxProfile.finalizeBodies.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `sleep islands [ave] (max) = ${profile.sleepIslands.toFixed(2)} [${this.m_aveProfile.sleepIslands.toFixed(2)}] (${this.m_maxProfile.sleepIslands.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `split islands [ave] (max) = ${profile.splitIslands.toFixed(2)} [${this.m_aveProfile.splitIslands.toFixed(2)}] (${this.m_maxProfile.splitIslands.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `hit events [ave] (max) = ${profile.hitEvents.toFixed(2)} [${this.m_aveProfile.hitEvents.toFixed(2)}] (${this.m_maxProfile.hitEvents.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `broad-phase [ave] (max) = ${profile.broadphase.toFixed(2)} [${this.m_aveProfile.broadphase.toFixed(2)}] (${this.m_maxProfile.broadphase.toFixed(2)})`);
			m_textLine = DrawString(5, m_textLine, `continuous collision [ave] (max) = ${profile.continuous.toFixed(2)} [${this.m_aveProfile.continuous.toFixed(2)}] (${this.m_maxProfile.continuous.toFixed(2)})`);
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
	Destroy(){}
}

const profileInterface = {
	step: 0,
	pairs: 0,
	collide: 0,
	solve: 0,
	buildIslands: 0,
	solveConstraints: 0,
	prepareTasks: 0,
	solverTasks: 0,
	prepareConstraints: 0,
	integrateVelocities: 0,
	warmStart: 0,
	solveVelocities: 0,
	integratePositions: 0,
	relaxVelocities: 0,
	applyRestitution: 0,
	storeImpulses: 0,
	finalizeBodies: 0,
	sleepIslands: 0,
	splitIslands: 0,
	hitEvents: 0,
	broadphase: 0,
	continuous: 0,
};
