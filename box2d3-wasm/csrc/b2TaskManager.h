#pragma once

#include "box2d/box2d.h"
#include "TaskScheduler.h"

struct b2WorldDef;

typedef void b2TaskCallback(int32_t start, int32_t end, uint32_t threadIndex, void* taskContext);

class b2TaskManager
{
public:
    b2TaskManager(int32_t maxTasks = 256);
    ~b2TaskManager();

    void Initialize(int32_t workerCount);
    void AssignToWorld(b2WorldDef* worldDef);

private:
    class SampleTask : public enki::ITaskSet
    {
    public:
        SampleTask() = default;

        void ExecuteRange(enki::TaskSetPartition range, uint32_t threadIndex) override
        {
            m_task(range.start, range.end, threadIndex, m_taskContext);
        }

        b2TaskCallback* m_task = nullptr;
        void* m_taskContext = nullptr;
    };

    static void* EnqueueTaskCallback(b2TaskCallback* task, int32_t itemCount, int32_t minRange,
                                   void* taskContext, void* userContext);
    static void FinishTaskCallback(void* taskPtr, void* userContext);

    enki::TaskScheduler* m_scheduler;
    SampleTask* m_tasks;
    int32_t m_maxTasks;
    int32_t m_taskCount;
};
