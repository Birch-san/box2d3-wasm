export const DEFAULT_SETTINGS = {
	workerCount: 1,
	enableSleep: true,
	drawShapes: true,
	drawJoints: false,
	drawJointExtras: false,
	drawAABBs: false,
	drawMass: false,
	drawContacts: false,
	drawGraphColors: false,
	drawContactNormals: false,
	drawContactImpulses: false,
	drawFrictionImpulses: false,
	maxFrameTime: 1000 / 60,
	hertz: 60,
	pause: false,
	enableWarmStarting: true,
	enableContinuous: true,
	subStepCount: 4,
}

export default {
	...DEFAULT_SETTINGS,
}
