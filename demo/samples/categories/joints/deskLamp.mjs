import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import Sample from "../../sample.mjs";
import settings from '../../settings.mjs';

import b2HexColor from '../../b2HexColor.mjs';

const e_springCount = 2;

// The Anglepoise Original 1227 desk lamp.
// https://www.anglepoise.com/usa/product-category/original-1227/
export default class DeskLamp extends Sample{
	constructor(box2d, camera, debugDraw){
		super(box2d, camera, debugDraw);

		camera.center = {x: 0.2, y: 1.42 };
		camera.zoom = 1.6;

		// The parallelogram is narrow, so it wants the extra resolution.
		// Restored in Destroy() so other samples keep the default.
		this.m_previousSubStepCount = settings.subStepCount;
		settings.subStepCount = 8;

		const {
			b2DefaultBodyDef,
			b2DefaultShapeDef,
			b2CreateBody,
			b2CreateSegmentShape,
			b2CreatePolygonShape,
			b2CreateCapsuleShape,
			b2Segment,
			b2Capsule,
			b2Vec2,
			b2MakeRot,
			b2MakeOffsetBox,
			b2ComputeHull,
			b2MakePolygon,
			b2InvMulRot,
			b2Rot_identity,
			b2Body_GetLocalPoint,
			b2DefaultRevoluteJointDef,
			b2CreateRevoluteJoint,
			b2DefaultDistanceJointDef,
			b2CreateDistanceJoint,
			b2BodyType,
		} = this.box2d;

		{
			const bodyDef = b2DefaultBodyDef();
			const groundId = b2CreateBody( this.m_worldId, bodyDef );

			const shapeDef = b2DefaultShapeDef();
			const segment = new b2Segment();
			segment.point1.Set( -20.0, 0.0 );
			segment.point2.Set( 20.0, 0.0 );
			b2CreateSegmentShape( groundId, shapeDef, segment );

			bodyDef.delete();
			shapeDef.delete();
			segment.delete();
		}

		// Dimensions taken off an Original 1227 in meters, then scaled up. At life size the silver
		// link is two centimeters, which is far too close to the linear slop.
		const scale = 5.0;

		const baseHalfWidth = 0.070 * scale;
		const baseHalfHeight = 0.018 * scale;
		const postHalfWidth = 0.008 * scale;
		const pivotHeight = 0.185 * scale;
		const springAnchorHeight = 0.095 * scale;
		const topLinkLength = 0.296 * scale;
		const silverFoot = 0.024 * scale;
		const topLeverLength = 0.019 * scale;
		const lowerLeverLength = 0.028 * scale;
		const upperArmLength = 0.324 * scale;
		const tubeRadius = 0.0036 * scale;
		const shadeLength = 0.161 * scale;
		const shadeNeckRadius = 0.020 * scale;
		const shadeMouthRadius = 0.061 * scale;

		// The silver link measured in the top link frame. The same span separates the two pins on the
		// upper arm, which is what closes the parallelogram.
		const silverSpan = { x: 0.0212 * scale, y: 0.0109 * scale };
		const silverLength = Math.hypot( silverSpan.x, silverSpan.y );

		const topLinkAngle = -0.878;
		const upperArmAngle = 1.192;
		const shadeTilt = -0.41;

		// The arm spring balances the elevation, the head spring balances the upper arm through the
		// parallelogram. That is what the real lamp uses two springs for.
		this.m_springHertz = [5.0, 5.0];
		this.m_springDamping = 4.0;
		this.m_lowerFriction = 100.0;
		this.m_elbowFriction = 100.0;
		this.m_headAngle = 0.0;

		// b2MakeRot uses Box2D's own cosine/sine approximation, so read the rotations back from it
		const toRot = ( angle ) => {
			const q = b2MakeRot( angle );
			const r = { c: q.c, s: q.s };
			q.delete();
			return r;
		};
		const rotateVector = ( q, v ) => ( { x: q.c * v.x - q.s * v.y, y: q.s * v.x + q.c * v.y } );
		const yAxis = ( q ) => ( { x: -q.s, y: q.c } );
		const offset = ( p, d, s = 1.0 ) => ( { x: p.x + s * d.x, y: p.y + s * d.y } );

		const topRotation = toRot( topLinkAngle );
		const upperRotation = toRot( upperArmAngle );
		const shadeRotation = toRot( shadeTilt );

		const topAxis = yAxis( topRotation );
		const silverWorld = rotateVector( topRotation, silverSpan );

		const postPivot = { x: 0.0, y: pivotHeight };
		const upperPin = offset( postPivot, topAxis, topLinkLength );
		const silverBase = offset( postPivot, topAxis, silverFoot );
		const lowerFoot = offset( silverBase, silverWorld );
		const lowerPin = offset( upperPin, silverWorld );

		// The lower link is parallel to the top link and shorter by the silver link foot
		const lowerLinkLength = topLinkLength - silverFoot;

		// b2MakeRotFromUnitVector( b2RightPerp( b2Normalize( silverWorld ) ) )
		const silverWorldLength = Math.hypot( silverWorld.x, silverWorld.y );
		const silverDirection = { x: silverWorld.x / silverWorldLength, y: silverWorld.y / silverWorldLength };
		const silverRotation = { c: silverDirection.y, s: -silverDirection.x };

		const headPivot = offset( upperPin, yAxis( upperRotation ), upperArmLength );

		const tmp = new b2Vec2( 0.0, 0.0 );
		const localPoint = ( bodyId, p ) => {
			const local = b2Body_GetLocalPoint( bodyId, tmp.Set( p.x, p.y ) );
			const result = { x: local.x, y: local.y };
			local.delete();
			return result;
		};

		const bodyDef = b2DefaultBodyDef();
		bodyDef.type = b2BodyType.b2_dynamicBody;

		const shapeDef = b2DefaultShapeDef();
		const capsule = new b2Capsule();

		const setBodyPose = ( p, q ) => {
			bodyDef.position.Set( p.x, p.y );
			bodyDef.rotation.c = q.c;
			bodyDef.rotation.s = q.s;
		};

		let baseId;
		{
			// The base is static so the linkage is all that moves
			bodyDef.type = b2BodyType.b2_staticBody;
			setBodyPose( { x: 0.0, y: 0.0 }, { c: 1.0, s: 0.0 } );
			baseId = b2CreateBody( this.m_worldId, bodyDef );

			const plinth = b2MakeOffsetBox( baseHalfWidth, baseHalfHeight, tmp.Set( 0.0, baseHalfHeight ), b2Rot_identity );
			const postHalfHeight = 0.5 * ( pivotHeight - 2.0 * baseHalfHeight );
			const post = b2MakeOffsetBox( postHalfWidth, postHalfHeight, tmp.Set( 0.0, pivotHeight - postHalfHeight ), b2Rot_identity );

			b2CreatePolygonShape( baseId, shapeDef, plinth );
			b2CreatePolygonShape( baseId, shapeDef, post );

			plinth.delete();
			post.delete();
		}

		bodyDef.type = b2BodyType.b2_dynamicBody;
		shapeDef.density = 20.0;

		// Both long links run past their feet into the levers the springs pull on
		{
			setBodyPose( postPivot, topRotation );
			this.m_topLinkId = b2CreateBody( this.m_worldId, bodyDef );

			capsule.center1.Set( 0.0, -topLeverLength );
			capsule.center2.Set( 0.0, topLinkLength );
			capsule.radius = tubeRadius;
			b2CreateCapsuleShape( this.m_topLinkId, shapeDef, capsule );
		}

		let lowerLinkId;
		{
			setBodyPose( lowerFoot, topRotation );
			lowerLinkId = b2CreateBody( this.m_worldId, bodyDef );

			capsule.center1.Set( 0.0, -lowerLeverLength );
			capsule.center2.Set( 0.0, lowerLinkLength );
			capsule.radius = tubeRadius;
			b2CreateCapsuleShape( lowerLinkId, shapeDef, capsule );
		}

		let silverId;
		{
			setBodyPose( silverBase, silverRotation );
			silverId = b2CreateBody( this.m_worldId, bodyDef );

			capsule.center1.Set( 0.0, 0.0 );
			capsule.center2.Set( 0.0, silverLength );
			capsule.radius = 1.4 * tubeRadius;
			shapeDef.material.customColor = b2HexColor.b2_colorSilver;
			b2CreateCapsuleShape( silverId, shapeDef, capsule );
			shapeDef.material.customColor = 0;
		}

		let upperArmId;
		{
			setBodyPose( upperPin, upperRotation );
			upperArmId = b2CreateBody( this.m_worldId, bodyDef );

			capsule.center1.Set( 0.0, 0.0 );
			capsule.center2.Set( 0.0, upperArmLength );
			capsule.radius = 0.8 * tubeRadius;
			b2CreateCapsuleShape( upperArmId, shapeDef, capsule );

			// The coupler span reaches back to the lower link pin
			const bracketEnd = localPoint( upperArmId, lowerPin );
			capsule.center1.Set( 0.0, 0.0 );
			capsule.center2.Set( bracketEnd.x, bracketEnd.y );
			capsule.radius = tubeRadius;
			b2CreateCapsuleShape( upperArmId, shapeDef, capsule );
		}

		const pinDef = b2DefaultRevoluteJointDef();
		pinDef.base.drawScale = 0.03 * scale;
		pinDef.base.constraintHertz = 240.0;
		pinDef.base.constraintDampingRatio = 2.0;

		// Only the top link reaches the post. The springs carry it, so it needs little friction.
		{
			const p = localPoint( baseId, postPivot );
			pinDef.base.bodyIdA = baseId;
			pinDef.base.bodyIdB = this.m_topLinkId;
			pinDef.base.localFrameA.p.Set( p.x, p.y );
			pinDef.base.localFrameB.p.Set( 0.0, 0.0 );
			pinDef.enableMotor = true;
			pinDef.maxMotorTorque = this.m_lowerFriction;
			this.m_postJointId = b2CreateRevoluteJoint( this.m_worldId, pinDef );
		}

		pinDef.enableMotor = false;

		// The silver link hangs off the top link and carries the foot of the lower link
		pinDef.base.bodyIdA = this.m_topLinkId;
		pinDef.base.bodyIdB = silverId;
		pinDef.base.localFrameA.p.Set( 0.0, silverFoot );
		pinDef.base.localFrameB.p.Set( 0.0, 0.0 );
		b2CreateRevoluteJoint( this.m_worldId, pinDef );

		pinDef.base.bodyIdA = silverId;
		pinDef.base.bodyIdB = lowerLinkId;
		pinDef.base.localFrameA.p.Set( 0.0, silverLength );
		pinDef.base.localFrameB.p.Set( 0.0, 0.0 );
		b2CreateRevoluteJoint( this.m_worldId, pinDef );

		// Both long links reach the upper arm, at points a silver link apart.
		{
			const p = localPoint( upperArmId, lowerPin );
			pinDef.base.bodyIdA = lowerLinkId;
			pinDef.base.bodyIdB = upperArmId;
			pinDef.base.localFrameA.p.Set( 0.0, lowerLinkLength );
			pinDef.base.localFrameB.p.Set( p.x, p.y );
			b2CreateRevoluteJoint( this.m_worldId, pinDef );
		}

		// No spring reaches the elbow, so it is a friction pivot like the real one.
		pinDef.base.bodyIdA = this.m_topLinkId;
		pinDef.base.bodyIdB = upperArmId;
		pinDef.base.localFrameA.p.Set( 0.0, topLinkLength );
		pinDef.base.localFrameB.p.Set( 0.0, 0.0 );
		pinDef.enableMotor = true;
		pinDef.maxMotorTorque = this.m_elbowFriction;
		this.m_elbowJointId = b2CreateRevoluteJoint( this.m_worldId, pinDef );

		const springDef = b2DefaultDistanceJointDef();
		springDef.base.drawScale = 0.03 * scale;
		springDef.enableSpring = true;
		springDef.dampingRatio = this.m_springDamping;

		// A coil spring only pulls
		//springDef.upperSpringForce = 0.0;

		// Carwardine's trick. With almost no free length the spring torque about the pivot is
		// k times cross(lever, anchor), which tracks the gravity torque as the arm swings, so the
		// arm balances over its whole range instead of at one angle.
		springDef.length = 0.01;

		const springBase = { x: 0.0, y: springAnchorHeight };
		const leverIds = [ this.m_topLinkId, lowerLinkId ];
		const leverLengths = [ topLeverLength, lowerLeverLength ];

		this.m_springJointIds = [];
		const springBaseLocal = localPoint( baseId, springBase );
		for ( let k = 0; k < e_springCount; ++k )
		{
			springDef.base.bodyIdA = baseId;
			springDef.base.bodyIdB = leverIds[k];
			springDef.base.localFrameA.p.Set( springBaseLocal.x, springBaseLocal.y );
			springDef.base.localFrameB.p.Set( 0.0, -leverLengths[k] );
			springDef.hertz = this.m_springHertz[k];
			this.m_springJointIds[k] = b2CreateDistanceJoint( this.m_worldId, springDef );
		}

		{
			setBodyPose( headPivot, shadeRotation );
			const headId = b2CreateBody( this.m_worldId, bodyDef );

			// The pivot is on the shade center line, where the arm capsule ends. The shade opens along
			// the local negative y.
			const neck = 0.45 * shadeLength;
			const mouth = neck - shadeLength;
			const points = [
				{ x: -shadeNeckRadius, y: neck },
				{ x: shadeNeckRadius, y: neck },
				{ x: shadeMouthRadius, y: mouth },
				{ x: -shadeMouthRadius, y: mouth },
			];
			const hull = b2ComputeHull( points );
			const shade = b2MakePolygon( hull, 0.01 * scale );

			// The shade is a thin shell.
			shapeDef.density = 1.0;
			b2CreatePolygonShape( headId, shapeDef, shade );

			// Offset the reference frame so the head slider reads zero at the pose above.
			const upperRot = b2MakeRot( upperArmAngle );
			const shadeRot = b2MakeRot( shadeTilt );
			const relativeRot = b2InvMulRot( upperRot, shadeRot );

			pinDef.base.bodyIdA = upperArmId;
			pinDef.base.bodyIdB = headId;
			pinDef.base.localFrameA.p.Set( 0.0, upperArmLength );
			pinDef.base.localFrameA.q.c = relativeRot.c;
			pinDef.base.localFrameA.q.s = relativeRot.s;
			pinDef.base.localFrameB.p.Set( 0.0, 0.0 );
			pinDef.enableMotor = false;
			pinDef.maxMotorTorque = 10.0;
			pinDef.enableSpring = true;
			pinDef.hertz = 8.0;
			pinDef.dampingRatio = 2.0;
			pinDef.targetAngle = this.m_headAngle;
			pinDef.enableLimit = true;
			pinDef.lowerAngle = -1.2;
			pinDef.upperAngle = 1.2;
			this.m_headJointId = b2CreateRevoluteJoint( this.m_worldId, pinDef );

			hull.delete();
			shade.delete();
			upperRot.delete();
			shadeRot.delete();
			relativeRot.delete();
		}

		tmp.delete();
		bodyDef.delete();
		shapeDef.delete();
		capsule.delete();
		pinDef.delete();
		springDef.delete();

		this.CreateUI();
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
			b2DistanceJoint_SetSpringHertz,
			b2DistanceJoint_SetSpringDampingRatio,
			b2RevoluteJoint_SetMaxMotorTorque,
			b2RevoluteJoint_SetTargetAngle,
			b2Joint_WakeBodies,
		} = this.box2d;

		const PARAMS = {
			armSpring: this.m_springHertz[0],
			headSpring: this.m_springHertz[1],
			springDamping: this.m_springDamping,
			postFriction: this.m_lowerFriction,
			elbowFriction: this.m_elbowFriction,
			head: this.m_headAngle,
		};

		this.pane.addBinding(PARAMS, 'armSpring', {
			label: 'arm spring',
			step: 0.01,
			min: 0.0,
			max: 20.0,
		}).on('change', event => {
			this.m_springHertz[0] = event.value;
			b2DistanceJoint_SetSpringHertz( this.m_springJointIds[0], this.m_springHertz[0] );
			b2Joint_WakeBodies( this.m_springJointIds[0] );
		});

		this.pane.addBinding(PARAMS, 'headSpring', {
			label: 'head spring',
			step: 0.01,
			min: 0.0,
			max: 20.0,
		}).on('change', event => {
			this.m_springHertz[1] = event.value;
			b2DistanceJoint_SetSpringHertz( this.m_springJointIds[1], this.m_springHertz[1] );
			b2Joint_WakeBodies( this.m_springJointIds[1] );
		});

		this.pane.addBinding(PARAMS, 'springDamping', {
			label: 'spring damping',
			step: 0.1,
			min: 0.0,
			max: 5.0,
		}).on('change', event => {
			this.m_springDamping = event.value;
			for ( let k = 0; k < e_springCount; ++k )
			{
				b2DistanceJoint_SetSpringDampingRatio( this.m_springJointIds[k], this.m_springDamping );
				b2Joint_WakeBodies( this.m_springJointIds[k] );
			}
		});

		// Upstream uses ranges of 0-20 and 0-60 here while both frictions start at 100,
		// so the ranges are widened to include the starting value.
		this.pane.addBinding(PARAMS, 'postFriction', {
			label: 'post friction',
			step: 0.1,
			min: 0.0,
			max: 200.0,
		}).on('change', event => {
			this.m_lowerFriction = event.value;
			b2RevoluteJoint_SetMaxMotorTorque( this.m_postJointId, this.m_lowerFriction );
			b2Joint_WakeBodies( this.m_postJointId );
		});

		this.pane.addBinding(PARAMS, 'elbowFriction', {
			label: 'elbow friction',
			step: 1,
			min: 0.0,
			max: 200.0,
		}).on('change', event => {
			this.m_elbowFriction = event.value;
			b2RevoluteJoint_SetMaxMotorTorque( this.m_elbowJointId, this.m_elbowFriction );
			b2Joint_WakeBodies( this.m_elbowJointId );
		});

		this.pane.addBinding(PARAMS, 'head', {
			step: 0.01,
			min: -1.2,
			max: 1.2,
		}).on('change', event => {
			this.m_headAngle = event.value;
			b2RevoluteJoint_SetTargetAngle( this.m_headJointId, this.m_headAngle );
			b2Joint_WakeBodies( this.m_headJointId );
		});
	}

	UpdateUI(DrawString, m_textLine){
		m_textLine = super.UpdateUI(DrawString, m_textLine);

		const {
			b2RevoluteJoint_GetCurrentMotorTorque,
			b2DistanceJoint_GetSpringForce,
		} = this.box2d;

		const postTorque = b2RevoluteJoint_GetCurrentMotorTorque( this.m_postJointId );
		const elbowTorque = b2RevoluteJoint_GetCurrentMotorTorque( this.m_elbowJointId );
		m_textLine = DrawString( 5, m_textLine, `friction carrying: post ${postTorque.toFixed(2)}, elbow ${elbowTorque.toFixed(2)} N m` );

		const spring1 = b2DistanceJoint_GetSpringForce( this.m_springJointIds[0] );
		const spring2 = b2DistanceJoint_GetSpringForce( this.m_springJointIds[1] );
		m_textLine = DrawString( 5, m_textLine, `spring forces: ${spring1.toFixed(2)}, ${spring2.toFixed(2)} N` );

		return m_textLine;
	}

	Destroy(){
		super.Destroy();

		settings.subStepCount = this.m_previousSubStepCount;

		if (this.pane){
			this.pane.dispose();
			this.pane = null;
		}
	}
}
