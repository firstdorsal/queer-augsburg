import { Annotation, type Range } from "@codemirror/state";
import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
    WidgetType
} from "@codemirror/view";
import { ySyncFacet } from "y-codemirror.next";
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

export const USER_COLOR_COUNT = 8;
const USER_COLORS = [
    "#d7263d",
    "#1b998b",
    "#2e86ab",
    "#f46036",
    "#7b2d8e",
    "#3a7d44",
    "#c2185b",
    "#5d4037"
];

const userClass = (colorIndex: unknown) =>
    `cm-user-${Number.isInteger(colorIndex) && (colorIndex as number) >= 0 ? (colorIndex as number) % USER_COLOR_COUNT : 0}`;

export const userColorTheme = EditorView.baseTheme({
    ...Object.fromEntries(
        USER_COLORS.map((color, i) => [
            `.cm-user-${i}`,
            { "--cm-user": color, "--cm-user-selection": `${color}33` }
        ])
    ),
    ".cm-ySelection, .cm-yLineSelection": { backgroundColor: "var(--cm-user-selection)" },
    ".cm-ySelectionCaret": { backgroundColor: "var(--cm-user)", borderColor: "var(--cm-user)" }
});

class CaretWidget extends WidgetType {
    constructor(
        readonly userClass: string,
        readonly name: string
    ) {
        super();
    }
    toDOM() {
        const caret = document.createElement("span");
        caret.className = `cm-ySelectionCaret ${this.userClass}`;
        const dot = document.createElement("div");
        dot.className = "cm-ySelectionCaretDot";
        const info = document.createElement("div");
        info.className = "cm-ySelectionInfo";
        info.textContent = this.name;
        caret.append("⁠", dot, "⁠", info, "⁠");
        return caret;
    }
    eq(other: CaretWidget) {
        return other.userClass === this.userClass && other.name === this.name;
    }
    get estimatedHeight() {
        return -1;
    }
    ignoreEvent() {
        return true;
    }
}

const redraw = Annotation.define<null>();

/** Positions come from other clients: a bad one must not break this editor. */
const absolutePosition = (position: Y.RelativePosition, doc: Y.Doc) => {
    try {
        return Y.createAbsolutePositionFromRelativePosition(position, doc);
    } catch {
        return null;
    }
};

/** y-codemirror.next's yRemoteSelections with colours from classes instead of style attributes. */
export const remoteSelections = (awareness: Awareness) =>
    ViewPlugin.fromClass(
        class {
            decorations: DecorationSet = Decoration.none;
            listener = ({
                added,
                updated,
                removed
            }: {
                added: number[];
                updated: number[];
                removed: number[];
            }) => {
                if ([...added, ...updated, ...removed].some((id) => id !== awareness.clientID)) {
                    this.view.dispatch({ annotations: redraw.of(null) });
                }
            };
            constructor(readonly view: EditorView) {
                awareness.on("change", this.listener);
            }
            destroy() {
                awareness.off("change", this.listener);
            }
            update(update: ViewUpdate) {
                const { ytext } = update.state.facet(ySyncFacet);
                const ydoc = ytext.doc!;
                const local = awareness.getLocalState();
                if (local) {
                    const focused =
                        update.view.hasFocus && update.view.dom.ownerDocument.hasFocus();
                    if (focused) {
                        const { anchor, head } = update.state.selection.main;
                        const next = {
                            anchor: Y.createRelativePositionFromTypeIndex(ytext, anchor),
                            head: Y.createRelativePositionFromTypeIndex(ytext, head)
                        };
                        const cur = local.cursor;
                        if (
                            !cur ||
                            !Y.compareRelativePositions(
                                Y.createRelativePositionFromJSON(cur.anchor),
                                next.anchor
                            ) ||
                            !Y.compareRelativePositions(
                                Y.createRelativePositionFromJSON(cur.head),
                                next.head
                            )
                        ) {
                            awareness.setLocalStateField("cursor", next);
                        }
                    }
                }
                const out: Range<Decoration>[] = [];
                awareness.getStates().forEach((state, clientId) => {
                    if (
                        clientId === awareness.clientID ||
                        !state.cursor?.anchor ||
                        !state.cursor?.head
                    )
                        return;
                    const anchor = absolutePosition(state.cursor.anchor, ydoc);
                    const head = absolutePosition(state.cursor.head, ydoc);
                    if (!anchor || !head || anchor.type !== ytext || head.type !== ytext) return;
                    const cls = userClass(state.user?.colorIndex);
                    const mark = Decoration.mark({ class: `cm-ySelection ${cls}` });
                    const doc = update.state.doc;
                    const from = Math.min(anchor.index, head.index);
                    const to = Math.max(anchor.index, head.index);
                    const first = doc.lineAt(from);
                    const last = doc.lineAt(to);
                    if (first.number === last.number) {
                        if (from < to) out.push(mark.range(from, to));
                    } else {
                        if (from < first.to) out.push(mark.range(from, first.to));
                        if (last.from < to) out.push(mark.range(last.from, to));
                        for (let n = first.number + 1; n < last.number; n++) {
                            out.push(
                                Decoration.line({ class: `cm-yLineSelection ${cls}` }).range(
                                    doc.line(n).from
                                )
                            );
                        }
                    }
                    out.push(
                        Decoration.widget({
                            side: head.index > anchor.index ? -1 : 1,
                            widget: new CaretWidget(cls, state.user?.name ?? "")
                        }).range(head.index)
                    );
                });
                this.decorations = Decoration.set(out, true);
            }
        },
        { decorations: (v) => v.decorations }
    );
