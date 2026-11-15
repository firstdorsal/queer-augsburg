import type { ComponentChildren } from "preact";
import { useId, useRef } from "preact/hooks";
import { ClearButton } from "./clear-button";
import { cn } from "./cn";
import { ChevronDownIcon } from "./icons";
import { Spinner } from "./loader";
import {
    OptionList,
    PICKER_TEXTS,
    type SelectOption,
    openFieldClasses,
    pickerRootClasses,
    popupClasses
} from "./option-list";
import { Popover, type PopoverPlacement, usePopover } from "./popover";

const triggerClasses =
    "relative block w-full cursor-pointer select-none truncate rounded-[6px] border border-ui-border bg-ui-input text-left text-[14px] leading-5 text-ui-text transition-[border-color] duration-150 ease-in-out focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ui-focus-ring enabled:hover:border-ui-primary disabled:cursor-not-allowed disabled:bg-ui-input-disabled disabled:text-ui-text-disabled";

const triggerSizes = {
    sm: "py-1 pl-[9px] pr-[30px]",
    md: "py-[7px] pl-[11px] pr-[32px]"
};

/** Opens a closed picker the way a native select does. */
const openOnArrowKey = (setOpen: (open: boolean) => void) => (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
    }
};

interface PickerProps<Value extends string> {
    readonly data: readonly SelectOption<Value>[];
    readonly searchable?: boolean;
    readonly searchPlaceholder?: string;
    readonly noResultsText?: string;
    readonly onSearch?: (search: string) => void;
    readonly placeholder?: string;
    readonly placement?: PopoverPlacement;
    readonly block?: boolean;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly "aria-label"?: string;
}

interface SelectProps<Value extends string> extends PickerProps<Value> {
    readonly value: Value | null | undefined;
    readonly onChange: (value: Value) => void;
    readonly size?: keyof typeof triggerSizes;
    /** Prefix inside the field, like "Sortieren nach: Startdatum". */
    readonly label?: string;
    readonly loading?: boolean;
    /** Sits below the options, for an action next to the choice. */
    readonly footer?: ComponentChildren;
}

export const Select = <Value extends string>({
    data,
    value,
    onChange,
    searchable = true,
    searchPlaceholder,
    noResultsText,
    onSearch,
    placeholder = PICKER_TEXTS.placeholder,
    placement,
    block = false,
    disabled = false,
    size = "md",
    label,
    loading = false,
    footer,
    className,
    "aria-label": ariaLabel
}: SelectProps<Value>) => {
    const { open, setOpen, triggerProps } = usePopover();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listId = useId();
    const selected = data.find((option) => option.value === value);

    return (
        <div className={pickerRootClasses(block, className)}>
            <button
                ref={triggerRef}
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={ariaLabel}
                disabled={disabled}
                className={cn(triggerClasses, triggerSizes[size], open && openFieldClasses)}
                onKeyDown={openOnArrowKey(setOpen)}
                {...triggerProps}
            >
                {label && (
                    <span className="text-ui-text after:ml-0.5 after:mr-1 after:content-[':']">
                        {label}
                    </span>
                )}
                {selected ? (
                    <span className={cn(!disabled && "text-ui-picker-value")}>
                        {selected.label}
                    </span>
                ) : (
                    <span className="text-ui-text-secondary">{placeholder}</span>
                )}
                {loading ? (
                    <Spinner size="xs" className="absolute right-3 top-2" />
                ) : (
                    <ChevronDownIcon
                        className={cn(
                            "absolute text-[16px] text-ui-text-secondary",
                            size === "sm" ? "right-2 top-1.5" : "right-3 top-[9px]"
                        )}
                    />
                )}
            </button>
            <Popover
                open={open}
                onClose={() => setOpen(false)}
                anchor={triggerRef}
                placement={placement}
                matchWidth
                className={popupClasses}
            >
                <OptionList
                    id={listId}
                    options={data}
                    isSelected={(candidate) => candidate === value}
                    onPick={(picked) => {
                        setOpen(false);
                        triggerRef.current?.focus();
                        onChange(picked);
                    }}
                    searchable={searchable}
                    searchPlaceholder={searchPlaceholder}
                    noResultsText={noResultsText}
                    onSearch={onSearch}
                    multiple={false}
                    footer={footer}
                    onClose={() => setOpen(false)}
                />
            </Popover>
        </div>
    );
};

export interface MultiPickerProps<Value extends string> extends PickerProps<Value> {
    readonly value: readonly Value[];
    readonly onChange: (value: Value[]) => void;
}

export const toggled = <Value extends string>(values: readonly Value[], value: Value) =>
    values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];

/** Several values, shown as a comma list with a count. */
export const MultiSelect = <Value extends string>({
    data,
    value,
    onChange,
    searchable = true,
    searchPlaceholder,
    noResultsText,
    onSearch,
    placeholder = PICKER_TEXTS.placeholder,
    placement,
    block = false,
    disabled = false,
    className,
    "aria-label": ariaLabel
}: MultiPickerProps<Value>) => {
    const { open, setOpen, triggerProps } = usePopover();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listId = useId();
    const selected = data.filter((option) => value.includes(option.value));

    return (
        <div className={pickerRootClasses(block, className)}>
            <button
                ref={triggerRef}
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={ariaLabel}
                disabled={disabled}
                className={cn(
                    triggerClasses,
                    triggerSizes.md,
                    selected.length > 0 && "flex",
                    open && openFieldClasses
                )}
                onKeyDown={openOnArrowKey(setOpen)}
                {...triggerProps}
            >
                {selected.length > 0 ? (
                    <>
                        <span className="truncate text-ui-picker-value">
                            {selected.map((option) => option.label).join(", ")}
                        </span>
                        <span className="mx-1 rounded-[10px] bg-ui-picker-count px-2 leading-5 text-white">
                            {selected.length}
                        </span>
                    </>
                ) : (
                    <span className="text-ui-text-secondary">{placeholder}</span>
                )}
                {(selected.length === 0 || disabled) && (
                    <ChevronDownIcon className="absolute right-3 top-[9px] text-[16px] text-ui-text-secondary" />
                )}
            </button>
            {selected.length > 0 && !disabled && <ClearButton onClick={() => onChange([])} />}
            <Popover
                open={open}
                onClose={() => setOpen(false)}
                anchor={triggerRef}
                placement={placement}
                matchWidth
                className={popupClasses}
            >
                <OptionList
                    id={listId}
                    options={data}
                    isSelected={(candidate) => value.includes(candidate)}
                    onPick={(picked) => onChange(toggled(value, picked))}
                    searchable={searchable}
                    searchPlaceholder={searchPlaceholder}
                    noResultsText={noResultsText}
                    onSearch={onSearch}
                    multiple
                    onClose={() => setOpen(false)}
                />
            </Popover>
        </div>
    );
};
