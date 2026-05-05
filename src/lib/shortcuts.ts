export type ShortcutAction =
    | "timeRange.zoomIn"
    | "timeRange.zoomOut"
    | "timeRange.panUp"
    | "timeRange.panDown"
    | "note.mode.browse"
    | "note.mode.insertStrong"
    | "note.mode.insertWeak"
    | "note.mode.insertLn"
    | "note.mode.select"
    | "note.mode.paste"
    | "note.mode.insertStart"
    | "note.mode.insertEnd"
    | "note.mode.annotate"
    | "note.division.increment"
    | "note.division.decrement";

export type ShortcutMap = Record<ShortcutAction, string>;

export interface ShortcutDefinition {
    action: ShortcutAction;
    label: string;
    description: string;
    section: string;
    defaultCombo: string;
    inputType: "keyboard" | "wheel";
}

const PURE_MODIFIER_CODES = new Set([
    "ShiftLeft",
    "ShiftRight",
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
    "MetaLeft",
    "MetaRight",
]);

const DISPLAY_ALIASES: Record<string, string> = {
    Space: "Space",
    Escape: "Esc",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    BracketLeft: "[",
    BracketRight: "]",
    Minus: "-",
    Equal: "=",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    Backquote: "`",
};

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
    {
        action: "timeRange.zoomIn",
        label: "时间轴放大",
        description: "缩小可视时间范围",
        section: "时间轴",
        defaultCombo: "Alt+WheelUp",
        inputType: "wheel",
    },
    {
        action: "timeRange.zoomOut",
        label: "时间轴缩小",
        description: "放大可视时间范围",
        section: "时间轴",
        defaultCombo: "Alt+WheelDown",
        inputType: "wheel",
    },
    {
        action: "timeRange.panUp",
        label: "时间轴前移",
        description: "向前平移当前可视范围",
        section: "时间轴",
        defaultCombo: "WheelUp",
        inputType: "wheel",
    },
    {
        action: "timeRange.panDown",
        label: "时间轴后移",
        description: "向后平移当前可视范围",
        section: "时间轴",
        defaultCombo: "WheelDown",
        inputType: "wheel",
    },
    {
        action: "note.mode.browse",
        label: "浏览模式",
        description: "切换到只读浏览模式",
        section: "记谱输入",
        defaultCombo: "B",
        inputType: "keyboard",
    },
    {
        action: "note.mode.insertStrong",
        label: "强拍输入",
        description: "切换到强拍 note 输入模式",
        section: "记谱输入",
        defaultCombo: "1",
        inputType: "keyboard",
    },
    {
        action: "note.mode.insertWeak",
        label: "弱拍输入",
        description: "切换到弱拍 note 输入模式",
        section: "记谱输入",
        defaultCombo: "2",
        inputType: "keyboard",
    },
    {
        action: "note.mode.insertLn",
        label: "长条输入",
        description: "切换到长条 note 输入模式",
        section: "记谱输入",
        defaultCombo: "3",
        inputType: "keyboard",
    },
    {
        action: "note.mode.select",
        label: "选择模式",
        description: "切换到选择与拖拽模式",
        section: "记谱输入",
        defaultCombo: "4",
        inputType: "keyboard",
    },
    {
        action: "note.mode.paste",
        label: "粘贴模式",
        description: "切换到粘贴模式",
        section: "记谱输入",
        defaultCombo: "5",
        inputType: "keyboard",
    },
    {
        action: "note.mode.insertStart",
        label: "起始标记",
        description: "切换到起始标记模式",
        section: "记谱输入",
        defaultCombo: "6",
        inputType: "keyboard",
    },
    {
        action: "note.mode.insertEnd",
        label: "结束标记",
        description: "切换到结束标记模式",
        section: "记谱输入",
        defaultCombo: "7",
        inputType: "keyboard",
    },
    {
        action: "note.mode.annotate",
        label: "标注模式",
        description: "切换到标注编辑模式",
        section: "记谱输入",
        defaultCombo: "8",
        inputType: "keyboard",
    },
    {
        action: "note.division.increment",
        label: "增加等分",
        description: "单拍小节内等分加一",
        section: "记谱输入",
        defaultCombo: "]",
        inputType: "keyboard",
    },
    {
        action: "note.division.decrement",
        label: "减少等分",
        description: "单拍小节内等分减一",
        section: "记谱输入",
        defaultCombo: "[",
        inputType: "keyboard",
    },
];

const DEFAULT_SHORTCUTS_ENTRIES = SHORTCUT_DEFINITIONS.map((definition) => [
    definition.action,
    definition.defaultCombo,
]) as Array<[ShortcutAction, string]>;

export const DEFAULT_SHORTCUTS = Object.fromEntries(
    DEFAULT_SHORTCUTS_ENTRIES,
) as ShortcutMap;

function normalizeModifier(token: string): string | null {
    const lowered = token.toLowerCase();
    if (lowered === "ctrl" || lowered === "control") return "Ctrl";
    if (lowered === "alt" || lowered === "option") return "Alt";
    if (lowered === "shift") return "Shift";
    if (lowered === "meta" || lowered === "cmd" || lowered === "command") {
        return "Meta";
    }
    return null;
}

function normalizeKeyFromCode(code: string, fallbackKey = ""): string {
    if (!code) {
        return normalizeKeyToken(fallbackKey);
    }
    if (code.startsWith("Key") && code.length === 4) {
        return code.slice(3).toUpperCase();
    }
    if (code.startsWith("Digit") && code.length === 6) {
        return code.slice(5);
    }
    if (/^F\d{1,2}$/.test(code)) {
        return code;
    }
    return DISPLAY_ALIASES[code] ?? normalizeKeyToken(fallbackKey || code);
}

function normalizeKeyToken(token: string): string {
    const trimmed = token.trim();
    if (!trimmed) return "";

    if (trimmed === " ") return "Space";
    if (/^[a-z]$/i.test(trimmed)) return trimmed.toUpperCase();
    if (/^\d$/.test(trimmed)) return trimmed;

    const modifier = normalizeModifier(trimmed);
    if (modifier) {
        return modifier;
    }

    const lowered = trimmed.toLowerCase();
    if (lowered === "wheelup") return "WheelUp";
    if (lowered === "wheeldown") return "WheelDown";
    if (lowered === "esc") return "Esc";
    if (lowered === "space" || lowered === "spacebar") return "Space";
    if (lowered === "arrowup") return "ArrowUp";
    if (lowered === "arrowdown") return "ArrowDown";
    if (lowered === "arrowleft") return "ArrowLeft";
    if (lowered === "arrowright") return "ArrowRight";

    return DISPLAY_ALIASES[trimmed] ?? trimmed;
}

function sortModifiers(modifiers: Set<string>): string[] {
    return ["Ctrl", "Alt", "Shift", "Meta"].filter((modifier) =>
        modifiers.has(modifier),
    );
}

export function normalizeShortcutCombo(combo: string): string {
    if (!combo.trim()) return "";

    const tokens = combo
        .split("+")
        .map((token) => token.trim())
        .filter(Boolean);
    const modifiers = new Set<string>();
    let primary = "";

    for (const token of tokens) {
        const modifier = normalizeModifier(token);
        if (modifier) {
            modifiers.add(modifier);
            continue;
        }

        primary = normalizeKeyToken(token);
    }

    const parts = sortModifiers(modifiers);
    if (primary) {
        parts.push(primary);
    }
    return parts.join("+");
}

export function createShortcutComboFromKeyboardEvent(
    event: Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
): string | null {
    if (PURE_MODIFIER_CODES.has(event.code)) {
        return null;
    }

    const primary = normalizeKeyFromCode(event.code, event.key);
    if (!primary || primary === "Ctrl" || primary === "Alt" || primary === "Shift" || primary === "Meta") {
        return null;
    }

    const modifiers = new Set<string>();
    if (event.ctrlKey) modifiers.add("Ctrl");
    if (event.altKey) modifiers.add("Alt");
    if (event.shiftKey) modifiers.add("Shift");
    if (event.metaKey) modifiers.add("Meta");

    return [...sortModifiers(modifiers), primary].join("+");
}

export function createShortcutComboFromWheelEvent(
    event: Pick<WheelEvent, "deltaY" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
): string {
    const modifiers = new Set<string>();
    if (event.ctrlKey) modifiers.add("Ctrl");
    if (event.altKey) modifiers.add("Alt");
    if (event.shiftKey) modifiers.add("Shift");
    if (event.metaKey) modifiers.add("Meta");

    const primary = event.deltaY < 0 ? "WheelUp" : "WheelDown";
    return [...sortModifiers(modifiers), primary].join("+");
}

export function isWheelShortcut(combo: string): boolean {
    return combo.endsWith("WheelUp") || combo.endsWith("WheelDown");
}

export function matchesKeyboardShortcut(
    combo: string,
    event: Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
): boolean {
    const normalized = normalizeShortcutCombo(combo);
    if (!normalized || isWheelShortcut(normalized)) {
        return false;
    }

    const eventCombo = createShortcutComboFromKeyboardEvent(event);
    return eventCombo === normalized;
}

export function matchesWheelShortcut(
    combo: string,
    event: Pick<WheelEvent, "deltaY" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
): boolean {
    const normalized = normalizeShortcutCombo(combo);
    if (!normalized || !isWheelShortcut(normalized)) {
        return false;
    }

    return createShortcutComboFromWheelEvent(event) === normalized;
}

export function findShortcutConflicts(shortcuts: ShortcutMap): Array<{
    combo: string;
    actions: ShortcutAction[];
}> {
    const actionMap = new Map<string, ShortcutAction[]>();

    for (const definition of SHORTCUT_DEFINITIONS) {
        const combo = normalizeShortcutCombo(shortcuts[definition.action] ?? "");
        if (!combo) continue;

        const existing = actionMap.get(combo) ?? [];
        existing.push(definition.action);
        actionMap.set(combo, existing);
    }

    return Array.from(actionMap.entries())
        .filter(([, actions]) => actions.length > 1)
        .map(([combo, actions]) => ({
            combo,
            actions,
        }));
}

export function getShortcutConflictActions(
    shortcuts: ShortcutMap,
): Set<ShortcutAction> {
    const conflicts = findShortcutConflicts(shortcuts);
    return new Set(conflicts.flatMap((conflict) => conflict.actions));
}

export function getShortcutDefinition(
    action: ShortcutAction,
): ShortcutDefinition | undefined {
    return SHORTCUT_DEFINITIONS.find((definition) => definition.action === action);
}
