// Helpers shared by the character samples. This file lives in a sub folder so the sample list
// generator (categories/node_generate.mjs) does not pick it up as a sample.

import b2HexColor from '../../../b2HexColor.mjs';

const B2_LINEAR_SLOP = 0.005;
const FLT_MIN = 1.1754943508222875e-38;

export const FLT_MAX = 3.4028234663852886e38;

// From sample_character.cpp
export const CollisionBits = {
	StaticBit: 0x0001,
	MoverBit: 0x0002,
	DynamicBit: 0x0004,

	AllBits: 0xFFFFFFFF, // c: ~0u
};

// b2GetLengthAndNormalize in plain JS. Only a vanishing vector normalizes to zero.
export function GetLengthAndNormalize(x, y) {
	const lengthSquared = x * x + y * y;
	if (lengthSquared <= 1000.0 * FLT_MIN) {
		return { length: 0.0, normal: { x: 0.0, y: 0.0 } };
	}

	const length = Math.sqrt(lengthSquared);
	return { length, normal: { x: x / length, y: y / length } };
}

// jointDef.base.localFrameA.p = b2Body_GetLocalPoint( jointDef.base.bodyIdA, pivot ), same for B
export function SetLocalAnchors(box2d, jointDef, pivot) {
	const { b2Body_GetLocalPoint } = box2d;

	let lp = b2Body_GetLocalPoint(jointDef.base.bodyIdA, pivot);
	jointDef.base.localFrameA.p.Copy(lp);
	lp.delete();

	lp = b2Body_GetLocalPoint(jointDef.base.bodyIdB, pivot);
	jointDef.base.localFrameB.p.Copy(lp);
	lp.delete();
}

// The ground probe is a point, a circle, or a segment, all carried by the proxy.
// Call between debugDraw.prepareCanvas() and debugDraw.restoreCanvas().
export function DrawPogo(debugDraw, origin, translation, fraction, hit) {
	const color = hit ? b2HexColor.b2_colorPlum : b2HexColor.b2_colorGray;
	const end = { x: origin.x + fraction * translation.x, y: origin.y + fraction * translation.y };

	debugDraw.drawLine({ data: [origin.x, origin.y, end.x, end.y], color: b2HexColor.b2_colorGray });
	debugDraw.drawPoint({ data: [end.x, end.y, 10.0], color });
}

// Port of Sample::ParsePath from box2d/samples/sample.cpp.
// Parses a simple SVG path (M, L, H, V, m, l, h, v commands) into chain points.
// The y-axis is flipped because SVG is y-down. Returns an array of {x, y}.
export function ParsePath(svgPath, offset = { x: 0, y: 0 }, scale = 1, reverseOrder = false, capacity = 64) {
	const points = [];
	const currentPoint = { x: 0, y: 0 };

	// note: a command can be implicitly repeated
	let command = 'M';

	for (const token of svgPath.trim().split(/\s+/)) {
		if (/^[a-zA-Z]$/.test(token)) {
			command = token;
			if (command === 'z' || command === 'Z') {
				break;
			}
			continue;
		}

		const [a, b] = token.split(',').map(Number);

		switch (command) {
			case 'M':
			case 'L':
				currentPoint.x = a;
				currentPoint.y = b;
				break;
			case 'H':
				currentPoint.x = a;
				break;
			case 'V':
				currentPoint.y = a;
				break;
			case 'm':
			case 'l':
				currentPoint.x += a;
				currentPoint.y += b;
				break;
			case 'h':
				currentPoint.x += a;
				break;
			case 'v':
				currentPoint.y += a;
				break;
			default:
				console.assert(false, `ParsePath: unsupported command ${command}`);
				continue;
		}

		points.push({
			x: scale * (currentPoint.x + offset.x),
			y: -scale * (currentPoint.y + offset.y),
		});

		if (points.length === capacity) {
			break;
		}
	}

	if (reverseOrder) {
		points.reverse();
	}

	// Remove the loop point for chain shapes.
	const count = points.length;
	if (count > 2 && Math.hypot(points[0].x - points[count - 1].x, points[0].y - points[count - 1].y) <= B2_LINEAR_SLOP) {
		points.pop();
	}

	return points;
}
