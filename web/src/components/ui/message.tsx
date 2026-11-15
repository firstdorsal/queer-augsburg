import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentChildren, JSX } from "preact";
import { useState } from "preact/hooks";
import { cn } from "./cn";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "./icons";

const containerVariants = cva("flex py-5 pl-5 pr-7", {
    variants: {
        type: {
            info: "bg-ui-message-info",
            success: "bg-ui-message-success",
            warning: "bg-ui-message-warning",
            error: "bg-ui-message-error"
        }
    }
});

const iconColors = {
    info: "text-ui-message-info-icon",
    success: "text-ui-message-success-icon",
    warning: "text-ui-message-warning-icon",
    error: "text-ui-message-error-icon"
};

const icons = { info: InfoIcon, success: SuccessIcon, warning: WarningIcon, error: ErrorIcon };

interface MessageProps extends VariantProps<typeof containerVariants> {
    readonly showIcon?: boolean;
    readonly closable?: boolean;
    readonly onClose?: () => void;
    readonly header?: ComponentChildren;
    readonly className?: string;
    readonly style?: JSX.CSSProperties;
    readonly children?: ComponentChildren;
}

export const Message = ({
    type,
    showIcon = false,
    closable = false,
    onClose,
    header,
    className,
    style,
    children
}: MessageProps) => {
    const [closed, setClosed] = useState(false);
    const status = type ?? "info";
    const Icon = icons[status];
    const text = status === "warning" ? "text-ui-message-warning-text" : "text-ui-message-text";

    if (closed) return null;

    return (
        <div
            // Status texts sit on pages from the start; only trouble may interrupt a screen reader.
            role={status === "error" || status === "warning" ? "alert" : "status"}
            className={cn(
                "relative overflow-hidden rounded-[6px] bg-ui-message-base text-[14px] leading-[1.42857143] [&+&]:mt-2.5",
                className
            )}
            style={style}
        >
            <div className={containerVariants({ type: status })}>
                {showIcon && (
                    <div className={cn("mr-2.5 text-[0px]", header ? "self-start" : "self-center")}>
                        <Icon
                            className={cn(
                                iconColors[status],
                                header ? "text-[24px]" : "text-[16px]"
                            )}
                        />
                    </div>
                )}
                <div className="flex-grow">
                    {header && (
                        <div
                            className={cn(
                                "w-full truncate font-bold leading-[1.71428571]",
                                status === "warning"
                                    ? "text-ui-message-warning-text"
                                    : "text-ui-message-heading"
                            )}
                        >
                            {header}
                        </div>
                    )}
                    <div
                        className={cn(
                            text,
                            header && "mt-1",
                            "[&_:is(ol,ul)]:m-0 [&_:is(ol,ul)]:p-0 [&_:is(ol,ul)]:[padding-inline-start:16px]",
                            "dark:[&_a]:text-inherit dark:[&_a]:underline"
                        )}
                    >
                        {children}
                    </div>
                </div>
                {closable && (
                    <button
                        type="button"
                        aria-label="Schließen"
                        className={cn("absolute right-0 top-0 p-2 text-xs", iconColors[status])}
                        onClick={() => {
                            setClosed(true);
                            onClose?.();
                        }}
                    >
                        <CloseIcon />
                    </button>
                )}
            </div>
        </div>
    );
};
