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
	singleStep: false,
	enableWarmStarting: true,
	enableContinuous: true,
	profile: false,
	debugWASMMemory: true,
	subStepCount: 4,
	maxDebugDrawCommands: 60000 /* 135 bytes * 60000 = 8,100,000 bytes - 7.91 MB */,

}

export default {
	...DEFAULT_SETTINGS,
}
