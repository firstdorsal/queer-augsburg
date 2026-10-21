import { InterosseaClient } from "@firstdorsal/interossea-client";
import { ConfirmSendEmailResponseBody } from "./apiTypes/ConfirmSendEmailResponseBody";
import type { CreatePlaceRequestBody } from "./apiTypes/CreatePlaceRequestBody";
import type { CreatePlaceResponseBody } from "./apiTypes/CreatePlaceResponseBody";
import type { GetPlacesResponseBody } from "./apiTypes/GetPlacesResponseBody";
import type { MeetingLinkResponseBody } from "./apiTypes/MeetingLinkResponseBody";
import type { Place } from "./apiTypes/Place";
import { EmailAttachment } from "./apiTypes/EmailAttachment";
import { GetMeetingsResponseBody } from "./apiTypes/GetMeetingsResponseBody";
import { GetUsersResponseBody } from "./apiTypes/GetUsersResponseBody";
import { Meeting } from "./apiTypes/Meeting";
import { MeetingTypeQuery } from "./apiTypes/MeetingTypeQuery";
import { MembershipStatus } from "./apiTypes/MembershipStatus";
import { SendEmailPreviewResponseBody } from "./apiTypes/SendEmailPreviewResponseBody";
import { SubmittedMember } from "./apiTypes/SubmittedMember";
import { User } from "./apiTypes/User";

interface MeetingsCache {
    meetings: Meeting[];
    total_count: number;
    /** Server's last_updated timestamp - use this for delta sync, not client time */
    last_updated: number | null;
}

/**
 * Check if the app is running as an installed PWA
 */
function isPwaInstalled(): boolean {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://")
    );
}

export class QaClient {
    interosseaClient: InterosseaClient;
    qaEndpoint: string;

    constructor(
        qaEndpoint: string,
        interosseaServerEndpoint: string,
        interosseaWebEndpoint: string,
        applicationName: string,
        skipInterossea: boolean = false
    ) {
        this.qaEndpoint = qaEndpoint;

        this.interosseaClient = new InterosseaClient(
            interosseaServerEndpoint,
            interosseaWebEndpoint,
            this.qaEndpoint,
            applicationName,
            skipInterossea
        );
    }

    init = async () => {
        // Caches of older versions have an older meeting shape.
        const current = [this.getMeetingsCacheKey("Active"), this.getMeetingsCacheKey("Planned")];
        Object.keys(localStorage)
            .filter((key) => key.startsWith("meetings_cache_") && !current.includes(key))
            .forEach((key) => localStorage.removeItem(key));
        await this.interosseaClient.init();
    };

    /**
     * Get the cache key for a meeting type
     */
    private getMeetingsCacheKey = (meeting_type: MeetingTypeQuery): string => {
        // v3: meetings have place_id/online and an optional location since the places feature.
        return `meetings_cache_v3_${meeting_type}`;
    };

    /**
     * Get cached meetings for a type, or null if not cached
     */
    private getCachedMeetings = (meeting_type: MeetingTypeQuery): MeetingsCache | null => {
        const cacheKey = this.getMeetingsCacheKey(meeting_type);
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        try {
            return JSON.parse(cached) as MeetingsCache;
        } catch {
            return null;
        }
    };

    /**
     * Save meetings to cache
     */
    private setCachedMeetings = (
        meeting_type: MeetingTypeQuery,
        meetings: Meeting[],
        total_count: number,
        last_updated: number | null
    ): void => {
        const cacheKey = this.getMeetingsCacheKey(meeting_type);
        const cache: MeetingsCache = {
            meetings,
            total_count,
            last_updated
        };
        try {
            localStorage.setItem(cacheKey, JSON.stringify(cache));
        } catch (e) {
            // localStorage might be full, log and continue
            console.warn("Failed to cache meetings:", e);
        }
    };

    /**
     * Invalidate the meetings cache for a specific type or all types
     */
    invalidateMeetingsCache = (meeting_type?: MeetingTypeQuery): void => {
        if (meeting_type) {
            localStorage.removeItem(this.getMeetingsCacheKey(meeting_type));
        } else {
            localStorage.removeItem(this.getMeetingsCacheKey("Active"));
            localStorage.removeItem(this.getMeetingsCacheKey("Planned"));
        }
    };

    /**
     * Fetch meetings from API
     */
    private fetchMeetings = async (
        meeting_type: MeetingTypeQuery,
        from_index?: number,
        limit?: number | null,
        since?: number
    ): Promise<GetMeetingsResponseBody> => {
        let url = `${this.qaEndpoint}/api/get_meetings/?t=${meeting_type}`;

        if (from_index !== undefined && from_index > 0) {
            url += `&i=${from_index}`;
        }
        if (limit !== undefined && limit !== null) {
            url += `&l=${limit}`;
        }
        if (since !== undefined) {
            url += `&since=${since}`;
        }

        const res = await fetch(url, {
            credentials: "include"
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        return res.json();
    };

    /**
     * Merge delta updates into cached meetings
     */
    private mergeDeltaUpdates = (
        cached: MeetingsCache,
        updates: Meeting[],
        newTotalCount: number,
        serverLastUpdated: number | null
    ): MeetingsCache => {
        const meetingsMap = new Map<string, Meeting>();

        // Add all cached meetings
        for (const meeting of cached.meetings) {
            meetingsMap.set(meeting._id, meeting);
        }

        // Apply updates (add/update/remove deleted)
        for (const meeting of updates) {
            if (meeting.deleted_at) {
                // Remove deleted meetings
                meetingsMap.delete(meeting._id);
            } else {
                // Add or update meeting
                meetingsMap.set(meeting._id, meeting);
            }
        }

        return {
            meetings: Array.from(meetingsMap.values()),
            total_count: newTotalCount,
            // Use server's last_updated if available, otherwise keep existing
            last_updated: serverLastUpdated ?? cached.last_updated
        };
    };

    /**
     * Get meetings - behavior depends on whether app is installed as PWA:
     * - PWA: Cache all meetings locally, use delta sync
     * - Browser: Fetch paginated data on demand
     *
     * Note: Delta sync has a limitation with status-changed meetings.
     * If a meeting's status changes (e.g., Active to Planned), it won't
     * appear in delta sync because the server filters by status first.
     * The count mismatch check partially handles this by triggering a
     * full refresh when counts don't match. However, if meetings move
     * between statuses symmetrically (one Active->Planned, one Planned->Active),
     * the count stays the same but caches may be stale. User-initiated changes
     * clear the cache via invalidateMeetingsCache().
     */
    get_meetings = async (
        from_index: number,
        limit: number | null,
        meeting_type: MeetingTypeQuery = "Active"
    ): Promise<GetMeetingsResponseBody> => {
        const isPwa = isPwaInstalled();

        if (!isPwa) {
            // Guest/browser mode: fetch paginated data directly from API
            // No caching to minimize storage, load only what's needed
            try {
                return await this.fetchMeetings(meeting_type, from_index, limit);
            } catch (error) {
                // Try to return cached data if available (offline support)
                const cached = this.getCachedMeetings(meeting_type);
                if (cached) {
                    const startIdx = from_index;
                    const endIdx = limit === null ? undefined : from_index + limit;
                    const paginatedMeetings = cached.meetings
                        .filter(m => !m.deleted_at)
                        .slice(startIdx, endIdx);

                    console.warn("Using cached meetings (offline):", error);
                    return {
                        meetings: paginatedMeetings,
                        selected_total_count: cached.total_count,
                        last_updated: cached.last_updated as unknown as bigint | null
                    };
                }
                throw error;
            }
        }

        // PWA mode: cache all meetings and use delta sync
        const cached = this.getCachedMeetings(meeting_type);

        try {
            if (cached && cached.last_updated !== null) {
                // Try delta sync - fetch only meetings changed since last sync
                const deltaResponse = await this.fetchMeetings(
                    meeting_type,
                    undefined,
                    undefined,
                    cached.last_updated
                );

                let updatedCache: MeetingsCache;

                if (deltaResponse.meetings.length > 0) {
                    // Merge updates into cache
                    const serverLastUpdated = deltaResponse.last_updated !== null
                        ? Number(deltaResponse.last_updated)
                        : null;
                    updatedCache = this.mergeDeltaUpdates(
                        cached,
                        deltaResponse.meetings,
                        deltaResponse.selected_total_count,
                        serverLastUpdated
                    );
                    this.setCachedMeetings(
                        meeting_type,
                        updatedCache.meetings,
                        updatedCache.total_count,
                        updatedCache.last_updated
                    );
                } else if (deltaResponse.selected_total_count !== cached.total_count) {
                    // Count mismatch but no updates - something's wrong, do full refresh
                    const fullResponse = await this.fetchMeetings(meeting_type);
                    const fullLastUpdated = fullResponse.last_updated !== null
                        ? Number(fullResponse.last_updated)
                        : null;
                    this.setCachedMeetings(
                        meeting_type,
                        fullResponse.meetings,
                        fullResponse.selected_total_count,
                        fullLastUpdated
                    );
                    updatedCache = {
                        meetings: fullResponse.meetings,
                        total_count: fullResponse.selected_total_count,
                        last_updated: fullLastUpdated
                    };
                } else {
                    // No changes, use existing cache
                    updatedCache = cached;
                }

                // Return paginated results from cache
                const startIdx = from_index;
                const endIdx = limit === null ? undefined : from_index + limit;
                const paginatedMeetings = updatedCache.meetings
                    .filter(m => !m.deleted_at)
                    .slice(startIdx, endIdx);

                return {
                    meetings: paginatedMeetings,
                    selected_total_count: updatedCache.total_count,
                    last_updated: updatedCache.last_updated as unknown as bigint | null
                };
            } else {
                // No cache or no last_updated - fetch all meetings
                const response = await this.fetchMeetings(meeting_type);
                const responseLastUpdated = response.last_updated !== null
                    ? Number(response.last_updated)
                    : null;
                this.setCachedMeetings(
                    meeting_type,
                    response.meetings,
                    response.selected_total_count,
                    responseLastUpdated
                );

                // Return paginated results
                const startIdx = from_index;
                const endIdx = limit === null ? undefined : from_index + limit;
                const paginatedMeetings = response.meetings
                    .filter(m => !m.deleted_at)
                    .slice(startIdx, endIdx);

                return {
                    meetings: paginatedMeetings,
                    selected_total_count: response.selected_total_count,
                    last_updated: response.last_updated
                };
            }
        } catch (error) {
            // Offline or error - use cache if available
            if (cached) {
                const startIdx = from_index;
                const endIdx = limit === null ? undefined : from_index + limit;
                const paginatedMeetings = cached.meetings
                    .filter(m => !m.deleted_at)
                    .slice(startIdx, endIdx);

                console.warn("Using cached meetings (offline/error):", error);
                return {
                    meetings: paginatedMeetings,
                    selected_total_count: cached.total_count,
                    last_updated: cached.last_updated as unknown as bigint | null
                };
            }
            throw error;
        }
    };

    get_users = async (
        from_index: number,
        limit: number | null,
        search?: string | null,
        sort_by?: string | null,
        sort_order?: string | null
    ) => {
        let url = `${this.qaEndpoint}/api/get_users/?i=${from_index}${
            limit === null ? "" : "&l=" + limit
        }`;

        if (search && search.trim()) {
            url += `&s=${encodeURIComponent(search)}`;
        }

        if (sort_by) {
            url += `&sb=${encodeURIComponent(sort_by)}`;
        }

        if (sort_order) {
            url += `&so=${encodeURIComponent(sort_order)}`;
        }

        const res = await fetch(url, {
            credentials: "include"
        });
        const users: GetUsersResponseBody = await res.json();
        return users;
    };

    /** Saves a meeting. Never throws; on rejection the server explains why (German text). */
    update_meeting = async (
        meeting: Meeting
    ): Promise<{ ok: true; meeting: Meeting } | { ok: false; message: string }> => {
        const result = await this.sendJson(`${this.qaEndpoint}/api/update_meeting/`, {
            meeting
        });
        // Invalidate cache since meeting data may have changed
        this.invalidateMeetingsCache();
        if (!result.ok) return result;
        return { ok: true, meeting: result.body as Meeting };
    };

    get_places = async (): Promise<Place[]> => {
        const res = await fetch(`${this.qaEndpoint}/api/places/`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body: GetPlacesResponseBody = await res.json();
        return body.places;
    };

    /** Creates a place, or returns the existing one with the same name (`created: false`). */
    create_place = async (
        place: CreatePlaceRequestBody
    ): Promise<({ ok: true } & CreatePlaceResponseBody) | { ok: false; message: string }> => {
        const result = await this.sendJson(`${this.qaEndpoint}/api/create_place/`, place);
        if (!result.ok) return result;
        return { ok: true, ...(result.body as CreatePlaceResponseBody) };
    };

    /** The join link of an online meeting incl. members-only links (verified members only).
     * Never throws; `status` 0 means no answer from the server. */
    get_meeting_link = async (
        meeting_id: string
    ): Promise<{ ok: true; url: string | null } | { ok: false; status: number }> => {
        try {
            const res = await fetch(
                `${this.qaEndpoint}/api/meeting_link/?m=${encodeURIComponent(meeting_id)}`,
                { credentials: "include" }
            );
            if (!res.ok) return { ok: false, status: res.status };
            const body: MeetingLinkResponseBody = await res.json();
            return { ok: true, url: body.url };
        } catch (error) {
            console.error("get_meeting_link failed:", error);
            return { ok: false, status: 0 };
        }
    };

    /** POSTs JSON; error bodies are German plain text from the server. Never throws. */
    private sendJson = async (
        url: string,
        body: unknown
    ): Promise<{ ok: true; body: unknown } | { ok: false; message: string }> => {
        try {
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                return { ok: false, message: text || `Fehler ${res.status}` };
            }
            return { ok: true, body: await res.json() };
        } catch (error) {
            console.error(`POST ${url} failed:`, error);
            return { ok: false, message: "Keine oder ungültige Antwort vom Server." };
        }
    };

    delete_meeting = async (meeting: Meeting) => {
        const res = await fetch(`${this.qaEndpoint}/api/update_meeting/`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meeting, delete: true })
        });
        const success = res.status === 200;
        if (success) {
            // Invalidate cache since meeting data has changed
            this.invalidateMeetingsCache();
        }
        return success;
    };

    create_own_user = async () => {
        const res = await fetch(`${this.qaEndpoint}/api/create_own_user/`, {
            method: "POST",
            credentials: "include"
        });
        const success = res.status === 200;
        return success;
    };

    admin_create_member = async (newMember: string) => {
        return fetch(`${this.qaEndpoint}/api/admin_create_member/`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: newMember
        });
    };

    get_own_user = async () => {
        const res = await fetch(`${this.qaEndpoint}/api/get_own_user/`, {
            credentials: "include"
        });
        const user: User = await res.json();
        return user;
    };

    update_own_member_data = async (submitted_member: SubmittedMember) => {
        const res = await fetch(`${this.qaEndpoint}/api/update_own_member_data/`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ member: submitted_member })
        });
        return res;
    };

    update_member_status = async (
        user_id: string,
        new_status: MembershipStatus,
        send_mail: boolean,
        update_reason?: string
    ) => {
        return fetch(`${this.qaEndpoint}/api/update_member_status/`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id,
                new_status,
                send_mail,
                update_reason: update_reason?.length ? update_reason : null
            })
        });
    };

    send_email_preview = async (
        subject: string,
        body: string,
        attachments: EmailAttachment[],
        reply_to?: string
    ): Promise<SendEmailPreviewResponseBody> => {
        const res = await fetch(`${this.qaEndpoint}/api/send_email_preview/`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject, body, attachments, reply_to: reply_to || null })
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `HTTP ${res.status}`);
        }
        return res.json();
    };

    confirm_send_email = async (
        preview_id: string,
        verification_code: string,
        testing_mode?: boolean
    ): Promise<ConfirmSendEmailResponseBody> => {
        const res = await fetch(`${this.qaEndpoint}/api/confirm_send_email/`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preview_id, verification_code, testing_mode })
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `HTTP ${res.status}`);
        }
        return res.json();
    };
}
