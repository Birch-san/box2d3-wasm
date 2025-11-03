import Camera from "./camera.mjs";

export interface DebugDrawOptions {
    pixelToMeters?: number;
    autoHD?: boolean;
    maxDebugDrawCommands?: number;
    debugMemory?: boolean;
}

export interface Point {
    x: number;
    y: number;
}

export interface Transform {
    p: Point;
    q: { c: number; s: number };
}

export interface Color {
    r: number;
    g: number;
    b: number;
}

export default class DebugDrawRenderer {
    Module: any;
    ctx: CanvasRenderingContext2D;
    baseScale: number;
    offset: Point;
    autoHD: boolean;
    dpr: number;
    finalScale: number;
    debugDrawCommandBuffer: any;
    colorCache: Record<number, Record<number, string>>;
    debugMemory: boolean;

    constructor(Module: any, context: CanvasRenderingContext2D, options?: DebugDrawOptions);
    initializeColorCache(alpha?: number): Record<number, string>;
    prepareCanvas(): void;
    restoreCanvas(): void;
    processCommands(ptr: number, size: number, stride: number): void;
    drawPolygon(cmd: any): void;
    drawSolidPolygon(cmd: any): void;
    drawCircle(cmd: any): void;
    drawSolidCircle(cmd: any): void;
    drawSolidCapsule(cmd: any): void;
    drawLine(cmd: any): void;
    drawTransform(cmd: any): void;
    drawPoint(cmd: any): void;
    drawString(cmd: any): void;
    drawMemoryUsage(): void;
    colorToHTML(color: number, alpha?: number): string;
    transformPoint(xf: Transform, v: Point): Point;
    SetFlags(flags: number): void;
    Draw(worldId: any, camera?: Camera): void;
}
