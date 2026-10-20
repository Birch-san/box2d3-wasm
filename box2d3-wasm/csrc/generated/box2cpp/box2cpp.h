#pragma once

// box2cpp, C++ bindings for box2d 3.x
// Generated from box2d commit: 178495b 2026-10-18
// Generator version: 0.16

#include <box2d/box2d.h>

#include <concepts>
#include <cstddef>
#include <functional>
#include <span>
#include <stdexcept>
#include <type_traits>
#include <utility>
#include <vector>

#ifndef BOX2CPP_ASSERT
#include <cassert>
#define BOX2CPP_ASSERT(...) assert(__VA_ARGS__)
#endif

namespace b2
{
    namespace Tags
    {
        struct OwningHandle { explicit OwningHandle() = default; };
        struct DestroyWithParent { explicit DestroyWithParent() = default; };

        template <typename T>
        concept OwnershipTag = std::same_as<T, OwningHandle> || std::same_as<T, DestroyWithParent>;
    }

    // Pass to `Create...()` if you want the resulting object to destroy this thing in its destructor.
    inline constexpr Tags::OwningHandle OwningHandle{};

    // Pass to `Create...()` if you want the parent object (that you're calling this on) to destroy this thing in its destructor. You'll receive a non-owning reference.
    inline constexpr Tags::DestroyWithParent DestroyWithParent{};


    template <bool IsConstRef> class MaybeConstWorldRef;
    using WorldRef = MaybeConstWorldRef<false>;
    using WorldConstRef = MaybeConstWorldRef<true>;
    template <bool IsConstRef> class MaybeConstBodyRef;
    using BodyRef = MaybeConstBodyRef<false>;
    using BodyConstRef = MaybeConstBodyRef<true>;
    template <bool IsConstRef> class MaybeConstShapeRef;
    using ShapeRef = MaybeConstShapeRef<false>;
    using ShapeConstRef = MaybeConstShapeRef<true>;
    template <bool IsConstRef> class MaybeConstChainRef;
    using ChainRef = MaybeConstChainRef<false>;
    using ChainConstRef = MaybeConstChainRef<true>;
    template <bool IsConstRef> class MaybeConstJointRef;
    using JointRef = MaybeConstJointRef<false>;
    using JointConstRef = MaybeConstJointRef<true>;
    template <bool IsConstRef> class MaybeConstDistanceJointRef;
    using DistanceJointRef = MaybeConstDistanceJointRef<false>;
    using DistanceJointConstRef = MaybeConstDistanceJointRef<true>;
    template <bool IsConstRef> class MaybeConstMotorJointRef;
    using MotorJointRef = MaybeConstMotorJointRef<false>;
    using MotorJointConstRef = MaybeConstMotorJointRef<true>;
    template <bool IsConstRef> class MaybeConstMoverJointRef;
    using MoverJointRef = MaybeConstMoverJointRef<false>;
    using MoverJointConstRef = MaybeConstMoverJointRef<true>;
    template <bool IsConstRef> class MaybeConstPogoJointRef;
    using PogoJointRef = MaybeConstPogoJointRef<false>;
    using PogoJointConstRef = MaybeConstPogoJointRef<true>;
    template <bool IsConstRef> class MaybeConstPrismaticJointRef;
    using PrismaticJointRef = MaybeConstPrismaticJointRef<false>;
    using PrismaticJointConstRef = MaybeConstPrismaticJointRef<true>;
    template <bool IsConstRef> class MaybeConstRevoluteJointRef;
    using RevoluteJointRef = MaybeConstRevoluteJointRef<false>;
    using RevoluteJointConstRef = MaybeConstRevoluteJointRef<true>;
    template <bool IsConstRef> class MaybeConstWeldJointRef;
    using WeldJointRef = MaybeConstWeldJointRef<false>;
    using WeldJointConstRef = MaybeConstWeldJointRef<true>;
    template <bool IsConstRef> class MaybeConstWheelJointRef;
    using WheelJointRef = MaybeConstWheelJointRef<false>;
    using WheelJointConstRef = MaybeConstWheelJointRef<true>;

    class Recording;

    namespace detail
    {
        // Map box2d IDs to our reference types. Specific joint types aren't there, since they don't have their own ID types.
        template <typename T, bool IsConst> struct Box2dIdToRef { static constexpr bool IsIdType = false; };
        template <bool IsConst> struct Box2dIdToRef<b2WorldId, IsConst> { static constexpr bool IsIdType = true; using type = MaybeConstWorldRef<IsConst>; };
        template <bool IsConst> struct Box2dIdToRef<b2BodyId, IsConst> { static constexpr bool IsIdType = true; using type = MaybeConstBodyRef<IsConst>; };
        template <bool IsConst> struct Box2dIdToRef<b2ShapeId, IsConst> { static constexpr bool IsIdType = true; using type = MaybeConstShapeRef<IsConst>; };
        template <bool IsConst> struct Box2dIdToRef<b2ChainId, IsConst> { static constexpr bool IsIdType = true; using type = MaybeConstChainRef<IsConst>; };
        template <bool IsConst> struct Box2dIdToRef<b2JointId, IsConst> { static constexpr bool IsIdType = true; using type = MaybeConstJointRef<IsConst>; };

        // Adjust one of the callback arguments, replacing raw box2d IDs with our reference types.
        template <bool IsConst, typename T>
        T &&AdjustCallbackArg(T &&arg) {return std::forward<T>(arg);}
        template <bool IsConst, typename T> requires Box2dIdToRef<std::remove_cvref_t<T>, IsConst>::IsIdType
        typename Box2dIdToRef<std::remove_cvref_t<T>, IsConst>::type AdjustCallbackArg(T &&arg) {return arg;}

        // Given a function type `R(P..., void *)`, returns `R(P...)`. Otherwise causes a hard error.
        template <typename T, typename U = void>
        struct StripTrailingVoidPtrParam;
        template <typename R, typename ...P>
        struct StripTrailingVoidPtrParam<R(P...), void>
        {
            using type = typename StripTrailingVoidPtrParam<R(P...), R()>::type;
        };
        template <typename R, typename P0, typename P1, typename ...P, typename ...Q>
        struct StripTrailingVoidPtrParam<R(P0, P1, P...), R(Q...)>
        {
            using type = typename StripTrailingVoidPtrParam<R(P1, P...), R(Q..., P0)>::type;
        };
        template <typename R, typename ...Q>
        struct StripTrailingVoidPtrParam<R(void *), R(Q...)>
        {
            using type = R(Q...);
        };

        // Helper for `FuncRef` below.
        template <typename T, bool IsConst>
        class FuncRefBase {};
        template <typename R, typename ...P, bool IsConst>
        class FuncRefBase<R(P...), IsConst>
        {
            using CallerType = R (*)(P..., void *);
            CallerType caller = nullptr;
            void *context = nullptr;

          public:
            template <typename F>
            requires std::same_as<std::invoke_result_t<F &&, decltype((AdjustCallbackArg<IsConst>)(std::declval<P>()))...>, R>
            constexpr FuncRefBase(F &&func)
                : caller([](P ...params, void *context) -> R {return std::invoke(std::forward<F>(*static_cast<std::remove_cvref_t<F> *>(context)), (AdjustCallbackArg<IsConst>)(std::forward<P>(params))...);}),
                context(&func)
            {}

            [[nodiscard]] constexpr CallerType GetFunc() const {return caller;}
            [[nodiscard]] constexpr void *GetContext() const {return context;}
        };

        // Acts as `std::function_ref` for our callbacks. Converts the incoming functors into a C-style pointer plus a `void *`.
        template <typename T, bool IsConst>
        class FuncRef : public detail::FuncRefBase<typename detail::StripTrailingVoidPtrParam<T>::type, IsConst>
        {
            using base = detail::FuncRefBase<typename detail::StripTrailingVoidPtrParam<T>::type, IsConst>;
            using base::base;
        };
    }


    template <typename D, bool ForceConst>
    class BasicChainInterface
    {
      protected:
        BasicChainInterface() = default;

      public:
        [[nodiscard]] explicit operator bool() const { return B2_IS_NON_NULL(Handle()); }
        [[nodiscard]] const b2ChainId &Handle() const { return static_cast<const D &>(*this).id; }
        // Convert to a handle. Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // I want this to return a const reference, but GCC 13 and earlier choke on that (fixed in 14). GCC bug: https://gcc.gnu.org/bugzilla/show_bug.cgi?id=61663
        template <std::same_as<b2ChainId> T> [[nodiscard]] operator T() const { return Handle(); }

        /// Destroy a chain shape
        void Destroy() /*non-const*/ requires (!ForceConst);

        /// Chain identifier validation. Provides validation for up to 64K allocations.
        [[nodiscard]] bool IsValid() const;

        /// Set the chain material on all segments.
        void SetAllSurfaceMaterials(const b2SurfaceMaterial& material) /*non-const*/ requires (!ForceConst);

        /// Get the number of segments on this chain
        [[nodiscard]] int GetSegmentCount() const;

        /// Fill a user array with chain segment shape ids up to the specified capacity. Returns the actual
        /// number of segments returned.
        [[nodiscard]] int GetSegments(b2ShapeId* segmentArray, int capacity) const;

        /// Set a chain material by segment index.
        void SetSurfaceMaterial(const b2SurfaceMaterial& material, int segmentIndex) /*non-const*/ requires (!ForceConst);

        /// Get a chain material by segment index.
        [[nodiscard]] b2SurfaceMaterial GetSurfaceMaterial(int segmentIndex) const;

        /// Get the world that owns this chain shape
        [[nodiscard]] WorldRef GetWorld() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] WorldConstRef GetWorld() const;
    };

    /// Used to create a chain of line segments. This is designed to eliminate ghost collisions with
    /// some limitations.
    /// - chains are one-sided
    /// - chains have no mass and should be used on static bodies
    /// - chains have a counter-clockwise winding order (normal points right of segment direction)
    /// - chains are either a loop or open
    /// - the distance between any two points must be greater than B2_LINEAR_SLOP
    /// - a chain shape should not self intersect (this is not validated)
    /// - an open chain shape needs a leading and trailing ghost point.
    /// - you may overlap two open chains using the ghost points to get smooth collision.
    /// - a chain shape creates multiple line segment shapes on the body
    /// https://en.wikipedia.org/wiki/Polygonal_chain
    /// Must be initialized using b2DefaultChainDef().
    /// @warning Do not use chain shapes unless you understand the limitations. This is an advanced
    /// feature.
    /// @ingroup chain
    class Chain : public BasicChainInterface<Chain, false>
    {
        template <typename, bool>
        friend class BasicChainInterface;
        template <typename, bool>
        friend class BasicBodyInterface;

      protected:
        b2ChainId id{};

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr Chain() noexcept {}

        // The constructor accepts either this or directly `b2ChainDef`.
        struct Params : b2ChainDef
        {
            Params() : b2ChainDef(b2DefaultChainDef()) {}
        };

        Chain(Chain&& other) noexcept { id = std::exchange(other.id, b2ChainId{}); }
        Chain& operator=(Chain other) noexcept { std::swap(id, other.id); return *this; }

        ~Chain() { if (*this) Destroy(); }
    };

    template <bool IsConstRef>
    class MaybeConstChainRef : public BasicChainInterface<MaybeConstChainRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicChainInterface;

      protected:
        b2ChainId id{};

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstChainRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        constexpr MaybeConstChainRef(std::same_as<b2ChainId> auto id) noexcept { this->id = id; }

        // Create from a non-reference.
        constexpr MaybeConstChainRef(const Chain& other) noexcept : MaybeConstChainRef(other.Handle()) {}

        // Convert a non-const reference to a const reference.
        constexpr MaybeConstChainRef(const MaybeConstChainRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstChainRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicShapeInterface
    {
      protected:
        BasicShapeInterface() = default;

      public:
        [[nodiscard]] explicit operator bool() const { return B2_IS_NON_NULL(Handle()); }
        [[nodiscard]] const b2ShapeId &Handle() const { return static_cast<const D &>(*this).id; }
        // Convert to a handle. Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // I want this to return a const reference, but GCC 13 and earlier choke on that (fixed in 14). GCC bug: https://gcc.gnu.org/bugzilla/show_bug.cgi?id=61663
        template <std::same_as<b2ShapeId> T> [[nodiscard]] operator T() const { return Handle(); }

        /// Destroy a shape. You may defer the body mass update which can improve performance if several
        /// shapes on a body are destroyed at once.
        /// @see b2Body_UpdateMassFromShapes
        void Destroy(bool updateBodyMass) /*non-const*/ requires (!ForceConst);

        /// Shape identifier validation. Provides validation for up to 64K allocations.
        [[nodiscard]] bool IsValid() const;

        /// Allows you to change a shape to be a capsule or update the current capsule. This does not modify
        /// the mass properties.
        /// @see b2Body_UpdateMassFromShapes
        void Set(const b2Capsule& capsule) /*non-const*/ requires (!ForceConst);

        /// Allows you to change a shape to be a loose chain segment or update the current chain segment.
        /// The resulting shape does not belong to a chain shape. Asserts if the shape is already a chain
        /// segment owned by a chain shape (chainId != B2_NULL_INDEX).
        void Set(const b2ChainSegment& chainSegment) /*non-const*/ requires (!ForceConst);

        /// Allows you to change a shape to be a circle or update the current circle. This does not modify
        /// the mass properties.
        /// @see b2Body_UpdateMassFromShapes
        void Set(const b2Circle& circle) /*non-const*/ requires (!ForceConst);

        /// Allows you to change a shape to be a polygon or update the current polygon. This does not modify
        /// the mass properties.
        /// @see b2Body_UpdateMassFromShapes
        void Set(const b2Polygon& polygon) /*non-const*/ requires (!ForceConst);

        /// Allows you to change a shape to be a segment or update the current segment.
        void Set(const b2Segment& segment) /*non-const*/ requires (!ForceConst);

        /// Apply a wind force to the body for this shape using the density of air. This considers the
        /// projected area of the shape in the wind direction. This also considers the relative velocity of
        /// the shape.
        /// @param shapeId the shape id
        /// @param wind the wind velocity in world space
        /// @param drag the drag coefficient, the force that opposes the relative velocity
        /// @param lift the lift coefficient, the force that is perpendicular to the relative velocity
        /// @param wake should this wake the body
        void ApplyWind(b2Vec2 wind, float drag, float lift, bool wake) /*non-const*/ requires (!ForceConst);

        /// Get the id of the body that a shape is attached to
        [[nodiscard]] BodyRef GetBody() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] BodyConstRef GetBody() const;

        /// Get the current world AABB
        [[nodiscard]] b2AABB GetBounds() const;

        /// Get a copy of the shape's capsule. Asserts the type is correct.
        [[nodiscard]] b2Capsule GetCapsule() const;

        /// Ray cast a single shape. The ray starts at the origin and extends by the translation. The output
        /// point is a world position.
        [[nodiscard]] b2WorldCastOutput CastRay(b2Pos origin, b2Vec2 translation) const;

        /// Get a copy of the shape's chain segment. These come from chain shapes. Asserts the type is
        /// correct.
        [[nodiscard]] b2ChainSegment GetChainSegment() const;

        /// Get a copy of the shape's circle. Asserts the type is correct.
        [[nodiscard]] b2Circle GetCircle() const;

        /// Get the closest point on a shape to a target point. Target and result are world positions.
        [[nodiscard]] b2Pos GetClosestPoint(b2Pos target) const;

        /// Compute the mass data for a shape
        [[nodiscard]] b2MassData ComputeMassData() const;

        /// Get the maximum capacity required for retrieving all the touching contacts on a shape
        [[nodiscard]] int GetContactCapacity() const;

        /// Get the touching contact data for a shape. The provided shapeId will be either shapeIdA or
        /// shapeIdB on the contact data.
        /// @note Box2D uses speculative collision so some contact points may be separated.
        /// @returns the number of elements filled in the provided array
        /// @warning do not ignore the return value, it specifies the valid number of elements
        [[nodiscard]] int GetContactData(b2ContactData* contactData, int capacity) const;

        /// Enable contact events for this shape. Only applies to kinematic and dynamic bodies. Ignored for
        /// sensors.
        /// @see b2ShapeDef::enableContactEvents
        /// @warning changing this at run-time may lead to lost begin/end events
        void EnableContactEvents(bool flag) /*non-const*/ requires (!ForceConst);

        /// Returns true if contact events are enabled
        [[nodiscard]] bool AreContactEventsEnabled() const;

        /// Set the mass density of a shape, usually in kg/m^2. This will optionally update the mass
        /// properties on the parent body.
        /// @see b2ShapeDef::density, b2Body_UpdateMassFromShapes
        void SetDensity(float density, bool updateBodyMass) /*non-const*/ requires (!ForceConst);

        /// Get the density of a shape, usually in kg/m^2
        [[nodiscard]] float GetDensity() const;

        /// Set the current filter. This is almost as expensive as recreating the shape. This may cause
        /// contacts to be immediately destroyed. However contacts are not created until the next world
        /// step. Sensor overlap state is also not updated until the next world step.
        /// @see b2ShapeDef::filter
        void SetFilter(b2Filter filter) /*non-const*/ requires (!ForceConst);

        /// Get the shape filter
        [[nodiscard]] b2Filter GetFilter() const;

        /// Set the friction on a shape
        void SetFriction(float friction) /*non-const*/ requires (!ForceConst);

        /// Get the friction of a shape
        [[nodiscard]] float GetFriction() const;

        /// Enable contact hit events for this shape. Ignored for sensors.
        /// @see b2WorldDef::hitEventThreshold
        void EnableHitEvents(bool flag) /*non-const*/ requires (!ForceConst);

        /// Returns true if hit events are enabled
        [[nodiscard]] bool AreHitEventsEnabled() const;

        /// Get the parent chain id if the shape type is a chain segment, otherwise returns b2_nullChainId.
        [[nodiscard]] ChainRef GetParentChain() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] ChainConstRef GetParentChain() const;

        /// Get a copy of the shape's convex polygon. Asserts the type is correct.
        [[nodiscard]] b2Polygon GetPolygon() const;

        /// Enable pre-solve contact events for this shape. Only applies to dynamic bodies. These are
        /// expensive and must be carefully handled due to multithreading. Ignored for sensors.
        /// @see b2PreSolveCallbackFcn
        void EnablePreSolveEvents(bool flag) /*non-const*/ requires (!ForceConst);

        /// Returns true if pre-solve events are enabled
        [[nodiscard]] bool ArePreSolveEventsEnabled() const;

        /// Set the shape restitution (bounciness)
        void SetRestitution(float restitution) /*non-const*/ requires (!ForceConst);

        /// Get the shape restitution
        [[nodiscard]] float GetRestitution() const;

        /// Get a copy of the shape's line segment. Asserts the type is correct.
        [[nodiscard]] b2Segment GetSegment() const;

        /// Returns true if the shape is a sensor. It is not possible to change a shape from sensor to solid
        /// dynamically because this breaks the contract for sensor events.
        [[nodiscard]] bool IsSensor() const;

        /// Get the maximum capacity required for retrieving all the overlapped shapes on a sensor shape.
        /// This returns 0 if the provided shape is not a sensor.
        /// @param shapeId the id of a sensor shape
        /// @returns the required capacity to get all the overlaps in b2Shape_GetSensorData
        [[nodiscard]] int GetSensorCapacity() const;

        /// Get the overlap data for a sensor shape computed during the previous world step.
        /// @param shapeId the id of a sensor shape
        /// @param visitorIds a user allocated array that is filled with the overlapping shapes (visitors)
        /// @param capacity the capacity of visitorIds
        /// @returns the number of elements filled in the provided array
        /// @warning do not ignore the return value, it specifies the valid number of elements
        /// @warning overlaps may contain destroyed shapes so use b2Shape_IsValid to confirm each overlap
        [[nodiscard]] int GetSensorData(b2ShapeId* visitorIds, int capacity) const;

        /// Enable sensor events for this shape.
        /// @see b2ShapeDef::enableSensorEvents
        void EnableSensorEvents(bool flag) /*non-const*/ requires (!ForceConst);

        /// Returns true if sensor events are enabled.
        [[nodiscard]] bool AreSensorEventsEnabled() const;

        /// Set the shape surface material
        void SetSurfaceMaterial(const b2SurfaceMaterial& surfaceMaterial) /*non-const*/ requires (!ForceConst);

        /// Get the shape surface material
        [[nodiscard]] b2SurfaceMaterial GetSurfaceMaterial() const;

        /// Test a world point for overlap with a shape
        [[nodiscard]] bool TestPoint(b2Pos point) const;

        /// Get the type of a shape
        [[nodiscard]] b2ShapeType GetType() const;

        /// Set the user data for a shape
        void SetUserData(void* userData) /*non-const*/ requires (!ForceConst);

        /// Get the user data for a shape. This is useful when you get a shape id from an event or query.
        [[nodiscard]] void* GetUserData() const;

        /// Set the user material identifier
        void SetUserMaterial(uint64_t material) /*non-const*/ requires (!ForceConst);

        /// Get the user material identifier
        [[nodiscard]] uint64_t GetUserMaterial() const;

        /// Get the world that owns this shape
        [[nodiscard]] WorldRef GetWorld() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] WorldConstRef GetWorld() const;
    };

    /// Used to create a shape. This is a temporary object used to bundle shape creation parameters. You
    /// may use the same shape definition to create multiple shapes. Must be initialized using
    /// b2DefaultShapeDef().
    /// @ingroup shape
    class Shape : public BasicShapeInterface<Shape, false>
    {
        template <typename, bool>
        friend class BasicShapeInterface;
        template <typename, bool>
        friend class BasicBodyInterface;

      protected:
        b2ShapeId id{};

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr Shape() noexcept {}

        // The constructor accepts either this or directly `b2ShapeDef`.
        struct Params : b2ShapeDef
        {
            Params() : b2ShapeDef(b2DefaultShapeDef()) {}
        };

        Shape(Shape&& other) noexcept { id = std::exchange(other.id, b2ShapeId{}); }
        Shape& operator=(Shape other) noexcept { std::swap(id, other.id); return *this; }

        ~Shape() { if (*this) Destroy(true); } // Update mass by default. Call `Destroy(false)` manually if you don't want this.
    };

    template <bool IsConstRef>
    class MaybeConstShapeRef : public BasicShapeInterface<MaybeConstShapeRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicShapeInterface;

      protected:
        b2ShapeId id{};

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstShapeRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        constexpr MaybeConstShapeRef(std::same_as<b2ShapeId> auto id) noexcept { this->id = id; }

        // Create from a non-reference.
        constexpr MaybeConstShapeRef(const Shape& other) noexcept : MaybeConstShapeRef(other.Handle()) {}

        // Convert a non-const reference to a const reference.
        constexpr MaybeConstShapeRef(const MaybeConstShapeRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstShapeRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicJointInterface
    {
      protected:
        BasicJointInterface() = default;

      public:
        [[nodiscard]] explicit operator bool() const { return B2_IS_NON_NULL(Handle()); }
        [[nodiscard]] const b2JointId &Handle() const { return static_cast<const D &>(*this).id; }
        // Convert to a handle. Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // I want this to return a const reference, but GCC 13 and earlier choke on that (fixed in 14). GCC bug: https://gcc.gnu.org/bugzilla/show_bug.cgi?id=61663
        template <std::same_as<b2JointId> T> [[nodiscard]] operator T() const { return Handle(); }

        /// Destroy a joint.
        void Destroy() /*non-const*/ requires (!ForceConst);

        /// Joint identifier validation. Provides validation for up to 64K allocations.
        [[nodiscard]] bool IsValid() const;

        /// Get the current angular separation error for this joint. Does not consider admissible movement.
        /// Radians.
        [[nodiscard]] float GetAngularSeparation() const;

        /// Get body A id on a joint
        [[nodiscard]] BodyRef GetBodyA() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] BodyConstRef GetBodyA() const;

        /// Get body B id on a joint
        [[nodiscard]] BodyRef GetBodyB() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] BodyConstRef GetBodyB() const;

        /// Toggle collision between connected bodies
        void SetCollideConnected(bool shouldCollide) /*non-const*/ requires (!ForceConst);

        /// Is collision allowed between connected bodies?
        [[nodiscard]] bool GetCollideConnected() const;

        /// Get the current constraint force for this joint. Usually in Newtons.
        [[nodiscard]] b2Vec2 GetConstraintForce() const;

        /// Get the current constraint torque for this joint. Usually in Newton * meters.
        [[nodiscard]] float GetConstraintTorque() const;

        /// Set the joint constraint tuning. Advanced feature.
        /// @param jointId the joint
        /// @param hertz the stiffness in Hertz (cycles per second)
        /// @param dampingRatio the non-dimensional damping ratio (one for critical damping)
        void SetConstraintTuning(float hertz, float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the joint constraint tuning. Advanced feature.
        void GetConstraintTuning(float* hertz, float* dampingRatio) const;

        /// Set the force threshold for joint events (Newtons)
        void SetForceThreshold(float threshold) /*non-const*/ requires (!ForceConst);

        /// Get the force threshold for joint events (Newtons)
        [[nodiscard]] float GetForceThreshold() const;

        /// Get the current linear separation error for this joint. Does not consider admissible movement.
        /// Usually in meters.
        [[nodiscard]] float GetLinearSeparation() const;

        /// Set the local frame on bodyA
        void SetLocalFrameA(b2Transform localFrame) /*non-const*/ requires (!ForceConst);

        /// Get the local frame on bodyA
        [[nodiscard]] b2Transform GetLocalFrameA() const;

        /// Set the local frame on bodyB
        void SetLocalFrameB(b2Transform localFrame) /*non-const*/ requires (!ForceConst);

        /// Get the local frame on bodyB
        [[nodiscard]] b2Transform GetLocalFrameB() const;

        /// Set the torque threshold for joint events (N-m)
        void SetTorqueThreshold(float threshold) /*non-const*/ requires (!ForceConst);

        /// Get the torque threshold for joint events (N-m)
        [[nodiscard]] float GetTorqueThreshold() const;

        /// Get the joint type
        [[nodiscard]] b2JointType GetType() const;

        /// Set the user data on a joint
        void SetUserData(void* userData) /*non-const*/ requires (!ForceConst);

        /// Get the user data on a joint
        [[nodiscard]] void* GetUserData() const;

        /// Wake the bodies connected to this joint
        void WakeBodies() /*non-const*/ requires (!ForceConst);

        /// Get the world that owns this joint
        [[nodiscard]] WorldRef GetWorld() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] WorldConstRef GetWorld() const;
    };

    /// Base joint definition used by all joint types. The local frames are measured from the body's
    /// origin rather than the center of mass because:
    /// 1. you might not know where the center of mass will be.
    /// 2. if you add/remove shapes from a body and recompute the mass, the joints will be broken.
    /// @ingroup joint
    class Joint : public BasicJointInterface<Joint, false>
    {
        template <typename, bool>
        friend class BasicJointInterface;
        friend class WeldJoint;
        friend class WheelJoint;
        friend class RevoluteJoint;
        friend class MoverJoint;
        friend class DistanceJoint;
        friend class MotorJoint;
        friend class PrismaticJoint;
        friend class PogoJoint;
        template <typename, bool>
        friend class BasicWorldInterface;

      protected:
        b2JointId id{};

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr Joint() noexcept {}

        Joint(Joint&& other) noexcept { id = std::exchange(other.id, b2JointId{}); }
        Joint& operator=(Joint other) noexcept { std::swap(id, other.id); return *this; }

        ~Joint() { if (*this) Destroy(); }
    };

    template <bool IsConstRef>
    class MaybeConstJointRef : public BasicJointInterface<MaybeConstJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicJointInterface;

      protected:
        b2JointId id{};

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        constexpr MaybeConstJointRef(std::same_as<b2JointId> auto id) noexcept { this->id = id; }

        // Create from a non-reference.
        constexpr MaybeConstJointRef(const Joint& other) noexcept : MaybeConstJointRef(other.Handle()) {}

        // Convert a non-const reference to a const reference.
        constexpr MaybeConstJointRef(const MaybeConstJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicWheelJointInterface
    {
      protected:
        BasicWheelJointInterface() = default;

      public:
        /// Get the wheel joint current motor torque, usually in newton-meters
        [[nodiscard]] float GetCurrentMotorTorque() const;

        /// Enable/disable the wheel joint limit
        void EnableLimit(bool enableLimit) /*non-const*/ requires (!ForceConst);

        /// Is the wheel joint limit enabled?
        [[nodiscard]] bool IsLimitEnabled() const;

        /// Set the wheel joint limits
        void SetLimits(float lower, float upper) /*non-const*/ requires (!ForceConst);

        /// Get the wheel joint lower limit
        [[nodiscard]] float GetLowerLimit() const;

        /// Set the wheel joint maximum motor torque, usually in newton-meters
        void SetMaxMotorTorque(float torque) /*non-const*/ requires (!ForceConst);

        /// Get the wheel joint maximum motor torque, usually in newton-meters
        [[nodiscard]] float GetMaxMotorTorque() const;

        /// Enable/disable the wheel joint motor
        void EnableMotor(bool enableMotor) /*non-const*/ requires (!ForceConst);

        /// Is the wheel joint motor enabled?
        [[nodiscard]] bool IsMotorEnabled() const;

        /// Enable/disable the wheel joint spring
        void EnableSpring(bool enableSpring) /*non-const*/ requires (!ForceConst);

        /// Is the wheel joint spring enabled?
        [[nodiscard]] bool IsSpringEnabled() const;

        /// Set the wheel joint damping ratio, non-dimensional
        void SetSpringDampingRatio(float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the wheel joint damping ratio, non-dimensional
        [[nodiscard]] float GetSpringDampingRatio() const;

        /// Set the wheel joint stiffness in Hertz
        void SetSpringHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the wheel joint stiffness in Hertz
        [[nodiscard]] float GetSpringHertz() const;

        /// Set the wheel joint motor speed in radians per second
        void SetTargetMotorSpeed(float motorSpeed) /*non-const*/ requires (!ForceConst);

        /// Get the wheel joint motor speed in radians per second
        [[nodiscard]] float GetTargetMotorSpeed() const;

        /// Get the wheel joint upper limit
        [[nodiscard]] float GetUpperLimit() const;
    };

    /// Wheel joint definition Body B is a wheel that may rotate freely and slide along the local x-axis
    /// in frame A. The joint translation is zero when the local frame origins coincide in world space.
    /// @ingroup wheel_joint
    class WheelJoint : public Joint, public BasicWheelJointInterface<WheelJoint, false>
    {
        template <typename, bool>
        friend class BasicWheelJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr WheelJoint() noexcept {}

        // The constructor accepts either this or directly `b2WheelJointDef`.
        struct Params : b2WheelJointDef
        {
            Params() : b2WheelJointDef(b2DefaultWheelJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit WheelJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_wheelJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `WheelJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstWheelJointRef : public MaybeConstJointRef<IsConstRef>, public BasicWheelJointInterface<MaybeConstWheelJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicWheelJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstWheelJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstWheelJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_wheelJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `WheelJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstWheelJointRef(const WheelJoint& other) noexcept : MaybeConstWheelJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstWheelJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstWheelJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstWheelJointRef(const MaybeConstWheelJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstWheelJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicPrismaticJointInterface
    {
      protected:
        BasicPrismaticJointInterface() = default;

      public:
        /// Get the prismatic joint current motor force, usually in newtons
        [[nodiscard]] float GetCurrentMotorForce() const;

        /// Get the current joint translation velocity, usually in meters per second.
        [[nodiscard]] float GetCurrentSpeed() const;

        /// Get the current joint translation, usually in meters.
        [[nodiscard]] float GetCurrentTranslation() const;

        /// Enable/disable a prismatic joint limit
        void EnableLimit(bool enableLimit) /*non-const*/ requires (!ForceConst);

        /// Is the prismatic joint limit enabled?
        [[nodiscard]] bool IsLimitEnabled() const;

        /// Set the prismatic joint limits
        void SetLimits(float lower, float upper) /*non-const*/ requires (!ForceConst);

        /// Get the prismatic joint lower limit
        [[nodiscard]] float GetLowerLimit() const;

        /// Set the prismatic joint maximum motor force, usually in newtons
        void SetMaxMotorForce(float force) /*non-const*/ requires (!ForceConst);

        /// Get the prismatic joint maximum motor force, usually in newtons
        [[nodiscard]] float GetMaxMotorForce() const;

        /// Enable/disable a prismatic joint motor
        void EnableMotor(bool enableMotor) /*non-const*/ requires (!ForceConst);

        /// Is the prismatic joint motor enabled?
        [[nodiscard]] bool IsMotorEnabled() const;

        /// Enable/disable the joint spring.
        void EnableSpring(bool enableSpring) /*non-const*/ requires (!ForceConst);

        /// Is the prismatic joint spring enabled or not?
        [[nodiscard]] bool IsSpringEnabled() const;

        /// Set the prismatic joint damping ratio (non-dimensional)
        void SetSpringDampingRatio(float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the prismatic spring damping ratio (non-dimensional)
        [[nodiscard]] float GetSpringDampingRatio() const;

        /// Set the prismatic joint stiffness in Hertz. This should usually be less than a quarter of the
        /// simulation rate. For example, if the simulation runs at 60Hz then the joint stiffness should be
        /// 15Hz or less.
        void SetSpringHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the prismatic joint stiffness in Hertz
        [[nodiscard]] float GetSpringHertz() const;

        /// Set the prismatic joint motor speed, usually in meters per second
        void SetTargetMotorSpeed(float motorSpeed) /*non-const*/ requires (!ForceConst);

        /// Get the prismatic joint motor speed, usually in meters per second
        [[nodiscard]] float GetTargetMotorSpeed() const;

        /// Set the prismatic joint spring target translation, usually in meters
        void SetTargetTranslation(float translation) /*non-const*/ requires (!ForceConst);

        /// Get the prismatic joint spring target translation, usually in meters
        [[nodiscard]] float GetTargetTranslation() const;

        /// Get the prismatic joint upper limit
        [[nodiscard]] float GetUpperLimit() const;
    };

    /// Prismatic joint definition Body B may slide along the x-axis in local frame A. Body B cannot
    /// rotate relative to body A. The joint translation is zero when the local frame origins coincide
    /// in world space.
    /// @ingroup prismatic_joint
    class PrismaticJoint : public Joint, public BasicPrismaticJointInterface<PrismaticJoint, false>
    {
        template <typename, bool>
        friend class BasicPrismaticJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr PrismaticJoint() noexcept {}

        // The constructor accepts either this or directly `b2PrismaticJointDef`.
        struct Params : b2PrismaticJointDef
        {
            Params() : b2PrismaticJointDef(b2DefaultPrismaticJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit PrismaticJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_prismaticJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `PrismaticJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstPrismaticJointRef : public MaybeConstJointRef<IsConstRef>, public BasicPrismaticJointInterface<MaybeConstPrismaticJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicPrismaticJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstPrismaticJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstPrismaticJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_prismaticJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `PrismaticJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstPrismaticJointRef(const PrismaticJoint& other) noexcept : MaybeConstPrismaticJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstPrismaticJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstPrismaticJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstPrismaticJointRef(const MaybeConstPrismaticJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstPrismaticJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicRevoluteJointInterface
    {
      protected:
        BasicRevoluteJointInterface() = default;

      public:
        /// Get the revolute joint current angle in radians. This is the relative rotation of the joint
        /// frames.
        [[nodiscard]] float GetCurrentAngle() const;

        /// Get the revolute joint current motor torque, usually in newton-meters
        [[nodiscard]] float GetCurrentMotorTorque() const;

        /// Get the current revolute joint motor speed in radians per second
        [[nodiscard]] float GetCurrentSpeed() const;

        /// Enable/disable the revolute joint limit
        void EnableLimit(bool enableLimit) /*non-const*/ requires (!ForceConst);

        /// Is the revolute joint limit enabled?
        [[nodiscard]] bool IsLimitEnabled() const;

        /// Set the revolute joint limits in radians. It is expected that lower <= upper and that -0.99 *
        /// B2_PI <= lower && upper <= 0.99 * B2_PI.
        void SetLimits(float lower, float upper) /*non-const*/ requires (!ForceConst);

        /// Get the revolute joint lower limit in radians
        [[nodiscard]] float GetLowerLimit() const;

        /// Set the revolute joint maximum motor torque, usually in newton-meters
        void SetMaxMotorTorque(float torque) /*non-const*/ requires (!ForceConst);

        /// Get the revolute joint maximum motor torque, usually in newton-meters
        [[nodiscard]] float GetMaxMotorTorque() const;

        /// Enable/disable a revolute joint motor
        void EnableMotor(bool enableMotor) /*non-const*/ requires (!ForceConst);

        /// Is the revolute joint motor enabled?
        [[nodiscard]] bool IsMotorEnabled() const;

        /// Enable/disable the revolute joint spring
        void EnableSpring(bool enableSpring) /*non-const*/ requires (!ForceConst);

        /// Is the revolute angular spring enabled?
        [[nodiscard]] bool IsSpringEnabled() const;

        /// Set the revolute joint spring damping ratio, non-dimensional
        void SetSpringDampingRatio(float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the revolute joint spring damping ratio, non-dimensional
        [[nodiscard]] float GetSpringDampingRatio() const;

        /// Set the revolute joint spring stiffness in Hertz
        void SetSpringHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the revolute joint spring stiffness in Hertz
        [[nodiscard]] float GetSpringHertz() const;

        /// Set the revolute joint spring target angle, radians
        void SetTargetAngle(float angle) /*non-const*/ requires (!ForceConst);

        /// Get the revolute joint spring target angle, radians
        [[nodiscard]] float GetTargetAngle() const;

        /// Set the revolute joint motor speed in radians per second
        void SetTargetMotorSpeed(float motorSpeed) /*non-const*/ requires (!ForceConst);

        /// Get the revolute joint motor speed in radians per second
        [[nodiscard]] float GetTargetMotorSpeed() const;

        /// Get the revolute joint upper limit in radians
        [[nodiscard]] float GetUpperLimit() const;
    };

    /// Revolute joint definition A point on body B is fixed to a point on body A. Allows relative
    /// rotation.
    /// @ingroup revolute_joint
    class RevoluteJoint : public Joint, public BasicRevoluteJointInterface<RevoluteJoint, false>
    {
        template <typename, bool>
        friend class BasicRevoluteJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr RevoluteJoint() noexcept {}

        // The constructor accepts either this or directly `b2RevoluteJointDef`.
        struct Params : b2RevoluteJointDef
        {
            Params() : b2RevoluteJointDef(b2DefaultRevoluteJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit RevoluteJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_revoluteJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `RevoluteJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstRevoluteJointRef : public MaybeConstJointRef<IsConstRef>, public BasicRevoluteJointInterface<MaybeConstRevoluteJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicRevoluteJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstRevoluteJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstRevoluteJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_revoluteJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `RevoluteJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstRevoluteJointRef(const RevoluteJoint& other) noexcept : MaybeConstRevoluteJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstRevoluteJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstRevoluteJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstRevoluteJointRef(const MaybeConstRevoluteJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstRevoluteJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicWeldJointInterface
    {
      protected:
        BasicWeldJointInterface() = default;

      public:
        /// Set weld joint angular damping ratio, non-dimensional
        void SetAngularDampingRatio(float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the weld joint angular damping ratio, non-dimensional
        [[nodiscard]] float GetAngularDampingRatio() const;

        /// Set the weld joint angular stiffness in Hertz. 0 is rigid.
        void SetAngularHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the weld joint angular stiffness in Hertz
        [[nodiscard]] float GetAngularHertz() const;

        /// Set the weld joint linear damping ratio (non-dimensional)
        void SetLinearDampingRatio(float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the weld joint linear damping ratio (non-dimensional)
        [[nodiscard]] float GetLinearDampingRatio() const;

        /// Set the weld joint linear stiffness in Hertz. 0 is rigid.
        void SetLinearHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the weld joint linear stiffness in Hertz
        [[nodiscard]] float GetLinearHertz() const;
    };

    /// Weld joint definition Connects two bodies together rigidly. This constraint provides springs to
    /// mimic soft-body simulation.
    /// @note The approximate solver in Box2D cannot hold many bodies together rigidly
    /// @ingroup weld_joint
    class WeldJoint : public Joint, public BasicWeldJointInterface<WeldJoint, false>
    {
        template <typename, bool>
        friend class BasicWeldJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr WeldJoint() noexcept {}

        // The constructor accepts either this or directly `b2WeldJointDef`.
        struct Params : b2WeldJointDef
        {
            Params() : b2WeldJointDef(b2DefaultWeldJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit WeldJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_weldJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `WeldJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstWeldJointRef : public MaybeConstJointRef<IsConstRef>, public BasicWeldJointInterface<MaybeConstWeldJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicWeldJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstWeldJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstWeldJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_weldJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `WeldJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstWeldJointRef(const WeldJoint& other) noexcept : MaybeConstWeldJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstWeldJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstWeldJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstWeldJointRef(const MaybeConstWeldJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstWeldJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicDistanceJointInterface
    {
      protected:
        BasicDistanceJointInterface() = default;

      public:
        /// Get the current length of a distance joint
        [[nodiscard]] float GetCurrentLength() const;

        /// Get the distance joint current motor force, usually in newtons
        [[nodiscard]] float GetCurrentMotorForce() const;

        /// Enable joint limit. The limit only works if the joint spring is enabled. Otherwise the joint is
        /// rigid and the limit has no effect.
        void EnableLimit(bool enableLimit) /*non-const*/ requires (!ForceConst);

        /// Is the distance joint limit enabled?
        [[nodiscard]] bool IsLimitEnabled() const;

        /// Set the minimum and maximum length parameters of a distance joint
        void SetLimits(float minLength, float maxLength) /*non-const*/ requires (!ForceConst);

        /// Get the distance joint minimum length
        [[nodiscard]] float GetLowerLimit() const;

        /// Set the distance joint maximum motor force, usually in newtons
        void SetMaxMotorForce(float force) /*non-const*/ requires (!ForceConst);

        /// Get the distance joint maximum motor force, usually in newtons
        [[nodiscard]] float GetMaxMotorForce() const;

        /// Enable/disable the distance joint motor
        void EnableMotor(bool enableMotor) /*non-const*/ requires (!ForceConst);

        /// Is the distance joint motor enabled?
        [[nodiscard]] bool IsMotorEnabled() const;

        /// Set the rest length of a distance joint
        /// @param jointId The id for a distance joint
        /// @param length The new distance joint length
        void SetRestLength(float length) /*non-const*/ requires (!ForceConst);

        /// Get the rest length of a distance joint
        [[nodiscard]] float GetRestLength() const;

        /// Enable/disable the distance joint spring. When disabled the distance joint is rigid.
        void EnableSpring(bool enableSpring) /*non-const*/ requires (!ForceConst);

        /// Is the distance joint spring enabled?
        [[nodiscard]] bool IsSpringEnabled() const;

        /// Set the spring damping ratio, non-dimensional
        void SetSpringDampingRatio(float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the spring damping ratio
        [[nodiscard]] float GetSpringDampingRatio() const;

        /// Get the current spring force.
        [[nodiscard]] float GetSpringForce() const;

        /// Set the force range for the spring.
        void SetSpringForceRange(float lowerForce, float upperForce) /*non-const*/ requires (!ForceConst);

        /// Get the force range for the spring.
        void GetSpringForceRange(float* lowerForce, float* upperForce) const;

        /// Set the spring stiffness in Hertz
        void SetSpringHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the spring Hertz
        [[nodiscard]] float GetSpringHertz() const;

        /// Set the distance joint motor speed, usually in meters per second
        void SetTargetMotorSpeed(float motorSpeed) /*non-const*/ requires (!ForceConst);

        /// Get the distance joint motor speed, usually in meters per second
        [[nodiscard]] float GetTargetMotorSpeed() const;

        /// Get the distance joint maximum length
        [[nodiscard]] float GetUpperLimit() const;
    };

    /// Distance joint definition Connects a point on body A with a point on body B by a segment. Useful
    /// for ropes and springs.
    /// @ingroup distance_joint
    class DistanceJoint : public Joint, public BasicDistanceJointInterface<DistanceJoint, false>
    {
        template <typename, bool>
        friend class BasicDistanceJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr DistanceJoint() noexcept {}

        // The constructor accepts either this or directly `b2DistanceJointDef`.
        struct Params : b2DistanceJointDef
        {
            Params() : b2DistanceJointDef(b2DefaultDistanceJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit DistanceJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_distanceJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `DistanceJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstDistanceJointRef : public MaybeConstJointRef<IsConstRef>, public BasicDistanceJointInterface<MaybeConstDistanceJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicDistanceJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstDistanceJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstDistanceJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_distanceJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `DistanceJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstDistanceJointRef(const DistanceJoint& other) noexcept : MaybeConstDistanceJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstDistanceJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstDistanceJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstDistanceJointRef(const MaybeConstDistanceJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstDistanceJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicMotorJointInterface
    {
      protected:
        BasicMotorJointInterface() = default;

      public:
        /// Set the spring angular damping ratio. Use 1.0 for critical damping.
        void SetAngularDampingRatio(float damping) /*non-const*/ requires (!ForceConst);

        /// Get the spring angular damping ratio.
        [[nodiscard]] float GetAngularDampingRatio() const;

        /// Set the spring angular hertz stiffness
        void SetAngularHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the spring angular hertz stiffness
        [[nodiscard]] float GetAngularHertz() const;

        /// Set the desired relative angular velocity in radians per second
        void SetAngularVelocity(float velocity) /*non-const*/ requires (!ForceConst);

        /// Get the desired relative angular velocity in radians per second
        [[nodiscard]] float GetAngularVelocity() const;

        /// Set the spring linear damping ratio. Use 1.0 for critical damping.
        void SetLinearDampingRatio(float damping) /*non-const*/ requires (!ForceConst);

        /// Get the spring linear damping ratio.
        [[nodiscard]] float GetLinearDampingRatio() const;

        /// Set the spring linear hertz stiffness
        void SetLinearHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the spring linear hertz stiffness
        [[nodiscard]] float GetLinearHertz() const;

        /// Set the desired relative linear velocity in meters per second
        void SetLinearVelocity(b2Vec2 velocity) /*non-const*/ requires (!ForceConst);

        /// Get the desired relative linear velocity in meters per second
        [[nodiscard]] b2Vec2 GetLinearVelocity() const;

        /// Set the maximum spring force in newtons.
        void SetMaxSpringForce(float maxForce) /*non-const*/ requires (!ForceConst);

        /// Get the maximum spring force in newtons.
        [[nodiscard]] float GetMaxSpringForce() const;

        /// Set the maximum spring torque in newtons * meters
        void SetMaxSpringTorque(float maxTorque) /*non-const*/ requires (!ForceConst);

        /// Get the maximum spring torque in newtons * meters
        [[nodiscard]] float GetMaxSpringTorque() const;

        /// Set the motor joint maximum force, usually in newtons
        void SetMaxVelocityForce(float maxForce) /*non-const*/ requires (!ForceConst);

        /// Get the motor joint maximum force, usually in newtons
        [[nodiscard]] float GetMaxVelocityForce() const;

        /// Set the motor joint maximum torque, usually in newton-meters
        void SetMaxVelocityTorque(float maxTorque) /*non-const*/ requires (!ForceConst);

        /// Get the motor joint maximum torque, usually in newton-meters
        [[nodiscard]] float GetMaxVelocityTorque() const;
    };

    /// A motor joint is used to control the relative velocity and/or transform between two bodies. With
    /// a velocity of zero this acts like top-down friction.
    /// @ingroup motor_joint
    class MotorJoint : public Joint, public BasicMotorJointInterface<MotorJoint, false>
    {
        template <typename, bool>
        friend class BasicMotorJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr MotorJoint() noexcept {}

        // The constructor accepts either this or directly `b2MotorJointDef`.
        struct Params : b2MotorJointDef
        {
            Params() : b2MotorJointDef(b2DefaultMotorJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit MotorJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_motorJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `MotorJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstMotorJointRef : public MaybeConstJointRef<IsConstRef>, public BasicMotorJointInterface<MaybeConstMotorJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicMotorJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstMotorJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstMotorJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_motorJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `MotorJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstMotorJointRef(const MotorJoint& other) noexcept : MaybeConstMotorJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstMotorJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstMotorJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstMotorJointRef(const MaybeConstMotorJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstMotorJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicMoverJointInterface
    {
      protected:
        BasicMoverJointInterface() = default;

      public:
        /// Set the desired relative linear velocity in meters per second
        void SetLinearVelocity(b2Vec2 velocity) /*non-const*/ requires (!ForceConst);

        /// Get the desired relative linear velocity in meters per second
        [[nodiscard]] b2Vec2 GetLinearVelocity() const;

        /// Set the joint maximum force, usually in newtons
        void SetMaxVelocityForce(b2Vec2 maxForce) /*non-const*/ requires (!ForceConst);

        /// Get the joint maximum force, usually in newtons
        [[nodiscard]] b2Vec2 GetMaxVelocityForce() const;
    };

    /// A mover joint is used to move a dynamic character mover through velocity commands. The x and y
    /// directions are handled separately. Does not affect rotation.
    /// @ingroup mover_joint
    class MoverJoint : public Joint, public BasicMoverJointInterface<MoverJoint, false>
    {
        template <typename, bool>
        friend class BasicMoverJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr MoverJoint() noexcept {}

        // The constructor accepts either this or directly `b2MoverJointDef`.
        struct Params : b2MoverJointDef
        {
            Params() : b2MoverJointDef(b2DefaultMoverJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit MoverJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_moverJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `MoverJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstMoverJointRef : public MaybeConstJointRef<IsConstRef>, public BasicMoverJointInterface<MaybeConstMoverJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicMoverJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstMoverJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstMoverJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_moverJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `MoverJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstMoverJointRef(const MoverJoint& other) noexcept : MaybeConstMoverJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstMoverJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstMoverJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstMoverJointRef(const MaybeConstMoverJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstMoverJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicPogoJointInterface
    {
      protected:
        BasicPogoJointInterface() = default;

      public:
        /// Get the current length of the pogo.
        [[nodiscard]] float GetCurrentLength() const;

        /// Get the internal pogo velocity.
        [[nodiscard]] float GetCurrentSpeed() const;

        /// Get the internal pogo impulse.
        [[nodiscard]] float GetImpulse() const;

        /// Set the rest length of a pogo joint
        /// @param jointId The id for a pogo joint
        /// @param length The new pogo joint length
        void SetRestLength(float length) /*non-const*/ requires (!ForceConst);

        /// Get the rest length of a pogo joint
        [[nodiscard]] float GetRestLength() const;

        /// Set the spring damping ratio, non-dimensional
        void SetSpringDampingRatio(float dampingRatio) /*non-const*/ requires (!ForceConst);

        /// Get the spring damping ratio
        [[nodiscard]] float GetSpringDampingRatio() const;

        /// Set the spring stiffness in Hertz
        void SetSpringHertz(float hertz) /*non-const*/ requires (!ForceConst);

        /// Get the spring Hertz
        [[nodiscard]] float GetSpringHertz() const;
    };

    /// Pogo joint definition
    /// @ingroup pogo_joint
    class PogoJoint : public Joint, public BasicPogoJointInterface<PogoJoint, false>
    {
        template <typename, bool>
        friend class BasicPogoJointInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr PogoJoint() noexcept {}

        // The constructor accepts either this or directly `b2PogoJointDef`.
        struct Params : b2PogoJointDef
        {
            Params() : b2PogoJointDef(b2DefaultPogoJointDef()) {}
        };

        // Downcast from a generic joint.
        // Triggers an assertion if this isn't the right joint kind.
        explicit PogoJoint(Joint&& other) noexcept
        {
            if (!other || other.GetType() == b2_pogoJoint)
                this->id = std::exchange(other.id, {});
            else
                BOX2CPP_ASSERT(false && "This joint is not a `PogoJoint`.");
        }
    };

    template <bool IsConstRef>
    class MaybeConstPogoJointRef : public MaybeConstJointRef<IsConstRef>, public BasicPogoJointInterface<MaybeConstPogoJointRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicPogoJointInterface;

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstPogoJointRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // Downcast from a generic joint reference (or owning joint).
        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstPogoJointRef(std::same_as<b2JointId> auto id) noexcept
        {
            if (B2_IS_NULL(id) || b2Joint_GetType(id) == b2_pogoJoint)
                this->id = id;
            else
                BOX2CPP_ASSERT(false && "This joint is not a `PogoJoint`.");
        }

        // Create from a non-reference.
        constexpr MaybeConstPogoJointRef(const PogoJoint& other) noexcept : MaybeConstPogoJointRef(other.Handle()) {}

        // Triggers an assertion if this isn't the right joint kind.
        explicit constexpr MaybeConstPogoJointRef(MaybeConstJointRef<IsConstRef> other) noexcept : MaybeConstPogoJointRef(other.Handle()) {}
        // Convert a non-const reference to a const reference.
        constexpr MaybeConstPogoJointRef(const MaybeConstPogoJointRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstPogoJointRef(other.Handle()) {}
    };

    template <typename D, bool ForceConst>
    class BasicBodyInterface
    {
      protected:
        BasicBodyInterface() = default;

      public:
        [[nodiscard]] explicit operator bool() const { return B2_IS_NON_NULL(Handle()); }
        [[nodiscard]] const b2BodyId &Handle() const { return static_cast<const D &>(*this).id; }
        // Convert to a handle. Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // I want this to return a const reference, but GCC 13 and earlier choke on that (fixed in 14). GCC bug: https://gcc.gnu.org/bugzilla/show_bug.cgi?id=61663
        template <std::same_as<b2BodyId> T> [[nodiscard]] operator T() const { return Handle(); }

        /// Create a chain shape
        /// @see b2ChainDef for details
        [[nodiscard]] Chain CreateChain(Tags::OwningHandle, const std::derived_from<b2ChainDef> auto& def) /*non-const*/ requires (!ForceConst);
        ChainRef CreateChain(Tags::DestroyWithParent, const std::derived_from<b2ChainDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a capsule shape and attach it to a body. The shape definition and geometry are fully
        /// cloned. Contacts are not created until the next time step.
        /// @return the shape id for accessing the shape, this will be b2_nullShapeId if the length is too
        /// small.
        [[nodiscard]] Shape CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Capsule& capsule) /*non-const*/ requires (!ForceConst);
        ShapeRef CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Capsule& capsule) /*non-const*/ requires (!ForceConst);

        /// Create a chain segment shape and attach it to a body. The shape definition and geometry are
        /// fully cloned. The segment is not owned by any chain shape (b2Shape_GetParentChain returns /// b2_nullChainId). Contacts are not created until the next time step. The chainId on the segment
        /// is ignored. This uses more memory than using a chain shape, so I don't recommend using this.
        /// @return the shape id, or b2_nullShapeId if the segment is too short.
        [[nodiscard]] Shape CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2ChainSegment& chainSegment) /*non-const*/ requires (!ForceConst);
        ShapeRef CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2ChainSegment& chainSegment) /*non-const*/ requires (!ForceConst);

        /// Create a circle shape and attach it to a body. The shape definition and geometry are fully
        /// cloned. Contacts are not created until the next time step.
        /// @return the shape id for accessing the shape
        [[nodiscard]] Shape CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Circle& circle) /*non-const*/ requires (!ForceConst);
        ShapeRef CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Circle& circle) /*non-const*/ requires (!ForceConst);

        /// Create a polygon shape and attach it to a body. The shape definition and geometry are fully
        /// cloned. Contacts are not created until the next time step.
        /// @return the shape id for accessing the shape
        [[nodiscard]] Shape CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Polygon& polygon) /*non-const*/ requires (!ForceConst);
        ShapeRef CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Polygon& polygon) /*non-const*/ requires (!ForceConst);

        /// Create a line segment shape and attach it to a body. The shape definition and geometry are fully
        /// cloned. Contacts are not created until the next time step.
        /// @return the shape id or b2_nullShapeId if the segment is too short.
        [[nodiscard]] Shape CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Segment& segment) /*non-const*/ requires (!ForceConst);
        ShapeRef CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Segment& segment) /*non-const*/ requires (!ForceConst);

        /// Destroy a rigid body given an id. This destroys all shapes and joints attached to the body. Do
        /// not keep references to the associated shapes and joints.
        void Destroy() /*non-const*/ requires (!ForceConst);

        /// Body identifier validation. A valid body exists in a world and is non-null. This can be used to
        /// detect orphaned ids. Provides validation for up to 64K allocations.
        [[nodiscard]] bool IsValid() const;

        /// Enable a body by adding it to the simulation. This is expensive.
        void Enable() /*non-const*/ requires (!ForceConst);

        /// Returns true if this body is enabled
        [[nodiscard]] bool IsEnabled() const;

        /// Adjust the angular damping. Normally this is set in b2BodyDef before creation.
        void SetAngularDamping(float angularDamping) /*non-const*/ requires (!ForceConst);

        /// Get the current angular damping.
        [[nodiscard]] float GetAngularDamping() const;

        /// Set the angular velocity of a body in radians per second
        void SetAngularVelocity(float angularVelocity) /*non-const*/ requires (!ForceConst);

        /// Get the angular velocity of a body in radians per second
        [[nodiscard]] float GetAngularVelocity() const;

        /// Apply an angular impulse. The impulse is ignored if the body is not awake. This optionally wakes
        /// the body.
        /// @param bodyId The body id
        /// @param impulse the angular impulse, usually in units of kg*m*m/s
        /// @param wake also wake up the body
        /// @warning This should be used for one-shot impulses. If you need a steady torque, use a torque
        /// instead, which will work better with the sub-stepping solver.
        void ApplyAngularImpulse(float impulse, bool wake) /*non-const*/ requires (!ForceConst);

        /// Apply a force at a world point. If the force is not applied at the center of mass, it will
        /// generate a torque and affect the angular velocity. This optionally wakes up the body. The force
        /// is ignored if the body is not awake.
        /// @param bodyId The body id
        /// @param force The world force vector, usually in newtons (N)
        /// @param point The world position of the point of application
        /// @param wake Option to wake up the body
        void ApplyForce(b2Vec2 force, b2Pos point, bool wake) /*non-const*/ requires (!ForceConst);

        /// Apply a force to the center of mass. This optionally wakes up the body. The force is ignored if
        /// the body is not awake.
        /// @param bodyId The body id
        /// @param force the world force vector, usually in newtons (N).
        /// @param wake also wake up the body
        void ApplyForceToCenter(b2Vec2 force, bool wake) /*non-const*/ requires (!ForceConst);

        /// Apply an impulse at a point. This immediately modifies the velocity. It also modifies the
        /// angular velocity if the point of application is not at the center of mass. This optionally wakes
        /// the body. The impulse is ignored if the body is not awake.
        /// @param bodyId The body id
        /// @param impulse the world impulse vector, usually in N*s or kg*m/s.
        /// @param point the world position of the point of application.
        /// @param wake also wake up the body
        /// @warning This should be used for one-shot impulses. If you need a steady force, use a force
        /// instead, which will work better with the sub-stepping solver.
        void ApplyLinearImpulse(b2Vec2 impulse, b2Pos point, bool wake) /*non-const*/ requires (!ForceConst);

        /// Apply an impulse to the center of mass. This immediately modifies the velocity. The impulse is
        /// ignored if the body is not awake. This optionally wakes the body.
        /// @param bodyId The body id
        /// @param impulse the world impulse vector, usually in N*s or kg*m/s.
        /// @param wake also wake up the body
        /// @warning This should be used for one-shot impulses. If you need a steady force, use a force
        /// instead, which will work better with the sub-stepping solver.
        void ApplyLinearImpulseToCenter(b2Vec2 impulse, bool wake) /*non-const*/ requires (!ForceConst);

        /// Apply a torque. This affects the angular velocity without affecting the linear velocity. This
        /// optionally wakes the body. The torque is ignored if the body is not awake.
        /// @param bodyId The body id
        /// @param torque about the z-axis (out of the screen), usually in N*m.
        /// @param wake also wake up the body
        void ApplyTorque(float torque, bool wake) /*non-const*/ requires (!ForceConst);

        /// Wake a body from sleep. This wakes the entire island the body is touching.
        /// @warning Putting a body to sleep will put the entire island of bodies touching this body to
        /// sleep, which can be expensive and possibly unintuitive.
        void SetAwake(bool awake) /*non-const*/ requires (!ForceConst);

        /// @return true if this body is awake
        [[nodiscard]] bool IsAwake() const;

        /// Set this body to be a bullet. A bullet does continuous collision detection against dynamic
        /// and kinematic bodies (but not other bullets). This only works on dynamic bodies.
        void SetBullet(bool flag) /*non-const*/ requires (!ForceConst);

        /// Is this body a bullet?
        [[nodiscard]] bool IsBullet() const;

        /// Clear the force and torque on this body. Forces and torques are automatically cleared after each
        /// world step. So this only needs to be called if the application wants to remove the effect of
        /// previous calls to apply forces and torques before the world step is called.
        /// @param bodyId The body id
        void ClearForces() /*non-const*/ requires (!ForceConst);

        /// Get the current world AABB that contains all the attached shapes. Note that this may not
        /// encompass the body origin. If there are no shapes attached then the returned AABB is empty and
        /// centered on the body origin.
        [[nodiscard]] b2AABB ComputeBounds() const;

        /// Get the maximum capacity required for retrieving all the touching contacts on a body
        [[nodiscard]] int GetContactCapacity() const;

        /// Get the touching contact data for a body.
        /// @note Box2D uses speculative collision so some contact points may be separated.
        /// @returns the number of elements filled in the provided array
        /// @warning do not ignore the return value, it specifies the valid number of elements
        [[nodiscard]] int GetContactData(b2ContactData* contactData, int capacity) const;

        /// Enable/disable contact events on all shapes.
        /// @see b2ShapeDef::enableContactEvents
        /// @warning changing this at runtime may cause mismatched begin/end touch events
        void EnableContactEvents(bool flag) /*non-const*/ requires (!ForceConst);

        /// Enable or disable contact recycling for this body. Contact recycling is a performance
        /// optimization that reuses contact manifolds when bodies move slightly. Disabling it can avoid
        /// ghost collisions
        /// on characters at the cost of higher per-step work. Existing contacts retain their prior setting;
        /// only contacts created after this call see the new value.
        /// @see b2BodyDef::enableContactRecycling
        void EnableContactRecycling(bool flag) /*non-const*/ requires (!ForceConst);

        /// Is contact recycling enabled on this body?
        [[nodiscard]] bool IsContactRecyclingEnabled() const;

        /// Disable a body by removing it completely from the simulation. This is expensive.
        void Disable() /*non-const*/ requires (!ForceConst);

        /// Adjust the gravity scale. Normally this is set in b2BodyDef before creation.
        /// @see b2BodyDef::gravityScale
        void SetGravityScale(float gravityScale) /*non-const*/ requires (!ForceConst);

        /// Get the current gravity scale
        [[nodiscard]] float GetGravityScale() const;

        /// Enable/disable hit events on all shapes
        /// @see b2ShapeDef::enableHitEvents
        void EnableHitEvents(bool flag) /*non-const*/ requires (!ForceConst);

        /// Get the number of joints on this body
        [[nodiscard]] int GetJointCount() const;

        /// Get the joint ids for all joints on this body, up to the provided capacity
        /// @returns the number of joint ids stored in the user array
        [[nodiscard]] int GetJoints(b2JointId* jointArray, int capacity) const;

        /// Adjust the linear damping. Normally this is set in b2BodyDef before creation.
        void SetLinearDamping(float linearDamping) /*non-const*/ requires (!ForceConst);

        /// Get the current linear damping.
        [[nodiscard]] float GetLinearDamping() const;

        /// Set the linear velocity of a body. Usually in meters per second.
        void SetLinearVelocity(b2Vec2 linearVelocity) /*non-const*/ requires (!ForceConst);

        /// Get the linear velocity of a body's center of mass. Usually in meters per second.
        [[nodiscard]] b2Vec2 GetLinearVelocity() const;

        /// Get the center of mass position of the body in local space.
        [[nodiscard]] b2Vec2 GetLocalCenter() const;

        /// Get a local point on a body given a world point
        [[nodiscard]] b2Vec2 GetLocalPoint(b2Pos worldPoint) const;

        /// Get the linear velocity of a local point attached to a body. Usually in meters per second.
        [[nodiscard]] b2Vec2 GetLocalPointVelocity(b2Vec2 localPoint) const;

        /// Get a local vector on a body given a world vector
        [[nodiscard]] b2Vec2 GetLocalVector(b2Vec2 worldVector) const;

        /// Get the mass of the body, usually in kilograms
        [[nodiscard]] float GetMass() const;

        /// Override the body's mass properties. Normally this is computed automatically using the shape
        /// geometry and density. This information is lost if a shape is added or removed or if the body
        /// type changes. If motion locks are used to fix rotation then the rotational inertia value is
        /// ignored and rotational inertia remains fixed at zero.
        void SetMassData(b2MassData massData) /*non-const*/ requires (!ForceConst);

        /// Get the mass data for a body
        [[nodiscard]] b2MassData GetMassData() const;

        /// The maximum distance from any point on the body shapes to the center of mass.
        [[nodiscard]] float GetMaxExtent() const;

        /// The maximum distance from any point on the body shapes to the body origin. Conservative.
        [[nodiscard]] float GetMaxExtentFromOrigin() const;

        /// The minimum distance from any point on the body shapes to the center of mass.
        [[nodiscard]] float GetMinExtent() const;

        /// Set the motion locks on this body. This causes mass properties to be recomputed because fixed
        /// rotation sets the rotational inertia to zero.
        void SetMotionLocks(b2MotionLocks locks) /*non-const*/ requires (!ForceConst);

        /// Get the motion locks for this body.
        [[nodiscard]] b2MotionLocks GetMotionLocks() const;

        /// Set the body name. See B2_NAME_LENGTH.
        void SetName(const char* name) /*non-const*/ requires (!ForceConst);

        /// Get the body name.
        [[nodiscard]] const char* GetName() const;

        /// Get the world position of a body. This is the location of the body origin.
        [[nodiscard]] b2Pos GetPosition() const;

        /// Get the world rotation of a body as a cosine/sine pair (complex number)
        [[nodiscard]] b2Rot GetRotation() const;

        /// Get the rotational inertia of the body, usually in kg*m^2
        [[nodiscard]] float GetRotationalInertia() const;

        /// Set the continuous collision safety factor. Smaller is safer but can lead to hitching.
        /// Recommended range [0.01, 0.5]. Non-dimensional.
        void SetSafetyFactor(float safetyFactor) /*non-const*/ requires (!ForceConst);

        /// Get the continuous collision safety factor. Non-dimensional.
        [[nodiscard]] float GetSafetyFactor() const;

        /// Get the number of shapes on this body
        [[nodiscard]] int GetShapeCount() const;

        /// Get the shape ids for all shapes on this body, up to the provided capacity.
        /// @returns the number of shape ids stored in the user array
        [[nodiscard]] int GetShapes(b2ShapeId* shapeArray, int capacity) const;

        /// Set the sleep threshold, usually in meters per second
        void SetSleepThreshold(float sleepThreshold) /*non-const*/ requires (!ForceConst);

        /// Get the sleep threshold, usually in meters per second.
        [[nodiscard]] float GetSleepThreshold() const;

        /// Enable or disable sleeping for this body. If sleeping is disabled the body will wake (and the /// entire island).
        void EnableSleeping(bool enableSleep) /*non-const*/ requires (!ForceConst);

        /// Returns true if sleeping is enabled for this body
        [[nodiscard]] bool IsSleepingEnabled() const;

        /// Set the velocity to reach the given transform after a given time step. The result will be close
        /// but may not be exact. This is meant for kinematic bodies. The target is not applied if the
        /// velocity would be below the sleep threshold and the body is currently asleep.
        /// @param bodyId The body id
        /// @param target The target transform for the body
        /// @param timeStep The time step of the next call to b2World_Step
        /// @param wake Option to wake the body or not
        void SetTargetTransform(b2WorldTransform target, float timeStep, bool wake) /*non-const*/ requires (!ForceConst);

        /// Set the world transform of a body. This acts as a teleport and is fairly expensive.
        /// @note Generally you should create a body with the intended transform.
        /// @see b2BodyDef::position and b2BodyDef::rotation
        void SetTransform(b2Pos position, b2Rot rotation) /*non-const*/ requires (!ForceConst);

        /// Get the world transform of a body.
        [[nodiscard]] b2WorldTransform GetTransform() const;

        /// Change the body type. This is an expensive operation. This automatically updates the mass
        /// properties regardless of the automatic mass setting.
        void SetType(b2BodyType type) /*non-const*/ requires (!ForceConst);

        /// Get the body type: static, kinematic, or dynamic
        [[nodiscard]] b2BodyType GetType() const;

        /// This updates the mass properties to the sum of the mass properties of the shapes. This normally
        /// does not need to be called unless you called b2Body_SetMassData to override the mass and you
        /// later want to reset the mass. You may also use this when automatic mass computation has been
        /// disabled. You should call this regardless of body type. Note that sensor shapes may have mass.
        void UpdateMassFromShapes() /*non-const*/ requires (!ForceConst);

        /// Set the user data for a body
        void SetUserData(void* userData) /*non-const*/ requires (!ForceConst);

        /// Get the user data stored in a body
        [[nodiscard]] void* GetUserData() const;

        /// Wake bodies touching this body. Works for static bodies.
        void WakeTouching() /*non-const*/ requires (!ForceConst);

        /// Get the world that owns this body
        [[nodiscard]] WorldRef GetWorld() /*non-const*/ requires (!ForceConst);
        [[nodiscard]] WorldConstRef GetWorld() const;

        /// Get the center of mass position of the body in world space.
        [[nodiscard]] b2Pos GetWorldCenter() const;

        /// Get a world point on a body given a local point
        [[nodiscard]] b2Pos GetWorldPoint(b2Vec2 localPoint) const;

        /// Get the linear velocity of a world point attached to a body. Usually in meters per second.
        [[nodiscard]] b2Vec2 GetWorldPointVelocity(b2Pos worldPoint) const;

        /// Get a world vector on a body given a local vector
        [[nodiscard]] b2Vec2 GetWorldVector(b2Vec2 localVector) const;
    };

    /// A body definition holds all the data needed to construct a rigid body. You can safely re-use
    /// body definitions. Shapes are added to a body after construction. Body definitions are temporary
    /// objects used to bundle creation parameters. Must be initialized using b2DefaultBodyDef().
    /// @ingroup body
    class Body : public BasicBodyInterface<Body, false>
    {
        template <typename, bool>
        friend class BasicBodyInterface;
        template <typename, bool>
        friend class BasicWorldInterface;

      protected:
        b2BodyId id{};

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr Body() noexcept {}

        // The constructor accepts either this or directly `b2BodyDef`.
        struct Params : b2BodyDef
        {
            Params() : b2BodyDef(b2DefaultBodyDef()) {}
        };

        Body(Body&& other) noexcept { id = std::exchange(other.id, b2BodyId{}); }
        Body& operator=(Body other) noexcept { std::swap(id, other.id); return *this; }

        ~Body() { if (*this) Destroy(); }
    };

    template <bool IsConstRef>
    class MaybeConstBodyRef : public BasicBodyInterface<MaybeConstBodyRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicBodyInterface;

      protected:
        b2BodyId id{};

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstBodyRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        constexpr MaybeConstBodyRef(std::same_as<b2BodyId> auto id) noexcept { this->id = id; }

        // Create from a non-reference.
        constexpr MaybeConstBodyRef(const Body& other) noexcept : MaybeConstBodyRef(other.Handle()) {}

        // Convert a non-const reference to a const reference.
        constexpr MaybeConstBodyRef(const MaybeConstBodyRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstBodyRef(other.Handle()) {}
    };

    /// Opaque handle for a recording buffer. Create one, hand it to b2World_StartRecording, then save
    /// its bytes and destroy it. The buffer grows as the world records into it.
    class Recording
    {
        b2Recording *value = nullptr;

      public:
        // Consturcts a null (invalid) object.
        constexpr Recording() {}

        /// Create a recording buffer. The buffer grows on demand. @p byteCapacity pre-sizes it to avoid
        /// reallocations during a known-length session. Pass 0 for a small default.
        /// @return A recording handle, freed with b2DestroyRecording
        Recording(int byteCapacity) : value(b2CreateRecording(byteCapacity))
        {
            if (!value)
                throw std::runtime_error("Failed to create `b2Recording`."); // This should never happen, the underlying box2d function crashes if allocation fails.
        }

        Recording(Recording&& other) noexcept : value(other.value) { other.value = nullptr; }
        Recording& operator=(Recording&& other) noexcept
        {
            if (this == &other) return *this;
            if (*this) b2DestroyRecording(value);
            value = other.value;
            other.value = nullptr;
            return *this;
        }

        /// Destroy a recording buffer and free its memory.
        ~Recording() { if (*this) b2DestroyRecording(value); }

        [[nodiscard]] explicit operator bool() const { return bool(value); }
        [[nodiscard]]       b2Recording *UnderlyingPtr()       { return value; }
        [[nodiscard]] const b2Recording *UnderlyingPtr() const { return value; }

        /// Get a pointer to the recorded bytes, for saving to a file or transmitting. Valid until the next
        /// recording call or b2DestroyRecording.
        [[nodiscard]] const uint8_t* GetDataPtr() const;

        /// Save a recording buffer to a file. Convenience wrapper over your own file I/O.
        /// @return false if the file could not be written
        [[nodiscard]] bool SaveToFile(const char* path) const;

        /// Get the number of recorded bytes.
        [[nodiscard]] int GetSize() const;

        /// Get a pointer to the recorded bytes, for saving to a file or transmitting. Valid until the next
        /// recording call or b2DestroyRecording.
        [[nodiscard]] std::span<const uint8_t> GetData() const { return {GetDataPtr(), (size_t)GetSize()}; }
    };

    template <typename D, bool ForceConst>
    class BasicWorldInterface
    {
      protected:
        BasicWorldInterface() = default;

      public:
        [[nodiscard]] explicit operator bool() const { return B2_IS_NON_NULL(Handle()); }
        [[nodiscard]] const b2WorldId &Handle() const { return static_cast<const D &>(*this).id; }
        // Convert to a handle. Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        // I want this to return a const reference, but GCC 13 and earlier choke on that (fixed in 14). GCC bug: https://gcc.gnu.org/bugzilla/show_bug.cgi?id=61663
        template <std::same_as<b2WorldId> T> [[nodiscard]] operator T() const { return Handle(); }

        /// Create a rigid body given a definition. No reference to the definition is retained. So you can
        /// create the definition on the stack and pass it as a pointer.
        /// @code{.c}
        /// b2BodyDef bodyDef = b2DefaultBodyDef();
        /// b2BodyId myBodyId = b2CreateBody(myWorldId, &bodyDef);
        /// @endcode
        /// @warning This function is locked during callbacks.
        [[nodiscard]] Body CreateBody(Tags::OwningHandle, const std::derived_from<b2BodyDef> auto& def) /*non-const*/ requires (!ForceConst);
        BodyRef CreateBody(Tags::DestroyWithParent, const std::derived_from<b2BodyDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a distance joint
        /// @see b2DistanceJointDef for details
        [[nodiscard]] DistanceJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2DistanceJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        DistanceJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2DistanceJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a filter joint.
        /// @see b2FilterJointDef for details
        [[nodiscard]] Joint CreateJoint(Tags::OwningHandle, const b2FilterJointDef& def) /*non-const*/ requires (!ForceConst);
        JointRef CreateJoint(Tags::DestroyWithParent, const b2FilterJointDef& def) /*non-const*/ requires (!ForceConst);

        /// Create a motor joint
        /// @see b2MotorJointDef for details
        [[nodiscard]] MotorJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2MotorJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        MotorJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2MotorJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a mover joint
        /// @see b2MoverJointDef for details
        [[nodiscard]] MoverJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2MoverJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        MoverJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2MoverJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a pogo joint
        /// @see b2PogoJointDef for details
        [[nodiscard]] PogoJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2PogoJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        PogoJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2PogoJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a prismatic (slider) joint.
        /// @see b2PrismaticJointDef for details
        [[nodiscard]] PrismaticJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2PrismaticJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        PrismaticJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2PrismaticJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a revolute joint
        /// @see b2RevoluteJointDef for details
        [[nodiscard]] RevoluteJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2RevoluteJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        RevoluteJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2RevoluteJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a weld joint
        /// @see b2WeldJointDef for details
        [[nodiscard]] WeldJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2WeldJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        WeldJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2WeldJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Create a wheel joint
        /// @see b2WheelJointDef for details
        [[nodiscard]] WheelJoint CreateJoint(Tags::OwningHandle, const std::derived_from<b2WheelJointDef> auto& def) /*non-const*/ requires (!ForceConst);
        WheelJointRef CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2WheelJointDef> auto& def) /*non-const*/ requires (!ForceConst);

        /// Destroy a world
        void Destroy() /*non-const*/ requires (!ForceConst);

        /// World id validation. Provides validation for up to 64K allocations.
        [[nodiscard]] bool IsValid() const;

        /// Get the number of awake bodies.
        [[nodiscard]] int GetAwakeBodyCount() const;

        /// Get the body events for the current time step. The event data is transient. Do not store a
        /// reference to this data.
        [[nodiscard]] b2BodyEvents GetBodyEvents() const;

        /// Call this to get the world bounds based on the union of all shape bounds.
        [[nodiscard]] b2AABB GetBounds() const;

        /// Cast a shape through the world. Similar to a ray cast except that a shape is cast instead of a
        /// point. The proxy points are relative to the origin. Callback points are world positions.
        /// @see b2World_CastRay
        b2TreeStats Cast(b2Pos origin, const b2ShapeProxy& proxy, b2Vec2 translation, b2QueryFilter filter, b2CastResultCallbackFcn* fcn, void* context) const;

        /// Cast a capsule mover through the world. This is a special shape cast that handles sliding along
        /// other shapes while reducing clipping. The mover capsule is relative to the origin. Near the
        /// origin pass b2Pos_zero and a world capsule. Returns the translation fraction at the first hit.
        [[nodiscard]] float CastMover(b2Pos origin, const b2Capsule& mover, b2Vec2 translation, b2QueryFilter filter) const;

        /// Cast a ray into the world to collect shapes in the path of the ray. Your callback function
        /// controls whether you get the closest point, any point, or n-points.
        /// @note The callback function may receive shapes in any order
        /// @param worldId The world to cast the ray against
        /// @param origin The start point of the ray
        /// @param translation The translation of the ray from the start point to the end point
        /// @param filter Contains bit flags to filter unwanted shapes from the results
        /// @param fcn A user implemented callback function
        /// @param context A user context that is passed along to the callback function
        /// @return traversal performance counters
        b2TreeStats CastRay(b2Pos origin, b2Vec2 translation, b2QueryFilter filter, b2CastResultCallbackFcn* fcn, void* context) const;

        /// Cast a ray into the world to collect the closest hit. This is a convenience function. Ignores
        /// initial overlap. This is less general than b2World_CastRay() and does not allow for custom
        /// filtering.
        [[nodiscard]] b2RayResult CastRayClosest(b2Pos origin, b2Vec2 translation, b2QueryFilter filter) const;

        /// Collide a capsule mover with the world, gathering collision planes that can be fed to
        /// b2SolvePlanes. Useful for kinematic character movement. The mover capsule and the resulting
        /// planes are relative to the origin.
        void CollideMover(b2Pos origin, const b2Capsule& mover, b2QueryFilter filter, b2PlaneResultCallbackFcn* fcn, void* context) const;

        /// Get contact events for the current time step. The event data is transient. Do not store a
        /// reference to this data.
        [[nodiscard]] b2ContactEvents GetContactEvents() const;

        /// Set the contact point recycling distance. Setting this to zero disables contact point recycling.
        /// Usually in meters.
        void SetContactRecycleDistance(float recycleDistance) /*non-const*/ requires (!ForceConst);

        /// Get the contact point recycling distance. Usually in meters.
        [[nodiscard]] float GetContactRecycleDistance() const;

        /// Adjust contact tuning parameters
        /// @param worldId The world id
        /// @param hertz The contact stiffness (cycles per second)
        /// @param dampingRatio The contact bounciness with 1 being critical damping (non-dimensional)
        /// @param pushSpeed The maximum contact constraint push out speed (meters per second)
        /// @note Advanced feature
        void SetContactTuning(float hertz, float dampingRatio, float pushSpeed) /*non-const*/ requires (!ForceConst);

        /// Get the contact tuning.
        void GetContactTuning(float* hertz, float* dampingRatio, float* pushSpeed) const;

        /// Enable/disable continuous collision between dynamic and static bodies. Generally you should keep
        /// continuous collision enabled to prevent fast moving objects from going through static objects.
        /// The performance gain from disabling continuous collision is minor.
        /// @see b2WorldDef
        void EnableContinuous(bool flag) /*non-const*/ requires (!ForceConst);

        /// Is continuous collision enabled?
        [[nodiscard]] bool IsContinuousEnabled() const;

        /// Get world counters and sizes
        [[nodiscard]] b2Counters GetCounters() const;

        /// Register the custom filter callback. This is optional.
        void SetCustomFilterCallback(b2CustomFilterCallbackFcn* fcn, void* context) /*non-const*/ requires (!ForceConst);

        /// Call this to draw shapes and other debug draw data
        void Draw(b2DebugDraw& draw) const;

        /// Dump memory stats to box2d_memory.txt
        void DumpMemoryStats() /*non-const*/ requires (!ForceConst);

        /// Apply a radial explosion
        /// @param worldId The world id
        /// @param explosionDef The explosion definition
        void Explode(const b2ExplosionDef& explosionDef) /*non-const*/ requires (!ForceConst);

        /// Set the friction callback. Passing NULL resets to default.
        void SetFrictionCallback(b2FrictionCallbackFcn* callback) /*non-const*/ requires (!ForceConst);

        /// Set the gravity vector for the entire world. Box2D has no concept of an up direction and this is
        /// left as a decision for the application. Usually in m/s^2.
        /// @see b2WorldDef
        void SetGravity(b2Vec2 gravity) /*non-const*/ requires (!ForceConst);

        /// Get the gravity vector
        [[nodiscard]] b2Vec2 GetGravity() const;

        /// Adjust the hit event threshold. This controls the collision speed needed to generate a
        /// b2ContactHitEvent. Usually in meters per second.
        /// @see b2WorldDef::hitEventThreshold
        void SetHitEventThreshold(float value) /*non-const*/ requires (!ForceConst);

        /// Get the hit event speed threshold. Usually in meters per second.
        [[nodiscard]] float GetHitEventThreshold() const;

        /// Get the joint events for the current time step. The event data is transient. Do not store a
        /// reference to this data.
        [[nodiscard]] b2JointEvents GetJointEvents() const;

        /// Get max capacity. This can be used with b2WorldDef to avoid run-time allocations and copies
        [[nodiscard]] b2Capacity GetMaxCapacity() const;

        /// Set the maximum linear speed. Usually in m/s.
        void SetMaxLinearSpeed(float maximumLinearSpeed) /*non-const*/ requires (!ForceConst);

        /// Get the maximum linear speed. Usually in m/s.
        [[nodiscard]] float GetMaxLinearSpeed() const;

        /// Overlap test for all shapes that *potentially* overlap the provided AABB. The AABB is relative
        /// to the origin, which keeps the test precise far from the world origin in large world mode. Near
        /// the origin pass b2Pos_zero and a world AABB.
        b2TreeStats Overlap(b2Pos origin, b2AABB aabb, b2QueryFilter filter, b2OverlapResultCallbackFcn* fcn, void* context) const;

        /// Overlap test for all shapes that overlap the provided shape proxy. The proxy points are relative
        /// to the origin. Near the origin pass b2Pos_zero and world points.
        b2TreeStats Overlap(b2Pos origin, const b2ShapeProxy& proxy, b2QueryFilter filter, b2OverlapResultCallbackFcn* fcn, void* context) const;

        /// Register the pre-solve and pre-continuous callbacks. This is optional.
        void SetPreSolveCallback(b2PreSolveCallbackFcn* preSolveFcn, b2PreContinuousCallbackFcn* preContinuousFcn, void* context) /*non-const*/ requires (!ForceConst);

        /// Get the current world performance profile
        [[nodiscard]] b2Profile GetProfile() const;

        /// This is for internal testing
        void RebuildStaticTree() /*non-const*/ requires (!ForceConst);

        /// Set the restitution callback. Passing NULL resets to default.
        void SetRestitutionCallback(b2RestitutionCallbackFcn* callback) /*non-const*/ requires (!ForceConst);

        /// Set the number of iterations used by the restitution solver.
        /// @see B2_MAX_RESTITUTION_ITERATIONS
        void SetRestitutionIterations(int iterations) /*non-const*/ requires (!ForceConst);

        /// Get the number of iterations used by the restitution solver.
        [[nodiscard]] int GetRestitutionIterations() const;

        /// Enable/disable restitution propagation.
        /// @see b2WorldDef::enableRestitutionPropagation
        void EnableRestitutionPropagation(bool flag) /*non-const*/ requires (!ForceConst);

        /// Is restitution propagation enabled?
        [[nodiscard]] bool IsRestitutionPropagationEnabled() const;

        /// Adjust the restitution threshold. It is recommended not to make this value very small because it
        /// will prevent bodies from sleeping. Usually in meters per second.
        /// @see b2WorldDef
        void SetRestitutionThreshold(float value) /*non-const*/ requires (!ForceConst);

        /// Get the restitution speed threshold. Usually in meters per second.
        [[nodiscard]] float GetRestitutionThreshold() const;

        /// Restore a world's simulation state from a snapshot image. The b2WorldId and ids held from this
        /// same world stay valid for objects that existed at the snapshot instant. Callbacks and threading
        /// configuration are preserved. User data on shapes, bodies, and joints is nulled.
        /// @param worldId The world to restore into
        /// @param image A snapshot image produced by b2World_GetSnapshot
        /// @param size Size of image in bytes
        /// @return true on success. On a rejected image (bad magic, version, or layout) the world is left
        ///         unchanged. A corrupt payload detected after the rebuild begins returns false and leaves
        ///         the world unusable, so the caller must destroy it.
        [[nodiscard]] bool RestoreFromSnapshot(std::span<const uint8_t> image) /*non-const*/ requires (!ForceConst);

        /// Force SSE2 to be used even when AVX2 is available. This is for testing.
        void EnableSSE2Fallback(bool flag) /*non-const*/ requires (!ForceConst);

        /// Get sensor events for the current time step. The event data is transient. Do not store a
        /// reference to this data.
        [[nodiscard]] b2SensorEvents GetSensorEvents() const;

        /// Enable/disable sleep. If your application does not need sleeping, you can gain some performance
        /// by disabling sleep completely at the world level.
        /// @see b2WorldDef
        void EnableSleeping(bool flag) /*non-const*/ requires (!ForceConst);

        /// Is body sleeping enabled?
        [[nodiscard]] bool IsSleepingEnabled() const;

        /// Write a snapshot of the world's simulation state into a caller-owned buffer. Call once with
        /// image == NULL to get the required size, then again with a buffer of at least that size. Must be
        /// called at a step boundary.
        /// @param worldId The world to snapshot
        /// @param image Destination buffer, or NULL to query the size
        /// @param capacity Size of image in bytes, ignored when querying
        /// @return The number of bytes the snapshot needs. If it exceeds capacity nothing is written.
        ///         Returns 0 if the world is mid-step.
        [[nodiscard]] int GetSnapshot(uint8_t* image, int capacity) const;

        /// Begin recording the world into @p recording. Serializes a snapshot of the current world as the
        /// seed, then logs every mutating call. Call at a step boundary, before or after creating bodies.
        /// Start before the first step to capture the whole session. No effect if already recording or if
        /// the world is locked.
        /// @param worldId The world to record
        /// @param recording A recording buffer from b2CreateRecording
        void StartRecording(Recording& recording) /*non-const*/ requires (!ForceConst);

        /// Compute a hash of the simulation state. Use this to detect desyncs, for example in rollback
        /// resimulation.
        [[nodiscard]] uint64_t GetStateHash() const;

        /// Simulate a world for one time step. This performs collision detection, integration, and
        /// constraint solution.
        /// @param worldId The world to simulate
        /// @param timeStep The amount of time to simulate, this should be a fixed number. Usually 1/60.
        /// @param subStepCount The number of sub-steps, increasing the sub-step count can increase
        /// accuracy. Usually 4.
        void Step(float timeStep, int subStepCount) /*non-const*/ requires (!ForceConst);

        /// Stop recording. The recording buffer keeps its bytes. Save and destroy it yourself.
        /// @param worldId The world being recorded
        void StopRecording() /*non-const*/ requires (!ForceConst);

        /// Set the user data pointer.
        void SetUserData(void* userData) /*non-const*/ requires (!ForceConst);

        /// Get the user data pointer.
        [[nodiscard]] void* GetUserData() const;

        /// Enable/disable constraint warm starting. Advanced feature for testing. Disabling warm starting
        /// greatly reduces stability and provides no performance gain.
        void EnableWarmStarting(bool flag) /*non-const*/ requires (!ForceConst);

        /// Is constraint warm starting enabled?
        [[nodiscard]] bool IsWarmStartingEnabled() const;

        /// Set the worker count. Must be in the range [1, B2_MAX_WORKERS]
        void SetWorkerCount(int count) /*non-const*/ requires (!ForceConst);

        /// Get the worker count.
        [[nodiscard]] int GetWorkerCount() const;
    };

    /// World definition used to create a simulation world. Must be initialized using
    /// b2DefaultWorldDef().
    /// @ingroup world
    class World : public BasicWorldInterface<World, false>
    {
        template <typename, bool>
        friend class BasicWorldInterface;

      protected:
        b2WorldId id{};

      public:
        static constexpr bool IsOwning = true;

        // Constructs a null (invalid) object.
        constexpr World() noexcept {}

        // The constructor accepts either this or directly `b2WorldDef`.
        struct Params : b2WorldDef
        {
            Params() : b2WorldDef(b2DefaultWorldDef()) {}
        };

        /// Create a world for rigid body simulation. A world contains bodies, shapes, and constraints. You
        /// may create up to B2_MAX_WORLDS worlds. Each world is completely independent and may be simulated
        /// in parallel.
        /// @return the world id.
        World(const std::derived_from<b2WorldDef> auto &params) : id(b2CreateWorld(&params)) {}

        /// Create a new world from a snapshot image. This is mainly useful for replay. Callbacks are reset
        /// to default.
        /// @param image A snapshot image produced by b2World_GetSnapshot
        /// @param size Size of image in bytes
        /// @param workerCount Worker count for the new world. 0 uses the serial single-worker fallback.
        /// @return The new world id, or b2_nullWorldId on failure.
        World(std::span<const uint8_t> image, int workerCount) : id(b2CreateWorldFromSnapshot(image.data(), (int)image.size(), workerCount)) {}

        World(World&& other) noexcept { id = std::exchange(other.id, b2WorldId{}); }
        World& operator=(World other) noexcept { std::swap(id, other.id); return *this; }

        ~World() { if (*this) Destroy(); }
    };

    template <bool IsConstRef>
    class MaybeConstWorldRef : public BasicWorldInterface<MaybeConstWorldRef<IsConstRef>, IsConstRef>
    {
        template <typename, bool>
        friend class BasicWorldInterface;

      protected:
        b2WorldId id{};

      public:
        static constexpr bool IsOwning = false;
        static constexpr bool IsConst = IsConstRef;

        // Constructs a null (invalid) object.
        constexpr MaybeConstWorldRef() noexcept {}

        // Point to an existing handle.
        // Using a `same_as` template to prevent implicit madness. In particular, to prevent const-to-non-const conversions between non-owning wrappers.
        constexpr MaybeConstWorldRef(std::same_as<b2WorldId> auto id) noexcept { this->id = id; }

        // Create from a non-reference.
        constexpr MaybeConstWorldRef(const World& other) noexcept : MaybeConstWorldRef(other.Handle()) {}

        // Convert a non-const reference to a const reference.
        constexpr MaybeConstWorldRef(const MaybeConstWorldRef<!IsConstRef>& other) noexcept requires IsConstRef : MaybeConstWorldRef(other.Handle()) {}
    };
} // namespace box2d

// Implementations:
namespace b2
{
    template <typename D, bool ForceConst> void BasicChainInterface<D, ForceConst>::Destroy() requires (!ForceConst) { if (*this) { b2DestroyChain(static_cast<const D &>(*this).Handle()); static_cast<D &>(*this).id = {}; } }
    template <typename D, bool ForceConst> bool BasicChainInterface<D, ForceConst>::IsValid() const { return b2Chain_IsValid(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicChainInterface<D, ForceConst>::SetAllSurfaceMaterials(const b2SurfaceMaterial& material) requires (!ForceConst) { b2Chain_SetAllSurfaceMaterials(static_cast<const D &>(*this).Handle(), &material); }
    template <typename D, bool ForceConst> int BasicChainInterface<D, ForceConst>::GetSegmentCount() const { return b2Chain_GetSegmentCount(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicChainInterface<D, ForceConst>::GetSegments(b2ShapeId* segmentArray, int capacity) const { return b2Chain_GetSegments(static_cast<const D &>(*this).Handle(), segmentArray, capacity); }
    template <typename D, bool ForceConst> void BasicChainInterface<D, ForceConst>::SetSurfaceMaterial(const b2SurfaceMaterial& material, int segmentIndex) requires (!ForceConst) { b2Chain_SetSurfaceMaterial(static_cast<const D &>(*this).Handle(), &material, segmentIndex); }
    template <typename D, bool ForceConst> b2SurfaceMaterial BasicChainInterface<D, ForceConst>::GetSurfaceMaterial(int segmentIndex) const { return b2Chain_GetSurfaceMaterial(static_cast<const D &>(*this).Handle(), segmentIndex); }
    template <typename D, bool ForceConst> WorldRef BasicChainInterface<D, ForceConst>::GetWorld() requires (!ForceConst) { return b2Chain_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> WorldConstRef BasicChainInterface<D, ForceConst>::GetWorld() const { return b2Chain_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::Destroy(bool updateBodyMass) requires (!ForceConst) { if (*this) { b2DestroyShape(static_cast<const D &>(*this).Handle(), updateBodyMass); static_cast<D &>(*this).id = {}; } }
    template <typename D, bool ForceConst> bool BasicShapeInterface<D, ForceConst>::IsValid() const { return b2Shape_IsValid(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::Set(const b2Capsule& capsule) requires (!ForceConst) { b2Shape_SetCapsule(static_cast<const D &>(*this).Handle(), &capsule); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::Set(const b2ChainSegment& chainSegment) requires (!ForceConst) { b2Shape_SetChainSegment(static_cast<const D &>(*this).Handle(), &chainSegment); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::Set(const b2Circle& circle) requires (!ForceConst) { b2Shape_SetCircle(static_cast<const D &>(*this).Handle(), &circle); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::Set(const b2Polygon& polygon) requires (!ForceConst) { b2Shape_SetPolygon(static_cast<const D &>(*this).Handle(), &polygon); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::Set(const b2Segment& segment) requires (!ForceConst) { b2Shape_SetSegment(static_cast<const D &>(*this).Handle(), &segment); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::ApplyWind(b2Vec2 wind, float drag, float lift, bool wake) requires (!ForceConst) { b2Shape_ApplyWind(static_cast<const D &>(*this).Handle(), wind, drag, lift, wake); }
    template <typename D, bool ForceConst> BodyRef BasicShapeInterface<D, ForceConst>::GetBody() requires (!ForceConst) { return b2Shape_GetBody(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> BodyConstRef BasicShapeInterface<D, ForceConst>::GetBody() const { return b2Shape_GetBody(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2AABB BasicShapeInterface<D, ForceConst>::GetBounds() const { return b2Shape_GetBounds(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Capsule BasicShapeInterface<D, ForceConst>::GetCapsule() const { return b2Shape_GetCapsule(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2WorldCastOutput BasicShapeInterface<D, ForceConst>::CastRay(b2Pos origin, b2Vec2 translation) const { return b2Shape_CastRay(static_cast<const D &>(*this).Handle(), origin, translation); }
    template <typename D, bool ForceConst> b2ChainSegment BasicShapeInterface<D, ForceConst>::GetChainSegment() const { return b2Shape_GetChainSegment(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Circle BasicShapeInterface<D, ForceConst>::GetCircle() const { return b2Shape_GetCircle(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Pos BasicShapeInterface<D, ForceConst>::GetClosestPoint(b2Pos target) const { return b2Shape_GetClosestPoint(static_cast<const D &>(*this).Handle(), target); }
    template <typename D, bool ForceConst> b2MassData BasicShapeInterface<D, ForceConst>::ComputeMassData() const { return b2Shape_ComputeMassData(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicShapeInterface<D, ForceConst>::GetContactCapacity() const { return b2Shape_GetContactCapacity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicShapeInterface<D, ForceConst>::GetContactData(b2ContactData* contactData, int capacity) const { return b2Shape_GetContactData(static_cast<const D &>(*this).Handle(), contactData, capacity); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::EnableContactEvents(bool flag) requires (!ForceConst) { b2Shape_EnableContactEvents(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicShapeInterface<D, ForceConst>::AreContactEventsEnabled() const { return b2Shape_AreContactEventsEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::SetDensity(float density, bool updateBodyMass) requires (!ForceConst) { b2Shape_SetDensity(static_cast<const D &>(*this).Handle(), density, updateBodyMass); }
    template <typename D, bool ForceConst> float BasicShapeInterface<D, ForceConst>::GetDensity() const { return b2Shape_GetDensity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::SetFilter(b2Filter filter) requires (!ForceConst) { b2Shape_SetFilter(static_cast<const D &>(*this).Handle(), filter); }
    template <typename D, bool ForceConst> b2Filter BasicShapeInterface<D, ForceConst>::GetFilter() const { return b2Shape_GetFilter(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::SetFriction(float friction) requires (!ForceConst) { b2Shape_SetFriction(static_cast<const D &>(*this).Handle(), friction); }
    template <typename D, bool ForceConst> float BasicShapeInterface<D, ForceConst>::GetFriction() const { return b2Shape_GetFriction(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::EnableHitEvents(bool flag) requires (!ForceConst) { b2Shape_EnableHitEvents(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicShapeInterface<D, ForceConst>::AreHitEventsEnabled() const { return b2Shape_AreHitEventsEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> ChainRef BasicShapeInterface<D, ForceConst>::GetParentChain() requires (!ForceConst) { return b2Shape_GetParentChain(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> ChainConstRef BasicShapeInterface<D, ForceConst>::GetParentChain() const { return b2Shape_GetParentChain(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Polygon BasicShapeInterface<D, ForceConst>::GetPolygon() const { return b2Shape_GetPolygon(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::EnablePreSolveEvents(bool flag) requires (!ForceConst) { b2Shape_EnablePreSolveEvents(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicShapeInterface<D, ForceConst>::ArePreSolveEventsEnabled() const { return b2Shape_ArePreSolveEventsEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::SetRestitution(float restitution) requires (!ForceConst) { b2Shape_SetRestitution(static_cast<const D &>(*this).Handle(), restitution); }
    template <typename D, bool ForceConst> float BasicShapeInterface<D, ForceConst>::GetRestitution() const { return b2Shape_GetRestitution(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Segment BasicShapeInterface<D, ForceConst>::GetSegment() const { return b2Shape_GetSegment(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> bool BasicShapeInterface<D, ForceConst>::IsSensor() const { return b2Shape_IsSensor(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicShapeInterface<D, ForceConst>::GetSensorCapacity() const { return b2Shape_GetSensorCapacity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicShapeInterface<D, ForceConst>::GetSensorData(b2ShapeId* visitorIds, int capacity) const { return b2Shape_GetSensorData(static_cast<const D &>(*this).Handle(), visitorIds, capacity); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::EnableSensorEvents(bool flag) requires (!ForceConst) { b2Shape_EnableSensorEvents(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicShapeInterface<D, ForceConst>::AreSensorEventsEnabled() const { return b2Shape_AreSensorEventsEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::SetSurfaceMaterial(const b2SurfaceMaterial& surfaceMaterial) requires (!ForceConst) { b2Shape_SetSurfaceMaterial(static_cast<const D &>(*this).Handle(), &surfaceMaterial); }
    template <typename D, bool ForceConst> b2SurfaceMaterial BasicShapeInterface<D, ForceConst>::GetSurfaceMaterial() const { return b2Shape_GetSurfaceMaterial(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> bool BasicShapeInterface<D, ForceConst>::TestPoint(b2Pos point) const { return b2Shape_TestPoint(static_cast<const D &>(*this).Handle(), point); }
    template <typename D, bool ForceConst> b2ShapeType BasicShapeInterface<D, ForceConst>::GetType() const { return b2Shape_GetType(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::SetUserData(void* userData) requires (!ForceConst) { b2Shape_SetUserData(static_cast<const D &>(*this).Handle(), userData); }
    template <typename D, bool ForceConst> void* BasicShapeInterface<D, ForceConst>::GetUserData() const { return b2Shape_GetUserData(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicShapeInterface<D, ForceConst>::SetUserMaterial(uint64_t material) requires (!ForceConst) { b2Shape_SetUserMaterial(static_cast<const D &>(*this).Handle(), material); }
    template <typename D, bool ForceConst> uint64_t BasicShapeInterface<D, ForceConst>::GetUserMaterial() const { return b2Shape_GetUserMaterial(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> WorldRef BasicShapeInterface<D, ForceConst>::GetWorld() requires (!ForceConst) { return b2Shape_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> WorldConstRef BasicShapeInterface<D, ForceConst>::GetWorld() const { return b2Shape_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::Destroy() requires (!ForceConst) { if (*this) { b2DestroyJoint(static_cast<const D &>(*this).Handle()); static_cast<D &>(*this).id = {}; } }
    template <typename D, bool ForceConst> bool BasicJointInterface<D, ForceConst>::IsValid() const { return b2Joint_IsValid(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicJointInterface<D, ForceConst>::GetAngularSeparation() const { return b2Joint_GetAngularSeparation(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> BodyRef BasicJointInterface<D, ForceConst>::GetBodyA() requires (!ForceConst) { return b2Joint_GetBodyA(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> BodyConstRef BasicJointInterface<D, ForceConst>::GetBodyA() const { return b2Joint_GetBodyA(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> BodyRef BasicJointInterface<D, ForceConst>::GetBodyB() requires (!ForceConst) { return b2Joint_GetBodyB(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> BodyConstRef BasicJointInterface<D, ForceConst>::GetBodyB() const { return b2Joint_GetBodyB(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::SetCollideConnected(bool shouldCollide) requires (!ForceConst) { b2Joint_SetCollideConnected(static_cast<const D &>(*this).Handle(), shouldCollide); }
    template <typename D, bool ForceConst> bool BasicJointInterface<D, ForceConst>::GetCollideConnected() const { return b2Joint_GetCollideConnected(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Vec2 BasicJointInterface<D, ForceConst>::GetConstraintForce() const { return b2Joint_GetConstraintForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicJointInterface<D, ForceConst>::GetConstraintTorque() const { return b2Joint_GetConstraintTorque(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::SetConstraintTuning(float hertz, float dampingRatio) requires (!ForceConst) { b2Joint_SetConstraintTuning(static_cast<const D &>(*this).Handle(), hertz, dampingRatio); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::GetConstraintTuning(float* hertz, float* dampingRatio) const { b2Joint_GetConstraintTuning(static_cast<const D &>(*this).Handle(), hertz, dampingRatio); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::SetForceThreshold(float threshold) requires (!ForceConst) { b2Joint_SetForceThreshold(static_cast<const D &>(*this).Handle(), threshold); }
    template <typename D, bool ForceConst> float BasicJointInterface<D, ForceConst>::GetForceThreshold() const { return b2Joint_GetForceThreshold(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicJointInterface<D, ForceConst>::GetLinearSeparation() const { return b2Joint_GetLinearSeparation(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::SetLocalFrameA(b2Transform localFrame) requires (!ForceConst) { b2Joint_SetLocalFrameA(static_cast<const D &>(*this).Handle(), localFrame); }
    template <typename D, bool ForceConst> b2Transform BasicJointInterface<D, ForceConst>::GetLocalFrameA() const { return b2Joint_GetLocalFrameA(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::SetLocalFrameB(b2Transform localFrame) requires (!ForceConst) { b2Joint_SetLocalFrameB(static_cast<const D &>(*this).Handle(), localFrame); }
    template <typename D, bool ForceConst> b2Transform BasicJointInterface<D, ForceConst>::GetLocalFrameB() const { return b2Joint_GetLocalFrameB(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::SetTorqueThreshold(float threshold) requires (!ForceConst) { b2Joint_SetTorqueThreshold(static_cast<const D &>(*this).Handle(), threshold); }
    template <typename D, bool ForceConst> float BasicJointInterface<D, ForceConst>::GetTorqueThreshold() const { return b2Joint_GetTorqueThreshold(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2JointType BasicJointInterface<D, ForceConst>::GetType() const { return b2Joint_GetType(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::SetUserData(void* userData) requires (!ForceConst) { b2Joint_SetUserData(static_cast<const D &>(*this).Handle(), userData); }
    template <typename D, bool ForceConst> void* BasicJointInterface<D, ForceConst>::GetUserData() const { return b2Joint_GetUserData(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicJointInterface<D, ForceConst>::WakeBodies() requires (!ForceConst) { b2Joint_WakeBodies(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> WorldRef BasicJointInterface<D, ForceConst>::GetWorld() requires (!ForceConst) { return b2Joint_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> WorldConstRef BasicJointInterface<D, ForceConst>::GetWorld() const { return b2Joint_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicWheelJointInterface<D, ForceConst>::GetCurrentMotorTorque() const { return b2WheelJoint_GetCurrentMotorTorque(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::EnableLimit(bool enableLimit) requires (!ForceConst) { b2WheelJoint_EnableLimit(static_cast<const D &>(*this).Handle(), enableLimit); }
    template <typename D, bool ForceConst> bool BasicWheelJointInterface<D, ForceConst>::IsLimitEnabled() const { return b2WheelJoint_IsLimitEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::SetLimits(float lower, float upper) requires (!ForceConst) { b2WheelJoint_SetLimits(static_cast<const D &>(*this).Handle(), lower, upper); }
    template <typename D, bool ForceConst> float BasicWheelJointInterface<D, ForceConst>::GetLowerLimit() const { return b2WheelJoint_GetLowerLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::SetMaxMotorTorque(float torque) requires (!ForceConst) { b2WheelJoint_SetMaxMotorTorque(static_cast<const D &>(*this).Handle(), torque); }
    template <typename D, bool ForceConst> float BasicWheelJointInterface<D, ForceConst>::GetMaxMotorTorque() const { return b2WheelJoint_GetMaxMotorTorque(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::EnableMotor(bool enableMotor) requires (!ForceConst) { b2WheelJoint_EnableMotor(static_cast<const D &>(*this).Handle(), enableMotor); }
    template <typename D, bool ForceConst> bool BasicWheelJointInterface<D, ForceConst>::IsMotorEnabled() const { return b2WheelJoint_IsMotorEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::EnableSpring(bool enableSpring) requires (!ForceConst) { b2WheelJoint_EnableSpring(static_cast<const D &>(*this).Handle(), enableSpring); }
    template <typename D, bool ForceConst> bool BasicWheelJointInterface<D, ForceConst>::IsSpringEnabled() const { return b2WheelJoint_IsSpringEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::SetSpringDampingRatio(float dampingRatio) requires (!ForceConst) { b2WheelJoint_SetSpringDampingRatio(static_cast<const D &>(*this).Handle(), dampingRatio); }
    template <typename D, bool ForceConst> float BasicWheelJointInterface<D, ForceConst>::GetSpringDampingRatio() const { return b2WheelJoint_GetSpringDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::SetSpringHertz(float hertz) requires (!ForceConst) { b2WheelJoint_SetSpringHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicWheelJointInterface<D, ForceConst>::GetSpringHertz() const { return b2WheelJoint_GetSpringHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWheelJointInterface<D, ForceConst>::SetTargetMotorSpeed(float motorSpeed) requires (!ForceConst) { b2WheelJoint_SetTargetMotorSpeed(static_cast<const D &>(*this).Handle(), motorSpeed); }
    template <typename D, bool ForceConst> float BasicWheelJointInterface<D, ForceConst>::GetTargetMotorSpeed() const { return b2WheelJoint_GetTargetMotorSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicWheelJointInterface<D, ForceConst>::GetUpperLimit() const { return b2WheelJoint_GetUpperLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetCurrentMotorForce() const { return b2PrismaticJoint_GetCurrentMotorForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetCurrentSpeed() const { return b2PrismaticJoint_GetCurrentSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetCurrentTranslation() const { return b2PrismaticJoint_GetCurrentTranslation(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::EnableLimit(bool enableLimit) requires (!ForceConst) { b2PrismaticJoint_EnableLimit(static_cast<const D &>(*this).Handle(), enableLimit); }
    template <typename D, bool ForceConst> bool BasicPrismaticJointInterface<D, ForceConst>::IsLimitEnabled() const { return b2PrismaticJoint_IsLimitEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::SetLimits(float lower, float upper) requires (!ForceConst) { b2PrismaticJoint_SetLimits(static_cast<const D &>(*this).Handle(), lower, upper); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetLowerLimit() const { return b2PrismaticJoint_GetLowerLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::SetMaxMotorForce(float force) requires (!ForceConst) { b2PrismaticJoint_SetMaxMotorForce(static_cast<const D &>(*this).Handle(), force); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetMaxMotorForce() const { return b2PrismaticJoint_GetMaxMotorForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::EnableMotor(bool enableMotor) requires (!ForceConst) { b2PrismaticJoint_EnableMotor(static_cast<const D &>(*this).Handle(), enableMotor); }
    template <typename D, bool ForceConst> bool BasicPrismaticJointInterface<D, ForceConst>::IsMotorEnabled() const { return b2PrismaticJoint_IsMotorEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::EnableSpring(bool enableSpring) requires (!ForceConst) { b2PrismaticJoint_EnableSpring(static_cast<const D &>(*this).Handle(), enableSpring); }
    template <typename D, bool ForceConst> bool BasicPrismaticJointInterface<D, ForceConst>::IsSpringEnabled() const { return b2PrismaticJoint_IsSpringEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::SetSpringDampingRatio(float dampingRatio) requires (!ForceConst) { b2PrismaticJoint_SetSpringDampingRatio(static_cast<const D &>(*this).Handle(), dampingRatio); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetSpringDampingRatio() const { return b2PrismaticJoint_GetSpringDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::SetSpringHertz(float hertz) requires (!ForceConst) { b2PrismaticJoint_SetSpringHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetSpringHertz() const { return b2PrismaticJoint_GetSpringHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::SetTargetMotorSpeed(float motorSpeed) requires (!ForceConst) { b2PrismaticJoint_SetTargetMotorSpeed(static_cast<const D &>(*this).Handle(), motorSpeed); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetTargetMotorSpeed() const { return b2PrismaticJoint_GetTargetMotorSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPrismaticJointInterface<D, ForceConst>::SetTargetTranslation(float translation) requires (!ForceConst) { b2PrismaticJoint_SetTargetTranslation(static_cast<const D &>(*this).Handle(), translation); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetTargetTranslation() const { return b2PrismaticJoint_GetTargetTranslation(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicPrismaticJointInterface<D, ForceConst>::GetUpperLimit() const { return b2PrismaticJoint_GetUpperLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetCurrentAngle() const { return b2RevoluteJoint_GetCurrentAngle(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetCurrentMotorTorque() const { return b2RevoluteJoint_GetCurrentMotorTorque(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetCurrentSpeed() const { return b2RevoluteJoint_GetCurrentSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::EnableLimit(bool enableLimit) requires (!ForceConst) { b2RevoluteJoint_EnableLimit(static_cast<const D &>(*this).Handle(), enableLimit); }
    template <typename D, bool ForceConst> bool BasicRevoluteJointInterface<D, ForceConst>::IsLimitEnabled() const { return b2RevoluteJoint_IsLimitEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::SetLimits(float lower, float upper) requires (!ForceConst) { b2RevoluteJoint_SetLimits(static_cast<const D &>(*this).Handle(), lower, upper); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetLowerLimit() const { return b2RevoluteJoint_GetLowerLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::SetMaxMotorTorque(float torque) requires (!ForceConst) { b2RevoluteJoint_SetMaxMotorTorque(static_cast<const D &>(*this).Handle(), torque); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetMaxMotorTorque() const { return b2RevoluteJoint_GetMaxMotorTorque(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::EnableMotor(bool enableMotor) requires (!ForceConst) { b2RevoluteJoint_EnableMotor(static_cast<const D &>(*this).Handle(), enableMotor); }
    template <typename D, bool ForceConst> bool BasicRevoluteJointInterface<D, ForceConst>::IsMotorEnabled() const { return b2RevoluteJoint_IsMotorEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::EnableSpring(bool enableSpring) requires (!ForceConst) { b2RevoluteJoint_EnableSpring(static_cast<const D &>(*this).Handle(), enableSpring); }
    template <typename D, bool ForceConst> bool BasicRevoluteJointInterface<D, ForceConst>::IsSpringEnabled() const { return b2RevoluteJoint_IsSpringEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::SetSpringDampingRatio(float dampingRatio) requires (!ForceConst) { b2RevoluteJoint_SetSpringDampingRatio(static_cast<const D &>(*this).Handle(), dampingRatio); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetSpringDampingRatio() const { return b2RevoluteJoint_GetSpringDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::SetSpringHertz(float hertz) requires (!ForceConst) { b2RevoluteJoint_SetSpringHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetSpringHertz() const { return b2RevoluteJoint_GetSpringHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::SetTargetAngle(float angle) requires (!ForceConst) { b2RevoluteJoint_SetTargetAngle(static_cast<const D &>(*this).Handle(), angle); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetTargetAngle() const { return b2RevoluteJoint_GetTargetAngle(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicRevoluteJointInterface<D, ForceConst>::SetTargetMotorSpeed(float motorSpeed) requires (!ForceConst) { b2RevoluteJoint_SetTargetMotorSpeed(static_cast<const D &>(*this).Handle(), motorSpeed); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetTargetMotorSpeed() const { return b2RevoluteJoint_GetTargetMotorSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicRevoluteJointInterface<D, ForceConst>::GetUpperLimit() const { return b2RevoluteJoint_GetUpperLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWeldJointInterface<D, ForceConst>::SetAngularDampingRatio(float dampingRatio) requires (!ForceConst) { b2WeldJoint_SetAngularDampingRatio(static_cast<const D &>(*this).Handle(), dampingRatio); }
    template <typename D, bool ForceConst> float BasicWeldJointInterface<D, ForceConst>::GetAngularDampingRatio() const { return b2WeldJoint_GetAngularDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWeldJointInterface<D, ForceConst>::SetAngularHertz(float hertz) requires (!ForceConst) { b2WeldJoint_SetAngularHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicWeldJointInterface<D, ForceConst>::GetAngularHertz() const { return b2WeldJoint_GetAngularHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWeldJointInterface<D, ForceConst>::SetLinearDampingRatio(float dampingRatio) requires (!ForceConst) { b2WeldJoint_SetLinearDampingRatio(static_cast<const D &>(*this).Handle(), dampingRatio); }
    template <typename D, bool ForceConst> float BasicWeldJointInterface<D, ForceConst>::GetLinearDampingRatio() const { return b2WeldJoint_GetLinearDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWeldJointInterface<D, ForceConst>::SetLinearHertz(float hertz) requires (!ForceConst) { b2WeldJoint_SetLinearHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicWeldJointInterface<D, ForceConst>::GetLinearHertz() const { return b2WeldJoint_GetLinearHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetCurrentLength() const { return b2DistanceJoint_GetCurrentLength(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetCurrentMotorForce() const { return b2DistanceJoint_GetCurrentMotorForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::EnableLimit(bool enableLimit) requires (!ForceConst) { b2DistanceJoint_EnableLimit(static_cast<const D &>(*this).Handle(), enableLimit); }
    template <typename D, bool ForceConst> bool BasicDistanceJointInterface<D, ForceConst>::IsLimitEnabled() const { return b2DistanceJoint_IsLimitEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::SetLimits(float minLength, float maxLength) requires (!ForceConst) { b2DistanceJoint_SetLimits(static_cast<const D &>(*this).Handle(), minLength, maxLength); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetLowerLimit() const { return b2DistanceJoint_GetLowerLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::SetMaxMotorForce(float force) requires (!ForceConst) { b2DistanceJoint_SetMaxMotorForce(static_cast<const D &>(*this).Handle(), force); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetMaxMotorForce() const { return b2DistanceJoint_GetMaxMotorForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::EnableMotor(bool enableMotor) requires (!ForceConst) { b2DistanceJoint_EnableMotor(static_cast<const D &>(*this).Handle(), enableMotor); }
    template <typename D, bool ForceConst> bool BasicDistanceJointInterface<D, ForceConst>::IsMotorEnabled() const { return b2DistanceJoint_IsMotorEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::SetRestLength(float length) requires (!ForceConst) { b2DistanceJoint_SetRestLength(static_cast<const D &>(*this).Handle(), length); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetRestLength() const { return b2DistanceJoint_GetRestLength(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::EnableSpring(bool enableSpring) requires (!ForceConst) { b2DistanceJoint_EnableSpring(static_cast<const D &>(*this).Handle(), enableSpring); }
    template <typename D, bool ForceConst> bool BasicDistanceJointInterface<D, ForceConst>::IsSpringEnabled() const { return b2DistanceJoint_IsSpringEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::SetSpringDampingRatio(float dampingRatio) requires (!ForceConst) { b2DistanceJoint_SetSpringDampingRatio(static_cast<const D &>(*this).Handle(), dampingRatio); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetSpringDampingRatio() const { return b2DistanceJoint_GetSpringDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetSpringForce() const { return b2DistanceJoint_GetSpringForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::SetSpringForceRange(float lowerForce, float upperForce) requires (!ForceConst) { b2DistanceJoint_SetSpringForceRange(static_cast<const D &>(*this).Handle(), lowerForce, upperForce); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::GetSpringForceRange(float* lowerForce, float* upperForce) const { b2DistanceJoint_GetSpringForceRange(static_cast<const D &>(*this).Handle(), lowerForce, upperForce); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::SetSpringHertz(float hertz) requires (!ForceConst) { b2DistanceJoint_SetSpringHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetSpringHertz() const { return b2DistanceJoint_GetSpringHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicDistanceJointInterface<D, ForceConst>::SetTargetMotorSpeed(float motorSpeed) requires (!ForceConst) { b2DistanceJoint_SetTargetMotorSpeed(static_cast<const D &>(*this).Handle(), motorSpeed); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetTargetMotorSpeed() const { return b2DistanceJoint_GetTargetMotorSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicDistanceJointInterface<D, ForceConst>::GetUpperLimit() const { return b2DistanceJoint_GetUpperLimit(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetAngularDampingRatio(float damping) requires (!ForceConst) { b2MotorJoint_SetAngularDampingRatio(static_cast<const D &>(*this).Handle(), damping); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetAngularDampingRatio() const { return b2MotorJoint_GetAngularDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetAngularHertz(float hertz) requires (!ForceConst) { b2MotorJoint_SetAngularHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetAngularHertz() const { return b2MotorJoint_GetAngularHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetAngularVelocity(float velocity) requires (!ForceConst) { b2MotorJoint_SetAngularVelocity(static_cast<const D &>(*this).Handle(), velocity); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetAngularVelocity() const { return b2MotorJoint_GetAngularVelocity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetLinearDampingRatio(float damping) requires (!ForceConst) { b2MotorJoint_SetLinearDampingRatio(static_cast<const D &>(*this).Handle(), damping); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetLinearDampingRatio() const { return b2MotorJoint_GetLinearDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetLinearHertz(float hertz) requires (!ForceConst) { b2MotorJoint_SetLinearHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetLinearHertz() const { return b2MotorJoint_GetLinearHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetLinearVelocity(b2Vec2 velocity) requires (!ForceConst) { b2MotorJoint_SetLinearVelocity(static_cast<const D &>(*this).Handle(), velocity); }
    template <typename D, bool ForceConst> b2Vec2 BasicMotorJointInterface<D, ForceConst>::GetLinearVelocity() const { return b2MotorJoint_GetLinearVelocity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetMaxSpringForce(float maxForce) requires (!ForceConst) { b2MotorJoint_SetMaxSpringForce(static_cast<const D &>(*this).Handle(), maxForce); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetMaxSpringForce() const { return b2MotorJoint_GetMaxSpringForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetMaxSpringTorque(float maxTorque) requires (!ForceConst) { b2MotorJoint_SetMaxSpringTorque(static_cast<const D &>(*this).Handle(), maxTorque); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetMaxSpringTorque() const { return b2MotorJoint_GetMaxSpringTorque(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetMaxVelocityForce(float maxForce) requires (!ForceConst) { b2MotorJoint_SetMaxVelocityForce(static_cast<const D &>(*this).Handle(), maxForce); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetMaxVelocityForce() const { return b2MotorJoint_GetMaxVelocityForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMotorJointInterface<D, ForceConst>::SetMaxVelocityTorque(float maxTorque) requires (!ForceConst) { b2MotorJoint_SetMaxVelocityTorque(static_cast<const D &>(*this).Handle(), maxTorque); }
    template <typename D, bool ForceConst> float BasicMotorJointInterface<D, ForceConst>::GetMaxVelocityTorque() const { return b2MotorJoint_GetMaxVelocityTorque(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMoverJointInterface<D, ForceConst>::SetLinearVelocity(b2Vec2 velocity) requires (!ForceConst) { b2MoverJoint_SetLinearVelocity(static_cast<const D &>(*this).Handle(), velocity); }
    template <typename D, bool ForceConst> b2Vec2 BasicMoverJointInterface<D, ForceConst>::GetLinearVelocity() const { return b2MoverJoint_GetLinearVelocity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicMoverJointInterface<D, ForceConst>::SetMaxVelocityForce(b2Vec2 maxForce) requires (!ForceConst) { b2MoverJoint_SetMaxVelocityForce(static_cast<const D &>(*this).Handle(), maxForce); }
    template <typename D, bool ForceConst> b2Vec2 BasicMoverJointInterface<D, ForceConst>::GetMaxVelocityForce() const { return b2MoverJoint_GetMaxVelocityForce(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicPogoJointInterface<D, ForceConst>::GetCurrentLength() const { return b2PogoJoint_GetCurrentLength(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicPogoJointInterface<D, ForceConst>::GetCurrentSpeed() const { return b2PogoJoint_GetCurrentSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicPogoJointInterface<D, ForceConst>::GetImpulse() const { return b2PogoJoint_GetImpulse(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPogoJointInterface<D, ForceConst>::SetRestLength(float length) requires (!ForceConst) { b2PogoJoint_SetRestLength(static_cast<const D &>(*this).Handle(), length); }
    template <typename D, bool ForceConst> float BasicPogoJointInterface<D, ForceConst>::GetRestLength() const { return b2PogoJoint_GetRestLength(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPogoJointInterface<D, ForceConst>::SetSpringDampingRatio(float dampingRatio) requires (!ForceConst) { b2PogoJoint_SetSpringDampingRatio(static_cast<const D &>(*this).Handle(), dampingRatio); }
    template <typename D, bool ForceConst> float BasicPogoJointInterface<D, ForceConst>::GetSpringDampingRatio() const { return b2PogoJoint_GetSpringDampingRatio(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicPogoJointInterface<D, ForceConst>::SetSpringHertz(float hertz) requires (!ForceConst) { b2PogoJoint_SetSpringHertz(static_cast<const D &>(*this).Handle(), hertz); }
    template <typename D, bool ForceConst> float BasicPogoJointInterface<D, ForceConst>::GetSpringHertz() const { return b2PogoJoint_GetSpringHertz(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> Chain BasicBodyInterface<D, ForceConst>::CreateChain(Tags::OwningHandle, const std::derived_from<b2ChainDef> auto& def) requires (!ForceConst) { Chain ret; ret.id = b2CreateChain(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> ChainRef BasicBodyInterface<D, ForceConst>::CreateChain(Tags::DestroyWithParent, const std::derived_from<b2ChainDef> auto& def) requires (!ForceConst) { return b2CreateChain(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> Shape BasicBodyInterface<D, ForceConst>::CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Capsule& capsule) requires (!ForceConst) { Shape ret; ret.id = b2CreateCapsuleShape(static_cast<const D &>(*this).Handle(), &def, &capsule); return ret; }
    template <typename D, bool ForceConst> ShapeRef BasicBodyInterface<D, ForceConst>::CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Capsule& capsule) requires (!ForceConst) { return b2CreateCapsuleShape(static_cast<const D &>(*this).Handle(), &def, &capsule); }
    template <typename D, bool ForceConst> Shape BasicBodyInterface<D, ForceConst>::CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2ChainSegment& chainSegment) requires (!ForceConst) { Shape ret; ret.id = b2CreateChainSegmentShape(static_cast<const D &>(*this).Handle(), &def, &chainSegment); return ret; }
    template <typename D, bool ForceConst> ShapeRef BasicBodyInterface<D, ForceConst>::CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2ChainSegment& chainSegment) requires (!ForceConst) { return b2CreateChainSegmentShape(static_cast<const D &>(*this).Handle(), &def, &chainSegment); }
    template <typename D, bool ForceConst> Shape BasicBodyInterface<D, ForceConst>::CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Circle& circle) requires (!ForceConst) { Shape ret; ret.id = b2CreateCircleShape(static_cast<const D &>(*this).Handle(), &def, &circle); return ret; }
    template <typename D, bool ForceConst> ShapeRef BasicBodyInterface<D, ForceConst>::CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Circle& circle) requires (!ForceConst) { return b2CreateCircleShape(static_cast<const D &>(*this).Handle(), &def, &circle); }
    template <typename D, bool ForceConst> Shape BasicBodyInterface<D, ForceConst>::CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Polygon& polygon) requires (!ForceConst) { Shape ret; ret.id = b2CreatePolygonShape(static_cast<const D &>(*this).Handle(), &def, &polygon); return ret; }
    template <typename D, bool ForceConst> ShapeRef BasicBodyInterface<D, ForceConst>::CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Polygon& polygon) requires (!ForceConst) { return b2CreatePolygonShape(static_cast<const D &>(*this).Handle(), &def, &polygon); }
    template <typename D, bool ForceConst> Shape BasicBodyInterface<D, ForceConst>::CreateShape(Tags::OwningHandle, const std::derived_from<b2ShapeDef> auto& def, const b2Segment& segment) requires (!ForceConst) { Shape ret; ret.id = b2CreateSegmentShape(static_cast<const D &>(*this).Handle(), &def, &segment); return ret; }
    template <typename D, bool ForceConst> ShapeRef BasicBodyInterface<D, ForceConst>::CreateShape(Tags::DestroyWithParent, const std::derived_from<b2ShapeDef> auto& def, const b2Segment& segment) requires (!ForceConst) { return b2CreateSegmentShape(static_cast<const D &>(*this).Handle(), &def, &segment); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::Destroy() requires (!ForceConst) { if (*this) { b2DestroyBody(static_cast<const D &>(*this).Handle()); static_cast<D &>(*this).id = {}; } }
    template <typename D, bool ForceConst> bool BasicBodyInterface<D, ForceConst>::IsValid() const { return b2Body_IsValid(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::Enable() requires (!ForceConst) { b2Body_Enable(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> bool BasicBodyInterface<D, ForceConst>::IsEnabled() const { return b2Body_IsEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetAngularDamping(float angularDamping) requires (!ForceConst) { b2Body_SetAngularDamping(static_cast<const D &>(*this).Handle(), angularDamping); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetAngularDamping() const { return b2Body_GetAngularDamping(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetAngularVelocity(float angularVelocity) requires (!ForceConst) { b2Body_SetAngularVelocity(static_cast<const D &>(*this).Handle(), angularVelocity); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetAngularVelocity() const { return b2Body_GetAngularVelocity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::ApplyAngularImpulse(float impulse, bool wake) requires (!ForceConst) { b2Body_ApplyAngularImpulse(static_cast<const D &>(*this).Handle(), impulse, wake); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::ApplyForce(b2Vec2 force, b2Pos point, bool wake) requires (!ForceConst) { b2Body_ApplyForce(static_cast<const D &>(*this).Handle(), force, point, wake); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::ApplyForceToCenter(b2Vec2 force, bool wake) requires (!ForceConst) { b2Body_ApplyForceToCenter(static_cast<const D &>(*this).Handle(), force, wake); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::ApplyLinearImpulse(b2Vec2 impulse, b2Pos point, bool wake) requires (!ForceConst) { b2Body_ApplyLinearImpulse(static_cast<const D &>(*this).Handle(), impulse, point, wake); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::ApplyLinearImpulseToCenter(b2Vec2 impulse, bool wake) requires (!ForceConst) { b2Body_ApplyLinearImpulseToCenter(static_cast<const D &>(*this).Handle(), impulse, wake); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::ApplyTorque(float torque, bool wake) requires (!ForceConst) { b2Body_ApplyTorque(static_cast<const D &>(*this).Handle(), torque, wake); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetAwake(bool awake) requires (!ForceConst) { b2Body_SetAwake(static_cast<const D &>(*this).Handle(), awake); }
    template <typename D, bool ForceConst> bool BasicBodyInterface<D, ForceConst>::IsAwake() const { return b2Body_IsAwake(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetBullet(bool flag) requires (!ForceConst) { b2Body_SetBullet(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicBodyInterface<D, ForceConst>::IsBullet() const { return b2Body_IsBullet(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::ClearForces() requires (!ForceConst) { b2Body_ClearForces(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2AABB BasicBodyInterface<D, ForceConst>::ComputeBounds() const { return b2Body_ComputeBounds(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicBodyInterface<D, ForceConst>::GetContactCapacity() const { return b2Body_GetContactCapacity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicBodyInterface<D, ForceConst>::GetContactData(b2ContactData* contactData, int capacity) const { return b2Body_GetContactData(static_cast<const D &>(*this).Handle(), contactData, capacity); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::EnableContactEvents(bool flag) requires (!ForceConst) { b2Body_EnableContactEvents(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::EnableContactRecycling(bool flag) requires (!ForceConst) { b2Body_EnableContactRecycling(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicBodyInterface<D, ForceConst>::IsContactRecyclingEnabled() const { return b2Body_IsContactRecyclingEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::Disable() requires (!ForceConst) { b2Body_Disable(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetGravityScale(float gravityScale) requires (!ForceConst) { b2Body_SetGravityScale(static_cast<const D &>(*this).Handle(), gravityScale); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetGravityScale() const { return b2Body_GetGravityScale(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::EnableHitEvents(bool flag) requires (!ForceConst) { b2Body_EnableHitEvents(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> int BasicBodyInterface<D, ForceConst>::GetJointCount() const { return b2Body_GetJointCount(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicBodyInterface<D, ForceConst>::GetJoints(b2JointId* jointArray, int capacity) const { return b2Body_GetJoints(static_cast<const D &>(*this).Handle(), jointArray, capacity); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetLinearDamping(float linearDamping) requires (!ForceConst) { b2Body_SetLinearDamping(static_cast<const D &>(*this).Handle(), linearDamping); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetLinearDamping() const { return b2Body_GetLinearDamping(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetLinearVelocity(b2Vec2 linearVelocity) requires (!ForceConst) { b2Body_SetLinearVelocity(static_cast<const D &>(*this).Handle(), linearVelocity); }
    template <typename D, bool ForceConst> b2Vec2 BasicBodyInterface<D, ForceConst>::GetLinearVelocity() const { return b2Body_GetLinearVelocity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Vec2 BasicBodyInterface<D, ForceConst>::GetLocalCenter() const { return b2Body_GetLocalCenter(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Vec2 BasicBodyInterface<D, ForceConst>::GetLocalPoint(b2Pos worldPoint) const { return b2Body_GetLocalPoint(static_cast<const D &>(*this).Handle(), worldPoint); }
    template <typename D, bool ForceConst> b2Vec2 BasicBodyInterface<D, ForceConst>::GetLocalPointVelocity(b2Vec2 localPoint) const { return b2Body_GetLocalPointVelocity(static_cast<const D &>(*this).Handle(), localPoint); }
    template <typename D, bool ForceConst> b2Vec2 BasicBodyInterface<D, ForceConst>::GetLocalVector(b2Vec2 worldVector) const { return b2Body_GetLocalVector(static_cast<const D &>(*this).Handle(), worldVector); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetMass() const { return b2Body_GetMass(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetMassData(b2MassData massData) requires (!ForceConst) { b2Body_SetMassData(static_cast<const D &>(*this).Handle(), massData); }
    template <typename D, bool ForceConst> b2MassData BasicBodyInterface<D, ForceConst>::GetMassData() const { return b2Body_GetMassData(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetMaxExtent() const { return b2Body_GetMaxExtent(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetMaxExtentFromOrigin() const { return b2Body_GetMaxExtentFromOrigin(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetMinExtent() const { return b2Body_GetMinExtent(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetMotionLocks(b2MotionLocks locks) requires (!ForceConst) { b2Body_SetMotionLocks(static_cast<const D &>(*this).Handle(), locks); }
    template <typename D, bool ForceConst> b2MotionLocks BasicBodyInterface<D, ForceConst>::GetMotionLocks() const { return b2Body_GetMotionLocks(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetName(const char* name) requires (!ForceConst) { b2Body_SetName(static_cast<const D &>(*this).Handle(), name); }
    template <typename D, bool ForceConst> const char* BasicBodyInterface<D, ForceConst>::GetName() const { return b2Body_GetName(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Pos BasicBodyInterface<D, ForceConst>::GetPosition() const { return b2Body_GetPosition(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Rot BasicBodyInterface<D, ForceConst>::GetRotation() const { return b2Body_GetRotation(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetRotationalInertia() const { return b2Body_GetRotationalInertia(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetSafetyFactor(float safetyFactor) requires (!ForceConst) { b2Body_SetSafetyFactor(static_cast<const D &>(*this).Handle(), safetyFactor); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetSafetyFactor() const { return b2Body_GetSafetyFactor(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicBodyInterface<D, ForceConst>::GetShapeCount() const { return b2Body_GetShapeCount(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicBodyInterface<D, ForceConst>::GetShapes(b2ShapeId* shapeArray, int capacity) const { return b2Body_GetShapes(static_cast<const D &>(*this).Handle(), shapeArray, capacity); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetSleepThreshold(float sleepThreshold) requires (!ForceConst) { b2Body_SetSleepThreshold(static_cast<const D &>(*this).Handle(), sleepThreshold); }
    template <typename D, bool ForceConst> float BasicBodyInterface<D, ForceConst>::GetSleepThreshold() const { return b2Body_GetSleepThreshold(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::EnableSleeping(bool enableSleep) requires (!ForceConst) { b2Body_EnableSleeping(static_cast<const D &>(*this).Handle(), enableSleep); }
    template <typename D, bool ForceConst> bool BasicBodyInterface<D, ForceConst>::IsSleepingEnabled() const { return b2Body_IsSleepingEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetTargetTransform(b2WorldTransform target, float timeStep, bool wake) requires (!ForceConst) { b2Body_SetTargetTransform(static_cast<const D &>(*this).Handle(), target, timeStep, wake); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetTransform(b2Pos position, b2Rot rotation) requires (!ForceConst) { b2Body_SetTransform(static_cast<const D &>(*this).Handle(), position, rotation); }
    template <typename D, bool ForceConst> b2WorldTransform BasicBodyInterface<D, ForceConst>::GetTransform() const { return b2Body_GetTransform(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetType(b2BodyType type) requires (!ForceConst) { b2Body_SetType(static_cast<const D &>(*this).Handle(), type); }
    template <typename D, bool ForceConst> b2BodyType BasicBodyInterface<D, ForceConst>::GetType() const { return b2Body_GetType(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::UpdateMassFromShapes() requires (!ForceConst) { b2Body_UpdateMassFromShapes(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::SetUserData(void* userData) requires (!ForceConst) { b2Body_SetUserData(static_cast<const D &>(*this).Handle(), userData); }
    template <typename D, bool ForceConst> void* BasicBodyInterface<D, ForceConst>::GetUserData() const { return b2Body_GetUserData(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicBodyInterface<D, ForceConst>::WakeTouching() requires (!ForceConst) { b2Body_WakeTouching(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> WorldRef BasicBodyInterface<D, ForceConst>::GetWorld() requires (!ForceConst) { return b2Body_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> WorldConstRef BasicBodyInterface<D, ForceConst>::GetWorld() const { return b2Body_GetWorld(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Pos BasicBodyInterface<D, ForceConst>::GetWorldCenter() const { return b2Body_GetWorldCenter(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Pos BasicBodyInterface<D, ForceConst>::GetWorldPoint(b2Vec2 localPoint) const { return b2Body_GetWorldPoint(static_cast<const D &>(*this).Handle(), localPoint); }
    template <typename D, bool ForceConst> b2Vec2 BasicBodyInterface<D, ForceConst>::GetWorldPointVelocity(b2Pos worldPoint) const { return b2Body_GetWorldPointVelocity(static_cast<const D &>(*this).Handle(), worldPoint); }
    template <typename D, bool ForceConst> b2Vec2 BasicBodyInterface<D, ForceConst>::GetWorldVector(b2Vec2 localVector) const { return b2Body_GetWorldVector(static_cast<const D &>(*this).Handle(), localVector); }
    inline const uint8_t* Recording::GetDataPtr() const { return b2Recording_GetData(value); }
    inline bool Recording::SaveToFile(const char* path) const { return b2Recording_SaveToFile(value, path); }
    inline int Recording::GetSize() const { return b2Recording_GetSize(value); }
    template <typename D, bool ForceConst> Body BasicWorldInterface<D, ForceConst>::CreateBody(Tags::OwningHandle, const std::derived_from<b2BodyDef> auto& def) requires (!ForceConst) { Body ret; ret.id = b2CreateBody(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> BodyRef BasicWorldInterface<D, ForceConst>::CreateBody(Tags::DestroyWithParent, const std::derived_from<b2BodyDef> auto& def) requires (!ForceConst) { return b2CreateBody(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> DistanceJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2DistanceJointDef> auto& def) requires (!ForceConst) { DistanceJoint ret; ret.id = b2CreateDistanceJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> DistanceJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2DistanceJointDef> auto& def) requires (!ForceConst) { return (DistanceJointRef)b2CreateDistanceJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> Joint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const b2FilterJointDef& def) requires (!ForceConst) { Joint ret; ret.id = b2CreateFilterJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> JointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const b2FilterJointDef& def) requires (!ForceConst) { return b2CreateFilterJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> MotorJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2MotorJointDef> auto& def) requires (!ForceConst) { MotorJoint ret; ret.id = b2CreateMotorJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> MotorJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2MotorJointDef> auto& def) requires (!ForceConst) { return (MotorJointRef)b2CreateMotorJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> MoverJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2MoverJointDef> auto& def) requires (!ForceConst) { MoverJoint ret; ret.id = b2CreateMoverJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> MoverJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2MoverJointDef> auto& def) requires (!ForceConst) { return (MoverJointRef)b2CreateMoverJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> PogoJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2PogoJointDef> auto& def) requires (!ForceConst) { PogoJoint ret; ret.id = b2CreatePogoJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> PogoJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2PogoJointDef> auto& def) requires (!ForceConst) { return (PogoJointRef)b2CreatePogoJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> PrismaticJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2PrismaticJointDef> auto& def) requires (!ForceConst) { PrismaticJoint ret; ret.id = b2CreatePrismaticJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> PrismaticJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2PrismaticJointDef> auto& def) requires (!ForceConst) { return (PrismaticJointRef)b2CreatePrismaticJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> RevoluteJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2RevoluteJointDef> auto& def) requires (!ForceConst) { RevoluteJoint ret; ret.id = b2CreateRevoluteJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> RevoluteJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2RevoluteJointDef> auto& def) requires (!ForceConst) { return (RevoluteJointRef)b2CreateRevoluteJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> WeldJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2WeldJointDef> auto& def) requires (!ForceConst) { WeldJoint ret; ret.id = b2CreateWeldJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> WeldJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2WeldJointDef> auto& def) requires (!ForceConst) { return (WeldJointRef)b2CreateWeldJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> WheelJoint BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::OwningHandle, const std::derived_from<b2WheelJointDef> auto& def) requires (!ForceConst) { WheelJoint ret; ret.id = b2CreateWheelJoint(static_cast<const D &>(*this).Handle(), &def); return ret; }
    template <typename D, bool ForceConst> WheelJointRef BasicWorldInterface<D, ForceConst>::CreateJoint(Tags::DestroyWithParent, const std::derived_from<b2WheelJointDef> auto& def) requires (!ForceConst) { return (WheelJointRef)b2CreateWheelJoint(static_cast<const D &>(*this).Handle(), &def); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::Destroy() requires (!ForceConst) { if (*this) { b2DestroyWorld(static_cast<const D &>(*this).Handle()); static_cast<D &>(*this).id = {}; } }
    template <typename D, bool ForceConst> bool BasicWorldInterface<D, ForceConst>::IsValid() const { return b2World_IsValid(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicWorldInterface<D, ForceConst>::GetAwakeBodyCount() const { return b2World_GetAwakeBodyCount(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2BodyEvents BasicWorldInterface<D, ForceConst>::GetBodyEvents() const { return b2World_GetBodyEvents(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2AABB BasicWorldInterface<D, ForceConst>::GetBounds() const { return b2World_GetBounds(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2TreeStats BasicWorldInterface<D, ForceConst>::Cast(b2Pos origin, const b2ShapeProxy& proxy, b2Vec2 translation, b2QueryFilter filter, b2CastResultCallbackFcn* fcn, void* context) const { return b2World_CastShape(static_cast<const D &>(*this).Handle(), origin, &proxy, translation, filter, fcn, context); }
    template <typename D, bool ForceConst> float BasicWorldInterface<D, ForceConst>::CastMover(b2Pos origin, const b2Capsule& mover, b2Vec2 translation, b2QueryFilter filter) const { return b2World_CastMover(static_cast<const D &>(*this).Handle(), origin, &mover, translation, filter); }
    template <typename D, bool ForceConst> b2TreeStats BasicWorldInterface<D, ForceConst>::CastRay(b2Pos origin, b2Vec2 translation, b2QueryFilter filter, b2CastResultCallbackFcn* fcn, void* context) const { return b2World_CastRay(static_cast<const D &>(*this).Handle(), origin, translation, filter, fcn, context); }
    template <typename D, bool ForceConst> b2RayResult BasicWorldInterface<D, ForceConst>::CastRayClosest(b2Pos origin, b2Vec2 translation, b2QueryFilter filter) const { return b2World_CastRayClosest(static_cast<const D &>(*this).Handle(), origin, translation, filter); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::CollideMover(b2Pos origin, const b2Capsule& mover, b2QueryFilter filter, b2PlaneResultCallbackFcn* fcn, void* context) const { b2World_CollideMover(static_cast<const D &>(*this).Handle(), origin, &mover, filter, fcn, context); }
    template <typename D, bool ForceConst> b2ContactEvents BasicWorldInterface<D, ForceConst>::GetContactEvents() const { return b2World_GetContactEvents(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetContactRecycleDistance(float recycleDistance) requires (!ForceConst) { b2World_SetContactRecycleDistance(static_cast<const D &>(*this).Handle(), recycleDistance); }
    template <typename D, bool ForceConst> float BasicWorldInterface<D, ForceConst>::GetContactRecycleDistance() const { return b2World_GetContactRecycleDistance(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetContactTuning(float hertz, float dampingRatio, float pushSpeed) requires (!ForceConst) { b2World_SetContactTuning(static_cast<const D &>(*this).Handle(), hertz, dampingRatio, pushSpeed); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::GetContactTuning(float* hertz, float* dampingRatio, float* pushSpeed) const { b2World_GetContactTuning(static_cast<const D &>(*this).Handle(), hertz, dampingRatio, pushSpeed); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::EnableContinuous(bool flag) requires (!ForceConst) { b2World_EnableContinuous(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicWorldInterface<D, ForceConst>::IsContinuousEnabled() const { return b2World_IsContinuousEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Counters BasicWorldInterface<D, ForceConst>::GetCounters() const { return b2World_GetCounters(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetCustomFilterCallback(b2CustomFilterCallbackFcn* fcn, void* context) requires (!ForceConst) { b2World_SetCustomFilterCallback(static_cast<const D &>(*this).Handle(), fcn, context); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::Draw(b2DebugDraw& draw) const { b2World_Draw(static_cast<const D &>(*this).Handle(), &draw); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::DumpMemoryStats() requires (!ForceConst) { b2World_DumpMemoryStats(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::Explode(const b2ExplosionDef& explosionDef) requires (!ForceConst) { b2World_Explode(static_cast<const D &>(*this).Handle(), &explosionDef); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetFrictionCallback(b2FrictionCallbackFcn* callback) requires (!ForceConst) { b2World_SetFrictionCallback(static_cast<const D &>(*this).Handle(), callback); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetGravity(b2Vec2 gravity) requires (!ForceConst) { b2World_SetGravity(static_cast<const D &>(*this).Handle(), gravity); }
    template <typename D, bool ForceConst> b2Vec2 BasicWorldInterface<D, ForceConst>::GetGravity() const { return b2World_GetGravity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetHitEventThreshold(float value) requires (!ForceConst) { b2World_SetHitEventThreshold(static_cast<const D &>(*this).Handle(), value); }
    template <typename D, bool ForceConst> float BasicWorldInterface<D, ForceConst>::GetHitEventThreshold() const { return b2World_GetHitEventThreshold(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2JointEvents BasicWorldInterface<D, ForceConst>::GetJointEvents() const { return b2World_GetJointEvents(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2Capacity BasicWorldInterface<D, ForceConst>::GetMaxCapacity() const { return b2World_GetMaxCapacity(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetMaxLinearSpeed(float maximumLinearSpeed) requires (!ForceConst) { b2World_SetMaxLinearSpeed(static_cast<const D &>(*this).Handle(), maximumLinearSpeed); }
    template <typename D, bool ForceConst> float BasicWorldInterface<D, ForceConst>::GetMaxLinearSpeed() const { return b2World_GetMaxLinearSpeed(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> b2TreeStats BasicWorldInterface<D, ForceConst>::Overlap(b2Pos origin, b2AABB aabb, b2QueryFilter filter, b2OverlapResultCallbackFcn* fcn, void* context) const { return b2World_OverlapAABB(static_cast<const D &>(*this).Handle(), origin, aabb, filter, fcn, context); }
    template <typename D, bool ForceConst> b2TreeStats BasicWorldInterface<D, ForceConst>::Overlap(b2Pos origin, const b2ShapeProxy& proxy, b2QueryFilter filter, b2OverlapResultCallbackFcn* fcn, void* context) const { return b2World_OverlapShape(static_cast<const D &>(*this).Handle(), origin, &proxy, filter, fcn, context); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetPreSolveCallback(b2PreSolveCallbackFcn* preSolveFcn, b2PreContinuousCallbackFcn* preContinuousFcn, void* context) requires (!ForceConst) { b2World_SetPreSolveCallback(static_cast<const D &>(*this).Handle(), preSolveFcn, preContinuousFcn, context); }
    template <typename D, bool ForceConst> b2Profile BasicWorldInterface<D, ForceConst>::GetProfile() const { return b2World_GetProfile(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::RebuildStaticTree() requires (!ForceConst) { b2World_RebuildStaticTree(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetRestitutionCallback(b2RestitutionCallbackFcn* callback) requires (!ForceConst) { b2World_SetRestitutionCallback(static_cast<const D &>(*this).Handle(), callback); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetRestitutionIterations(int iterations) requires (!ForceConst) { b2World_SetRestitutionIterations(static_cast<const D &>(*this).Handle(), iterations); }
    template <typename D, bool ForceConst> int BasicWorldInterface<D, ForceConst>::GetRestitutionIterations() const { return b2World_GetRestitutionIterations(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::EnableRestitutionPropagation(bool flag) requires (!ForceConst) { b2World_EnableRestitutionPropagation(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicWorldInterface<D, ForceConst>::IsRestitutionPropagationEnabled() const { return b2World_IsRestitutionPropagationEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetRestitutionThreshold(float value) requires (!ForceConst) { b2World_SetRestitutionThreshold(static_cast<const D &>(*this).Handle(), value); }
    template <typename D, bool ForceConst> float BasicWorldInterface<D, ForceConst>::GetRestitutionThreshold() const { return b2World_GetRestitutionThreshold(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> bool BasicWorldInterface<D, ForceConst>::RestoreFromSnapshot(std::span<const uint8_t> image) requires (!ForceConst) { return b2World_RestoreFromSnapshot(static_cast<const D &>(*this).Handle(), image.data(), (int)image.size()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::EnableSSE2Fallback(bool flag) requires (!ForceConst) { b2World_EnableSSE2Fallback(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> b2SensorEvents BasicWorldInterface<D, ForceConst>::GetSensorEvents() const { return b2World_GetSensorEvents(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::EnableSleeping(bool flag) requires (!ForceConst) { b2World_EnableSleeping(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicWorldInterface<D, ForceConst>::IsSleepingEnabled() const { return b2World_IsSleepingEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> int BasicWorldInterface<D, ForceConst>::GetSnapshot(uint8_t* image, int capacity) const { return b2World_GetSnapshot(static_cast<const D &>(*this).Handle(), image, capacity); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::StartRecording(Recording& recording) requires (!ForceConst) { b2World_StartRecording(static_cast<const D &>(*this).Handle(), recording.UnderlyingPtr()); }
    template <typename D, bool ForceConst> uint64_t BasicWorldInterface<D, ForceConst>::GetStateHash() const { return b2World_GetStateHash(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::Step(float timeStep, int subStepCount) requires (!ForceConst) { b2World_Step(static_cast<const D &>(*this).Handle(), timeStep, subStepCount); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::StopRecording() requires (!ForceConst) { b2World_StopRecording(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetUserData(void* userData) requires (!ForceConst) { b2World_SetUserData(static_cast<const D &>(*this).Handle(), userData); }
    template <typename D, bool ForceConst> void* BasicWorldInterface<D, ForceConst>::GetUserData() const { return b2World_GetUserData(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::EnableWarmStarting(bool flag) requires (!ForceConst) { b2World_EnableWarmStarting(static_cast<const D &>(*this).Handle(), flag); }
    template <typename D, bool ForceConst> bool BasicWorldInterface<D, ForceConst>::IsWarmStartingEnabled() const { return b2World_IsWarmStartingEnabled(static_cast<const D &>(*this).Handle()); }
    template <typename D, bool ForceConst> void BasicWorldInterface<D, ForceConst>::SetWorkerCount(int count) requires (!ForceConst) { b2World_SetWorkerCount(static_cast<const D &>(*this).Handle(), count); }
    template <typename D, bool ForceConst> int BasicWorldInterface<D, ForceConst>::GetWorkerCount() const { return b2World_GetWorkerCount(static_cast<const D &>(*this).Handle()); }
} // namespace box2d
