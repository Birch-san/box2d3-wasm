// TaskSystem.h
#ifndef TASK_SYSTEM_H
#define TASK_SYSTEM_H

#include "TaskScheduler.h"
#include <box2d/box2d.h>
#include <cstdint>
#include <cassert>

// Box2D v3.2 hands us whole tasks: each enqueued task must run exactly once, on one thread.
// Box2D splits the work across workers itself, so the task set has a size of one.
class PhysicsTask : public enki::ITaskSet
{
public:
    PhysicsTask() = default;

    void ExecuteRange(enki::TaskSetPartition range, uint32_t threadIndex) override
    {
        (void)range;
        (void)threadIndex;
        if (taskCallback)
        {
            taskCallback(taskData);
        }
    }

    b2TaskCallbackFcn* taskCallback = nullptr;
    void* taskData = nullptr;
};

struct TaskSystem
{
    // Box2D never enqueues more than B2_MAX_TASKS tasks per world step.
    static constexpr int MAX_TASKS = B2_MAX_TASKS;

    enki::TaskScheduler* taskScheduler = nullptr;
    PhysicsTask* tasks = nullptr;
    int activeTaskCount = 0;
    int totalThreadCount = 0;

    explicit TaskSystem(int workerCount)
    {
        taskScheduler = new enki::TaskScheduler;
        taskScheduler->Initialize(workerCount);

        tasks = new PhysicsTask[MAX_TASKS];
        activeTaskCount = 0;

        totalThreadCount = 1 + workerCount;
    }

    ~TaskSystem()
    {
        if (taskScheduler)
        {
            taskScheduler->WaitforAll();
            delete taskScheduler;
        }
        delete[] tasks;
    }

    void ClearTasks()
    {
        activeTaskCount = 0;
    }

    int GetActiveTaskCount() const
    {
        return activeTaskCount;
    }

    int GetTotalThreadCount() const
    {
        return totalThreadCount;
    }
};

#endif // TASK_SYSTEM_H
