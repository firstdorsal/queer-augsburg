import type { ComponentChildren } from "preact";
import { useId, useRef } from "preact/hooks";
import { cn } from "./cn";
import { Popover, usePopover } from "./popover";

interface ToggletipProps {
    readonly content: ComponentChildren;
    readonly "aria-label": string;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

/** A hint that opens on click, so it also works on touch screens. */
export const Toggletip = ({
    content,
    "aria-label": ariaLabel,
    className,
    children
}: ToggletipProps) => {
    const { open, setOpen, triggerProps } = usePopover();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const contentId = useId();
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-controls={contentId}
                className={cn("cursor-pointer", className)}
                {...triggerProps}
            >
                {children}
            </button>
            <Popover
                id={contentId}
                role="status"
                open={open}
                onClose={() => setOpen(false)}
                anchor={triggerRef}
                placement="topCenter"
                gap={8}
                className="max-w-[250px] overflow-visible break-words rounded bg-ui-tooltip px-2.5 py-0.5 text-xs leading-[1.66666667] text-white after:absolute after:left-[var(--anchor-x)] after:-ml-1.5 after:border-x-[6px] after:border-x-transparent after:content-[''] data-[side=bottom]:after:-top-1.5 data-[side=top]:after:-bottom-1.5 data-[side=bottom]:after:border-b-[6px] data-[side=top]:after:border-t-[6px] data-[side=bottom]:after:border-b-ui-tooltip data-[side=top]:after:border-t-ui-tooltip"
            >
                {content}
            </Popover>
        </>
    );
};
