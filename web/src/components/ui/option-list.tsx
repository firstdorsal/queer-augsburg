import type { ComponentChildren } from "preact";
import {
    type MutableRef,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "preact/hooks";
import { cn } from "./cn";
import { SearchIcon } from "./icons";

export interface SelectOption<Value extends string = string> {
    readonly label: string;
    readonly value: Value;
}

export const PICKER_TEXTS = {
    placeholder: "Auswählen",
    search: "Suchen",
    noResults: "Keine Treffer"
};

export const popupClasses =
    "overflow-hidden rounded-[6px] bg-ui-surface text-left text-inherit shadow-ui motion-safe:[animation-duration:150ms] motion-safe:animate-in motion-safe:fade-in-0";

export const openFieldClasses = "border-ui-primary shadow-[0_0_0_3px_var(--ui-focus-ring)]";

export const pickerRootClasses = (block: boolean, className?: string) =>
    cn(block ? "block" : "inline-block max-w-full align-middle", "relative", className);

interface OptionListProps<Value extends string> {
    readonly id: string;
    readonly options: readonly SelectOption<Value>[];
    readonly isSelected: (value: Value) => boolean;
    readonly onPick: (value: Value) => void;
    readonly searchable: boolean;
    readonly searchPlaceholder?: string;
    readonly noResultsText?: string;
    readonly onSearch?: (search: string) => void;
    readonly multiple: boolean;
    readonly footer?: ComponentChildren;
    readonly onClose: () => void;
    /** Search text typed outside of the popup, in the field itself. */
    readonly externalSearch?: string;
    /** Lets that outside field hand its arrow keys and Enter to the list. */
    readonly keyHandler?: MutableRef<((event: KeyboardEvent) => void) | null>;
    readonly onActiveOptionChange?: (optionId: string | undefined) => void;
}

/** Search box and options of a popup; arrow keys move, Enter picks. */
export const OptionList = <Value extends string>({
    id,
    options,
    isSelected,
    onPick,
    searchable,
    searchPlaceholder = PICKER_TEXTS.search,
    noResultsText = PICKER_TEXTS.noResults,
    onSearch,
    multiple,
    footer,
    onClose,
    externalSearch,
    keyHandler,
    onActiveOptionChange
}: OptionListProps<Value>) => {
    const [ownSearch, setOwnSearch] = useState("");
    const search = externalSearch ?? ownSearch;
    const [activeIndex, setActiveIndex] = useState(() =>
        options.findIndex((option) => isSelected(option.value))
    );
    const listRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    // Scrolling on hover would move the option under the pointer and start the next hover.
    const followActive = useRef(true);
    const shownSearch = useRef(search);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return options.filter((option) => option.label.toLowerCase().includes(needle));
    }, [options, search]);

    const activeOptionId = activeIndex >= 0 ? `${id}-${activeIndex}` : undefined;

    useEffect(() => {
        if (searchable) searchRef.current?.focus();
        else if (!keyHandler) listRef.current?.focus();
    }, [searchable, keyHandler]);

    useEffect(() => {
        if (shownSearch.current === search) return;
        shownSearch.current = search;
        setActiveIndex(search.trim() === "" ? -1 : 0);
    }, [search]);

    useEffect(() => {
        onActiveOptionChange?.(activeOptionId);
        if (!followActive.current) return;
        listRef.current
            ?.querySelector(`[data-index="${activeIndex}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, activeOptionId, onActiveOptionChange]);

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            followActive.current = true;
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((index) => Math.min(Math.max(index + step, 0), visible.length - 1));
        } else if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            const option = visible[activeIndex];
            if (option) onPick(option.value);
        }
    };

    useLayoutEffect(() => {
        if (!keyHandler) return;
        keyHandler.current = onKeyDown;
        return () => {
            keyHandler.current = null;
        };
    });

    return (
        <div
            className="pb-1.5"
            onFocusOut={(event) => {
                const next = event.relatedTarget as Node | null;
                if (next && !event.currentTarget.contains(next)) onClose();
            }}
        >
            <div onKeyDown={onKeyDown}>
                {searchable && (
                    <div className="relative px-3 pt-3">
                        <input
                            ref={searchRef}
                            value={ownSearch}
                            aria-label={searchPlaceholder}
                            aria-controls={id}
                            aria-activedescendant={activeOptionId}
                            placeholder={searchPlaceholder}
                            className="block w-full rounded-[6px] border border-ui-border bg-ui-input py-[7px] pl-[11px] pr-8 text-[14px] leading-[1.42857143] text-ui-text outline-none placeholder:text-ui-text-secondary placeholder:opacity-30 hover:border-ui-primary"
                            onInput={(event) => {
                                const value = event.currentTarget.value;
                                setOwnSearch(value);
                                onSearch?.(value);
                            }}
                        />
                        <SearchIcon className="absolute right-6 top-[23px] text-[14px] text-ui-text-secondary" />
                    </div>
                )}
                <div
                    ref={listRef}
                    id={id}
                    role="listbox"
                    aria-multiselectable={multiple}
                    aria-activedescendant={activeOptionId}
                    tabIndex={-1}
                    className="mt-1.5 max-h-[320px] overflow-y-auto"
                >
                    {visible.length === 0 && (
                        <div className="cursor-default px-3 pb-3 pt-1.5 text-ui-text-secondary">
                            {noResultsText}
                        </div>
                    )}
                    {visible.map((option, index) => {
                        const selected = isSelected(option.value);
                        return (
                            <div
                                key={option.value}
                                id={`${id}-${index}`}
                                role="option"
                                aria-selected={selected}
                                data-index={index}
                                className={cn(
                                    "relative block w-full cursor-pointer px-3 py-2 leading-[1.42857143] hover:bg-ui-option-hover hover:text-ui-option-hover-text",
                                    index === activeIndex &&
                                        "bg-ui-option-hover text-ui-option-hover-text",
                                    multiple ? "pl-[38px] leading-5" : "text-ui-text",
                                    selected && "font-bold",
                                    selected &&
                                        !multiple &&
                                        "bg-ui-option-selected text-ui-option-selected-text"
                                )}
                                onMouseEnter={() => {
                                    followActive.current = false;
                                    setActiveIndex(index);
                                }}
                                onClick={() => onPick(option.value)}
                            >
                                {multiple && (
                                    <span
                                        className={cn(
                                            "absolute left-3 top-2.5 flex size-4 items-center justify-center rounded-[3px] border border-ui-check-border text-[12px] text-ui-check-mark",
                                            selected &&
                                                "border-ui-check-checked bg-ui-check-checked"
                                        )}
                                    >
                                        {selected && (
                                            <span className="absolute left-[4.5px] top-[0.5px] h-[9.5px] w-[5.5px] rotate-45 border-b-2 border-r-2 border-ui-check-mark" />
                                        )}
                                    </span>
                                )}
                                {option.label}
                            </div>
                        );
                    })}
                </div>
            </div>
            {footer}
        </div>
    );
};
