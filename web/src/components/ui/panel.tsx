import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { cn } from "./cn";
import { ChevronDownIcon } from "./icons";

interface PanelProps {
    readonly header?: ComponentChildren;
    /** Sits in a collapsible header, beside the button that toggles it. */
    readonly headerAction?: ComponentChildren;
    readonly bordered?: boolean;
    readonly collapsible?: boolean;
    readonly defaultExpanded?: boolean;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const Panel = ({
    header,
    headerAction,
    bordered = false,
    collapsible = false,
    defaultExpanded = false,
    className,
    children
}: PanelProps) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const showBody = !collapsible || expanded;

    return (
        <div
            className={cn(
                "overflow-hidden rounded-[6px]",
                bordered && "border border-ui-border",
                className
            )}
        >
            {header && !collapsible && (
                <div className="p-5 font-[inherit] text-[16px] leading-[1.25] text-ui-text-heading">
                    {header}
                </div>
            )}
            {header && collapsible && (
                <div className="relative p-2.5 text-[16px] leading-[1.25] text-ui-text-heading">
                    <button
                        type="button"
                        aria-expanded={expanded}
                        className={cn(
                            "flex w-full items-center rounded-[6px] p-2.5 text-[16px] hover:bg-ui-btn-subtle-hover hover:text-ui-btn-subtle-hover-text focus:bg-ui-btn-subtle-hover focus:text-ui-btn-subtle-hover-text",
                            headerAction && "min-h-[50px]"
                        )}
                        onClick={() => setExpanded(!expanded)}
                    >
                        <span className="m-0 flex-[1_1_0%] text-left">{header}</span>
                        <ChevronDownIcon
                            className={cn(
                                "transition-transform duration-200",
                                expanded && "rotate-180"
                            )}
                        />
                    </button>
                    {headerAction && (
                        <div className="absolute right-[36px] top-1/2 -translate-y-1/2">
                            {headerAction}
                        </div>
                    )}
                </div>
            )}
            <div hidden={!showBody} className={cn("p-5", header && "pt-0")}>
                {children}
            </div>
        </div>
    );
};
