import { cn } from "./cn";
import { CheckIcon } from "./icons";

interface StepsProps {
    readonly current: number;
    readonly titles: readonly string[];
    readonly className?: string;
}

export const Steps = ({ current, titles, className }: StepsProps) => (
    <div className={cn("flex min-h-[30px] justify-between", className)}>
        {titles.map((title, index) => {
            const done = index < current;
            const active = index === current;
            const last = index === titles.length - 1;
            return (
                <div
                    key={index}
                    aria-current={active ? "step" : undefined}
                    style={last ? undefined : { width: `${100 / (titles.length - 1)}%` }}
                    className={cn(
                        "relative min-h-[30px] overflow-hidden pl-10",
                        last ? "flex-initial sm:flex-none" : "flex-auto",
                        index > 0 && "pl-[50px]"
                    )}
                >
                    <div
                        className={cn(
                            "absolute top-0 flex size-[30px] items-center justify-center rounded-[50%] border border-ui-steps-border text-[16px] leading-[1.75] text-ui-text-secondary",
                            index > 0 ? "left-2.5" : "left-0",
                            done && "border-ui-steps-done text-ui-steps-done",
                            active &&
                                "border-ui-steps-current bg-ui-steps-current text-ui-steps-current-text"
                        )}
                    >
                        {done ? <CheckIcon className="text-[14px]" /> : index + 1}
                    </div>
                    <div
                        className={cn(
                            "relative inline-block h-[30px] w-full",
                            active ? "text-ui-text" : "text-ui-text-secondary"
                        )}
                    >
                        <div
                            className={cn(
                                "relative inline-block min-h-4 pr-2.5 text-[16px] leading-[1.875]",
                                !last &&
                                    "after:absolute after:left-full after:top-[15px] after:w-[9999px] after:border-t after:border-solid after:content-['']",
                                done ? "after:border-ui-steps-done" : "after:border-ui-steps-border"
                            )}
                        >
                            {title}
                        </div>
                    </div>
                </div>
            );
        })}
    </div>
);
