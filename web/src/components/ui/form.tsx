import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useId } from "preact/hooks";
import { cn } from "./cn";

interface FieldLink {
    readonly id: string;
    readonly "aria-describedby"?: string;
    readonly "aria-invalid"?: boolean;
}

const FieldContext = createContext<FieldLink | null>(null);

/** Connects a control to the label, help and error of the FormField around it. */
export const useFieldLink = () => useContext(FieldContext);

interface FormFieldProps {
    readonly label?: ComponentChildren;
    readonly help?: ComponentChildren;
    /** Shown as a floating hint below the control. */
    readonly error?: string | null;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

/** A labelled control of a form, 300px wide. */
export const FormField = ({ label, help, error, className, children }: FormFieldProps) => {
    const id = useId();
    const helpId = `${id}-help`;
    const errorId = `${id}-error`;
    const describedBy = [help && helpId, error && errorId].filter(Boolean).join(" ");

    return (
        <div className={cn("relative [&:not(:last-child)]:mb-6", className)}>
            {label && (
                <label htmlFor={id} className="mb-1 block">
                    {label}
                </label>
            )}
            <div className="relative inline-block w-[300px] max-w-full">
                <FieldContext.Provider
                    value={{
                        id,
                        "aria-describedby": describedBy || undefined,
                        "aria-invalid": error ? true : undefined
                    }}
                >
                    {children}
                </FieldContext.Provider>
                {error && (
                    <div className="absolute bottom-0 left-0 z-[5]" role="alert">
                        <div
                            id={errorId}
                            className="absolute left-0 top-0 w-max max-w-[300px] rounded-[6px] border border-ui-error-tip-border bg-ui-error-tip px-[7px] py-[3px] text-xs leading-5 text-ui-error-tip-text drop-shadow-[0_0_6px_rgba(0,0,0,0.1)] before:absolute before:-top-1.5 before:left-2.5 before:border-x-[6px] before:border-b-[6px] before:border-x-transparent before:border-b-ui-error-tip-border before:content-[''] after:absolute after:-top-[5px] after:left-2.5 after:border-x-[6px] after:border-b-[6px] after:border-x-transparent after:border-b-ui-error-tip after:content-['']"
                        >
                            {error}
                        </div>
                    </div>
                )}
            </div>
            {help && (
                <span
                    id={helpId}
                    className="block min-h-5 pt-1 text-xs leading-[1.66666667] text-ui-text-secondary"
                >
                    {help}
                </span>
            )}
        </div>
    );
};
