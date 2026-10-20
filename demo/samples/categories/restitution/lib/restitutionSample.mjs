// Shared code for the Restitution samples (port of box2d/samples/sample_restitution.cpp).
// This lives in lib/ so the menu generator (node_generate.mjs) does not pick it up as a sample.
import Sample from "../../../sample.mjs";
import settings from '../../../settings.mjs';

// Sums the kinetic and potential energy of a set of bodies.
export function ComputeEnergy(box2d, worldId, bodyIds){
	const {
		b2World_GetGravity,
		b2Body_GetMassData,
		b2Body_GetLinearVelocity,
		b2Body_GetAngularVelocity,
		b2Body_GetWorldCenter,
	} = box2d;

	const gravity = b2World_GetGravity( worldId );

	let linear = 0.0;
	let angular = 0.0;
	let potential = 0.0;

	for ( const bodyId of bodyIds )
	{
		const massData = b2Body_GetMassData( bodyId );
		const v = b2Body_GetLinearVelocity( bodyId );
		const w = b2Body_GetAngularVelocity( bodyId );
		const c = b2Body_GetWorldCenter( bodyId );

		linear += 0.5 * massData.mass * ( v.x * v.x + v.y * v.y );
		angular += 0.5 * massData.rotationalInertia * w * w;
		potential -= massData.mass * ( gravity.x * c.x + gravity.y * c.y );

		massData.delete();
		v.delete();
		c.delete();
	}

	gravity.delete();

	return { linear, angular, potential };
}

// Base class for the Restitution samples. The bounce iterations and propagation are the global
// "bounce iters" / "bounce propagation" controls in the main panel, like upstream. It adds:
// - DrawScreenTextLine(), which collects text during Step() and draws it in UpdateUI().
// - small world space draw helpers on top of the debug draw canvas.
export default class RestitutionSample extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		this.m_screenText = [];
	}

	Step(){
		super.Step();

		this.m_screenText.length = 0;
	}

	DrawScreenTextLine(text){
		this.m_screenText.push(text);
	}

	// The kinetic / potential / total energy readout shared by several samples
	DrawEnergyText(energy, startEnergy, peakEnergy){
		const { linear, angular, potential } = energy;
		const total = linear + angular + potential;
		const scale = startEnergy != 0.0 ? 100.0 / startEnergy : 0.0;
		this.DrawScreenTextLine( `kinetic   = ${linear.toFixed(3)} J linear + ${angular.toFixed(3)} J angular` );
		this.DrawScreenTextLine( `potential = ${potential.toFixed(3)} J` );
		this.DrawScreenTextLine( `total     = ${total.toFixed(3)} J (${(scale * total).toFixed(2)}% of start, peak ${(scale * peakEnergy).toFixed(2)}%)` );
	}

	DrawLine(x1, y1, x2, y2, color){
		this.debugDraw.prepareCanvas();
		this.debugDraw.drawLine({ data: [x1, y1, x2, y2], color });
		this.debugDraw.restoreCanvas();
	}

	DrawPoint(x, y, size, color){
		this.debugDraw.prepareCanvas();
		this.debugDraw.drawPoint({ data: [x, y, size], color });
		this.debugDraw.restoreCanvas();
	}

	// World space text, encoded like the debug draw string command (x, y, then up to 30 character codes)
	DrawWorldString(x, y, text){
		const data = new Float32Array(32);
		data[0] = x;
		data[1] = y;
		for ( let i = 0; i < text.length && i < 30; ++i )
		{
			data[i + 2] = text.charCodeAt(i);
		}
		this.debugDraw.drawString({ data });
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		for ( const text of this.m_screenText )
		{
			m_textLine = DrawString(5, m_textLine, text);
		}

		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
