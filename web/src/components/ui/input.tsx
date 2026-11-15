import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentChildren, JSX } from "preact";
import { forwardRef } from "preact/compat";
import { Button } from "./button";
import { cn } from "./cn";
import { useFieldLink } from "./form";
import { ChevronDownIcon } from "./icons";

export const inputVariants = cva(
    "block w-full rounded-[6px] border border-ui-border bg-ui-input text-ui-text transition-[border-color] duration-150 ease-in-out placeholder:text-ui-text-secondary placeholder:opacity-30 enabled:hover:border-ui-primary focus:border-ui-primary focus:outline focus:outline-[3px] focus:outline-ui-focus-ring disabled:bg-ui-input-disabled disabled:text-ui-text-disabled",
    {
        variants: {
            size: {
                xs: "px-[11px] py-px text-xs leading-[1.66666667]",
                sm: "px-[11px] py-1 text-[14px] leading-[1.42857143]",
                md: "px-[11px] py-[7px] text-[14px] leading-[1.42857143]",
                lg: "px-[11px] py-[9px] text-[16px] leading-[1.375]"
            }
        },
        defaultVariants: { size: "md" }
    }
);

type InputVariants = VariantProps<typeof inputVariants>;

interface InputProps
    extends Omit<
            JSX.InputHTMLAttributes<HTMLInputElement>,
            "size" | "className" | "onInput" | "onChange"
        >,
        InputVariants {
    readonly className?: string;
    readonly onValueChange?: (value: string) => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { size, className, onValueChange, ...props },
    ref
) {
    const fieldLink = useFieldLink();
    return (
        <input
            {...fieldLink}
            {...props}
            ref={ref}
            className={cn(inputVariants({ size }), className)}
            onInput={(event) => onValueChange?.(event.currentTarget.value)}
        />
    );
});

interface TextareaProps
    extends Omit<
        JSX.TextareaHTMLAttributes<HTMLTextAreaElement>,
        "className" | "onInput" | "onChange"
    > {
    readonly className?: string;
    readonly onValueChange?: (value: string) => void;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { className, onValueChange, ...props },
    ref
) {
    const fieldLink = useFieldLink();
    return (
        <textarea
            {...fieldLink}
            {...props}
            ref={ref}
            className={cn(inputVariants(), className)}
            onInput={(event) => onValueChange?.(event.currentTarget.value)}
        />
    );
});

interface InputGroupProps {
    /** Button or icon sit inside the field instead of being separated from it. */
    readonly inside?: boolean;
    readonly size?: "sm" | "md";
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const InputGroup = ({
    inside = false,
    size = "md",
    className,
    children
}: InputGroupProps) => (
    <div
        className={cn(
            "relative flex w-full cursor-text rounded-[6px] border border-ui-border text-ui-text transition-[border-color] duration-150 ease-in-out focus-within:border-ui-primary focus-within:outline focus-within:outline-[3px] focus-within:outline-ui-focus-ring hover:border-ui-primary [&>input]:min-w-0 [&>input]:flex-auto [&>input]:border-0 [&>input]:!outline-none",
            inside
                ? "bg-ui-input"
                : "[&>:first-child]:rounded-l-[6px] [&>:last-child]:rounded-r-[6px] [&>input]:rounded-none",
            size === "sm" && "[&>input]:h-[28px] [&>input]:py-1",
            size === "sm" && inside && "[&>input]:pr-0",
            className
        )}
    >
        {children}
    </div>
);

interface InputGroupAddonProps {
    readonly size?: "sm" | "md";
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const InputGroupAddon = ({ size = "md", className, children }: InputGroupAddonProps) => (
    <span
        className={cn(
            "flex flex-none items-center justify-center bg-transparent text-[14px] leading-[1.42857143] text-ui-text",
            size === "sm" ? "h-[28px] min-w-[32px] px-[9px] py-1" : "px-3 py-2.5",
            className
        )}
    >
        {children}
    </span>
);

interface InputGroupButtonProps
    extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "size"> {
    readonly inside?: boolean;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const InputGroupButton = ({
    inside = false,
    className,
    children,
    ...props
}: InputGroupButtonProps) => (
    <Button
        variant={inside ? "subtle" : "default"}
        className={cn(
            "flex-none",
            inside
                ? "h-[34px] rounded-l-none px-[11px] py-[7px] text-inherit focus:outline-none"
                : "rounded-l-none",
            className
        )}
        {...props}
    >
        {children}
    </Button>
);

interface NumberInputProps {
    readonly value: number | string;
    readonly onValueChange: (value: string) => void;
    readonly step?: number;
    readonly className?: string;
    readonly style?: JSX.CSSProperties;
    readonly "aria-label"?: string;
}

/** A number field with stepper buttons on its right edge. */
export const NumberInput = ({
    value,
    onValueChange,
    step = 1,
    className,
    style,
    "aria-label": ariaLabel
}: NumberInputProps) => {
    const stepBy = (delta: number) => onValueChange(String((Number(value) || 0) + delta));
    const stepper = "relative block h-[17px] w-full rounded-none p-0 text-ui-text-secondary";
    return (
        <div
            className={cn(
                "relative flex w-full rounded-[6px] border border-ui-border bg-ui-input transition-[border-color] duration-150 ease-in-out focus-within:border-ui-primary focus-within:outline focus-within:outline-[3px] focus-within:outline-ui-focus-ring hover:border-ui-primary",
                className
            )}
            style={style}
        >
            <input
                type="number"
                value={value}
                aria-label={ariaLabel}
                className={cn(
                    inputVariants(),
                    "min-w-0 flex-auto border-0 !outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                )}
                onInput={(event) => {
                    // A lone "-" reads as empty and resetting the field would swallow it.
                    if (!event.currentTarget.validity.badInput) {
                        onValueChange(event.currentTarget.value);
                    }
                }}
            />
            <div className="relative block w-5 flex-[0_0_20px]">
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Erhöhen"
                    className={stepper}
                    onClick={() => stepBy(step)}
                >
                    <ChevronDownIcon className="mx-auto rotate-180 text-[17px]" />
                </button>
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Verringern"
                    className={stepper}
                    onClick={() => stepBy(-step)}
                >
                    <ChevronDownIcon className="mx-auto text-[17px]" />
                </button>
            </div>
        </div>
    );
};
