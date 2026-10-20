#include <emscripten/val.h>
#include <emscripten/bind.h>
#include <vector>
#include <box2d/box2d.h>
#include <box2d/math_functions.h>
#include <algorithm>
#include <string_view>

enum DebugDrawCommandType {
    e_polygon = 0,
    e_solidPolygon = 1,
    e_circle = 2,
    e_solidCircle = 3,
    e_solidCapsule = 4,
    e_line = 5,
    e_transform = 6,
    e_point = 7,
    e_string = 8,
};

static constexpr size_t COMMAND_DATA_SIZE = 32;

struct DebugDrawCommand {
    uint8_t commandType;
    uint32_t color;
    uint16_t vertexCount;
    float data[COMMAND_DATA_SIZE];
};

class DebugDrawCommandBuffer {
public:
    DebugDrawCommandBuffer(size_t maxCommands = 10000) : maxCommands(maxCommands) {
        // Box2D v3.2 always clips against drawingBounds, so start from its defaults (unbounded).
        debugDraw = b2DefaultDebugDraw();
        debugDraw.context = this;
        commands.reserve(maxCommands);

        debugDraw.drawShapes = true;
        debugDraw.drawJoints = true;

        // Polygon outlines arrive in local space; emit world space vertices so the renderer stays simple.
        debugDraw.DrawPolygonFcn = [](b2WorldTransform transform, const b2Vec2* vertices, int vertexCount, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_polygon;
            cmd.color = color;
            cmd.vertexCount = std::min((uint16_t)vertexCount, (uint16_t)(COMMAND_DATA_SIZE / 2));

            for (int i = 0; i < cmd.vertexCount; i++) {
                b2Pos p = b2TransformWorldPoint(transform, vertices[i]);
                cmd.data[i*2] = self->RelX(p.x);
                cmd.data[i*2+1] = self->RelY(p.y);
            }

            self->commands.push_back(cmd);
        };

        debugDraw.DrawSolidPolygonFcn = [](b2WorldTransform transform, const b2Vec2* vertices, int vertexCount, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_solidPolygon;
            cmd.color = color;

            const uint16_t maxVertices = (COMMAND_DATA_SIZE - 5) / 2; // reserve 4 floats for transform + 1 for radius
            cmd.vertexCount = std::min((uint16_t)vertexCount, maxVertices);

            cmd.data[0] = self->RelX(transform.p.x);
            cmd.data[1] = self->RelY(transform.p.y);
            cmd.data[2] = transform.q.s;
            cmd.data[3] = transform.q.c;
            cmd.data[4] = radius;

            for (int i = 0; i < cmd.vertexCount; i++) {
                cmd.data[i*2 + 5] = vertices[i].x;
                cmd.data[i*2 + 6] = vertices[i].y;
            }

            self->commands.push_back(cmd);
        };

        debugDraw.DrawCircleFcn = [](b2Pos center, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_circle;
            cmd.color = color;
            cmd.vertexCount = 1;
            cmd.data[0] = self->RelX(center.x);
            cmd.data[1] = self->RelY(center.y);
            cmd.data[2] = radius;

            self->commands.push_back(cmd);
        };

        // The circle center is local to the transform; emit it in world space with the body rotation.
        debugDraw.DrawSolidCircleFcn = [](b2WorldTransform transform, b2Vec2 center, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            b2Pos worldCenter = b2TransformWorldPoint(transform, center);

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_solidCircle;
            cmd.color = color;
            cmd.vertexCount = 1;
            cmd.data[0] = self->RelX(worldCenter.x);
            cmd.data[1] = self->RelY(worldCenter.y);
            cmd.data[2] = transform.q.s;
            cmd.data[3] = transform.q.c;
            cmd.data[4] = radius;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawSolidCapsuleFcn = [](b2Pos p1, b2Pos p2, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_solidCapsule;
            cmd.color = color;
            cmd.vertexCount = 2;
            cmd.data[0] = self->RelX(p1.x);
            cmd.data[1] = self->RelY(p1.y);
            cmd.data[2] = self->RelX(p2.x);
            cmd.data[3] = self->RelY(p2.y);
            cmd.data[4] = radius;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawLineFcn = [](b2Pos p1, b2Pos p2, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_line;
            cmd.color = color;
            cmd.vertexCount = 2;
            cmd.data[0] = self->RelX(p1.x);
            cmd.data[1] = self->RelY(p1.y);
            cmd.data[2] = self->RelX(p2.x);
            cmd.data[3] = self->RelY(p2.y);

            self->commands.push_back(cmd);
        };

        debugDraw.DrawTransformFcn = [](b2WorldTransform transform, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_transform;
            cmd.vertexCount = 1;
            cmd.data[0] = self->RelX(transform.p.x);
            cmd.data[1] = self->RelY(transform.p.y);
            cmd.data[2] = transform.q.s;
            cmd.data[3] = transform.q.c;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawPointFcn = [](b2Pos p, float size, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_point;
            cmd.color = color;
            cmd.vertexCount = 1;
            cmd.data[0] = self->RelX(p.x);
            cmd.data[1] = self->RelY(p.y);
            cmd.data[2] = size;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawStringFcn = [](b2Pos p, const char* s, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_string;
            cmd.color = color;
            cmd.vertexCount = 1;

            cmd.data[0] = self->RelX(p.x);
            cmd.data[1] = self->RelY(p.y);

            std::string_view sv(s);
            auto dst = std::transform(sv.begin(),
                                   sv.begin() + std::min(sv.length(), size_t(COMMAND_DATA_SIZE - 2)),
                                   cmd.data + 2,
                                   [](char c) { return static_cast<float>(std::byte(c)); });

            self->commands.push_back(cmd);
        };

        // Bounds are drawn as a closed polygon outline.
        debugDraw.DrawBoundsFcn = [](b2AABB aabb, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_polygon;
            cmd.color = color;
            cmd.vertexCount = 4;
            cmd.data[0] = self->RelX(aabb.lowerBound.x);
            cmd.data[1] = self->RelY(aabb.lowerBound.y);
            cmd.data[2] = self->RelX(aabb.upperBound.x);
            cmd.data[3] = self->RelY(aabb.lowerBound.y);
            cmd.data[4] = self->RelX(aabb.upperBound.x);
            cmd.data[5] = self->RelY(aabb.upperBound.y);
            cmd.data[6] = self->RelX(aabb.lowerBound.x);
            cmd.data[7] = self->RelY(aabb.upperBound.y);

            self->commands.push_back(cmd);
        };
    }

    b2DebugDraw* GetDebugDraw() { return &debugDraw; }
    void ClearCommands() { commands.clear(); }

    // World positions are emitted relative to this origin. Set it near the camera, so positions far
    // from the world origin keep their precision when they are narrowed to floats (large worlds).
    void SetOrigin(double x, double y) {
        originX = x;
        originY = y;
    }
    double GetOriginX() const { return originX; }
    double GetOriginY() const { return originY; }

    float RelX(double x) const { return static_cast<float>(x - originX); }
    float RelY(double y) const { return static_cast<float>(y - originY); }
    size_t GetMaxCommands() const { return maxCommands; }

    uintptr_t GetCommandsData() const {
        return reinterpret_cast<uintptr_t>(commands.data());
    }

    size_t GetCommandsSize() const {
        return commands.size();
    }

    size_t GetCommandStride() const {
        return sizeof(DebugDrawCommand);
    }

private:
    b2DebugDraw debugDraw;
    std::vector<DebugDrawCommand> commands;
    size_t maxCommands;
    double originX = 0.0;
    double originY = 0.0;
};

EMSCRIPTEN_BINDINGS(debug_draw_buffer) {
    emscripten::class_<DebugDrawCommandBuffer>("DebugDrawCommandBuffer")
        .constructor()
        .constructor<size_t>()
        .function("GetDebugDraw", &DebugDrawCommandBuffer::GetDebugDraw, emscripten::allow_raw_pointers())
        .function("GetCommandsData", &DebugDrawCommandBuffer::GetCommandsData)
        .function("GetCommandsSize", &DebugDrawCommandBuffer::GetCommandsSize)
        .function("GetCommandStride", &DebugDrawCommandBuffer::GetCommandStride)
        .function("ClearCommands", &DebugDrawCommandBuffer::ClearCommands)
        .function("SetOrigin", &DebugDrawCommandBuffer::SetOrigin)
        .function("GetOriginX", &DebugDrawCommandBuffer::GetOriginX)
        .function("GetOriginY", &DebugDrawCommandBuffer::GetOriginY)
        ;

    emscripten::enum_<DebugDrawCommandType>("DebugDrawCommandType")
        .value("e_polygon", DebugDrawCommandType::e_polygon)
        .value("e_solidPolygon", DebugDrawCommandType::e_solidPolygon)
        .value("e_circle", DebugDrawCommandType::e_circle)
        .value("e_solidCircle", DebugDrawCommandType::e_solidCircle)
        .value("e_solidCapsule", DebugDrawCommandType::e_solidCapsule)
        .value("e_line", DebugDrawCommandType::e_line)
        .value("e_transform", DebugDrawCommandType::e_transform)
        .value("e_point", DebugDrawCommandType::e_point)
        .value("e_string", DebugDrawCommandType::e_string)
        ;
}
