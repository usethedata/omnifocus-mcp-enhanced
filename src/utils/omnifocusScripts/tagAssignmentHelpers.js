// Shared tag assignment helpers for OmniJS scripts.
//
// Prepended to scripts registered in HELPER_BY_SCRIPT, so every declaration
// here is a top-level function in the evaluating context.
//
// Mutually exclusive tag groups: when a tag's parent has
// childrenAreMutuallyExclusive === true, sibling tags from that group must be
// removed before the new tag is added. Skipping that step produces task states
// the single-item tools forbid.
//
// OmniJS returns collections as TagArray, not Array, so Array.isArray is false
// for task.tags and tag.children. Guarding on Array.isArray silently yields an
// empty list against the real database, which is why every collection read here
// goes through tagToArray.

function tagFindByName(name) {
  if (typeof flattenedTags !== 'undefined' && flattenedTags.byName) {
    return flattenedTags.byName(name) || null;
  }
  if (typeof Tag !== 'undefined' && Tag.named) {
    return Tag.named(name) || null;
  }
  return null;
}

/** Copy an OmniJS collection (TagArray) or a plain Array into a real Array. */
function tagToArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection.slice();
  if (typeof collection.length !== 'number') return [];
  const copied = [];
  for (let index = 0; index < collection.length; index += 1) {
    copied.push(collection[index]);
  }
  return copied;
}

function tagCurrentTags(taskObj) {
  return tagToArray(taskObj.tags);
}

function tagNamesOf(taskObj) {
  return tagCurrentTags(taskObj).map(function (tag) {
    return tag && tag.name ? tag.name : String(tag);
  });
}

function tagRemoveFromTask(taskObj, tagObj) {
  if (!tagObj) return;
  if (typeof taskObj.removeTag === 'function') {
    taskObj.removeTag(tagObj);
    return;
  }
  if (typeof taskObj.removeTags === 'function') {
    taskObj.removeTags([tagObj]);
  }
}

function tagAddToTask(taskObj, tagObj) {
  if (!tagObj) return;
  if (typeof taskObj.addTag === 'function') {
    taskObj.addTag(tagObj);
    return;
  }
  if (typeof taskObj.addTags === 'function') {
    taskObj.addTags([tagObj]);
  }
}

function tagClearOnTask(taskObj) {
  if (typeof taskObj.clearTags === 'function') {
    taskObj.clearTags();
    return;
  }
  if (typeof taskObj.removeTags === 'function') {
    const carried = tagToArray(taskObj.tags);
    if (carried.length > 0) taskObj.removeTags(carried);
  }
}

/**
 * Every sibling name in `tagObj`'s mutually exclusive group, independent of
 * what any task currently carries. Callers that need to predict the result of
 * an add use this to simulate the removal without touching the database.
 */
function tagExclusiveGroupSiblingNames(tagObj) {
  const names = [];
  if (!tagObj) return names;

  const parent = tagObj.parent;
  if (!parent || parent.childrenAreMutuallyExclusive !== true) return names;

  const siblings = tagToArray(parent.children);
  siblings.forEach(function (sibling) {
    if (!sibling || !sibling.id || !tagObj.id) return;
    if (sibling.id.primaryKey === tagObj.id.primaryKey) return;
    names.push(sibling.name);
  });

  return names;
}

/**
 * Remove any sibling of `tagObj` that the task currently carries, when the two
 * belong to a mutually exclusive group. Returns the removed sibling names.
 */
function tagRemoveExclusiveSiblings(taskObj, tagObj) {
  const removed = [];
  const groupNames = tagExclusiveGroupSiblingNames(tagObj);
  if (groupNames.length === 0) return removed;

  tagCurrentTags(taskObj)
    .slice()
    .forEach(function (carried) {
      if (!carried || !carried.name) return;
      if (groupNames.indexOf(carried.name) < 0) return;
      tagRemoveFromTask(taskObj, carried);
      removed.push(carried.name);
    });

  return removed;
}

/** Add one tag, honouring its exclusive group. Returns removed sibling names. */
function tagApplyToTask(taskObj, tagObj) {
  const removed = tagRemoveExclusiveSiblings(taskObj, tagObj);
  tagAddToTask(taskObj, tagObj);
  return removed;
}

/**
 * Replace the task's tags with exactly `tagObjects`, honouring exclusive groups
 * so a replace cannot produce a combination an add would have refused.
 */
function tagReplaceOnTask(taskObj, tagObjects) {
  tagClearOnTask(taskObj);
  tagObjects.forEach(function (tagObj) {
    tagApplyToTask(taskObj, tagObj);
  });
}

/**
 * Predict the tag names a sequence of adds produces, starting from `startNames`.
 * Mirrors tagApplyToTask exactly so a caller can verify its own write.
 */
function tagSimulateAdds(startNames, tagObjects) {
  let names = startNames.slice();
  tagObjects.forEach(function (tagObj) {
    const siblings = tagExclusiveGroupSiblingNames(tagObj);
    names = names.filter(function (name) {
      return siblings.indexOf(name) < 0;
    });
    const own = tagObj && tagObj.name ? tagObj.name : null;
    if (own !== null && names.indexOf(own) < 0) names.push(own);
  });
  return names;
}

/** Restore a task's tags to a snapshot of tag names. */
function tagRestoreByNames(taskObj, names) {
  tagClearOnTask(taskObj);
  (names || []).forEach(function (name) {
    const tagObj = tagFindByName(name);
    if (tagObj) tagAddToTask(taskObj, tagObj);
  });
}
