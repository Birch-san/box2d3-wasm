#include <box2d/box2d.h>
#include <box2cpp/box2cpp.h>
#include <emscripten.h>
#include <emscripten/bind.h>

using namespace emscripten;
using namespace b2;

// EMSCRIPTEN_DECLARE_VAL_TYPE(b2TaskCallback)
// EMSCRIPTEN_DECLARE_VAL_TYPE(b2EnqueueTaskCallback)


emscripten::val b2ShapeDef_getUserData(const b2ShapeDef& self) {
    return emscripten::val(reinterpret_cast<std::uintptr_t>(self.userData));
}
void b2ShapeDef_setUserData(b2ShapeDef& self, const emscripten::val& value) {
    self.userData = reinterpret_cast<void*>(value.as<std::uintptr_t>());
}

static double b2Filter_getCategoryBits(const b2Filter &f) {
    return (double)f.categoryBits;
}
static void b2Filter_setCategoryBits(b2Filter &f, double val) {
    f.categoryBits = (uint64_t)val;
}
static double b2Filter_getMaskBits(const b2Filter &f) {
    return (double)f.maskBits;
}
static void b2Filter_setMaskBits(b2Filter &f, double val) {
    f.maskBits = (uint64_t)val;
}

EMSCRIPTEN_BINDINGS(box2d) {
    class_<b2Vec2>("b2Vec2")
        .constructor()
        .property("x", &b2Vec2::x)
        .property("y", &b2Vec2::y)
        ;

    class_<b2CosSin>("b2CosSin")
        .constructor()
        .property("cosine", &b2CosSin::cosine)
        .property("sine", &b2CosSin::sine)
        ;

    class_<b2Rot>("b2Rot")
        .constructor()
        .property("c", &b2Rot::c)
        .property("s", &b2Rot::s)
        ;

    class_<b2Transform>("b2Transform")
        .constructor()
        .property("p", &b2Transform::p, return_value_policy::reference())
        .property("q", &b2Transform::q, return_value_policy::reference())
        ;

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

    enum_<b2MixingRule>("b2MixingRule")
        .value("b2_mixAverage", b2MixingRule::b2_mixAverage)
        .value("b2_mixGeometricMean", b2MixingRule::b2_mixGeometricMean)
        .value("b2_mixMultiply", b2MixingRule::b2_mixMultiply)
        .value("b2_mixMinimum", b2MixingRule::b2_mixMinimum)
        .value("b2_mixMaximum", b2MixingRule::b2_mixMaximum)
        ;

    class_<b2WorldDef>("b2WorldDef")
        .constructor()
        .constructor<const b2WorldDef&>()
        .property("gravity", &b2WorldDef::gravity, return_value_policy::reference())
        .property("restitutionThreshold", &b2WorldDef::restitutionThreshold)
        .property("contactPushoutVelocity", &b2WorldDef::contactPushoutVelocity)
        .property("hitEventThreshold", &b2WorldDef::hitEventThreshold)
        .property("contactHertz", &b2WorldDef::contactHertz)
        .property("contactDampingRatio", &b2WorldDef::contactDampingRatio)
        .property("jointHertz", &b2WorldDef::jointHertz)
        .property("jointDampingRatio", &b2WorldDef::jointDampingRatio)
        .property("maximumLinearVelocity", &b2WorldDef::maximumLinearVelocity)
        .property("frictionMixingRule", &b2WorldDef::frictionMixingRule)
        .property("restitutionMixingRule", &b2WorldDef::restitutionMixingRule)
        .property("enableSleep", &b2WorldDef::enableSleep)
        .property("enableContinuous", &b2WorldDef::enableContinuous)
        .property("workerCount", &b2WorldDef::workerCount)
        // .property("enqueueTask", &b2WorldDef::enqueueTask, allow_raw_pointers())
        // .property("finishTask", &b2WorldDef::finishTask, allow_raw_pointers())
        // .property("userTaskContext", &b2WorldDef::userTaskContext, allow_raw_pointers())
        // .property("userData", &b2WorldDef::userData, allow_raw_pointers())
        .property("internalValue", &b2WorldDef::internalValue)
        ;

    // reference return policy doesn't work here
    function("b2DefaultWorldDef", &b2DefaultWorldDef);

    class_<b2::World>("World")
        .constructor()
        .constructor<const b2WorldDef&>()
        ;

     class_<b2Circle>("b2Circle")
        .constructor()
        .property("center", &b2Circle::center)
        .property("radius", &b2Circle::radius)
        ;

    class_<b2Capsule>("b2Capsule")
        .constructor()
        .property("center1", &b2Capsule::center1)
        .property("center2", &b2Capsule::center2)
        .property("radius", &b2Capsule::radius)
        ;

    class_<b2Segment>("b2Segment")
        .constructor()
        .property("point1", &b2Segment::point1)
        .property("point2", &b2Segment::point2)
        ;

    class_<b2Filter>("b2Filter")
        .constructor()
        .property("categoryBits", &b2Filter_getCategoryBits, &b2Filter_setCategoryBits)
        .property("maskBits", &b2Filter_getMaskBits, &b2Filter_setMaskBits)
        .property("groupIndex", &b2Filter::groupIndex);

    class_<b2ShapeDef>("b2ShapeDef")
        .constructor()
        .property("userData", &b2ShapeDef_getUserData, &b2ShapeDef_setUserData)
        .property("friction", &b2ShapeDef::friction)
        .property("restitution", &b2ShapeDef::restitution)
        .property("density", &b2ShapeDef::density)
        .property("filter", &b2ShapeDef::filter)
        .property("customColor", &b2ShapeDef::customColor)
        .property("isSensor", &b2ShapeDef::isSensor)
        .property("enableSensorEvents", &b2ShapeDef::enableSensorEvents)
        .property("enableContactEvents", &b2ShapeDef::enableContactEvents)
        .property("enableHitEvents", &b2ShapeDef::enableHitEvents)
        .property("enablePreSolveEvents", &b2ShapeDef::enablePreSolveEvents)
        .property("invokeContactCreation", &b2ShapeDef::invokeContactCreation)
        .property("updateBodyMass", &b2ShapeDef::updateBodyMass)
        ;

    class_<b2Polygon>("b2Polygon")
        .constructor()
        .function("getVertex", +[](const b2Polygon& self, int index) -> b2Vec2 {
            if (index < 0 || index >= b2_maxPolygonVertices) return b2Vec2();
            return self.vertices[index];
        })
        .function("setVertex", +[](b2Polygon& self, int index, const b2Vec2& value) {
            if (index >= 0 && index < b2_maxPolygonVertices) {
                self.vertices[index] = value;
            }
        })
        .function("getNormal", +[](const b2Polygon& self, int index) -> b2Vec2 {
            if (index < 0 || index >= b2_maxPolygonVertices) return b2Vec2();
            return self.normals[index];
        })
        .function("setNormal", +[](b2Polygon& self, int index, const b2Vec2& value) {
            if (index >= 0 && index < b2_maxPolygonVertices) {
                self.normals[index] = value;
            }
        })
        .property("centroid", &b2Polygon::centroid)
        .property("radius", &b2Polygon::radius)
        .property("count", &b2Polygon::count)
        .class_function("getMaxVertices", +[]() { return b2_maxPolygonVertices; })
    ;

    function("b2MakeBox", &b2MakeBox);
    function("b2MakeSquare", &b2MakeSquare);
    function("b2MakeRoundedBox", &b2MakeRoundedBox);
    function("b2MakeOffsetBox", &b2MakeOffsetBox);
    function("b2MakeOffsetRoundedBox", &b2MakeOffsetRoundedBox);

    class_<BasicShapeInterface<Shape, false>>("BasicShapeInterface")
        .function("destroy", &BasicShapeInterface<Shape, false>::Destroy)
        .function("isValid", &BasicShapeInterface<Shape, false>::IsValid)
        .function("getAABB", &BasicShapeInterface<Shape, false>::GetAABB)
        .function("getDensity", &BasicShapeInterface<Shape, false>::GetDensity)
        .function("setDensity", &BasicShapeInterface<Shape, false>::SetDensity)
        .function("getFilter", &BasicShapeInterface<Shape, false>::GetFilter)
        .function("setFilter", &BasicShapeInterface<Shape, false>::SetFilter)
        .function("getFriction", &BasicShapeInterface<Shape, false>::GetFriction)
        .function("setFriction", &BasicShapeInterface<Shape, false>::SetFriction)
        ;

    class_<Shape, base<BasicShapeInterface<Shape, false>>>("Shape")
        .constructor<>()
        .function("destroy", &Shape::Destroy)
        .function("isValid", &Shape::IsValid)
        .function("getAABB", &Shape::GetAABB)
        .function("getDensity", &Shape::GetDensity)
        .function("setDensity", &Shape::SetDensity)
        .function("getFilter", &Shape::GetFilter)
        .function("setFilter", &Shape::SetFilter)
        .function("getFriction", &Shape::GetFriction)
        .function("setFriction", &Shape::SetFriction)
        .function("getUserData", +[](const Shape& self) {
            return emscripten::val(static_cast<double>(reinterpret_cast<std::uintptr_t>(self.GetUserData())));
        })
        .function("setUserData", +[](Shape& self, const emscripten::val& value) {
            self.SetUserData(reinterpret_cast<void*>(static_cast<std::uintptr_t>(value.as<double>())));
        })
        ;
}
