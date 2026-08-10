import { computed, ref } from "vue";
import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

// Shared selected date for the Sales report. This is the single source of truth:
// the Day, Weekly and Monthly tabs all derive their period (day / ISO week /
// calendar month) from `from`, so picking a date updates every tab's context.

const FMT = "YYYY-MM-DD";

// A till runs for days without a restart, so "now" must tick — a module-load
// snapshot would freeze "today" (and the can't-navigate-into-the-future guards)
// at whatever day the app was launched.
const now = ref(dayjs());
setInterval(() => {
  now.value = dayjs();
}, 30_000);

export const todayStr = computed(() => now.value.format(FMT));

// ----- The selected day (Day tab) -----
export const from = ref(now.value.format(FMT));

export const startMs = computed(() => dayjs(from.value).startOf("day").valueOf());
export const endMs = computed(() => dayjs(from.value).add(1, "day").startOf("day").valueOf());

export const dateLabel = computed(() => dayjs(from.value).format("DD MMM YYYY"));

export function setToday(): void {
  from.value = todayStr.value;
}
export function setDay(d: Dayjs | string): void {
  from.value = dayjs(d).format(FMT);
}

// ----- Weekly (ISO week: Mon–Sun) derived from `from` -----
const weekStart = computed(() => dayjs(from.value).startOf("isoWeek"));
export const weekStartMs = computed(() => weekStart.value.valueOf());
export const weekEndMs = computed(() => weekStart.value.add(7, "day").valueOf());
export const weekDays = computed(() => Array.from({ length: 7 }, (_, i) => weekStart.value.add(i, "day")));
export const weekLabel = computed(
  () => `${weekStart.value.format("DD MMM")} – ${weekStart.value.add(6, "day").format("DD MMM YYYY")}`,
);
export const isThisWeek = computed(() => weekStart.value.isSame(now.value.startOf("isoWeek"), "day"));
export const canWeekForward = computed(() => weekStart.value.add(7, "day").valueOf() <= now.value.valueOf());

export function weekShift(delta: number): void {
  from.value = dayjs(from.value).add(delta, "week").format(FMT);
}
export function weekToCurrent(): void {
  from.value = todayStr.value;
}

// ----- Monthly (calendar month) derived from `from` -----
const monthRef = computed(() => dayjs(from.value));
export const monthStartMs = computed(() => monthRef.value.startOf("month").valueOf());
export const monthLabel = computed(() => monthRef.value.format("MMMM YYYY"));
export const monthYear = computed(() => monthRef.value.year());
export const monthIndex = computed(() => monthRef.value.month());
export const daysInMonth = computed(() => monthRef.value.daysInMonth());
const isThisMonth = computed(() => monthRef.value.isSame(now.value, "month"));
// Highest selectable day-of-month: today in the current month, else the whole month.
export const monthMaxDay = computed(() => (isThisMonth.value ? now.value.date() : daysInMonth.value));
// Day to highlight as "today" — only meaningful in the current month.
export const monthTodayDate = computed(() => (isThisMonth.value ? now.value.date() : -1));
