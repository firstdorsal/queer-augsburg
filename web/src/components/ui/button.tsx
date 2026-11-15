import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentChildren, JSX } from "preact";
import { cn } from "./cn";
import { Spinner } from "./loader";

export const buttonVariants = cva(
    "relative inline-flex cursor-pointer select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-[6px] text-center align-middle font-normal no-underline transition-colors duration-150 ease-out hover:no-underline focus:no-underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed",
    {
        variants: {
            variant: {
                default:
                    "bg-ui-btn text-ui-btn-text hover:bg-ui-btn-hover hover:text-inherit focus:bg-ui-btn-hover focus:text-inherit active:bg-ui-btn-active active:text-ui-btn-active-text disabled:bg-ui-btn disabled:text-ui-btn-disabled-text",
                primary:
                    "bg-ui-btn-primary text-white hover:bg-ui-btn-primary-hover hover:text-white focus:bg-ui-btn-primary-hover focus:text-white active:bg-ui-btn-primary-active active:text-white disabled:bg-ui-btn-primary disabled:text-white disabled:opacity-30",
                subtle: "bg-transparent text-ui-btn-subtle-text hover:bg-ui-btn-subtle-hover hover:text-ui-btn-subtle-hover-text focus:bg-ui-btn-subtle-hover focus:text-ui-btn-subtle-hover-text active:bg-ui-btn-subtle-active active:text-ui-btn-subtle-active-text disabled:bg-transparent disabled:text-ui-btn-subtle-disabled-text",
                link: "bg-transparent text-ui-link hover:bg-transparent hover:text-ui-link-hover hover:underline focus:bg-transparent focus:text-ui-link-hover focus:underline active:text-ui-btn-ghost-active disabled:bg-transparent disabled:text-ui-link-hover disabled:no-underline disabled:opacity-30",
                ghost: "border border-ui-btn-ghost bg-transparent text-ui-btn-ghost hover:border-ui-btn-ghost-hover hover:bg-transparent hover:text-ui-btn-ghost-hover hover:shadow-[0_0_0_1px_var(--ui-btn-ghost-hover)] focus:border-ui-btn-ghost-hover focus:bg-transparent focus:text-ui-btn-ghost-hover focus:shadow-[0_0_0_1px_var(--ui-btn-ghost-hover)] active:border-ui-btn-ghost-active active:text-ui-btn-ghost-active disabled:border-ui-btn-ghost disabled:bg-transparent disabled:text-ui-btn-ghost disabled:opacity-30 disabled:shadow-none"
            },
            // Only primary knows all tones; subtle and ghost know red, the others none.
            tone: {
                neutral: "",
                red: "",
                orange: "",
                green: ""
            },
            size: {
                xs: "px-2 py-0.5 text-xs leading-5",
                sm: "px-2.5 py-[5px] text-[14px] leading-5",
                md: "px-3 py-2 text-[14px] leading-5",
                lg: "px-4 py-2.5 text-[16px] leading-[22px]"
            },
            block: {
                true: "w-full",
                false: ""
            }
        },
        compoundVariants: [
            { variant: "ghost", size: "xs", className: "px-[7px] py-px" },
            { variant: "ghost", size: "sm", className: "px-[9px] py-1" },
            { variant: "ghost", size: "md", className: "px-[11px] py-[7px]" },
            { variant: "ghost", size: "lg", className: "px-[15px] py-[9px]" },
            {
                variant: "primary",
                tone: "red",
                className:
                    "bg-ui-red-primary hover:bg-ui-red-primary-hover focus:bg-ui-red-primary-hover active:bg-ui-red-primary-active disabled:bg-ui-red-primary"
            },
            {
                variant: "primary",
                tone: "orange",
                className:
                    "bg-ui-orange-primary hover:bg-ui-orange-primary-hover focus:bg-ui-orange-primary-hover active:bg-ui-orange-primary-active disabled:bg-ui-orange-primary"
            },
            {
                variant: "primary",
                tone: "green",
                className:
                    "bg-ui-green-primary hover:bg-ui-green-primary-hover focus:bg-ui-green-primary-hover active:bg-ui-green-primary-active disabled:bg-ui-green-primary"
            },
            {
                variant: "subtle",
                tone: "red",
                className:
                    "hover:bg-ui-red-subtle-hover hover:text-ui-red-subtle-hover-text focus:bg-ui-red-subtle-hover focus:text-ui-red-subtle-hover-text active:bg-ui-red-subtle-active active:text-ui-red-subtle-active-text"
            },
            {
                variant: "ghost",
                tone: "red",
                className:
                    "border-ui-red-ghost text-ui-red-ghost hover:border-ui-red-ghost-hover hover:text-ui-red-ghost-hover-text hover:shadow-[0_0_0_1px_var(--ui-red-ghost-hover)] focus:border-ui-red-ghost-hover focus:text-ui-red-ghost-hover-text focus:shadow-[0_0_0_1px_var(--ui-red-ghost-hover)] active:border-ui-red-ghost-active active:text-ui-red-ghost-active disabled:border-ui-red-ghost disabled:text-ui-red-ghost"
            }
        ],
        defaultVariants: { variant: "default", tone: "neutral", size: "md", block: false }
    }
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

interface ButtonProps
    extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "size">,
        Pick<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target" | "rel" | "download">,
        ButtonVariants {
    readonly loading?: boolean;
    readonly children?: ComponentChildren;
}

export const Button = ({
    variant,
    tone,
    size,
    block,
    loading = false,
    className,
    children,
    href,
    type = "button",
    disabled,
    target,
    rel,
    onClick,
    ...props
}: ButtonProps) => {
    const classes = cn(
        buttonVariants({ variant, tone, size, block }),
        loading && "pointer-events-none cursor-default",
        className as string
    );
    const content = (
        <>
            {loading ? <span className="invisible">{children}</span> : children}
            {loading && <Spinner className="absolute left-1/2 top-1/2 -ml-[9px] -mt-[9px]" />}
        </>
    );
    if (href && !disabled) {
        return (
            <a
                {...(props as JSX.AnchorHTMLAttributes<HTMLAnchorElement>)}
                href={href}
                target={target}
                rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
                className={classes}
            >
                {content}
            </a>
        );
    }
    return (
        <button
            {...props}
            type={type}
            disabled={disabled}
            aria-busy={loading}
            className={classes}
            // A loading button keeps its look, but Enter and Space must not fire it again.
            onClick={loading ? undefined : onClick}
        >
            {content}
        </button>
    );
};

interface ButtonGroupProps {
    readonly className?: string;
    readonly children?: ComponentChildren;
}

export const ButtonGroup = ({ className, children }: ButtonGroupProps) => (
    <div
        role="group"
        className={cn(
            "relative inline-block align-middle [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>button]:float-left",
            className
        )}
    >
        {children}
    </div>
);
