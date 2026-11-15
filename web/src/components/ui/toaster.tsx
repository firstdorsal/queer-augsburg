import { type ComponentChild, type VNode, cloneElement, render } from "preact";
import { isValidElement } from "preact/compat";
import { cn } from "./cn";
import { supportsPopover } from "./popover";

type ToastPlacement = "topCenter" | "bottomCenter" | "bottomEnd";

export interface ToastOptions {
    readonly placement?: ToastPlacement;
    /** Milliseconds until the toast closes on its own; 0 keeps it open. */
    readonly duration?: number;
}

interface Toast {
    readonly id: number;
    readonly content: ComponentChild;
    readonly placement: ToastPlacement;
    readonly duration: number;
    readonly createdAt: number;
}

const ENTER_ANIMATION_MS = 300;
const DEFAULT_DURATION = 2000;

const placementClasses: Record<ToastPlacement, string> = {
    topCenter: "left-1/2 top-6 -translate-x-1/2 items-center",
    bottomCenter: "bottom-6 left-1/2 -translate-x-1/2 items-center",
    bottomEnd: "bottom-6 right-6 items-end"
};

let nextToastId = 1;
let toasts: readonly Toast[] = [];
let host: HTMLElement | null = null;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const stopTimer = (id: number) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
};

const startTimer = ({ id, duration }: Toast) => {
    if (duration > 0)
        timers.set(
            id,
            setTimeout(() => remove(id), duration)
        );
};

const remove = (id: number) => {
    stopTimer(id);
    toasts = toasts.filter((toast) => toast.id !== id);
    renderToasts();
};

/** A manual popover sits in the top layer, so toasts stay visible above open dialogs. */
const show = (element: HTMLElement) => {
    if (supportsPopover && !element.matches(":popover-open")) element.showPopover();
};

/**
 * A modal dialog makes everything outside of it inert, and a click on an inert toast would land on
 * the dialog behind it. So toasts live in the topmost open dialog.
 */
const placeHost = (element: HTMLElement) => {
    const dialogs = document.querySelectorAll("dialog[open]");
    const parent = dialogs[dialogs.length - 1] ?? document.body;
    if (element.parentElement !== parent) parent.appendChild(element);
};

const renderToasts = () => {
    host ??= document.createElement("div");
    placeHost(host);
    render(
        <>
            {(Object.keys(placementClasses) as ToastPlacement[]).map((placement) => {
                const visible = toasts.filter((toast) => toast.placement === placement);
                if (visible.length === 0) return null;
                return (
                    <div
                        key={placement}
                        popover={supportsPopover ? "manual" : undefined}
                        ref={(element) => {
                            if (element) show(element);
                        }}
                        className={cn(
                            "fixed inset-auto z-[1200] m-0 flex w-max max-w-[100vw] flex-col gap-2.5 overflow-visible border-0 bg-transparent p-0",
                            placementClasses[placement]
                        )}
                    >
                        {visible.map((toast) => (
                            <div
                                key={toast.id}
                                className={cn(
                                    "shadow-ui",
                                    // Moving a toast into a dialog must not replay its entry.
                                    Date.now() - toast.createdAt < ENTER_ANIMATION_MS &&
                                        "motion-safe:duration-300 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
                                )}
                                // Reading a toast keeps it open; leaving it starts the time anew.
                                onMouseEnter={() => stopTimer(toast.id)}
                                onMouseLeave={() => startTimer(toast)}
                            >
                                {toast.content}
                            </div>
                        ))}
                    </div>
                );
            })}
        </>,
        host
    );
};

const push = (content: ComponentChild, options: ToastOptions = {}) => {
    const id = nextToastId++;
    const contentWithClose = isValidElement(content)
        ? cloneElement(content as VNode<{ onClose?: () => void }>, { onClose: () => remove(id) })
        : content;
    const toast: Toast = {
        id,
        content: contentWithClose,
        placement: options.placement ?? "topCenter",
        duration: options.duration ?? DEFAULT_DURATION,
        createdAt: Date.now()
    };
    toasts = [...toasts, toast];
    renderToasts();
    startTimer(toast);
    return id;
};

/** Shows a toast. A `Message` gets an `onClose` injected, so its close button removes the toast. */
export const toaster = { push, remove };

/** Called by dialogs when they open or close, because the toasts have to follow them. */
export const refreshToasts = () => {
    if (toasts.length > 0) renderToasts();
};
