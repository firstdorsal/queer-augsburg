import type { ComponentChildren, JSX, RefObject } from "preact";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { cn } from "./cn";

export type PopoverPlacement = "bottomStart" | "bottomEnd" | "topCenter";

const SCREEN_MARGIN = 4;

/** Safari before 17 and Firefox before 125 have no Popover API, so a fixed box stands in. */
export const supportsPopover =
    typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

const place = (
    popover: HTMLElement,
    anchor: HTMLElement,
    placement: PopoverPlacement,
    matchWidth: boolean,
    gap: number
) => {
    const anchorBox = anchor.getBoundingClientRect();
    if (matchWidth) popover.style.minWidth = `${anchorBox.width}px`;
    const { width, height } = popover.getBoundingClientRect();
    const room = {
        above: anchorBox.top - SCREEN_MARGIN,
        below: window.innerHeight - anchorBox.bottom - SCREEN_MARGIN
    };
    const opensUp =
        placement === "topCenter"
            ? room.above >= height
            : room.below < height && room.above > room.below;
    const left =
        placement === "bottomEnd"
            ? anchorBox.right - width
            : placement === "topCenter"
              ? anchorBox.left + (anchorBox.width - width) / 2
              : anchorBox.left;
    const maxLeft = window.innerWidth - width - SCREEN_MARGIN;
    const shownLeft = Math.max(SCREEN_MARGIN, Math.min(left, maxLeft));
    popover.style.left = `${shownLeft}px`;
    popover.style.top = `${opensUp ? anchorBox.top - height - gap : anchorBox.bottom + gap}px`;
    popover.dataset.side = opensUp ? "top" : "bottom";
    // Keeps an arrow on the anchor when the screen edge pushes the box aside.
    popover.style.setProperty(
        "--anchor-x",
        `${anchorBox.left + anchorBox.width / 2 - shownLeft}px`
    );
};

/**
 * Open state of a popover. Light dismiss closes it before the click on its trigger arrives, so
 * the trigger remembers on pointer down whether that click has to stay a close. Keyboard clicks
 * have no pointer down and report `detail` 0.
 */
export const usePopover = () => {
    const [open, setOpen] = useState(false);
    const openOnPress = useRef(false);
    return {
        open,
        setOpen,
        triggerProps: {
            onPointerDown: () => {
                openOnPress.current = open;
            },
            onClick: (event: MouseEvent) => {
                setOpen(event.detail === 0 ? !open : !openOnPress.current);
            }
        }
    };
};

interface PopoverProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref" | "className"> {
    readonly open: boolean;
    readonly onClose: () => void;
    readonly anchor: RefObject<HTMLElement>;
    readonly placement?: PopoverPlacement;
    /** At least as wide as the anchor. */
    readonly matchWidth?: boolean;
    /** Distance to the anchor in pixels. */
    readonly gap?: number;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

/**
 * The HTML Popover API: top layer above dialogs, Esc and light dismiss come from the browser.
 * Rendered in place, because a modal dialog makes everything outside of it inert. No display
 * utilities on it, they would override the browser's `display: none` of a closed popover.
 */
export const Popover = ({
    open,
    onClose,
    anchor,
    placement = "bottomStart",
    matchWidth = false,
    gap = 0,
    className,
    children,
    ...props
}: PopoverProps) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    const reposition = useCallback(() => {
        if (popoverRef.current && anchor.current) {
            place(popoverRef.current, anchor.current, placement, matchWidth, gap);
        }
    }, [anchor, placement, matchWidth, gap]);

    useLayoutEffect(() => {
        const popover = popoverRef.current;
        if (!popover || !supportsPopover) return;
        const shown = popover.matches(":popover-open");
        if (open && !shown) popover.showPopover();
        if (!open && shown) popover.hidePopover();
    }, [open]);

    useLayoutEffect(() => {
        const popover = popoverRef.current;
        if (!open || !popover) return;
        reposition();
        const onScroll = (event: Event) => {
            if (!popover.contains(event.target as Node)) reposition();
        };
        const sizeObserver = new ResizeObserver(reposition);
        sizeObserver.observe(popover);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            sizeObserver.disconnect();
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [open, reposition]);

    useEffect(() => {
        if (!open || supportsPopover) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            const inside = popoverRef.current?.contains(target) || anchor.current?.contains(target);
            if (!inside) onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open, onClose, anchor]);

    return (
        <div
            {...props}
            ref={popoverRef}
            popover={supportsPopover ? "auto" : undefined}
            hidden={!supportsPopover && !open}
            className={cn(
                "fixed m-0 border-0 p-0 text-inherit",
                !supportsPopover && "z-[1100]",
                className
            )}
            onToggle={(event) => {
                if (!event.currentTarget.matches(":popover-open")) onClose();
            }}
        >
            {open && children}
        </div>
    );
};
