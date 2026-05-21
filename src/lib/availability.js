/**
 * Core Availability Engine
 *
 * Computes free time slots for a client based on:
 *   - defaultAvailability (weekly hours, from appointment_settings)
 *   - existing appointments (with buffer + duration)
 *   - minimum notice
 *   - future booking limit
 *   - timezone awareness
 */

import { prisma } from "@/lib/prisma";
import {
  addMinutes,
  differenceInMinutes,
  isBefore,
  isAfter,
  startOfDay,
} from "date-fns";

const DEFAULT_AVAILABILITY = {
  monday:    { enabled: true,  start: "09:00", end: "17:00" },
  tuesday:   { enabled: true,  start: "09:00", end: "17:00" },
  wednesday: { enabled: true,  start: "09:00", end: "17:00" },
  thursday:  { enabled: true,  start: "09:00", end: "17:00" },
  friday:    { enabled: true,  start: "09:00", end: "17:00" },
  saturday:  { enabled: false, start: "10:00", end: "15:00" },
  sunday:    { enabled: false, start: "10:00", end: "15:00" },
};

const DEFAULT_BUFFER = 0;
const DEFAULT_MIN_NOTICE = 0;
const DEFAULT_FUTURE_LIMIT = 60;
const SLOT_STEP = 15; // minutes

/**
 * Fetch appointment settings for a client from the generic settings API.
 */
async function getAppointmentSettings(clientId) {
  const row = await prisma.wehowareSetting.findFirst({
    where: { clientId, settingKey: "appointment_settings" },
    select: { settingValue: true },
  });
  if (!row?.settingValue) return null;
  try {
    return JSON.parse(row.settingValue);
  } catch {
    return null;
  }
}

function dayKey(date) {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[date.getDay()];
}

function parseTime(timeStr, baseDate) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Get existing appointments that overlap a date range.
 */
async function getExistingAppointments(clientId, from, to) {
  return prisma.wehowareAppointment.findMany({
    where: {
      clientId,
      scheduledAt: { gte: from, lte: to },
      status: { notIn: ["Cancelled"] },
    },
    include: { appointmentType: { select: { duration: true } } },
    orderBy: { scheduledAt: "asc" },
  });
}

/**
 * Build occupied intervals from existing appointments.
 * Each interval = [start, end+buffer] in UTC.
 */
function buildOccupiedIntervals(appointments, bufferMinutes = 0) {
  return appointments.map((appt) => {
    const start = new Date(appt.scheduledAt);
    const dur = appt.appointmentType?.duration ?? 30;
    const end = addMinutes(start, dur + bufferMinutes);
    return { start, end };
  });
}

/**
 * Subtract occupied intervals from a single availability interval.
 * Returns an array of free {start, end} intervals.
 */
function subtractIntervals(availability, occupied) {
  const free = [{ start: availability.start, end: availability.end }];
  for (const occ of occupied) {
    const nextFree = [];
    for (const interval of free) {
      // occ completely before interval
      if (isBefore(occ.end, interval.start) || occ.end.getTime() <= interval.start.getTime()) {
        nextFree.push(interval);
        continue;
      }
      // occ completely after interval
      if (isAfter(occ.start, interval.end) || occ.start.getTime() >= interval.end.getTime()) {
        nextFree.push(interval);
        continue;
      }
      // occ overlaps: split into left and/or right remainder
      if (isBefore(interval.start, occ.start)) {
        nextFree.push({ start: interval.start, end: occ.start });
      }
      if (isAfter(interval.end, occ.end)) {
        nextFree.push({ start: occ.end, end: interval.end });
      }
    }
    free.length = 0;
    free.push(...nextFree);
  }
  return free.filter((i) => differenceInMinutes(i.end, i.start) > 0);
}

/**
 * Slice a free interval into bookable slots of a given step.
 * Only keeps slots that can fully contain the requested duration.
 */
function sliceSlots(interval, durationMinutes, stepMinutes = SLOT_STEP) {
  const slots = [];
  let cursor = new Date(interval.start);
  const end = new Date(interval.end);
  while (differenceInMinutes(end, cursor) >= durationMinutes) {
    slots.push(new Date(cursor));
    cursor = addMinutes(cursor, stepMinutes);
  }
  return slots;
}

/**
 * Compute the effective date range given notice and future booking limits.
 */
function computeRange(from, to, minNotice, futureLimit) {
  const now = new Date();
  const earliest = addMinutes(now, minNotice * 60);
  const latest = addMinutes(now, futureLimit * 24 * 60);

  const rangeStart = isBefore(from, earliest) ? earliest : from;
  const rangeEnd = isAfter(to, latest) ? latest : to;
  return { rangeStart, rangeEnd };
}

/**
 * Build free slots for a single day given its config, occupied intervals,
 * the overall range bounds, and the required appointment duration.
 */
function buildDaySlots(dayCursor, dayConf, rangeStart, rangeEnd, occupied, durationMinutes) {
  if (!dayConf?.enabled) return [];

  const dayStart = parseTime(dayConf.start, dayCursor);
  const dayEnd = parseTime(dayConf.end, dayCursor);

  const effectiveStart = isBefore(dayStart, rangeStart) ? rangeStart : dayStart;
  const effectiveEnd = isAfter(dayEnd, rangeEnd) ? rangeEnd : dayEnd;

  if (!isBefore(effectiveStart, effectiveEnd)) return [];

  const freeIntervals = subtractIntervals(
    { start: effectiveStart, end: effectiveEnd },
    occupied
  );

  const daySlots = [];
  for (const interval of freeIntervals) {
    daySlots.push(...sliceSlots(interval, durationMinutes));
  }
  return daySlots;
}

/**
 * Compute free slots for a client across a date range.
 *
 * @param {string}  clientId          – tenant ID
 * @param {Date}    from              – start of range (UTC)
 * @param {Date}    to                – end of range (UTC)
 * @param {number}  durationMinutes   – requested appointment length
 * @param {Object}  options
 * @param {number}  options.buffer     – buffer minutes between appointments
 * @param {number}  options.minNotice  – hours of minimum advance notice
 * @param {number}  options.futureLimit – max days ahead bookable
 *
 * @returns {Date[]}  Array of UTC Date objects representing slot starts
 */
export async function getFreeSlots(
  clientId,
  from,
  to,
  durationMinutes,
  options = {}
) {
  const settings = (await getAppointmentSettings(clientId)) || {};
  const availability = settings.defaultAvailability || DEFAULT_AVAILABILITY;
  const buffer = options.buffer ?? settings.bufferTime ?? DEFAULT_BUFFER;
  const minNotice = options.minNotice ?? settings.minimumNotice ?? DEFAULT_MIN_NOTICE;
  const futureLimit = options.futureLimit ?? settings.futureLimit ?? DEFAULT_FUTURE_LIMIT;

  const { rangeStart, rangeEnd } = computeRange(from, to, minNotice, futureLimit);
  if (isAfter(rangeStart, rangeEnd)) return [];

  const existing = await getExistingAppointments(clientId, rangeStart, rangeEnd);
  const occupied = buildOccupiedIntervals(existing, buffer);

  const slots = [];
  let dayCursor = new Date(rangeStart);

  while (dayCursor <= rangeEnd) {
    const dayConf = availability[dayKey(dayCursor)];
    slots.push(
      ...buildDaySlots(dayCursor, dayConf, rangeStart, rangeEnd, occupied, durationMinutes)
    );
    dayCursor = addMinutes(startOfDay(addMinutes(dayCursor, 24 * 60)), 0);
  }

  return slots;
}
