import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { dedupeExpandedTopLevelTasks, formatTaskTreeNode, TaskReadResult, TaskTreeNode } from './taskTreeFormatter.js';

export interface GetTasksByTagOptions {
  tagName: string;
  hideCompleted?: boolean;
  exactMatch?: boolean;
  showSubtasks?: boolean;
  maxSubtaskDepth?: number;
}

export interface GetTasksByTagResult extends TaskReadResult {
  /** Tag names the query actually resolved to. */
  matchedTags: string[];
  /** Suggestions returned when nothing matched. */
  availableTags: string[];
}

export async function getTasksByTag(options: GetTasksByTagOptions): Promise<GetTasksByTagResult> {
  const { tagName, hideCompleted = true, exactMatch = false, showSubtasks = false, maxSubtaskDepth } = options;
  
  if (!tagName || tagName.trim() === '') {
    throw new Error('Tag name is required');
  }
  
  try {
    // Execute the tasks by tag script
    const result = await executeOmniFocusScript('@tasksByTag.js', { 
      tagName: tagName.trim(),
      hideCompleted: hideCompleted,
      exactMatch,
      showSubtasks,
      maxSubtaskDepth
    });
    
    if (typeof result === 'string') {
      return { tasks: [], matchedTags: [], availableTags: [], text: result };
    }
    
    // If result is an object, format it
    if (result && typeof result === 'object') {
      const data = result as any;
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Format the tasks by tag
      let allDisplayedTasks: TaskTreeNode[] = [];
      const matchedTags: string[] = Array.isArray(data.matchedTags) ? data.matchedTags : [];
      const availableTags: string[] = Array.isArray(data.availableTags) ? data.availableTags : [];
      const searchType = exactMatch ? 'exact match' : 'partial match';
      let output = `# 🏷 TASKS WITH TAG: "${tagName}" (${searchType})\n\n`;
      
      if (data.matchedTags && data.matchedTags.length > 0) {
        output += `**Matched tags**: ${data.matchedTags.join(', ')}\n\n`;
      }
      
      if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          output += `No tasks found with tag "${tagName}"\n`;
          if (data.availableTags && data.availableTags.length > 0) {
            output += `\n**Available tags**: ${data.availableTags.slice(0, 10).join(', ')}`;
            if (data.availableTags.length > 10) {
              output += ` ... and ${data.availableTags.length - 10} more`;
            }
            output += '\n';
          }
        } else {
          const taskCount = data.tasks.length;
          output += `Found ${taskCount} task${taskCount === 1 ? '' : 's'}:\n\n`;
          
          // Group tasks by project for better organization
          const tasksByProject = new Map<string, any[]>();
          
          const displayedTasks = dedupeExpandedTopLevelTasks(data.tasks as TaskTreeNode[], showSubtasks);
          allDisplayedTasks = displayedTasks;
          if (displayedTasks.length !== data.tasks.length) {
            output += `Displayed as ${displayedTasks.length} task tree${displayedTasks.length === 1 ? '' : 's'} to avoid duplicate subtasks.\n\n`;
          }
          displayedTasks.forEach((task: TaskTreeNode) => {
            const projectName = task.projectName || '📥 Inbox';
            if (!tasksByProject.has(projectName)) {
              tasksByProject.set(projectName, []);
            }
            tasksByProject.get(projectName)!.push(task);
          });
          
          // Display tasks grouped by project
          tasksByProject.forEach((tasks, projectName) => {
            if (tasksByProject.size > 1) {
              output += `## 📁 ${projectName}\n`;
            }
            
            tasks.forEach((task: TaskTreeNode) => {
              output += formatTaskTreeNode(task, '• ', { showSubtasks, matchedTags: data.matchedTags });
              output += '\n';
            });
          });
          
          // Summary
          output += `📊 **Summary**: ${taskCount} task${taskCount === 1 ? '' : 's'} with tag "${tagName}"\n`;
        }
      } else {
        output += "No tasks data available\n";
      }
      
      return { tasks: allDisplayedTasks, matchedTags, availableTags, text: output };
    }
    
    return { tasks: [], matchedTags: [], availableTags: [], text: 'Unexpected result format from OmniFocus' };
    
  } catch (error) {
    console.error("Error in getTasksByTag:", error);
    throw new Error(`Failed to get tasks by tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
