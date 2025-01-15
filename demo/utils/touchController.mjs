export default class TouchController {
    constructor(camera, canvas) {
        this.camera = camera;
		this.canvas = canvas;
        this.touches = [];
        this.lastTouchDistance = 0;
        this.enabled = false;
    }

    Enable() {
        if (this.enabled) return;

        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
        this.enabled = true;
    }

    Disable() {
        if (!this.enabled) return;

        this.canvas.removeEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.removeEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.removeEventListener('touchend', this.onTouchEnd, { passive: false });
        this.enabled = false;
    }

    getTouchDistance(touches) {
        if (touches.length < 2) return 0;

        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getTouchCenter(touches) {
        if (touches.length === 0) return { x: 0, y: 0 };

        if (touches.length === 1) {
            return { x: touches[0].clientX, y: touches[0].clientY };
        }

        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }

    onTouchStart = (event) => {
        event.preventDefault();
        this.touches = Array.from(event.touches);

        if (this.touches.length === 2) {
            this.lastTouchDistance = this.getTouchDistance(this.touches);
        }
    }

    onTouchMove = (event) => {
        if(this.canvas.blockTouchCameraControls) return;

		event.preventDefault();

		if (this.touches.length === 0) {
			this.touches = Array.from(event.touches);
			return;
		}

		const newTouches = Array.from(event.touches);

		// pinch zoom
		if (newTouches.length === 2 && this.touches.length === 2) {
			const newDistance = this.getTouchDistance(newTouches);
			const scale = newDistance / this.lastTouchDistance;

			if (scale !== 1) {
				const center = this.getTouchCenter(newTouches);

				const worldPosBeforeZoom = this.camera.convertScreenToWorld(center);

				this.camera.zoom /= scale;

				const worldPosAfterZoom = this.camera.convertScreenToWorld(center);

				this.camera.center.x -= (worldPosAfterZoom.x - worldPosBeforeZoom.x);
				this.camera.center.y -= (worldPosAfterZoom.y - worldPosBeforeZoom.y);

				this.lastTouchDistance = newDistance;
			}
		}
		// pan
		else if (newTouches.length === 1 && this.touches.length === 1) {
			const currentWorldPos = this.camera.convertScreenToWorld({
				x: newTouches[0].clientX,
				y: newTouches[0].clientY,
			});

			const prevWorldPos = this.camera.convertScreenToWorld({
				x: this.touches[0].clientX,
				y: this.touches[0].clientY,
			});

			this.camera.center.x += (prevWorldPos.x - currentWorldPos.x);
			this.camera.center.y += (prevWorldPos.y - currentWorldPos.y);
		}

		this.touches = newTouches;
	};

    onTouchEnd = (event) => {
        event.preventDefault();
        this.touches = Array.from(event.touches);
        this.lastTouchDistance = 0;
    }

    Destroy() {
        this.Disable();
    }
}
