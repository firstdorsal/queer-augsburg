import { Button, Message } from "rsuite";

interface LoadErrorProps {
    readonly message?: string;
    readonly onRetry: () => void;
}

/** Error message with a retry button for a failed load. */
const LoadError = ({
    message = "Die Orte konnten nicht geladen werden.",
    onRetry
}: LoadErrorProps) => (
    <Message showIcon type="error">
        {message}{" "}
        <Button appearance="link" size="sm" className="p-0" onClick={onRetry}>
            Erneut versuchen
        </Button>
    </Message>
);

export default LoadError;
