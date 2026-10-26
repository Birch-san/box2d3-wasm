import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import settings from '../../settings.mjs';

import Keyboard, { Key } from '../../../utils/keyboard.mjs';
import b2HexColor from '../../b2HexColor.mjs';
import { ParsePath } from '../character/shared/utils.mjs';

// The spacing of floats just above x, like nextafterf( x, FLT_MAX ) - x for x > 0
function FloatGridStep( x ){
	const f = new Float32Array( [ Math.abs( x ) ] );
	const fx = f[0];
	new Uint32Array( f.buffer )[0] += 1;
	return f[0] - fx;
}

// The Gear Lift mechanism from the Joints samples, rebuilt 1000 km from the origin. The debug draw
// subtracts the camera center before narrowing to float, so the view is correct in either precision.
// In double precision the gears mesh cleanly out here. In single precision the float grid (printed
// on screen) is coarser than the gear teeth, so the same mechanism grinds and jitters.
// Port of FarGate from box2d/samples/sample_world.cpp. Upstream compares the two by building Box2D
// both ways. Here both builds are available, so the sample settings can switch between them.
export default class FarGate extends Sample{
	// main.mjs reads this each time it loads the sample, so a change applies on restart (R)
	static precision = 'double';

	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		const {
			b2Pos,
			b2Vec2,
			b2OffsetPos,
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2DefaultChainDef,
			b2CreateChain,
			b2CreateBody,
			b2Circle,
			b2Capsule,
			b2CreateCircleShape,
			b2CreateCapsuleShape,
			b2CreatePolygonShape,
			b2MakeOffsetRoundedBox,
			b2MakeBox,
			b2MakeRot,
			b2MulRot,
			b2RotateVector,
			b2MakeRotFromUnitVector,
			b2Rot_identity,
			b2Vec2_zero,
			b2Body_GetLocalPoint,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			b2DefaultPrismaticJointDef,
			b2CreatePrismaticJoint,
			b2BodyType,
			RandomPolygon,
			RandomFloatRange,
			RandomIntRange,
			SetRandomSeed,
			B2_PI,
		} = this.box2d;

		// upstream samples start from the same random seed (RAND_SEED)
		SetRandomSeed( 12345 );

		// 1e6 is exactly representable in float so the placement adds no error of its own. Any
		// difference between the two builds comes from how positions are stored as the sim runs.
		const origin = new b2Pos( 1.0e6, 0.0 );
		this.m_origin = { x: origin.x, y: origin.y };

		camera.center = { x: origin.x, y: origin.y + 6.0 };
		camera.zoom = 7.0;
		settings.drawJoints = false;

		// world positions are origin + a float offset, like upstream's b2Pos + b2Vec2
		const offset = new b2Vec2( 0.0, 0.0 );
		const offsetPos = ( p, x, y ) => b2OffsetPos( p, offset.Set( x, y ) );

		// jointDef.base.localFrameA.p = b2Body_GetLocalPoint( bodyId, pivot ), same for B
		const setLocalPoint = ( frame, bodyId, pivot ) => {
			const localPoint = b2Body_GetLocalPoint( bodyId, pivot );
			frame.p.Copy( localPoint );
			localPoint.delete();
		};

		let groundId;
		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.position.Copy( origin );
			groundId = b2CreateBody( this.m_worldId, bodyDef );

			const path =
				"m 63.500002,201.08333 103.187498,0 1e-5,-37.04166 h -2.64584 l 0,34.39583 h -42.33333 v -2.64583 l " +
				"-2.64584,-1e-5 v -2.64583 h -2.64583 v -2.64584 h -2.64584 v -2.64583 H 111.125 v -2.64583 h -2.64583 v " +
				"-2.64583 h -2.64583 v -2.64584 l -2.64584,1e-5 v -2.64583 l -2.64583,-1e-5 V 174.625 h -2.645834 v -2.64584 l " +
				"-2.645833,1e-5 v -2.64584 H 92.60417 v -2.64583 h -2.645834 v -2.64583 l -26.458334,0 0,37.04166";

			const points = ParsePath( path, { x: -120.0, y: -200.0 }, 0.2, false, 64 );

			const chainDef = b2DefaultChainDef();
			chainDef.SetPoints( points );
			chainDef.isLoop = true;
			chainDef.SetMaterials( [ { customColor: b2HexColor.b2_colorDarkSeaGreen } ] );

			b2CreateChain( groundId, chainDef );

			chainDef.delete();
			bodyDef.delete();
		}

		const gearRadius = 1.0;
		const toothHalfWidth = 0.09;
		const toothHalfHeight = 0.06;
		const toothRadius = 0.03;
		const linkHalfLength = 0.07;
		const linkRadius = 0.05;
		const linkCount = 40;
		const doorHalfHeight = 1.5;

		const gearPosition1 = offsetPos( origin, -4.25, 9.75 );
		const gearPosition2 = offsetPos( gearPosition1, 2.0, 1.0 );
		const linkAttachPosition = offsetPos( gearPosition2, gearRadius + 2.0 * toothHalfWidth + toothRadius, 0.0 );
		const doorPosition = offsetPos( linkAttachPosition, 0.0, -( 2.0 * linkCount * linkHalfLength + doorHalfHeight ) );

		// a gear: a circle with 16 teeth, the teeth centered toothOffset beyond the gear radius
		const createGear = ( position, toothOffset ) => {
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Copy( position );

			const bodyId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();
			shapeDef.material.friction = 0.1;
			shapeDef.material.customColor = b2HexColor.b2_colorSaddleBrown;
			const circle = new b2Circle();
			circle.center.Set( 0.0, 0.0 );
			circle.radius = gearRadius;
			b2CreateCircleShape( bodyId, shapeDef, circle );

			const count = 16;
			const deltaAngle = 2.0 * B2_PI / 16;
			const dq = b2MakeRot( deltaAngle );
			const toothCenter = new b2Vec2( gearRadius + toothOffset, 0.0 );
			let center = toothCenter.Clone();
			let rotation = b2MakeRot( 0.0 );

			for ( let i = 0; i < count; ++i )
			{
				const tooth = b2MakeOffsetRoundedBox( toothHalfWidth, toothHalfHeight, center, rotation, toothRadius );
				shapeDef.material.customColor = b2HexColor.b2_colorGray;
				b2CreatePolygonShape( bodyId, shapeDef, tooth );
				tooth.delete();

				const nextRotation = b2MulRot( dq, rotation );
				rotation.delete();
				rotation = nextRotation;

				center.delete();
				center = b2RotateVector( rotation, toothCenter );
			}

			dq.delete();
			toothCenter.delete();
			center.delete();
			rotation.delete();
			circle.delete();
			shapeDef.delete();
			bodyDef.delete();

			return bodyId;
		};

		{
			const bodyId = createGear( gearPosition1, toothHalfHeight );

			this.m_motorTorque = 80.0;
			this.m_motorSpeed = -0.3;
			this.m_enableMotor = true;

			const revoluteDef = b2DefaultRevoluteJointDef();
			revoluteDef.base.bodyIdA = groundId;
			revoluteDef.base.bodyIdB = bodyId;
			setLocalPoint( revoluteDef.base.localFrameA, groundId, gearPosition1 );
			revoluteDef.base.localFrameB.p.Copy( b2Vec2_zero );
			revoluteDef.enableMotor = this.m_enableMotor;
			revoluteDef.maxMotorTorque = this.m_motorTorque;
			revoluteDef.motorSpeed = this.m_motorSpeed;
			this.m_driverId = b2CreateRevoluteJoint( this.m_worldId, revoluteDef );

			revoluteDef.delete();
		}

		const followerId = createGear( gearPosition2, toothHalfWidth );

		{
			const revoluteDef = b2DefaultRevoluteJointDef();
			revoluteDef.base.bodyIdA = groundId;
			revoluteDef.base.bodyIdB = followerId;
			setLocalPoint( revoluteDef.base.localFrameA, groundId, gearPosition2 );
			const rotA = b2MakeRot( 0.25 * B2_PI );
			revoluteDef.base.localFrameA.q = rotA;
			rotA.delete();
			revoluteDef.base.localFrameB.p.Copy( b2Vec2_zero );
			revoluteDef.enableMotor = true;
			revoluteDef.maxMotorTorque = 0.5;
			revoluteDef.lowerAngle = -0.3 * B2_PI;
			revoluteDef.upperAngle = 0.8 * B2_PI;
			revoluteDef.enableLimit = true;
			b2CreateRevoluteJoint( this.m_worldId, revoluteDef );

			revoluteDef.delete();
		}

		let lastLinkId;
		{
			const capsule = new b2Capsule();
			capsule.center1.Set( 0.0, -linkHalfLength );
			capsule.center2.Set( 0.0, linkHalfLength );
			capsule.radius = linkRadius;

			const shapeDef = b2DefaultShapeDef();
			shapeDef.density = 2.0;
			shapeDef.material.customColor = b2HexColor.b2_colorLightSteelBlue;

			const jointDef = b2DefaultRevoluteJointDef();
			jointDef.maxMotorTorque = 0.05;
			jointDef.enableMotor = true;

			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			const position = offsetPos( linkAttachPosition, 0.0, -linkHalfLength );
			const pivot = new b2Pos( 0.0, 0.0 );

			const count = 40;
			let prevBodyId = followerId;
			for ( let i = 0; i < count; ++i )
			{
				bodyDef.position.Copy( position );

				const bodyId = b2CreateBody( this.m_worldId, bodyDef );
				b2CreateCapsuleShape( bodyId, shapeDef, capsule );

				pivot.Set( position.x, position.y + linkHalfLength );
				jointDef.base.bodyIdA = prevBodyId;
				jointDef.base.bodyIdB = bodyId;
				setLocalPoint( jointDef.base.localFrameA, jointDef.base.bodyIdA, pivot );
				setLocalPoint( jointDef.base.localFrameB, jointDef.base.bodyIdB, pivot );
				jointDef.base.drawScale = 0.2;
				b2CreateRevoluteJoint( this.m_worldId, jointDef );

				position.y -= 2.0 * linkHalfLength;
				prevBodyId = bodyId;
			}

			lastLinkId = prevBodyId;

			capsule.delete();
			shapeDef.delete();
			jointDef.delete();
			bodyDef.delete();
			position.delete();
			pivot.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			bodyDef.position.Copy( doorPosition );

			const bodyId = b2CreateBody( this.m_worldId, bodyDef );

			const box = b2MakeBox( 0.15, doorHalfHeight );
			const shapeDef = b2DefaultShapeDef();
			shapeDef.material.friction = 0.1;
			shapeDef.material.customColor = b2HexColor.b2_colorDarkCyan;
			b2CreatePolygonShape( bodyId, shapeDef, box );

			{
				const pivot = offsetPos( doorPosition, 0.0, doorHalfHeight );
				const revoluteDef = b2DefaultRevoluteJointDef();
				revoluteDef.base.bodyIdA = lastLinkId;
				revoluteDef.base.bodyIdB = bodyId;
				setLocalPoint( revoluteDef.base.localFrameA, lastLinkId, pivot );
				revoluteDef.base.localFrameB.p.Set( 0.0, doorHalfHeight );
				revoluteDef.enableMotor = true;
				revoluteDef.maxMotorTorque = 0.05;
				b2CreateRevoluteJoint( this.m_worldId, revoluteDef );

				pivot.delete();
				revoluteDef.delete();
			}

			{
				const localAxis = new b2Vec2( 0.0, 1.0 );
				const axisRotation = b2MakeRotFromUnitVector( localAxis );
				const jointDef = b2DefaultPrismaticJointDef();
				jointDef.base.bodyIdA = groundId;
				jointDef.base.bodyIdB = bodyId;
				setLocalPoint( jointDef.base.localFrameA, groundId, doorPosition );
				jointDef.base.localFrameA.q = axisRotation;
				jointDef.base.localFrameB.p.Copy( b2Vec2_zero );
				jointDef.base.localFrameB.q = axisRotation;
				jointDef.maxMotorForce = 0.2;
				jointDef.enableMotor = true;
				jointDef.base.collideConnected = true;
				b2CreatePrismaticJoint( this.m_worldId, jointDef );

				localAxis.delete();
				axisRotation.delete();
				jointDef.delete();
			}

			box.delete();
			shapeDef.delete();
			bodyDef.delete();
		}

		{
			const bodyDef = b2DefaultBodyDef();
			bodyDef.type = b2BodyType.b2_dynamicBody;
			const shapeDef = b2DefaultShapeDef();
			shapeDef.material.rollingResistance = 0.3;

			const colors = [
				b2HexColor.b2_colorGray, b2HexColor.b2_colorGainsboro, b2HexColor.b2_colorLightGray, b2HexColor.b2_colorLightSlateGray, b2HexColor.b2_colorDarkGray,
			];

			let y = 4.25;
			const xCount = 10, yCount = 20;
			for ( let i = 0; i < yCount; ++i )
			{
				let x = -3.15;
				for ( let j = 0; j < xCount; ++j )
				{
					const position = offsetPos( origin, x, y );
					bodyDef.position.Copy( position );
					position.delete();

					const bodyId = b2CreateBody( this.m_worldId, bodyDef );
					const poly = RandomPolygon( 0.1 );
					poly.radius = RandomFloatRange( 0.01, 0.02 );

					const colorIndex = RandomIntRange( 0, 4 );
					shapeDef.material.customColor = colors[colorIndex];

					b2CreatePolygonShape( bodyId, shapeDef, poly );
					poly.delete();
					x += 0.2;
				}

				y += 0.2;
			}

			bodyDef.delete();
			shapeDef.delete();
		}

		origin.delete();
		offset.delete();
		gearPosition1.delete();
		gearPosition2.delete();
		linkAttachPosition.delete();
		doorPosition.delete();

		this.m_touchKeyboard = false;

		this.CreateUI();
	}

	SetMotorSpeed( speed ){
		const {
			b2RevoluteJoint_SetTargetMotorSpeed,
			b2Joint_WakeBodies,
		} = this.box2d;

		this.m_motorSpeed = speed;
		b2RevoluteJoint_SetTargetMotorSpeed( this.m_driverId, this.m_motorSpeed );
		b2Joint_WakeBodies( this.m_driverId );
	}

	Step(){
		let speed = this.m_motorSpeed;

		if ( Keyboard.IsDown( Key.A ) )
		{
			speed = Math.max( -0.3, speed - 0.01 );
			this.SetMotorSpeed( speed );
		}

		if ( Keyboard.IsDown( Key.D ) )
		{
			speed = Math.min( 0.3, speed + 0.01 );
			this.SetMotorSpeed( speed );
		}

		if ( this.PARAMS && this.PARAMS.speed != this.m_motorSpeed )
		{
			this.PARAMS.speed = this.m_motorSpeed;
			this.pane?.refresh();
		}

		super.Step();
	}

	CreateUI(){
		const container = document.getElementById('sample-settings');

		if(this.pane){
			this.pane.dispose();
		}

		this.pane = new Pane({
			title: 'Sample Settings',
			expanded: true,
			container
		});

		const {
			b2RevoluteJoint_EnableMotor,
			b2RevoluteJoint_SetMaxMotorTorque,
			b2Joint_WakeBodies,
		} = this.box2d;

		this.pane.addButton({
			title: this.m_touchKeyboard ? 'hide touch keyboard' : 'show touch keyboard',
		}).on('click', () => {
			this.m_touchKeyboard = !this.m_touchKeyboard;

			if (this.m_touchKeyboard){
				Keyboard.ShowTouchControls([Key.A, Key.D, Key.R]);
			} else {
				Keyboard.HideTouchControls();
			}

			this.CreateUI();
		});

		this.PARAMS = {
			motor: this.m_enableMotor,
			maxTorque: this.m_motorTorque,
			speed: this.m_motorSpeed,
			precision: FarGate.precision,
		};

		this.pane.addBinding(this.PARAMS, 'motor').on('change', event => {
			this.m_enableMotor = event.value;
			b2RevoluteJoint_EnableMotor( this.m_driverId, this.m_enableMotor );
			b2Joint_WakeBodies( this.m_driverId );
		});

		this.pane.addBinding(this.PARAMS, 'maxTorque', {
			label: 'max torque',
			step: 1,
			min: 0.0,
			max: 100.0,
		}).on('change', event => {
			this.m_motorTorque = event.value;
			b2RevoluteJoint_SetMaxMotorTorque( this.m_driverId, this.m_motorTorque );
			b2Joint_WakeBodies( this.m_driverId );
		});

		this.pane.addBinding(this.PARAMS, 'speed', {
			step: 0.01,
			min: -0.3,
			max: 0.3,
		}).on('change', event => {
			if ( event.value != this.m_motorSpeed )
			{
				this.SetMotorSpeed( event.value );
			}
		});

		// Not in upstream, which is built in one precision or the other. Applies on restart (R).
		this.pane.addBinding(this.PARAMS, 'precision', {
			options: {
				double: 'double',
				single: 'single',
			},
		}).on('change', event => {
			FarGate.precision = event.value;
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const { b2IsDoublePrecision } = this.box2d;

		const gridStep = FloatGridStep( this.m_origin.x );

		const isDouble = b2IsDoublePrecision();
		m_textLine = DrawString( 5, m_textLine, isDouble ? "Double precision" : "Single precision" );
		m_textLine = DrawString( 5, m_textLine, `${( this.m_origin.x / 1000.0 ).toFixed( 0 )} km from the origin` );
		m_textLine = DrawString( 5, m_textLine, `float grid step here = ${+gridStep.toPrecision( 6 )} m, gear teeth are about 0.12 m` );
		m_textLine = DrawString( 5, m_textLine, "Keys: motor speed down = a, up = d" );

		if ( FarGate.precision != ( isDouble ? 'double' : 'single' ) )
		{
			m_textLine = DrawString( 5, m_textLine, `Restart (R) to run in ${FarGate.precision} precision` );
		}

		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		Keyboard.HideTouchControls();

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
