import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Button } from "./button";
import { ClearButton } from "./clear-button";
import { cn } from "./cn";
import { CalendarIcon, ChevronDownIcon } from "./icons";
import { inputVariants } from "./input";
import { Popover, usePopover } from "./popover";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const FORMAT_HINT = "dd.MM.yyyy HH:mm:ss";

const pad = (value: number) => String(value).padStart(2, "0");

export const formatDateTime = (date: Date) =>
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/** Reads a date in the format of the field; null for text that is not a real date. */
export const parseDateTime = (text: string) => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(text.trim());
    if (!match) return null;
    const [day, month, year, hours, minutes, seconds] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    return formatDateTime(date) === text.trim() ? date : null;
};

/** The days shown for a month: whole weeks from Monday on, including neighbouring days. */
export const calendarDays = (year: number, month: number) => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - offset + index));
};

/** Meetings mostly start in the evening, so an empty field does not begin at the clock's time. */
const defaultDate = () => {
    const date = new Date();
    date.setHours(19, 0, 0, 0);
    return date;
};

const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

const cellClasses = (selected: boolean) =>
    cn(
        "rounded-[6px] hover:bg-ui-option-hover hover:text-ui-option-hover-text",
        selected && "bg-ui-btn-primary text-white hover:bg-ui-btn-primary-hover hover:text-white"
    );

interface TimeColumnProps {
    readonly label: string;
    readonly value: number;
    readonly count: number;
    readonly onChange: (value: number) => void;
}

const TimeColumn = ({ label, value, count, onChange }: TimeColumnProps) => {
    const columnRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const column = columnRef.current;
        const selected = column?.querySelector<HTMLElement>("[aria-pressed=true]");
        if (column && selected) {
            column.scrollTop =
                selected.offsetTop - (column.clientHeight - selected.clientHeight) / 2;
        }
    }, []);

    return (
        <div
            ref={columnRef}
            role="group"
            aria-label={label}
            className="relative h-full flex-1 overflow-y-auto"
        >
            {Array.from({ length: count }, (_, option) => (
                <button
                    key={option}
                    type="button"
                    aria-pressed={option === value}
                    className={cn("block h-[30px] w-full", cellClasses(option === value))}
                    onClick={() => onChange(option)}
                >
                    {pad(option)}
                </button>
            ))}
        </div>
    );
};

interface CalendarProps {
    readonly value: Date | null;
    readonly onChange: (value: Date) => void;
}

const Calendar = ({ value, onChange }: CalendarProps) => {
    const shown = value ?? defaultDate();
    const [visibleMonth, setVisibleMonth] = useState({
        year: shown.getFullYear(),
        month: shown.getMonth()
    });
    const [view, setView] = useState<"days" | "months" | "time">("days");

    const changeDate = (mutate: (date: Date) => void) => {
        const next = new Date(shown);
        mutate(next);
        onChange(next);
    };

    const moveMonth = (delta: number) => {
        const moved = new Date(visibleMonth.year, visibleMonth.month + delta, 1);
        setVisibleMonth({ year: moved.getFullYear(), month: moved.getMonth() });
    };

    return (
        <div className="h-[274px]">
            <div className="flex h-[39px] items-center justify-between pl-7 pr-[18px] pt-1 text-xs text-ui-text-secondary">
                <div className="flex items-center">
                    <button
                        type="button"
                        aria-label={view === "months" ? "Voriges Jahr" : "Voriger Monat"}
                        className="px-2 py-1 text-[14px]"
                        onClick={() => moveMonth(view === "months" ? -12 : -1)}
                    >
                        <ChevronDownIcon className="rotate-90" />
                    </button>
                    <button
                        type="button"
                        aria-expanded={view === "months"}
                        className="px-[9px] py-1"
                        onClick={() => setView(view === "months" ? "days" : "months")}
                    >
                        {MONTHS[visibleMonth.month]} {visibleMonth.year}
                    </button>
                    <button
                        type="button"
                        aria-label={view === "months" ? "Nächstes Jahr" : "Nächster Monat"}
                        className="px-2 py-1 text-[14px]"
                        onClick={() => moveMonth(view === "months" ? 12 : 1)}
                    >
                        <ChevronDownIcon className="-rotate-90" />
                    </button>
                </div>
                <button
                    type="button"
                    aria-expanded={view === "time"}
                    className="px-1 py-1"
                    onClick={() => setView(view === "time" ? "days" : "time")}
                >
                    {pad(shown.getHours())}:{pad(shown.getMinutes())}:{pad(shown.getSeconds())}
                </button>
            </div>
            {view === "days" && (
                <div className="grid grid-cols-7 px-[15px] text-center">
                    {WEEKDAYS.map((weekday) => (
                        <span
                            key={weekday}
                            className="h-6 text-xs leading-6 text-ui-text-secondary"
                        >
                            {weekday}
                        </span>
                    ))}
                    {calendarDays(visibleMonth.year, visibleMonth.month).map((day) => {
                        const selected = value !== null && sameDay(day, value);
                        return (
                            <span
                                key={day.getTime()}
                                className="flex h-8 items-center justify-center"
                            >
                                <button
                                    type="button"
                                    aria-pressed={selected}
                                    aria-label={day.toLocaleDateString("de-DE", {
                                        dateStyle: "long"
                                    })}
                                    className={cn(
                                        "size-[30px]",
                                        cellClasses(selected),
                                        day.getMonth() !== visibleMonth.month &&
                                            !selected &&
                                            "text-ui-text-disabled"
                                    )}
                                    onClick={() =>
                                        changeDate((date) =>
                                            date.setFullYear(
                                                day.getFullYear(),
                                                day.getMonth(),
                                                day.getDate()
                                            )
                                        )
                                    }
                                >
                                    {day.getDate()}
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}
            {view === "months" && (
                <div className="grid grid-cols-3 gap-2 px-[15px] pt-2">
                    {MONTHS.map((name, index) => (
                        <button
                            key={name}
                            type="button"
                            aria-pressed={index === visibleMonth.month}
                            className={cn("h-10", cellClasses(index === visibleMonth.month))}
                            onClick={() => {
                                setVisibleMonth({ ...visibleMonth, month: index });
                                setView("days");
                            }}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
            {view === "time" && (
                <div className="flex h-[227px] gap-1 px-[15px] text-center">
                    <TimeColumn
                        label="Stunde"
                        value={shown.getHours()}
                        count={24}
                        onChange={(hours) => changeDate((date) => date.setHours(hours))}
                    />
                    <TimeColumn
                        label="Minute"
                        value={shown.getMinutes()}
                        count={60}
                        onChange={(minutes) => changeDate((date) => date.setMinutes(minutes))}
                    />
                    <TimeColumn
                        label="Sekunde"
                        value={shown.getSeconds()}
                        count={60}
                        onChange={(seconds) => changeDate((date) => date.setSeconds(seconds))}
                    />
                </div>
            )}
        </div>
    );
};

interface DateTimePickerProps {
    readonly value: Date | null;
    /** Called with every date picked or completely typed, and null when the field is emptied. */
    readonly onChange: (value: Date | null) => void;
    readonly className?: string;
}

/** Date and time in one field, typed as dd.MM.yyyy HH:mm:ss or picked in the calendar. */
export const DateTimePicker = ({ value, onChange, className }: DateTimePickerProps) => {
    const { open, setOpen, triggerProps } = usePopover();
    const fieldRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState<string | null>(null);

    return (
        <div className={cn("relative inline-block w-[261px] max-w-full align-middle", className)}>
            <input
                ref={fieldRef}
                aria-label="Datum und Uhrzeit"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-invalid={draft !== null && draft !== "" && parseDateTime(draft) === null}
                placeholder={FORMAT_HINT}
                value={draft ?? (value ? formatDateTime(value) : "")}
                className={cn(inputVariants(), "pr-9", open && "border-ui-primary")}
                onInput={(event) => {
                    const text = event.currentTarget.value;
                    setDraft(text);
                    const date = text.trim() === "" ? null : parseDateTime(text);
                    if (date || text.trim() === "") onChange(date);
                }}
                onBlur={() => setDraft(null)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                {...triggerProps}
            />
            {value ? (
                <ClearButton className="right-3.5" onClick={() => onChange(null)} />
            ) : (
                <CalendarIcon className="pointer-events-none absolute right-3 top-[10px] text-[16px] text-ui-text-secondary" />
            )}
            <Popover
                open={open}
                onClose={() => setOpen(false)}
                anchor={fieldRef}
                role="dialog"
                aria-label="Kalender"
                className="w-[264px] overflow-hidden rounded-[6px] bg-ui-surface shadow-ui"
            >
                <Calendar
                    value={value}
                    onChange={(date) => {
                        setDraft(null);
                        onChange(date);
                    }}
                />
                <div className="flex justify-end border-t border-ui-border p-2.5">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                            setOpen(false);
                            fieldRef.current?.focus();
                        }}
                    >
                        OK
                    </Button>
                </div>
            </Popover>
        </div>
    );
};
