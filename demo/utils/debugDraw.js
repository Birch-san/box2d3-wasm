export default class Box2DDebugDraw {
    constructor(canvas, box2d, ptm) {
        this.bwWorld_Draw = box2d.bwWorld_Draw;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.debugDraw = new box2d.CanvasDebugDraw(this.ctx);
        this.offset = { x: 0, y: 0 };
        this.scale = ptm;
        this.center = { x: canvas.width / 2, y: canvas.height / 2 };
    }

    drawWorld(world) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.center.x, this.center.y);
        this.ctx.translate(-this.offset.x * this.scale, this.offset.y * this.scale);
        this.ctx.scale(this.scale, -this.scale);
        this.ctx.lineWidth = 1 / this.scale;
        world.Draw(this.debugDraw.callbacks);
        this.ctx.restore();
    }
    drawWorldId(world) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.center.x, this.center.y);
        this.ctx.translate(-this.offset.x * this.scale, this.offset.y * this.scale);
        this.ctx.scale(this.scale, -this.scale);
        this.ctx.lineWidth = 1 / this.scale;
        this.bwWorld_Draw(world, this.debugDraw.callbacks);
        this.ctx.restore();
    }
}
