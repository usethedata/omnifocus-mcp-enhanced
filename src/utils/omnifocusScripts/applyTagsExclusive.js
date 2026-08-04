// OmniJS script to apply tags to a task while respecting mutually exclusive tag groups.
// Group resolution lives in tagAssignmentHelpers.js so this script and
// batchEditItems.js share one implementation.
(() => {
  try {
    const args = (typeof injectedArgs !== 'undefined') ? injectedArgs : {};
    const taskId = args.taskId;
    const tagNames = Array.isArray(args.tagNames) ? args.tagNames : [];
    const mode = args.mode || 'add';

    if (!taskId) {
      return JSON.stringify({ success: false, error: 'taskId is required' });
    }

    // Resolve the task by identifier.
    let task = null;
    if (typeof Task !== 'undefined' && Task.byIdentifier) {
      task = Task.byIdentifier(taskId);
    }
    if (!task && typeof flattenedTasks !== 'undefined') {
      task = flattenedTasks.find(t => t.id && t.id.primaryKey === taskId) || null;
    }
    if (!task) {
      return JSON.stringify({ success: false, error: 'Task not found: ' + taskId });
    }

    const applied = [];
    const removedSiblings = [];
    const missing = [];

    // For replace mode, clear existing tags first.
    if (mode === 'replace') {
      tagClearOnTask(task);
    }

    tagNames.forEach(name => {
      const tag = tagFindByName(name);
      if (!tag) {
        missing.push(name);
        return;
      }

      tagApplyToTask(task, tag).forEach(siblingName => {
        removedSiblings.push(siblingName);
      });
      applied.push(name);
    });

    return JSON.stringify({ success: true, applied, removedSiblings, missing });
  } catch (error) {
    return JSON.stringify({ success: false, error: String(error) });
  }
})();
