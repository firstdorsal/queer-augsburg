import type { ComponentChildren, JSX } from "preact";
import { cn } from "./cn";

const spinnerSizes = { xs: "size-4", sm: "size-[18px]", md: "size-[36px]", lg: "size-[64px]" };

interface SpinnerProps {
    readonly size?: keyof typeof spinnerSizes;
    readonly className?: string;
}

export const Spinner = ({ size = "sm", className }: SpinnerProps) => (
    <span
        className={cn(
            "relative inline-block rounded-full border-[3px] border-ui-loader-ring",
            spinnerSizes[size],
            className
        )}
    >
        <span className="absolute inset-[-3px] animate-spin rounded-full border-[3px] border-transparent border-t-ui-loader-rotor [animation-duration:0.6s]" />
    </span>
);

interface LoaderProps extends SpinnerProps {
    readonly content?: ComponentChildren;
    readonly style?: JSX.CSSProperties;
}

export const Loader = ({ size, content, className, style }: LoaderProps) => (
    <div className={cn("inline-flex items-start", className)} style={style} role="status" aria-label="Lädt">
        <Spinner size={size} />
        {content && <span className="ml-3 text-xs leading-[1.5]">{content}</span>}
    </div>
);
