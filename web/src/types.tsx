import { QaClient } from "./api";

export interface UiConfig {
    interosseaServerAddress: string;
    interosseaWebAddress: string;
    qaServerAddress: string;
    skipInterossea: boolean;
}

export interface G {
    uiConfig: UiConfig | null;
    qaClient: QaClient | null;
}
