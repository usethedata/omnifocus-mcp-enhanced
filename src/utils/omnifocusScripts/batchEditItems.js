// Batch edit task fields and tags with complete preflight, verification, and restoration.
//
// Three OmniFocus behaviours verified by live probe shape this script:
//   1. An empty name is stored without complaint.
//   2. A deferDate later than a dueDate is stored without complaint.
//   3. Completed and dropped tasks accept writes silently.
// Reading a value back therefore proves storage succeeded and nothing more, so
// every check runs before the first write.
//
// Two verified behaviours remove work: a repeating task's rule survives a
// due-date write untouched, and task.modified is not a usable change signal, so
// verification compares field values.
//
// Requires tagAssignmentHelpers.js (registered in HELPER_BY_SCRIPT).
(() => {
  const args = typeof injectedArgs !== "undefined" ? injectedArgs : {};
  const items = args.items || [];
  const dryRun = args.dryRun === true;

  const DATE_FIELDS = ["dueDate", "deferDate", "plannedDate"];
  const SCALAR_FIELDS = ["name", "note", "flagged", "estimatedMinutes"];

  function fail(code, error, extra) {
    return JSON.stringify({ success: false, code, error, ...(extra || {}) });
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function primaryKey(object) {
    try {
      return object && object.id ? object.id.primaryKey : null;
    } catch (_error) {
      return null;
    }
  }

  function findTask(id) {
    let task = null;
    if (typeof Task !== "undefined" && Task.byIdentifier) {
      task = Task.byIdentifier(id);
    }
    if (!task && typeof flattenedTasks !== "undefined") {
      task = flattenedTasks.find((candidate) => primaryKey(candidate) === id) || null;
    }
    return task;
  }

  function isDropped(task) {
    try {
      if (typeof Task !== "undefined" && Task.Status && Task.Status.Dropped !== undefined) {
        return task.taskStatus === Task.Status.Dropped;
      }
    } catch (_error) {
      // Fall through to the string form.
    }
    try {
      return String(task.taskStatus || "").indexOf("Dropped") >= 0;
    } catch (_error) {
      return false;
    }
  }

  function parseShift(raw) {
    const match = /^([+-])(\d+)([dwm])$/.exec(String(raw));
    if (!match) return null;
    const magnitude = Number(match[2]);
    if (magnitude === 0) return null;
    return { amount: match[1] === "-" ? -magnitude : magnitude, unit: match[3] };
  }

  // Day and week shifts move the calendar date, which preserves wall-clock time
  // across a DST boundary. Month shifts clamp to the target month's last day so
  // 31 January plus one month lands in February, not March.
  function applyShift(base, shift) {
    const shifted = new Date(base.getTime());
    if (shift.unit === "d") {
      shifted.setDate(shifted.getDate() + shift.amount);
      return shifted;
    }
    if (shift.unit === "w") {
      shifted.setDate(shifted.getDate() + shift.amount * 7);
      return shifted;
    }
    const day = shifted.getDate();
    shifted.setDate(1);
    shifted.setMonth(shifted.getMonth() + shift.amount);
    const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
    shifted.setDate(day < lastDay ? day : lastDay);
    return shifted;
  }

  function readDate(task, field) {
    try {
      const value = task[field];
      return value ? new Date(value.getTime ? value.getTime() : value) : null;
    } catch (_error) {
      return null;
    }
  }

  function isoOrNull(value) {
    if (value === null || value === undefined) return null;
    try {
      return new Date(value.getTime ? value.getTime() : value).toISOString();
    } catch (_error) {
      return null;
    }
  }

  function sameDate(left, right) {
    if (left === null && right === null) return true;
    if (left === null || right === null) return false;
    return Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 1000;
  }

  function displayScalar(value) {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  try {
    if (!items || items.length === 0) {
      return fail("INVALID_EDIT", "items array is required");
    }
    if (items.length > 100) {
      return fail("INVALID_EDIT", "items array must not exceed 100 entries");
    }

    // Steps 1-5: build a complete plan. Nothing is written in this loop.
    const plan = [];
    const seenIds = {};

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const position = `items[${index}]`;

      if (!item.taskId) {
        return fail("INVALID_EDIT", `${position} requires a taskId`);
      }
      if (seenIds[item.taskId]) {
        return fail("INVALID_EDIT", `duplicate taskId ${item.taskId}; list each task once`);
      }
      seenIds[item.taskId] = true;

      const task = findTask(item.taskId);
      if (!task) {
        return fail("INVALID_EDIT", `Task not found: ${item.taskId}`);
      }

      // Step 3: finished tasks accept writes silently, so refuse them here.
      if (task.completed === true) {
        return fail(
          "INVALID_EDIT",
          `Task is completed and cannot be edited in a batch: ${task.name} (${item.taskId}). Use edit_item for a single deliberate change.`,
        );
      }
      if (isDropped(task)) {
        return fail(
          "INVALID_EDIT",
          `Task is dropped and cannot be edited in a batch: ${task.name} (${item.taskId}). Use edit_item for a single deliberate change.`,
        );
      }

      const targets = {};
      const snapshot = {};
      const changes = [];

      // Scalar fields.
      for (const field of SCALAR_FIELDS) {
        if (!has(item, field)) continue;
        const requested = item[field];

        if (field === "name") {
          if (requested === null || String(requested).trim().length === 0) {
            return fail("INVALID_EDIT", `${position} name must not be empty`);
          }
        }
        if (field === "estimatedMinutes" && requested !== null) {
          if (!Number.isInteger(requested) || requested < 0) {
            return fail(
              "INVALID_EDIT",
              `${position} estimatedMinutes must be a non-negative integer or null`,
            );
          }
        }

        let current = null;
        try {
          current = task[field];
        } catch (_error) {
          current = null;
        }
        if (current === undefined) current = null;

        snapshot[field] = current;
        targets[field] = requested;
        changes.push({
          field,
          before: displayScalar(current),
          after: displayScalar(requested),
        });
      }

      // Date fields: absolute value, or a shift against the current value.
      for (const field of DATE_FIELDS) {
        const shiftKey = `${field}Shift`;
        const hasAbsolute = has(item, field);
        const hasShift = has(item, shiftKey);

        if (hasAbsolute && hasShift) {
          return fail(
            "INVALID_EDIT",
            `${position} sets both ${field} and ${shiftKey}; use one or the other`,
          );
        }
        if (!hasAbsolute && !hasShift) continue;

        const current = readDate(task, field);
        let resolved = null;

        if (hasAbsolute) {
          if (item[field] === null) {
            resolved = null;
          } else {
            resolved = new Date(item[field]);
            if (Number.isNaN(resolved.getTime())) {
              return fail(
                "INVALID_EDIT",
                `${position} ${field} is not a valid date: ${item[field]}`,
              );
            }
          }
        } else {
          const shift = parseShift(item[shiftKey]);
          if (!shift) {
            return fail(
              "INVALID_EDIT",
              `${position} ${shiftKey} is not a valid non-zero offset: ${item[shiftKey]}`,
            );
          }
          // A dateless task gives a shift no base. Anchoring to now would
          // invent a date the user never asked for.
          if (current === null) {
            return fail(
              "INVALID_EDIT",
              `${position} cannot shift ${field}: task has no ${field} (${item.taskId})`,
            );
          }
          resolved = applyShift(current, shift);
        }

        snapshot[field] = current;
        targets[field] = resolved;
        changes.push({
          field,
          before: isoOrNull(current),
          after: isoOrNull(resolved),
        });
      }

      // Step 5: date order is checked against final values, so a shift that
      // collides with an untouched date is caught.
      const finalDue = has(targets, "dueDate") ? targets.dueDate : readDate(task, "dueDate");
      const finalDefer = has(targets, "deferDate")
        ? targets.deferDate
        : readDate(task, "deferDate");
      if (finalDue !== null && finalDefer !== null) {
        if (new Date(finalDefer).getTime() > new Date(finalDue).getTime()) {
          return fail(
            "INVALID_EDIT",
            `${position} would leave deferDate (${isoOrNull(finalDefer)}) later than dueDate (${isoOrNull(finalDue)}) on ${item.taskId}`,
          );
        }
      }

      // Tags.
      const hasReplace = has(item, "replaceTags");
      const hasAdd = has(item, "addTags");
      const hasRemove = has(item, "removeTags");

      if (hasReplace && (hasAdd || hasRemove)) {
        return fail(
          "INVALID_EDIT",
          `${position} combines replaceTags with addTags or removeTags; use one approach`,
        );
      }

      if (hasReplace || hasAdd || hasRemove) {
        const tagOp = { replace: null, add: [], remove: [] };
        const resolveNames = (names, label) => {
          const resolved = [];
          for (const name of names || []) {
            const tag = tagFindByName(name);
            // Step 4: an unresolvable tag fails the request. Auto-creating tags
            // as a side effect of a bulk edit is not recoverable by inspection.
            if (!tag) {
              return { error: `${position} ${label} references unknown tag: ${name}` };
            }
            resolved.push({ name, tag });
          }
          return { resolved };
        };

        if (hasReplace) {
          const outcome = resolveNames(item.replaceTags, "replaceTags");
          if (outcome.error) return fail("INVALID_EDIT", outcome.error);
          tagOp.replace = outcome.resolved;
        }
        if (hasAdd) {
          const outcome = resolveNames(item.addTags, "addTags");
          if (outcome.error) return fail("INVALID_EDIT", outcome.error);
          tagOp.add = outcome.resolved;
        }
        if (hasRemove) {
          const outcome = resolveNames(item.removeTags, "removeTags");
          if (outcome.error) return fail("INVALID_EDIT", outcome.error);
          tagOp.remove = outcome.resolved;
        }

        const before = tagNamesOf(task);
        snapshot.tags = before;
        targets.tags = tagOp;

        // Simulated through the same helper the write uses, so an exclusive
        // group dropping a sibling is predicted rather than mistaken for a
        // verification failure.
        let after;
        if (tagOp.replace) {
          after = tagSimulateAdds(
            [],
            tagOp.replace.map((entry) => entry.tag),
          );
        } else {
          const removeNames = tagOp.remove.map((entry) => entry.name);
          after = tagSimulateAdds(
            before.filter((name) => removeNames.indexOf(name) < 0),
            tagOp.add.map((entry) => entry.tag),
          );
        }
        // Keep the expected names as an array. Re-parsing the display string
        // would misread any tag name containing ", ".
        targets.tagsExpected = after;
        changes.push({
          field: "tags",
          before: before.join(", ") || null,
          after: after.join(", ") || null,
        });
      }

      if (changes.length === 0) {
        return fail(
          "INVALID_EDIT",
          `${position} changes nothing; every item must set at least one field`,
        );
      }

      plan.push({
        task,
        taskId: item.taskId,
        name: task.name,
        targets,
        snapshot,
        changes,
      });
    }

    if (dryRun) {
      return JSON.stringify({
        success: true,
        dryRun: true,
        items: plan.map((step) => ({
          taskId: step.taskId,
          name: step.name,
          changes: step.changes,
        })),
      });
    }

    function restore(step) {
      const snapshot = step.snapshot;
      for (const field of SCALAR_FIELDS) {
        if (!has(snapshot, field)) continue;
        try {
          step.task[field] = snapshot[field];
        } catch (_error) {
          // Continue restoring the remaining fields.
        }
      }
      for (const field of DATE_FIELDS) {
        if (!has(snapshot, field)) continue;
        try {
          step.task[field] = snapshot[field];
        } catch (_error) {
          // Continue restoring the remaining fields.
        }
      }
      if (has(snapshot, "tags")) {
        try {
          tagRestoreByNames(step.task, snapshot.tags);
        } catch (_error) {
          // Continue.
        }
      }
    }

    // Step 7: apply.
    for (let index = 0; index < plan.length; index += 1) {
      const step = plan[index];
      try {
        for (const field of SCALAR_FIELDS) {
          if (!has(step.targets, field)) continue;
          step.task[field] = step.targets[field];
        }
        for (const field of DATE_FIELDS) {
          if (!has(step.targets, field)) continue;
          step.task[field] = step.targets[field];
        }
        if (has(step.targets, "tags")) {
          const tagOp = step.targets.tags;
          if (tagOp.replace) {
            tagReplaceOnTask(
              step.task,
              tagOp.replace.map((entry) => entry.tag),
            );
          } else {
            // Remove first so an add on the same name wins.
            for (const entry of tagOp.remove) {
              tagRemoveFromTask(step.task, entry.tag);
            }
            for (const entry of tagOp.add) {
              tagApplyToTask(step.task, entry.tag);
            }
          }
        }
      } catch (error) {
        for (let back = index; back >= 0; back -= 1) {
          restore(plan[back]);
        }
        return fail(
          "EDIT_FAILED_RESTORED",
          `Failed to edit task ${step.taskId}: ${String(error)}`,
          { restored: true },
        );
      }
    }

    // Step 8: read back every changed field.
    const mismatches = [];
    for (const step of plan) {
      for (const field of SCALAR_FIELDS) {
        if (!has(step.targets, field)) continue;
        let actual = null;
        try {
          actual = step.task[field];
        } catch (_error) {
          actual = null;
        }
        if (actual === undefined) actual = null;
        const expected = step.targets[field];
        if (field === "flagged") {
          if (Boolean(actual) !== Boolean(expected)) {
            mismatches.push(`${step.taskId}: flagged`);
          }
          continue;
        }
        if (String(actual) !== String(expected)) {
          mismatches.push(`${step.taskId}: ${field}`);
        }
      }
      for (const field of DATE_FIELDS) {
        if (!has(step.targets, field)) continue;
        if (!sameDate(readDate(step.task, field), step.targets[field])) {
          mismatches.push(`${step.taskId}: ${field}`);
        }
      }
      if (has(step.targets, "tags")) {
        const actual = tagNamesOf(step.task).slice().sort().join("\u0000");
        const expected = step.targets.tagsExpected.slice().sort().join("\u0000");
        if (actual !== expected) {
          mismatches.push(`${step.taskId}: tags`);
        }
      }
    }

    if (mismatches.length > 0) {
      for (let back = plan.length - 1; back >= 0; back -= 1) {
        restore(plan[back]);
      }
      return fail(
        "EDIT_VERIFICATION_FAILED_RESTORED",
        `Verification failed: ${mismatches.join("; ")}`,
        { restored: true },
      );
    }

    return JSON.stringify({
      success: true,
      dryRun: false,
      items: plan.map((step) => ({
        taskId: step.taskId,
        name: step.task.name,
        changes: step.changes,
      })),
    });
  } catch (error) {
    return fail("INVALID_EDIT", error && error.message ? error.message : String(error));
  }
})();
