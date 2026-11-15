import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useId } from "preact/hooks";
import { cn } from "./cn";

const checkClasses =
    "peer absolute left-2.5 top-2.5 m-0 size-4 cursor-pointer appearance-none rounded-[3px] border border-ui-check-border bg-transparent transition-colors duration-200 ease-linear hover:border-ui-check-checked checked:border-ui-check-checked checked:bg-ui-check-checked focus-visible:shadow-[0_0_0_3px_var(--ui-focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:border-ui-check-disabled disabled:bg-ui-check-disabled";

interface CheckboxGroupContextValue {
    readonly value: readonly string[];
    readonly onChange: (value: string[]) => void;
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

interface CheckboxProps {
    readonly checked?: boolean;
    readonly onCheckedChange?: (checked: boolean) => void;
    /** Identifies the box inside a CheckboxGroup. */
    readonly value?: string;
    readonly name?: string;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const Checkbox = ({
    checked,
    onCheckedChange,
    value,
    name,
    disabled = false,
    className,
    children
}: CheckboxProps) => {
    const group = useContext(CheckboxGroupContext);
    const isChecked =
        group && value !== undefined ? group.value.includes(value) : (checked ?? false);

    return (
        <div className={cn("relative inline-block align-middle", group && "-ml-2.5", className)}>
            <label
                className={cn(
                    "relative block min-h-[36px] cursor-pointer py-2.5 pl-9 font-normal leading-[1.14285714]",
                    disabled && "cursor-not-allowed text-ui-text-disabled"
                )}
            >
                <input
                    type="checkbox"
                    name={name}
                    value={value}
                    checked={isChecked}
                    disabled={disabled}
                    className={checkClasses}
                    onChange={(event) => {
                        const next = event.currentTarget.checked;
                        onCheckedChange?.(next);
                        if (group && value !== undefined) {
                            group.onChange(
                                next
                                    ? [...group.value, value]
                                    : group.value.filter((candidate) => candidate !== value)
                            );
                        }
                    }}
                />
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[15.5px] top-[11.5px] hidden h-[9.5px] w-[5.5px] rotate-45 border-b-2 border-r-2 border-ui-check-mark peer-checked:block"
                />
                {children}
            </label>
        </div>
    );
};

interface CheckboxGroupProps extends CheckboxGroupContextValue {
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const CheckboxGroup = ({ value, onChange, className, children }: CheckboxGroupProps) => (
    <CheckboxGroupContext.Provider value={{ value, onChange }}>
        <div role="group" className={cn("flex flex-col", className)}>
            {children}
        </div>
    </CheckboxGroupContext.Provider>
);

interface RadioGroupContextValue {
    readonly name: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly tabs: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps {
    readonly name?: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly inline?: boolean;
    /** A row of underlined labels instead of radio circles. */
    readonly tabs?: boolean;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const RadioGroup = ({
    name,
    value,
    onChange,
    inline = false,
    tabs = false,
    className,
    children
}: RadioGroupProps) => {
    // Radios only move with the arrow keys when they share a name.
    const generatedName = useId();
    return (
        <RadioGroupContext.Provider value={{ name: name ?? generatedName, value, onChange, tabs }}>
            <div
                role="radiogroup"
                className={cn(
                    inline ? "flex-row" : "flex-col",
                    tabs
                        ? "inline-flex rounded-[6px] border border-ui-border text-ui-text"
                        : "flex",
                    className
                )}
            >
                {children}
            </div>
        </RadioGroupContext.Provider>
    );
};

interface RadioProps {
    readonly value: string;
    readonly children?: ComponentChildren;
}

export const Radio = ({ value, children }: RadioProps) => {
    const group = useContext(RadioGroupContext);
    if (!group) throw new Error("Radio needs a RadioGroup");
    const checked = group.value === value;

    if (group.tabs) {
        return (
            <div className="relative inline-block px-2.5 align-middle first:pl-3 last:pr-3">
                <label
                    className={cn(
                        "inline-block cursor-pointer whitespace-nowrap border-b-2 border-transparent pb-[5px] pt-[7px] text-[14px] leading-[1.42857143] text-ui-text-secondary transition-colors duration-300 ease-linear hover:text-ui-text-active has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-ui-focus-ring",
                        checked && "border-ui-text-active text-ui-text-active"
                    )}
                >
                    <input
                        type="radio"
                        name={group.name}
                        value={value}
                        checked={checked}
                        className="absolute size-0 opacity-0"
                        onChange={() => group.onChange(value)}
                    />
                    {children}
                </label>
            </div>
        );
    }

    return (
        <div className="relative -ml-2.5 mr-2.5 inline-block align-middle">
            <label className="relative block min-h-[36px] cursor-pointer py-2.5 pl-9 font-normal leading-[1.14285714]">
                <input
                    type="radio"
                    name={group.name}
                    value={value}
                    checked={checked}
                    className="peer absolute left-2.5 top-2.5 m-0 size-4 cursor-pointer appearance-none rounded-full border border-ui-check-border bg-transparent transition-colors duration-200 ease-linear checked:border-ui-check-checked checked:bg-ui-check-checked hover:border-ui-check-checked focus-visible:shadow-[0_0_0_3px_var(--ui-focus-ring)] focus-visible:outline-none"
                    onChange={() => group.onChange(value)}
                />
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[15px] top-[15px] hidden size-1.5 rounded-full bg-ui-check-mark peer-checked:block"
                />
                {children}
            </label>
        </div>
    );
};

interface SwitchProps {
    readonly checked: boolean;
    readonly onCheckedChange: (checked: boolean) => void;
    readonly "aria-label"?: string;
}

export const Switch = ({ checked, onCheckedChange, "aria-label": ariaLabel }: SwitchProps) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className={cn(
            "relative inline-block h-6 min-w-[44px] rounded-xl align-middle transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ui-focus-ring",
            checked
                ? "bg-ui-switch-checked hover:bg-ui-switch-checked-hover"
                : "bg-ui-switch hover:bg-ui-switch-hover"
        )}
        onClick={() => onCheckedChange(!checked)}
    >
        <span
            className={cn(
                "absolute top-[3px] size-[18px] rounded-[9px] bg-white transition-[left] duration-150 ease-out",
                checked ? "left-[23px]" : "left-[3px]"
            )}
        />
    </button>
);
