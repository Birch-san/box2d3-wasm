import Camera from "./camera.mjs";

export interface CanvasWithBlockFlag extends HTMLCanvasElement {
    blockTouchCameraControls?: boolean;
}

export default class TouchController {
    camera: Camera;
    canvas: CanvasWithBlockFlag;
    touches: Touch[];
    lastTouchDistance: number;
    enabled: boolean;

    constructor(camera: Camera, canvas: HTMLCanvasElement);
    Enable(): void;
    Disable(): void;
    getTouchDistance(touches: Touch[]): number;
    getTouchCenter(touches: Touch[]): { x: number; y: number };
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: (event: TouchEvent) => void;
    Destroy(): void;
}
