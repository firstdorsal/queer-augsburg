import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";
import { cn } from "./cn";
import { AttachmentIcon, CloseIcon } from "./icons";

export const formatFileSize = (size: number) => {
    if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(2)}GB`;
    if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(2)}MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(2)}KB`;
    return `${size}B`;
};

interface FileUploadProps {
    readonly files: readonly File[];
    readonly onChange: (files: File[]) => void;
    /** Sees the whole new list; returning false refuses the addition. */
    readonly validate?: (files: readonly File[]) => boolean;
    readonly className?: string;
    readonly children?: ComponentChildren;
}

/** Drop zone and list for files that are sent with a form instead of uploaded on their own. */
export const FileUpload = ({ files, onChange, validate, className, children }: FileUploadProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const add = (added: FileList | null) => {
        const next = [...files, ...Array.from(added ?? [])];
        if (next.length > files.length && (validate?.(next) ?? true)) onChange(next);
    };

    return (
        <div className={className}>
            <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                    add(event.currentTarget.files);
                    event.currentTarget.value = "";
                }}
            />
            <div
                role="button"
                tabIndex={0}
                className={cn(
                    "block cursor-pointer rounded-[6px] bg-ui-surface",
                    dragging && "opacity-70"
                )}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setDragging(false);
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    add(event.dataTransfer?.files ?? null);
                }}
            >
                {children}
            </div>
            {files.length > 0 && (
                <div className="mt-2.5">
                    {files.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="relative flex justify-between py-2 pl-9 pr-[30px] transition-colors duration-300 ease-linear hover:bg-ui-upload-hover"
                        >
                            <AttachmentIcon className="absolute left-[15px] top-[11px] text-[14px] text-ui-text" />
                            <span className="w-full flex-auto truncate text-ui-text">
                                {file.name}
                            </span>
                            <span className="ml-2.5 mr-[7px] flex-none text-ui-text-secondary">
                                {formatFileSize(file.size)}
                            </span>
                            <button
                                type="button"
                                aria-label={`${file.name} entfernen`}
                                className="absolute right-3 top-3 p-0 text-[14px] text-ui-text-secondary"
                                onClick={() =>
                                    onChange(files.filter((_, position) => position !== index))
                                }
                            >
                                <CloseIcon />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
