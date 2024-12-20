import Box2DDebugDraw from '../utils/debugDraw.js';

const settings = {
	workerCount: 1,
	enableSleep: true,
	// draw options
	drawShapes: true,
	drawJoints: false,
	drawJointExtras: false,
	drawAABBs: false,
	drawMass: false,
	drawContactPoints: false,
	drawGraphColors: false,
	drawContactNormals: false,
	drawContactImpulses: false,
	drawFrictionImpulses: false,
	// simulation options
	hertz: 60,
	enableWarmStarting: true,
	enableContinuous: true,
	subStepCount: 4,
}

const camera = {
	offset: { x: 11, y: -12 },
	ptm: 32,
};

export default class Sample{
	constructor(box2d, canvas){
		this.box2d = box2d;
		this.canvas = canvas;
		const {b2DefaultWorldDef, b2CreateWorld} = box2d;

		this.worldDef = b2DefaultWorldDef();
		// this.worldDef.workerCount = settings.workerCount;
		// this.worldDef.enqueueTask = EnqueueTask;
		// this.worldDef.finishTask = FinishTask;
		// this.worldDef.userTaskContext = this;
		this.worldDef.enableSleep = settings.enableSleep;

		this.m_worldId = b2CreateWorld(this.worldDef);

		this.debugDraw = new Box2DDebugDraw(this.canvas, box2d, camera.ptm);
	}

	Step(){
		const timeStep = settings.hertz > 0.0 ? 1.0 / settings.hertz : 0.0;


		g_draw.m_debugDraw.drawingBounds = g_camera.GetViewBounds();
		g_draw.m_debugDraw.useDrawingBounds = settings.useCameraBounds;

		g_draw.m_debugDraw.drawShapes = settings.drawShapes;
		g_draw.m_debugDraw.drawJoints = settings.drawJoints;
		g_draw.m_debugDraw.drawJointExtras = settings.drawJointExtras;
		g_draw.m_debugDraw.drawAABBs = settings.drawAABBs;
		g_draw.m_debugDraw.drawMass = settings.drawMass;
		g_draw.m_debugDraw.drawContacts = settings.drawContactPoints;
		g_draw.m_debugDraw.drawGraphColors = settings.drawGraphColors;
		g_draw.m_debugDraw.drawContactNormals = settings.drawContactNormals;
		g_draw.m_debugDraw.drawContactImpulses = settings.drawContactImpulses;
		g_draw.m_debugDraw.drawFrictionImpulses = settings.drawFrictionImpulses;

		b2World_EnableSleeping( m_worldId, settings.enableSleep );
		b2World_EnableWarmStarting( m_worldId, settings.enableWarmStarting );
		b2World_EnableContinuous( m_worldId, settings.enableContinuous );

		for ( let i = 0; i < 1; ++i )
		{
			b2World_Step( m_worldId, timeStep, settings.subStepCount );
			m_taskCount = 0;
		}

		this.debugDraw.drawWorldId(this.m_worldId);
	}

	UpdateUI(){

	}

	Destroy(){

	}
}
