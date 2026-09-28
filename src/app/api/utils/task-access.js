/**
 * src/app/api/utils/task-access.js
 *
 * Centralized task access-control helpers implementing the approved
 * visibility & assignment rules.
 *
 * Visibility rules:
 *   Admin          → all tasks for active client where assignee is admin/employee (or unassigned)
 *   Employee       → tasks assigned TO me OR created BY me (active client)
 *   Client Owner   → all tasks for their client where assignee is any client-side user (or unassigned)
 *   Client Manager → tasks assigned TO me OR created BY me (their client)
 *   Client Editor  → tasks assigned TO me OR created BY me (their client)
 *   Client Viewer  → tasks assigned TO me only (their client)
 *
 * Assignment rules (strict cross-group separation):
 *   Admin/Employee    → can only assign to admin/employee associated with the client
 *   Client-side users → can only assign to client-side users associated with the client
 */

/**
 * Build a Prisma `where` clause that restricts tasks to what the user may see.
 */
async function buildTaskWhere(prisma, user, extraWhere = {}) {
  const where = { ...extraWhere };

  if (user.role === "admin") {
    // Admin: see all tasks across all clients (unassigned or assigned to admin/employee)
    where.OR = [
      { assigneeId: null },
      { assignee: { role: { in: ["admin", "employee"] } } },
    ];
  } else if (user.role === "employee") {
    // Employee: see tasks assigned to me or created by me across all clients
    where.OR = [{ assigneeId: user.id }, { createdBy: user.id }];
  } else if (user.role === "client") {
    const clientId = user.activeClientId ?? user.clientId;
    where.clientId = clientId;

    const role = user.activeClientRole;
    if (role === "client") {
      // Owner — see all client tasks (any client-side assignee or unassigned)
      const clientUsers = await prisma.wehowareUserClient.findMany({
        where: { clientId, active: true },
        select: { userId: true },
      });
      const clientUserIds = clientUsers.map((u) => u.userId);
      where.OR = [
        { assigneeId: null },
        { assigneeId: { in: clientUserIds } },
      ];
    } else if (role === "manager" || role === "editor") {
      where.OR = [{ assigneeId: user.id }, { createdBy: user.id }];
    } else if (role === "viewer") {
      where.assigneeId = user.id;
    }
  }

  return where;
}

/**
 * Check whether the user may access a specific task by ID.
 */
async function canAccessTask(prisma, user, taskId) {
  const where = await buildTaskWhere(prisma, user);
  where.id = taskId;
  const hit = await prisma.wehowareTask.findFirst({
    where,
    select: { id: true },
  });
  return Boolean(hit);
}

/**
 * Validate that an assignee is allowed for the given client and requesting user.
 * Returns `true` if valid, `false` otherwise.
 */
async function validateAssignee(prisma, user, clientId, assigneeId) {
  if (!assigneeId) return true; // unassigned is always valid

  const assignee = await prisma.wehowareProfile.findUnique({
    where: { id: assigneeId },
    select: { id: true, role: true },
  });
  if (!assignee) return false;

  // Verify assignee is associated with the client
  const uc = await prisma.wehowareUserClient.findFirst({
    where: { userId: assigneeId, clientId, active: true },
  });
  if (!uc) return false;

  if (user.role === "admin" || user.role === "employee") {
    return ["admin", "employee"].includes(assignee.role);
  }

  if (user.role === "client") {
    return assignee.role === "client";
  }

  return false;
}

/**
 * Get the list of users the current user is allowed to assign tasks to
 * for the given client.
 */
async function getAssignableUsers(prisma, user, clientId) {
  if (user.role === "admin" || user.role === "employee") {
    return prisma.wehowareProfile.findMany({
      where: {
        isActive: true,
        role: { in: ["admin", "employee"] },
        userClients: { some: { clientId, active: true } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: { firstName: "asc" },
    });
  }

  if (user.role === "client") {
    return prisma.wehowareProfile.findMany({
      where: {
        isActive: true,
        role: "client",
        userClients: { some: { clientId, active: true } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: { firstName: "asc" },
    });
  }

  return [];
}

/**
 * Check whether the user may EDIT a task (title, description, priority,
 * due date, status). Assignees can edit tasks assigned to them — the
 * person doing the work manages the task. Reassignment and client moves
 * remain creator-gated (enforced in the PUT route).
 * Returns `{ allowed: true }` or `{ allowed: false, reason: string }`.
 */
function canEditTask(user, task) {
  // Admin can edit any visible task
  if (user.role === "admin") return { allowed: true };

  // Employee can edit tasks they created or are assigned to
  if (user.role === "employee") {
    if (task.createdBy === user.id || task.assigneeId === user.id) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "You can only edit tasks you created or are assigned to",
    };
  }

  if (user.role === "client") {
    const role = user.activeClientRole;

    if (role === "viewer") {
      return { allowed: false, reason: "Viewers cannot edit tasks" };
    }

    // Owner can edit any visible task
    if (role === "client") return { allowed: true };

    // Manager/Editor can edit tasks they created or are assigned to
    if (role === "manager" || role === "editor") {
      if (task.createdBy === user.id || task.assigneeId === user.id) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "You can only edit tasks you created or are assigned to",
      };
    }
  }

  return { allowed: false, reason: "Insufficient permissions" };
}

/**
 * Check whether the user may DELETE a task. Deletion stays creator-gated
 * (plus admin / client owner) — assignees can edit but not delete.
 */
function canDeleteTask(user, task) {
  if (user.role === "admin") return { allowed: true };

  if (user.role === "employee") {
    if (task.createdBy === user.id) return { allowed: true };
    return { allowed: false, reason: "You can only delete tasks you created" };
  }

  if (user.role === "client") {
    const role = user.activeClientRole;

    if (role === "viewer") {
      return { allowed: false, reason: "Viewers cannot delete tasks" };
    }
    if (role === "client") return { allowed: true };
    if (role === "manager" || role === "editor") {
      if (task.createdBy === user.id) return { allowed: true };
      return { allowed: false, reason: "You can only delete tasks you created" };
    }
  }

  return { allowed: false, reason: "Insufficient permissions" };
}

/**
 * Check whether the user may update a task's status.
 *
 * Full editors (canEditTask — creator or assignee) may always update
 * status. Client viewers remain strictly read-only.
 */
function canUpdateTaskStatus(user, task) {
  if (canEditTask(user, task).allowed) return { allowed: true };

  if (user.role === "client" && user.activeClientRole === "viewer") {
    return { allowed: false, reason: "Viewers cannot update tasks" };
  }

  if (task.assigneeId === user.id) return { allowed: true };

  return {
    allowed: false,
    reason: "You can only update status on tasks assigned to you",
  };
}

/**
 * Check if the user can create tasks.
 */
function canCreateTask(user) {
  if (user.role === "admin" || user.role === "employee") return true;
  if (user.role === "client" && user.activeClientRole !== "viewer") return true;
  return false;
}

export {
  buildTaskWhere,
  canAccessTask,
  validateAssignee,
  getAssignableUsers,
  canEditTask,
  canDeleteTask,
  canUpdateTaskStatus,
  canCreateTask,
};
