import { cn } from "./cn";
import { CloseIcon } from "./icons";

interface ClearButtonProps {
    readonly className?: string;
    readonly onClick: () => void;
}

/** Empties a field; takes the caret's place while there is a value. */
export const ClearButton = ({ className, onClick }: ClearButtonProps) => (
    <button
        type="button"
        aria-label="Auswahl löschen"
        className={cn(
            "absolute right-3 top-2 flex h-5 items-center text-xs text-ui-text-secondary hover:text-ui-text",
            className
        )}
        onClick={(event) => {
            event.stopPropagation();
            onClick();
        }}
    >
        <CloseIcon />
    </button>
);
