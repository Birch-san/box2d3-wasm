// TaskSystem.cpp
#include <box2d/box2d.h>
#include <emscripten.h>
#include <emscripten/bind.h>
#include "threading.h"
#include "TaskScheduler.h"

using namespace emscripten;
using namespace enki;

static void* SchedulePhysicsTask(b2TaskCallbackFcn* task, void* taskContext, void* userContext)
{
    TaskSystem* system = static_cast<TaskSystem*>(userContext);

    if (system->activeTaskCount < TaskSystem::MAX_TASKS)
    {
        PhysicsTask& physicsTask = system->tasks[system->activeTaskCount];
        physicsTask.m_SetSize = 1;
        physicsTask.m_MinRange = 1;
        physicsTask.taskCallback = task;
        physicsTask.taskData = taskContext;

        system->taskScheduler->AddTaskSetToPipe(&physicsTask);
        ++system->activeTaskCount;
        return &physicsTask;
    }
    else
    {
        // Returning nullptr tells Box2D the work already ran serially.
        task(taskContext);
        return nullptr;
    }
}

static void WaitForPhysicsTask(void* taskPtr, void* userContext)
{
    if (taskPtr != nullptr)
    {
        PhysicsTask* physicsTask = static_cast<PhysicsTask*>(taskPtr);
        TaskSystem* system = static_cast<TaskSystem*>(userContext);
        system->taskScheduler->WaitforTask(physicsTask);
    }
}

EMSCRIPTEN_BINDINGS(threading) {
    class_<TaskSystem>("TaskSystem")
        .constructor<int>()
        .function("GetActiveTaskCount", &TaskSystem::GetActiveTaskCount)
        .function("GetTotalThreadCount", &TaskSystem::GetTotalThreadCount)
        .function("ClearTasks", &TaskSystem::ClearTasks)
        ;

    function("b2CreateThreadedWorld", optional_override([](
        b2WorldDef& originalDef,
        TaskSystem& system
    ) -> b2WorldId
    {
        b2WorldDef def = originalDef;
        def.enqueueTask = &SchedulePhysicsTask;
        def.finishTask = &WaitForPhysicsTask;
        def.userTaskContext = &system;
        def.workerCount = system.GetTotalThreadCount() - 1;

        return b2CreateWorld(&def);
    }));
}
