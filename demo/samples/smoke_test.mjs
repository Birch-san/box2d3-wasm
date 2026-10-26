// Headless smoke test for the samples. Loads every sample from list.mjs (or the ones matching a
// filter), steps it for a while with a fake canvas, pokes it with the mouse, then destroys it.
// Each sample runs in its own Node process, so a Box2D assert in one sample can't hide the others.
//
// usage, from demo/samples:
//   node smoke_test.mjs                 # all samples, 4 workers (like the browser testbed)
//   node smoke_test.mjs restitution     # samples whose path contains "restitution"
//   node smoke_test.mjs --workers=1 --steps=600 mover
import { spawnSync } from 'child_process';
import * as moduleApi from 'module';
import { cpus } from 'os';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const arg = args.find((a) => a.startsWith(`--${name}=`));
	return arg ? arg.slice(name.length + 3) : fallback;
};
const filters = args.filter((a) => !a.startsWith('--'));
const workers = Number(option('workers', 4));
const steps = Number(option('steps', 240));
const single = option('one', null);

// A stand-in for anything browser-ish (tweakpane, canvas context, DOM): every property, call and
// construction returns the same stub, so UI code runs without doing anything.
const stubSource = `
const handler = {
	get: (target, key) => key === 'then' ? undefined : (key === Symbol.toPrimitive ? () => 0 : stub),
	set: () => true,
	apply: () => stub,
	construct: () => stub,
};
export const stub = new Proxy(function(){}, handler);
export const Pane = stub;
export default stub;
`;

if (single === null) {
	const { default: samples } = await import('./categories/list.mjs');
	const entries = Object.entries(samples).flatMap(([category, list]) =>
		Object.entries(list).map(([name, url]) => ({ category, name, url })));
	const selected = entries.filter(({ url, name, category }) =>
		filters.length === 0 || filters.some((f) => `${category}/${name}/${url}`.toLowerCase().includes(f.toLowerCase())));

	let failures = 0;
	for (const { category, name, url } of selected) {
		const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--one=${url}`, `--workers=${workers}`, `--steps=${steps}`], {
			encoding: 'utf8',
			timeout: 300000, // Create Destroy needs about two minutes
		});
		const output = `${result.stdout}${result.stderr}`.trim();
		const ok = result.status === 0 && output.includes('SMOKE_OK');
		if (!ok) failures++;
		// Box2D reports invalid input and assertions before trapping, so show those lines first
		const lines = output.split('\n').filter((l) => l.trim() && !/DeprecationWarning|--trace-deprecation|^Node\.js/.test(l));
		const important = lines.filter((l) => /BOX2D ASSERTION|Box2D:|Error/.test(l));
		const detail = ok ? output.match(/SMOKE_OK (.*)/)[1] : [...new Set([...important, ...lines.filter((l) => /^\s+at /.test(l)).slice(0, 4)])].join('\n    ');
		console.log(`${ok ? 'ok  ' : 'FAIL'} ${category} / ${name}${ok ? `  (${detail})` : `\n    ${detail || `exit ${result.status} ${result.signal ?? ''}`}`}`);
	}
	console.log(`\n${selected.length - failures}/${selected.length} samples passed`);
	process.exit(failures === 0 ? 0 : 1);
}

// ---- child process: run a single sample ----

// Samples import tweakpane from a CDN; serve the stub instead.
const stubUrl = `data:text/javascript,${encodeURIComponent(stubSource)}`;
if (moduleApi.registerHooks) {
	moduleApi.registerHooks({
		resolve: (specifier, context, next) => specifier.startsWith('https://') ? { url: stubUrl, shortCircuit: true } : next(specifier, context),
	});
} else {
	moduleApi.register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
	if (specifier.startsWith('https://')) {
		return { url: ${JSON.stringify(stubUrl)}, shortCircuit: true };
	}
	return next(specifier, context);
}
`)}`, import.meta.url);
}

const { stub } = await import(stubUrl);
globalThis.navigator ??= {};
globalThis.navigator.hardwareConcurrency ??= cpus().length;
// own properties first, then fall back to the stub for everything else
globalThis.window = Object.setPrototypeOf({
	devicePixelRatio: 1,
	// entry.mjs only picks the threaded (deluxe) build in a cross-origin isolated window
	crossOriginIsolated: true,
	innerWidth: 1280,
	innerHeight: 800,
	addEventListener() {},
	removeEventListener() {},
}, stub);
globalThis.document = stub;
globalThis.requestAnimationFrame = () => 0;

const { default: SampleClass } = await import(new URL(single, import.meta.url).href);
// samples declare `static precision = 'double'` to run on the large world build
const entry = SampleClass.precision === 'double' ? 'entry-double.mjs' : 'entry.mjs';
const { default: Box2DFactory } = await import(`../../box2d3-wasm/build/dist/es/${entry}`);
const { default: Camera } = await import('../utils/camera.mjs');
const { default: DebugDrawRenderer } = await import('../utils/debugDraw.mjs');
const { default: settings, DEFAULT_SETTINGS } = await import('./settings.mjs');

const box2d = await Box2DFactory({ pthreadCount: Math.max(workers, 1) });
Object.assign(settings, DEFAULT_SETTINGS, { workerCount: workers, debugWASMMemory: false });

const ctx = Object.setPrototypeOf({ canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800, style: {} } }, stub);
const camera = new Camera({ autoResize: false, controls: false, canvas: null });
const debugDraw = new DebugDrawRenderer(box2d, ctx, { maxDebugDrawCommands: settings.maxDebugDrawCommands });
debugDraw.SetFlags({ drawShapes: true, drawJoints: true, drawJointExtras: true, drawBounds: true, drawMass: true, drawContacts: true, drawContactNormals: true, drawContactForces: true, drawFrictionForces: true });

const sample = new SampleClass(box2d, camera, debugDraw);
const drawString = (x, y) => y + 16;

for (let i = 0; i < steps; ++i) {
	if (i === Math.floor(steps / 3)) {
		const p = new box2d.b2Pos(camera.center.x, camera.center.y);
		sample.MouseDown(p);
		p.delete();
	}
	if (i > steps / 3 && i < steps / 2) {
		const p = new box2d.b2Pos(camera.center.x + 0.01 * (i - steps / 3), camera.center.y);
		sample.MouseMove(p);
		p.delete();
	}
	if (i === Math.floor(steps / 2)) {
		sample.MouseUp();
	}
	sample.Step();
	sample.UpdateUI(drawString, 0);
}

const counters = box2d.b2World_GetCounters(sample.m_worldId);
const summary = `${counters.bodyCount} bodies, ${counters.jointCount} joints, ${counters.contactCount} contacts`;
counters.delete();
sample.Destroy();
console.log(`SMOKE_OK ${summary}`);
process.exit(0);
