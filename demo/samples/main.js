
import Box2DFactory from '/box2d3-wasm/build/dist/es/entry.mjs';

let box2d = null;

const canvas = document.getElementById("demo-canvas");

function loadSample(sample) {
	import(sample).then((module) => {
		const sample = new module.default(box2d, canvas);
		console.log(sample);
	});
}


async function initialize(){
	box2d = await Box2DFactory();

	loadSample('./events/SensorFunnel.js');
}

initialize();
