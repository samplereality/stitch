const DB_NAME = "glitchlite-db";
const STORE_NAME = "projects";
const DEFAULT_PROJECT_ID = "default";
const PUBLISH_ENDPOINT = "https://glitchlet.digitaldavidson.net/publish/publish.php";
const THEME_STORAGE_KEY = "stitch:theme";
const EDITOR_THEME_KEY = "stitch:editor-theme";
const CURRENT_PROJECT_KEY = "stitch:current-project";
const DEFAULT_PROJECT_NAME = "Untitled Project";
const TEXT_EXTS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "json",
  "txt",
  "md",
  "svg",
  "csv",
]);
const MIME_BY_EXT = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  txt: "text/plain",
  md: "text/markdown",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
};

const state = {
  projectId: DEFAULT_PROJECT_ID,
  projectName: DEFAULT_PROJECT_NAME,
  projectDescription: "",
  projectCreator: "",
  files: new Map(),
  editorDocs: new Map(),
  binaryDoc: null,
  currentPath: null,
  previewUrls: [],
  saveTimer: null,
  previewTimer: null,
  statusTimer: null,
  suppressEditorChange: false,
  isResizing: false,
};

const elements = {
  workspace: document.getElementById("workspace"),
  fileTree: document.getElementById("fileTree"),
  editor: document.getElementById("editor"),
  editorPanel: document.querySelector(".editor-panel"),
  previewPanel: document.querySelector(".preview-panel"),
  filePanel: document.querySelector(".file-panel"),
  splitter: document.getElementById("editorPreviewSplitter"),
  currentFileLabel: document.getElementById("currentFileLabel"),
  binaryNotice: document.getElementById("binaryNotice"),
  saveStatus: document.getElementById("saveStatus"),
  previewFrame: document.getElementById("previewFrame"),
  previewWarnings: document.getElementById("previewWarnings"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  importZipBtn: document.getElementById("importZipBtn"),
  exportZipBtn: document.getElementById("exportZipBtn"),
  publishBtn: document.getElementById("publishBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  editorThemeToggleBtn: document.getElementById("editorThemeToggleBtn"),
  prettifyBtn: document.getElementById("prettifyBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  currentProjectName: document.getElementById("currentProjectName"),
  projectMetaBtn: document.getElementById("projectMetaBtn"),
  projectMetaModal: document.getElementById("projectMetaModal"),
  closeProjectMetaBtn: document.getElementById("closeProjectMetaBtn"),
  saveProjectMetaBtn: document.getElementById("saveProjectMetaBtn"),
  projectCreatorInput: document.getElementById("projectCreatorInput"),
  projectDescriptionInput: document.getElementById("projectDescriptionInput"),
  publishModal: document.getElementById("publishModal"),
  closePublishModalBtn: document.getElementById("closePublishModalBtn"),
  publishUrlText: document.getElementById("publishUrlText"),
  copyPublishUrlBtn: document.getElementById("copyPublishUrlBtn"),
  openPublishUrlBtn: document.getElementById("openPublishUrlBtn"),
  projectManagerBtn: document.getElementById("projectManagerBtn"),
  projectManagerPanel: document.getElementById("projectManagerPanel"),
  closeProjectManagerBtn: document.getElementById("closeProjectManagerBtn"),
  projectNameInput: document.getElementById("projectNameInput"),
  renameProjectBtn: document.getElementById("renameProjectBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  saveProjectAsBtn: document.getElementById("saveProjectAsBtn"),
  projectList: document.getElementById("projectList"),
  addFileBtn: document.getElementById("addFileBtn"),
  uploadFileBtn: document.getElementById("uploadFileBtn"),
  refreshPreviewBtn: document.getElementById("refreshPreviewBtn"),
  zipInput: document.getElementById("zipInput"),
  fileInput: document.getElementById("fileInput"),
  toggleFilePanelBtn: document.getElementById("toggleFilePanelBtn"),
  expandFilePanelBtn: document.getElementById("expandFilePanelBtn"),
};

let codeMirror = null;

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function normalizePath(path) {
  const normalized = path.replace(/\\/g, "/");
  const parts = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function isHiddenPath(path) {
  return path.split("/").some((segment) => segment && segment.startsWith("."));
}

function dirname(path) {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function resolvePath(baseDir, relPath) {
  if (relPath.startsWith("/")) return relPath;
  if (!baseDir) return normalizePath(relPath);
  return normalizePath(`${baseDir}/${relPath}`);
}

function extname(path) {
  const parts = path.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function isTextFile(path) {
  return TEXT_EXTS.has(extname(path));
}

function fileMime(path) {
  return MIME_BY_EXT[extname(path)] || "application/octet-stream";
}

function createDefaultFiles() {
  return [
    {
      path: "index.html",
      kind: "text",
      data: `<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>My Project</title>\n    <link rel=\"stylesheet\" href=\"style.css\" />\n  </head>\n  <body>\n    <main class=\"stage\">\n      <h1>Make something</h1>\n      <p>Start editing the files on the left.</p>\n      <button id=\"btn\">Click me</button>\n    </main>\n    <script src=\"script.js\"></script>\n  </body>\n</html>\n`,
      mime: "text/html",
    },
    {
      path: "style.css",
      kind: "text",
      data: `:root {\n  color-scheme: light;\n  font-family: \"Trebuchet MS\", sans-serif;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: linear-gradient(135deg, #f7f2ea, #fde6c8);\n}\n\n.stage {\n  text-align: center;\n  padding: 48px;\n  background: white;\n  border-radius: 24px;\n  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);\n}\n\nbutton {\n  margin-top: 20px;\n  border: none;\n  background: #d65a31;\n  color: white;\n  padding: 12px 18px;\n  border-radius: 999px;\n  font-weight: 600;\n}\n`,
      mime: "text/css",
    },
    {
      path: "script.js",
      kind: "text",
      data: `const btn = document.getElementById("btn");\n\nbtn?.addEventListener("click", () => {\n  btn.textContent = "Nice!";\n});\n`,
      mime: "text/javascript",
    },
  ];
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const keysRequest = store.getAllKeys();
    const valuesRequest = store.getAll();
    tx.oncomplete = () => {
      const keys = keysRequest.result || [];
      const values = valuesRequest.result || [];
      resolve(keys.map((key, index) => ({ id: String(key), data: values[index] || null })));
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getStoredProjectId() {
  try {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || DEFAULT_PROJECT_ID;
  } catch (error) {
    console.warn("Unable to access localStorage", error);
    return DEFAULT_PROJECT_ID;
  }
}

function normalizeProjectName(name) {
  const trimmed = String(name || "").trim();
  return trimmed || DEFAULT_PROJECT_NAME;
}

function createProjectId() {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function setStatus(text, hold = 1200) {
  elements.saveStatus.textContent = text;
  if (hold) {
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      elements.saveStatus.textContent = "";
    }, hold);
  }
}

function getEditorValue() {
  return codeMirror ? codeMirror.getValue() : elements.editor.value;
}

function setEditorValue(value) {
  if (codeMirror) {
    state.suppressEditorChange = true;
    codeMirror.setValue(value);
    state.suppressEditorChange = false;
  } else {
    elements.editor.value = value;
  }
}

function setEditorReadOnly(isReadOnly) {
  if (codeMirror) {
    codeMirror.setOption("readOnly", isReadOnly ? "nocursor" : false);
  } else {
    elements.editor.disabled = isReadOnly;
  }
}

function setEditorMode(path) {
  if (!codeMirror) return;
  const mode = getEditorMode(path);
  codeMirror.setOption("mode", mode);
}

function getEditorMode(path) {
  const ext = extname(path);
  if (ext === "html" || ext === "htm") return "htmlmixed";
  if (ext === "css") return "css";
  if (ext === "js") return "javascript";
  return "text/plain";
}

function getFile(path) {
  return state.files.get(path) || null;
}

function setFile(file) {
  state.files.set(file.path, file);
}

function renameFile(oldPath, newPath) {
  const normalized = normalizePath(newPath);
  if (!normalized) {
    alert("Please enter a valid file name.");
    return false;
  }
  if (normalized === oldPath) return false;
  if (state.files.has(normalized)) {
    alert("A file with that name already exists.");
    return false;
  }
  const file = getFile(oldPath);
  if (!file) return false;
  state.files.delete(oldPath);
  file.path = normalized;
  file.mime = fileMime(normalized);
  state.files.set(normalized, file);
  const doc = state.editorDocs.get(oldPath);
  if (doc) {
    state.editorDocs.delete(oldPath);
    state.editorDocs.set(normalized, doc);
  }
  if (state.currentPath === oldPath) {
    state.currentPath = normalized;
    elements.currentFileLabel.textContent = normalized;
    setEditorMode(normalized);
  }
  return true;
}

function removeFile(path) {
  state.files.delete(path);
  state.editorDocs.delete(path);
  if (state.currentPath === path) {
    state.currentPath = null;
    setEditorValue("");
    elements.currentFileLabel.textContent = "Select a file";
  }
}

function renderFileTree() {
  elements.fileTree.innerHTML = "";
  const paths = Array.from(state.files.keys()).sort((a, b) => a.localeCompare(b));
  for (const path of paths) {
    const item = document.createElement("div");
    item.className = "file-item";
    if (path === state.currentPath) item.classList.add("active");

    const label = document.createElement("span");
    label.textContent = path;

    const actions = document.createElement("div");
    actions.className = "file-item-actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "icon-btn";
    renameBtn.innerHTML = "<i data-lucide=\"pencil\"></i>";
    renameBtn.title = "Rename file";
    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const next = prompt("Rename file:", path);
      if (!next) return;
      if (renameFile(path, next)) {
        renderFileTree();
        queueSave();
        queuePreview();
      }
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn";
    removeBtn.innerHTML = "<i data-lucide=\"trash-2\"></i>";
    removeBtn.title = "Delete file";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (confirm(`Delete ${path}?`)) {
        removeFile(path);
        renderFileTree();
        queueSave();
        queuePreview();
      }
    });

    actions.append(renameBtn, removeBtn);
    item.append(label, actions);
    item.addEventListener("click", () => openFile(path));
    elements.fileTree.appendChild(item);
  }
  refreshIcons();
}

function openFile(path) {
  const file = getFile(path);
  if (!file) return;
  state.currentPath = path;
  elements.currentFileLabel.textContent = path;
  renderFileTree();

  if (file.kind === "binary") {
    elements.binaryNotice.classList.remove("hidden");
    setEditorReadOnly(true);
    if (codeMirror) {
      if (!state.binaryDoc) {
        state.binaryDoc = new CodeMirror.Doc("", null);
      }
      codeMirror.swapDoc(state.binaryDoc);
    } else {
      setEditorValue("");
    }
    return;
  }

  elements.binaryNotice.classList.add("hidden");
  setEditorReadOnly(false);

  if (codeMirror) {
    let doc = state.editorDocs.get(path);
    if (!doc) {
      doc = new CodeMirror.Doc(file.data, getEditorMode(path));
      state.editorDocs.set(path, doc);
    }
    codeMirror.swapDoc(doc);
    setEditorMode(path);
    return;
  }

  setEditorMode(path);
  setEditorValue(file.data);
}

function updateCurrentFile(value) {
  const path = state.currentPath;
  if (!path) return;
  const file = getFile(path);
  if (!file || file.kind === "binary") return;
  file.data = value;
  setFile(file);
}

async function prettifyCurrentFile() {
  const path = state.currentPath;
  if (!path) {
    alert("Pick a file to format.");
    return;
  }
  const file = getFile(path);
  if (!file || file.kind === "binary") {
    alert("This file type cannot be prettified.");
    return;
  }
  if (!window.prettier || !window.prettierPlugins) {
    alert("Prettier is still loading. Try again in a moment.");
    return;
  }
  const ext = extname(path);
  let parser = null;
  if (ext === "js") parser = "babel";
  if (ext === "css") parser = "css";
  if (ext === "html" || ext === "htm") parser = "html";
  if (!parser) {
    alert("Prettify supports HTML, CSS, and JavaScript files.");
    return;
  }
  try {
    const formatted = await window.prettier.format(file.data, {
      parser,
      plugins: window.prettierPlugins,
      tabWidth: 2,
      printWidth: 80,
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
    });
    if (typeof formatted !== "string") {
      throw new Error("Prettier returned non-string output.");
    }
    setEditorValue(formatted);
    updateCurrentFile(formatted);
    queueSave();
    queuePreview();
  } catch (error) {
    console.error(error);
    alert("Prettify failed. Check the console for details.");
  }
}

function serializeProject() {
  const files = Array.from(state.files.values()).map((file) => {
    const payload = {
      path: file.path,
      kind: file.kind,
      mime: file.mime,
    };
    if (file.kind === "binary") {
      payload.data = Array.from(new Uint8Array(file.data));
    } else {
      payload.data = file.data;
    }
    return payload;
  });
  return {
    id: state.projectId,
    name: state.projectName,
    description: state.projectDescription,
    creator: state.projectCreator,
    updatedAt: Date.now(),
    files,
  };
}

function loadProject(project) {
  state.files = new Map();
  state.editorDocs = new Map();
  state.projectName = normalizeProjectName(project?.name);
  state.projectDescription = String(project?.description || "");
  state.projectCreator = String(project?.creator || "");
  for (const file of project.files) {
    let data = file.data;
    if (file.kind === "binary") {
      data = new Uint8Array(file.data).buffer;
    }
    setFile({ path: file.path, kind: file.kind, mime: file.mime, data });
  }
}

function queueSave() {
  clearTimeout(state.saveTimer);
  setStatus("Saving...", 0);
  state.saveTimer = setTimeout(async () => {
    try {
      localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
      await dbSet(state.projectId, serializeProject());
      setStatus("Saved");
    } catch (error) {
      console.error(error);
      setStatus("Save failed", 2000);
    }
  }, 400);
}

function queuePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(renderPreview, 200);
}

function clearPreviewUrls() {
  for (const url of state.previewUrls) {
    URL.revokeObjectURL(url);
  }
  state.previewUrls = [];
}

function addPreviewUrl(url) {
  state.previewUrls.push(url);
  return url;
}

function createBlobUrl(file, overrideMime) {
  const mime = overrideMime || file.mime || fileMime(file.path);
  const blob = file.kind === "binary" ? new Blob([file.data], { type: mime }) : new Blob([file.data], { type: mime });
  return addPreviewUrl(URL.createObjectURL(blob));
}

function isRelativeUrl(url) {
  return !/^(https?:|data:|blob:|#|mailto:|tel:|\/\/)/i.test(url);
}

function isAbsolutePath(url) {
  return url.startsWith("/") && !url.startsWith("//");
}

function replaceCssUrls(cssText, baseDir, warnings) {
  return cssText.replace(/url\(([^)]+)\)/g, (match, raw) => {
    let url = raw.trim().replace(/^['"]|['"]$/g, "");
    if (!url || !isRelativeUrl(url)) return match;
    if (isAbsolutePath(url)) {
      warnings.add(`Absolute path in CSS: ${url}`);
      return match;
    }
    const resolved = resolvePath(baseDir, url);
    const file = getFile(resolved);
    if (!file) return match;
    const blobUrl = createBlobUrl(file);
    return `url(${blobUrl})`;
  });
}

function rewriteDocument(doc, htmlPath, warnings) {
  const baseDir = dirname(htmlPath);

  const linkNodes = Array.from(doc.querySelectorAll("link[href]"));
  for (const link of linkNodes) {
    const href = link.getAttribute("href");
    if (!href || !isRelativeUrl(href)) continue;
    if (isAbsolutePath(href)) {
      warnings.add(`Absolute path in HTML: ${href}`);
      continue;
    }
    const resolved = resolvePath(baseDir, href);
    const file = getFile(resolved);
    if (!file) continue;
    if (link.rel === "stylesheet") {
      const cssText = file.kind === "binary" ? "" : String(file.data || "");
      const updatedCss = replaceCssUrls(cssText, dirname(resolved), warnings);
      const blobUrl = createBlobUrl({ ...file, data: updatedCss, kind: "text" }, "text/css");
      link.setAttribute("href", blobUrl);
    } else {
      link.setAttribute("href", createBlobUrl(file));
    }
  }

  const scriptNodes = Array.from(doc.querySelectorAll("script[src]"));
  for (const script of scriptNodes) {
    const src = script.getAttribute("src");
    if (!src || !isRelativeUrl(src)) continue;
    if (isAbsolutePath(src)) {
      warnings.add(`Absolute path in HTML: ${src}`);
      continue;
    }
    const resolved = resolvePath(baseDir, src);
    const file = getFile(resolved);
    if (!file) continue;
    script.setAttribute("src", createBlobUrl(file));
  }

  const srcNodes = Array.from(doc.querySelectorAll("[src]"));
  for (const node of srcNodes) {
    if (node.tagName === "SCRIPT") continue;
    const src = node.getAttribute("src");
    if (!src || !isRelativeUrl(src)) continue;
    if (isAbsolutePath(src)) {
      warnings.add(`Absolute path in HTML: ${src}`);
      continue;
    }
    const resolved = resolvePath(baseDir, src);
    const file = getFile(resolved);
    if (!file) continue;
    node.setAttribute("src", createBlobUrl(file));
  }

  const styleNodes = Array.from(doc.querySelectorAll("style"));
  for (const style of styleNodes) {
    const cssText = style.textContent || "";
    const updatedCss = replaceCssUrls(cssText, baseDir, warnings);
    style.textContent = updatedCss;
  }
}

function renderPreview() {
  clearPreviewUrls();
  const warnings = new Set();
  const htmlFile = getFile("index.html") || Array.from(state.files.values()).find((file) => file.path.endsWith(".html"));
  let html = "<!doctype html><html><body><p>No HTML file found.</p></body></html>";
  let htmlPath = "index.html";

  if (htmlFile && htmlFile.kind !== "binary") {
    html = htmlFile.data;
    htmlPath = htmlFile.path;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  rewriteDocument(doc, htmlPath, warnings);

  const output = "<!doctype html>\n" + doc.documentElement.outerHTML;
  elements.previewFrame.srcdoc = output;

  if (warnings.size) {
    elements.previewWarnings.textContent = `Warnings: ${Array.from(warnings).join(" | ")}`;
  } else {
    elements.previewWarnings.textContent = "";
  }
}

function openFirstFile() {
  if (getFile("index.html")) {
    openFile("index.html");
    return;
  }
  const first = Array.from(state.files.keys()).sort()[0];
  if (first) openFile(first);
}

async function loadInitialProject() {
  state.projectId = getStoredProjectId();
  const stored = await dbGet(state.projectId);
  if (stored && stored.files?.length) {
    loadProject(stored);
  } else {
    const defaults = createDefaultFiles();
    defaults.forEach((file) => setFile({ ...file }));
    await dbSet(state.projectId, serializeProject());
  }

  renderFileTree();
  openFirstFile();
  renderPreview();
  renderProjectManager();
}

function addFile(path, data = "", kind = null) {
  const normalized = normalizePath(path);
  if (!normalized) return;
  const fileKind = kind || (isTextFile(normalized) ? "text" : "binary");
  const payload = fileKind === "binary" ? (data instanceof ArrayBuffer ? data : new ArrayBuffer(0)) : String(data);
  const file = {
    path: normalized,
    kind: fileKind,
    data: payload,
    mime: fileMime(normalized),
  };
  setFile(file);
  renderFileTree();
  queueSave();
  queuePreview();
}

async function handleFileUpload(files) {
  for (const file of files) {
    const path = normalizePath(file.name);
    const kind = isTextFile(path) ? "text" : "binary";
    if (kind === "text") {
      const text = await file.text();
      addFile(path, text, "text");
    } else {
      const buffer = await file.arrayBuffer();
      addFile(path, buffer, "binary");
    }
  }
}

async function ensureJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error("Failed to load JSZip"));
    document.head.appendChild(script);
  });
}

async function importZip(file) {
  try {
    const JSZip = await ensureJSZip();
    const zip = await JSZip.loadAsync(file);
    state.files = new Map();
    state.editorDocs = new Map();
    const entries = Object.keys(zip.files);
    const fileEntries = [];
    for (const path of entries) {
      const entry = zip.files[path];
      if (entry.dir) continue;
      const normalized = normalizePath(path);
      if (!normalized || isHiddenPath(normalized)) {
        continue;
      }
      fileEntries.push({ entry, path: normalized });
    }
    const topLevelFolders = new Set(
      fileEntries.map(({ path }) => path.split("/")[0]).filter(Boolean)
    );
    const hasSingleRoot = topLevelFolders.size === 1 &&
      fileEntries.every(({ path }) => path.includes("/"));
    const rootPrefix = hasSingleRoot ? `${Array.from(topLevelFolders)[0]}/` : "";

    for (const item of fileEntries) {
      const entry = item.entry;
      const normalized = rootPrefix ? item.path.replace(rootPrefix, "") : item.path;
      if (!normalized || isHiddenPath(normalized)) {
        continue;
      }
      const kind = isTextFile(normalized) ? "text" : "binary";
      if (kind === "text") {
        const content = await entry.async("string");
        setFile({ path: normalized, kind: "text", data: content, mime: fileMime(normalized) });
      } else {
        const buffer = await entry.async("arraybuffer");
        setFile({ path: normalized, kind: "binary", data: buffer, mime: fileMime(normalized) });
      }
    }
    renderFileTree();
    openFirstFile();
    queueSave();
    queuePreview();
  } catch (error) {
    console.error(error);
    alert("Import failed. Check the console for details.");
  }
}

async function buildZipBlob() {
  const JSZip = await ensureJSZip();
  const zip = new JSZip();
  for (const file of state.files.values()) {
    if (file.kind === "binary") {
      zip.file(file.path, file.data);
    } else {
      zip.file(file.path, file.data);
    }
  }
  return zip.generateAsync({ type: "blob" });
}

async function exportZip() {
  try {
    const blob = await buildZipBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `project-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    alert("Export failed. Check the console for details.");
  }
}

async function publishProject() {
  try {
    const hasMeta = await ensurePublishMetadata();
    if (!hasMeta) return;
    setStatus("Publishing...", 0);
    const blob = await buildZipBlob();
    const form = new FormData();
    form.append("zip", blob, `project-${Date.now()}.zip`);
    form.append("name", state.projectName);
    form.append("creator", state.projectCreator);
    form.append("description", state.projectDescription);
    const response = await fetch(PUBLISH_ENDPOINT, {
      method: "POST",
      body: form,
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(raw || `Publish failed (${response.status})`);
    }
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw new Error(`Publish failed: ${raw.slice(0, 300)}`);
    }
    if (data?.url) {
      setStatus("Published");
      openPublishModal(data.url);
    } else {
      setStatus("Published");
      alert("Published! Check the projects directory for your site.");
    }
  } catch (error) {
    console.error(error);
    setStatus("Publish failed", 2000);
    alert("Publish failed. Check the console for details.");
  }
}

async function resetProject() {
  if (!confirm("Start a new project? This will clear the current workspace.")) return;
  const name = prompt("Name your project:", DEFAULT_PROJECT_NAME);
  state.projectId = createProjectId();
  state.projectName = normalizeProjectName(name);
  state.projectDescription = "";
  state.projectCreator = "";
  localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
  state.files = new Map();
  state.editorDocs = new Map();
  const defaults = createDefaultFiles();
  defaults.forEach((file) => setFile({ ...file }));
  renderFileTree();
  openFirstFile();
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  queuePreview();
}

function isDarkTheme(theme) {
  if (theme && theme !== "auto") return theme === "dark";
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function updateThemeToggleLabel(theme) {
  if (!elements.themeToggleBtn) return;
  const mode = theme || "auto";
  const order = ["auto", "light", "dark"];
  const nextMode = order[(order.indexOf(mode) + 1) % order.length];
  elements.themeToggleBtn.title = `Theme: ${mode[0].toUpperCase()}${mode.slice(1)} (switch to ${nextMode})`;
}

function applyTheme(theme) {
  if (theme === "dark" || theme === "light") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  updateThemeToggleLabel(theme);
}

function toggleTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) || "auto";
  const order = ["auto", "light", "dark"];
  const next = order[(order.indexOf(stored) + 1) % order.length];
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
}

function resolveEditorTheme(theme) {
  if (theme === "dark" || theme === "light") return theme;
  return isDarkTheme(null) ? "dark" : "light";
}

function updateEditorThemeToggleLabel(theme) {
  if (!elements.editorThemeToggleBtn) return;
  const resolved = resolveEditorTheme(theme);
  const next = resolved === "dark" ? "light" : "dark";
  const icon = resolved === "dark" ? "moon-star" : "sun";
  elements.editorThemeToggleBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
  elements.editorThemeToggleBtn.title = `Editor: ${resolved} (switch to ${next})`;
  refreshIcons();
}

function applyEditorTheme(theme) {
  const resolved = resolveEditorTheme(theme);
  document.documentElement.setAttribute("data-editor-theme", resolved);
  if (codeMirror) {
    codeMirror.setOption("theme", resolved === "dark" ? "material-darker" : "default");
  }
  updateEditorThemeToggleLabel(theme);
}

function toggleEditorTheme() {
  const stored = localStorage.getItem(EDITOR_THEME_KEY);
  const current = resolveEditorTheme(stored);
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(EDITOR_THEME_KEY, next);
  applyEditorTheme(next);
}

function setupEvents() {
  if (codeMirror) {
    codeMirror.on("change", () => {
      if (state.suppressEditorChange) return;
      updateCurrentFile(getEditorValue());
      queueSave();
      queuePreview();
    });
  } else {
    elements.editor.addEventListener("input", () => {
      updateCurrentFile(elements.editor.value);
      queueSave();
      queuePreview();
    });
  }

  elements.newProjectBtn.addEventListener("click", resetProject);
  elements.importZipBtn.addEventListener("click", () => elements.zipInput.click());
  elements.exportZipBtn.addEventListener("click", exportZip);
  elements.publishBtn.addEventListener("click", publishProject);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.editorThemeToggleBtn.addEventListener("click", toggleEditorTheme);
  elements.prettifyBtn.addEventListener("click", prettifyCurrentFile);
  elements.projectMetaBtn.addEventListener("click", openProjectMetaModal);
  elements.closeProjectMetaBtn.addEventListener("click", closeProjectMetaModal);
  elements.saveProjectMetaBtn.addEventListener("click", saveProjectMeta);
  elements.projectMetaModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closeProjectMetaModal();
    }
  });
  elements.closePublishModalBtn.addEventListener("click", closePublishModal);
  elements.publishModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closePublishModal();
    }
  });
  elements.copyPublishUrlBtn.addEventListener("click", async () => {
    const url = elements.publishUrlText.textContent.trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Copied");
    } catch (error) {
      console.error(error);
      alert("Copy failed. You can manually copy the URL.");
    }
  });
  elements.openPublishUrlBtn.addEventListener("click", () => {
    const url = elements.openPublishUrlBtn.dataset.url;
    if (url) {
      window.open(url, "_blank", "noopener");
    }
  });
  elements.undoBtn.addEventListener("click", () => {
    if (codeMirror) {
      codeMirror.undo();
      codeMirror.focus();
      return;
    }
    elements.editor.focus();
    document.execCommand("undo");
  });
  elements.redoBtn.addEventListener("click", () => {
    if (codeMirror) {
      codeMirror.redo();
      codeMirror.focus();
      return;
    }
    elements.editor.focus();
    document.execCommand("redo");
  });
  elements.projectManagerBtn.addEventListener("click", () => toggleProjectManager());
  elements.closeProjectManagerBtn.addEventListener("click", () => toggleProjectManager(false));
  elements.renameProjectBtn.addEventListener("click", renameProject);
  elements.saveProjectBtn.addEventListener("click", saveCurrentProject);
  elements.saveProjectAsBtn.addEventListener("click", saveProjectAs);
  elements.projectNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renameProject();
    }
  });
  elements.addFileBtn.addEventListener("click", () => {
    const path = prompt("New file path (e.g. assets/main.css):");
    if (path) addFile(path);
  });
  elements.uploadFileBtn.addEventListener("click", () => elements.fileInput.click());
  elements.refreshPreviewBtn.addEventListener("click", renderPreview);
  elements.toggleFilePanelBtn.addEventListener("click", () => setFilePanelCollapsed(true));
  elements.expandFilePanelBtn.addEventListener("click", () => setFilePanelCollapsed(false));
  elements.splitter.addEventListener("pointerdown", startResize);

  elements.zipInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) importZip(file);
    event.target.value = "";
  });

  elements.fileInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) handleFileUpload(files);
    event.target.value = "";
  });

  document.addEventListener("click", (event) => {
    if (elements.projectManagerPanel.classList.contains("hidden")) return;
    const isInside = elements.projectManagerPanel.contains(event.target) ||
      elements.projectManagerBtn.contains(event.target);
    if (!isInside) toggleProjectManager(false);
  });
}

function setFilePanelCollapsed(collapsed) {
  elements.workspace.classList.toggle("file-collapsed", collapsed);
  elements.expandFilePanelBtn.classList.toggle("hidden", !collapsed);
  elements.toggleFilePanelBtn.title = collapsed ? "Show files" : "Collapse files";
  const icon = collapsed ? "chevrons-right" : "chevrons-left";
  elements.toggleFilePanelBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
  refreshIcons();
  localStorage.setItem("stitch:file-panel-collapsed", collapsed ? "1" : "0");
}

function applyStoredLayout() {
  const collapsed = localStorage.getItem("stitch:file-panel-collapsed") === "1";
  setFilePanelCollapsed(collapsed);
  const storedWidth = Number(localStorage.getItem("stitch:editor-width"));
  if (storedWidth) {
    elements.editorPanel.style.flex = `0 0 ${storedWidth}px`;
  }
}

function applyStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(storedTheme);
  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (!localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(THEME_STORAGE_KEY) === "auto") {
        updateThemeToggleLabel("auto");
        if (!localStorage.getItem(EDITOR_THEME_KEY)) {
          applyEditorTheme(null);
        }
      }
    };
    media.addEventListener("change", handler);
  }
}

function updateProjectManagerFields() {
  if (!elements.projectNameInput) return;
  elements.projectNameInput.value = state.projectName;
  if (elements.currentProjectName) {
    elements.currentProjectName.textContent = state.projectName;
  }
  if (elements.projectCreatorInput) {
    elements.projectCreatorInput.value = state.projectCreator;
  }
  if (elements.projectDescriptionInput) {
    elements.projectDescriptionInput.value = state.projectDescription;
  }
}

function openProjectMetaModal() {
  updateProjectManagerFields();
  elements.projectMetaModal.classList.remove("hidden");
}

function closeProjectMetaModal() {
  elements.projectMetaModal.classList.add("hidden");
}

async function saveProjectMeta() {
  state.projectCreator = String(elements.projectCreatorInput.value || "").trim();
  state.projectDescription = String(elements.projectDescriptionInput.value || "").trim();
  closeProjectMetaModal();
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
}

function openPublishModal(url) {
  elements.publishUrlText.textContent = url;
  elements.openPublishUrlBtn.dataset.url = url;
  elements.publishModal.classList.remove("hidden");
}

function closePublishModal() {
  elements.publishModal.classList.add("hidden");
}

async function ensurePublishMetadata() {
  if (state.projectCreator && state.projectDescription) {
    return true;
  }
  const creator = state.projectCreator || prompt("Creator name:", state.projectCreator);
  if (creator === null) return false;
  const description = state.projectDescription || prompt("Project description:", state.projectDescription);
  if (description === null) return false;
  state.projectCreator = String(creator || "").trim();
  state.projectDescription = String(description || "").trim();
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  return true;
}

async function renderProjectManager() {
  updateProjectManagerFields();
  if (!elements.projectList) return;
  const projects = await dbGetAll();
  const sorted = projects
    .filter((item) => item.data && item.data.files?.length)
    .sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));

  elements.projectList.innerHTML = "";
  if (!sorted.length) {
    const empty = document.createElement("div");
    empty.className = "project-item";
    empty.textContent = "No saved projects yet.";
    elements.projectList.appendChild(empty);
    return;
  }

  for (const project of sorted) {
    const item = document.createElement("div");
    item.className = "project-item";
    if (project.id === state.projectId) item.classList.add("active");

    const meta = document.createElement("div");
    meta.className = "project-meta";

    const name = document.createElement("div");
    name.className = "project-name";
    name.textContent = normalizeProjectName(project.data?.name);

    const updated = document.createElement("div");
    updated.className = "project-updated";
    const timestamp = project.data?.updatedAt ? new Date(project.data.updatedAt) : null;
    updated.textContent = timestamp ? `Updated ${timestamp.toLocaleString()}` : "Saved";

    meta.append(name, updated);

    const actions = document.createElement("div");
    actions.className = "project-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "project-action";
    openBtn.textContent = project.id === state.projectId ? "Current" : "Open";
    openBtn.disabled = project.id === state.projectId;
    openBtn.addEventListener("click", () => loadProjectById(project.id));

    const renameBtn = document.createElement("button");
    renameBtn.className = "project-action";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", () => renameProjectById(project.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "project-action danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = project.id === state.projectId;
    deleteBtn.addEventListener("click", () => deleteProjectById(project.id));

    actions.append(openBtn, renameBtn, deleteBtn);
    item.append(meta, actions);
    elements.projectList.appendChild(item);
  }
}

function toggleProjectManager(force) {
  const isOpen = !elements.projectManagerPanel.classList.contains("hidden");
  const nextOpen = typeof force === "boolean" ? force : !isOpen;
  elements.projectManagerPanel.classList.toggle("hidden", !nextOpen);
  if (nextOpen) {
    renderProjectManager();
  }
}

async function loadProjectById(projectId) {
  const project = await dbGet(projectId);
  if (!project || !project.files?.length) return;
  state.projectId = projectId;
  state.projectName = normalizeProjectName(project.name);
  localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
  loadProject(project);
  renderFileTree();
  openFirstFile();
  renderPreview();
  renderProjectManager();
}

async function renameProjectById(projectId) {
  const project = await dbGet(projectId);
  if (!project) return;
  const currentName = normalizeProjectName(project.name);
  const name = prompt("Rename project:", currentName);
  if (!name) return;
  const updatedProject = { ...project, name: normalizeProjectName(name), updatedAt: Date.now() };
  await dbSet(projectId, updatedProject);
  if (projectId === state.projectId) {
    state.projectName = updatedProject.name;
  }
  renderProjectManager();
}

async function deleteProjectById(projectId) {
  if (!confirm("Delete this project? This cannot be undone.")) return;
  await dbDelete(projectId);
  renderProjectManager();
}

async function saveCurrentProject() {
  try {
    localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
    await dbSet(state.projectId, serializeProject());
    setStatus("Saved");
    renderProjectManager();
  } catch (error) {
    console.error(error);
    setStatus("Save failed", 2000);
  }
}

async function saveProjectAs() {
  const name = prompt("Save project as:", state.projectName);
  if (!name) return;
  state.projectId = createProjectId();
  state.projectName = normalizeProjectName(name);
  localStorage.setItem(CURRENT_PROJECT_KEY, state.projectId);
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  setStatus("Saved");
}

async function renameProject() {
  const name = normalizeProjectName(elements.projectNameInput.value);
  state.projectName = name;
  await dbSet(state.projectId, serializeProject());
  renderProjectManager();
  setStatus("Renamed");
}

function startResize(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  state.isResizing = true;
  document.body.classList.add("resizing");
  const startX = event.clientX;
  const startWidth = elements.editorPanel.getBoundingClientRect().width;
  const splitterWidth = elements.splitter.getBoundingClientRect().width;
  elements.previewFrame.style.pointerEvents = "none";
  elements.splitter.setPointerCapture(event.pointerId);

  const onMove = (moveEvent) => {
    if (!state.isResizing) return;
    const delta = moveEvent.clientX - startX;
    const workspaceWidth = elements.workspace.getBoundingClientRect().width;
    const fileWidth = elements.workspace.classList.contains("file-collapsed")
      ? 0
      : elements.filePanel.getBoundingClientRect().width;
    const availableWidth = workspaceWidth - fileWidth - splitterWidth;
    const minEditor = 240;
    const minPreview = 220;
    const maxEditor = Math.max(minEditor, availableWidth - minPreview);
    const nextWidth = Math.max(minEditor, Math.min(maxEditor, startWidth + delta));
    const previewWidth = Math.max(minPreview, availableWidth - nextWidth);
    elements.editorPanel.style.flex = `0 0 ${nextWidth}px`;
    elements.previewPanel.style.flex = `1 1 ${previewWidth}px`;
  };

  const stopResize = () => {
    if (!state.isResizing) return;
    state.isResizing = false;
    document.body.classList.remove("resizing");
    elements.previewFrame.style.pointerEvents = "";
    const finalWidth = elements.editorPanel.getBoundingClientRect().width;
    localStorage.setItem("stitch:editor-width", Math.round(finalWidth).toString());
    elements.splitter.removeEventListener("pointermove", onMove);
    elements.splitter.removeEventListener("pointerup", stopResize);
    elements.splitter.removeEventListener("pointercancel", stopResize);
    elements.splitter.removeEventListener("lostpointercapture", stopResize);
  };

  elements.splitter.addEventListener("pointermove", onMove);
  elements.splitter.addEventListener("pointerup", stopResize);
  elements.splitter.addEventListener("pointercancel", stopResize);
  elements.splitter.addEventListener("lostpointercapture", stopResize);
}

function initCodeMirror() {
  if (!window.CodeMirror) return;
  codeMirror = window.CodeMirror.fromTextArea(elements.editor, {
    lineNumbers: true,
    lineWrapping: false,
    theme: "material-darker",
    mode: "htmlmixed",
  });
  codeMirror.setSize("100%", "100%");
}

initCodeMirror();
refreshIcons();
applyStoredTheme();
applyEditorTheme(localStorage.getItem(EDITOR_THEME_KEY));
applyStoredLayout();
setupEvents();
loadInitialProject();
