import type { TaskDetail } from '@/services/taskService';

/** The paginated list is authoritative; project snapshots only enrich its existing rows. */
export function mergeProjectTaskDetails(tasks: TaskDetail[], snapshot: TaskDetail[] = []): TaskDetail[] {
  const byId = new Map(snapshot.map((task) => [task.id, task]));
  return tasks.map((task) => ({ ...byId.get(task.id), ...task }));
}
