import React from "react";

interface _prop {
    resetEditor: () => void;
}

export default function ResetEditor(prop: _prop) {
    return (
        <button
            type="button"
            onClick={prop.resetEditor}
            title="重置工程"
            className="editor-toolbar-button"
        >
            <span>重置工程</span>
        </button>
    );
}
