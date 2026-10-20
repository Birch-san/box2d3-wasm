#include <box2d/box2d.h>
#include <box2d/math_functions.h>
#include <box2cpp/box2cpp.h>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <malloc.h>

using namespace emscripten;
using namespace b2;

template<typename T>
struct GetInterfaceType;

template<>
struct GetInterfaceType<Body> {
    using type = BasicBodyInterface<Body, false>;
};

template<>
struct GetInterfaceType<Shape> {
    using type = BasicShapeInterface<Shape, false>;
};

template<>
struct GetInterfaceType<Joint> {
    using type = BasicJointInterface<Joint, false>;
};

template<typename T, typename ObjectType>
emscripten::val getArrayWrapper(const ObjectType& object,
    int (GetInterfaceType<ObjectType>::type::*getCount)() const,
    int (GetInterfaceType<ObjectType>::type::*getData)(T*, int) const) {

    int capacity = (object.*getCount)();
    if (capacity == 0) return emscripten::val::array();

    std::vector<T> items(capacity);
    int count = (object.*getData)(items.data(), capacity);

    auto result = emscripten::val::array();
    for (int i = 0; i < count; i++) {
        result.set(i, items[i]);
    }
    return result;
}

// User data pointers are exposed to JS as plain integers (0 to 2^32 - 1), which is enough to
// store an index or key into a JS-side lookup table. 0 means "no user data".
inline double userDataToNumber(const void* userData) {
    return static_cast<double>(reinterpret_cast<uintptr_t>(userData));
}

inline void* numberToUserData(double value) {
    return reinterpret_cast<void*>(static_cast<uintptr_t>(value));
}

template<typename T>
emscripten::val toBytes(const T& value) {
    auto array = emscripten::val::global("Uint8Array").new_(sizeof(T));
    const uint8_t* bytes = reinterpret_cast<const uint8_t*>(&value);
    for (size_t i = 0; i < sizeof(T); i++) {
        array.set(i, bytes[i]);
    }
    return array;
}

EMSCRIPTEN_BINDINGS(box2dcpp) {
    class_<b2Vec2>("b2Vec2")
        .constructor()
        .constructor(+[](float x, float y) -> b2Vec2 { return b2Vec2{x, y}; })
        .property("x", &b2Vec2::x)
        .property("y", &b2Vec2::y)
        .function("Set", +[](b2Vec2& self, float x, float y) -> b2Vec2& {
            self.x = x;
            self.y = y;
            return self;
        }, return_value_policy::reference())
        .function("Copy", +[](b2Vec2& self, const b2Vec2& other) -> b2Vec2& {
            self.x = other.x;
            self.y = other.y;
            return self;
        }, return_value_policy::reference())
        .function("Clone", +[](const b2Vec2& self) -> b2Vec2 {
            return b2Vec2{self.x, self.y};
        })
        .function("Add", +[](b2Vec2& self, const b2Vec2& other) -> b2Vec2& {
            self.x += other.x;
            self.y += other.y;
            return self;
        }, return_value_policy::reference())
        .function("Sub", +[](b2Vec2& self, const b2Vec2& other) -> b2Vec2& {
            self.x -= other.x;
            self.y -= other.y;
            return self;
        }, return_value_policy::reference())
        .function("Mul", +[](b2Vec2& self, const b2Vec2& other) -> b2Vec2& {
            self.x *= other.x;
            self.y *= other.y;
            return self;
        }, return_value_policy::reference())
        .function("MulSV", +[](b2Vec2& self, float s) -> b2Vec2& {
            self.x *= s;
            self.y *= s;
            return self;
        }, return_value_policy::reference())
        ;
    constant("b2Vec2_zero", b2Vec2_zero);

    class_<b2CosSin>("b2CosSin")
        .constructor()
        .property("cosine", &b2CosSin::cosine)
        .property("sine", &b2CosSin::sine)
        ;

    class_<b2Rot>("b2Rot")
        .constructor()
        .property("c", &b2Rot::c)
        .property("s", &b2Rot::s)
        .function("SetAngle", +[](b2Rot& self, float angle) {
            self.s = sinf(angle);
            self.c = cosf(angle);
        })
        .function("GetAngle", +[](const b2Rot& self) -> float {
            return b2Atan2(self.s, self.c);
        })
        ;

    constant("b2Rot_identity", b2Rot_identity);

    class_<b2Transform>("b2Transform")
        .constructor()
        .property("p", &b2Transform::p, return_value_policy::reference())
        .property("q", &b2Transform::q, return_value_policy::reference())
        .function("ToBytes", +[](const b2Transform& self) -> emscripten::val {
            return toBytes(self);
        });
        ;

#if defined( BOX2D_DOUBLE_PRECISION )
    // Large world types, positions are doubles. In single precision these are aliases of b2Vec2,
    // b2Transform and b2CastOutput, and entry.mjs exposes those under these names as well.
    class_<b2Pos>("b2Pos")
        .constructor()
        .constructor(+[](double x, double y) -> b2Pos { return b2Pos{x, y}; })
        .property("x", &b2Pos::x)
        .property("y", &b2Pos::y)
        .function("Set", +[](b2Pos& self, double x, double y) -> b2Pos& {
            self.x = x;
            self.y = y;
            return self;
        }, return_value_policy::reference())
        .function("Copy", +[](b2Pos& self, const b2Pos& other) -> b2Pos& {
            self = other;
            return self;
        }, return_value_policy::reference())
        .function("Clone", +[](const b2Pos& self) -> b2Pos {
            return self;
        })
        .function("Add", +[](b2Pos& self, const b2Pos& other) -> b2Pos& {
            self.x += other.x;
            self.y += other.y;
            return self;
        }, return_value_policy::reference())
        .function("Sub", +[](b2Pos& self, const b2Pos& other) -> b2Pos& {
            self.x -= other.x;
            self.y -= other.y;
            return self;
        }, return_value_policy::reference())
        ;

    class_<b2WorldTransform>("b2WorldTransform")
        .constructor()
        .property("p", &b2WorldTransform::p, return_value_policy::reference())
        .property("q", &b2WorldTransform::q, return_value_policy::reference())
        .function("ToBytes", +[](const b2WorldTransform& self) -> emscripten::val {
            return toBytes(self);
        })
        ;

    class_<b2WorldCastOutput>("b2WorldCastOutput")
        .constructor()
        .property("normal", &b2WorldCastOutput::normal, return_value_policy::reference())
        .property("point", &b2WorldCastOutput::point, return_value_policy::reference())
        .property("fraction", &b2WorldCastOutput::fraction)
        .property("iterations", &b2WorldCastOutput::iterations)
        .property("hit", &b2WorldCastOutput::hit)
        ;
#endif
    constant("b2WorldTransform_identity", b2WorldTransform_identity);

    class_<b2Mat22>("b2Mat22")
        .constructor()
        .property("cx", &b2Mat22::cx, return_value_policy::reference())
        .property("cy", &b2Mat22::cy, return_value_policy::reference())
        ;

    class_<b2AABB>("b2AABB")
        .constructor()
        .property("lowerBound", &b2AABB::lowerBound, return_value_policy::reference())
        .property("upperBound", &b2AABB::upperBound, return_value_policy::reference())
        ;

    class_<b2Hull>("b2Hull")
    .constructor()
    .property("count", &b2Hull::count)
    .function("getPoint", optional_override([](const b2Hull& hull, int index) {
        if (index >= 0 && index < hull.count) {
            return hull.points[index];
        }
        return b2Vec2();
    }))
    ;

    class_<b2WorldDef>("b2WorldDef")
        .constructor()
        .constructor<const b2WorldDef&>()
        .property("gravity", &b2WorldDef::gravity, return_value_policy::reference())
        .property("restitutionThreshold", &b2WorldDef::restitutionThreshold)
        .property("restitutionIterations", &b2WorldDef::restitutionIterations)
        .property("enableRestitutionPropagation", &b2WorldDef::enableRestitutionPropagation)
        .property("hitEventThreshold", &b2WorldDef::hitEventThreshold)
        .property("contactHertz", &b2WorldDef::contactHertz)
        .property("contactDampingRatio", &b2WorldDef::contactDampingRatio)
        .property("contactSpeed", &b2WorldDef::contactSpeed)
        .property("maximumLinearSpeed", &b2WorldDef::maximumLinearSpeed)
        .property("enableSleep", &b2WorldDef::enableSleep)
        .property("enableContinuous", &b2WorldDef::enableContinuous)
        .property("workerCount", &b2WorldDef::workerCount)
        // we do not assign threading callbacks here, we leave this in the C++ code
        .property("capacity", &b2WorldDef::capacity, return_value_policy::reference())
        .property("internalValue", &b2WorldDef::internalValue)
        ;

    class_<b2Capacity>("b2Capacity")
        .constructor()
        .property("staticShapeCount", &b2Capacity::staticShapeCount)
        .property("dynamicShapeCount", &b2Capacity::dynamicShapeCount)
        .property("staticBodyCount", &b2Capacity::staticBodyCount)
        .property("dynamicBodyCount", &b2Capacity::dynamicBodyCount)
        .property("contactCount", &b2Capacity::contactCount)
        .property("arenaByteCount", &b2Capacity::arenaByteCount)
        ;

    value_object<b2BodyId>("b2BodyId")
        .field("index1", &b2BodyId::index1)
        .field("world0", &b2BodyId::world0)
        .field("generation", &b2BodyId::generation)
        ;


    value_object<b2ShapeId>("b2ShapeId")
        .field("index1", &b2ShapeId::index1)
        .field("world0", &b2ShapeId::world0)
        .field("generation", &b2ShapeId::generation)
        ;

    value_object<b2WorldId>("b2WorldId")
        .field("index1", &b2WorldId::index1)
        .field("generation", &b2WorldId::generation)
        ;

    value_object<b2ContactId>("b2ContactId")
        .field("index1", &b2ContactId::index1)
        .field("world0", &b2ContactId::world0)
        .field("padding", &b2ContactId::padding)
        .field("generation", &b2ContactId::generation)
        ;

    class_<b2CastOutput>("b2CastOutput")
        .constructor()
        .property("normal", &b2CastOutput::normal, return_value_policy::reference())
        .property("point", &b2CastOutput::point, return_value_policy::reference())
        .property("fraction", &b2CastOutput::fraction)
        .property("iterations", &b2CastOutput::iterations)
        .property("hit", &b2CastOutput::hit)
        ;

    class_<b2RayCastInput>("b2RayCastInput")
        .constructor()
        .property("origin", &b2RayCastInput::origin, return_value_policy::reference())
        .property("translation", &b2RayCastInput::translation, return_value_policy::reference())
        .property("maxFraction", &b2RayCastInput::maxFraction)
        ;

    class_<b2ShapeCastInput>("b2ShapeCastInput")
        .constructor()
        .property("proxy", &b2ShapeCastInput::proxy, return_value_policy::reference())
        .property("translation", &b2ShapeCastInput::translation, return_value_policy::reference())
        .property("maxFraction", &b2ShapeCastInput::maxFraction)
        .property("canEncroach", &b2ShapeCastInput::canEncroach)
        ;

    class_<b2SimplexCache>("b2SimplexCache")
        .constructor()
        .property("count", &b2SimplexCache::count)
        ;

    class_<b2DistanceInput>("b2DistanceInput")
        .constructor()
        .property("proxyA", &b2DistanceInput::proxyA, return_value_policy::reference())
        .property("proxyB", &b2DistanceInput::proxyB, return_value_policy::reference())
        .property("transform", &b2DistanceInput::transform, return_value_policy::reference())
        .property("useRadii", &b2DistanceInput::useRadii)
        ;

    class_<b2DistanceOutput>("b2DistanceOutput")
        .constructor()
        .property("pointA", &b2DistanceOutput::pointA, return_value_policy::reference())
        .property("pointB", &b2DistanceOutput::pointB, return_value_policy::reference())
        .property("normal", &b2DistanceOutput::normal, return_value_policy::reference())
        .property("distance", &b2DistanceOutput::distance)
        .property("iterations", &b2DistanceOutput::iterations)
        .property("simplexCount", &b2DistanceOutput::simplexCount)
        ;

    class_<b2ShapeCastPairInput>("b2ShapeCastPairInput")
        .constructor()
        .property("proxyA", &b2ShapeCastPairInput::proxyA, return_value_policy::reference())
        .property("proxyB", &b2ShapeCastPairInput::proxyB, return_value_policy::reference())
        .property("transform", &b2ShapeCastPairInput::transform, return_value_policy::reference())
        .property("translationB", &b2ShapeCastPairInput::translationB, return_value_policy::reference())
        .property("maxFraction", &b2ShapeCastPairInput::maxFraction)
        .property("canEncroach", &b2ShapeCastPairInput::canEncroach)
        ;

    class_<b2SegmentDistanceResult>("b2SegmentDistanceResult")
        .constructor()
        .property("closest1", &b2SegmentDistanceResult::closest1, return_value_policy::reference())
        .property("closest2", &b2SegmentDistanceResult::closest2, return_value_policy::reference())
        .property("fraction1", &b2SegmentDistanceResult::fraction1)
        .property("fraction2", &b2SegmentDistanceResult::fraction2)
        .property("distanceSquared", &b2SegmentDistanceResult::distanceSquared)
        ;

    // The GJK debug simplexes are not exposed. The cache may be null.
    function("b2ComputeShapeDistance", +[](const b2DistanceInput& input, b2SimplexCache* cache) -> b2DistanceOutput {
        b2SimplexCache localCache = {};
        return b2ComputeShapeDistance(&input, cache != nullptr ? cache : &localCache, nullptr, 0);
    }, allow_raw_pointers());
    function("b2ComputeSegmentDistance", &b2ComputeSegmentDistance);
    function("b2CastShape", &b2CastShape, allow_raw_pointers());

    class_<b2ManifoldPoint>("b2ManifoldPoint")
        .constructor()
        .property("anchorA", &b2ManifoldPoint::anchorA, return_value_policy::reference())
        .property("anchorB", &b2ManifoldPoint::anchorB, return_value_policy::reference())
        .property("separation", &b2ManifoldPoint::separation)
        .property("normalImpulse", &b2ManifoldPoint::normalImpulse)
        .property("tangentImpulse", &b2ManifoldPoint::tangentImpulse)
        .property("totalNormalImpulse", &b2ManifoldPoint::totalNormalImpulse)
        .property("normalVelocity", &b2ManifoldPoint::normalVelocity)
        .property("baseSeparation", &b2ManifoldPoint::baseSeparation)
        .property("id", &b2ManifoldPoint::id)
        .property("persisted", &b2ManifoldPoint::persisted)
        ;

    class_<b2Manifold>("b2Manifold")
        .constructor()
        .function("GetPoint", +[](const b2Manifold& self, int index) -> b2ManifoldPoint {
            return self.points[index];
        })
        .function("SetPoint", +[](b2Manifold& self, int index, const b2ManifoldPoint& point) {
            self.points[index] = point;
        })
        .property("normal", &b2Manifold::normal, return_value_policy::reference())
        .property("rollingImpulse", &b2Manifold::rollingImpulse)
        .property("pointCount", &b2Manifold::pointCount)
        ;

    class_<b2Counters>("b2Counters")
        .constructor()
        .property("bodyCount", &b2Counters::bodyCount)
        .property("shapeCount", &b2Counters::shapeCount)
        .property("contactCount", &b2Counters::contactCount)
        .property("jointCount", &b2Counters::jointCount)
        .property("islandCount", &b2Counters::islandCount)
        .property("stackUsed", &b2Counters::stackUsed)
        .property("staticTreeHeight", &b2Counters::staticTreeHeight)
        .property("treeHeight", &b2Counters::treeHeight)
        .property("byteCount", &b2Counters::byteCount)
        .property("taskCount", &b2Counters::taskCount)
        .property("awakeContactCount", &b2Counters::awakeContactCount)
        .property("recycledContactCount", &b2Counters::recycledContactCount)
        .function("GetColorCount", +[](const b2Counters& self, int index) -> int {
            if (index < 0 || index >= B2_GRAPH_COLOR_COUNT) {
                return 0;  // Return 0 for out of bounds
            }
            return self.colorCounts[index];
        })
        .function("SetColorCount", +[](b2Counters& self, int index, int value) {
            if (index >= 0 && index < B2_GRAPH_COLOR_COUNT) {
                self.colorCounts[index] = value;
            }
        })
        ;
    constant("B2_GRAPH_COLOR_COUNT", B2_GRAPH_COLOR_COUNT);

    value_object<b2SensorBeginTouchEvent>("b2SensorBeginTouchEvent")
        .field("sensorShapeId", &b2SensorBeginTouchEvent::sensorShapeId)
        .field("visitorShapeId", &b2SensorBeginTouchEvent::visitorShapeId)
        ;

    value_object<b2SensorEndTouchEvent>("b2SensorEndTouchEvent")
        .field("sensorShapeId", &b2SensorEndTouchEvent::sensorShapeId)
        .field("visitorShapeId", &b2SensorEndTouchEvent::visitorShapeId)
        ;

    class_<b2SensorEvents>("b2SensorEvents")
        .constructor()
        .function("GetBeginEvent", +[](const b2SensorEvents& events, int index) {
            return events.beginEvents[index];
        })
        .function("GetEndEvent", +[](const b2SensorEvents& events, int index) {
            return events.endEvents[index];
        })
        .property("beginCount", &b2SensorEvents::beginCount)
        .property("endCount", &b2SensorEvents::endCount)
        ;

    class_<b2BodyEvents>("b2BodyEvents")
        .constructor()
        .function("GetMoveEvent", +[](const b2BodyEvents& events, int index) {
            return events.moveEvents[index];
        })
        .property("moveCount", &b2BodyEvents::moveCount)
        ;

    class_<b2BodyMoveEvent>("b2BodyMoveEvent")
        .property("userData", +[](const b2BodyMoveEvent& self) { return userDataToNumber(self.userData); })
        .property("transform", &b2BodyMoveEvent::transform, return_value_policy::reference())
        .property("bodyId", &b2BodyMoveEvent::bodyId)
        .property("fellAsleep", &b2BodyMoveEvent::fellAsleep)
        ;

     class_<b2ContactEvents>("b2ContactEvents")
        .constructor()
        .property("beginCount", &b2ContactEvents::beginCount)
        .property("endCount", &b2ContactEvents::endCount)
        .property("hitCount", &b2ContactEvents::hitCount)
        .function("GetBeginEvent", +[](const b2ContactEvents& events, int index) {
            return events.beginEvents[index];
        })
        .function("GetEndEvent", +[](const b2ContactEvents& events, int index) {
            return events.endEvents[index];
        })
        .function("GetHitEvent", +[](const b2ContactEvents& events, int index) {
            return events.hitEvents[index];
        })
        ;

    class_<b2ContactBeginTouchEvent>("b2ContactBeginTouchEvent")
        .property("shapeIdA", &b2ContactBeginTouchEvent::shapeIdA)
        .property("shapeIdB", &b2ContactBeginTouchEvent::shapeIdB)
        .property("contactId", &b2ContactBeginTouchEvent::contactId)
    ;

    class_<b2ContactData>("b2ContactData")
        .property("contactId", &b2ContactData::contactId)
        .property("shapeIdA", &b2ContactData::shapeIdA)
        .property("shapeIdB", &b2ContactData::shapeIdB)
        .property("manifold", &b2ContactData::manifold, return_value_policy::reference())
        ;

    value_object<b2ContactEndTouchEvent>("b2ContactEndTouchEvent")
        .field("shapeIdA", &b2ContactEndTouchEvent::shapeIdA)
        .field("shapeIdB", &b2ContactEndTouchEvent::shapeIdB)
        .field("contactId", &b2ContactEndTouchEvent::contactId)
        ;

    class_<b2ContactHitEvent>("b2ContactHitEvent")
        .property("shapeIdA", &b2ContactHitEvent::shapeIdA)
        .property("shapeIdB", &b2ContactHitEvent::shapeIdB)
        .property("contactId", &b2ContactHitEvent::contactId)
        .property("point", &b2ContactHitEvent::point, return_value_policy::reference())
        .property("normal", &b2ContactHitEvent::normal, return_value_policy::reference())
        .property("approachSpeed", &b2ContactHitEvent::approachSpeed)
        ;

    class_<b2JointEvent>("b2JointEvent")
        .property("jointId", &b2JointEvent::jointId)
        .property("userData", +[](const b2JointEvent& self) { return userDataToNumber(self.userData); })
        ;

    class_<b2JointEvents>("b2JointEvents")
        .constructor()
        .function("GetJointEvent", +[](const b2JointEvents& events, int index) {
            return events.jointEvents[index];
        })
        .property("count", &b2JointEvents::count)
        ;

    class_<b2Profile>("b2Profile")
        .constructor()
        .property("step", &b2Profile::step)
        .property("pairs", &b2Profile::pairs)
        .property("collide", &b2Profile::collide)
        .property("solve", &b2Profile::solve)
        .property("solverSetup", &b2Profile::solverSetup)
        .property("constraints", &b2Profile::constraints)
        .property("prepareConstraints", &b2Profile::prepareConstraints)
        .property("integrateVelocities", &b2Profile::integrateVelocities)
        .property("warmStart", &b2Profile::warmStart)
        .property("solveImpulses", &b2Profile::solveImpulses)
        .property("integratePositions", &b2Profile::integratePositions)
        .property("relaxImpulses", &b2Profile::relaxImpulses)
        .property("restitution", &b2Profile::restitution)
        .property("storeImpulses", &b2Profile::storeImpulses)
        .property("splitIslands", &b2Profile::splitIslands)
        .property("transforms", &b2Profile::transforms)
        .property("sensorHits", &b2Profile::sensorHits)
        .property("jointEvents", &b2Profile::jointEvents)
        .property("hitEvents", &b2Profile::hitEvents)
        .property("refit", &b2Profile::refit)
        .property("bullets", &b2Profile::bullets)
        .property("sleepIslands", &b2Profile::sleepIslands)
        .property("sensors", &b2Profile::sensors)
        ;

    value_object<b2TreeStats>("b2TreeStats")
        .field("nodeVisits", &b2TreeStats::nodeVisits)
        .field("leafVisits", &b2TreeStats::leafVisits)
        ;

    function("b2DefaultQueryFilter", &b2DefaultQueryFilter);

    class_<b2QueryFilter>("b2QueryFilter")
        .constructor()
        .property("categoryBits",
            +[](const b2QueryFilter& filter) { return static_cast<uint32_t>(filter.categoryBits); },
            +[](b2QueryFilter& filter, uint32_t val) { filter.categoryBits = val; })
        .property("maskBits",
            +[](const b2QueryFilter& filter) { return static_cast<uint32_t>(filter.maskBits); },
            +[](b2QueryFilter& filter, uint32_t val) { filter.maskBits = val; })

        // 64-bit access via string conversion
        .function("setCategoryBits64",
            +[](b2QueryFilter& filter, const std::string& val) {
                filter.categoryBits = std::stoull(val);
            })
        .function("getCategoryBits64",
            +[](const b2QueryFilter& filter) -> std::string {
                return std::to_string(filter.categoryBits);
            })
        .function("setMaskBits64",
            +[](b2QueryFilter& filter, const std::string& val) {
                filter.maskBits = std::stoull(val);
            })
        .function("getMaskBits64",
            +[](const b2QueryFilter& filter) -> std::string {
                return std::to_string(filter.maskBits);
            })
        ;

    function("b2DefaultExplosionDef", &b2DefaultExplosionDef);

    class_<b2ExplosionDef>("b2ExplosionDef")
        .constructor()
        .property("maskBits",
            +[](const b2ExplosionDef& filter) { return static_cast<uint32_t>(filter.maskBits); },
            +[](b2ExplosionDef& filter, uint32_t val) { filter.maskBits = val; })
        .property("position", &b2ExplosionDef::position, return_value_policy::reference())
        .property("radius", &b2ExplosionDef::radius)
        .property("falloff", &b2ExplosionDef::falloff)
        .property("impulsePerLength", &b2ExplosionDef::impulsePerLength)
        ;

    class_<b2RayResult>("b2RayResult")
        .constructor()
        .property("shapeId", &b2RayResult::shapeId)
        .property("point", &b2RayResult::point, return_value_policy::reference())
        .property("normal", &b2RayResult::normal, return_value_policy::reference())
        .property("fraction", &b2RayResult::fraction)
        .property("nodeVisits", &b2RayResult::nodeVisits)
        .property("leafVisits", &b2RayResult::leafVisits)
        .property("hit", &b2RayResult::hit)
        ;

    class_<BasicWorldInterface<World, false>>("BasicWorldInterface");
    class_<MaybeConstWorldRef<false>>("WorldRef");
    class_<MaybeConstWorldRef<true>>("WorldConstRef");
    class_<World, base<BasicWorldInterface<World, false>>>("World")
        .constructor()
        .constructor<const b2WorldDef&>()
        .function("Destroy", &b2::World::Destroy)
        .function("IsValid", &b2::World::IsValid)
        .function("Step", &b2::World::Step)
        .function("SetGravity", &b2::World::SetGravity)
        .function("GetGravity", &b2::World::GetGravity)
        .function("GetAwakeBodyCount", &b2::World::GetAwakeBodyCount)
        .function("GetBodyEvents", &b2::World::GetBodyEvents)
        .function("GetContactEvents", &b2::World::GetContactEvents)
        .function("SetContactTuning", &b2::World::SetContactTuning)
        .function("EnableContinuous", &b2::World::EnableContinuous)
        .function("IsContinuousEnabled", &b2::World::IsContinuousEnabled)
        .function("EnableSleeping", &b2::World::EnableSleeping)
        .function("IsSleepingEnabled", &b2::World::IsSleepingEnabled)
        .function("EnableWarmStarting", &b2::World::EnableWarmStarting)
        .function("IsWarmStartingEnabled", &b2::World::IsWarmStartingEnabled)
        .function("SetMaxLinearSpeed", &b2::World::SetMaxLinearSpeed)
        .function("GetMaxLinearSpeed", &b2::World::GetMaxLinearSpeed)
        .function("SetContactRecycleDistance", &b2::World::SetContactRecycleDistance)
        .function("GetContactRecycleDistance", &b2::World::GetContactRecycleDistance)
        .function("SetRestitutionIterations", &b2::World::SetRestitutionIterations)
        .function("GetRestitutionIterations", &b2::World::GetRestitutionIterations)
        .function("EnableRestitutionPropagation", &b2::World::EnableRestitutionPropagation)
        .function("IsRestitutionPropagationEnabled", &b2::World::IsRestitutionPropagationEnabled)
        .function("SetWorkerCount", &b2::World::SetWorkerCount)
        .function("GetWorkerCount", &b2::World::GetWorkerCount)
        .function("GetBounds", &b2::World::GetBounds)
        .function("SetRestitutionThreshold", &b2::World::SetRestitutionThreshold)
        .function("GetRestitutionThreshold", &b2::World::GetRestitutionThreshold)
        .function("SetHitEventThreshold", &b2::World::SetHitEventThreshold)
        .function("GetHitEventThreshold", &b2::World::GetHitEventThreshold)
        .function("GetCounters", &b2::World::GetCounters)
        .function("GetProfile", &b2::World::GetProfile)
        .function("GetSensorEvents", &b2::World::GetSensorEvents)
        .function("GetJointEvents", &b2::World::GetJointEvents)
        .function("GetPointer", +[](const World& self) -> emscripten::val {
            return emscripten::val(self.Handle().index1);
        })
        .function("CreateBody", +[](b2::World& world, const b2BodyDef& def) -> Body* {
            Body* body = new Body();
            *body = world.CreateBody(b2::Tags::OwningHandle{}, def);
            return body;
        }, allow_raw_pointers())
        .function("Draw", &b2::World::Draw)
        ;

    // ------------------------------------------------------------------------
    // b2Shape
    // ------------------------------------------------------------------------

     class_<b2Circle>("b2Circle")
        .constructor()
        .property("center", &b2Circle::center, return_value_policy::reference())
        .property("radius", &b2Circle::radius)
        ;

    class_<b2Capsule>("b2Capsule")
        .constructor()
        .property("center1", &b2Capsule::center1, return_value_policy::reference())
        .property("center2", &b2Capsule::center2, return_value_policy::reference())
        .property("radius", &b2Capsule::radius)
        ;

    class_<b2Segment>("b2Segment")
        .constructor()
        .property("point1", &b2Segment::point1, return_value_policy::reference())
        .property("point2", &b2Segment::point2, return_value_policy::reference())
        ;

    function("b2DefaultFilter", &b2DefaultFilter);

    class_<b2Filter>("b2Filter")
        .constructor()
        .property("categoryBits",
            +[](const b2Filter& filter) { return static_cast<uint32_t>(filter.categoryBits); },
            +[](b2Filter& filter, uint32_t val) { filter.categoryBits = val; })
        .property("maskBits",
            +[](const b2Filter& filter) { return static_cast<uint32_t>(filter.maskBits); },
            +[](b2Filter& filter, uint32_t val) { filter.maskBits = val; })
        .property("groupIndex", &b2Filter::groupIndex)
        // 64-bit access via string conversion
        .function("setCategoryBits64",
            +[](b2Filter& filter, const std::string& val) {
                filter.categoryBits = std::stoull(val);
            })
        .function("getCategoryBits64",
            +[](const b2Filter& filter) -> std::string {
                return std::to_string(filter.categoryBits);
            })
        .function("setMaskBits64",
            +[](b2Filter& filter, const std::string& val) {
                filter.maskBits = std::stoull(val);
            })
        .function("getMaskBits64",
            +[](const b2Filter& filter) -> std::string {
                return std::to_string(filter.maskBits);
            })
        ;

    class_<b2ShapeDef>("b2ShapeDef")
        .constructor()
        .property("userData",
            +[](const b2ShapeDef& self) { return userDataToNumber(self.userData); },
            +[](b2ShapeDef& self, double value) { self.userData = numberToUserData(value); })
        .property("material", &b2ShapeDef::material, return_value_policy::reference())
        .property("density", &b2ShapeDef::density)
        .property("filter", &b2ShapeDef::filter, return_value_policy::reference())
		.property("enableCustomFiltering", &b2ShapeDef::enableCustomFiltering)
        .property("isSensor", &b2ShapeDef::isSensor)
        .property("enableSensorEvents", &b2ShapeDef::enableSensorEvents)
        .property("enableContactEvents", &b2ShapeDef::enableContactEvents)
        .property("enableHitEvents", &b2ShapeDef::enableHitEvents)
        .property("enablePreSolveEvents", &b2ShapeDef::enablePreSolveEvents)
        .property("invokeContactCreation", &b2ShapeDef::invokeContactCreation)
        .property("updateBodyMass", &b2ShapeDef::updateBodyMass)
        ;

    class_<b2ShapeProxy>("b2ShapeProxy")
        .constructor<>()
        .property("count", &b2ShapeProxy::count)
        .property("radius", &b2ShapeProxy::radius)

        .function("getPoint", optional_override([](const b2ShapeProxy& proxy, int index) -> b2Vec2 {
            if (index < 0 || index >= B2_MAX_POLYGON_VERTICES) {
                return b2Vec2();
            }
            return proxy.points[index];
        }))

        .function("setPoint", optional_override([](b2ShapeProxy& proxy, int index, const b2Vec2& point) {
            if (index >= 0 && index < B2_MAX_POLYGON_VERTICES) {
                proxy.points[index] = point;
            }
        }))
    ;

    function("b2DefaultSurfaceMaterial", &b2DefaultSurfaceMaterial);
    class_<b2SurfaceMaterial>("b2SurfaceMaterial")
        .constructor()
        .property("friction", &b2SurfaceMaterial::friction)
        .property("restitution", &b2SurfaceMaterial::restitution)
        .property("rollingResistance", &b2SurfaceMaterial::rollingResistance)
        .property("tangentSpeed", &b2SurfaceMaterial::tangentSpeed)
        .property("userMaterialId", &b2SurfaceMaterial::userMaterialId)
        .property("customColor", &b2SurfaceMaterial::customColor)
        ;

    class_<b2Polygon>("b2Polygon")
        .constructor()
        .function("GetVertex", +[](const b2Polygon& self, int index) -> b2Vec2 {
            if (index < 0 || index >= B2_MAX_POLYGON_VERTICES) return b2Vec2();
            return self.vertices[index];
        })
        .function("SetVertex", +[](b2Polygon& self, int index, const b2Vec2& value) {
            if (index >= 0 && index < B2_MAX_POLYGON_VERTICES) {
                self.vertices[index] = value;
            }
        })
        .function("GetNormal", +[](const b2Polygon& self, int index) -> b2Vec2 {
            if (index < 0 || index >= B2_MAX_POLYGON_VERTICES) return b2Vec2();
            return self.normals[index];
        })
        .function("SetNormal", +[](b2Polygon& self, int index, const b2Vec2& value) {
            if (index >= 0 && index < B2_MAX_POLYGON_VERTICES) {
                self.normals[index] = value;
            }
        })
        .property("centroid", &b2Polygon::centroid, return_value_policy::reference())
        .property("radius", &b2Polygon::radius)
        .property("count", &b2Polygon::count)
        .class_function("GetMaxVertices", +[]() { return B2_MAX_POLYGON_VERTICES; })
    ;

    // ------------------------------------------------------------------------
    // b2Chain
    // ------------------------------------------------------------------------
    
    function("b2Chain_IsValid", &b2Chain_IsValid);
    function("b2DefaultChainDef", &b2DefaultChainDef);
    function("b2Chain_GetWorld", &b2Chain_GetWorld);
    function("b2Chain_GetSegmentCount", &b2Chain_GetSegmentCount);
    function("b2Chain_SetAllSurfaceMaterials", &b2Chain_SetAllSurfaceMaterials, allow_raw_pointers());
    function("b2Chain_SetSurfaceMaterial", &b2Chain_SetSurfaceMaterial, allow_raw_pointers());
    function("b2Chain_GetSurfaceMaterial", &b2Chain_GetSurfaceMaterial);
    function("b2Chain_GetSegments", +[](b2ChainId chainId, int capacity) -> emscripten::val {
        std::vector<b2ShapeId> segments(capacity);
        int count = b2Chain_GetSegments(chainId, segments.data(), capacity);

        auto result = emscripten::val::array();
        for (int i = 0; i < count; i++) {
            result.set(i, segments[i]);
        }
        return result;
    });

    class_<b2ChainDef>("b2ChainDef")
        .constructor<>()
        .property("materialCount", &b2ChainDef::materialCount)
        .function("GetMaterials", optional_override([](const b2ChainDef& self) -> emscripten::val {
            auto result = emscripten::val::array();
            for (int i = 0; i < self.materialCount; i++) {
                result.set(i, self.materials[i]);
            }
            return result;
        }))
        .function("SetMaterials", +[](b2ChainDef& def, emscripten::val array) {
            static std::vector<b2SurfaceMaterial> persistentMaterials;

            int length = array["length"].as<int>();
            if (length == 0) {
                persistentMaterials.clear();
                def.materials = nullptr;
                def.materialCount = 0;
                return;
            }
            persistentMaterials.resize(length);

            for (int i = 0; i < length; ++i)
            {
                emscripten::val matVal = array[i];

                // Missing fields keep Box2D's defaults. Read through property access, which also
                // works for b2SurfaceMaterial objects (their fields are getters, not own properties).
                b2SurfaceMaterial& material = persistentMaterials[i];
                material = b2DefaultSurfaceMaterial();
                auto has = [&matVal](const char* name) {
                    emscripten::val field = matVal[name];
                    return !field.isUndefined() && !field.isNull();
                };

                if (has("friction"))
                    material.friction = matVal["friction"].as<float>();
                if (has("restitution"))
                    material.restitution = matVal["restitution"].as<float>();
                if (has("rollingResistance"))
                    material.rollingResistance = matVal["rollingResistance"].as<float>();
                if (has("tangentSpeed"))
                    material.tangentSpeed = matVal["tangentSpeed"].as<float>();
                if (has("userMaterialId")) {
                    emscripten::val id = matVal["userMaterialId"];
                    material.userMaterialId = id.typeOf().as<std::string>() == "bigint"
                        ? id.as<uint64_t>()
                        : static_cast<uint64_t>(id.as<double>());
                }
                if (has("customColor"))
                    material.customColor = matVal["customColor"].as<uint32_t>();
            }

            def.materials = persistentMaterials.data();
            def.materialCount = length;
        })
        .property("filter", &b2ChainDef::filter, return_value_policy::reference())
        .property("isLoop", &b2ChainDef::isLoop)
        .property("ghost1", &b2ChainDef::ghost1, return_value_policy::reference())
        .property("ghost2", &b2ChainDef::ghost2, return_value_policy::reference())
        .function("GetPoints", +[](const b2ChainDef& self) -> emscripten::val {
            auto result = emscripten::val::array();
            for (int i = 0; i < self.pointCount; i++) {
                auto point = emscripten::val::object();
                point.set("x", self.points[i].x);
                point.set("y", self.points[i].y);
                result.set(i, point);
            }
            return result;
        })
        .function("SetPoints", +[](b2ChainDef& self, const emscripten::val& points) {
            int length = points["length"].as<int>();
            b2Vec2* newPoints = new b2Vec2[length];

            for (int i = 0; i < length; i++) {
                auto point = points[i];
                newPoints[i].x = point["x"].as<float>();
                newPoints[i].y = point["y"].as<float>();
            }
            if (self.points != nullptr) {
                delete[] const_cast<b2Vec2*>(self.points);
            }

            self.points = newPoints;
            self.pointCount = length;
        })
        .property("pointCount", &b2ChainDef::pointCount)
        .property("internalValue", &b2ChainDef::internalValue)
        .property("enableSensorEvents", &b2ChainDef::enableSensorEvents)
        .function("delete", +[](b2ChainDef* self) {
            if (self->points != nullptr) {
                delete[] const_cast<b2Vec2*>(self->points);
                self->points = nullptr;
            }
            delete self;
        }, allow_raw_pointers())
        ;

    class_<BasicChainInterface<Chain, false>>("BasicChainInterface");

    class_<Chain, base<BasicChainInterface<Chain, false>>>("Chain")
        .constructor<>()
        .function("Destroy", &Chain::Destroy)
        .function("IsValid", &Chain::IsValid)
        .function("GetSegmentCount", &Chain::GetSegmentCount)
        .function("GetSegments", +[](const Chain& self) {
            int count = self.GetSegmentCount();
            if (count == 0) return emscripten::val::array();

            std::vector<b2ShapeId> segments(count);
            int actual = self.GetSegments(segments.data(), count);

            auto result = emscripten::val::array();
            for (int i = 0; i < actual; i++) {
                result.set(i, segments[i]);
            }
            return result;
        })
        .function("GetWorld", select_overload<WorldRef()>(&Chain::GetWorld))
        .function("GetPointer", +[](const Chain& self) -> emscripten::val {
            return emscripten::val(self.Handle().index1);
        })
        ;

    value_object<b2ChainId>("b2ChainId")
        .field("index1", &b2ChainId::index1)
        .field("world0", &b2ChainId::world0)
        .field("generation", &b2ChainId::generation)
        ;

    class_<b2ChainSegment>("b2ChainSegment")
        .constructor()
        .property("ghost1", &b2ChainSegment::ghost1, return_value_policy::reference())
        .property("segment", &b2ChainSegment::segment, return_value_policy::reference())
        .property("ghost2", &b2ChainSegment::ghost2, return_value_policy::reference())
        .property("chainId", &b2ChainSegment::chainId)
        ;

    function("b2MakePolygon", &b2MakePolygon, allow_raw_pointers());
    function("b2MakeOffsetPolygon", &b2MakeOffsetPolygon, allow_raw_pointers());
    function("b2MakeOffsetRoundedPolygon", &b2MakeOffsetRoundedPolygon, allow_raw_pointers());
    function("b2MakeSquare", &b2MakeSquare);
    function("b2MakeBox", &b2MakeBox);
    function("b2MakeRoundedBox", &b2MakeRoundedBox);
    function("b2MakeOffsetBox", &b2MakeOffsetBox);
    function("b2MakeOffsetRoundedBox", &b2MakeOffsetRoundedBox);
    function("b2MakeProxy", &b2MakeProxy, allow_raw_pointers());
    function("b2MakeOffsetProxy", &b2MakeOffsetProxy, allow_raw_pointers());
    function("b2TransformPolygon", &b2TransformPolygon, allow_raw_pointers());
    function("b2ComputeCircleMass", &b2ComputeCircleMass, allow_raw_pointers());
    function("b2ComputeCapsuleMass", &b2ComputeCapsuleMass, allow_raw_pointers());
    function("b2ComputePolygonMass", &b2ComputePolygonMass, allow_raw_pointers());
    function("b2ComputeCircleBounds", &b2ComputeCircleBounds, allow_raw_pointers());
    function("b2ComputeCapsuleBounds", &b2ComputeCapsuleBounds, allow_raw_pointers());
    function("b2ComputePolygonBounds", &b2ComputePolygonBounds, allow_raw_pointers());
    function("b2ComputeSegmentBounds", &b2ComputeSegmentBounds, allow_raw_pointers());
    function("b2PointInCircle", &b2PointInCircle, allow_raw_pointers());
    function("b2PointInCapsule", &b2PointInCapsule, allow_raw_pointers());
    function("b2PointInPolygon", &b2PointInPolygon, allow_raw_pointers());
    function("b2IsValidRay", &b2IsValidRay, allow_raw_pointers());
    function("b2CastRayCircle", &b2CastRayCircle, allow_raw_pointers());
    function("b2CastRayCapsule", &b2CastRayCapsule, allow_raw_pointers());
    function("b2CastRaySegment", &b2CastRaySegment, allow_raw_pointers());
    function("b2CastRayPolygon", &b2CastRayPolygon, allow_raw_pointers());
    function("b2CastShapeCircle", &b2CastShapeCircle, allow_raw_pointers());
    function("b2CastShapeCapsule", &b2CastShapeCapsule, allow_raw_pointers());
    function("b2CastShapeSegment", &b2CastShapeSegment, allow_raw_pointers());
    function("b2CastShapePolygon", &b2CastShapePolygon, allow_raw_pointers());

    enum_<b2ShapeType>("b2ShapeType")
        .value("b2_circleShape", b2_circleShape)
        .value("b2_capsuleShape", b2_capsuleShape)
        .value("b2_segmentShape", b2_segmentShape)
        .value("b2_polygonShape", b2_polygonShape)
        .value("b2_chainSegmentShape", b2_chainSegmentShape)
        .value("b2_shapeTypeCount", b2_shapeTypeCount)
        ;

    class_<BasicShapeInterface<Shape, false>>("BasicShapeInterface");

    class_<Shape, base<BasicShapeInterface<Shape, false>>>("Shape")
        .constructor()
        .function("Destroy", &Shape::Destroy)
        .function("IsValid", &Shape::IsValid)
        .function("GetBounds", &Shape::GetBounds)
        .function("GetDensity", &Shape::GetDensity)
        .function("SetDensity", &Shape::SetDensity)
        .function("GetFilter", &Shape::GetFilter)
        .function("SetFilter", &Shape::SetFilter)
        .function("GetFriction", &Shape::GetFriction)
        .function("SetFriction", &Shape::SetFriction)
        .function("GetContactData", +[](const Shape& shape) {
            return getArrayWrapper<b2ContactData>(shape, &Shape::GetContactCapacity, &Shape::GetContactData);
        })
        .function("GetContactCapacity", &Shape::GetContactCapacity)
        .function("EnableContactEvents", &Shape::EnableContactEvents)
        .function("AreContactEventsEnabled", &Shape::AreContactEventsEnabled)
        .function("EnableHitEvents", &Shape::EnableHitEvents)
        .function("AreHitEventsEnabled", &Shape::AreHitEventsEnabled)
        .function("IsSensor", &Shape::IsSensor)
        .function("GetSensorCapacity", &Shape::GetSensorCapacity)
        .function("GetSensorData", +[](const Shape& shape) {
            return getArrayWrapper<b2ShapeId>(shape, &Shape::GetSensorCapacity, &Shape::GetSensorData);
        })
        .function("EnablePreSolveEvents", &Shape::EnablePreSolveEvents)
        .function("ArePreSolveEventsEnabled", &Shape::ArePreSolveEventsEnabled)
        .function("GetClosestPoint", &Shape::GetClosestPoint)
        .function("CastRay", &Shape::CastRay)
        .function("TestPoint", &Shape::TestPoint)
        .function("GetType", &Shape::GetType)
        .function("GetRestitution", &Shape::GetRestitution)
        .function("SetRestitution", &Shape::SetRestitution)
        .function("GetSurfaceMaterial", &Shape::GetSurfaceMaterial)
        .function("SetSurfaceMaterial", &Shape::SetSurfaceMaterial)
        .function("ApplyWind", &Shape::ApplyWind)
        .function("GetBody", select_overload<BodyRef()>(&Shape::GetBody))
        .function("GetParentChain", select_overload<ChainRef()>(&Shape::GetParentChain))
        .function("GetWorld", select_overload<WorldRef()>(&Shape::GetWorld))
        .function("GetPointer", +[](const Shape& self) -> emscripten::val {
            return emscripten::val(self.Handle().index1);
        })
        ;

    function("b2DefaultShapeDef", &b2DefaultShapeDef);
    function("b2CreateChain", &b2CreateChain, allow_raw_pointers());
    function("b2DestroyChain", &b2DestroyChain, allow_raw_pointers());
    function("b2CreatePolygonShape", &b2CreatePolygonShape, allow_raw_pointers());
    function("b2CreateCircleShape", &b2CreateCircleShape, allow_raw_pointers());
    function("b2CreateCapsuleShape", &b2CreateCapsuleShape, allow_raw_pointers());
    function("b2CreateSegmentShape", &b2CreateSegmentShape, allow_raw_pointers());
    function("b2CreateChainSegmentShape", &b2CreateChainSegmentShape, allow_raw_pointers());
    function("b2DestroyShape", &b2DestroyShape);

    // ------------------------------------------------------------------------
    // b2Body
    // ------------------------------------------------------------------------

    class_<b2MassData>("b2MassData")
        .constructor()
        .property("mass", &b2MassData::mass)
        .property("center", &b2MassData::center, return_value_policy::reference())
        .property("rotationalInertia", &b2MassData::rotationalInertia);
        ;

    enum_<b2BodyType>("b2BodyType")
        .value("b2_staticBody", b2_staticBody)
        .value("b2_kinematicBody", b2_kinematicBody)
        .value("b2_dynamicBody", b2_dynamicBody)
        .value("b2_bodyTypeCount", b2_bodyTypeCount)
        ;

    class_<b2MotionLocks>("b2MotionLocks")
        .constructor()
        .property("linearX", &b2MotionLocks::linearX)
        .property("linearY", &b2MotionLocks::linearY)
        .property("angularZ", &b2MotionLocks::angularZ)
    ;

    class_<b2BodyDef>("b2BodyDef")
        .constructor()
        .constructor<const b2BodyDef&>()
        .property("type", &b2BodyDef::type)
        .property("userData",
            +[](const b2BodyDef& self) { return userDataToNumber(self.userData); },
            +[](b2BodyDef& self, double value) { self.userData = numberToUserData(value); })
        .property("position", &b2BodyDef::position, return_value_policy::reference())
        .property("rotation", &b2BodyDef::rotation, return_value_policy::reference())
        .property("linearVelocity", &b2BodyDef::linearVelocity, return_value_policy::reference())
        .property("angularVelocity", &b2BodyDef::angularVelocity)
        .property("linearDamping", &b2BodyDef::linearDamping)
        .property("angularDamping", &b2BodyDef::angularDamping)
        .property("gravityScale", &b2BodyDef::gravityScale)
        .property("sleepThreshold", &b2BodyDef::sleepThreshold)
        .property("safetyFactor", &b2BodyDef::safetyFactor)
        .property("enableSleep", &b2BodyDef::enableSleep)
        .property("isAwake", &b2BodyDef::isAwake)
        .property("isBullet", &b2BodyDef::isBullet)
        .property("isEnabled", &b2BodyDef::isEnabled)
        .property("allowFastRotation", &b2BodyDef::allowFastRotation)
        .property("enableContactRecycling", &b2BodyDef::enableContactRecycling)
        .property("internalValue", &b2BodyDef::internalValue)
        .property("motionLocks", &b2BodyDef::motionLocks, return_value_policy::reference())
        ;

    class_<BasicBodyInterface<Body, false>>("BasicBodyInterface");

    class_<Body, base<BasicBodyInterface<Body, false>>>("Body")
        .constructor<>()
        .function("IsValid", &Body::IsValid)
        .function("CreateChain", +[](Body& body, const b2ChainDef& def) -> Chain* {
            Chain* chain = new Chain();
            *chain = body.CreateChain(Tags::OwningHandle{}, def);
            return chain;
        }, emscripten::allow_raw_pointers())
        .function("CreateCapsuleShape", +[](Body& body, const b2ShapeDef& def, const b2Capsule& capsule) -> Shape* {
            Shape* shape = new Shape();
            *shape = body.CreateShape(Tags::OwningHandle{}, def, capsule);
            return shape;
        }, emscripten::allow_raw_pointers())
        .function("CreateCircleShape", +[](Body& body, const b2ShapeDef& def, const b2Circle& circle) -> Shape* {
            Shape* shape = new Shape();
            *shape = body.CreateShape(Tags::OwningHandle{}, def, circle);
            return shape;
        }, emscripten::allow_raw_pointers())
        .function("CreatePolygonShape", +[](Body& body, const b2ShapeDef& def, const b2Polygon& polygon) -> Shape* {
            Shape* shape = new Shape();
            *shape = body.CreateShape(Tags::OwningHandle{}, def, polygon);
            return shape;
        }, emscripten::allow_raw_pointers())
        .function("CreateSegmentShape", +[](Body& body, const b2ShapeDef& def, const b2Segment& segment) -> Shape* {
            Shape* shape = new Shape();
            *shape = body.CreateShape(Tags::OwningHandle{}, def, segment);
            return shape;
        }, emscripten::allow_raw_pointers())
        .function("Destroy", &Body::Destroy)
        .function("Enable", &Body::Enable)
        .function("Disable", &Body::Disable)
        .function("IsEnabled", &Body::IsEnabled)
        .function("SetAngularDamping", &Body::SetAngularDamping)
        .function("GetAngularDamping", &Body::GetAngularDamping)
        .function("SetAngularVelocity", &Body::SetAngularVelocity)
        .function("GetAngularVelocity", &Body::GetAngularVelocity)
        .function("ApplyAngularImpulse", &Body::ApplyAngularImpulse)
        .function("ApplyForce", &Body::ApplyForce)
        .function("ApplyForceToCenter", &Body::ApplyForceToCenter)
        .function("ApplyLinearImpulse", &Body::ApplyLinearImpulse)
        .function("ApplyLinearImpulseToCenter", &Body::ApplyLinearImpulseToCenter)
        .function("ApplyTorque", &Body::ApplyTorque)
        .function("ClearForces", &Body::ClearForces)
        .function("UpdateMassFromShapes", &Body::UpdateMassFromShapes)
        .function("GetMass", &Body::GetMass)
        .function("SetMassData", &Body::SetMassData)
        .function("GetMassData", &Body::GetMassData)
        .function("GetRotationalInertia", &Body::GetRotationalInertia)
        .function("SetAwake", &Body::SetAwake)
        .function("IsAwake", &Body::IsAwake)
        .function("WakeTouching", &Body::WakeTouching)
        .function("EnableSleeping", &Body::EnableSleeping)
        .function("IsSleepingEnabled", &Body::IsSleepingEnabled)
        .function("SetSleepThreshold", &Body::SetSleepThreshold)
        .function("GetSleepThreshold", &Body::GetSleepThreshold)
        .function("SetSafetyFactor", &Body::SetSafetyFactor)
        .function("GetSafetyFactor", &Body::GetSafetyFactor)
        .function("SetBullet", &Body::SetBullet)
        .function("IsBullet", &Body::IsBullet)
        .function("EnableContactRecycling", &Body::EnableContactRecycling)
        .function("IsContactRecyclingEnabled", &Body::IsContactRecyclingEnabled)
        .function("SetMotionLocks", &Body::SetMotionLocks)
        .function("GetMotionLocks", &Body::GetMotionLocks)
        .function("ComputeBounds", &Body::ComputeBounds)
        .function("GetMinExtent", &Body::GetMinExtent)
        .function("GetMaxExtent", &Body::GetMaxExtent)
        .function("GetMaxExtentFromOrigin", &Body::GetMaxExtentFromOrigin)
        .function("GetContactCapacity", &Body::GetContactCapacity)
        .function("GetContactData", +[](const Body& body) {
            return getArrayWrapper<b2ContactData>(body, &Body::GetContactCapacity, &Body::GetContactData);
        })
        .function("EnableContactEvents", &Body::EnableContactEvents)
        .function("SetGravityScale", &Body::SetGravityScale)
        .function("GetGravityScale", &Body::GetGravityScale)
        .function("EnableHitEvents", &Body::EnableHitEvents)
        .function("GetJointCount", &Body::GetJointCount)
        .function("GetJoints", +[](const Body& body) {
            return getArrayWrapper<b2JointId>(body, &Body::GetJointCount, &Body::GetJoints);
        })
        .function("SetLinearDamping", &Body::SetLinearDamping)
        .function("GetLinearDamping", &Body::GetLinearDamping)
        .function("SetLinearVelocity", &Body::SetLinearVelocity)
        .function("GetLinearVelocity", &Body::GetLinearVelocity)
        .function("GetLocalCenter", &Body::GetLocalCenter)
        .function("GetLocalPoint", &Body::GetLocalPoint)
        .function("GetLocalVector", &Body::GetLocalVector)
        .function("GetPosition", &Body::GetPosition)
        .function("GetRotation", &Body::GetRotation)
        .function("SetTransform", &Body::SetTransform)
        .function("GetTransform", &Body::GetTransform)
        .function("SetTargetTransform", &Body::SetTargetTransform)
        .function("GetLocalPointVelocity", &Body::GetLocalPointVelocity)
        .function("GetWorldPointVelocity", &Body::GetWorldPointVelocity)
        .function("GetShapeCount", &Body::GetShapeCount)
        .function("GetShapes", +[](const Body& body) {
            return getArrayWrapper<b2ShapeId>(body, &Body::GetShapeCount, &Body::GetShapes);
        })
        .function("SetType", &Body::SetType)
        .function("GetType", &Body::GetType)
        .function("GetPointer", +[](const Body& self) -> emscripten::val {
            return emscripten::val(self.Handle().index1);
        })
        .function("GetWorld", select_overload<WorldRef()>(&Body::GetWorld))
        .function("GetWorldCenter", &Body::GetWorldCenter)
        .function("GetWorldPoint", &Body::GetWorldPoint)
        .function("GetWorldVector", &Body::GetWorldVector)
        .function("SetName", +[](Body& body, const std::string& name) {
            body.SetName(name.c_str());
        })
        .function("GetName", +[](const Body& body) -> std::string {
            return std::string(body.GetName());
        })
        ;

    // ------------------------------------------------------------------------
    // b2Joint
    // ------------------------------------------------------------------------
    enum_<b2JointType>("b2JointType")
        .value("b2_distanceJoint", b2JointType::b2_distanceJoint)
        .value("b2_filterJoint", b2JointType::b2_filterJoint)
        .value("b2_motorJoint", b2JointType::b2_motorJoint)
        .value("b2_moverJoint", b2JointType::b2_moverJoint)
        .value("b2_pogoJoint", b2JointType::b2_pogoJoint)
        .value("b2_prismaticJoint", b2JointType::b2_prismaticJoint)
        .value("b2_revoluteJoint", b2JointType::b2_revoluteJoint)
        .value("b2_weldJoint", b2JointType::b2_weldJoint)
        .value("b2_wheelJoint", b2JointType::b2_wheelJoint)
        ;

    class_<b2::MaybeConstBodyRef<false>>("BodyRef");
    class_<b2::MaybeConstBodyRef<true>>("BodyConstRef");
    class_<b2::MaybeConstChainRef<false>>("ChainRef");
    class_<b2::MaybeConstChainRef<true>>("ChainConstRef");
    class_<BasicJointInterface<Joint, false>>("BasicJointInterface");

    class_<b2JointDef>("b2JointDef")
        .constructor()
        .property("userData",
            +[](const b2JointDef& self) { return userDataToNumber(self.userData); },
            +[](b2JointDef& self, double value) { self.userData = numberToUserData(value); })
        .property("bodyIdA", &b2JointDef::bodyIdA)
        .property("bodyIdB", &b2JointDef::bodyIdB)
        .property("localFrameA", &b2JointDef::localFrameA, return_value_policy::reference())
        .property("localFrameB", &b2JointDef::localFrameB, return_value_policy::reference())
        .property("forceThreshold", &b2JointDef::forceThreshold)
        .property("torqueThreshold", &b2JointDef::torqueThreshold)
        .property("constraintHertz", &b2JointDef::constraintHertz)
        .property("constraintDampingRatio", &b2JointDef::constraintDampingRatio)
        .property("drawScale", &b2JointDef::drawScale)
        .property("collideConnected", &b2JointDef::collideConnected)
    ;

    class_<Joint, base<BasicJointInterface<Joint, false>>>("Joint")
        .constructor<>()
        .function("Destroy", &Joint::Destroy)
        .function("IsValid", &Joint::IsValid)
        .function("GetBodyA", select_overload<BodyRef()>(&Joint::GetBodyA))
        .function("GetBodyB", select_overload<BodyRef()>(&Joint::GetBodyB))
        .function("SetCollideConnected", &Joint::SetCollideConnected)
        .function("GetCollideConnected", &Joint::GetCollideConnected)
        .function("GetConstraintForce", &Joint::GetConstraintForce)
        .function("GetConstraintTorque", &Joint::GetConstraintTorque)
        .function("GetLinearSeparation", &Joint::GetLinearSeparation)
        .function("GetAngularSeparation", &Joint::GetAngularSeparation)
        .function("SetConstraintTuning", &Joint::SetConstraintTuning)
        .function("SetForceThreshold", &Joint::SetForceThreshold)
        .function("GetForceThreshold", &Joint::GetForceThreshold)
        .function("SetTorqueThreshold", &Joint::SetTorqueThreshold)
        .function("GetTorqueThreshold", &Joint::GetTorqueThreshold)
        .function("GetLocalFrameA", &Joint::GetLocalFrameA, return_value_policy::reference())
        .function("GetLocalFrameB", &Joint::GetLocalFrameB, return_value_policy::reference())
        .function("SetLocalFrameA", &Joint::SetLocalFrameA)
        .function("SetLocalFrameB", &Joint::SetLocalFrameB)
        .function("GetType", &Joint::GetType)
        .function("WakeBodies", &Joint::WakeBodies)
        .function("GetWorld", select_overload<WorldRef()>(&Joint::GetWorld))
        .function("GetPointer", +[](const Joint& self) -> emscripten::val {
            return emscripten::val(self.Handle().index1);
        })
        ;

    class_<b2::MaybeConstJointRef<false>>("JointRef");
    class_<b2::MaybeConstJointRef<true>>("JointConstRef");
    class_<b2::MaybeConstDistanceJointRef<false>>("DistanceJointRef");
    class_<b2::MaybeConstDistanceJointRef<true>>("DistanceJointConstRef");
    class_<b2::MaybeConstMotorJointRef<false>>("MotorJointRef");
    class_<b2::MaybeConstMotorJointRef<true>>("MotorJointConstRef");
    class_<b2::MaybeConstMoverJointRef<false>>("MoverJointRef");
    class_<b2::MaybeConstMoverJointRef<true>>("MoverJointConstRef");
    class_<b2::MaybeConstPogoJointRef<false>>("PogoJointRef");
    class_<b2::MaybeConstPogoJointRef<true>>("PogoJointConstRef");
    class_<b2::MaybeConstPrismaticJointRef<false>>("PrismaticJointRef");
    class_<b2::MaybeConstPrismaticJointRef<true>>("PrismaticJointConstRef");
    class_<b2::MaybeConstRevoluteJointRef<false>>("RevoluteJointRef");
    class_<b2::MaybeConstRevoluteJointRef<true>>("RevoluteJointConstRef");
    class_<b2::MaybeConstWeldJointRef<false>>("WeldJointRef");
    class_<b2::MaybeConstWeldJointRef<true>>("WeldJointConstRef");
    class_<b2::MaybeConstWheelJointRef<false>>("WheelJointRef");
    class_<b2::MaybeConstWheelJointRef<true>>("WheelJointConstRef");

    class_<BasicDistanceJointInterface<DistanceJoint, false>>("BasicDistanceJointInterface");
    class_<BasicMotorJointInterface<MotorJoint, false>>("BasicMotorJointInterface");
    class_<BasicMoverJointInterface<MoverJoint, false>>("BasicMoverJointInterface");
    class_<BasicPogoJointInterface<PogoJoint, false>>("BasicPogoJointInterface");
    class_<BasicPrismaticJointInterface<PrismaticJoint, false>>("BasicPrismaticJointInterface");
    class_<BasicRevoluteJointInterface<RevoluteJoint, false>>("BasicRevoluteJointInterface");
    class_<BasicWeldJointInterface<WeldJoint, false>>("BasicWeldJointInterface");
    class_<BasicWheelJointInterface<WheelJoint, false>>("BasicWheelJointInterface");

    value_object<b2JointId>("b2JointId")
        .field("index1", &b2JointId::index1)
        .field("world0", &b2JointId::world0)
        .field("generation", &b2JointId::generation)
        ;

    class_<b2DistanceJointDef>("b2DistanceJointDef")
        .constructor()
        .constructor<const b2DistanceJointDef&>()
        .property("base", &b2DistanceJointDef::base, return_value_policy::reference())
        .property("length", &b2DistanceJointDef::length)
        .property("enableSpring", &b2DistanceJointDef::enableSpring)
        .property("lowerSpringForce", &b2DistanceJointDef::lowerSpringForce)
        .property("upperSpringForce", &b2DistanceJointDef::upperSpringForce)
        .property("hertz", &b2DistanceJointDef::hertz)
        .property("dampingRatio", &b2DistanceJointDef::dampingRatio)
        .property("enableLimit", &b2DistanceJointDef::enableLimit)
        .property("minLength", &b2DistanceJointDef::minLength)
        .property("maxLength", &b2DistanceJointDef::maxLength)
        .property("enableMotor", &b2DistanceJointDef::enableMotor)
        .property("maxMotorForce", &b2DistanceJointDef::maxMotorForce)
        .property("motorSpeed", &b2DistanceJointDef::motorSpeed)
    ;

    class_<b2MotorJointDef>("b2MotorJointDef")
        .constructor()
        .constructor<const b2MotorJointDef&>()
        .property("base", &b2MotorJointDef::base, return_value_policy::reference())
        .property("linearVelocity", &b2MotorJointDef::linearVelocity)
        .property("maxVelocityForce", &b2MotorJointDef::maxVelocityForce)
        .property("angularVelocity", &b2MotorJointDef::angularVelocity)
        .property("maxVelocityTorque", &b2MotorJointDef::maxVelocityTorque)
        .property("linearHertz", &b2MotorJointDef::linearHertz)
        .property("linearDampingRatio", &b2MotorJointDef::linearDampingRatio)
        .property("maxSpringForce", &b2MotorJointDef::maxSpringForce)
        .property("angularHertz", &b2MotorJointDef::angularHertz)
        .property("angularDampingRatio", &b2MotorJointDef::angularDampingRatio)
        .property("maxSpringTorque", &b2MotorJointDef::maxSpringTorque)
    ;

    class_<b2MoverJointDef>("b2MoverJointDef")
        .constructor()
        .constructor<const b2MoverJointDef&>()
        .property("base", &b2MoverJointDef::base, return_value_policy::reference())
        .property("linearVelocity", &b2MoverJointDef::linearVelocity, return_value_policy::reference())
        .property("maxVelocityForce", &b2MoverJointDef::maxVelocityForce, return_value_policy::reference())
    ;

    class_<b2PogoJointDef>("b2PogoJointDef")
        .constructor()
        .constructor<const b2PogoJointDef&>()
        .property("base", &b2PogoJointDef::base, return_value_policy::reference())
        .property("normal", &b2PogoJointDef::normal, return_value_policy::reference())
        .property("hertz", &b2PogoJointDef::hertz)
        .property("dampingRatio", &b2PogoJointDef::dampingRatio)
        .property("restLength", &b2PogoJointDef::restLength)
        .property("maxTensionForce", &b2PogoJointDef::maxTensionForce)
        .property("maxCompressionForce", &b2PogoJointDef::maxCompressionForce)
        .property("impulse", &b2PogoJointDef::impulse)
        .property("velocity", &b2PogoJointDef::velocity)
    ;

    class_<b2FilterJointDef>("b2FilterJointDef")
        .constructor()
        .constructor<const b2FilterJointDef&>()
        .property("base", &b2FilterJointDef::base, return_value_policy::reference())
    ;

    class_<b2PrismaticJointDef>("b2PrismaticJointDef")
        .constructor()
        .constructor<const b2PrismaticJointDef&>()
        .property("base", &b2PrismaticJointDef::base, return_value_policy::reference())
        .property("enableSpring", &b2PrismaticJointDef::enableSpring)
        .property("hertz", &b2PrismaticJointDef::hertz)
        .property("dampingRatio", &b2PrismaticJointDef::dampingRatio)
        .property("targetTranslation", &b2PrismaticJointDef::targetTranslation)
        .property("enableLimit", &b2PrismaticJointDef::enableLimit)
        .property("lowerTranslation", &b2PrismaticJointDef::lowerTranslation)
        .property("upperTranslation", &b2PrismaticJointDef::upperTranslation)
        .property("enableMotor", &b2PrismaticJointDef::enableMotor)
        .property("maxMotorForce", &b2PrismaticJointDef::maxMotorForce)
        .property("motorSpeed", &b2PrismaticJointDef::motorSpeed)
    ;

    class_<b2RevoluteJointDef>("b2RevoluteJointDef")
        .constructor()
        .constructor<const b2RevoluteJointDef&>()
        .property("base", &b2RevoluteJointDef::base, return_value_policy::reference())
        .property("targetAngle", &b2RevoluteJointDef::targetAngle)
        .property("enableSpring", &b2RevoluteJointDef::enableSpring)
        .property("hertz", &b2RevoluteJointDef::hertz)
        .property("dampingRatio", &b2RevoluteJointDef::dampingRatio)
        .property("enableLimit", &b2RevoluteJointDef::enableLimit)
        .property("lowerAngle", &b2RevoluteJointDef::lowerAngle)
        .property("upperAngle", &b2RevoluteJointDef::upperAngle)
        .property("enableMotor", &b2RevoluteJointDef::enableMotor)
        .property("maxMotorTorque", &b2RevoluteJointDef::maxMotorTorque)
        .property("motorSpeed", &b2RevoluteJointDef::motorSpeed)
    ;

    class_<b2WeldJointDef>("b2WeldJointDef")
        .constructor()
        .constructor<const b2WeldJointDef&>()
        .property("base", &b2WeldJointDef::base, return_value_policy::reference())
        .property("linearHertz", &b2WeldJointDef::linearHertz)
        .property("angularHertz", &b2WeldJointDef::angularHertz)
        .property("linearDampingRatio", &b2WeldJointDef::linearDampingRatio)
        .property("angularDampingRatio", &b2WeldJointDef::angularDampingRatio)
    ;

    class_<b2WheelJointDef>("b2WheelJointDef")
        .constructor()
        .constructor<const b2WheelJointDef&>()
        .property("base", &b2WheelJointDef::base, return_value_policy::reference())
        .property("enableSpring", &b2WheelJointDef::enableSpring)
        .property("hertz", &b2WheelJointDef::hertz)
        .property("dampingRatio", &b2WheelJointDef::dampingRatio)
        .property("enableLimit", &b2WheelJointDef::enableLimit)
        .property("lowerTranslation", &b2WheelJointDef::lowerTranslation)
        .property("upperTranslation", &b2WheelJointDef::upperTranslation)
        .property("enableMotor", &b2WheelJointDef::enableMotor)
        .property("maxMotorTorque", &b2WheelJointDef::maxMotorTorque)
        .property("motorSpeed", &b2WheelJointDef::motorSpeed)
    ;

    class_<DistanceJoint, base<BasicDistanceJointInterface<DistanceJoint, false>>>("DistanceJoint")
        .constructor<>()
        .function("GetCurrentLength", &DistanceJoint::GetCurrentLength)
        .function("SetRestLength", &DistanceJoint::SetRestLength)
        .function("GetRestLength", &DistanceJoint::GetRestLength)
        .function("SetLimits", &DistanceJoint::SetLimits)
        .function("EnableLimit", &DistanceJoint::EnableLimit)
        .function("IsLimitEnabled", &DistanceJoint::IsLimitEnabled)
        .function("GetLowerLimit", &DistanceJoint::GetLowerLimit)
        .function("GetUpperLimit", &DistanceJoint::GetUpperLimit)
        .function("SetMaxMotorForce", &DistanceJoint::SetMaxMotorForce)
        .function("GetMaxMotorForce", &DistanceJoint::GetMaxMotorForce)
        .function("EnableMotor", &DistanceJoint::EnableMotor)
        .function("IsMotorEnabled", &DistanceJoint::IsMotorEnabled)
        .function("GetCurrentMotorForce", &DistanceJoint::GetCurrentMotorForce)
        .function("SetTargetMotorSpeed", &DistanceJoint::SetTargetMotorSpeed)
        .function("GetTargetMotorSpeed", &DistanceJoint::GetTargetMotorSpeed)
        .function("EnableSpring", &DistanceJoint::EnableSpring)
        .function("IsSpringEnabled", &DistanceJoint::IsSpringEnabled)
        .function("SetSpringForceRange", &DistanceJoint::SetSpringForceRange)
        .function("GetSpringForce", &DistanceJoint::GetSpringForce)
        .function("SetSpringDampingRatio", &DistanceJoint::SetSpringDampingRatio)
        .function("GetSpringDampingRatio", &DistanceJoint::GetSpringDampingRatio)
        .function("SetSpringHertz", &DistanceJoint::SetSpringHertz)
        .function("GetSpringHertz", &DistanceJoint::GetSpringHertz);

    class_<MotorJoint, base<BasicMotorJointInterface<MotorJoint, false>>>("MotorJoint")
        .constructor<>()
        .function("SetAngularDampingRatio", &MotorJoint::SetAngularDampingRatio)
        .function("GetAngularDampingRatio", &MotorJoint::GetAngularDampingRatio)
        .function("SetAngularHertz", &MotorJoint::SetAngularHertz)
        .function("GetAngularHertz", &MotorJoint::GetAngularHertz)
        .function("SetAngularVelocity", &MotorJoint::SetAngularVelocity)
        .function("GetAngularVelocity", &MotorJoint::GetAngularVelocity)
        .function("SetLinearDampingRatio", &MotorJoint::SetLinearDampingRatio)
        .function("GetLinearDampingRatio", &MotorJoint::GetLinearDampingRatio)
        .function("SetLinearHertz", &MotorJoint::SetLinearHertz)
        .function("GetLinearHertz", &MotorJoint::GetLinearHertz)
        .function("SetLinearVelocity", &MotorJoint::SetLinearVelocity)
        .function("GetLinearVelocity", &MotorJoint::GetLinearVelocity)
        .function("SetMaxSpringForce", &MotorJoint::SetMaxSpringForce)
        .function("GetMaxSpringForce", &MotorJoint::GetMaxSpringForce)
        .function("SetMaxSpringTorque", &MotorJoint::SetMaxSpringTorque)
        .function("GetMaxSpringTorque", &MotorJoint::GetMaxSpringTorque)
        .function("SetMaxVelocityForce", &MotorJoint::SetMaxVelocityForce)
        .function("GetMaxVelocityForce", &MotorJoint::GetMaxVelocityForce)
        .function("SetMaxVelocityTorque", &MotorJoint::SetMaxVelocityTorque)
        .function("GetMaxVelocityTorque", &MotorJoint::GetMaxVelocityTorque)
    ;

    class_<MoverJoint, base<BasicMoverJointInterface<MoverJoint, false>>>("MoverJoint")
        .constructor<>()
        .function("SetLinearVelocity", &MoverJoint::SetLinearVelocity)
        .function("GetLinearVelocity", &MoverJoint::GetLinearVelocity)
        .function("SetMaxVelocityForce", &MoverJoint::SetMaxVelocityForce)
        .function("GetMaxVelocityForce", &MoverJoint::GetMaxVelocityForce)
    ;

    class_<PogoJoint, base<BasicPogoJointInterface<PogoJoint, false>>>("PogoJoint")
        .constructor<>()
        .function("SetRestLength", &PogoJoint::SetRestLength)
        .function("GetRestLength", &PogoJoint::GetRestLength)
        .function("SetSpringHertz", &PogoJoint::SetSpringHertz)
        .function("GetSpringHertz", &PogoJoint::GetSpringHertz)
        .function("SetSpringDampingRatio", &PogoJoint::SetSpringDampingRatio)
        .function("GetSpringDampingRatio", &PogoJoint::GetSpringDampingRatio)
        .function("GetCurrentLength", &PogoJoint::GetCurrentLength)
        .function("GetCurrentSpeed", &PogoJoint::GetCurrentSpeed)
        .function("GetImpulse", &PogoJoint::GetImpulse)
    ;

    class_<PrismaticJoint, base<BasicPrismaticJointInterface<PrismaticJoint, false>>>("PrismaticJoint")
        .constructor<>()
        .function("EnableLimit", &PrismaticJoint::EnableLimit)
        .function("IsLimitEnabled", &PrismaticJoint::IsLimitEnabled)
        .function("SetLimits", &PrismaticJoint::SetLimits)
        .function("GetLowerLimit", &PrismaticJoint::GetLowerLimit)
        .function("SetMaxMotorForce", &PrismaticJoint::SetMaxMotorForce)
        .function("GetMaxMotorForce", &PrismaticJoint::GetMaxMotorForce)
        .function("EnableMotor", &PrismaticJoint::EnableMotor)
        .function("IsMotorEnabled", &PrismaticJoint::IsMotorEnabled)
        .function("GetCurrentMotorForce", &PrismaticJoint::GetCurrentMotorForce)
        .function("SetTargetMotorSpeed", &PrismaticJoint::SetTargetMotorSpeed)
        .function("GetTargetMotorSpeed", &PrismaticJoint::GetTargetMotorSpeed)
        .function("GetCurrentSpeed", &PrismaticJoint::GetCurrentSpeed)
        .function("SetTargetTranslation", &PrismaticJoint::SetTargetTranslation)
        .function("GetTargetTranslation", &PrismaticJoint::GetTargetTranslation)
        .function("EnableSpring", &PrismaticJoint::EnableSpring)
        .function("IsSpringEnabled", &PrismaticJoint::IsSpringEnabled)
        .function("SetSpringDampingRatio", &PrismaticJoint::SetSpringDampingRatio)
        .function("GetSpringDampingRatio", &PrismaticJoint::GetSpringDampingRatio)
        .function("SetSpringHertz", &PrismaticJoint::SetSpringHertz)
        .function("GetSpringHertz", &PrismaticJoint::GetSpringHertz)
        .function("GetCurrentTranslation", &PrismaticJoint::GetCurrentTranslation)
        .function("GetUpperLimit", &PrismaticJoint::GetUpperLimit);

    class_<RevoluteJoint, base<BasicRevoluteJointInterface<RevoluteJoint, false>>>("RevoluteJoint")
        .constructor<>()
        .function("GetCurrentAngle", &RevoluteJoint::GetCurrentAngle)
        .function("GetCurrentSpeed", &RevoluteJoint::GetCurrentSpeed)
        .function("SetTargetAngle", &RevoluteJoint::SetTargetAngle)
        .function("GetTargetAngle", &RevoluteJoint::GetTargetAngle)
        .function("EnableLimit", &RevoluteJoint::EnableLimit)
        .function("IsLimitEnabled", &RevoluteJoint::IsLimitEnabled)
        .function("SetLimits", &RevoluteJoint::SetLimits)
        .function("GetLowerLimit", &RevoluteJoint::GetLowerLimit)
        .function("SetMaxMotorTorque", &RevoluteJoint::SetMaxMotorTorque)
        .function("GetMaxMotorTorque", &RevoluteJoint::GetMaxMotorTorque)
        .function("EnableMotor", &RevoluteJoint::EnableMotor)
        .function("IsMotorEnabled", &RevoluteJoint::IsMotorEnabled)
        .function("SetTargetMotorSpeed", &RevoluteJoint::SetTargetMotorSpeed)
        .function("GetTargetMotorSpeed", &RevoluteJoint::GetTargetMotorSpeed)
        .function("GetCurrentMotorTorque", &RevoluteJoint::GetCurrentMotorTorque)
        .function("EnableSpring", &RevoluteJoint::EnableSpring)
        .function("IsSpringEnabled", &RevoluteJoint::IsSpringEnabled)
        .function("SetSpringDampingRatio", &RevoluteJoint::SetSpringDampingRatio)
        .function("GetSpringDampingRatio", &RevoluteJoint::GetSpringDampingRatio)
        .function("SetSpringHertz", &RevoluteJoint::SetSpringHertz)
        .function("GetSpringHertz", &RevoluteJoint::GetSpringHertz)
        .function("GetUpperLimit", &RevoluteJoint::GetUpperLimit);

    class_<WeldJoint, base<BasicWeldJointInterface<WeldJoint, false>>>("WeldJoint")
        .constructor<>()
        .function("SetAngularDampingRatio", &WeldJoint::SetAngularDampingRatio)
        .function("GetAngularDampingRatio", &WeldJoint::GetAngularDampingRatio)
        .function("SetAngularHertz", &WeldJoint::SetAngularHertz)
        .function("GetAngularHertz", &WeldJoint::GetAngularHertz)
        .function("SetLinearDampingRatio", &WeldJoint::SetLinearDampingRatio)
        .function("GetLinearDampingRatio", &WeldJoint::GetLinearDampingRatio)
        .function("SetLinearHertz", &WeldJoint::SetLinearHertz)
        .function("GetLinearHertz", &WeldJoint::GetLinearHertz)
    ;

    class_<WheelJoint, base<BasicWheelJointInterface<WheelJoint, false>>>("WheelJoint")
        .constructor<>()
        .function("EnableLimit", &WheelJoint::EnableLimit)
        .function("IsLimitEnabled", &WheelJoint::IsLimitEnabled)
        .function("SetLimits", &WheelJoint::SetLimits)
        .function("GetLowerLimit", &WheelJoint::GetLowerLimit)
        .function("SetMaxMotorTorque", &WheelJoint::SetMaxMotorTorque)
        .function("GetMaxMotorTorque", &WheelJoint::GetMaxMotorTorque)
        .function("EnableMotor", &WheelJoint::EnableMotor)
        .function("IsMotorEnabled", &WheelJoint::IsMotorEnabled)
        .function("SetTargetMotorSpeed", &WheelJoint::SetTargetMotorSpeed)
        .function("GetTargetMotorSpeed", &WheelJoint::GetTargetMotorSpeed)
        .function("GetCurrentMotorTorque", &WheelJoint::GetCurrentMotorTorque)
        .function("EnableSpring", &WheelJoint::EnableSpring)
        .function("IsSpringEnabled", &WheelJoint::IsSpringEnabled)
        .function("SetSpringDampingRatio", &WheelJoint::SetSpringDampingRatio)
        .function("GetSpringDampingRatio", &WheelJoint::GetSpringDampingRatio)
        .function("SetSpringHertz", &WheelJoint::SetSpringHertz)
        .function("GetSpringHertz", &WheelJoint::GetSpringHertz)
        .function("GetUpperLimit", &WheelJoint::GetUpperLimit);

    // ------------------------------------------------------------------------
    // b2DebugDraw
    // ------------------------------------------------------------------------

    class_<b2DebugDraw>("b2DebugDraw")
        .constructor()
        .constructor<const b2DebugDraw&>()
        .property("forceScale", &b2DebugDraw::forceScale)
        .property("jointScale", &b2DebugDraw::jointScale)
        .property("drawingBounds", &b2DebugDraw::drawingBounds, return_value_policy::reference())
        .property("drawContacts", &b2DebugDraw::drawContacts)
        .property("drawAnchorA", &b2DebugDraw::drawAnchorA)
        .property("drawShapes", &b2DebugDraw::drawShapes)
        .property("drawChainNormals", &b2DebugDraw::drawChainNormals)
        .property("drawJoints", &b2DebugDraw::drawJoints)
        .property("drawJointExtras", &b2DebugDraw::drawJointExtras)
        .property("drawBounds", &b2DebugDraw::drawBounds)
        .property("drawMass", &b2DebugDraw::drawMass)
        .property("drawBodyNames", &b2DebugDraw::drawBodyNames)
        .property("drawGraphColors", &b2DebugDraw::drawGraphColors)
        .property("drawContactFeatures", &b2DebugDraw::drawContactFeatures)
        .property("drawContactNormals", &b2DebugDraw::drawContactNormals)
        .property("drawContactForces", &b2DebugDraw::drawContactForces)
        .property("drawFrictionForces", &b2DebugDraw::drawFrictionForces)
        .property("drawIslands", &b2DebugDraw::drawIslands)
    ;

    function("b2DefaultDebugDraw", &b2DefaultDebugDraw);
}

uint32_t g_seed = 12345;
uint32_t RAND_LIMIT = 32767;
std::unique_ptr<emscripten::val> g_frictionCallback;
std::unique_ptr<emscripten::val> g_restitutionCallback;

// Simple random number generator. Using this instead of rand() for cross platform determinism.
B2_INLINE int RandomInt()
{
	// XorShift32 algorithm
	uint32_t x = g_seed;
	x ^= x << 13;
	x ^= x >> 17;
	x ^= x << 5;
	g_seed = x;

	// Map the 32-bit value to the range 0 to RAND_LIMIT
	return (int)( x % ( RAND_LIMIT + 1 ) );
}

// Random integer in range [lo, hi]
B2_INLINE float RandomIntRange( int lo, int hi )
{
	return lo + RandomInt() % ( hi - lo + 1 );
}

// Random number in range [-1,1]
B2_INLINE float RandomFloat()
{
	float r = (float)( RandomInt() & ( RAND_LIMIT ) );
	r /= RAND_LIMIT;
	r = 2.0f * r - 1.0f;
	return r;
}

// Random floating point number in range [lo, hi]
B2_INLINE float RandomFloatRange( float lo, float hi )
{
	float r = (float)( RandomInt() & ( RAND_LIMIT ) );
	r /= RAND_LIMIT;
	r = ( hi - lo ) * r + lo;
	return r;
}

// Random vector with coordinates in range [lo, hi]
B2_INLINE b2Vec2 RandomVec2( float lo, float hi )
{
	b2Vec2 v;
	v.x = RandomFloatRange( lo, hi );
	v.y = RandomFloatRange( lo, hi );
	return v;
}

struct MemoryStats {
    size_t arena;
    size_t ordblks;
    size_t smblks;
    size_t hblks;
    size_t hblkhd;
    size_t usmblks;
    size_t fsmblks;
    size_t uordblks;
    size_t fordblks;
    size_t keepcost;
    // user-friendly aliases
    size_t allocatedSpace;
    size_t freeSpace;
    size_t totalSpace;
};

struct b2RayCallbackResult {
    b2ShapeId shapeId;
    b2Pos point;
    b2Vec2 normal;
    float fraction;
};

struct b2OverlapCallbackResult {
    b2ShapeId shapeId;
};

float RayCastCallback(b2ShapeId shapeId, b2Pos point, b2Vec2 normal, float fraction, void* userData) {
    auto* callback = reinterpret_cast<emscripten::val*>(userData);
    b2RayCallbackResult params = { shapeId, point, normal, fraction };
    return callback->operator()(emscripten::val(params)).as<float>();
}

bool OverlapCallback(b2ShapeId shapeId, void* userData) {
    auto* callback = reinterpret_cast<emscripten::val*>(userData);
    b2OverlapCallbackResult params = { shapeId };
    return callback->operator()(emscripten::val(params)).as<bool>();
}

EMSCRIPTEN_BINDINGS(box2d) {
    // ------------------------------------------------------------------------
    // Memory debugging
    // ------------------------------------------------------------------------
    value_object<MemoryStats>("MemoryStats")
        // original mallinfo fields
        .field("arena", &MemoryStats::arena)
        .field("ordblks", &MemoryStats::ordblks)
        .field("smblks", &MemoryStats::smblks)
        .field("hblks", &MemoryStats::hblks)
        .field("hblkhd", &MemoryStats::hblkhd)
        .field("usmblks", &MemoryStats::usmblks)
        .field("fsmblks", &MemoryStats::fsmblks)
        .field("uordblks", &MemoryStats::uordblks)
        .field("fordblks", &MemoryStats::fordblks)
        .field("keepcost", &MemoryStats::keepcost)
        // user-friendly aliases
        .field("allocatedSpace", &MemoryStats::allocatedSpace)
        .field("freeSpace", &MemoryStats::freeSpace)
        .field("totalSpace", &MemoryStats::totalSpace)
    ;

   function("GetMemoryStats", +[]() -> MemoryStats {
        struct mallinfo info = mallinfo();
        size_t totalSpace = static_cast<size_t>(info.arena) + static_cast<size_t>(info.hblkhd);
        return MemoryStats {
            static_cast<size_t>(info.arena),
            static_cast<size_t>(info.ordblks),
            static_cast<size_t>(info.smblks),
            static_cast<size_t>(info.hblks),
            static_cast<size_t>(info.hblkhd),
            static_cast<size_t>(info.usmblks),
            static_cast<size_t>(info.fsmblks),
            static_cast<size_t>(info.uordblks),
            static_cast<size_t>(info.fordblks),
            static_cast<size_t>(info.keepcost),
            static_cast<size_t>(info.uordblks),
            static_cast<size_t>(info.fordblks),
            totalSpace
        };
    });

    // ------------------------------------------------------------------------
    // b2World
    // ------------------------------------------------------------------------
    function("b2DefaultWorldDef", &b2DefaultWorldDef);

    function("b2CreateWorld", &b2CreateWorld, allow_raw_pointers());
    function("b2DestroyWorld", &b2DestroyWorld);
    function("b2World_Step", &b2World_Step);
    function("b2World_Draw", &b2World_Draw, allow_raw_pointers());
    function("b2World_GetBounds", &b2World_GetBounds);
    function("b2World_GetBodyEvents", &b2World_GetBodyEvents);
    function("b2World_GetSensorEvents", &b2World_GetSensorEvents);
    function("b2World_GetContactEvents", &b2World_GetContactEvents);
    function("b2World_GetJointEvents", &b2World_GetJointEvents);
    function("b2World_EnableSleeping", &b2World_EnableSleeping);
    function("b2World_IsSleepingEnabled", &b2World_IsSleepingEnabled);
    function("b2World_EnableWarmStarting", &b2World_EnableWarmStarting);
    function("b2World_IsWarmStartingEnabled", &b2World_IsWarmStartingEnabled);
    function("b2World_GetAwakeBodyCount", &b2World_GetAwakeBodyCount);
    function("b2World_EnableContinuous", &b2World_EnableContinuous);
    function("b2World_IsContinuousEnabled", &b2World_IsContinuousEnabled);
    function("b2World_SetRestitutionThreshold", &b2World_SetRestitutionThreshold);
    function("b2World_GetRestitutionThreshold", &b2World_GetRestitutionThreshold);
    function("b2World_SetRestitutionIterations", &b2World_SetRestitutionIterations);
    function("b2World_GetRestitutionIterations", &b2World_GetRestitutionIterations);
    function("b2World_EnableRestitutionPropagation", &b2World_EnableRestitutionPropagation);
    function("b2World_IsRestitutionPropagationEnabled", &b2World_IsRestitutionPropagationEnabled);
    function("b2World_SetHitEventThreshold", &b2World_SetHitEventThreshold);
    function("b2World_GetHitEventThreshold", &b2World_GetHitEventThreshold);
    function("b2World_SetContactTuning", &b2World_SetContactTuning);
    // returns { hertz, dampingRatio, pushSpeed }
    function("b2World_GetContactTuning", +[](b2WorldId worldId) -> emscripten::val {
        float hertz = 0.0f, dampingRatio = 0.0f, pushSpeed = 0.0f;
        b2World_GetContactTuning(worldId, &hertz, &dampingRatio, &pushSpeed);
        auto result = emscripten::val::object();
        result.set("hertz", hertz);
        result.set("dampingRatio", dampingRatio);
        result.set("pushSpeed", pushSpeed);
        return result;
    });
    function("b2World_SetContactRecycleDistance", &b2World_SetContactRecycleDistance);
    function("b2World_GetContactRecycleDistance", &b2World_GetContactRecycleDistance);
    function("b2World_SetMaxLinearSpeed", &b2World_SetMaxLinearSpeed);
    function("b2World_GetMaxLinearSpeed", &b2World_GetMaxLinearSpeed);
    function("b2World_GetProfile", &b2World_GetProfile);
    function("b2World_GetCounters", &b2World_GetCounters);
    function("b2World_GetMaxCapacity", &b2World_GetMaxCapacity);
    function("b2World_SetWorkerCount", &b2World_SetWorkerCount);
    function("b2World_GetWorkerCount", &b2World_GetWorkerCount);
    function("b2World_GetStateHash", &b2World_GetStateHash);

    // Snapshots: the image is copied into a JS Uint8Array, so it stays valid after the world changes.
    function("b2World_GetSnapshot", +[](b2WorldId worldId) -> emscripten::val {
        int size = b2World_GetSnapshot(worldId, nullptr, 0);
        if (size <= 0) {
            return emscripten::val::null();
        }
        std::vector<uint8_t> image(size);
        b2World_GetSnapshot(worldId, image.data(), size);
        auto result = emscripten::val::global("Uint8Array").new_(size);
        result.call<void>("set", emscripten::val(emscripten::typed_memory_view(image.size(), image.data())));
        return result;
    });
    function("b2World_RestoreFromSnapshot", +[](b2WorldId worldId, const emscripten::val& image) -> bool {
        std::vector<uint8_t> bytes = emscripten::convertJSArrayToNumberVector<uint8_t>(image);
        return b2World_RestoreFromSnapshot(worldId, bytes.data(), static_cast<int>(bytes.size()));
    });
    function("b2CreateWorldFromSnapshot", +[](const emscripten::val& image, int workerCount) -> b2WorldId {
        std::vector<uint8_t> bytes = emscripten::convertJSArrayToNumberVector<uint8_t>(image);
        return b2CreateWorldFromSnapshot(bytes.data(), static_cast<int>(bytes.size()), workerCount);
    });
    function("b2World_GetPointer", +[](b2WorldId worldId) -> emscripten::val {
        return emscripten::val(worldId.index1);
    });
    function("b2World_SetFrictionCallback", +[](b2WorldId worldId, emscripten::val callback) {
        g_frictionCallback = std::make_unique<emscripten::val>(callback);

        b2World_SetFrictionCallback(worldId, [](float frictionA, uint64_t userMaterialIdA, float frictionB, uint64_t userMaterialIdB) -> float {
            return (*g_frictionCallback)(frictionA, userMaterialIdA, frictionB, userMaterialIdB).as<float>();
        });
    });

    function("b2World_SetRestitutionCallback", +[](b2WorldId worldId, emscripten::val callback) {
        g_restitutionCallback = std::make_unique<emscripten::val>(callback);

        b2World_SetRestitutionCallback(worldId, [](float restitutionA, uint64_t userMaterialIdA, float restitutionB, uint64_t userMaterialIdB) -> float {
            return (*g_restitutionCallback)(restitutionA, userMaterialIdA, restitutionB, userMaterialIdB).as<float>();
        });
    });
    // function("b2World_DumpMemoryStats", &b2World_DumpMemoryStats);

    class_<b2RayCallbackResult>("b2RayCallbackResult")
        .constructor<>()
        .property("shapeId", &b2RayCallbackResult::shapeId)
        .property("point", &b2RayCallbackResult::point, return_value_policy::reference())
        .property("normal", &b2RayCallbackResult::normal, return_value_policy::reference())
        .property("fraction", &b2RayCallbackResult::fraction)
    ;
    value_object<b2OverlapCallbackResult>("b2OverlapCallbackResult")
        .field("shapeId", &b2OverlapCallbackResult::shapeId)
    ;
    class_<b2Plane>("b2Plane")
        .constructor()
        .property("normal", &b2Plane::normal, return_value_policy::reference())
        .property("offset", &b2Plane::offset, return_value_policy::reference());

    value_object<b2PlaneResult>("b2PlaneResult")
        .field("plane", &b2PlaneResult::plane)
        .field("point", &b2PlaneResult::point)
        .field("hit", &b2PlaneResult::hit);

    class_<b2CollisionPlane>("b2CollisionPlane")
        .constructor()
        .property("plane", &b2CollisionPlane::plane, return_value_policy::reference())
        .property("pushLimit", &b2CollisionPlane::pushLimit)
        .property("push", &b2CollisionPlane::push)
        .property("clipVelocity", &b2CollisionPlane::clipVelocity);

    class_<b2PlaneSolverResult>("b2PlaneSolverResult")
        .constructor()
        .property("delta", &b2PlaneSolverResult::delta, return_value_policy::reference())
        .property("iterationCount", &b2PlaneSolverResult::iterationCount);

    function("b2SolvePlanes", +[](const b2Vec2& targetDelta, const emscripten::val& collisionPlanes) -> b2PlaneSolverResult {
        int length = collisionPlanes["length"].as<int>();
        std::vector<b2CollisionPlane> planes(length);

        for (int i = 0; i < length; ++i) {
            auto collisionPlane = collisionPlanes[i];
            auto plane = collisionPlane["plane"];
            planes[i].plane.normal.x = plane["normal"]["x"].as<float>();
            planes[i].plane.normal.y = plane["normal"]["y"].as<float>();
            planes[i].plane.offset = plane["offset"].as<float>();
            planes[i].pushLimit = collisionPlane["pushLimit"].as<float>();
            planes[i].push = collisionPlane["push"].as<float>();
            planes[i].clipVelocity = collisionPlane["clipVelocity"].as<float>();
        }

        // b2SolvePlanes writes the resulting push back into the planes
        b2PlaneSolverResult result = b2SolvePlanes(targetDelta, planes.data(), length);
        for (int i = 0; i < length; ++i) {
            collisionPlanes[i].set("push", planes[i].push);
        }
        return result;
    });
    function("b2ClipVector", +[](const b2Vec2& vector, const emscripten::val& collisionPlanes) -> b2Vec2 {
        int length = collisionPlanes["length"].as<int>();
        std::vector<b2CollisionPlane> planes(length);

        for (int i = 0; i < length; ++i) {
            auto collisionPlane = collisionPlanes[i];
            auto plane = collisionPlane["plane"];
            planes[i].plane.normal.x = plane["normal"]["x"].as<float>();
            planes[i].plane.normal.y = plane["normal"]["y"].as<float>();
            planes[i].plane.offset = plane["offset"].as<float>();
            planes[i].pushLimit = collisionPlane["pushLimit"].as<float>();
            planes[i].push = collisionPlane["push"].as<float>();
            planes[i].clipVelocity = collisionPlane["clipVelocity"].as<float>();
        }

        return b2ClipVector(vector, planes.data(), length);
    });

    function("b2World_OverlapAABB",
        +[](b2WorldId worldId, b2Pos origin, const b2AABB& aabb, b2QueryFilter filter, emscripten::val callback) -> b2TreeStats {
            auto* callbackPtr = new emscripten::val(callback);
            b2TreeStats stats = b2World_OverlapAABB(worldId, origin, aabb, filter, OverlapCallback, callbackPtr);
            delete callbackPtr;
            return stats;
        }
    , allow_raw_pointers());
    function("b2World_OverlapShape",
        +[](b2WorldId worldId, b2Pos origin, const b2ShapeProxy* proxy, b2QueryFilter filter, emscripten::val callback) -> b2TreeStats {
            auto* callbackPtr = new emscripten::val(callback);
            b2TreeStats stats = b2World_OverlapShape(worldId, origin, proxy, filter, OverlapCallback, callbackPtr);
            delete callbackPtr;
            return stats;
        },
    allow_raw_pointers());
    function("b2World_CastRay",
        +[](b2WorldId worldId, b2Pos origin, b2Vec2 translation, b2QueryFilter filter, emscripten::val callback) {
            auto* callbackPtr = new emscripten::val(callback);
            b2TreeStats stats = b2World_CastRay(worldId, origin, translation, filter, RayCastCallback, callbackPtr);
            delete callbackPtr;
            return stats;
        }
    , allow_raw_pointers());
    function("b2World_CastRayClosest", &b2World_CastRayClosest);
    function("b2World_CastShape",
        +[](b2WorldId worldId, b2Pos origin, const b2ShapeProxy* proxy, b2Vec2 translation, b2QueryFilter filter, emscripten::val callback) -> b2TreeStats {
            auto* callbackPtr = new emscripten::val(callback);
            b2TreeStats stats = b2World_CastShape(worldId, origin, proxy, translation, filter, RayCastCallback, callbackPtr);
            delete callbackPtr;
            return stats;
        },
        allow_raw_pointers()
    );
    function("b2World_CastMover", &b2World_CastMover, allow_raw_pointers());
    function("b2World_CollideMover",
        +[](b2WorldId worldId, b2Pos origin, const b2Capsule* mover, b2QueryFilter filter, emscripten::val callback) {
            auto* callbackPtr = new emscripten::val(callback);
            b2World_CollideMover(worldId, origin, mover, filter,
                +[](b2ShapeId shapeId, const b2PlaneResult* planeResult, void* context) -> bool {
                    auto* cb = reinterpret_cast<emscripten::val*>(context);
                    return cb->operator()(emscripten::val(shapeId), *planeResult).as<bool>();
                },
                callbackPtr
            );
            delete callbackPtr;
        },
        allow_raw_pointers()
    );
    function("b2World_SetCustomFilterCallback",
       +[](b2WorldId worldId, emscripten::val callback) {
            auto callbackPtr = new emscripten::val(callback);
            b2World_SetCustomFilterCallback(worldId,
                +[](b2ShapeId shapeIdA, b2ShapeId shapeIdB, void* userData) -> bool {
                    auto callback = *reinterpret_cast<emscripten::val*>(userData);
                    return callback(
                        emscripten::val(shapeIdA),
                        emscripten::val(shapeIdB)
                    ).as<bool>();
                },
                callbackPtr
            );
            return reinterpret_cast<uint32_t>(callbackPtr);
       }
    );
    // preSolve(shapeIdA, shapeIdB, manifold): the manifold is the live b2Manifold, edit it in place
    // (for example set pointCount = 0 to disable the contact). Do not delete it.
    // preContinuous(shapeIdA, shapeIdB, point, normal) -> bool: return false to skip the time of impact event.
    // Either callback may be null. Returns a handle to pass to b2World_DeleteCallback.
    function("b2World_SetPreSolveCallback",
        +[](b2WorldId worldId, emscripten::val preSolve, emscripten::val preContinuous) {
            bool hasPreSolve = !preSolve.isNull() && !preSolve.isUndefined();
            bool hasPreContinuous = !preContinuous.isNull() && !preContinuous.isUndefined();
            auto callbacksPtr = new emscripten::val(emscripten::val::object());
            callbacksPtr->set("preSolve", preSolve);
            callbacksPtr->set("preContinuous", preContinuous);
            b2World_SetPreSolveCallback(worldId,
                hasPreSolve ? +[](b2ShapeId shapeIdA, b2ShapeId shapeIdB, b2Manifold* manifold, void* userData) {
                    auto& callbacks = *reinterpret_cast<emscripten::val*>(userData);
                    callbacks["preSolve"](
                        emscripten::val(shapeIdA),
                        emscripten::val(shapeIdB),
                        emscripten::val(manifold, allow_raw_pointers())
                    );
                } : nullptr,
                hasPreContinuous ? +[](b2ShapeId shapeIdA, b2ShapeId shapeIdB, b2Pos point, b2Vec2 normal, void* userData) -> bool {
                    auto& callbacks = *reinterpret_cast<emscripten::val*>(userData);
                    return callbacks["preContinuous"](
                        emscripten::val(shapeIdA),
                        emscripten::val(shapeIdB),
                        emscripten::val(point),
                        emscripten::val(normal)
                    ).as<bool>();
                } : nullptr,
                callbacksPtr
            );
            return reinterpret_cast<uint32_t>(callbacksPtr);
        }
    );
    function("b2World_DeleteCallback",
        +[](uint32_t ptr) {
            delete reinterpret_cast<emscripten::val*>(ptr);
        }
    );
    function("b2World_SetGravity", &b2World_SetGravity);
    function("b2World_GetGravity", &b2World_GetGravity);
    function("b2World_Explode", &b2World_Explode, allow_raw_pointers());
    function("b2World_RebuildStaticTree", &b2World_RebuildStaticTree);
    function("b2World_IsValid", &b2World_IsValid);


    // ------------------------------------------------------------------------
    // b2Shape
    // ------------------------------------------------------------------------
    function("b2Shape_GetBody", &b2Shape_GetBody);
    function("b2Shape_GetWorld", &b2Shape_GetWorld);
    function("b2Shape_GetPointer", +[](b2ShapeId shapeId) -> emscripten::val {
        return emscripten::val(shapeId.index1);
    });
    function("b2Shape_IsValid", &b2Shape_IsValid);
    function("b2Shape_SetUserData", +[](b2ShapeId shapeId, double value) { b2Shape_SetUserData(shapeId, numberToUserData(value)); });
    function("b2Shape_GetUserData", +[](b2ShapeId shapeId) { return userDataToNumber(b2Shape_GetUserData(shapeId)); });
    function("b2Shape_IsSensor", &b2Shape_IsSensor);
    function("b2Shape_TestPoint", &b2Shape_TestPoint);
    function("b2Shape_CastRay", &b2Shape_CastRay);
    function("b2Shape_SetDensity", &b2Shape_SetDensity);
    function("b2Shape_GetDensity", &b2Shape_GetDensity);
    function("b2Shape_SetFriction", &b2Shape_SetFriction);
    function("b2Shape_GetFriction", &b2Shape_GetFriction);
    function("b2Shape_SetRestitution", &b2Shape_SetRestitution);
    function("b2Shape_GetRestitution", &b2Shape_GetRestitution);
    function("b2Shape_SetUserMaterial", &b2Shape_SetUserMaterial);
    function("b2Shape_GetUserMaterial", &b2Shape_GetUserMaterial);
    function("b2Shape_GetSurfaceMaterial", &b2Shape_GetSurfaceMaterial);
    function("b2Shape_SetSurfaceMaterial", &b2Shape_SetSurfaceMaterial, allow_raw_pointers());
    function("b2Shape_GetFilter", &b2Shape_GetFilter);
    function("b2Shape_SetFilter", &b2Shape_SetFilter);
    function("b2Shape_EnableSensorEvents", &b2Shape_EnableSensorEvents);
    function("b2Shape_AreSensorEventsEnabled", &b2Shape_AreSensorEventsEnabled);
    function("b2Shape_EnableContactEvents", &b2Shape_EnableContactEvents);
    function("b2Shape_AreContactEventsEnabled", &b2Shape_AreContactEventsEnabled);
    function("b2Shape_EnablePreSolveEvents", &b2Shape_EnablePreSolveEvents);
    function("b2Shape_ArePreSolveEventsEnabled", &b2Shape_ArePreSolveEventsEnabled);
    function("b2Shape_EnableHitEvents", &b2Shape_EnableHitEvents);
    function("b2Shape_AreHitEventsEnabled", &b2Shape_AreHitEventsEnabled);
    function("b2Shape_GetType", &b2Shape_GetType);
    function("b2Shape_GetCircle", &b2Shape_GetCircle);
    function("b2Shape_GetSegment", &b2Shape_GetSegment);
    function("b2Shape_GetChainSegment", &b2Shape_GetChainSegment);
    function("b2Shape_GetCapsule", &b2Shape_GetCapsule);
    function("b2Shape_GetPolygon", &b2Shape_GetPolygon);
    function("b2Shape_SetCircle", &b2Shape_SetCircle, allow_raw_pointers());
    function("b2Shape_SetCapsule", &b2Shape_SetCapsule, allow_raw_pointers());
    function("b2Shape_SetSegment", &b2Shape_SetSegment, allow_raw_pointers());
    function("b2Shape_SetPolygon", &b2Shape_SetPolygon, allow_raw_pointers());
    function("b2Shape_SetChainSegment", &b2Shape_SetChainSegment, allow_raw_pointers());
    function("b2Shape_GetParentChain", &b2Shape_GetParentChain);
    function("b2Shape_GetContactCapacity", &b2Shape_GetContactCapacity);
    function("b2Shape_GetContactData", +[](b2ShapeId shapeId, int capacity) -> emscripten::val {
        std::vector<b2ContactData> contactData(capacity);
        int count = b2Shape_GetContactData(shapeId, contactData.data(), capacity);
        auto result = emscripten::val::array();
        for (int i = 0; i < count; i++) {
            result.set(i, contactData[i]);
        }
        return result;
    }, allow_raw_pointers());
    function("b2Shape_GetSensorCapacity", &b2Shape_GetSensorCapacity);
    function("b2Shape_GetSensorData", +[](b2ShapeId shapeId, int capacity) -> emscripten::val {
        std::vector<b2ShapeId> overlappedShapes(capacity);
        int count = b2Shape_GetSensorData(shapeId, overlappedShapes.data(), capacity);
        auto result = emscripten::val::array();
        for (int i = 0; i < count; i++) {
            result.set(i, overlappedShapes[i]);
        }
        return result;
    }, allow_raw_pointers());
    function("b2Shape_GetBounds", &b2Shape_GetBounds);
    function("b2Shape_ComputeMassData", &b2Shape_ComputeMassData);
    function("b2Shape_GetClosestPoint", &b2Shape_GetClosestPoint);
    function("b2Shape_ApplyWind", &b2Shape_ApplyWind);

    // ------------------------------------------------------------------------
    // b2Body
    // ------------------------------------------------------------------------
    function("b2DefaultBodyDef", &b2DefaultBodyDef);

    function("b2CreateBody", &b2CreateBody, allow_raw_pointers());
    function("b2DestroyBody", &b2DestroyBody, allow_raw_pointers());
    function("b2Body_GetPosition", &b2Body_GetPosition);
    function("b2Body_GetRotation", &b2Body_GetRotation);
    function("b2Body_GetTransform", &b2Body_GetTransform);
    function("b2Body_SetTransform", &b2Body_SetTransform);
    function("b2Body_SetTargetTransform", &b2Body_SetTargetTransform);
    function("b2Body_GetLocalPoint", &b2Body_GetLocalPoint);
    function("b2Body_GetWorldPoint", &b2Body_GetWorldPoint);
    function("b2Body_GetLocalVector", &b2Body_GetLocalVector);
    function("b2Body_GetWorldVector", &b2Body_GetWorldVector);
    function("b2Body_GetMass", &b2Body_GetMass);
    function("b2Body_GetRotationalInertia", &b2Body_GetRotationalInertia);
    function("b2Body_GetLocalCenter", &b2Body_GetLocalCenter);
    function("b2Body_GetWorldCenter", &b2Body_GetWorldCenter);
    function("b2Body_SetMassData", &b2Body_SetMassData);
    function("b2Body_GetMassData", &b2Body_GetMassData);
    function("b2Body_UpdateMassFromShapes", &b2Body_UpdateMassFromShapes);
    function("b2Body_GetLinearVelocity", &b2Body_GetLinearVelocity);
    function("b2Body_GetAngularVelocity", &b2Body_GetAngularVelocity);
    function("b2Body_SetLinearVelocity", &b2Body_SetLinearVelocity);
    function("b2Body_SetAngularVelocity", &b2Body_SetAngularVelocity);
    function("b2Body_ApplyForce", &b2Body_ApplyForce);
    function("b2Body_ApplyForceToCenter", &b2Body_ApplyForceToCenter);
    function("b2Body_ApplyTorque", &b2Body_ApplyTorque);
    function("b2Body_ApplyLinearImpulse", &b2Body_ApplyLinearImpulse);
    function("b2Body_ApplyLinearImpulseToCenter", &b2Body_ApplyLinearImpulseToCenter);
    function("b2Body_ApplyAngularImpulse", &b2Body_ApplyAngularImpulse);
    function("b2Body_ClearForces", &b2Body_ClearForces);
    function("b2Body_SetLinearDamping", &b2Body_SetLinearDamping);
    function("b2Body_GetLinearDamping", &b2Body_GetLinearDamping);
    function("b2Body_SetAngularDamping", &b2Body_SetAngularDamping);
    function("b2Body_GetAngularDamping", &b2Body_GetAngularDamping);
    function("b2Body_SetGravityScale", &b2Body_SetGravityScale);
    function("b2Body_GetGravityScale", &b2Body_GetGravityScale);
    function("b2Body_GetType", &b2Body_GetType);
    function("b2Body_SetType", &b2Body_SetType);
    function("b2Body_IsAwake", &b2Body_IsAwake);
    function("b2Body_SetAwake", &b2Body_SetAwake);
    function("b2Body_WakeTouching", &b2Body_WakeTouching);
    function("b2Body_IsEnabled", &b2Body_IsEnabled);
    function("b2Body_Enable", &b2Body_Enable);
    function("b2Body_Disable", &b2Body_Disable);
    function("b2Body_IsSleepingEnabled", &b2Body_IsSleepingEnabled);
    function("b2Body_EnableSleeping", &b2Body_EnableSleeping);
    function("b2Body_SetSleepThreshold", &b2Body_SetSleepThreshold);
    function("b2Body_GetSleepThreshold", &b2Body_GetSleepThreshold);
    function("b2Body_SetSafetyFactor", &b2Body_SetSafetyFactor);
    function("b2Body_GetSafetyFactor", &b2Body_GetSafetyFactor);
    function("b2Body_SetBullet", &b2Body_SetBullet);
    function("b2Body_IsBullet", &b2Body_IsBullet);
    function("b2Body_EnableContactRecycling", &b2Body_EnableContactRecycling);
    function("b2Body_IsContactRecyclingEnabled", &b2Body_IsContactRecyclingEnabled);
    function("b2Body_SetName", +[](b2BodyId bodyId, const std::string& name) {
        b2Body_SetName(bodyId, name.c_str());
    });
    function("b2Body_GetName", +[](b2BodyId bodyId) -> std::string {
        const char* name = b2Body_GetName(bodyId);
        return name != nullptr ? std::string(name) : std::string();
    });
    function("b2Body_SetMotionLocks", &b2Body_SetMotionLocks);
    function("b2Body_GetMotionLocks", &b2Body_GetMotionLocks);
    function("b2Body_GetPointer", +[](b2BodyId bodyId) -> emscripten::val {
        return emscripten::val(bodyId.index1);
    });
    function("b2Body_EnableContactEvents", &b2Body_EnableContactEvents);
    function("b2Body_EnableHitEvents", &b2Body_EnableHitEvents);
    function("b2Body_GetShapeCount", &b2Body_GetShapeCount);
    function("b2Body_GetShapes", +[](b2BodyId bodyId, int capacity) -> emscripten::val {
        std::vector<b2ShapeId> shapes(capacity);
        int count = b2Body_GetShapes(bodyId, shapes.data(), capacity);

        auto result = emscripten::val::array();
        for (int i = 0; i < count; i++) {
            result.set(i, shapes[i]);
        }
        return result;
    });
    function("b2Body_GetJointCount", &b2Body_GetJointCount);

    function("b2Body_GetJoints", +[](b2BodyId bodyId) -> emscripten::val {
        int capacity = b2Body_GetJointCount(bodyId);
        std::vector<b2JointId> joints(capacity);
        int count = b2Body_GetJoints(bodyId, joints.data(), capacity);

        auto result = emscripten::val::array();
        for (int i = 0; i < count; i++) {
            result.set(i, joints[i]);
        }
        return result;
    });

    function("b2Body_GetContactCapacity", &b2Body_GetContactCapacity);
    function("b2Body_GetContactData", +[](b2BodyId bodyId, int capacity) -> emscripten::val {
        std::vector<b2ContactData> contactData(capacity);
        int count = b2Body_GetContactData(bodyId, contactData.data(), capacity);
        auto result = emscripten::val::array();
        for (int i = 0; i < count; i++) {
            result.set(i, contactData[i]);
        }
        return result;
    }, allow_raw_pointers());
    function("b2Body_ComputeBounds", &b2Body_ComputeBounds);
    function("b2Body_GetMinExtent", &b2Body_GetMinExtent);
    function("b2Body_GetMaxExtent", &b2Body_GetMaxExtent);
    function("b2Body_GetMaxExtentFromOrigin", &b2Body_GetMaxExtentFromOrigin);
    function("b2Body_GetWorld", &b2Body_GetWorld);
    function("b2Body_GetLocalPointVelocity", &b2Body_GetLocalPointVelocity);
    function("b2Body_GetWorldPointVelocity", &b2Body_GetWorldPointVelocity);
    function("b2Body_IsValid", &b2Body_IsValid);
    function("b2Body_SetUserData", +[](b2BodyId bodyId, double value) { b2Body_SetUserData(bodyId, numberToUserData(value)); });
    function("b2Body_GetUserData", +[](b2BodyId bodyId) { return userDataToNumber(b2Body_GetUserData(bodyId)); });

    // ------------------------------------------------------------------------
    // b2Joint
    // ------------------------------------------------------------------------
    function("b2DestroyJoint", &b2DestroyJoint, allow_raw_pointers());
    function("b2DefaultDistanceJointDef", &b2DefaultDistanceJointDef);
    function("b2CreateDistanceJoint", &b2CreateDistanceJoint, allow_raw_pointers());
    function("b2DefaultMotorJointDef", &b2DefaultMotorJointDef);
    function("b2CreateMotorJoint", &b2CreateMotorJoint, allow_raw_pointers());
    function("b2DefaultMoverJointDef", &b2DefaultMoverJointDef);
    function("b2CreateMoverJoint", &b2CreateMoverJoint, allow_raw_pointers());
    function("b2DefaultPogoJointDef", &b2DefaultPogoJointDef);
    function("b2CreatePogoJoint", &b2CreatePogoJoint, allow_raw_pointers());
    function("b2DefaultFilterJointDef", &b2DefaultFilterJointDef);
    function("b2CreateFilterJoint", &b2CreateFilterJoint, allow_raw_pointers());
    function("b2DefaultPrismaticJointDef", &b2DefaultPrismaticJointDef);
    function("b2CreatePrismaticJoint", &b2CreatePrismaticJoint, allow_raw_pointers());
    function("b2DefaultRevoluteJointDef", &b2DefaultRevoluteJointDef);
    function("b2CreateRevoluteJoint", &b2CreateRevoluteJoint, allow_raw_pointers());
    function("b2DefaultWeldJointDef", &b2DefaultWeldJointDef);
    function("b2CreateWeldJoint", &b2CreateWeldJoint, allow_raw_pointers());
    function("b2DefaultWheelJointDef", &b2DefaultWheelJointDef);
    function("b2CreateWheelJoint", &b2CreateWheelJoint, allow_raw_pointers());

    function("b2Joint_IsValid", &b2Joint_IsValid);
    function("b2Joint_SetUserData", +[](b2JointId jointId, double value) { b2Joint_SetUserData(jointId, numberToUserData(value)); });
    function("b2Joint_GetUserData", +[](b2JointId jointId) { return userDataToNumber(b2Joint_GetUserData(jointId)); });
    function("b2Joint_GetType", &b2Joint_GetType);
    function("b2Joint_GetBodyA", &b2Joint_GetBodyA);
    function("b2Joint_GetBodyB", &b2Joint_GetBodyB);
    function("b2Joint_GetWorld", &b2Joint_GetWorld);
    function("b2Joint_GetLocalFrameA", &b2Joint_GetLocalFrameA);
    function("b2Joint_GetLocalFrameB", &b2Joint_GetLocalFrameB);
    function("b2Joint_SetLocalFrameA", &b2Joint_SetLocalFrameA);
    function("b2Joint_SetLocalFrameB", &b2Joint_SetLocalFrameB);
    function("b2Joint_SetCollideConnected", &b2Joint_SetCollideConnected);
    function("b2Joint_GetCollideConnected", &b2Joint_GetCollideConnected);
    function("b2Joint_GetPointer", +[](b2JointId jointId) -> emscripten::val {
        return emscripten::val(jointId.index1);
    });
    function("b2Joint_WakeBodies", &b2Joint_WakeBodies);
    function("b2Joint_GetConstraintForce", &b2Joint_GetConstraintForce);
    function("b2Joint_GetConstraintTorque", &b2Joint_GetConstraintTorque);
    function("b2Joint_GetLinearSeparation", &b2Joint_GetLinearSeparation);
    function("b2Joint_GetAngularSeparation", &b2Joint_GetAngularSeparation);
    function("b2Joint_SetConstraintTuning", &b2Joint_SetConstraintTuning);
    // returns { hertz, dampingRatio }
    function("b2Joint_GetConstraintTuning", +[](b2JointId jointId) -> emscripten::val {
        float hertz = 0.0f, dampingRatio = 0.0f;
        b2Joint_GetConstraintTuning(jointId, &hertz, &dampingRatio);
        auto result = emscripten::val::object();
        result.set("hertz", hertz);
        result.set("dampingRatio", dampingRatio);
        return result;
    });
    function("b2Joint_SetForceThreshold", &b2Joint_SetForceThreshold);
    function("b2Joint_GetForceThreshold", &b2Joint_GetForceThreshold);
    function("b2Joint_SetTorqueThreshold", &b2Joint_SetTorqueThreshold);
    function("b2Joint_GetTorqueThreshold", &b2Joint_GetTorqueThreshold);

    function("b2DistanceJoint_SetRestLength", &b2DistanceJoint_SetRestLength);
    function("b2DistanceJoint_GetRestLength", &b2DistanceJoint_GetRestLength);
    function("b2DistanceJoint_EnableSpring", &b2DistanceJoint_EnableSpring);
    function("b2DistanceJoint_IsSpringEnabled", &b2DistanceJoint_IsSpringEnabled);
    function("b2DistanceJoint_SetSpringForceRange", &b2DistanceJoint_SetSpringForceRange);
    // returns { lowerForce, upperForce }
    function("b2DistanceJoint_GetSpringForceRange", +[](b2JointId jointId) -> emscripten::val {
        float lowerForce = 0.0f, upperForce = 0.0f;
        b2DistanceJoint_GetSpringForceRange(jointId, &lowerForce, &upperForce);
        auto result = emscripten::val::object();
        result.set("lowerForce", lowerForce);
        result.set("upperForce", upperForce);
        return result;
    });
    function("b2DistanceJoint_GetSpringForce", &b2DistanceJoint_GetSpringForce);
    function("b2DistanceJoint_SetSpringHertz", &b2DistanceJoint_SetSpringHertz);
    function("b2DistanceJoint_SetSpringDampingRatio", &b2DistanceJoint_SetSpringDampingRatio);
    function("b2DistanceJoint_GetSpringHertz", &b2DistanceJoint_GetSpringHertz);
    function("b2DistanceJoint_GetSpringDampingRatio", &b2DistanceJoint_GetSpringDampingRatio);
    function("b2DistanceJoint_EnableLimit", &b2DistanceJoint_EnableLimit);
    function("b2DistanceJoint_IsLimitEnabled", &b2DistanceJoint_IsLimitEnabled);
    function("b2DistanceJoint_SetLimits", &b2DistanceJoint_SetLimits);
    function("b2DistanceJoint_GetLowerLimit", &b2DistanceJoint_GetLowerLimit);
    function("b2DistanceJoint_GetUpperLimit", &b2DistanceJoint_GetUpperLimit);
    function("b2DistanceJoint_GetCurrentLength", &b2DistanceJoint_GetCurrentLength);
    function("b2DistanceJoint_EnableMotor", &b2DistanceJoint_EnableMotor);
    function("b2DistanceJoint_IsMotorEnabled", &b2DistanceJoint_IsMotorEnabled);
    function("b2DistanceJoint_SetTargetMotorSpeed", &b2DistanceJoint_SetTargetMotorSpeed);
    function("b2DistanceJoint_GetTargetMotorSpeed", &b2DistanceJoint_GetTargetMotorSpeed);
    function("b2DistanceJoint_SetMaxMotorForce", &b2DistanceJoint_SetMaxMotorForce);
    function("b2DistanceJoint_GetMaxMotorForce", &b2DistanceJoint_GetMaxMotorForce);
    function("b2DistanceJoint_GetCurrentMotorForce", &b2DistanceJoint_GetCurrentMotorForce);

    function("b2MotorJoint_SetLinearVelocity", &b2MotorJoint_SetLinearVelocity);
    function("b2MotorJoint_GetLinearVelocity", &b2MotorJoint_GetLinearVelocity);
    function("b2MotorJoint_SetAngularVelocity", &b2MotorJoint_SetAngularVelocity);
    function("b2MotorJoint_GetAngularVelocity", &b2MotorJoint_GetAngularVelocity);
    function("b2MotorJoint_SetMaxVelocityForce", &b2MotorJoint_SetMaxVelocityForce);
    function("b2MotorJoint_GetMaxVelocityForce", &b2MotorJoint_GetMaxVelocityForce);
    function("b2MotorJoint_SetMaxVelocityTorque", &b2MotorJoint_SetMaxVelocityTorque);
    function("b2MotorJoint_GetMaxVelocityTorque", &b2MotorJoint_GetMaxVelocityTorque);
    function("b2MotorJoint_SetLinearHertz", &b2MotorJoint_SetLinearHertz);
    function("b2MotorJoint_GetLinearHertz", &b2MotorJoint_GetLinearHertz);
    function("b2MotorJoint_SetLinearDampingRatio", &b2MotorJoint_SetLinearDampingRatio);
    function("b2MotorJoint_GetLinearDampingRatio", &b2MotorJoint_GetLinearDampingRatio);
    function("b2MotorJoint_SetAngularHertz", &b2MotorJoint_SetAngularHertz);
    function("b2MotorJoint_GetAngularHertz", &b2MotorJoint_GetAngularHertz);
    function("b2MotorJoint_SetAngularDampingRatio", &b2MotorJoint_SetAngularDampingRatio);
    function("b2MotorJoint_GetAngularDampingRatio", &b2MotorJoint_GetAngularDampingRatio);
    function("b2MotorJoint_SetMaxSpringForce", &b2MotorJoint_SetMaxSpringForce);
    function("b2MotorJoint_GetMaxSpringForce", &b2MotorJoint_GetMaxSpringForce);
    function("b2MotorJoint_SetMaxSpringTorque", &b2MotorJoint_SetMaxSpringTorque);
    function("b2MotorJoint_GetMaxSpringTorque", &b2MotorJoint_GetMaxSpringTorque);

    function("b2MoverJoint_SetLinearVelocity", &b2MoverJoint_SetLinearVelocity);
    function("b2MoverJoint_GetLinearVelocity", &b2MoverJoint_GetLinearVelocity);
    function("b2MoverJoint_SetMaxVelocityForce", &b2MoverJoint_SetMaxVelocityForce);
    function("b2MoverJoint_GetMaxVelocityForce", &b2MoverJoint_GetMaxVelocityForce);

    function("b2PogoJoint_SetRestLength", &b2PogoJoint_SetRestLength);
    function("b2PogoJoint_GetRestLength", &b2PogoJoint_GetRestLength);
    function("b2PogoJoint_SetSpringHertz", &b2PogoJoint_SetSpringHertz);
    function("b2PogoJoint_GetSpringHertz", &b2PogoJoint_GetSpringHertz);
    function("b2PogoJoint_SetSpringDampingRatio", &b2PogoJoint_SetSpringDampingRatio);
    function("b2PogoJoint_GetSpringDampingRatio", &b2PogoJoint_GetSpringDampingRatio);
    function("b2PogoJoint_GetCurrentLength", &b2PogoJoint_GetCurrentLength);
    function("b2PogoJoint_GetCurrentSpeed", &b2PogoJoint_GetCurrentSpeed);
    function("b2PogoJoint_GetImpulse", &b2PogoJoint_GetImpulse);

    function("b2PrismaticJoint_EnableSpring", &b2PrismaticJoint_EnableSpring);
    function("b2PrismaticJoint_IsSpringEnabled", &b2PrismaticJoint_IsSpringEnabled);
    function("b2PrismaticJoint_SetSpringHertz", &b2PrismaticJoint_SetSpringHertz);
    function("b2PrismaticJoint_GetSpringHertz", &b2PrismaticJoint_GetSpringHertz);
    function("b2PrismaticJoint_SetSpringDampingRatio", &b2PrismaticJoint_SetSpringDampingRatio);
    function("b2PrismaticJoint_GetSpringDampingRatio", &b2PrismaticJoint_GetSpringDampingRatio);
    function("b2PrismaticJoint_SetTargetTranslation", &b2PrismaticJoint_SetTargetTranslation);
    function("b2PrismaticJoint_GetTargetTranslation", &b2PrismaticJoint_GetTargetTranslation);
    function("b2PrismaticJoint_EnableLimit", &b2PrismaticJoint_EnableLimit);
    function("b2PrismaticJoint_IsLimitEnabled", &b2PrismaticJoint_IsLimitEnabled);
    function("b2PrismaticJoint_GetLowerLimit", &b2PrismaticJoint_GetLowerLimit);
    function("b2PrismaticJoint_GetUpperLimit", &b2PrismaticJoint_GetUpperLimit);
    function("b2PrismaticJoint_SetLimits", &b2PrismaticJoint_SetLimits);
    function("b2PrismaticJoint_EnableMotor", &b2PrismaticJoint_EnableMotor);
    function("b2PrismaticJoint_IsMotorEnabled", &b2PrismaticJoint_IsMotorEnabled);
    function("b2PrismaticJoint_SetTargetMotorSpeed", &b2PrismaticJoint_SetTargetMotorSpeed);
    function("b2PrismaticJoint_GetTargetMotorSpeed", &b2PrismaticJoint_GetTargetMotorSpeed);
    function("b2PrismaticJoint_SetMaxMotorForce", &b2PrismaticJoint_SetMaxMotorForce);
    function("b2PrismaticJoint_GetMaxMotorForce", &b2PrismaticJoint_GetMaxMotorForce);
    function("b2PrismaticJoint_GetCurrentMotorForce", &b2PrismaticJoint_GetCurrentMotorForce);
    function("b2PrismaticJoint_GetCurrentTranslation", &b2PrismaticJoint_GetCurrentTranslation);
    function("b2PrismaticJoint_GetCurrentSpeed", &b2PrismaticJoint_GetCurrentSpeed);

    function("b2RevoluteJoint_EnableSpring", &b2RevoluteJoint_EnableSpring);
    function("b2RevoluteJoint_IsSpringEnabled", &b2RevoluteJoint_IsSpringEnabled);
    function("b2RevoluteJoint_SetSpringHertz", &b2RevoluteJoint_SetSpringHertz);
    function("b2RevoluteJoint_GetSpringHertz", &b2RevoluteJoint_GetSpringHertz);
    function("b2RevoluteJoint_SetSpringDampingRatio", &b2RevoluteJoint_SetSpringDampingRatio);
    function("b2RevoluteJoint_GetSpringDampingRatio", &b2RevoluteJoint_GetSpringDampingRatio);
    function("b2RevoluteJoint_SetTargetAngle", &b2RevoluteJoint_SetTargetAngle);
    function("b2RevoluteJoint_GetTargetAngle", &b2RevoluteJoint_GetTargetAngle);
    function("b2RevoluteJoint_GetCurrentAngle", &b2RevoluteJoint_GetCurrentAngle);
    function("b2RevoluteJoint_GetCurrentSpeed", &b2RevoluteJoint_GetCurrentSpeed);
    function("b2RevoluteJoint_EnableLimit", &b2RevoluteJoint_EnableLimit);
    function("b2RevoluteJoint_IsLimitEnabled", &b2RevoluteJoint_IsLimitEnabled);
    function("b2RevoluteJoint_GetLowerLimit", &b2RevoluteJoint_GetLowerLimit);
    function("b2RevoluteJoint_GetUpperLimit", &b2RevoluteJoint_GetUpperLimit);
    function("b2RevoluteJoint_SetLimits", &b2RevoluteJoint_SetLimits);
    function("b2RevoluteJoint_EnableMotor", &b2RevoluteJoint_EnableMotor);
    function("b2RevoluteJoint_IsMotorEnabled", &b2RevoluteJoint_IsMotorEnabled);
    function("b2RevoluteJoint_SetTargetMotorSpeed", &b2RevoluteJoint_SetTargetMotorSpeed);
    function("b2RevoluteJoint_GetTargetMotorSpeed", &b2RevoluteJoint_GetTargetMotorSpeed);
    function("b2RevoluteJoint_GetCurrentMotorTorque", &b2RevoluteJoint_GetCurrentMotorTorque);
    function("b2RevoluteJoint_SetMaxMotorTorque", &b2RevoluteJoint_SetMaxMotorTorque);
    function("b2RevoluteJoint_GetMaxMotorTorque", &b2RevoluteJoint_GetMaxMotorTorque);

    function("b2WeldJoint_SetLinearHertz", &b2WeldJoint_SetLinearHertz);
    function("b2WeldJoint_GetLinearHertz", &b2WeldJoint_GetLinearHertz);
    function("b2WeldJoint_SetLinearDampingRatio", &b2WeldJoint_SetLinearDampingRatio);
    function("b2WeldJoint_GetLinearDampingRatio", &b2WeldJoint_GetLinearDampingRatio);
    function("b2WeldJoint_SetAngularHertz", &b2WeldJoint_SetAngularHertz);
    function("b2WeldJoint_GetAngularHertz", &b2WeldJoint_GetAngularHertz);
    function("b2WeldJoint_SetAngularDampingRatio", &b2WeldJoint_SetAngularDampingRatio);
    function("b2WeldJoint_GetAngularDampingRatio", &b2WeldJoint_GetAngularDampingRatio);

    function("b2WheelJoint_EnableSpring", &b2WheelJoint_EnableSpring);
    function("b2WheelJoint_IsSpringEnabled", &b2WheelJoint_IsSpringEnabled);
    function("b2WheelJoint_SetSpringHertz", &b2WheelJoint_SetSpringHertz);
    function("b2WheelJoint_GetSpringHertz", &b2WheelJoint_GetSpringHertz);
    function("b2WheelJoint_SetSpringDampingRatio", &b2WheelJoint_SetSpringDampingRatio);
    function("b2WheelJoint_GetSpringDampingRatio", &b2WheelJoint_GetSpringDampingRatio);
    function("b2WheelJoint_EnableLimit", &b2WheelJoint_EnableLimit);
    function("b2WheelJoint_IsLimitEnabled", &b2WheelJoint_IsLimitEnabled);
    function("b2WheelJoint_GetLowerLimit", &b2WheelJoint_GetLowerLimit);
    function("b2WheelJoint_GetUpperLimit", &b2WheelJoint_GetUpperLimit);
    function("b2WheelJoint_SetLimits", &b2WheelJoint_SetLimits);
    function("b2WheelJoint_EnableMotor", &b2WheelJoint_EnableMotor);
    function("b2WheelJoint_IsMotorEnabled", &b2WheelJoint_IsMotorEnabled);
    function("b2WheelJoint_SetTargetMotorSpeed", &b2WheelJoint_SetTargetMotorSpeed);
    function("b2WheelJoint_GetTargetMotorSpeed", &b2WheelJoint_GetTargetMotorSpeed);
    function("b2WheelJoint_SetMaxMotorTorque", &b2WheelJoint_SetMaxMotorTorque);
    function("b2WheelJoint_GetMaxMotorTorque", &b2WheelJoint_GetMaxMotorTorque);
    function("b2WheelJoint_GetCurrentMotorTorque", &b2WheelJoint_GetCurrentMotorTorque);

    // ------------------------------------------------------------------------
    // b2Contact
    // ------------------------------------------------------------------------
    function("b2Contact_IsValid", &b2Contact_IsValid);
    function("b2Contact_GetData", &b2Contact_GetData);

    // ------------------------------------------------------------------------
    // Misc
    // ------------------------------------------------------------------------
    function("b2ComputeHull", optional_override([](const emscripten::val& pointsArray) -> b2Hull {
        int count = pointsArray["length"].as<int>();
        std::vector<b2Vec2> points(count);
        for (int i = 0; i < count; i++) {
            const auto point = pointsArray[i];
            points[i].x = point["x"].as<float>();
            points[i].y = point["y"].as<float>();
        }
        return b2ComputeHull(points.data(), count);
    }));

    // Pack ids into a single value, handy as Map keys. These return BigInt (uint32 for worlds).
    function("b2StoreWorldId", &b2StoreWorldId);
    function("b2LoadWorldId", &b2LoadWorldId);
    function("b2StoreBodyId", &b2StoreBodyId);
    function("b2LoadBodyId", &b2LoadBodyId);
    function("b2StoreShapeId", &b2StoreShapeId);
    function("b2LoadShapeId", &b2LoadShapeId);
    function("b2StoreChainId", &b2StoreChainId);
    function("b2LoadChainId", &b2LoadChainId);
    function("b2StoreJointId", &b2StoreJointId);
    function("b2LoadJointId", &b2LoadJointId);

    function("B2_ID_EQUALS", +[](const emscripten::val& id1, const emscripten::val& id2) -> bool {
        return  id1["index1"].as<int32_t>() == id2["index1"].as<int32_t>() &&
                id1["world0"].as<uint16_t>() == id2["world0"].as<uint16_t>() &&
                id1["generation"].as<uint16_t>() == id2["generation"].as<uint16_t>();
    });

    constant("B2_PI", B2_PI);
    constant("b2Transform_identity", b2Transform_identity);
    constant("b2Pos_zero", b2Pos_zero);
    function("b2IsDoublePrecision", &b2IsDoublePrecision);
    function("b2SetLengthUnitsPerMeter", &b2SetLengthUnitsPerMeter);
    function("b2GetLengthUnitsPerMeter", &b2GetLengthUnitsPerMeter);
    function("b2GetGraphColor", +[](int index) -> uint32_t { return static_cast<uint32_t>(b2GetGraphColor(index)); });
    function("b2Atan2", &b2Atan2);
    function("b2ComputeCosSin", &b2ComputeCosSin);
    function("b2MinInt", &b2MinInt);
    function("b2MaxInt", &b2MaxInt);
    function("b2AbsInt", &b2AbsInt);
    function("b2ClampInt", &b2ClampInt);
    function("b2MinFloat", &b2MinFloat);
    function("b2AbsFloat", &b2AbsFloat);
    function("b2ClampFloat", &b2ClampFloat);
    function("b2Dot", &b2Dot);
    function("b2Cross", &b2Cross);
    function("b2CrossVS", &b2CrossVS);
    function("b2CrossSV", &b2CrossSV);
    function("b2LeftPerp", &b2LeftPerp);
    function("b2RightPerp", &b2RightPerp);
    function("b2Add", &b2Add);
    function("b2Sub", &b2Sub);
    function("b2Neg", &b2Neg);
    function("b2Lerp", &b2Lerp);
    function("b2Mul", &b2Mul);
    function("b2MulSV", &b2MulSV);
    function("b2MulAdd", &b2MulAdd);
    function("b2MulSub", &b2MulSub);
    function("b2Abs", &b2Abs);
    function("b2Min", &b2Min);
    function("b2Max", &b2Max);
    function("b2Clamp", &b2Clamp);
    function("b2Length", &b2Length);
    function("b2Distance", &b2Distance);
    function("b2Normalize", &b2Normalize);
    // returns { length, normal }
    function("b2GetLengthAndNormalize", +[](b2Vec2 v) -> emscripten::val {
        float length = 0.0f;
        b2Vec2 normal = b2GetLengthAndNormalize(&length, v);
        auto result = emscripten::val::object();
        result.set("length", length);
        result.set("normal", normal);
        return result;
    });
    function("b2NormalizeRot", &b2NormalizeRot);
    function("b2IntegrateRotation", &b2IntegrateRotation);
    function("b2LengthSquared", &b2LengthSquared);
    function("b2DistanceSquared", &b2DistanceSquared);
    function("b2MakeRot", &b2MakeRot);
    function("b2MakeRotFromUnitVector", &b2MakeRotFromUnitVector);
    function("b2ComputeRotationBetweenUnitVectors", &b2ComputeRotationBetweenUnitVectors);
    function("b2InvertRot", &b2InvertRot);
    function("b2IsNormalizedRot", &b2IsNormalizedRot);
    function("b2IsNormalized", &b2IsNormalized);
    function("b2NLerp", &b2NLerp);
    function("b2ComputeAngularVelocity", &b2ComputeAngularVelocity);
    function("b2Rot_GetAngle", &b2Rot_GetAngle);
    function("b2Rot_GetXAxis", &b2Rot_GetXAxis);
    function("b2Rot_GetYAxis", &b2Rot_GetYAxis);
    function("b2MulRot", &b2MulRot);
    function("b2InvMulRot", &b2InvMulRot);
    function("b2RelativeAngle", &b2RelativeAngle);
    function("b2UnwindAngle", &b2UnwindAngle);
    function("b2RotateVector", &b2RotateVector);
    function("b2InvRotateVector", &b2InvRotateVector);
    function("b2TransformPoint", &b2TransformPoint);
    function("b2InvTransformPoint", &b2InvTransformPoint);
    function("b2MulTransforms", &b2MulTransforms);
    function("b2InvMulTransforms", &b2InvMulTransforms);
    // Large world helpers. In this single precision build b2Pos is a b2Vec2 and b2WorldTransform is a b2Transform.
    function("b2ToPos", &b2ToPos);
    function("b2ToVec2", &b2ToVec2);
    function("b2SubPos", &b2SubPos);
    function("b2OffsetPos", &b2OffsetPos);
    function("b2LerpPos", &b2LerpPos);
    function("b2TransformWorldPoint", &b2TransformWorldPoint);
    function("b2InvTransformWorldPoint", &b2InvTransformWorldPoint);
    function("b2InvMulWorldTransforms", &b2InvMulWorldTransforms);
    function("b2MulWorldTransforms", &b2MulWorldTransforms);
    function("b2ToRelativeTransform", &b2ToRelativeTransform);
    function("b2MakeWorldTransform", &b2MakeWorldTransform);
    function("b2RoundDownFloat", &b2RoundDownFloat);
    function("b2RoundUpFloat", &b2RoundUpFloat);
    function("b2MulMV", &b2MulMV);
    function("b2MaxFloat", &b2MaxFloat);
    function("b2SpringDamper", &b2SpringDamper);
    function("b2MakeAABB", +[](const emscripten::val& pointsArray, float radius) -> b2AABB {
        int count = pointsArray["length"].as<int>();
        std::vector<b2Vec2> points(count);
        for (int i = 0; i < count; i++) {
            points[i].x = pointsArray[i]["x"].as<float>();
            points[i].y = pointsArray[i]["y"].as<float>();
        }
        return b2MakeAABB(points.data(), count, radius);
    });
    function("b2GetInverse22", &b2GetInverse22);
    function("b2Solve22", &b2Solve22);
    function("b2IsValidPlane", &b2IsValidPlane);
    function("b2AABB_Contains", &b2AABB_Contains);
    function("b2AABB_Center", &b2AABB_Center);
    function("b2AABB_Extents", &b2AABB_Extents);
    function("b2AABB_Union", &b2AABB_Union);
    function("b2AABB_Overlaps", &b2AABB_Overlaps);
    function("b2PlaneSeparation", &b2PlaneSeparation);
    function("b2Hash", +[](uint32_t hash, const emscripten::val& array) -> uint32_t {
        if (!array.instanceof(emscripten::val::global("Uint8Array"))) {
            throw std::runtime_error("Expected a Uint8Array.");
        }
        auto buffer = array["buffer"].as<emscripten::val>();
        size_t length = array["length"].as<size_t>();
        int byteOffset = array["byteOffset"].as<int>();
        auto view = emscripten::val::global("Uint8Array").new_(buffer, byteOffset, length);
        uint32_t result = hash;
        for (size_t i = 0; i < length; i++) {
            result = (result << 5) + result + view[i].as<uint8_t>();
        }
        return result;
    }, allow_raw_pointers());
    constant("B2_HASH_INIT", B2_HASH_INIT);

    // ------------------------------------------------------------------------
    // Random
    // ------------------------------------------------------------------------
    // Reset the sample random number generator, so a scene can be rebuilt identically.
    function("SetRandomSeed", +[](uint32_t seed) { g_seed = seed; });
    function("GetRandomSeed", +[]() { return g_seed; });
    function("RandomInt", &RandomInt);
    function("RandomIntRange", &RandomIntRange);
    function("RandomFloat", &RandomFloat);
    function("RandomFloatRange", &RandomFloatRange);
    function("RandomVec2", &RandomVec2);
    function("RandomPolygon", optional_override([](float extent) -> b2Polygon {
        b2Vec2 points[B2_MAX_POLYGON_VERTICES];
        int count = 3 + RandomInt() % 6;
        for (int i = 0; i < count; ++i) {
            points[i] = RandomVec2(-extent, extent);
        }

        b2Hull hull = b2ComputeHull(points, count);
        if (hull.count > 0) {
            return b2MakePolygon(&hull, 0.0f);
        }

        return b2MakeSquare(extent);
    }));
}
