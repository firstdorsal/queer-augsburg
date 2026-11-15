import { useEffect, useId, useRef, useState } from "preact/hooks";
import { ClearButton } from "./clear-button";
import { cn } from "./cn";
import { ChevronDownIcon, CloseIcon } from "./icons";
import {
    OptionList,
    PICKER_TEXTS,
    openFieldClasses,
    pickerRootClasses,
    popupClasses
} from "./option-list";
import { Popover, usePopover } from "./popover";
import { type MultiPickerProps, toggled } from "./select";

const tagFieldClasses =
    "relative block min-h-[36px] w-full cursor-text rounded-[6px] border border-ui-border bg-ui-input pr-[32px] text-left text-[14px] leading-5 text-ui-text transition-[border-color] duration-150 ease-in-out hover:border-ui-primary";

const tagInputClasses =
    "ml-[11px] mt-[7px] inline-block h-[18px] w-auto min-w-[14px] bg-transparent p-0 outline-none";

interface TagProps {
    readonly label: string;
    readonly onRemove: () => void;
}

const Tag = ({ label, onRemove }: TagProps) => (
    <span className="relative ml-[5px] mt-[5px] inline-block max-w-[calc(100%-6px)] truncate rounded-[6px] bg-ui-tag py-0.5 pl-2 pr-[25px] align-top text-xs leading-5 text-ui-text">
        {label}
        <button
            type="button"
            aria-label={`${label} entfernen`}
            className="absolute right-0 top-0 px-2 py-1.5 text-xs text-ui-text-secondary hover:text-ui-text"
            onClick={(event) => {
                event.stopPropagation();
                onRemove();
            }}
        >
            <CloseIcon />
        </button>
    </span>
);

type TagSelectProps<Value extends string> = Omit<
    MultiPickerProps<Value>,
    "searchable" | "searchPlaceholder" | "onSearch" | "disabled"
>;

/** Several values from a list, shown as removable tags; typing in the field filters the list. */
export const TagSelect = <Value extends string>({
    data,
    value,
    onChange,
    noResultsText,
    placeholder = PICKER_TEXTS.placeholder,
    placement,
    block = false,
    className,
    "aria-label": ariaLabel
}: TagSelectProps<Value>) => {
    const { open, setOpen, triggerProps } = usePopover();
    const [search, setSearch] = useState("");
    const [activeOptionId, setActiveOptionId] = useState<string>();
    const fieldRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const keyHandler = useRef<((event: KeyboardEvent) => void) | null>(null);
    const listId = useId();

    useEffect(() => {
        if (open) inputRef.current?.focus();
        else setSearch("");
    }, [open]);

    return (
        <div className={pickerRootClasses(block, className)}>
            <div
                ref={fieldRef}
                className={cn(
                    tagFieldClasses,
                    value.length > 0 && "pb-[5px]",
                    open && openFieldClasses
                )}
                {...triggerProps}
            >
                {value.length === 0 && search === "" && (
                    <span className="pointer-events-none absolute left-[11px] top-[7px] text-ui-text-secondary">
                        {placeholder}
                    </span>
                )}
                {value.map((tag) => (
                    <Tag
                        key={tag}
                        label={data.find((option) => option.value === tag)?.label ?? tag}
                        onRemove={() => onChange(value.filter((candidate) => candidate !== tag))}
                    />
                ))}
                <input
                    ref={inputRef}
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-activedescendant={open ? activeOptionId : undefined}
                    aria-label={ariaLabel}
                    value={search}
                    size={search.length + 1}
                    className={tagInputClasses}
                    onInput={(event) => {
                        setSearch(event.currentTarget.value);
                        setOpen(true);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Backspace" && search === "" && value.length > 0) {
                            onChange(value.slice(0, -1));
                        } else if (event.key === "Tab") {
                            setOpen(false);
                        } else if (open) {
                            keyHandler.current?.(event);
                        } else if (event.key === "Enter" || event.key === "ArrowDown") {
                            event.preventDefault();
                            setOpen(true);
                        }
                    }}
                />
                {value.length === 0 && (
                    <ChevronDownIcon className="absolute right-3 top-[9px] text-[16px] text-ui-text-secondary" />
                )}
            </div>
            {value.length > 0 && <ClearButton onClick={() => onChange([])} />}
            <Popover
                open={open}
                onClose={() => setOpen(false)}
                anchor={fieldRef}
                placement={placement}
                matchWidth
                className={popupClasses}
            >
                <OptionList
                    id={listId}
                    options={data}
                    isSelected={(candidate) => value.includes(candidate)}
                    onPick={(picked) => {
                        onChange(toggled(value, picked));
                        setSearch("");
                        inputRef.current?.focus();
                    }}
                    searchable={false}
                    noResultsText={noResultsText}
                    multiple
                    onClose={() => setOpen(false)}
                    externalSearch={search}
                    keyHandler={keyHandler}
                    onActiveOptionChange={setActiveOptionId}
                />
            </Popover>
        </div>
    );
};

interface TagInputProps {
    readonly value: readonly string[];
    readonly onChange: (value: string[]) => void;
    readonly block?: boolean;
    readonly className?: string;
    readonly "aria-label"?: string;
}

/** Free text tags: Enter adds, Backspace on an empty field removes. */
export const TagInput = ({
    value,
    onChange,
    block = false,
    className,
    "aria-label": ariaLabel
}: TagInputProps) => {
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const commit = () => {
        const tag = draft.trim();
        setDraft("");
        if (tag && !value.includes(tag)) onChange([...value, tag]);
    };

    return (
        <div className={pickerRootClasses(block, className)}>
            <div
                className={cn(
                    tagFieldClasses,
                    "pb-[5px] pr-0 focus-within:border-ui-primary focus-within:outline focus-within:outline-[3px] focus-within:outline-ui-focus-ring"
                )}
                onClick={() => inputRef.current?.focus()}
            >
                {value.map((tag) => (
                    <Tag
                        key={tag}
                        label={tag}
                        onRemove={() => onChange(value.filter((candidate) => candidate !== tag))}
                    />
                ))}
                <input
                    ref={inputRef}
                    value={draft}
                    aria-label={ariaLabel}
                    size={draft.length + 1}
                    className={tagInputClasses}
                    onInput={(event) => setDraft(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.isComposing) {
                            event.preventDefault();
                            commit();
                        } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
                            onChange(value.slice(0, -1));
                        }
                    }}
                />
            </div>
        </div>
    );
};
