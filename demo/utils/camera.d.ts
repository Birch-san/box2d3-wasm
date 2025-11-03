import TouchController from "./touchController.mjs";

export interface Point {
    x: number;
    y: number;
}

export interface Transform {
    offset: Point;
    scale: Point;
}

export interface CameraOptions {
    autoResize?: boolean;
    controls?: boolean;
    canvas?: HTMLCanvasElement | null;
}

export default class Camera {
    canvas: HTMLCanvasElement | null;
    center: Point;
    zoom: number;
    width: number;
    height: number;
    mouseDown: number;
    mousePos: Point;
    mouseDownPos: Point;
    touchController: TouchController | null;

    constructor(options?: CameraOptions);
    autoResize(): void;
    resizeWindow: () => void;
    resize(width: number, height: number): void;
    getTransform(): Transform;
    convertScreenToWorld(screenPoint: Point): Point;
    addControls(): void;
    removeControls(): void;
    onMouseDown: (event: MouseEvent) => void;
    onMouseUp: (event: MouseEvent) => void;
    onMouseMove: (event: MouseEvent) => void;
    onScroll: (event: WheelEvent) => void;
    Destroy(): void;
}
