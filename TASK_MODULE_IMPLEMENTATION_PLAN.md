# Complete Task Management Module - Implementation Plan
**Status**: Ready to Build  
**Priority**: Critical  
**Timeline**: 8-10 weeks (can be parallelized)  
**Last Updated**: 2026-05-21

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Phase Breakdown](#phase-breakdown)
3. [Database Schema Changes](#database-schema-changes)
4. [API Endpoints](#api-endpoints)
5. [UI Components & Pages](#ui-components--pages)
6. [Implementation Checklist](#implementation-checklist)
7. [Timeline & Dependencies](#timeline--dependencies)

---

## 🎯 Overview

### Target Features
✅ Sub-tasks with completion tracking  
✅ Time tracking (estimation, actual hours, burndown)  
✅ Advanced reporting (metrics, trends, dashboards)  
✅ Goals & Achievements (OKRs, task linking, progress)

### Success Metrics
- 100% tasks can have sub-tasks
- Time tracking on 95%+ of tasks
- Advanced reports generate in <2 seconds
- Goals visible and trackable across team

### Architecture Principles
- Minimal breaking changes to existing API
- Backward compatible with current UI
- Extensible for future features
- Performance optimized (indexed queries)
- Role-based access control throughout

---

## 📊 Phase Breakdown

### PHASE 1: Sub-Tasks Foundation (Weeks 1-2)
**Deliverable**: Full sub-task CRUD with completion tracking  
**Effort**: 40-50 hours

#### 1.1 Database Schema Updates
```sql
-- New table for sub-tasks
CREATE TABLE wehoware_subtasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
  task_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status ENUM('To Do', 'In Progress', 'Done') DEFAULT 'To Do',
  assignee_id VARCHAR(36),
  order_index INT DEFAULT 0,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  FOREIGN KEY (task_id) REFERENCES wehoware_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES wehoware_profiles(id),
  FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id),
  INDEX idx_task_id (task_id),
  INDEX idx_status (status)
);

-- Update main task table to track sub-task completion
ALTER TABLE wehoware_tasks ADD COLUMN (
  subtask_count INT DEFAULT 0,
  subtask_completed INT DEFAULT 0,
  last_subtask_update DATETIME
);

-- Prisma schema addition
model WehowareSubtask {
  id           String      @id @default(uuid()) @db.VarChar(36)
  taskId       String      @map("task_id") @db.VarChar(36)
  title        String      @db.VarChar(500)
  description  String?     @db.Text
  status       TaskStatus?
  assigneeId   String?     @map("assignee_id") @db.VarChar(36)
  orderIndex   Int         @default(0) @map("order_index")
  completedAt  DateTime?   @map("completed_at")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  createdBy    String?     @map("created_by") @db.VarChar(36)
  
  task         WehowareTask     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  assignee     WehowareProfile? @relation("SubtaskAssignee", fields: [assigneeId], references: [id])
  creator      WehowareProfile? @relation("SubtaskCreator", fields: [createdBy], references: [id])
  
  @@index([taskId])
  @@index([status])
  @@index([assigneeId])
  @@map("wehoware_subtasks")
}

-- Update WehowareTask relation
model WehowareTask {
  // ... existing fields ...
  subtasks         WehowareSubtask[] @relation("TaskSubtasks")
  subtaskCount     Int               @default(0) @map("subtask_count")
  subtaskCompleted Int               @default(0) @map("subtask_completed")
  lastSubtaskUpdate DateTime?        @map("last_subtask_update")
}
```

#### 1.2 API Endpoints

**GET /api/v1/tasks/[id]/subtasks**
- List all sub-tasks for a parent task
- Returns: { subtasks: [], total, completion_percentage }
- Sorting by order_index, status, created_at

**POST /api/v1/tasks/[id]/subtasks**
- Create new sub-task
- Body: { title, description, assignee_id, order_index }
- Returns: created subtask
- Logs activity: "subtask_created"

**PUT /api/v1/tasks/[id]/subtasks/[subtask_id]**
- Update sub-task status, title, assignee
- Logs: "subtask_status_change", "subtask_updated"
- Auto-update parent task completion % on status=Done

**DELETE /api/v1/tasks/[id]/subtasks/[subtask_id]**
- Delete sub-task
- Recalculates parent task completion %
- Logs: "subtask_deleted"

**PATCH /api/v1/tasks/[id]/subtasks/reorder**
- Bulk reorder sub-tasks
- Body: { subtask_ids: [id1, id2, ...] }
- Returns: updated order

#### 1.3 UI Components

**SubtaskList.js** (New)
- Displays sub-tasks in collapsible list
- Shows completion percentage bar
- Inline status change via dropdown
- Add new sub-task form

**SubtaskItem.js** (New)
- Single sub-task row
- Checkbox for Done status
- Assignee avatar
- Drag handle for reordering
- Edit/delete actions

**TaskCompletionBar.js** (New)
- Visual progress bar
- Shows X of Y completed
- Percentage text
- Color changes based on progress

#### 1.4 Database Migration Script
```javascript
// scripts/migrate-subtasks.js
import { prisma } from '@/lib/prisma';

export async function migrateSubtasks() {
  // Run ALTER TABLE commands
  // Create indexes
  // Log completion
}
```

#### 1.5 Testing Checklist
- [ ] Create sub-task via API
- [ ] List sub-tasks with pagination
- [ ] Update sub-task status
- [ ] Parent completion % updates correctly
- [ ] Delete sub-task recalculates %
- [ ] Reorder sub-tasks
- [ ] Sub-tasks inherit parent client_id
- [ ] Role-based access (employees see assigned)
- [ ] Activity logs record all changes
- [ ] UI shows completion percentage correctly

---

### PHASE 2: Time Tracking (Weeks 2-3)
**Deliverable**: Full time estimation and tracking system  
**Effort**: 35-45 hours

#### 2.1 Database Schema Updates

```sql
-- Time entries table
CREATE TABLE wehoware_task_time_entries (
  id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
  task_id VARCHAR(36) NOT NULL,
  subtask_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  hours_spent DECIMAL(5,2) NOT NULL,
  notes TEXT,
  tracked_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES wehoware_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (subtask_id) REFERENCES wehoware_subtasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES wehoware_profiles(id),
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_tracked_date (tracked_date)
);

-- Update tasks table
ALTER TABLE wehoware_tasks ADD COLUMN (
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(8,2) DEFAULT 0,
  remaining_hours DECIMAL(8,2),
  story_points INT
);

-- Prisma schema additions
model WehowareTaskTimeEntry {
  id          String   @id @default(uuid()) @db.VarChar(36)
  taskId      String   @map("task_id") @db.VarChar(36)
  subtaskId   String?  @map("subtask_id") @db.VarChar(36)
  userId      String   @map("user_id") @db.VarChar(36)
  hoursSpent  Decimal  @map("hours_spent") @db.Decimal(5, 2)
  notes       String?  @db.Text
  trackedDate DateTime @map("tracked_date") @db.Date
  createdAt   DateTime @default(now()) @map("created_at")
  
  task        WehowareTask      @relation("TaskTimeEntries", fields: [taskId], references: [id], onDelete: Cascade)
  subtask     WehowareSubtask?  @relation("SubtaskTimeEntries", fields: [subtaskId], references: [id], onDelete: Cascade)
  user        WehowareProfile   @relation("UserTimeEntries", fields: [userId], references: [id])
  
  @@index([taskId])
  @@index([userId])
  @@index([trackedDate])
  @@map("wehoware_task_time_entries")
}

-- Update WehowareTask
model WehowareTask {
  // ... existing fields ...
  estimatedHours    Decimal?              @map("estimated_hours") @db.Decimal(5, 2)
  actualHours       Decimal               @default(0) @map("actual_hours") @db.Decimal(8, 2)
  remainingHours    Decimal?              @map("remaining_hours") @db.Decimal(8, 2)
  storyPoints       Int?                  @map("story_points")
  timeEntries       WehowareTaskTimeEntry[] @relation("TaskTimeEntries")
}

-- Update WehowareSubtask
model WehowareSubtask {
  // ... existing fields ...
  estimatedHours    Decimal?              @map("estimated_hours") @db.Decimal(5, 2)
  actualHours       Decimal               @default(0) @map("actual_hours") @db.Decimal(8, 2)
  timeEntries       WehowareTaskTimeEntry[] @relation("SubtaskTimeEntries")
}
```

#### 2.2 API Endpoints

**PUT /api/v1/tasks/[id]**
- Add: estimated_hours, story_points
- Returns: updated task with time fields

**POST /api/v1/tasks/[id]/time-entries**
- Log time spent on task
- Body: { hours_spent, notes, tracked_date }
- Auto-updates actual_hours and remaining_hours
- Logs activity: "time_logged"

**GET /api/v1/tasks/[id]/time-entries**
- List all time entries for task
- Query params: start_date, end_date, user_id
- Returns: { entries: [], total_hours, by_user: {} }

**PUT /api/v1/tasks/[id]/time-entries/[entry_id]**
- Update or delete time entry
- Recalculates totals

**POST /api/v1/subtasks/[id]/time-entries**
- Log time on sub-task
- Same structure as task time

**GET /api/v1/tasks/[id]/time-summary**
- Returns: {
    estimated_hours,
    actual_hours,
    remaining_hours,
    hours_over,
    time_entries_count,
    by_user: { user_id: { hours, entries } }
  }

#### 2.3 UI Components

**TimeEstimateField.js** (New)
- Input for estimated hours or story points
- Toggle between hours/points
- Displays as read-only when locked

**TimeTrackerPanel.js** (New)
- Log time form with date picker
- Quick log buttons (30min, 1hr, 2hr, custom)
- Time entries list with edit/delete
- Daily/weekly summary

**TimeChart.js** (New)
- Shows estimated vs actual hours
- Burn-down chart
- Progress percentage
- Visual warning if over estimate

**BurndownChart.js** (New)
- X-axis: days/sprints
- Y-axis: remaining hours
- Shows ideal vs actual trend
- Alerts if off track

#### 2.4 Testing Checklist
- [ ] Set estimated hours on task
- [ ] Log time entry with hours and notes
- [ ] Actual hours sum correctly
- [ ] Remaining hours = estimated - actual
- [ ] Time entries by date range
- [ ] Time entries by user
- [ ] Update/delete time entries
- [ ] Sub-task time entries work
- [ ] Burndown calculations correct
- [ ] Charts render correctly
- [ ] Role-based access enforced

---

### PHASE 3: Advanced Reporting (Weeks 4-5)
**Deliverable**: Comprehensive analytics dashboard  
**Effort**: 45-60 hours

#### 3.1 Database Views/Queries

```sql
-- Summary view for reporting
CREATE VIEW vw_task_metrics AS
SELECT 
  t.id,
  t.client_id,
  t.title,
  t.status,
  t.priority,
  t.due_date,
  t.assignee_id,
  DATEDIFF(NOW(), t.created_at) as age_days,
  DATEDIFF(t.due_date, NOW()) as days_until_due,
  CASE 
    WHEN t.due_date < NOW() AND t.status != 'Done' THEN 'Overdue'
    WHEN DATEDIFF(t.due_date, NOW()) < 3 THEN 'Due Soon'
    ELSE 'On Track'
  END as urgency,
  t.actual_hours,
  t.estimated_hours,
  (t.actual_hours - t.estimated_hours) as hour_variance,
  COUNT(DISTINCT st.id) as subtask_count,
  SUM(CASE WHEN st.status = 'Done' THEN 1 ELSE 0 END) as subtask_done,
  COUNT(DISTINCT tc.id) as comment_count
FROM wehoware_tasks t
LEFT JOIN wehoware_subtasks st ON t.id = st.task_id
LEFT JOIN wehoware_task_comments tc ON t.id = tc.task_id
GROUP BY t.id;
```

#### 3.2 New API Endpoints

**GET /api/v1/reports/dashboard**
- Summary metrics for dashboard
- Query params: client_id, date_range, status
- Returns: {
    total_tasks,
    by_status: { "To Do": 5, "In Progress": 10, ... },
    by_priority: { High: 8, ... },
    overdue_count,
    due_soon_count,
    completion_rate,
    avg_cycle_time,
    on_time_rate,
    total_hours_tracked,
    total_estimated
  }

**GET /api/v1/reports/task-metrics**
- Detailed task-by-task metrics
- Query params: limit, offset, sort_by, filter
- Returns paginated tasks with calculations

**GET /api/v1/reports/team-performance**
- Team member metrics
- Query params: client_id, date_range
- Returns: {
    by_user: {
      user_id: {
        tasks_assigned,
        tasks_completed,
        avg_completion_time,
        hours_logged,
        on_time_percentage
      }
    }
  }

**GET /api/v1/reports/burndown**
- Sprint/project burndown data
- Query params: sprint_id or project_id, date_range
- Returns: [{ date, remaining_hours, ideal_hours, tasks_completed }]

**GET /api/v1/reports/time-analytics**
- Time tracking analysis
- Query params: client_id, user_id, date_range
- Returns: {
    total_estimated,
    total_actual,
    variance,
    by_user: {},
    by_status: {},
    estimation_accuracy
  }

**GET /api/v1/reports/overdue-tasks**
- All overdue and at-risk tasks
- Query params: client_id, days_overdue
- Returns: sorted list with urgency level

**GET /api/v1/reports/completion-history**
- Tasks completed over time
- Query params: client_id, granularity (daily/weekly/monthly)
- Returns: [{ period, completed_count, hours_completed }]

**GET /api/v1/reports/cycle-time**
- Average time from creation to completion
- By priority, by assignee, by client
- Returns: { avg_days, by_priority: {}, by_assignee: {} }

#### 3.3 UI Components & Pages

**ReportsDashboard.js** (New Page)
- Main reports hub
- Quick stat cards
- Date range filter
- Export options

**MetricsCard.js** (New)
- KPI display card
- Trend indicator (up/down/flat)
- Sparkline chart
- Click to drill-down

**BurndownChart.js** (New)
- Sprint burndown visualization
- Trend line (ideal vs actual)
- Completion date estimate

**TeamPerformanceTable.js** (New)
- Team member productivity
- Tasks completed, avg cycle time
- On-time percentage
- Hours logged

**OverdueTasksList.js** (New)
- Red-flag tasks
- Sorted by urgency
- Quick assign/update actions

**TimeDistributionChart.js** (New)
- Pie/bar chart of time by status
- Time by priority
- Time by team member

**CompletionTrendChart.js** (New)
- Line chart over time
- Daily/weekly/monthly granularity
- Projection to goal

**CycleTimeAnalysis.js** (New)
- Box plot of cycle times
- By priority, assignee, client
- Median, mean, percentiles

#### 3.4 Report Export

```javascript
// /api/v1/reports/export
// Formats: PDF, CSV, Excel
// Includes charts, tables, summary

// Also support:
// - Email scheduled reports
// - Share report links
// - Save report views as favorites
```

#### 3.5 Testing Checklist
- [ ] Dashboard loads <2 sec
- [ ] All report queries use indexes
- [ ] Metrics calculate correctly
- [ ] Date range filtering works
- [ ] Export to CSV/PDF works
- [ ] Team performance accuracy
- [ ] Burndown projection correct
- [ ] Cycle time calculations accurate
- [ ] Charts render on all browsers
- [ ] Mobile responsive reports
- [ ] Permission checks enforced

---

### PHASE 4: Goals & Achievements (Weeks 5-6)
**Deliverable**: Complete OKR/goals tracking system  
**Effort**: 40-50 hours

#### 4.1 Database Schema Updates

```sql
-- Goals table
CREATE TABLE wehoware_goals (
  id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
  client_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  type ENUM('OKR', 'Goal', 'Milestone') DEFAULT 'Goal',
  status ENUM('Not Started', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Not Started',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  progress_percentage INT DEFAULT 0,
  owner_id VARCHAR(36),
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES wehoware_profiles(id),
  FOREIGN KEY (created_by) REFERENCES wehoware_profiles(id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_date_range (start_date, end_date)
);

-- Key results for OKRs
CREATE TABLE wehoware_goal_key_results (
  id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
  goal_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  target_value DECIMAL(10,2),
  current_value DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(50), -- "units", "%", "revenue", etc.
  weight INT DEFAULT 25, -- 25% of goal progress
  status ENUM('Not Started', 'In Progress', 'Completed', 'Failed') DEFAULT 'Not Started',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES wehoware_goals(id) ON DELETE CASCADE,
  INDEX idx_goal_id (goal_id)
);

-- Link tasks to goals
CREATE TABLE wehoware_goal_task_links (
  id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
  goal_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36) NOT NULL,
  contribution_percentage INT DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES wehoware_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES wehoware_tasks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_goal_task (goal_id, task_id),
  INDEX idx_goal_id (goal_id),
  INDEX idx_task_id (task_id)
);

-- Achievements/badges
CREATE TABLE wehoware_achievements (
  id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
  client_id VARCHAR(36),
  user_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  badge_icon VARCHAR(500),
  achieved_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES wehoware_clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES wehoware_profiles(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_achieved_at (achieved_at)
);

-- Prisma Schema
model WehowareGoal {
  id                  String   @id @default(uuid()) @db.VarChar(36)
  clientId            String   @map("client_id") @db.VarChar(36)
  title               String   @db.VarChar(500)
  description         String?  @db.Text
  type                GoalType @default(Goal)
  status              GoalStatus @default(NotStarted)
  startDate           DateTime @map("start_date") @db.Date
  endDate             DateTime @map("end_date") @db.Date
  progressPercentage  Int      @default(0) @map("progress_percentage")
  ownerId             String?  @map("owner_id") @db.VarChar(36)
  createdBy           String?  @map("created_by") @db.VarChar(36)
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  
  client              WehowareClient          @relation(fields: [clientId], references: [id], onDelete: Cascade)
  owner               WehowareProfile?        @relation("GoalOwner", fields: [ownerId], references: [id])
  creator             WehowareProfile?        @relation("GoalCreator", fields: [createdBy], references: [id])
  keyResults          WehowareGoalKeyResult[]
  taskLinks           WehowareGoalTaskLink[]
  
  @@index([clientId])
  @@index([status])
  @@index([startDate, endDate])
  @@map("wehoware_goals")
}

model WehowareGoalKeyResult {
  id              String   @id @default(uuid()) @db.VarChar(36)
  goalId          String   @map("goal_id") @db.VarChar(36)
  title           String   @db.VarChar(500)
  targetValue     Decimal? @map("target_value") @db.Decimal(10, 2)
  currentValue    Decimal  @default(0) @map("current_value") @db.Decimal(10, 2)
  unit            String?  @db.VarChar(50)
  weight          Int      @default(25)
  status          KeyResultStatus @default(NotStarted)
  createdAt       DateTime @default(now()) @map("created_at")
  
  goal            WehowareGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)
  
  @@index([goalId])
  @@map("wehoware_goal_key_results")
}

model WehowareGoalTaskLink {
  id                      String   @id @default(uuid()) @db.VarChar(36)
  goalId                  String   @map("goal_id") @db.VarChar(36)
  taskId                  String   @map("task_id") @db.VarChar(36)
  contributionPercentage  Int      @default(100) @map("contribution_percentage")
  createdAt               DateTime @default(now()) @map("created_at")
  
  goal                    WehowareGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)
  task                    WehowareTask @relation("GoalTasks", fields: [taskId], references: [id], onDelete: Cascade)
  
  @@unique([goalId, taskId])
  @@index([goalId])
  @@index([taskId])
  @@map("wehoware_goal_task_links")
}

model WehowareAchievement {
  id          String   @id @default(uuid()) @db.VarChar(36)
  clientId    String?  @map("client_id") @db.VarChar(36)
  userId      String?  @map("user_id") @db.VarChar(36)
  title       String   @db.VarChar(255)
  description String?  @db.Text
  badgeIcon   String?  @map("badge_icon") @db.VarChar(500)
  achievedAt  DateTime @map("achieved_at")
  createdAt   DateTime @default(now()) @map("created_at")
  
  client      WehowareClient? @relation(fields: [clientId], references: [id], onDelete: Cascade)
  user        WehowareProfile? @relation("UserAchievements", fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([achievedAt])
  @@map("wehoware_achievements")
}

enum GoalType {
  OKR
  Goal
  Milestone
}

enum GoalStatus {
  NotStarted  @map("Not Started")
  InProgress  @map("In Progress")
  Completed
  Cancelled
}

enum KeyResultStatus {
  NotStarted  @map("Not Started")
  InProgress  @map("In Progress")
  Completed
  Failed
}
```

#### 4.2 API Endpoints

**Goal Management**

**POST /api/v1/goals**
- Create goal with key results
- Body: {
    title,
    description,
    type (OKR|Goal|Milestone),
    start_date,
    end_date,
    owner_id,
    key_results: [{ title, target_value, unit, weight }]
  }
- Returns: created goal with KRs

**GET /api/v1/goals**
- List goals with filters
- Query params: status, type, date_range, owner_id
- Returns: paginated goals with progress %

**GET /api/v1/goals/[id]**
- Get single goal with all details
- Returns: goal, key_results, linked_tasks, progress breakdown

**PUT /api/v1/goals/[id]**
- Update goal status, title, dates
- Logs activity: "goal_updated"

**DELETE /api/v1/goals/[id]**
- Delete goal and all links
- Logs activity: "goal_deleted"

**Task-Goal Links**

**POST /api/v1/goals/[id]/link-task**
- Link task to goal
- Body: { task_id, contribution_percentage }
- Auto-updates goal progress

**DELETE /api/v1/goals/[id]/link-task/[task_id]**
- Unlink task from goal
- Recalculates progress

**Key Results**

**PUT /api/v1/goals/[id]/key-results/[kr_id]**
- Update KR current value and status
- Auto-calculates goal progress
- Logs: "key_result_updated"

**Achievements**

**POST /api/v1/achievements**
- Award achievement to user
- Body: { user_id, title, description, badge_icon }
- Can be auto-triggered or manual

**GET /api/v1/users/[id]/achievements**
- List user's achievements
- Returns: badges earned with dates

**GET /api/v1/reports/goal-progress**
- Goal progress overview
- By status, by owner, by type
- Returns: metrics and progress data

#### 4.3 UI Components & Pages

**GoalsPage.js** (New Page)
- Main goals/OKRs page
- Filter by status, type, date range
- Create new goal button
- Goal cards/list view

**GoalCard.js** (New)
- Shows goal title, owner, dates
- Progress bar with KR breakdown
- Linked tasks count
- Quick edit/delete

**GoalDetailPanel.js** (New)
- Full goal details
- Key results with progress bars
- Linked tasks section
- Activity timeline
- Edit form

**KeyResultTracker.js** (New)
- Update current value
- Target vs current visualization
- Status change dropdown
- Weight indicator

**GoalTaskLinker.js** (New)
- Modal to link tasks to goals
- Search and select tasks
- Set contribution %
- Preview impact on goal %

**AchievementBadge.js** (New)
- Display achievement badge
- Hover tooltip with description
- Awarded date
- Shareable

**AchievementsSection.js** (New)
- Team achievements gallery
- Latest achievements feed
- Achievement statistics

**GoalProgressChart.js** (New)
- Visual progress for each goal
- Breakdown by KR
- Comparison view

#### 4.4 Auto-Achievement Logic

```javascript
// When task completed, check:
- 5 tasks completed → "Task Master" badge
- 10 tasks on time → "Reliability" badge
- 100 hours logged → "Dedication" badge
- Goal 100% complete → "Goal Crusher" badge
- Help others complete 5 tasks → "Team Player" badge
```

#### 4.5 Testing Checklist
- [ ] Create goal with key results
- [ ] Link task to goal
- [ ] Goal progress calculates from linked tasks
- [ ] KR progress updates when task completes
- [ ] Goal completion percentage accurate
- [ ] Unlink task updates goal %
- [ ] Achievements awarded correctly
- [ ] Goal filtering works
- [ ] Reports show goal metrics
- [ ] Activity logs track changes
- [ ] Permissions enforced

---

## 🗄️ Complete Database Schema Summary

```prisma
// NEW MODELS TO ADD
model WehowareSubtask { ... }
model WehowareTaskTimeEntry { ... }
model WehowareGoal { ... }
model WehowareGoalKeyResult { ... }
model WehowareGoalTaskLink { ... }
model WehowareAchievement { ... }

// MODIFIED MODELS
model WehowareTask {
  // ADD FIELDS:
  subtasks: WehowareSubtask[]
  subtaskCount: Int
  subtaskCompleted: Int
  estimatedHours: Decimal?
  actualHours: Decimal
  remainingHours: Decimal?
  storyPoints: Int?
  timeEntries: WehowareTaskTimeEntry[]
  linkedGoals: WehowareGoalTaskLink[]
}

model WehowareSubtask {
  // Include estimatedHours, actualHours, timeEntries
}

model WehowareProfile {
  // ADD:
  achievements: WehowareAchievement[]
  ownedGoals: WehowareGoal[]
}

model WehowareClient {
  // ADD:
  goals: WehowareGoal[]
  achievements: WehowareAchievement[]
}
```

---

## 🚀 API Endpoints Summary (30+ New Endpoints)

### Sub-Tasks (5)
- GET /api/v1/tasks/[id]/subtasks
- POST /api/v1/tasks/[id]/subtasks
- PUT /api/v1/tasks/[id]/subtasks/[subtask_id]
- DELETE /api/v1/tasks/[id]/subtasks/[subtask_id]
- PATCH /api/v1/tasks/[id]/subtasks/reorder

### Time Tracking (6)
- PUT /api/v1/tasks/[id] (add estimated_hours, story_points)
- POST /api/v1/tasks/[id]/time-entries
- GET /api/v1/tasks/[id]/time-entries
- PUT /api/v1/tasks/[id]/time-entries/[entry_id]
- POST /api/v1/subtasks/[id]/time-entries
- GET /api/v1/tasks/[id]/time-summary

### Reporting (8)
- GET /api/v1/reports/dashboard
- GET /api/v1/reports/task-metrics
- GET /api/v1/reports/team-performance
- GET /api/v1/reports/burndown
- GET /api/v1/reports/time-analytics
- GET /api/v1/reports/overdue-tasks
- GET /api/v1/reports/completion-history
- GET /api/v1/reports/cycle-time

### Goals (11)
- POST /api/v1/goals
- GET /api/v1/goals
- GET /api/v1/goals/[id]
- PUT /api/v1/goals/[id]
- DELETE /api/v1/goals/[id]
- POST /api/v1/goals/[id]/link-task
- DELETE /api/v1/goals/[id]/link-task/[task_id]
- PUT /api/v1/goals/[id]/key-results/[kr_id]
- POST /api/v1/achievements
- GET /api/v1/users/[id]/achievements
- GET /api/v1/reports/goal-progress

---

## 🎨 UI Components Summary (25+ New Components)

### Sub-Tasks
- SubtaskList
- SubtaskItem
- SubtaskForm
- TaskCompletionBar

### Time Tracking
- TimeEstimateField
- TimeTrackerPanel
- TimeChart
- BurndownChart
- TimeEntriesList
- QuickLogButtons

### Reporting
- ReportsDashboard
- MetricsCard
- TeamPerformanceTable
- OverdueTasksList
- TimeDistributionChart
- CompletionTrendChart
- CycleTimeAnalysis
- BurndownVisualization
- ReportExporter

### Goals
- GoalsPage
- GoalCard
- GoalDetailPanel
- KeyResultTracker
- GoalTaskLinker
- AchievementBadge
- AchievementsSection
- GoalProgressChart

---

## 📋 Implementation Checklist

### Before Starting
- [ ] Create new Git branch: `feature/task-module-complete`
- [ ] Database backup
- [ ] Review all schema changes
- [ ] Plan API versioning strategy

### Phase 1: Sub-Tasks
- [ ] Add Prisma schema models
- [ ] Run `prisma migrate dev --name add-subtasks`
- [ ] Implement API endpoints (5)
- [ ] Create UI components (4)
- [ ] Add API tests
- [ ] Add UI tests
- [ ] Code review
- [ ] Deploy to staging

### Phase 2: Time Tracking
- [ ] Add Prisma schema models
- [ ] Run database migrations
- [ ] Implement API endpoints (6)
- [ ] Create UI components (6)
- [ ] Add time calculation logic
- [ ] Burndown algorithms
- [ ] Tests for all calculations
- [ ] Code review
- [ ] Deploy to staging

### Phase 3: Reporting
- [ ] Create database views
- [ ] Implement API endpoints (8)
- [ ] Create UI components (9)
- [ ] Add chart libraries (Recharts integration)
- [ ] Implement export functionality (CSV, PDF)
- [ ] Performance testing (query optimization)
- [ ] Tests for all reports
- [ ] Code review
- [ ] Deploy to staging

### Phase 4: Goals
- [ ] Add Prisma schema models
- [ ] Run database migrations
- [ ] Implement API endpoints (11)
- [ ] Create UI components (8)
- [ ] Auto-achievement logic
- [ ] Goal progress calculation
- [ ] Tests for all features
- [ ] Code review
- [ ] Deploy to staging

### Post-Implementation
- [ ] Merge to main branch
- [ ] Deploy to production
- [ ] User documentation
- [ ] Training/webinar
- [ ] Monitor performance
- [ ] Gather feedback
- [ ] Plan next improvements

---

## ⚙️ Technical Decisions

### Database Performance
- All list queries use indexes
- Eager load relations (no N+1 queries)
- Paginate results (max 100 per page)
- Use SELECT specific fields when possible
- Archive old time entries annually

### API Design
- RESTful endpoints
- Consistent error handling
- Rate limiting (100 requests/min per user)
- Detailed error messages
- Activity logging for audit trail
- Backwards compatible

### UI/UX
- Responsive design (mobile-first)
- Loading states on all async operations
- Optimistic updates where appropriate
- Clear error messages
- Confirmation dialogs for destructive actions
- Keyboard shortcuts for power users

### Security
- Role-based access control throughout
- Validate all inputs
- SQL injection prevention (Prisma)
- CSRF tokens on forms
- Rate limiting
- Activity audit logs

---

## 📅 Timeline & Effort

```
Week 1:  Phase 1 (Sub-tasks)             = 40-50 hours
Week 2:  Phase 2 (Time Tracking)         = 35-45 hours (parallel testing)
Week 3:  Phase 2 continued + Phase 3     = 45-60 hours
Week 4:  Phase 3 (Reporting)             = 45-60 hours
Week 5:  Phase 3 continued + Phase 4     = 40-50 hours (parallel)
Week 6:  Phase 4 (Goals)                 = 40-50 hours

TOTAL: 245-315 hours (6-8 weeks with 1 person, or 3-4 weeks with 2 people)

Can be parallelized:
- Backend development for Phases 1-2 while UI is being built
- Reporting backend while Goals are being planned
- Database optimization can happen alongside UI development
```

## 🔄 Dependencies

```
Phase 1: Sub-tasks
  ↓ (requires database)
Phase 2: Time Tracking + Phase 3: Reporting
  ↓ (can run parallel)
Phase 4: Goals
  ↓ (requires all previous phases)
Final Integration Testing
```

---

## ✅ Success Criteria

1. **Sub-Tasks**: 
   - ✅ All CRUD operations work
   - ✅ Completion % updates correctly
   - ✅ <500ms response time

2. **Time Tracking**:
   - ✅ Estimates and actuals tracked
   - ✅ Burndown calculations accurate
   - ✅ Time entries auditable

3. **Reporting**:
   - ✅ Dashboard loads <2 seconds
   - ✅ All reports exportable
   - ✅ Metrics match manual calculations

4. **Goals**:
   - ✅ Goals linkable to tasks
   - ✅ Progress auto-calculates
   - ✅ Achievements awarded automatically

5. **Overall**:
   - ✅ 95%+ test coverage
   - ✅ Zero breaking changes to existing API
   - ✅ Performance benchmarks met
   - ✅ 100% role-based access enforced

---

## 🚢 Rollout Strategy

### Stage 1: Internal Testing (1 week)
- Deploy to staging
- Internal team tests all features
- Performance testing
- Security audit

### Stage 2: Beta Rollout (1 week)
- Feature flag: `ENABLE_SUBTASKS`
- Limited users test in production
- Monitor error rates
- Collect feedback

### Stage 3: Full Production (1 day)
- Enable feature flags
- Monitor closely
- Have rollback plan ready
- Notify all users

### Stage 4: Documentation & Training (ongoing)
- Update user docs
- Create video tutorials
- Host webinar
- Support escalations

---

## 🔧 Tools & Dependencies

**Already in project**:
- Next.js 15
- Prisma 6
- MySQL 8
- Recharts (for charts)

**May need to add**:
- Date-fns (date calculations) - already in project
- PDF export library (pdfkit or similar)
- CSV export library (papaparse or similar)

---

## 📞 Support & Troubleshooting

### Common Issues
1. **Sub-task completion % wrong**: Check sub-task statuses, run count query
2. **Time entries duplicating**: Check unique constraints
3. **Reports slow**: Add missing indexes, implement caching
4. **Goals not updating**: Check trigger logic, verify linked tasks
5. **Achievements not awarding**: Verify achievement rules, check user logs

### Performance Tuning
- Add Redis caching for reports
- Denormalize frequently-queried fields
- Archive old time entries
- Optimize chart queries with aggregations

---

**Next Step**: Ready to begin Phase 1. Shall I start with database migrations and API endpoints?

