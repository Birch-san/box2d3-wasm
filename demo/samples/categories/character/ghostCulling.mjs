import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import b2HexColor from '../../b2HexColor.mjs';

import settings from '../../settings.mjs';


// Draws a short string at a world position (the debug draw string command holds at most 30 characters)
function DrawWorldString(debugDraw, x, y, text) {
	const data = [x, y];
	for (let i = 0; i < text.length && i < 29; ++i) {
		data.push(text.charCodeAt(i));
	}
	data.push(0);
	debugDraw.drawString({ data, color: b2HexColor.b2_colorWhite });
}

// This shows how to mitigate ghost collisions using the presolve callback.
// Based on: https://briansemrau.github.io/dealing-with-ghost-collisions/
export default class GhostCulling extends Sample {
	static m_floorMaterial = 42n;

	constructor(box2d, camera, debugDraw) {
		if (settings.workerCount > 1) {
			// The pre-solve callback runs in JavaScript, which worker threads cannot call.
			console.warn("PreSolve is not compatible with multiple workers");
			settings.workerCount = 1;
		}

		super(box2d, camera, debugDraw);

		camera.center = { x: 0.0, y: 1.5 };
		camera.zoom = 12.0;

		const {
			b2Vec2,
			b2Rot_identity,
			b2GetLengthUnitsPerMeter,
			b2DefaultBodyDef,
			b2CreateBody,
			b2DefaultShapeDef,
			b2MakeOffsetBox,
			b2CreatePolygonShape,
			b2World_SetPreSolveCallback,
		} = this.box2d;

		const groundBodyDef = b2DefaultBodyDef();
		const groundId = b2CreateBody(this.m_worldId, groundBodyDef);
		groundBodyDef.delete();

		const center = new b2Vec2();

		const surfaceHeights = [3.0, 0.0];
		for (const surfaceHeight of surfaceHeights) {
			for (let i = 0; i < 10; ++i) {
				const x = -9.0 + 2.0 * i;
				const tile = b2MakeOffsetBox(1.0, 0.25, center.Set(x, surfaceHeight - 0.25), b2Rot_identity);

				const shapeDef = b2DefaultShapeDef();
				shapeDef.material.friction = 0.0;

				// Flag the horizontal tiles with a special material.
				shapeDef.material.userMaterialId = GhostCulling.m_floorMaterial;

				shapeDef.material.customColor = i % 2 == 0 ? b2HexColor.b2_colorGray : b2HexColor.b2_colorDarkGray;

				b2CreatePolygonShape(groundId, shapeDef, tile);

				tile.delete();
				shapeDef.delete();
			}

			const wall = b2MakeOffsetBox(0.25, 1.25, center.Set(10.25, surfaceHeight + 1.25), b2Rot_identity);
			const shapeDef = b2DefaultShapeDef();
			shapeDef.material.friction = 0.0;
			shapeDef.material.customColor = b2HexColor.b2_colorDarkGray;
			b2CreatePolygonShape(groundId, shapeDef, wall);

			wall.delete();
			shapeDef.delete();
		}

		center.delete();

		// B2_LINEAR_SLOP is not exported by the bindings
		this.m_linearSlop = 0.005 * b2GetLengthUnitsPerMeter();

		this.m_speed = 20.0;
		this.m_playerIds = [null, null];
		this.m_playerVelocities = [0.0, 0.0];
		this.m_rejectedCount = 0;

		this.m_preSolveCallback = b2World_SetPreSolveCallback(this.m_worldId, this.PreSolve, this.PreContinuous);
		this.Launch();

		this.CreateUI();
	}

	Launch() {
		const {
			b2DefaultBodyDef,
			b2CreateBody,
			b2DestroyBody,
			b2BodyType,
			b2DefaultShapeDef,
			b2MakeBox,
			b2CreatePolygonShape,
		} = this.box2d;

		this.m_rejectedCount = 0;

		const surfaceHeights = [3.0, 0.0];
		for (let i = 0; i < 2; ++i) {
			if (this.m_playerIds[i] !== null) {
				b2DestroyBody(this.m_playerIds[i]);
			}

			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Set(-9.0, surfaceHeights[i] + 0.5);
			bodyDef.linearVelocity.Set(this.m_speed, 0.0);
			bodyDef.motionLocks.angularZ = true;

			// Pre-solve must see a fresh manifold at every tile boundary.
			bodyDef.enableContactRecycling = false;

			this.m_playerIds[i] = b2CreateBody(this.m_worldId, bodyDef);

			const shapeDef = b2DefaultShapeDef();
			shapeDef.density = 1.0;
			shapeDef.material.friction = 0.0;
			shapeDef.enablePreSolveEvents = i == 1;

			const player = b2MakeBox(0.5, 0.5);
			b2CreatePolygonShape(this.m_playerIds[i], shapeDef, player);

			bodyDef.delete();
			shapeDef.delete();
			player.delete();
		}
	}

	// The manifold is the live b2Manifold, edit it in place and never delete it.
	PreSolve = (shapeIdA, shapeIdB, manifold) => {
		const {
			b2Shape_GetBody,
			b2Body_GetLinearVelocity,
			B2_ID_EQUALS,
		} = this.box2d;

		if (manifold.pointCount != 2) {
			return;
		}

		const n = manifold.normal;
		const normal = { x: n.x, y: n.y };
		const bodyIdA = b2Shape_GetBody(shapeIdA);
		if (B2_ID_EQUALS(bodyIdA, this.m_playerIds[1]) == false) {
			const bodyIdB = b2Shape_GetBody(shapeIdB);
			if (B2_ID_EQUALS(bodyIdB, this.m_playerIds[1]) == false) {
				return;
			}

			normal.x = -normal.x;
			normal.y = -normal.y;
		}

		const velocity = b2Body_GetLinearVelocity(this.m_playerIds[1]);
		const dot = normal.x * velocity.x + normal.y * velocity.y;
		velocity.delete();

		if (dot < 0.0) {
			return;
		}

		// A short face contact is overlap slop at a tile seam, not a wall.
		const point0 = manifold.GetPoint(0);
		const point1 = manifold.GetPoint(1);
		const contactArea = Math.hypot(point0.anchorA.x - point1.anchorA.x, point0.anchorA.y - point1.anchorA.y);
		point0.delete();
		point1.delete();

		if (contactArea < 4.0 * this.m_linearSlop) {
			manifold.pointCount = 0;

			// Upstream uses an atomic here because pre-solve runs on worker threads.
			// This sample is single threaded.
			this.m_rejectedCount += 1;
		}
	}

	// I want to disable horizontal continuous collision between the player and the floor tiles.
	// Continuous collision in Box2D doesn't affect velocity, but it does cause time loss, which
	// may be perceived as stuttering or non-smooth movement.
	//
	// CCD doesn't get the full manifold so the contactArea cannot be used. Instead I disable
	// the CCD event if the normal is horizontal and the other shape is a horizontal tile,
	// identified by material id.
	//
	// point and normal are b2Vec2 copies owned by this callback.
	PreContinuous = (shapeIdA, shapeIdB, point, normal) => {
		const {
			b2Shape_GetBody,
			b2Shape_GetUserMaterial,
			B2_ID_EQUALS,
		} = this.box2d;

		const normalY = normal.y;
		point.delete();
		normal.delete();

		// Only filter horizontal hits.
		if (Math.abs(normalY) > 0.1) {
			return true;
		}

		const idA = b2Shape_GetBody(shapeIdA);

		// Determine if this is player[1] and determine the other shape.
		let floorShapeId = null;
		if (B2_ID_EQUALS(idA, this.m_playerIds[1])) {
			floorShapeId = shapeIdB;
		}
		else {
			const idB = b2Shape_GetBody(shapeIdB);
			if (B2_ID_EQUALS(idB, this.m_playerIds[1])) {
				floorShapeId = shapeIdA;
			}
			else {
				return true;
			}
		}

		const material = b2Shape_GetUserMaterial(floorShapeId);
		if (material == GhostCulling.m_floorMaterial) {
			// This is a floor tile.
			return false;
		}

		// Not a floor time, allow CCD.
		return true;
	}

	Step() {
		const {
			b2Body_GetLinearVelocity,
		} = this.box2d;

		super.Step();

		DrawWorldString(this.debugDraw, -9.8, 4.2, "unfiltered");
		DrawWorldString(this.debugDraw, -9.8, 1.2, "shallow contacts rejected");

		for (let i = 0; i < 2; ++i) {
			const v = b2Body_GetLinearVelocity(this.m_playerIds[i]);
			this.m_playerVelocities[i] = v.x;
			v.delete();
		}
	}

	CreateUI() {
		const container = document.getElementById('sample-settings');

		if (this.pane) {
			this.pane.dispose();
		}

		this.pane = new Pane({
			title: 'Sample Settings',
			expanded: true,
			container
		});

		const PARAMS = {
			speed: this.m_speed,
		};

		this.pane.addBinding(PARAMS, 'speed', { label: 'Speed', step: 0.1, min: 1, max: 100 }).on('change', event => { this.m_speed = event.value; });

		this.pane.addButton({
			title: 'Launch',
		}).on('click', () => {
			this.Launch();
		});
	}

	UpdateUI(DrawString, m_textLine) {
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		m_textLine = DrawString(5, m_textLine, `Rejected contacts: ${this.m_rejectedCount}`);

		for (let i = 0; i < 2; ++i) {
			m_textLine = DrawString(5, m_textLine, `player ${i} velocity.x = ${this.m_playerVelocities[i].toFixed(3)}`);
		}

		return m_textLine;
	}

	Destroy() {
		super.Destroy();

		// The world is gone, so the callbacks can no longer be called
		this.box2d.b2World_DeleteCallback(this.m_preSolveCallback);

		if (this.pane) {
			this.pane.dispose();
			this.pane = null;
		}
	}
}
