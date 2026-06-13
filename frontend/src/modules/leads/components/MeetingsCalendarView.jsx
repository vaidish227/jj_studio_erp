import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import MeetingCard from './MeetingCard';

const sameDay = (a, b) =>
  a && b && new Date(a).toDateString() === new Date(b).toDateString();

const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

/**
 * Calendar view body for the unified Meetings page. Two-column layout (like the
 * original): a compact month calendar on the left and the selected day's
 * meetings on the right. Owns only its own month-navigation + selected-day
 * state; receives the raw meetings + action handlers from the parent page so
 * data fetching and modals stay shared. `onScheduleForDay(date)` opens the
 * parent's Schedule modal prefilled with the selected day.
 */
const MeetingsCalendarView = ({
  meetings,
  onViewDetails,
  onStatusChange,
  onReschedule,
  onRecordMOM,
  onScheduleForDay,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Days grid for the current visible month, each with its meeting count.
  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);
    const days = [];
    for (let i = 0; i < firstDay; i += 1) days.push({ day: null, date: null, meetingCount: 0 });
    for (let i = 1; i <= totalDays; i += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const meetingCount = meetings.filter((m) => sameDay(m.date, date)).length;
      days.push({ day: i, date, meetingCount });
    }
    return days;
  }, [currentMonth, meetings]);

  // Meetings on the selected day, sorted by time ascending
  const dayMeetings = useMemo(() => {
    return meetings
      .filter((m) => sameDay(m.date, selectedDate))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [meetings, selectedDate]);

  const goToMonth = (offset) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    const lastDay = new Date(newMonth.getFullYear(), newMonth.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(selectedDate.getDate(), lastDay);
    setCurrentMonth(newMonth);
    setSelectedDate(new Date(newMonth.getFullYear(), newMonth.getMonth(), clampedDay));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left — compact month calendar */}
      <div className="lg:col-span-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5 gap-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => { const t = new Date(); setCurrentMonth(t); setSelectedDate(t); }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                  sameDay(selectedDate, new Date())
                    ? 'text-[var(--text-secondary)] hover:bg-[var(--bg)]'
                    : 'text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/30 hover:bg-[var(--primary)]/15'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                className="p-1.5 hover:bg-[var(--bg)] rounded-lg transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-bold text-[var(--text-muted)] uppercase mb-3">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Day cells — number + a small count badge for days with meetings */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isSelected = sameDay(day.date, selectedDate);
              const isToday = sameDay(day.date, new Date());
              return (
                <button
                  key={index}
                  type="button"
                  disabled={!day.day}
                  onClick={() => day.date && setSelectedDate(day.date)}
                  className={`
                    relative h-12 flex flex-col items-center justify-center rounded-xl transition-all
                    ${!day.day ? 'opacity-0 cursor-default pointer-events-none' : 'hover:bg-[var(--primary)]/10'}
                    ${isSelected
                      ? 'bg-[var(--primary)] text-black font-bold'
                      : isToday
                        ? 'ring-1 ring-[var(--primary)]/40 text-[var(--text-primary)]'
                        : 'text-[var(--text-primary)]'}
                  `}
                >
                  <span className="text-sm leading-none">{day.day}</span>
                  {day.meetingCount > 0 && !isSelected && (
                    <span className="mt-1 min-w-[18px] h-4 px-1 bg-[var(--primary)]/20 text-[var(--primary)] text-[10px] rounded flex items-center justify-center font-bold">
                      {day.meetingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Right — selected day's meetings */}
      <div className="lg:col-span-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </h3>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {dayMeetings.length} {dayMeetings.length === 1 ? 'meeting' : 'meetings'}
            </span>
          </div>
          {dayMeetings.length ? (
            <div className="space-y-4">
              {dayMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting._id}
                  meeting={meeting}
                  onViewDetails={() => onViewDetails(meeting)}
                  onStatusChange={onStatusChange}
                  onReschedule={onReschedule}
                  onRecordMOM={onRecordMOM}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
              <CalendarIcon size={24} className="text-[var(--text-muted)] opacity-60 mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)] font-medium">
                No meetings scheduled on this day.
              </p>
              {onScheduleForDay && (
                <Button variant="outline" size="sm" className="mt-3 mx-auto" onClick={() => onScheduleForDay(selectedDate)}>
                  <Plus size={14} className="mr-1.5" />
                  Schedule for this day
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingsCalendarView;
