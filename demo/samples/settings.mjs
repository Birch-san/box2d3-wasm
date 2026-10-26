export const DEFAULT_SETTINGS = {
	workerCount: 1,
	enableSleep: true,
	// these names match the b2DebugDraw flags
	drawShapes: true,
	drawJoints: true,
	drawJointExtras: false,
	drawBounds: false,
	drawMass: false,
	drawBodyNames: false,
	drawContacts: false,
	drawGraphColors: false,
	drawContactFeatures: false,
	drawContactNormals: false,
	drawContactForces: false,
	drawFrictionForces: false,
	drawIslands: false,
	maxFrameTime: 1000 / 60,
	hertz: 60,
	pause: false,
	singleStep: false,
	enableWarmStarting: true,
	enableContinuous: true,
	enableRestitutionPropagation: false,
	restitutionIterations: 2,
	recycleDistance: 0.05,
	profile: false,
	debugWASMMemory: true,
	subStepCount: 4,
	maxDebugDrawCommands: 60000 /* 135 bytes * 60000 = 8,100,000 bytes - 7.91 MB */,

}

export default {
	...DEFAULT_SETTINGS,
}
