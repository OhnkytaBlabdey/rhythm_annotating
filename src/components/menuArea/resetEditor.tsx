import React from "react";

interface _prop {
    resetEditor: () => void;
}

export default function ResetEditor(prop: _prop) {
    return (
        <button
            onClick={prop.resetEditor}
            title="重置工程"
            className="flex items-center gap-2 px-2"
        >
            <span>重置工程</span>
        </button>
    );
}
