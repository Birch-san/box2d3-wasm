export const DEFAULT_SETTINGS = {
	workerCount: 1,
	enableSleep: true,
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
	hertz: 60,
	enableWarmStarting: true,
	enableContinuous: true,
	subStepCount: 4,
}


export default {
	...DEFAULT_SETTINGS,
}
