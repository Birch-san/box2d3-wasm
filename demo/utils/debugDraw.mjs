const defaultDebugDrawOptions = {
    pixelToMeters: 32,
    autoHD: true,
    maxDebugDrawCommands: 10000,
    debugMemory: false
}

export default class DebugDrawRenderer {
    constructor(Module, context, options = {}) {
        const { pixelToMeters, autoHD, maxDebugDrawCommands, debugMemory } = { ...defaultDebugDrawOptions, ...options };

        this.Module = Module;
        this.ctx = context;
        this.baseScale = pixelToMeters;
        this.offset = { x: 0, y: 0 };

        this.autoHD = autoHD;
        this.dpr = autoHD ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        this.finalScale = this.baseScale * this.dpr;

        this.debugDrawCommandBuffer = new Module.DebugDrawCommandBuffer(maxDebugDrawCommands);
        this.colorCache = {};
        this.colorCache[1.0] = this.initializeColorCache();
        this.colorCache[0.5] = this.initializeColorCache(0.5);

        this.debugMemory = debugMemory;
    }

    initializeColorCache(alpha = 1.0) {
        const b2HexColor = {
            b2_colorAliceBlue: 0xF0F8FF,
            b2_colorAntiqueWhite: 0xFAEBD7,
            b2_colorAqua: 0x00FFFF,
            b2_colorAquamarine: 0x7FFFD4,
            b2_colorAzure: 0xF0FFFF,
            b2_colorBeige: 0xF5F5DC,
            b2_colorBisque: 0xFFE4C4,
            b2_colorBlack: 0x000000,
            b2_colorBlanchedAlmond: 0xFFEBCD,
            b2_colorBlue: 0x0000FF,
            b2_colorBlueViolet: 0x8A2BE2,
            b2_colorBrown: 0xA52A2A,
            b2_colorBurlywood: 0xDEB887,
            b2_colorCadetBlue: 0x5F9EA0,
            b2_colorChartreuse: 0x7FFF00,
            b2_colorChocolate: 0xD2691E,
            b2_colorCoral: 0xFF7F50,
            b2_colorCornflowerBlue: 0x6495ED,
            b2_colorCornsilk: 0xFFF8DC,
            b2_colorCrimson: 0xDC143C,
            b2_colorCyan: 0x00FFFF,
            b2_colorDarkBlue: 0x00008B,
            b2_colorDarkCyan: 0x008B8B,
            b2_colorDarkGoldenRod: 0xB8860B,
            b2_colorDarkGray: 0xA9A9A9,
            b2_colorDarkGreen: 0x006400,
            b2_colorDarkKhaki: 0xBDB76B,
            b2_colorDarkMagenta: 0x8B008B,
            b2_colorDarkOliveGreen: 0x556B2F,
            b2_colorDarkOrange: 0xFF8C00,
            b2_colorDarkOrchid: 0x9932CC,
            b2_colorDarkRed: 0x8B0000,
            b2_colorDarkSalmon: 0xE9967A,
            b2_colorDarkSeaGreen: 0x8FBC8F,
            b2_colorDarkSlateBlue: 0x483D8B,
            b2_colorDarkSlateGray: 0x2F4F4F,
            b2_colorDarkTurquoise: 0x00CED1,
            b2_colorDarkViolet: 0x9400D3,
            b2_colorDeepPink: 0xFF1493,
            b2_colorDeepSkyBlue: 0x00BFFF,
            b2_colorDimGray: 0x696969,
            b2_colorDodgerBlue: 0x1E90FF,
            b2_colorFireBrick: 0xB22222,
            b2_colorFloralWhite: 0xFFFAF0,
            b2_colorForestGreen: 0x228B22,
            b2_colorFuchsia: 0xFF00FF,
            b2_colorGainsboro: 0xDCDCDC,
            b2_colorGhostWhite: 0xF8F8FF,
            b2_colorGold: 0xFFD700,
            b2_colorGoldenRod: 0xDAA520,
            b2_colorGray: 0x808080,
            b2_colorGreen: 0x008000,
            b2_colorGreenYellow: 0xADFF2F,
            b2_colorHoneyDew: 0xF0FFF0,
            b2_colorHotPink: 0xFF69B4,
            b2_colorIndianRed: 0xCD5C5C,
            b2_colorIndigo: 0x4B0082,
            b2_colorIvory: 0xFFFFF0,
            b2_colorKhaki: 0xF0E68C,
            b2_colorLavender: 0xE6E6FA,
            b2_colorLavenderBlush: 0xFFF0F5,
            b2_colorLawnGreen: 0x7CFC00,
            b2_colorLemonChiffon: 0xFFFACD,
            b2_colorLightBlue: 0xADD8E6,
            b2_colorLightCoral: 0xF08080,
            b2_colorLightCyan: 0xE0FFFF,
            b2_colorLightGoldenRodYellow: 0xFAFAD2,
            b2_colorLightGray: 0xD3D3D3,
            b2_colorLightGreen: 0x90EE90,
            b2_colorLightPink: 0xFFB6C1,
            b2_colorLightSalmon: 0xFFA07A,
            b2_colorLightSeaGreen: 0x20B2AA,
            b2_colorLightSkyBlue: 0x87CEFA,
            b2_colorLightSlateGray: 0x778899,
            b2_colorLightSteelBlue: 0xB0C4DE,
            b2_colorLightYellow: 0xFFFFE0,
            b2_colorLime: 0x00FF00,
            b2_colorLimeGreen: 0x32CD32,
            b2_colorLinen: 0xFAF0E6,
            b2_colorMagenta: 0xFF00FF,
            b2_colorMaroon: 0x800000,
            b2_colorMediumAquaMarine: 0x66CDAA,
            b2_colorMediumBlue: 0x0000CD,
            b2_colorMediumOrchid: 0xBA55D3,
            b2_colorMediumPurple: 0x9370DB,
            b2_colorMediumSeaGreen: 0x3CB371,
            b2_colorMediumSlateBlue: 0x7B68EE,
            b2_colorMediumSpringGreen: 0x00FA9A,
            b2_colorMediumTurquoise: 0x48D1CC,
            b2_colorMediumVioletRed: 0xC71585,
            b2_colorMidnightBlue: 0x191970,
            b2_colorMintCream: 0xF5FFFA,
            b2_colorMistyRose: 0xFFE4E1,
            b2_colorMoccasin: 0xFFE4B5,
            b2_colorNavajoWhite: 0xFFDEAD,
            b2_colorNavy: 0x000080,
            b2_colorOldLace: 0xFDF5E6,
            b2_colorOlive: 0x808000,
            b2_colorOliveDrab: 0x6B8E23,
            b2_colorOrange: 0xFFA500,
            b2_colorOrangeRed: 0xFF4500,
            b2_colorOrchid: 0xDA70D6,
            b2_colorPaleGoldenRod: 0xEEE8AA,
            b2_colorPaleGreen: 0x98FB98,
            b2_colorPaleTurquoise: 0xAFEEEE,
            b2_colorPaleVioletRed: 0xDB7093,
            b2_colorPapayaWhip: 0xFFEFD5,
            b2_colorPeachPuff: 0xFFDAB9,
            b2_colorPeru: 0xCD853F,
            b2_colorPink: 0xFFC0CB,
            b2_colorPlum: 0xDDA0DD,
            b2_colorPowderBlue: 0xB0E0E6,
            b2_colorPurple: 0x800080,
            b2_colorRebeccaPurple: 0x663399,
            b2_colorRed: 0xFF0000,
            b2_colorRosyBrown: 0xBC8F8F,
            b2_colorRoyalBlue: 0x4169E1,
            b2_colorSaddleBrown: 0x8B4513,
            b2_colorSalmon: 0xFA8072,
            b2_colorSandyBrown: 0xF4A460,
            b2_colorSeaGreen: 0x2E8B57,
            b2_colorSeaShell: 0xFFF5EE,
            b2_colorSienna: 0xA0522D,
            b2_colorSilver: 0xC0C0C0,
            b2_colorSkyBlue: 0x87CEEB,
            b2_colorSlateBlue: 0x6A5ACD,
            b2_colorSlateGray: 0x708090,
            b2_colorSnow: 0xFFFAFA,
            b2_colorSpringGreen: 0x00FF7F,
            b2_colorSteelBlue: 0x4682B4,
            b2_colorTan: 0xD2B48C,
            b2_colorTeal: 0x008080,
            b2_colorThistle: 0xD8BFD8,
            b2_colorTomato: 0xFF6347,
            b2_colorTurquoise: 0x40E0D0,
            b2_colorViolet: 0xEE82EE,
            b2_colorWheat: 0xF5DEB3,
            b2_colorWhite: 0xFFFFFF,
            b2_colorWhiteSmoke: 0xF5F5F5,
            b2_colorYellow: 0xFFFF00,
            b2_colorYellowGreen: 0x9ACD32,
            b2_colorBox2DRed: 0xDC3132,
            b2_colorBox2DBlue: 0x30AEBF,
            b2_colorBox2DGreen: 0x8CC924,
            b2_colorBox2DYellow: 0xFFEE8C
        };

        const cache = {};
        for (const [name, hex] of Object.entries(b2HexColor)) {
            const hexString = this.colorToHTML(hex, alpha);
            cache[hex] = hexString;
        }
        return cache;
    }

    prepareCanvas() {
        this.ctx.save();
        this.ctx.scale(this.finalScale, -this.finalScale);
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.lineWidth = 1 / this.finalScale;
    }

    restoreCanvas() {
        this.ctx.restore();
    }

    processCommands(ptr, size, stride) {
        this.prepareCanvas();

        // type: 0 (uint8_t)
        // color: 4 (uint32_t)
        // vertexCount: 8 (uint16_t)
        // data: 12 (float[32])

        const { DebugDrawCommandType } = this.Module;

        for (let i = 0; i < size; i++) {
            const baseOffset = ptr + (i * stride);
            const cmd = {
                type: this.Module.HEAPU8[baseOffset],
                color: this.Module.HEAPU32[(baseOffset + 4) >> 2],  // Divide by 4 for 32-bit alignment
                vertexCount: this.Module.HEAPU16[(baseOffset + 8) >> 1], // Divide by 2 for 16-bit alignment
                data: new Float32Array(this.Module.HEAPU8.buffer, baseOffset + 12, 32)
            };

            switch (cmd.type) {
                case DebugDrawCommandType.e_polygon.value:
                    this.drawPolygon(cmd);
                    break;
                case DebugDrawCommandType.e_solidPolygon.value:
                    this.drawSolidPolygon(cmd);
                    break;
                case DebugDrawCommandType.e_circle.value:
                    this.drawCircle(cmd);
                    break;
                case DebugDrawCommandType.e_solidCircle.value:
                    this.drawSolidCircle(cmd);
                    break;
                case DebugDrawCommandType.e_solidCapsule.value:
                    this.drawSolidCapsule(cmd);
                    break;
                case DebugDrawCommandType.e_segment.value:
                    this.drawSegment(cmd);
                    break;
                case DebugDrawCommandType.e_transform.value:
                    this.drawTransform(cmd);
                    break;
                case DebugDrawCommandType.e_point.value:
                    this.drawPoint(cmd);
                    break;
                case DebugDrawCommandType.e_string.value:
                    this.drawString(cmd);
                    break;
            }
        }

        this.restoreCanvas();
    }

    toMB = (bytes) => (bytes / 1048576).toFixed(4);

    drawPolygon(cmd) {
        this.ctx.beginPath();
        for (let i = 0; i < cmd.vertexCount; i++) {
            const x = cmd.data[i*2];
            const y = cmd.data[i*2 + 1];
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.strokeStyle = this.colorToHTML(cmd.color);
        this.ctx.stroke();
    }

    drawSolidPolygon(cmd) {
        const xf = {
            p: { x: cmd.data[0], y: cmd.data[1] },
            q: { s: cmd.data[2], c: cmd.data[3] }
        };
        const radius = cmd.data[4];

        this.ctx.beginPath();
        const vertCount = cmd.vertexCount;

        if (radius <= 0) {
            for (let i = 0; i < vertCount; i++) {
                const v = this.transformPoint(xf, {
                    x: cmd.data[i*2 + 5],
                    y: cmd.data[i*2 + 6]
                });
                if (i === 0) {
                    this.ctx.moveTo(v.x, v.y);
                } else {
                    this.ctx.lineTo(v.x, v.y);
                }
            }
        } else {
            let prevPoint = null;
            let prevAngle = 0;

            for (let i = 0; i < vertCount + 2; i++) {
                const idx = i % vertCount;
                const v = this.transformPoint(xf, {
                    x: cmd.data[idx*2 + 5],
                    y: cmd.data[idx*2 + 6]
                });

                if (i !== 0) {
                    const angle = Math.atan2(v.y - prevPoint.y, v.x - prevPoint.x);
                    if (i !== 1) {
                        this.ctx.arc(prevPoint.x, prevPoint.y, radius,
                            prevAngle - Math.PI / 2,
                            angle - Math.PI / 2);
                    }
                    prevAngle = angle;
                }
                prevPoint = v;
            }
        }

        this.ctx.closePath();
        this.ctx.fillStyle = this.colorToHTML(cmd.color, 0.5);
        this.ctx.fill();
        this.ctx.strokeStyle = this.colorToHTML(cmd.color);
        this.ctx.stroke();
    }

    drawCircle(cmd) {
        this.ctx.beginPath();
        this.ctx.arc(cmd.data[0], cmd.data[1], cmd.data[2], 0, 2 * Math.PI);
        this.ctx.strokeStyle = this.colorToHTML(cmd.color);
        this.ctx.stroke();
    }

    drawSolidCircle(cmd) {
        const xf = {
            p: { x: cmd.data[0], y: cmd.data[1] },
            q: { s: cmd.data[2], c: cmd.data[3] }
        };
        const radius = cmd.data[4];

        this.ctx.beginPath();
        this.ctx.arc(xf.p.x, xf.p.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.colorToHTML(cmd.color, 0.5);
        this.ctx.fill();
        this.ctx.strokeStyle = this.colorToHTML(cmd.color);
        this.ctx.stroke();

        const p2 = {
            x: xf.p.x + radius * xf.q.c,
            y: xf.p.y + radius * xf.q.s
        };
        this.ctx.beginPath();
        this.ctx.moveTo(xf.p.x, xf.p.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
    }

    drawSolidCapsule(cmd) {
        const p1 = { x: cmd.data[0], y: cmd.data[1] };
        const p2 = { x: cmd.data[2], y: cmd.data[3] };
        const radius = cmd.data[4];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 0.001) return;

        const axis = { x: dx / length, y: dy / length };
        const angle = Math.atan2(axis.y, axis.x);

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x + radius * axis.y, p1.y - radius * axis.x);
        this.ctx.lineTo(p2.x + radius * axis.y, p2.y - radius * axis.x);
        this.ctx.arc(p2.x, p2.y, radius, angle - Math.PI/2, angle + Math.PI/2);
        this.ctx.lineTo(p1.x - radius * axis.y, p1.y + radius * axis.x);
        this.ctx.arc(p1.x, p1.y, radius, angle + Math.PI/2, angle + 3*Math.PI/2);
        this.ctx.closePath();

        this.ctx.fillStyle = this.colorToHTML(cmd.color, 0.5);
        this.ctx.fill();
        this.ctx.strokeStyle = this.colorToHTML(cmd.color);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = this.colorToHTML(cmd.color);
        this.ctx.stroke();
    }

    drawSegment(cmd) {
        this.ctx.beginPath();
        this.ctx.moveTo(cmd.data[0], cmd.data[1]);
        this.ctx.lineTo(cmd.data[2], cmd.data[3]);
        this.ctx.strokeStyle = this.colorToHTML(cmd.color);
        this.ctx.stroke();
    }

    drawTransform(cmd) {
        const xf = {
            p: { x: cmd.data[0], y: cmd.data[1] },
            q: { s: cmd.data[2], c: cmd.data[3] }
        };

        const k_axisScale = 0.2;

        const p2x = {
            x: xf.p.x + k_axisScale * xf.q.c,
            y: xf.p.y + k_axisScale * xf.q.s
        };

        this.ctx.beginPath();
        this.ctx.moveTo(xf.p.x, xf.p.y);
        this.ctx.lineTo(p2x.x, p2x.y);
        this.ctx.strokeStyle = this.colorToHTML(0xFF0000);
        this.ctx.stroke();

        const p2y = {
            x: xf.p.x - k_axisScale * xf.q.s,
            y: xf.p.y + k_axisScale * xf.q.c
        };

        this.ctx.beginPath();
        this.ctx.moveTo(xf.p.x, xf.p.y);
        this.ctx.lineTo(p2y.x, p2y.y);
        this.ctx.strokeStyle = this.colorToHTML(0x00FF00);
        this.ctx.stroke();
    }

    drawPoint(cmd) {
        this.ctx.beginPath();
        this.ctx.arc(cmd.data[0], cmd.data[1], (cmd.data[2]/2) / this.finalScale, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.colorToHTML(cmd.color);
        this.ctx.fill();
    }

    drawString(cmd) {
        let text = '';
        const x = cmd.data[0];
        const y = cmd.data[1];

        for (let i = 2; i < 32; i++) {
            const code = cmd.data[i];
            if (code <= 0) break;
            const char = String.fromCharCode(Math.round(code));
            text += char;
        }

        const fontSize = 12 * this.dpr;

        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.fillStyle = 'rgb(230, 230, 230)';

        const screenX = (x + this.offset.x) * this.finalScale;
        const screenY = (-y - this.offset.y) * this.finalScale;

        this.ctx.fillText(text, screenX, screenY);
        this.ctx.restore();
    }

    drawMemoryUsage() {
        const fontSize = 12 * this.dpr;
        const padding = 6 * this.dpr;

        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.fillStyle = 'rgba(230, 230, 230, 1)';

        const memoryStats = this.Module.GetMemoryStats();

        const allocated = `${this.toMB(memoryStats.allocatedSpace)} MB`;
        const free = `${this.toMB(memoryStats.freeSpace)} MB`;
        const total = `${this.toMB(memoryStats.totalSpace)} MB`;

        let maxWidth = 0;
        [allocated, free, total].forEach((text) => {
            const width = this.ctx.measureText(text).width;
            maxWidth = Math.max(maxWidth, width);
        });

        const lines = 4;

        const x = this.ctx.canvas.width - padding;
        let y = this.ctx.canvas.height - fontSize * lines + fontSize / 2;

        const allocatedText = 'Allocated:';
        const allocatedSize = this.ctx.measureText(allocatedText).width;

        const totalWidth = maxWidth + padding + allocatedSize;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(x - totalWidth - padding, y - fontSize, totalWidth + padding * 2, fontSize * lines + padding);

        const currentAlign = this.ctx.textAlign;

        this.ctx.fillStyle = 'rgba(160, 160, 160, 1)';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('WASM Memory', x, y);
        this.ctx.fillStyle = 'rgba(230, 230, 230, 1)';
        y += fontSize;
        this.ctx.fillText(allocated, x, y);
        this.ctx.fillText(allocatedText, x-maxWidth - padding, y);
        y += fontSize;
        this.ctx.fillText(free, x, y);
        this.ctx.fillText('Free:', x-maxWidth - padding, y);
        y += fontSize;
        this.ctx.fillText(total, x, y);
        this.ctx.fillText('Total:', x-maxWidth - padding, y);

        this.ctx.textAlign = currentAlign;
    }

    colorToHTML(color, alpha = 1.0) {
        if (this.colorCache[alpha] && this.colorCache[alpha][color]) {
            return this.colorCache[alpha][color];
        }

        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        return `rgba(${r},${g},${b},${alpha})`;
    }

    transformPoint(xf, v) {
        return {
            x: xf.p.x + xf.q.c * v.x - xf.q.s * v.y,
            y: xf.p.y + xf.q.s * v.x + xf.q.c * v.y
        };
    }

    SetFlags(flags) {
        const debugDraw = this.debugDrawCommandBuffer.GetDebugDraw();
        for (const [key, value] of Object.entries(flags)) {
            debugDraw[key] = value;
        }
    }

    Draw(worldId, camera) {
        if (camera) {
            this.ctx.canvas.width = camera.width * this.dpr;
            this.ctx.canvas.height = camera.height * this.dpr;
            this.ctx.canvas.style.width = `${camera.width}px`;
            this.ctx.canvas.style.height = `${camera.height}px`;

            const transform = camera.getTransform();
            this.baseScale = transform.scale.x;
            this.finalScale = this.baseScale * this.dpr;
            this.offset.x = transform.offset.x;
            this.offset.y = transform.offset.y;
        } else {
            const clientWidth = this.ctx.canvas.clientWidth;
            const clientHeight = this.ctx.canvas.clientHeight;

            this.ctx.canvas.width = clientWidth * this.dpr;
            this.ctx.canvas.height = clientHeight * this.dpr;
            this.ctx.canvas.style.width = `${clientWidth}px`;
            this.ctx.canvas.style.height = `${clientHeight}px`;
        }

        this.Module.b2World_Draw(worldId, this.debugDrawCommandBuffer.GetDebugDraw());
        const commandsPtr = this.debugDrawCommandBuffer.GetCommandsData();
        const commandsSize = this.debugDrawCommandBuffer.GetCommandsSize();
        const commandStride = this.debugDrawCommandBuffer.GetCommandStride();
        this.processCommands(commandsPtr, commandsSize, commandStride);
        this.debugDrawCommandBuffer.ClearCommands();

        if(this.debugMemory) this.drawMemoryUsage();
    }
}
