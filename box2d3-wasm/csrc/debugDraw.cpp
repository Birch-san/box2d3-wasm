#include <emscripten/val.h>
#include <emscripten/bind.h>
#include <vector>
#include <box2d/box2d.h>

enum DebugDrawCommandType {
    e_polygon = 0,
    e_solidPolygon = 1,
    e_circle = 2,
    e_solidCircle = 3,
    e_solidCapsule = 4,
    e_segment = 5,
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
        debugDraw.context = this;
        commands.reserve(maxCommands);

        debugDraw.drawShapes = true;
        debugDraw.drawJoints = true;
        debugDraw.drawJointExtras = false;
        debugDraw.drawAABBs = false;
        debugDraw.drawMass = false;
        debugDraw.drawContacts = false;
        debugDraw.drawGraphColors = false;
        debugDraw.drawContactNormals = false;
        debugDraw.drawContactImpulses = false;
        debugDraw.drawFrictionImpulses = false;
        debugDraw.useDrawingBounds = false;

        debugDraw.DrawPolygon = [](const b2Vec2* vertices, int vertexCount, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_polygon;
            cmd.color = color;
            cmd.vertexCount = std::min((uint16_t)vertexCount, (uint16_t)(COMMAND_DATA_SIZE / 2));

            for (int i = 0; i < cmd.vertexCount; i++) {
                cmd.data[i*2] = vertices[i].x;
                cmd.data[i*2+1] = vertices[i].y;
            }

            self->commands.push_back(cmd);
        };

        debugDraw.DrawSolidPolygon = [](b2Transform transform, const b2Vec2* vertices, int vertexCount, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_solidPolygon;
            cmd.color = color;

            const uint16_t maxVertices = (COMMAND_DATA_SIZE - 5) / 2; // reserve 4 floats for transform + 1 for radius
            cmd.vertexCount = std::min((uint16_t)vertexCount, maxVertices);

            cmd.data[0] = transform.p.x;
            cmd.data[1] = transform.p.y;
            cmd.data[2] = transform.q.s;
            cmd.data[3] = transform.q.c;
            cmd.data[4] = radius;

            for (int i = 0; i < cmd.vertexCount; i++) {
                cmd.data[i*2 + 5] = vertices[i].x;
                cmd.data[i*2 + 6] = vertices[i].y;
            }

            self->commands.push_back(cmd);
        };

        debugDraw.DrawCircle = [](b2Vec2 center, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_circle;
            cmd.color = color;
            cmd.vertexCount = 1;
            cmd.data[0] = center.x;
            cmd.data[1] = center.y;
            cmd.data[2] = radius;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawSolidCircle = [](b2Transform transform, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_solidCircle;
            cmd.color = color;
            cmd.vertexCount = 1;
            cmd.data[0] = transform.p.x;
            cmd.data[1] = transform.p.y;
            cmd.data[2] = transform.q.s;
            cmd.data[3] = transform.q.c;
            cmd.data[4] = radius;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawSolidCapsule = [](b2Vec2 p1, b2Vec2 p2, float radius, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_solidCapsule;
            cmd.color = color;
            cmd.vertexCount = 2;
            cmd.data[0] = p1.x;
            cmd.data[1] = p1.y;
            cmd.data[2] = p2.x;
            cmd.data[3] = p2.y;
            cmd.data[4] = radius;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawSegment = [](b2Vec2 p1, b2Vec2 p2, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_segment;
            cmd.color = color;
            cmd.vertexCount = 2;
            cmd.data[0] = p1.x;
            cmd.data[1] = p1.y;
            cmd.data[2] = p2.x;
            cmd.data[3] = p2.y;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawTransform = [](b2Transform transform, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_transform;
            cmd.vertexCount = 1;
            cmd.data[0] = transform.p.x;
            cmd.data[1] = transform.p.y;
            cmd.data[2] = transform.q.s;
            cmd.data[3] = transform.q.c;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawPoint = [](b2Vec2 p, float size, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_point;
            cmd.color = color;
            cmd.vertexCount = 1;
            cmd.data[0] = p.x;
            cmd.data[1] = p.y;
            cmd.data[2] = size;

            self->commands.push_back(cmd);
        };

        debugDraw.DrawString = [](b2Vec2 p, const char* s, b2HexColor color, void* context) {
            auto* self = static_cast<DebugDrawCommandBuffer*>(context);
            if (self->commands.size() >= self->maxCommands) return;

            DebugDrawCommand cmd;
            cmd.commandType = DebugDrawCommandType::e_string;
            cmd.color = color;
            cmd.vertexCount = 1;

            cmd.data[0] = p.x;
            cmd.data[1] = p.y;

            std::string_view sv(s);
            auto dst = std::transform(sv.begin(),
                                   sv.begin() + std::min(sv.length(), size_t(COMMAND_DATA_SIZE - 2)),
                                   cmd.data + 2,
                                   [](char c) { return static_cast<float>(std::byte(c)); });

            self->commands.push_back(cmd);
        };
    }

    b2DebugDraw* GetDebugDraw() { return &debugDraw; }
    void ClearCommands() { commands.clear(); }
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
        ;

    emscripten::enum_<DebugDrawCommandType>("DebugDrawCommandType")
        .value("e_polygon", DebugDrawCommandType::e_polygon)
        .value("e_solidPolygon", DebugDrawCommandType::e_solidPolygon)
        .value("e_circle", DebugDrawCommandType::e_circle)
        .value("e_solidCircle", DebugDrawCommandType::e_solidCircle)
        .value("e_solidCapsule", DebugDrawCommandType::e_solidCapsule)
        .value("e_segment", DebugDrawCommandType::e_segment)
        .value("e_transform", DebugDrawCommandType::e_transform)
        .value("e_point", DebugDrawCommandType::e_point)
        .value("e_string", DebugDrawCommandType::e_string)
        ;
}
