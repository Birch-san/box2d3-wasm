import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";

import settings from '../../settings.mjs';

import { CreateFallingHinges, UpdateFallingHinges, FormatHash } from './fallingHinges.mjs';

const e_snapshotInterval = 20;

const Result = {
	e_running: 0,
	e_match: 1,
	e_mismatch: 2,
};

// Records a snapshot every few steps of a full run, then rolls the world back to any of them.
// Resimulating from a rollback point has to reach the same sleep step and transform hash as the
// original run. This demonstrates rollback determinism.
// Note: while paused the testbed still calls b2World_Step with a zero time step, which updates
// contacts. Pausing during a run can therefore change its result (same as upstream).
export default class Rollback extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.0, y: 7.5 };
		camera.zoom = 10;
		settings.enableSleep = true;
		settings.drawJoints = true;

		this.m_data = CreateFallingHinges( this.box2d, this.m_worldId );
		// each snapshot is { image: Uint8Array, step }
		this.m_snapshots = [];
		this.m_referenceSleepStep = 0;
		this.m_referenceHash = 0;
		this.m_selected = 0;
		this.m_rollbackStep = -1;
		this.m_result = Result.e_running;
		this.m_done = false;

		this.Capture( 0 );

		this.CreateUI();
	}

	Capture(step){
		const {
			b2World_GetSnapshot,
		} = this.box2d;

		// a copy of the snapshot image, so it stays valid while the world keeps stepping
		const image = b2World_GetSnapshot( this.m_worldId );
		if ( image )
		{
			this.m_snapshots.push( { image, step } );
		}
	}

	RollBack(index){
		const {
			b2World_RestoreFromSnapshot,
		} = this.box2d;

		const snapshot = this.m_snapshots[index];
		if ( snapshot == undefined )
		{
			return;
		}

		// Let go of the mouse first, the restore would bring back the world without the mouse body
		this.MouseUp();

		if ( b2World_RestoreFromSnapshot( this.m_worldId, snapshot.image ) == false )
		{
			console.warn( `rollback to step ${snapshot.step} failed` );
			return;
		}

		this.m_data.stepCount = snapshot.step;
		this.m_data.sleepStep = -1;
		this.m_data.hash = 0;

		this.m_rollbackStep = snapshot.step;
		this.m_result = Result.e_running;
		this.m_done = false;
	}

	Step(){
		// upstream only advances the hinge data when the world actually stepped
		const didStep = settings.hertz > 0 && ( settings.pause == false || settings.singleStep );

		super.Step();

		if ( didStep && this.m_done == false )
		{
			// Only the reference run lays down snapshots. A rollback resims through the same steps
			// and would otherwise pile up duplicates.
			// m_data.stepCount counts the steps before this one.
			const step = this.m_data.stepCount + 1;
			if ( this.m_referenceHash == 0 && step % e_snapshotInterval == 0 )
			{
				this.Capture( step );
			}

			this.m_done = UpdateFallingHinges( this.box2d, this.m_worldId, this.m_data );

			if ( this.m_done )
			{
				if ( this.m_referenceHash == 0 )
				{
					this.m_referenceSleepStep = this.m_data.sleepStep;
					this.m_referenceHash = this.m_data.hash;

					// now there is something to roll back to
					this.CreateUI();
				}

				const match = this.m_data.sleepStep == this.m_referenceSleepStep && this.m_data.hash == this.m_referenceHash;
				this.m_result = match ? Result.e_match : Result.e_mismatch;

				console.log( `sleep step = ${this.m_data.sleepStep}, hash = ${FormatHash(this.m_data.hash)}${match ? "" : " MISMATCH"}` );
			}
		}
	}

	CreateUI(){
		const container = document.getElementById('sample-settings');

		if(this.pane){
			this.pane.dispose();
			this.pane = null;
		}

		// the snapshot list is only offered once the reference run is complete
		if ( this.m_referenceHash == 0 )
		{
			return;
		}

		this.pane = new Pane({
			title: 'Sample Settings',
			expanded: true,
			container
		});

		const options = {};
		this.m_snapshots.forEach((snapshot, i) => {
			options[`step ${snapshot.step}, ${Math.floor(snapshot.image.length / 1024)} kB`] = i;
		});

		const PARAMS = {
			snapshot: this.m_selected,
		};

		this.pane.addBinding(PARAMS, 'snapshot', {
			options,
		}).on('change', event => {
			this.m_selected = event.value;
		});

		this.pane.addButton({
			title: 'Roll Back',
		}).on('click', () => {
			this.RollBack( this.m_selected );
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		if ( this.m_referenceHash == 0 )
		{
			m_textLine = DrawString(5, m_textLine, `reference run: step ${this.m_data.stepCount}`);
			return m_textLine;
		}

		m_textLine = DrawString(5, m_textLine, `reference sleep step = ${this.m_referenceSleepStep}, hash = ${FormatHash(this.m_referenceHash)}`);

		let totalSize = 0;
		for ( const snapshot of this.m_snapshots )
		{
			totalSize += snapshot.image.length;
		}
		m_textLine = DrawString(5, m_textLine, `${this.m_snapshots.length} snapshots, ${(totalSize / 1024).toFixed(0)} kB`);

		if ( this.m_result == Result.e_running )
		{
			m_textLine = DrawString(5, m_textLine, `rolled back to step ${this.m_rollbackStep}, resimulating`);
		}
		else if ( this.m_result == Result.e_match )
		{
			m_textLine = DrawString(5, m_textLine, `match: sleep step = ${this.m_data.sleepStep}, hash = ${FormatHash(this.m_data.hash)}`);
		}
		else
		{
			m_textLine = DrawString(5, m_textLine, `MISMATCH: sleep step = ${this.m_data.sleepStep}, hash = ${FormatHash(this.m_data.hash)}`);
		}

		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		this.m_snapshots = [];

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
