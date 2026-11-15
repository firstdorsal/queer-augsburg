import type { ComponentChildren, JSX } from "preact";
import { createContext } from "preact";
import { createPortal } from "preact/compat";
import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";
import { cn } from "./cn";
import { CloseIcon } from "./icons";
import { refreshToasts } from "./toaster";

const dialogSizes = {
    sm: "w-[600px]",
    md: "w-[800px]",
    lg: "w-[968px]"
};

interface DialogContextValue {
    readonly onClose?: () => void;
    readonly titleId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface DialogProps {
    readonly open: boolean;
    readonly onClose?: () => void;
    readonly size?: keyof typeof dialogSizes;
    /** `true` closes on a click outside of the box, `"static"` keeps the dialog open. */
    readonly backdrop?: true | "static";
    /** Whether Esc closes the dialog. */
    readonly keyboard?: boolean;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

/**
 * A modal on the native `<dialog>`: top layer, focus trap and inert background come from the
 * browser. The element fills the screen and scrolls, the visible box sits inside of it.
 */
export const Dialog = ({
    open,
    onClose,
    size = "sm",
    backdrop = true,
    keyboard = true,
    className,
    children
}: DialogProps) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const stayOpen = useRef(open);
    const pressedOutside = useRef(false);
    const titleId = useId();

    useLayoutEffect(() => {
        stayOpen.current = open;
        const dialog = dialogRef.current;
        if (!open || !dialog) return;
        const opener = document.activeElement;
        dialog.showModal();
        refreshToasts();
        return () => {
            stayOpen.current = false;
            dialog.close();
            refreshToasts();
            // The element is often already gone here, so the browser cannot do this itself.
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-auto overscroll-contain border-0 bg-transparent p-0 text-inherit backdrop:bg-[var(--ui-backdrop)]"
            onCancel={(event) => {
                event.preventDefault();
                if (keyboard) onClose?.();
            }}
            // The browser ignores preventDefault on a repeated Esc and closes anyway.
            onClose={(event) => {
                const dialog = event.currentTarget;
                if (stayOpen.current && dialog.isConnected) dialog.showModal();
            }}
            onPointerDown={(event) => {
                pressedOutside.current = event.target === event.currentTarget;
            }}
            // A drag that starts in a field and ends outside also clicks the dialog itself.
            onClick={(event) => {
                const outside = event.target === event.currentTarget && pressedOutside.current;
                if (outside && backdrop === true) onClose?.();
            }}
        >
            <div
                // Keeps the browser from focusing, and outlining, the first field on opening.
                tabIndex={-1}
                autofocus
                className={cn(
                    "relative mx-auto mt-[30px] flex max-h-[calc(100dvh-92px)] max-w-[calc(100%-10px)] flex-col rounded-[6px] bg-ui-surface p-5 shadow-ui outline-0 motion-safe:duration-300 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-4",
                    dialogSizes[size],
                    className
                )}
            >
                <DialogContext.Provider value={{ onClose, titleId }}>
                    {children}
                </DialogContext.Provider>
            </div>
        </dialog>,
        document.body
    );
};

interface DialogHeaderProps {
    readonly closeButton?: boolean;
    readonly children?: ComponentChildren;
}

export const DialogHeader = ({ closeButton = true, children }: DialogHeaderProps) => {
    const onClose = useContext(DialogContext)?.onClose;
    return (
        <div className="flex-none pr-5">
            {closeButton && onClose && (
                <button
                    type="button"
                    aria-label="Schließen"
                    className="absolute right-5 top-5 p-0 text-xs text-ui-text-secondary hover:text-ui-text"
                    onClick={onClose}
                >
                    <CloseIcon />
                </button>
            )}
            {children}
        </div>
    );
};

interface DialogPartProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "className"> {
    readonly className?: string;
}

export const DialogTitle = ({ className, children, ...props }: DialogPartProps) => (
    <h4
        id={useContext(DialogContext)?.titleId}
        className={cn(
            "m-0 block w-full truncate text-[18px] font-normal leading-[1.11111111] text-ui-text-heading",
            className
        )}
        {...props}
    >
        {children}
    </h4>
);

export const DialogBody = ({ className, children, ...props }: DialogPartProps) => (
    <div className={cn("relative mt-5 min-h-0 flex-auto overflow-auto pb-5", className)} {...props}>
        {children}
    </div>
);

export const DialogFooter = ({ className, children, ...props }: DialogPartProps) => (
    <div
        className={cn("flex-none text-right [&>:is(a,button)+:is(a,button)]:ml-2.5", className)}
        {...props}
    >
        {children}
    </div>
);
