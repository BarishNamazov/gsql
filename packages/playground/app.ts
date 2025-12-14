import { compile } from "@barishnamazov/gsql/src/compiler";
import examples from "./examples.json";
import { EditorView, basicSetup } from "codemirror";
import type { ViewUpdate } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState, Prec } from "@codemirror/state";
import { gsql } from "./gsql-lang";

interface Example {
  id: string;
  name: string;
  description: string;
  code: string;
}

const sourceEditorElement = document.getElementById("source-editor") as HTMLDivElement;
const outputEditorElement = document.getElementById("output-editor") as HTMLDivElement;

const sourceEditor = new EditorView({
  extensions: [
    basicSetup,
    gsql(),
    oneDark,
    EditorView.lineWrapping,
    Prec.high(
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            compileSource();
            return true;
          },
        },
      ])
    ),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged && !isLoadingExample) {
        showWarning();
      }
    }),
  ],
  parent: sourceEditorElement,
});

const outputEditor = new EditorView({
  extensions: [basicSetup, sql(), oneDark, EditorView.lineWrapping, EditorState.readOnly.of(true)],
  parent: outputEditorElement,
});
const compileBtn = document.getElementById("compile-btn") as HTMLButtonElement;
const exampleSelect = document.getElementById("example-select") as HTMLSelectElement;
const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
const loadingBanner = document.getElementById("loading-banner") as HTMLDivElement;
const warningBanner = document.getElementById("warning-banner") as HTMLDivElement;
const errorBanner = document.getElementById("error-banner") as HTMLDivElement;
const errorText = document.getElementById("error-text") as HTMLSpanElement;

let hasUncompiledChanges = false;
let isLoadingExample = false;

function compileSource(): void {
  const source = sourceEditor.state.doc.toString();

  if (!source.trim()) {
    showError("Please enter some GSQL code");
    return;
  }

  showLoading();
  clearError();
  hideWarning();

  setTimeout(() => {
    try {
      const result = compile(source);

      if (result.success && result.sql) {
        outputEditor.dispatch({
          changes: { from: 0, to: outputEditor.state.doc.length, insert: result.sql },
        });
        hideLoading();
        hasUncompiledChanges = false;
      } else {
        const errorMessages = result.errors.map((e) => formatError(e)).join("\n");
        hideLoading();
        showError(errorMessages);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      hideLoading();
      showError(`Unexpected error: ${message}`);
    }
  }, 0);
}

function formatError(error: {
  message: string;
  location?: { start: { line: number; column: number } };
}): string {
  let msg = error.message;
  if (error.location) {
    msg = `[${error.location.start.line}:${error.location.start.column}] ${msg}`;
  }
  return msg;
}

function showLoading(): void {
  loadingBanner.style.display = "block";
}

function hideLoading(): void {
  loadingBanner.style.display = "none";
}

function showError(message: string): void {
  errorText.textContent = message;
  errorBanner.style.display = "flex";
  setTimeout(() => {
    errorBanner.style.display = "none";
  }, 5000);
}

function clearError(): void {
  errorBanner.style.display = "none";
}

function showWarning(): void {
  if (!hasUncompiledChanges) {
    hasUncompiledChanges = true;
    warningBanner.style.display = "flex";
  }
}

function hideWarning(): void {
  hasUncompiledChanges = false;
  warningBanner.style.display = "none";
}

async function copyOutput(): Promise<void> {
  const text = outputEditor.state.doc.toString();

  try {
    await navigator.clipboard.writeText(text);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch {
    showError("Failed to copy to clipboard");
  }
}

function downloadCode(): void {
  const content = sourceEditor.state.doc.toString();
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schema.gsql";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadExample(exampleId: string): void {
  const example = (examples as Example[]).find((ex) => ex.id === exampleId);
  if (example) {
    isLoadingExample = true;
    sourceEditor.dispatch({
      changes: { from: 0, to: sourceEditor.state.doc.length, insert: example.code },
    });
    isLoadingExample = false;
    clearError();
    hideWarning();
  }
}

function populateExampleSelect(): void {
  (examples as Example[]).forEach((example) => {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = example.name;
    exampleSelect.appendChild(option);
  });
}

compileBtn.addEventListener("click", compileSource);
exampleSelect.addEventListener("change", () => {
  loadExample(exampleSelect.value);
  compileSource();
});
copyBtn.addEventListener("click", () => void copyOutput());
downloadBtn.addEventListener("click", downloadCode);

populateExampleSelect();

if (examples.length > 0) {
  const firstExample = (examples as Example[])[0];
  if (firstExample) {
    const firstExampleId = firstExample.id;
    exampleSelect.value = firstExampleId;
    loadExample(firstExampleId);
    compileSource();
  }
}
