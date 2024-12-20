#include "b2TaskManager.h"
#include "TaskScheduler.h"
#include <cassert>

class SampleTask : public enki::ITaskSet
{
public:
    SampleTask() : enki::ITaskSet(0) {}
    
    virtual void ExecuteRange(enki::TaskSetPartition range, uint32_t threadnum) override
    {
        printf("Thread %u starting execution of range [%d, %d]\n", 
               threadnum, range.start, range.end);

        if (m_task)
        {
            m_task(range.start, range.end, threadnum, m_taskContext);
        }

        printf("Thread %u completed execution of range [%d, %d]\n", 
               threadnum, range.start, range.end);
    }

    b2TaskCallback* m_task = nullptr;
    void* m_taskContext = nullptr;
};

b2TaskManager::b2TaskManager(int32_t maxTasks)
    : m_maxTasks(maxTasks)
    , m_taskCount(0)
    , m_scheduler(new enki::TaskScheduler())
    , m_tasks(new SampleTask[maxTasks])
{
    // Initialize with a reasonable number of threads
    m_scheduler->Initialize();
}

b2TaskManager::~b2TaskManager()
{
    if (m_scheduler)
    {
        // Wait for all tasks to complete before destroying
        for (int32_t i = 0; i < m_taskCount; ++i)
        {
            m_scheduler->WaitforTask(&m_tasks[i]);
        }
        delete m_scheduler;
    }
    delete[] m_tasks;
}

void b2TaskManager::Initialize(int32_t workerCount)
{
    printf("Initializing task manager with %d workers\n", workerCount);
    // Make sure we don't initialize twice
    if (m_scheduler)
    {
        m_scheduler->Initialize(workerCount);
    }
}

void* b2TaskManager::EnqueueTaskCallback(b2TaskCallback* task, int32_t itemCount, int32_t minRange,
                                       void* taskContext, void* userContext)
{
    b2TaskManager* manager = static_cast<b2TaskManager*>(userContext);
    assert(manager && manager->m_scheduler);

    if (!manager || !manager->m_scheduler)
    {
        if (task)
        {
            // Fallback to synchronous execution
            task(0, itemCount, 0, taskContext);
        }
        return nullptr;
    }

    int32_t taskIndex = manager->m_taskCount++;
    if (taskIndex < manager->m_maxTasks)
    {
        printf("Enqueueing task %d with size %d and minRange %d\n", 
        taskIndex, itemCount, minRange);

        SampleTask& sampleTask = manager->m_tasks[taskIndex];
        sampleTask.m_task = task;
        sampleTask.m_taskContext = taskContext;
        sampleTask.m_SetSize = itemCount;  // Changed from SetSize() to m_SetSize
        sampleTask.m_MinRange = minRange;

        manager->m_scheduler->AddTaskSetToPipe(&sampleTask);
        printf("Task %d added to pipe\n", taskIndex);
        return &sampleTask;
    }

    // If we exceed max tasks, execute synchronously
    if (task)
    {

        printf("Exceeded max tasks, executing synchronously\n");

        task(0, itemCount, 0, taskContext);
    }
    return nullptr;
}

void b2TaskManager::FinishTaskCallback(void* taskPtr, void* userContext)
{
    if (!taskPtr || !userContext) return;

    b2TaskManager* manager = static_cast<b2TaskManager*>(userContext);
    SampleTask* sampleTask = static_cast<SampleTask*>(taskPtr);

    if (manager && manager->m_scheduler && sampleTask)
    {
        printf("Waiting for task to complete...\n");
        manager->m_scheduler->WaitforTask(sampleTask);

        // Reset task count after last task completes

         if (manager->m_taskCount > 0) {
            manager->m_taskCount--;
            printf("Task completed, remaining tasks: %d\n", manager->m_taskCount);
        }

        printf("Task completed\n");
    }
}

void b2TaskManager::AssignToWorld(b2WorldDef* worldDef)
{
    if (worldDef)
    {
        worldDef->enqueueTask = EnqueueTaskCallback;
        worldDef->finishTask = FinishTaskCallback;
        worldDef->userTaskContext = this;
    }
}
