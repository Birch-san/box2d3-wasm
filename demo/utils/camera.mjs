import TouchController from "./touchController.mjs";

const mouse = {
	left: 1,
	right: 2
};

export default class Camera {
    constructor(options = {autoResize: false, controls: false, canvas: null}) {
		this.canvas = options.canvas;
        this.center = { x: 0, y: 0 };
        this.zoom = 1.0;
        this.width = 1280;
        this.height = 800;

		if (options.autoResize) {
			this.autoResize();
			this.resizeWindow();
		}

		this.mouseDown = 0;
		this.mousePos = {x: 0, y: 0};
		this.mouseDownPos = {x: 0, y: 0};
		this.touchController = null;

		if (options.controls) {
			this.addControls();
		}
    }

	autoResize() {
		window.addEventListener('resize', this.resizeWindow);
	}

	resizeWindow = () => {
		this.resize(window.innerWidth, window.innerHeight);
	}

	resize(width, height) {
		this.width = width;
		this.height = height;
	}

    getTransform() {
        const ratio = this.width / this.height;
        const extents = {
            x: this.zoom * ratio,
            y: this.zoom
        };

        const scale = {
            x: this.width / (2 * extents.x),
            y: this.height / (2 * extents.y)
        };

        const offset = {
            x: -this.center.x + extents.x,
            y: -this.center.y - extents.y
        };

        return {
            offset,
            scale
        };
    }

    convertScreenToWorld(screenPoint) {
		const { offset, scale } = this.getTransform();
		return {
			x: (screenPoint.x / scale.x) - offset.x,
			y: -((screenPoint.y / scale.y) + offset.y)
		};
	}

	addControls() {
		window.addEventListener('wheel', this.onScroll);
		window.addEventListener('mousemove', this.onMouseMove);
		window.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('contextmenu', (event) => {
			event.preventDefault();
		});

		this.touchController = new TouchController(this, this.canvas);
		this.touchController.Enable();
	}

	removeControls() {
		window.removeEventListener('wheel', this.onScroll);
		window.removeEventListener('mousemove', this.onMouseMove);
		window.removeEventListener('mousedown', this.onMouseDown);
		window.removeEventListener('mouseup', this.onMouseUp);
		this.touchController?.Destroy();
		this.touchController = null;
	}


	onMouseDown = (event) => {
		this.mouseDown = event.button === 0 ? mouse.left : mouse.right;

		if(this.mouseDown === mouse.right) {
			this.mouseDownPos = {x: event.clientX, y: event.clientY};
		}
	}

	onMouseUp = (event) => {
		this.mouseDown = 0;
	}

	onMouseMove = (event) => {
        if(this.mouseDown === mouse.right) {
            const currentWorldPos = this.convertScreenToWorld({
                x: event.clientX,
                y: event.clientY
            });

			const prevWorldPos = this.convertScreenToWorld({
                x: this.mousePos.x,
                y: this.mousePos.y
            });

			this.center.x -= (currentWorldPos.x - prevWorldPos.x);
            this.center.y -= (currentWorldPos.y - prevWorldPos.y);
        }

        this.mousePos = {x: event.clientX, y: event.clientY};
    }

	onScroll = (event) => {
		const cx = event.clientX;
		const cy = event.clientY;
		const dy = event.deltaY;
		const scrollMul = 1.05;

		const worldPosBeforeZoom = this.convertScreenToWorld({x:cx, y:cy});
		this.zoom *= dy > 0 ? scrollMul : 1 / scrollMul;
		const worldPosAfterZoom = this.convertScreenToWorld({x:cx, y:cy});

		this.center.x -= (worldPosAfterZoom.x - worldPosBeforeZoom.x);
		this.center.y += (worldPosBeforeZoom.y - worldPosAfterZoom.y);
	}

	Destroy() {
		window.removeEventListener('resize', this.resizeWindow);
		this.removeControls();
	}
}
