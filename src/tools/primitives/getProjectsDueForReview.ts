import { executeOmniFocusScript } from "../../utils/scriptExecution.js";
import type { GetProjectsResult, ProjectSummary } from "./getProjects.js";

export interface GetProjectsDueForReviewOptions {
  includeOnHold?: boolean;
}

export async function getProjectsDueForReview(
  options: GetProjectsDueForReviewOptions = {},
): Promise<GetProjectsResult> {
  const { includeOnHold = false } = options;

  try {
    const result = await executeOmniFocusScript("@getProjectsDueForReview.js", {
      includeOnHold: includeOnHold,
    });

    if (typeof result === "string") {
      return { projects: [], text: result };
    }

    if (result && typeof result === "object") {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      let projects: ProjectSummary[] = [];
      let output = `## Projects Due for Review\n\n`;

      if (data.projects && Array.isArray(data.projects)) {
        projects = data.projects as ProjectSummary[];
        if (data.projects.length === 0) {
          output += "No projects are currently due for review.\n";
        } else {
          output += `${data.projects.length} project${data.projects.length === 1 ? "" : "s"} due for review:\n\n`;

          data.projects.forEach((proj: any) => {
            const nextReview = proj.nextReviewDate
              ? new Date(proj.nextReviewDate).toLocaleDateString()
              : "unknown";
            const lastReview = proj.lastReviewDate
              ? new Date(proj.lastReviewDate).toLocaleDateString()
              : "never";
            const interval = proj.reviewInterval
              ? `every ${proj.reviewInterval.steps} ${proj.reviewInterval.unit}`
              : "no interval";
            const folderStr = proj.folderName
              ? ` 📁 ${proj.folderName}`
              : "";
            const statusBadge = proj.status === "OnHold" ? " [OnHold]" : "";

            output += `P: ${proj.name}${statusBadge}${folderStr} (${proj.taskCount} tasks)\n`;
            output += `   ID: ${proj.id}\n`;
            output += `   Review: was due ${nextReview}, last reviewed ${lastReview}, ${interval}\n`;

            if (proj.note && proj.note.trim()) {
              const notePreview = proj.note.trim().substring(0, 100);
              output += `   Note: ${notePreview}${proj.note.trim().length > 100 ? "..." : ""}\n`;
            }

            output += "\n";
          });
        }
      }

      return { projects, text: output };
    }

    return { projects: [], text: "Unexpected result format from OmniFocus" };
  } catch (error) {
    console.error("Error in getProjectsDueForReview:", error);
    throw new Error(
      `Failed to get projects due for review: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
