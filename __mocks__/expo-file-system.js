// In-memory subset of the expo-file-system (SDK 58) object API that the vault
// file service uses. Sync/async-ness mirrors the real module: `exists` is a
// property, `delete()`/`create()` are sync, `bytes()`/`write()`/`move()` are
// async. `move` with an existing destination throws unless `overwrite` is set,
// as the native implementations do.
const { Buffer } = require('buffer');

const files = new Map(); // uri → Uint8Array
let failNextWrite = new Set(); // file names
let failNextMove = new Set(); // source file names

const join = (parts) =>
  parts
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .map((s, i) => (i === 0 ? s.replace(/\/+$/, '') : s.replace(/^\/+|\/+$/g, '')))
    .join('/');

const basename = (uri) => uri.slice(uri.lastIndexOf('/') + 1);

const toBytes = (content) => {
  if (content instanceof Uint8Array) return new Uint8Array(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content.slice(0));
  if (typeof content === 'string') return new Uint8Array(Buffer.from(content, 'utf8'));
  throw new Error('Unsupported content type');
};

class Directory {
  constructor(...uris) {
    this.uri = join(uris);
  }
  get exists() {
    return true;
  }
  create() {}
  delete() {}
  get name() {
    return basename(this.uri);
  }
}

class File {
  constructor(...uris) {
    this.uri = join(uris);
  }
  get name() {
    return basename(this.uri);
  }
  get exists() {
    return files.has(this.uri);
  }
  async bytes() {
    if (!files.has(this.uri)) throw new Error(`File '${this.uri}' does not exist`);
    return new Uint8Array(files.get(this.uri));
  }
  bytesSync() {
    if (!files.has(this.uri)) throw new Error(`File '${this.uri}' does not exist`);
    return new Uint8Array(files.get(this.uri));
  }
  async write(content) {
    if (failNextWrite.has(this.name)) {
      failNextWrite.delete(this.name);
      throw new Error(`simulated write failure for ${this.name}`);
    }
    files.set(this.uri, toBytes(content));
  }
  create(options) {
    if (files.has(this.uri) && !(options && options.overwrite)) {
      throw new Error(`File '${this.uri}' already exists`);
    }
    files.set(this.uri, new Uint8Array(0));
  }
  delete() {
    if (!files.has(this.uri)) throw new Error(`File '${this.uri}' does not exist`);
    files.delete(this.uri);
  }
  async move(destination, options) {
    if (failNextMove.has(this.name)) {
      failNextMove.delete(this.name);
      throw new Error(`simulated move failure for ${this.name}`);
    }
    if (!files.has(this.uri)) throw new Error(`File '${this.uri}' does not exist`);
    const destUri = destination instanceof Directory ? join([destination.uri, this.name]) : destination.uri;
    if (files.has(destUri) && !(options && options.overwrite)) {
      throw new Error(`Destination '${destUri}' already exists`);
    }
    files.set(destUri, files.get(this.uri));
    files.delete(this.uri);
    this.uri = destUri;
  }
  async copy(destination, options) {
    const destUri = destination instanceof Directory ? join([destination.uri, this.name]) : destination.uri;
    if (files.has(destUri) && !(options && options.overwrite)) {
      throw new Error(`Destination '${destUri}' already exists`);
    }
    files.set(destUri, new Uint8Array(files.get(this.uri)));
  }
}

const Paths = {
  document: new Directory('file:///mock/documents/'),
  cache: new Directory('file:///mock/cache/'),
};

module.exports = {
  // Lets `import * as X` / named imports hand every importer this same object
  // (no interop copy), so spies set in a test reach the code under test.
  __esModule: true,
  File,
  Directory,
  Paths,

  // Test helpers
  __files: files,
  __reset() {
    files.clear();
    failNextWrite = new Set();
    failNextMove = new Set();
  },
  __failNextWrite(name) {
    failNextWrite.add(name);
  },
  __failNextMove(name) {
    failNextMove.add(name);
  },
};
