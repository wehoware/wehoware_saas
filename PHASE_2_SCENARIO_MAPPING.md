# PHASE 2: REAL-WORLD & WORST-CASE SCENARIO MAPPING
**Status**: Complete  
**Date**: 2026-05-22  
**Scope**: All Four Features (Sub-tasks, Time Tracking, Reporting, Goals)

---

## SCENARIO INVENTORY

### A. REAL-TIME SCENARIOS (Normal & Concurrent)
### B. WORST-CASE SCENARIOS (System Failures)
### C. EDGE CASES (Boundary Conditions)

---

## PART A: REAL-TIME SCENARIOS

### 1. Happy Path: Create Sub-task
**Scenario**: Employee creates a new sub-task for a task they're assigned to.

**Expected Behavior**:
- POST /api/v1/tasks/[id]/subtasks succeeds with 201
- Sub-task appears in list immediately
- Parent task subtask_count increments
- Activity log records "subtask_created"
- UI updates with confirmation toast
- User can immediately assign or modify the sub-task

**Implementation**:
- Validate task exists and user has access
- Create sub-task with status="To Do"
- Increment parent subtask_count in transaction
- Fire-and-forget activity log
- Return shaped sub-task object
- Client shows optimistic UI update

---

### 2. Happy Path: Log Time Entry
**Scenario**: Employee logs 2 hours of time spent on a task.

**Expected Behavior**:
- POST /api/v1/tasks/[id]/time-entries succeeds with 201
- Time entry appears in list
- actual_hours on task increments by 2.00
- remaining_hours decrements by 2.00 (if estimated_hours set)
- Activity log records "time_logged"
- Team can see updated metrics
- Charts/burndown update with new data

**Implementation**:
- Validate hours_spent is positive decimal (max 16 hours/day)
- Create time entry with tracked_date (defaults to today)
- Atomically update task's actual_hours, remaining_hours
- Fire activity log
- Broadcast activity to other viewers (if real-time enabled)
- Return entry with user details

---

### 3. Happy Path: Update Goal Progress
**Scenario**: Admin updates a Key Result current value from 50 to 75 (out of 100 target).

**Expected Behavior**:
- PUT /api/v1/goals/[id]/key-results/[kr_id] succeeds
- KR current_value becomes 75
- KR progress visually updates to 75%
- Goal's overall progress % recalculates (if weighted properly)
- Activity log records "key_result_updated"
- Linked tasks' completion status considered
- Achievement badges check triggers (e.g., "Goal Crusher" at 100%)

**Implementation**:
- Validate target_value exists and current_value <= target_value
- Update KR current_value
- Calculate KR % = (current_value / target_value) * 100
- Recalculate parent goal progress % from all KRs with weights
- Fire activity log
- Check auto-achievement rules
- Return updated goal with new %

---

### 4. Happy Path: Export Report
**Scenario**: Admin exports team performance report as CSV for the last 30 days.

**Expected Behavior**:
- GET /api/v1/reports/team-performance?format=csv succeeds with 200
- CSV file downloads with headers and data rows
- Includes columns: User Name, Tasks Assigned, Completed, On-time %, Hours Logged
- Date range filter applied correctly
- No personally identifiable info beyond necessary (no emails in CSV by default)
- File is parseable in Excel/Google Sheets

**Implementation**:
- Query team performance data with date filters
- Aggregate by user ID with SUM/COUNT/AVG
- Format data into CSV rows
- Set Content-Type: text/csv
- Set Content-Disposition: attachment; filename=report.csv
- Stream response (don't buffer entire file in memory)

---

### 5. Concurrent: Two Users Update Same Task Status
**Scenario**: User A changes task status to "In Progress", User B changes it to "Done" at nearly the same time.

**Expected Behavior**:
- Both requests succeed (201/200)
- Whichever request reaches DB last wins (last write wins)
- Both activity log entries record (timestamps show order)
- UI for each user eventually shows final state (the "Done" state)
- No data corruption or lost updates
- If User B refreshes, they see "Done"

**Implementation**:
- Use Prisma's optimistic update (no version field needed, just update)
- Each request updates independently (no locking)
- Activity logs are appended (immutable, won't conflict)
- Client-side: show optimistic update, then verify on refresh
- If refreshing shows different value, toast warning "Task was updated by another user"
- No conflict resolution needed; last write always wins for status field

---

### 6. Concurrent: Sub-task Reordering While Deletions Happen
**Scenario**: User A drags sub-task #3 to position 1 (updates order_index), User B deletes sub-task #2 at the same time.

**Expected Behavior**:
- Reorder succeeds, order_index values updated correctly
- Delete succeeds, sub-task removed from DB
- Final order reflects both operations (logical consistency)
- Activity logs show both changes
- UI refreshes to show final list state
- No orphaned order_index values

**Implementation**:
- Reorder endpoint: update order_index atomically for all affected sub-tasks
- Delete endpoint: removes sub-task, doesn't modify other order_index values (sparse indexing is okay)
- No constraint violations (order_index doesn't have to be sequential)
- Client fetches fresh list after reorder or delete completes
- Server-side sorting always uses order_index + creation time for stability

---

### 7. Concurrent: Multiple Time Entries Logged Same Day
**Scenario**: Team lead and employee both log time on same task for same day—one logs 2 hrs, another logs 3 hrs.

**Expected Behavior**:
- Both entries created successfully
- Task's actual_hours becomes 5.00 (2 + 3)
- Both entries appear in time list
- No deduplication (each entry is distinct)
- By-user summary shows: Lead 2 hrs, Employee 3 hrs
- Burndown chart includes both entries

**Implementation**:
- Create time entry, no unique constraint on (task_id, user_id, date)
- Actually allow multiple entries per user per day (concurrent work possible)
- Query sums all time entries by user when generating summaries
- If system needs to prevent user logging same hours twice, add UI validation (not DB constraint)
- Activity log records each entry separately

---

### 8. Network Latency: Slow POST /api/v1/tasks/[id]/subtasks
**Scenario**: User creates sub-task but network takes 5 seconds to return response.

**Expected Behavior**:
- Client shows loading spinner for 5 seconds
- After response, optimistic UI confirmed or rolled back
- No duplicate sub-task created
- Toast shows success when response received
- If user navigates away and returns, sub-task is there (persisted)
- No infinite spinner (timeout after 30 seconds)

**Implementation**:
- Frontend: abort request after 30 second timeout
- Frontend: show loading state immediately
- Backend: no request timeout (Prisma default is unlimited)
- Idempotency: no double-insert on retry (unique constraint on (taskId, title) is not added—allow dupes, but UI prevents rapid double-submit)
- Success response includes sub-task ID so client can match optimistic to actual

---

### 9. Network Latency: Slow GET /api/v1/reports/dashboard
**Scenario**: Dashboard loads but report queries take 8 seconds to return due to DB load.

**Expected Behavior**:
- Initial load shows skeleton loaders
- After 8 seconds, all metrics appear
- No timeout error (user sees eventual data)
- If page is still loading at 10 seconds, show "Still loading..." hint
- Data is accurate as of query time (no stale reads)
- Mobile connection: prioritize fastest queries first

**Implementation**:
- Frontend: timeout after 30 seconds
- Backend: query timeout at application level (set to 20 seconds for reports)
- DB indexes on all report query filters (client_id, date_range)
- Skeleton loaders show placeholders while fetching
- No arbitrary timeout < 8 seconds (let query complete)

---

### 10. Real-time Update: Goal Progress Changes Due to Task Completion
**Scenario**: Employee completes 4 of 10 tasks linked to a goal. Goal progress should reflect 40%.

**Expected Behavior**:
- When task marked "Done", system recalculates goal progress
- Goal progress becomes 40% (4/10)
- Goal card shows updated bar
- Activity log on goal shows "progress_updated"
- If threshold met (e.g., 100%), achievement badges trigger
- Reports show updated goal metrics

**Implementation**:
- After task status → "Done", query linked goals via WehowareGoalTaskLink
- For each linked goal, count completed linked tasks
- Calculate progress = (completed_tasks / total_linked_tasks) * contribution_percentage
- Update goal's progressPercentage field
- Check achievement rules
- Fire activity log

---

## PART B: WORST-CASE SCENARIOS

### 11. Database Connection Failure
**Scenario**: MySQL connection drops during POST /api/v1/tasks/[id]/subtasks.

**Expected Behavior**:
- Request fails with 500 "Failed to create sub-task"
- No partial data written (connection closed before commit)
- Activity log does NOT appear (never reached)
- Frontend receives generic error
- User sees toast error, can retry
- No data corruption
- Server logs error for debugging

**Implementation**:
- Prisma detects connection loss, throws PrismaClientKnownRequestError
- Catch block logs full error (stack trace to console.error, not response)
- Return NextResponse.json({ error: "Failed to create sub-task" }, { status: 500 })
- Fire-and-forget activity log won't execute if DB is down anyway
- Client retries with exponential backoff (1s, 2s, 4s, etc.)
- No requests queued; user must manually retry

---

### 12. Database Transaction Deadlock
**Scenario**: Two concurrent operations try to update the same sub-task with conflicting locks.

**Expected Behavior**:
- One request succeeds
- Other request fails with error (not retried automatically)
- User sees "Failed to update sub-task" message
- User can manually retry (second attempt likely succeeds)
- No infinite retry loop
- No data corruption

**Implementation**:
- Prisma retries internally up to 3 times for transient errors
- If deadlock persists, throws error
- Frontend catches and shows error
- No automatic exponential backoff at API layer
- User must click retry button

---

### 13. Database Disk Space Exhausted
**Scenario**: INSERT fails because disk is full (SQLSTATE HY000).

**Expected Behavior**:
- All write operations fail (POST/PUT/DELETE)
- Error: "Database temporarily unavailable"
- Read-only operations still work (GET)
- Reports still load (reads not affected)
- Admin receives alert (via monitoring)
- No cascading failures to other clients

**Implementation**:
- Prisma throws error
- Catch block returns 503 "Service Unavailable"
- Frontend shows "Please try again later" message
- DBA cleans up logs/old data to free space
- Service recovers automatically once space freed

---

### 14. Invalid Input: Negative Hours in Time Entry
**Scenario**: User sends POST /api/v1/tasks/[id]/time-entries with hours_spent = -5.

**Expected Behavior**:
- Request fails with 400 "Hours spent must be positive"
- No entry created
- Activity log not recorded
- Frontend validation should catch this first
- If sent directly (API client), clear error message

**Implementation**:
```javascript
if (hoursSpent <= 0 || hoursSpent > 24) {
  return NextResponse.json(
    { error: "Hours spent must be between 0 and 24" },
    { status: 400 }
  );
}
```

---

### 15. Invalid Input: Missing Required Field
**Scenario**: User sends POST /api/v1/tasks/[id]/subtasks without title field.

**Expected Behavior**:
- Request fails with 400 "Title is required"
- No sub-task created
- Error message is specific and actionable
- Frontend form validates before sending

**Implementation**:
```javascript
if (!title || typeof title !== 'string' || !title.trim()) {
  return NextResponse.json(
    { error: "Title is required and must be non-empty" },
    { status: 400 }
  );
}
```

---

### 16. Invalid Input: Malformed JSON
**Scenario**: Client sends POST with invalid JSON body.

**Expected Behavior**:
- Request fails with 400 "Invalid JSON body"
- No processing occurs
- Error is caught before any logic runs

**Implementation**:
```javascript
try {
  const body = await request.json();
  // ... process
} catch (err) {
  if (err instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  // ... other errors
}
```

---

### 17. Invalid Input: Extremely Large Payload
**Scenario**: User sends POST /api/v1/tasks/[id]/subtasks with title = 5MB of text.

**Expected Behavior**:
- Request rejected before reaching handler (Next.js body parser limit)
- Or: handler validates string length, returns 400
- No memory exhaustion
- Server remains responsive

**Implementation**:
```javascript
if (title.length > 500) {
  return NextResponse.json(
    { error: "Title must be 500 characters or less" },
    { status: 400 }
  );
}
```

---

### 18. Invalid Input: SQL Injection Attempt
**Scenario**: User sends title = "'; DROP TABLE wehoware_tasks; --"

**Expected Behavior**:
- Prisma escapes the string (ORM protection)
- No SQL is executed
- String is stored literally
- No data loss

**Implementation**:
- Use Prisma; never raw SQL
- Prisma parameterizes all queries
- String is treated as data, not code
- No additional escaping needed

---

### 19. Authorization: Employee Accessing Someone Else's Task
**Scenario**: Employee A tries to POST /api/v1/tasks/[task_id]/subtasks where task belongs to Employee B.

**Expected Behavior**:
- withAuth middleware checks access
- canAccessTask() returns false (task.assigneeId != user.id)
- Request fails with 404 "Task not found"
- Activity log NOT created
- No leakage of task existence

**Implementation**:
```javascript
const where = { id: taskId };
if (user.role === "employee") {
  where.assigneeId = user.id; // restrict to own tasks
}
const task = await prisma.wehowareTask.findFirst({ where });
if (!task) {
  return NextResponse.json({ error: "Task not found" }, { status: 404 });
}
// ... proceed with sub-task creation
```

---

### 20. Authorization: Admin Without Active Client Context
**Scenario**: Admin clicks GET /api/v1/tasks without setting an active client first.

**Expected Behavior**:
- If admin has no activeClientId set, return empty list or error?
- Behavior: return empty list (not an error—admin just has no context yet)
- Prompt user to select a client
- Once client selected, fetch succeeds

**Implementation**:
```javascript
const where = {};
if (user.role === "employee") {
  where.assigneeId = user.id;
} else if (user.role === "admin" && user.activeClientId) {
  where.clientId = user.activeClientId; // only if set
  // if not set, return empty list (no filtering)
}
const tasks = await prisma.wehowareTask.findMany({ where });
return NextResponse.json({ tasks, total: tasks.length });
```

---

### 21. Authorization: Client Accessing Another Client's Data
**Scenario**: Client A tries to GET /api/v1/tasks where clientId = Client B.

**Expected Behavior**:
- Middleware check: user.role === "client" → where.clientId = user.clientId
- Query only returns Client A's tasks
- Client B's tasks never returned
- No 404 error (silent filtering)

**Implementation**:
```javascript
if (user.role === "client") {
  where.clientId = user.clientId; // forced filter
}
// Query will be empty if requesting wrong client
const tasks = await prisma.wehowareTask.findMany({ where });
```

---

### 22. Rate Limit: User Floods API with Requests
**Scenario**: User writes script sending 1000 POST requests per second to create sub-tasks.

**Expected Behavior**:
- After ~100 requests in 1 minute, user gets 429 "Too Many Requests"
- All subsequent requests fail until rate limit window expires
- User is not permanently banned (window resets in 1 minute)
- Database is not overwhelmed
- Other users unaffected

**Implementation**:
- Add middleware: rate limiting by user.id
- Limit: 100 requests/minute per user
- Return 429 status with Retry-After header
- Not implemented in current codebase—would need redis or similar
- For MVP: rely on DB connection pooling to naturally throttle

---

### 23. Cascading Failure: Time Entry Creation Fails, Activity Log Fails
**Scenario**: Time entry created successfully, but activity log fails to insert (e.g., DB constraint violation).

**Expected Behavior**:
- Time entry is persisted (request succeeds 201)
- Activity log failure is logged as warning
- User sees success (time entry exists)
- Audit trail is missing, but data is intact
- No cascading error to other operations

**Implementation**:
```javascript
const timeEntry = await prisma.wehowareTaskTimeEntry.create({ ... });

// Fire-and-forget: don't fail request if this fails
prisma.wehowareTaskActivity
  .create({ ... })
  .catch((err) => console.warn("[POST time-entries] activity failed:", err));

return NextResponse.json(timeEntry, { status: 201 });
```

---

### 24. Cascading Failure: Goal Progress Calculation Hangs
**Scenario**: PUT /api/v1/goals/[id] tries to recalculate progress, but query returns 1M records (slow).

**Expected Behavior**:
- Query times out after 20 seconds
- Error returned: "Failed to update goal"
- Goal is still partially updated (e.g., title changed but progress not recalculated)
- Or: Goal NOT updated (rolled back)
- User must retry
- No infinite hang

**Implementation**:
- Set query timeout at application level (Prisma doesn't natively support, but MySQL does)
- If calculation takes >20 seconds, abort and return error
- Don't partially update (wrap in transaction)
- Frontend shows error "Goal update failed, please retry"

---

### 25. Cascading Failure: Sub-task Delete Causes Task Completion % to Go Negative
**Scenario**: Sub-task deletion subtracts from subtask_completed, resulting in negative count.

**Expected Behavior**:
- This should NOT happen (defensive programming)
- Deletion decrements subtask_completed safely (no go below 0)
- completion % is always 0-100%

**Implementation**:
```javascript
const subtask = await prisma.wehowareSubtask.findFirst({ where: { id } });
const isCompleted = subtask.status === "Done";

await prisma.wehowareSubtask.delete({ where: { id } });

if (isCompleted) {
  // Safely decrement, don't go below 0
  await prisma.wehowareTask.update({
    where: { id: subtask.taskId },
    data: {
      subtaskCompleted: { decrement: 1 },
    },
  });
}
```

---

## PART C: EDGE CASES

### 26. Edge Case: Empty Result Sets
**Scenario**: GET /api/v1/tasks/[id]/subtasks for task with no sub-tasks.

**Expected Behavior**:
- Returns 200 with empty array
- completion_percentage = 0%
- UI shows "No sub-tasks yet" message
- Create button is accessible

**Implementation**:
```javascript
const subtasks = await prisma.wehowareSubtask.findMany({
  where: { taskId: id },
  orderBy: { orderIndex: "asc" },
});
const total = subtasks.length;
const completed = subtasks.filter((s) => s.status === "Done").length;
const percentage = total > 0 ? (completed / total) * 100 : 0;

return NextResponse.json({
  subtasks,
  total,
  completed,
  completion_percentage: percentage,
});
```

---

### 27. Edge Case: Null/Undefined Handling in Report Calculations
**Scenario**: Report aggregates time, but some tasks have null estimated_hours.

**Expected Behavior**:
- Null values treated as 0 or skipped
- Report doesn't crash
- "Estimated hours" shows only non-null values
- "Without estimate" shows count of null values

**Implementation**:
```javascript
const totalsQuery = await prisma.wehowareTask.aggregate({
  where: { clientId },
  _sum: {
    estimatedHours: true, // null values ignored in SUM
  },
  _count: {
    id: true,
    estimatedHours: true, // count of non-null
  },
});

const estimatedSum = totalsQuery._sum.estimatedHours ?? 0;
const withEstimate = totalsQuery._count.estimatedHours;
const withoutEstimate = totalsQuery._count.id - withEstimate;
```

---

### 28. Edge Case: Division by Zero in Progress Calculations
**Scenario**: Goal has 0 key results; system tries to calculate average progress.

**Expected Behavior**:
- Goal progress shows 0% (or "No KRs set")
- No division by zero error
- No NaN in response

**Implementation**:
```javascript
const keyResults = goal.keyResults;
if (keyResults.length === 0) {
  return { ...goal, progressPercentage: 0, message: "No key results set" };
}

const avgProgress =
  keyResults.reduce((sum, kr) => sum + kr.progressPercentage, 0) /
  keyResults.length;
```

---

### 29. Edge Case: Duplicate Time Entries for Same User/Date
**Scenario**: User logs time twice for same task/date/user (accidental double-submit).

**Expected Behavior**:
- Both entries exist (no unique constraint prevents it)
- actual_hours sums both (5 + 5 = 10)
- User can manually delete one via UI
- Or: frontend prevents double-submit with button disable

**Implementation**:
- No database unique constraint (allow duplicates)
- Frontend: disable submit button for 3 seconds after submit
- Or: frontend checks if entry for same day already exists, shows warning
- If duplicates exist: user can see both in time list and delete one

---

### 30. Edge Case: Timezone Issues
**Scenario**: Task due date is 2026-05-25, but user is in UTC-8. User thinks due is 2026-05-24.

**Expected Behavior**:
- Database stores date as YYYY-MM-DD (no time component) in UTC
- Frontend displays date in user's local timezone
- Due date display shows correct date in user's timezone
- Due date filter works correctly across timezones

**Implementation**:
```javascript
// API returns ISO date string
const dueDate = task.dueDate; // e.g., "2026-05-25"

// Frontend converts to display timezone
const displayDate = new Date(dueDate); // parsed as midnight UTC
const formatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // user's timezone
});
console.log(formatter.format(displayDate)); // e.g., "May 24, 2026"
```

---

### 31. Edge Case: Daylight Saving Time Transition
**Scenario**: User logs time on DST transition day (clock springs forward).

**Expected Behavior**:
- Time entry tracked_date is correct (2026-03-09 or whenever DST occurs)
- Burndown chart doesn't jump or drop
- No duplicate day in chart
- Hour calculations remain accurate

**Implementation**:
- Always use ISO date format (YYYY-MM-DD) for tracked_date
- Never use time component (no DST impact on date-only fields)
- Chart X-axis uses dates, not datetimes
- No +1 or -1 hour adjustments needed

---

### 32. Edge Case: Leap Year Date
**Scenario**: Task due date is 2026-02-29... wait, 2026 is not a leap year. What if user tries to set due date to 2026-02-29?

**Expected Behavior**:
- HTML date picker prevents invalid date (browser validation)
- If sent via API: Prisma validates date format
- Request fails with 400 "Invalid date"
- No February 30th tasks can be created

**Implementation**:
```javascript
try {
  const dueDate = new Date(body.dueDate);
  if (isNaN(dueDate.getTime())) {
    throw new Error("Invalid date");
  }
  // proceed
} catch (err) {
  return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
}
```

---

### 33. Edge Case: Very Old Task (Created Years Ago)
**Scenario**: Task created 2020-01-01, still in "To Do" status, now it's 2026. Reports should handle it.

**Expected Behavior**:
- Report shows task as "Overdue by 6 years"
- Cycle time calculated correctly (years, not days)
- No integer overflow
- Sorting still works

**Implementation**:
```javascript
const ageInDays = Math.floor((now - task.createdAt) / (1000 * 60 * 60 * 24));
const ageInYears = Math.floor(ageInDays / 365);
const daysUntilDue = Math.floor((task.dueDate - now) / (1000 * 60 * 60 * 24));
return { ageInDays, ageInYears, daysUntilDue };
```

---

### 34. Edge Case: Sub-task Assigned to Non-existent User
**Scenario**: Sub-task assignee_id references a user that no longer exists (deleted profile).

**Expected Behavior**:
- Sub-task still exists (foreign key allows null)
- Assignee field is null in response
- UI shows "Unassigned"
- No error when fetching

**Implementation**:
```javascript
const subtask = await prisma.wehowareSubtask.findFirst({
  where: { id },
  include: {
    assignee: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
  },
});
// If user deleted, assignee is null
return {
  ...subtask,
  assignee: subtask.assignee
    ? { id, first_name, last_name, avatar_url }
    : null,
};
```

---

### 35. Edge Case: Task Assigned to User from Different Client
**Scenario**: Task created for Client A, assigned to employee who only works for Client B.

**Expected Behavior**:
- This SHOULD NOT happen (validation prevents it)
- Or: Task is still created, but assignee can't see it (data isolation)
- Employee assigned to different client gets no access

**Implementation**:
- Frontend: assignee dropdown only shows employees assigned to selected client
- Backend: validate assigneeId exists and is accessible by current client
- If invalid: return 400 "Assignee not available for this client"

---

### 36. Edge Case: Task with No Assignee (Unassigned)
**Scenario**: Task created without assignee_id, left as null.

**Expected Behavior**:
- Task is valid (assigneeId is optional)
- Task appears in admin views
- Task does NOT appear in employee views (employees only see assigned tasks)
- Can be assigned later

**Implementation**:
```javascript
// Employee query includes role-based filter
if (user.role === "employee") {
  where.assigneeId = user.id; // excludes unassigned
}
// Admin query has no filter
// Result: unassigned tasks only visible to admins

// Later, admin assigns task:
await prisma.wehowareTask.update({
  where: { id },
  data: { assigneeId: newAssigneeId },
});
```

---

### 37. Edge Case: Circular Goal Linkage
**Scenario**: Goal A is linked to Task T, Task T is linked back to Goal A.

**Expected Behavior**:
- This is technically allowed (no constraint prevents it)
- No infinite loop if calculating progress correctly
- Goal progress doesn't double-count task completion

**Implementation**:
- Don't create circular references in goals (UI prevents it)
- If they exist, goal progress calculation ignores cycles
- Count linked tasks by distinct WehowareGoalTaskLink entries

---

### 38. Edge Case: Sub-task Status Inconsistency
**Scenario**: Parent task status is "Done", but sub-tasks are still "To Do".

**Expected Behavior**:
- This CAN happen (no constraint prevents it)
- UI shows parent "Done" but displays "Not all sub-tasks complete"
- User can manually mark sub-tasks as Done
- Or: mark parent Done anyway (no automatic cascading)

**Implementation**:
```javascript
// When marking parent task Done, don't auto-mark sub-tasks
const updatedTask = await prisma.wehowareTask.update({
  where: { id },
  data: { status: "Done" },
});

// User sees warning: "Sub-tasks still in progress"
// Depends on business logic—could force sub-tasks done first

// Check and warn:
const incompleteSubtasks = await prisma.wehowareSubtask.findMany({
  where: { taskId: id, status: { not: "Done" } },
});
if (incompleteSubtasks.length > 0) {
  console.warn("Task marked Done but has incomplete sub-tasks");
  // Return warning in response or just log
}
```

---

### 39. Edge Case: Report Generated While Data is Being Updated
**Scenario**: User requests GET /api/v1/reports/dashboard while admin is bulk-updating tasks.

**Expected Behavior**:
- Report shows snapshot of data at query time
- If updates happen mid-query, report may show partial state
- No crash
- Eventual consistency: next report query shows latest state

**Implementation**:
- Reports use consistent read snapshot (MySQL default)
- Query returns data as of query start time
- No locking (don't block concurrent updates)
- If consistency is critical, add report caching (Redis) with TTL

---

### 40. Edge Case: High Cardinality Report (1M+ Records)
**Scenario**: Report queries 1 million task records to aggregate.

**Expected Behavior**:
- Query takes 10+ seconds
- API times out (if no index) or returns slowly (if indexed)
- Memory usage remains bounded (no loading entire dataset into memory)
- Client gets response eventually or timeout error

**Implementation**:
```javascript
// Use aggregation at DB level, not in-app
const stats = await prisma.wehowareTask.aggregate({
  where: { clientId },
  _count: { id: true },
  _avg: { estimatedHours: true },
});
// Returns single row, not 1M records

// If need detail: paginate
const tasks = await prisma.wehowareTask.findMany({
  where: { clientId },
  take: 100, // pagination
  skip: 0,
});
```

---

## SUMMARY TABLE: Scenario→Response Mapping

| Scenario # | Type | Issue | HTTP Status | Error Message | Data Persisted? |
|---|---|---|---|---|---|
| 1-10 | Real-time | Happy path | 200/201 | N/A | Yes |
| 11 | Worst-case | DB connection lost | 500 | "Failed to create sub-task" | No |
| 12 | Worst-case | Deadlock | 500 | "Failed to update sub-task" | No |
| 13 | Worst-case | Disk full | 503 | "Service unavailable" | No |
| 14 | Worst-case | Invalid input (negative hours) | 400 | "Hours must be positive" | No |
| 15 | Worst-case | Missing required field | 400 | "Title is required" | No |
| 16 | Worst-case | Malformed JSON | 400 | "Invalid JSON body" | No |
| 17 | Worst-case | Large payload | 400 | "Title too long" | No |
| 18 | Worst-case | SQL injection | N/A | N/A | No (prevented) |
| 19 | Worst-case | Auth bypass | 404 | "Task not found" | No |
| 20 | Worst-case | No active client | 200 | Empty list | N/A |
| 21 | Worst-case | Access another client | 200 | Empty/filtered list | N/A |
| 22 | Worst-case | Rate limit | 429 | "Too many requests" | No |
| 23 | Worst-case | Activity log fails | 201 | N/A | Yes (partial audit) |
| 24 | Worst-case | Goal calc hangs | 500 | "Failed to update goal" | Partial |
| 25 | Worst-case | Progress goes negative | N/A | N/A | No (prevented) |
| 26 | Edge | Empty result set | 200 | N/A | N/A |
| 27 | Edge | Null in calculations | 200 | N/A | N/A |
| 28 | Edge | Division by zero | N/A | N/A | No (prevented) |
| 29 | Edge | Duplicate entries | 201 | N/A | Yes (both) |
| 30 | Edge | Timezone mismatch | 200 | N/A | Yes (UTC stored) |
| 31 | Edge | DST transition | 200 | N/A | Yes (no issue) |
| 32 | Edge | Invalid date (Feb 29) | 400 | "Invalid date format" | No |
| 33 | Edge | Very old task | 200 | N/A | Yes (calc OK) |
| 34 | Edge | Null assignee | 200 | N/A | Yes (assignee null) |
| 35 | Edge | Cross-client assignee | 400 | "Assignee unavailable" | No |
| 36 | Edge | Unassigned task | 200 | N/A | Yes |
| 37 | Edge | Circular goal link | 200 | N/A | Yes (no loop) |
| 38 | Edge | Inconsistent statuses | 200 | Warning logged | Yes |
| 39 | Edge | Report mid-update | 200 | N/A | Snapshot |
| 40 | Edge | 1M+ records | 200/500 | Depends on index | Partial |

---

## CRITICAL IMPLEMENTATION RULES (From Scenario Analysis)

### 1. Validation & Input Handling
- ✅ Always validate numeric inputs (positive, within range)
- ✅ Always validate string lengths (max 500 for titles, etc.)
- ✅ Always validate required fields before processing
- ✅ Never trust JSON parsing; wrap in try/catch

### 2. Authorization & Data Isolation
- ✅ Always filter by user's accessible data (role-based where clause)
- ✅ Return 404 for unauthorized, never 403 (don't leak task existence)
- ✅ Validate assignee is from same client before assigning
- ✅ Fire-and-forget activity logs shouldn't fail requests

### 3. Error Handling
- ✅ Catch all errors in try/catch
- ✅ Log full error to console.error (for debugging)
- ✅ Return generic error message to client (never stack trace)
- ✅ Use appropriate HTTP status: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 500 (server error)

### 4. Concurrency Safety
- ✅ Use atomic updates (Prisma increment/decrement)
- ✅ Last-write-wins for status fields (no locking)
- ✅ Activity logs are append-only (no conflicts)
- ✅ Reordering uses order_index (allows sparse numbering)

### 5. Edge Case Handling
- ✅ Null/undefined checks in all calculations
- ✅ Use default values (0 for sums, empty array for lists)
- ✅ Prevent division by zero (check count > 0)
- ✅ Handle empty result sets (return empty array, not null)

### 6. Database Constraints
- ✅ Use CASCADE delete on child records
- ✅ Use indexes on frequently-filtered columns (clientId, status, assigneeId)
- ✅ No circular foreign keys
- ✅ Timestamps always UTC in DB

### 7. API Design
- ✅ Pagination max 100 records per page
- ✅ Query timeouts at application level (20 seconds for reports)
- ✅ Rate limiting per user (100 requests/minute)
- ✅ Consistent response shape (snake_case, shaped objects)

---

## NEXT PHASE: READY FOR PHASE 3

✅ All 40 scenarios mapped across real-time, worst-case, and edge cases  
✅ Expected behavior documented for each scenario  
✅ Implementation approach defined  
✅ Critical rules extracted  
✅ Response mapping table created  

**Ready to proceed to Phase 3: End-to-end Implementation**
