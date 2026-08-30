#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines2(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines2(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse2;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/cli/commands/assess.command.ts
import { statSync } from "fs";

// src/evidence/models/observation.model.ts
var EVIDENCE_READINGS = ["SUSTAINED", "DEMONSTRATED"];

// src/evidence/resolution/resolve-evidence.ts
function resolveEvidence(observations, axes) {
  return axes.flatMap(
    (axis) => EVIDENCE_READINGS.map(
      (reading) => resolveAxis(
        axis,
        reading,
        observations.filter(
          (observation4) => observation4.axis === axis && observation4.reading === reading
        )
      )
    )
  );
}
function resolveAxis(axis, reading, observations) {
  if (observations.length === 0) {
    return { axis, reading, status: "UNKNOWN", value: null, demonstration: null, observations };
  }
  const observed = observations.filter((observation4) => observation4.kind === "OBSERVED");
  const [firstObserved, ...restObserved] = observed;
  if (firstObserved === void 0) {
    return { axis, reading, status: "CLAIMED", value: null, demonstration: null, observations };
  }
  const confirmedValue = agreedValue(firstObserved, restObserved);
  if (confirmedValue !== void 0) {
    return {
      axis,
      reading,
      status: "CONFIRMED",
      value: confirmedValue,
      // LIMITATION: the share of the observation that carried the agreed value. Two collectors
      // agreeing on a value may have counted different numbers of occasions, and nothing here
      // reconciles them; the first is taken. A second forge would make that a real choice.
      demonstration: firstObserved.demonstration,
      observations
    };
  }
  return { axis, reading, status: "CONFLICTING", value: null, demonstration: null, observations };
}
function agreedValue(first, rest) {
  return rest.every((observation4) => sameValue(observation4.value, first.value)) ? first.value : void 0;
}
function sameValue(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    const setA = new Set(a);
    const setB = new Set(b);
    return setA.size === setB.size && [...setA].every((member) => setB.has(member));
  }
  return a === b;
}

// src/evidence/usecases/collect-evidence.usecase.ts
async function collectEvidence(request) {
  const requestedAxes = request.vocabulary.map((scale) => scale.axis);
  const context = {
    path: request.path,
    vocabulary: request.vocabulary,
    signal: request.signal
  };
  const outcomes = await Promise.all(
    request.collectors.map((collector) => runCollector(collector, requestedAxes, context))
  );
  const observations = outcomes.flatMap((outcome) => outcome.run.observations);
  return {
    evidence: resolveEvidence(observations, requestedAxes),
    provenance: outcomes.map(toProvenance),
    diagnostics: outcomes.flatMap((outcome) => outcome.run.diagnostics)
  };
}
async function runCollector(collector, requestedAxes, context) {
  const responsibleAxes = collector.supportedAxes.filter((axis) => requestedAxes.includes(axis));
  if (responsibleAxes.length === 0) {
    return {
      responsibleAxes,
      run: {
        collector: collector.id,
        status: "SKIPPED",
        observations: [],
        diagnostics: [],
        reason: `${collector.id} supports none of the requested axes`
      }
    };
  }
  try {
    const collection = await collector.collect(context);
    return {
      responsibleAxes,
      run: {
        collector: collector.id,
        status: "COMPLETED",
        observations: collection.observations,
        diagnostics: collection.diagnostics
      }
    };
  } catch (error) {
    return {
      responsibleAxes,
      run: {
        collector: collector.id,
        status: context.signal.aborted ? "TIMED_OUT" : "FAILED",
        observations: [],
        diagnostics: [],
        reason: reasonFor(error)
      }
    };
  }
}
function reasonFor(error) {
  return error instanceof Error ? error.message : String(error);
}
function toProvenance({ run: run2, responsibleAxes }) {
  if (run2.status === "COMPLETED") {
    return { collector: run2.collector, status: "COMPLETED", axes: responsibleAxes };
  }
  return { collector: run2.collector, status: run2.status, axes: responsibleAxes, reason: run2.reason };
}

// src/maturity/models/invalid-maturity-model.error.ts
var InvalidMaturityModelError = class extends Error {
};

// src/maturity/models/scale-for-axis.ts
function scaleNamedBy(model, axis) {
  const scale = Object.hasOwn(model.scales, axis.scale) ? model.scales[axis.scale] : void 0;
  if (scale === void 0) {
    throw new InvalidMaturityModelError(
      `Axis '${axis.id}' names a scale the model does not declare: '${axis.scale}'.`
    );
  }
  return scale;
}
function scaleForAxis(model, axisId) {
  const axis = model.axes.find((candidate) => candidate.id === axisId);
  if (axis === void 0) {
    throw new InvalidMaturityModelError(`Unknown axis '${axisId}'.`);
  }
  return scaleNamedBy(model, axis);
}

// src/assessment/composition/axis-vocabulary.ts
function axisVocabularyOf(model) {
  return model.axes.map((axis) => vocabularyFor(axis, scaleNamedBy(model, axis)));
}
function vocabularyFor(axis, scale) {
  switch (scale.kind) {
    case "ordinal":
      return { axis: axis.id, kind: "ordinal", values: scale.values };
    case "set":
      return { axis: axis.id, kind: "set", members: scale.members };
    case "numeric":
      return { axis: axis.id, kind: "numeric" };
  }
}

// src/maturity/engine/invalid-observation.error.ts
var InvalidObservationError = class extends Error {
};

// src/maturity/models/maturity.model.ts
function isSetRequirement(requirement) {
  return "includes" in requirement;
}

// src/maturity/models/threshold-on-scale.ts
function requireThresholdOnScale(scale, requirement, context = "") {
  const prefix = context.length > 0 ? `${context}: ` : "";
  if (isSetRequirement(requirement)) {
    if (scale.kind !== "set") {
      throw new InvalidMaturityModelError(
        sentence(prefix, `axis '${requirement.axis}' is not a set scale but declares 'includes'.`)
      );
    }
    for (const member of requirement.includes) {
      if (!scale.members.includes(member)) {
        throw new InvalidMaturityModelError(
          sentence(prefix, `member '${member}' is not on the '${requirement.axis}' scale.`)
        );
      }
    }
    return;
  }
  if (scale.kind === "set") {
    throw new InvalidMaturityModelError(
      sentence(prefix, `axis '${requirement.axis}' is a set scale and needs 'includes'.`)
    );
  }
  if (scale.kind === "numeric") {
    if (typeof requirement.min !== "number") {
      throw new InvalidMaturityModelError(
        sentence(prefix, `axis '${requirement.axis}' is numeric but its minimum is not a number.`)
      );
    }
    if (!Number.isFinite(requirement.min)) {
      throw new InvalidMaturityModelError(
        sentence(
          prefix,
          `axis '${requirement.axis}'.min must be a finite number, got ${String(requirement.min)}.`
        )
      );
    }
  }
  if (scale.kind === "ordinal" && !scale.values.includes(String(requirement.min))) {
    throw new InvalidMaturityModelError(
      sentence(
        prefix,
        `threshold '${String(requirement.min)}' is not on the '${requirement.axis}' scale.`
      )
    );
  }
}
function sentence(prefix, body) {
  if (prefix.length > 0) return `${prefix}${body}`;
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}`;
}

// src/maturity/engine/scale-comparison.ts
function reaches(model, requirement, value) {
  const scale = scaleForAxis(model, requirement.axis);
  requireThresholdOnScale(scale, requirement);
  if (isSetRequirement(requirement)) {
    return holdsEveryMember(requirement, value);
  }
  if (scale.kind === "ordinal") {
    return reachesOrdinalRank(scale, requirement, value);
  }
  return meetsNumericMinimum(requirement, value);
}
function holdsEveryMember(requirement, value) {
  if (!isMemberSet(value)) {
    throw new InvalidObservationError(`Axis '${requirement.axis}' expects a set of values.`);
  }
  return requirement.includes.every((member) => value.includes(member));
}
function reachesOrdinalRank(scale, requirement, value) {
  const observedRank = scale.values.indexOf(String(value));
  if (observedRank === -1) {
    throw new InvalidObservationError(
      `Value '${String(value)}' is not on the '${requirement.axis}' scale.`
    );
  }
  return observedRank >= scale.values.indexOf(String(requirement.min));
}
function meetsNumericMinimum(requirement, value) {
  if (typeof value !== "number") {
    throw new InvalidObservationError(`Axis '${requirement.axis}' expects a numeric value.`);
  }
  return value >= Number(requirement.min);
}
function isMemberSet(value) {
  return Array.isArray(value);
}

// src/maturity/engine/requirement-outcome.ts
function outcomeOf(model, requirement, observation4) {
  if (observation4 === void 0 || observation4.confidence !== "CONFIRMED") {
    return "UNPROVEN";
  }
  return reaches(model, requirement, observation4.value) ? "MET" : "NOT_MET";
}
function aggregate(outcomes) {
  if (outcomes.includes("NOT_MET")) return "NOT_MET";
  if (outcomes.includes("UNPROVEN")) return "UNPROVEN";
  return "MET";
}

// src/maturity/engine/maturity-engine.ts
function checkMaturity(model, observations) {
  const observationsByAxis = indexObservations(observations);
  const levels = evaluateLevels(model, observationsByAxis);
  const proven = highestProven(levels);
  const next = levelAbove(levels, proven);
  return { levels, proven, next };
}
function indexObservations(observations) {
  const byAxis = /* @__PURE__ */ new Map();
  for (const observation4 of observations) {
    if (byAxis.has(observation4.axis)) {
      throw new InvalidObservationError(`Duplicate observation for axis '${observation4.axis}'.`);
    }
    byAxis.set(observation4.axis, observation4);
  }
  return byAxis;
}
function evaluateLevels(model, observations) {
  return [...model.levels].sort((a, b) => a.rank - b.rank).map((level) => evaluateLevel(model, level, observations));
}
function evaluateLevel(model, level, observations) {
  requireDeclaredAxes(model, level);
  const axes = model.axes.map((axis) => evaluateAxis(model, level, axis, observations));
  return { level, outcome: aggregate(axes.map((axis) => axis.outcome)), axes };
}
function requireDeclaredAxes(model, level) {
  const declared = new Set(model.axes.map((axis) => axis.id));
  for (const requirement of level.requirements) {
    if (!declared.has(requirement.axis)) {
      throw new InvalidMaturityModelError(
        `Level '${level.id}' requires an axis the model does not declare: '${requirement.axis}'.`
      );
    }
  }
}
function evaluateAxis(model, level, axis, observations) {
  const observation4 = observations.get(axis.id);
  const declared = level.requirements.filter((requirement) => requirement.axis === axis.id);
  if (declared.length === 0) {
    throw new InvalidMaturityModelError(
      `Level '${level.id}' declares no requirement for axis '${axis.id}'.`
    );
  }
  const requirements = declared.map(
    (requirement) => ({
      axis: axis.id,
      requirement,
      outcome: outcomeOf(model, requirement, observation4)
    })
  );
  return {
    axis: axis.id,
    outcome: aggregate(requirements.map((requirement) => requirement.outcome)),
    requirements
  };
}
function highestProven(levels) {
  return [...levels].reverse().find((result) => result.outcome === "MET") ?? null;
}
function levelAbove(levels, proven) {
  if (proven === null) return levels[0] ?? null;
  return levels.find((result) => result.level.rank > proven.level.rank) ?? null;
}

// src/assessment/contracts/assessment-report.contract.ts
var ASSESSMENT_REPORT_SCHEMA_VERSION = 1;

// src/assessment/composition/report-projection.ts
function toObservation(evidence) {
  switch (evidence.status) {
    case "CONFIRMED":
      return { axis: evidence.axis, confidence: "CONFIRMED", value: evidence.value };
    case "CLAIMED":
    case "CONFLICTING":
    case "UNKNOWN":
      return { axis: evidence.axis, confidence: evidence.status, value: null };
  }
}
function reportLevel(result, context) {
  return {
    id: result.level.id,
    rank: result.level.rank,
    label: result.level.label,
    outcome: result.outcome,
    axes: result.axes.map((axis) => reportAxis(axis, context))
  };
}
function reportAxis(result, context) {
  return {
    axis: result.axis,
    label: labelOf(result.axis, context),
    outcome: result.outcome,
    requirements: result.requirements.map(
      (requirement) => reportRequirement(
        requirement,
        context.evidenceByAxis.get(result.axis),
        context.diagnosticsByAxis.get(result.axis)
      )
    )
  };
}
function labelOf(axis, context) {
  const label = context.labelsByAxis.get(axis);
  if (label === void 0) {
    throw new Error(`Axis '${axis}' has no label in the loaded model.`);
  }
  return label;
}
function reportRequirement(result, evidence, diagnostic) {
  const threshold = thresholdOf(result.requirement);
  if (evidence === void 0) {
    return unprovenRequirement(result, threshold, "UNKNOWN", diagnostic);
  }
  switch (evidence.status) {
    case "CONFIRMED":
      if (result.outcome === "UNPROVEN") {
        throw contradiction(result, evidence.status);
      }
      return {
        axis: result.axis,
        threshold,
        observed: evidence.value,
        evidence: "CONFIRMED",
        outcome: result.outcome
      };
    case "CLAIMED":
    case "CONFLICTING":
    case "UNKNOWN":
      return unprovenRequirement(result, threshold, evidence.status, diagnostic);
  }
}
function unprovenRequirement(result, threshold, evidence, diagnostic) {
  if (result.outcome !== "UNPROVEN") {
    throw contradiction(result, evidence);
  }
  return {
    axis: result.axis,
    threshold,
    observed: null,
    evidence,
    outcome: "UNPROVEN",
    ...evidence === "UNKNOWN" && diagnostic !== void 0 ? { diagnostic } : {}
  };
}
function contradiction(result, evidence) {
  return new Error(
    `Axis '${result.axis}': ${evidence} evidence cannot produce outcome ${result.outcome}.`
  );
}
function thresholdOf(requirement) {
  return isSetRequirement(requirement) ? requirement.includes : requirement.min;
}
function blockersOf(next) {
  if (next === null) return [];
  return next.axes.flatMap(
    (axis) => axis.requirements.flatMap((requirement) => {
      switch (requirement.outcome) {
        case "MET":
          return [];
        case "NOT_MET":
          return [
            {
              level: next.id,
              axis: requirement.axis,
              evidence: requirement.evidence,
              outcome: "NOT_MET",
              gap: "PRACTICE"
            }
          ];
        case "UNPROVEN":
          return [
            {
              level: next.id,
              axis: requirement.axis,
              evidence: requirement.evidence,
              outcome: "UNPROVEN",
              gap: "EVIDENCE"
            }
          ];
      }
    })
  );
}
function reportDemonstrated(model, sustained, demonstrated2, proven) {
  const observed = demonstrated2.filter(
    (entry) => entry.status === "CONFIRMED" && entry.demonstration !== null
  );
  if (observed.length === 0) return null;
  const projection = model.axes.map((axis) => {
    const reached = observed.find((entry) => entry.axis === axis.id);
    return reached ?? sustained.find((entry) => entry.axis === axis.id);
  });
  const check = checkMaturity(
    model,
    projection.filter((entry) => entry !== void 0).map(toObservation)
  );
  const level = highestOf(check.proven, proven);
  return {
    level: level === null ? null : namedLevel(level),
    // INVARIANT: a confirmed demonstrated reading always carries its demonstration. Anything without
    // one is dropped rather than published at a fabricated share, because a demonstrated value the
    // reader cannot weigh is the maximum this whole reading exists to avoid.
    axes: observed.flatMap(
      (entry) => entry.demonstration === null ? [] : [
        {
          axis: entry.axis,
          observed: entry.value,
          share: entry.demonstration.share,
          unit: entry.demonstration.unit
        }
      ]
    )
  };
}
function namedLevel(result) {
  return {
    id: result.level.id,
    rank: result.level.rank,
    label: result.level.label,
    outcome: result.outcome
  };
}
function highestOf(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  return left.level.rank >= right.level.rank ? left : right;
}

// src/assessment/composition/compose-contributor-roster.ts
function composeContributorRoster(input) {
  const { model, run: run2 } = input;
  if (run2 === null) return null;
  if (run2.status !== "COMPLETED") {
    return { status: run2.status, rows: [], reason: run2.reason };
  }
  const axes = model.axes.map((axis) => axis.id);
  const rows = run2.records.map((record) => rowOf(model, axes, record));
  rows.sort(compareRows);
  return {
    status: "COMPLETED",
    windowDays: run2.windowDays,
    harnessObserved: run2.harnessObserved,
    harnessPaths: run2.harnessPaths,
    rows
  };
}
function rowOf(model, axes, record) {
  const evidence = resolveEvidence(record.observations, axes);
  const sustained = evidence.filter((entry) => entry.reading === "SUSTAINED");
  const demonstrated2 = evidence.filter((entry) => entry.reading === "DEMONSTRATED");
  const check = checkMaturity(model, sustained.map(toObservation));
  const context = {
    evidenceByAxis: new Map(sustained.map((entry) => [entry.axis, entry])),
    // SAFETY: empty, and the reason is on `ProjectionContext` itself — a collector's diagnostic
    // answers for the repository's collection, and no collector failed on a row.
    diagnosticsByAxis: /* @__PURE__ */ new Map(),
    labelsByAxis: new Map(model.axes.map((axis) => [axis.id, axis.label]))
  };
  const proven = check.proven === null ? null : reportLevel(check.proven, context);
  const next = check.next === null ? null : reportLevel(check.next, context);
  return {
    account: record.account,
    emailAddresses: record.emailAddresses,
    commits: record.commits,
    deliveries: record.deliveries,
    activeDays: record.activeDays,
    harnessAuthorship: record.harnessAuthorship,
    proven,
    next,
    observed: sustained.map((entry) => ({
      axis: entry.axis,
      value: entry.status === "CONFIRMED" ? entry.value : null,
      evidence: entry.status
    })),
    demonstrated: reportDemonstrated(model, sustained, demonstrated2, check.proven),
    blocking: blockersOf(next)
  };
}
function compareRows(left, right) {
  if (left.account === null && right.account === null) return 0;
  if (left.account === null) return 1;
  if (right.account === null) return -1;
  if (left.deliveries !== right.deliveries) return right.deliveries - left.deliveries;
  if (left.account < right.account) return -1;
  if (left.account > right.account) return 1;
  return 0;
}

// src/assessment/composition/undeclared-axis.error.ts
var UndeclaredAxisError = class extends Error {
};

// src/assessment/composition/compose-assessment-report.ts
function composeAssessmentReport(input) {
  const { model, evidence, subjectPath, provenance, diagnostics = [], roster } = input;
  requireDeclaredAxes2(model, evidence);
  const sustained = evidence.filter((entry) => entry.reading === "SUSTAINED");
  const demonstrated2 = evidence.filter((entry) => entry.reading === "DEMONSTRATED");
  const check = checkMaturity(model, sustained.map(toObservation));
  const context = {
    evidenceByAxis: new Map(sustained.map((entry) => [entry.axis, entry])),
    diagnosticsByAxis: new Map(diagnostics.map((diagnostic) => [diagnostic.axis, diagnostic])),
    labelsByAxis: new Map(model.axes.map((axis) => [axis.id, axis.label]))
  };
  const next = check.next === null ? null : reportLevel(check.next, context);
  const proven = check.proven === null ? null : reportLevel(check.proven, context);
  return {
    schemaVersion: ASSESSMENT_REPORT_SCHEMA_VERSION,
    model: { id: model.id, schemaVersion: model.schemaVersion },
    subject: { path: subjectPath },
    proven,
    next,
    demonstrated: reportDemonstrated(model, sustained, demonstrated2, check.proven),
    levels: check.levels.map((level) => reportLevel(level, context)),
    blocking: blockersOf(next),
    vocabulary: reportVocabulary(model),
    coverage: deriveCoverage(model, sustained),
    provenance: provenance.map(toProvenanceEntry),
    contributors: composeContributorRoster({ model, run: roster ?? null })
  };
}
function reportVocabulary(model) {
  return model.axes.map((axis) => {
    const scale = scaleNamedBy(model, axis);
    switch (scale.kind) {
      case "ordinal":
        return {
          axis: axis.id,
          kind: "ordinal",
          values: scale.values,
          descriptions: scale.descriptions
        };
      case "set":
        return {
          axis: axis.id,
          kind: "set",
          members: scale.members,
          descriptions: scale.descriptions
        };
      case "numeric":
        return { axis: axis.id, kind: "numeric", description: scale.description };
    }
  });
}
function deriveCoverage(model, evidence) {
  return {
    axesRequested: model.axes.length,
    axesObserved: evidence.filter((entry) => entry.observations.length > 0).length,
    axesConfirmed: evidence.filter((entry) => entry.status === "CONFIRMED").length
  };
}
function toProvenanceEntry(entry) {
  switch (entry.status) {
    case "COMPLETED":
      return { collector: entry.collector, status: "COMPLETED", axes: entry.axes };
    case "FAILED":
    case "TIMED_OUT":
    case "SKIPPED":
      return {
        collector: entry.collector,
        status: entry.status,
        axes: entry.axes,
        reason: entry.reason
      };
  }
}
function requireDeclaredAxes2(model, evidence) {
  const declared = new Set(model.axes.map((axis) => axis.id));
  for (const entry of evidence) {
    if (!declared.has(entry.axis)) {
      throw new UndeclaredAxisError(
        `Evidence names an axis the model does not declare: '${entry.axis}'.`
      );
    }
  }
}

// src/assessment/usecases/assess-maturity.usecase.ts
async function assessMaturity(request) {
  const { subjectPath, model, collectors, roster, signal } = request;
  const vocabulary = axisVocabularyOf(model);
  const { evidence, provenance, diagnostics } = await collectEvidence({
    path: subjectPath,
    vocabulary,
    collectors,
    signal
  });
  const run2 = await readRoster(roster, { path: subjectPath, vocabulary, signal });
  return composeAssessmentReport({
    subjectPath,
    model,
    evidence,
    provenance,
    diagnostics,
    roster: run2
  });
}
async function readRoster(roster, context) {
  if (roster === void 0) return null;
  try {
    return await roster.read(context);
  } catch (error) {
    return {
      status: context.signal.aborted ? "TIMED_OUT" : "FAILED",
      records: [],
      reason: reasonFor2(error)
    };
  }
}
function reasonFor2(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/evidence/adapters/fixture-bundle.adapter.ts
import { stat } from "fs/promises";
import { join as join3 } from "path";

// src/evidence/adapters/fixture-bundle/bundle-tree.ts
import { readdir, readFile, open } from "fs/promises";
import { join } from "path";
var RECORDED_ROOT = "repo-context/";
async function bundleTree(bundlePath, signal) {
  const files = await walk(bundlePath, signal);
  const sources = /* @__PURE__ */ new Map();
  const entries = [];
  for (const file of files) {
    const path = recordedPath(file);
    if (sources.has(path)) continue;
    sources.set(path, join(bundlePath, file));
    entries.push({ path, regularFile: true, executable: null });
  }
  return {
    entries: async () => entries,
    probe: (path, bytes) => probeFile(sources.get(path), bytes),
    read: (path) => readWholeFile(sources.get(path))
  };
}
function recordedPath(file) {
  return file.startsWith(RECORDED_ROOT) ? file.slice(RECORDED_ROOT.length) : file;
}
async function walk(root, signal, prefix = "") {
  signal.throwIfAborted();
  const listing = await readdir(join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of [...listing].sort((left, right) => left.name < right.name ? -1 : 1)) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(root, signal, path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
async function probeFile(absolute, bytes) {
  if (absolute === void 0) return null;
  let handle = null;
  try {
    handle = await open(absolute, "r");
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch {
    return null;
  } finally {
    try {
      await handle?.close();
    } catch {
    }
  }
}
async function readWholeFile(absolute) {
  if (absolute === void 0) return null;
  try {
    return await readFile(absolute, "utf8");
  } catch {
    return null;
  }
}

// src/evidence/adapters/fixture-bundle/recorded-activity.ts
import { readFile as readFile2 } from "fs/promises";
import { join as join2 } from "path";

// src/evidence/adapters/delivery-sample.ts
var WINDOW_DAYS = 180;
var MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1e3;
function windowStartFrom(endInstant) {
  return endInstant - WINDOW_DAYS * MILLISECONDS_PER_DAY;
}
var MINIMUM_DELIVERED_CHANGES = 5;
var MINIMUM_ACTIVE_DAYS = 5;
var DEMONSTRATED_SHARE = 1 / 3;
var MINIMUM_DEMONSTRATED_SAMPLE = 10;
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted.length % 2 === 1 ? upper : sorted[middle - 1];
  if (upper === void 0 || lower === void 0) {
    throw new RangeError("A median needs a non-empty sample.");
  }
  return (lower + upper) / 2;
}
function demonstratedFrom(sampleSize, candidates, atOrAbove) {
  if (sampleSize < MINIMUM_DEMONSTRATED_SAMPLE) return null;
  for (const candidate of [...candidates].reverse()) {
    const share = atOrAbove(candidate) / sampleSize;
    if (share >= DEMONSTRATED_SHARE) return { value: candidate, share };
  }
  return null;
}
function demonstratedCountFrom(occurrencesByCount) {
  const sampleSize = [...occurrencesByCount.values()].reduce((total, count) => total + count, 0);
  const seen = [...occurrencesByCount.keys()].sort((left, right) => left - right);
  return demonstratedFrom(
    sampleSize,
    seen,
    (candidate) => [...occurrencesByCount.entries()].filter(([count]) => count >= candidate).reduce((total, [, occurrences]) => total + occurrences, 0)
  );
}

// src/evidence/adapters/fixture-bundle/inconsistent-record.error.ts
var InconsistentRecordError = class extends Error {
  constructor(reason) {
    super(`The recorded activity contradicts itself: ${reason}`);
    this.name = "InconsistentRecordError";
  }
};

// src/evidence/adapters/autonomy.ts
var AUTONOMOUS_INTERVENTION = "never-once-framed";
var ZERO_TOUCH_SHARE_FOR_AUTONOMY = 0.9;

// src/evidence/adapters/intervention-scale.ts
var AFTER_THE_FACT_MOST_FROM = 2.5;
var AFTER_THE_FACT_SOME_FROM = 1.5;
var CORRECTED_INTERVENTION_RANKS = [
  "after-the-fact-most",
  "after-the-fact-some",
  "key-steps"
];
function correctedRankOf(value) {
  return CORRECTED_INTERVENTION_RANKS.indexOf(value);
}
function interventionFor(medianCorrectionsAfterOpen, zeroTouchShare2) {
  if (zeroTouchShare2 !== null && zeroTouchShare2 >= ZERO_TOUCH_SHARE_FOR_AUTONOMY) {
    return AUTONOMOUS_INTERVENTION;
  }
  if (medianCorrectionsAfterOpen >= AFTER_THE_FACT_MOST_FROM) return "after-the-fact-most";
  if (medianCorrectionsAfterOpen >= AFTER_THE_FACT_SOME_FROM) return "after-the-fact-some";
  return "key-steps";
}

// src/evidence/adapters/size-buckets.ts
var SIZE_BUCKETS = ["S", "M", "L", "XL"];
function bucketForLines(value) {
  if (value < 100) return "S";
  if (value < 400) return "M";
  if (value < 1e3) return "L";
  return "XL";
}
function bucketForFiles(value) {
  if (value < 5) return "S";
  if (value < 10) return "M";
  if (value < 25) return "L";
  return "XL";
}
function lowerBucket(left, right) {
  return SIZE_BUCKETS.indexOf(left) <= SIZE_BUCKETS.indexOf(right) ? left : right;
}

// src/evidence/adapters/fixture-bundle/recorded-activity.ts
var ACTIVITY_FILE = "git-activity.json";
var NOTHING_RECORDED = {
  sizeBucket: null,
  demonstratedParallelism: null,
  intervention: null,
  parallelism: null,
  aiAttribution: null
};
async function readRecordedActivity(bundlePath) {
  const document = await readJsonFile(join2(bundlePath, ACTIVITY_FILE));
  if (document === null) return NOTHING_RECORDED;
  const pullRequests = objectAt(document, "pull_requests");
  const total = numberAt(pullRequests, "total");
  return {
    sizeBucket: readSizeBucket(pullRequests, total),
    intervention: readIntervention(pullRequests, total),
    parallelism: numberAt(objectAt(document, "parallelism"), "median_concurrent_branches"),
    demonstratedParallelism: readDemonstratedParallelism(objectAt(document, "parallelism")),
    aiAttribution: readAiAttribution(objectAt(document, "commits"))
  };
}
function readSizeBucket(pullRequests, total) {
  if (total === 0) return "none";
  const lines = numberAt(pullRequests, "median_lines_changed");
  const files = numberAt(pullRequests, "median_files_changed");
  if (lines === null || files === null) return null;
  return lowerBucket(bucketForLines(lines), bucketForFiles(files));
}
function readIntervention(pullRequests, total) {
  if (total === 0) return "not-applicable";
  const corrections = numberAt(pullRequests, "median_correction_commits_after_open");
  if (corrections === null) return null;
  return interventionFor(corrections, zeroTouchShare(pullRequests, total));
}
function readDemonstratedParallelism(parallelism) {
  const days = objectAt(parallelism, "days_at_concurrency");
  if (typeof days !== "object" || days === null || Array.isArray(days)) return null;
  const daysAtConcurrency = /* @__PURE__ */ new Map();
  for (const [concurrency, activeDays] of Object.entries(days)) {
    const branches = Number(concurrency);
    if (!Number.isInteger(branches) || branches < 0) return null;
    if (typeof activeDays !== "number" || !Number.isInteger(activeDays) || activeDays < 0) {
      return null;
    }
    if (activeDays > 0) daysAtConcurrency.set(branches, activeDays);
  }
  if (daysAtConcurrency.size === 0) return null;
  const recorded = numberAt(parallelism, "median_concurrent_branches");
  const fromDistribution = medianOfCounts(daysAtConcurrency);
  if (recorded !== null && fromDistribution !== recorded) {
    throw new InconsistentRecordError(
      `parallelism records a median of ${recorded}, and its days_at_concurrency yields ${fromDistribution}.`
    );
  }
  return demonstratedCountFrom(daysAtConcurrency);
}
function medianOfCounts(occurrencesByCount) {
  const ordered = [...occurrencesByCount.entries()].sort(([left], [right]) => left - right);
  const total = ordered.reduce((sum, [, occurrences]) => sum + occurrences, 0);
  const at = (rank) => {
    let seen = 0;
    for (const [count, occurrences] of ordered) {
      seen += occurrences;
      if (seen > rank) return count;
    }
    return ordered[ordered.length - 1]?.[0] ?? 0;
  };
  const middle = Math.floor(total / 2);
  return total % 2 === 1 ? at(middle) : (at(middle - 1) + at(middle)) / 2;
}
function zeroTouchShare(pullRequests, total) {
  const untouched = numberAt(pullRequests, "merged_without_human_edit_after_open");
  if (untouched === null || total === null || total <= 0) return null;
  return untouched / total;
}
function readAiAttribution(commits) {
  const ratio = numberAt(commits, "ai_coauthored_ratio");
  return ratio === null ? null : ratio > 0;
}
async function readJsonFile(absolute) {
  let content;
  try {
    content = await readFile2(absolute, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function objectAt(document, key) {
  if (typeof document !== "object" || document === null) return null;
  return document[key];
}
function numberAt(document, key) {
  const value = objectAt(document, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// src/evidence/adapters/harness/decided-capabilities.ts
function decidedCapabilities(scan, scale) {
  const rankable = (member) => scale.members.includes(member);
  if (scan.undecidable.some(rankable)) return null;
  return scan.capabilities.filter(rankable);
}

// src/evidence/adapters/harness/capability-signals.ts
var TRANSCRIPT_FILES = ["session.md", "prompt-history.md", ".aider.chat.history.md"];
var TRANSCRIPT_DIRECTORIES = [".specstory/", ".claude/history/"];
var CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", "GEMINI.md", ".github/copilot-instructions.md"];
var CONTEXT_DIRECTORIES = ["aidd_docs/memory/", "docs/context/", ".ai/"];
var BEHAVIOR_DIRECTORIES = [
  ".claude/rules/",
  ".claude/agents/",
  ".claude/hooks/",
  ".claude/skills/",
  ".cursor/rules/",
  ".github/agents/"
];
var BEHAVIOR_FILES = [".cursorrules", ".windsurfrules"];
var SETTINGS_FILES = [
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".cursor/environment.json",
  ".gemini/settings.json"
];
function provesPrompts(tracked) {
  return matchingPaths(tracked, TRANSCRIPT_FILES, TRANSCRIPT_DIRECTORIES);
}
function provesContextEngineering(tracked) {
  return matchingPaths(tracked, CONTEXT_FILES, CONTEXT_DIRECTORIES);
}
async function provesBehavior(tree, tracked, signal) {
  const paths = tracked.map((entry) => entry.path);
  const matched = matchingPaths(paths, BEHAVIOR_FILES, BEHAVIOR_DIRECTORIES);
  if (matched.length > 0) return { paths: matched, undecidable: false };
  return declaresPermissions(tree, paths, signal);
}
async function declaresPermissions(tree, tracked, signal) {
  let undecidable = false;
  for (const settings of SETTINGS_FILES) {
    if (!tracked.includes(settings)) continue;
    signal.throwIfAborted();
    const content = await tree.read(settings);
    if (content === null) {
      undecidable = true;
      continue;
    }
    const document = parseSettings(content);
    if (!document.parsed) {
      undecidable = true;
      continue;
    }
    if (declaresPermissionList(document.value)) return { paths: [settings], undecidable: false };
  }
  return { paths: [], undecidable };
}
function parseSettings(content) {
  try {
    return { parsed: true, value: JSON.parse(content) };
  } catch {
    return { parsed: false };
  }
}
function declaresPermissionList(settings) {
  if (typeof settings !== "object" || settings === null) return false;
  const permissions = settings.permissions;
  if (typeof permissions !== "object" || permissions === null) return false;
  const { allow, deny } = permissions;
  return isNonEmptyArray(allow) || isNonEmptyArray(deny);
}
var isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;
function matchingPaths(tracked, names, directories) {
  return tracked.filter(
    (file) => matchesFileNamedAnywhere(file, names) || matchesPathUnderRootDirectory(file, directories)
  );
}
var matchesFileNamedAnywhere = (file, names) => names.some((name) => file === name || file.endsWith(`/${name}`));
var matchesPathUnderRootDirectory = (file, directories) => directories.some((directory) => file.startsWith(directory));

// src/evidence/adapters/harness/shell-tokens.ts
function endOfCall(code, open3) {
  let depth = 0;
  for (let index = open3; index < code.length; index++) {
    if (code[index] === "(") depth++;
    else if (code[index] === ")") {
      depth--;
      if (depth === 0) return index + 1;
    }
  }
  return code.length;
}
function stripShellNoise(source) {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? "";
    if (character === "#" && startsAWord(source, index)) {
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }
    if (character === "\\") {
      out += " ";
      index += 2;
      continue;
    }
    if (character === "'" || character === '"') {
      const quoted = character === "'" ? readSingleQuoted(source, index + 1) : readDoubleQuoted(source, index + 1);
      out += quoted.text;
      index = quoted.end;
      continue;
    }
    out += character;
    index++;
  }
  return out;
}
function readSingleQuoted(source, from) {
  let breaks = "";
  let index = from;
  while (index < source.length && source[index] !== "'") {
    if (source[index] === "\n") breaks += "\n";
    index++;
  }
  return { text: ` ${breaks} `, end: index + 1 };
}
function readDoubleQuoted(source, from) {
  let text = " ";
  let index = from;
  while (index < source.length && source[index] !== '"') {
    const character = source[index] ?? "";
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "\n") {
      text += "\n";
      index++;
      continue;
    }
    if (character === "$") {
      const expansion = readExpansion(source, index);
      text += expansion.text;
      index = expansion.end;
      continue;
    }
    index++;
  }
  return { text: `${text} `, end: index + 1 };
}
var COMMAND_SUBSTITUTION = "$__command_substitution__";
function readExpansion(source, from) {
  const next = source[from + 1] ?? "";
  if (next === "?") return { text: " $? ", end: from + 2 };
  if (next === "{") {
    const close = source.indexOf("}", from + 2);
    if (close === -1) return { text: " ", end: source.length };
    return { text: ` ${source.slice(from, close + 1)} `, end: close + 1 };
  }
  if (next === "(") {
    return { text: ` ${COMMAND_SUBSTITUTION} `, end: endOfCall(source, from + 1) };
  }
  if (/[A-Za-z_]/.test(next)) {
    let end = from + 1;
    while (/[A-Za-z0-9_]/.test(source[end] ?? "")) end++;
    return { text: ` ${source.slice(from, end)} `, end };
  }
  return { text: " ", end: from + 1 };
}
function startsAWord(source, index) {
  if (index === 0) return true;
  const previous = source[index - 1] ?? "";
  return /[\s;&|(]/.test(previous);
}
var stripArithmetic = (code) => code.replace(/\(\([^()]*\)\)/g, " : ");
var TOKEN_PATTERN = /&&|\|\||;;|;|\||&|\(|\)|\n|[^\s;|&()\n]+/g;
function tokenize(code) {
  return (code.match(TOKEN_PATTERN) ?? []).map(
    (token) => token === "\n" || token === ";;" ? ";" : token
  );
}
var SEPARATORS = /* @__PURE__ */ new Set([";", "&&", "||", "|", "&", "(", ")"]);
var KEYWORDS_BEFORE_COMMAND = /* @__PURE__ */ new Set([
  "do",
  "then",
  "else",
  "elif",
  "if",
  "while",
  "until",
  "!",
  "{",
  "}"
]);
var COMMAND_PREFIXES = /* @__PURE__ */ new Set([
  "env",
  "command",
  "exec",
  "nohup",
  "sudo",
  "time",
  "timeout",
  "nice",
  "stdbuf",
  "setsid",
  "xargs",
  "npx",
  "bunx",
  "pnpx",
  "uvx",
  "dlx"
]);
var OPERAND_OF_A_PREFIX = /^-|^\d+(\.\d+)?[smhd]?$/;
var ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
var SHELL_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;
var NOT_A_COMMAND = /* @__PURE__ */ new Set(["true", "false", ":", "[", "[[", "test", "read", "!"]);
function markCommandPositions(tokens) {
  const marks = tokens.map((_token, index) => {
    if (index === 0) return true;
    const previous = tokenAt(tokens, index - 1);
    return SEPARATORS.has(previous) || KEYWORDS_BEFORE_COMMAND.has(previous);
  });
  for (let index = 0; index < tokens.length; index++) {
    if (!markAt(marks, index)) continue;
    const token = tokenAt(tokens, index);
    if (COMMAND_PREFIXES.has(token)) {
      const target = indexOfPrefixTarget(tokens, index + 1);
      if (target !== -1) marks[target] = true;
      continue;
    }
    if (!ASSIGNMENT.test(token)) continue;
    const next = index + 1;
    if (next < tokens.length && !SEPARATORS.has(tokenAt(tokens, next))) marks[next] = true;
  }
  return marks;
}
function indexOfPrefixTarget(tokens, from) {
  for (let index = from; index < tokens.length; index++) {
    const token = tokenAt(tokens, index);
    if (SEPARATORS.has(token)) return -1;
    if (OPERAND_OF_A_PREFIX.test(token)) continue;
    return index;
  }
  return -1;
}
function findFunctionBodies(tokens, marks) {
  const bodies = /* @__PURE__ */ new Map();
  for (let index = 0; index < tokens.length; index++) {
    let nameIndex = -1;
    let braceIndex = -1;
    if (tokenAt(tokens, index) === "(" && tokenAt(tokens, index + 1) === ")" && index >= 1 && markAt(marks, index - 1) && SHELL_NAME.test(tokenAt(tokens, index - 1))) {
      nameIndex = index - 1;
      braceIndex = index + 2;
    } else if (markAt(marks, index) && tokenAt(tokens, index) === "function" && SHELL_NAME.test(tokenAt(tokens, index + 1))) {
      nameIndex = index + 1;
      braceIndex = index + 2;
      if (tokenAt(tokens, braceIndex) === "(" && tokenAt(tokens, braceIndex + 1) === ")") {
        braceIndex += 2;
      }
    }
    if (nameIndex === -1 || tokenAt(tokens, braceIndex) !== "{") continue;
    const end = indexOfMatchingBrace(tokens, braceIndex + 1);
    if (end === -1) continue;
    bodies.set(tokenAt(tokens, nameIndex), { start: braceIndex + 1, end });
  }
  return bodies;
}
function indexOfMatchingBrace(tokens, from) {
  let depth = 0;
  for (let index = from; index < tokens.length; index++) {
    const token = tokenAt(tokens, index);
    if (token === "{") depth++;
    else if (token === "}") {
      if (depth === 0) return index;
      depth--;
    }
  }
  return -1;
}
var basenameOf = (path) => path.slice(path.lastIndexOf("/") + 1);
var tokenAt = (tokens, index) => tokens[index] ?? "";
var markAt = (marks, index) => marks[index] ?? false;

// src/evidence/adapters/harness/agent-invocation.ts
var AGENT_COMMANDS = ["claude", "codex", "gemini", "aider", "cursor-agent"];
var AGENT_INVOCATION_HEAD = new RegExp(
  `^\\s*(?:[^\\s'"]*/)?(${AGENT_COMMANDS.join("|")})(\\s|$)`,
  "i"
);
var PROCESS_SPAWNERS = [
  "run",
  "execFile",
  "execFileSync",
  "execSync",
  "spawn",
  "spawnSync",
  "system",
  "popen",
  "Popen",
  "check_call",
  "check_output"
];
function looksLikeAnAgentInvocation(content) {
  const { code, literals } = stripCommentsAndLiterals(content);
  if (literals.some((literal) => beginsACommand(literal.text))) return true;
  return spawnedCommandLines(code, literals).some(invokesAgentInCommandPosition);
}
function beginsACommand(literal) {
  const head = AGENT_INVOCATION_HEAD.exec(literal);
  if (head === null) return false;
  const rest = literal.slice(head[0].length).trim();
  return rest.length === 0 || COMMAND_LIKE.test(rest);
}
var COMMAND_LIKE = /(^|\s)-{1,2}[A-Za-z0-9]|&&|\|\||;|\|/;
function invokesAgentInCommandPosition(line) {
  if (!COMMAND_LIKE.test(line) && !AGENT_COMMANDS.includes(basenameOf(line.trim()))) return false;
  const tokens = tokenize(stripArithmetic(stripShellNoise(line)));
  return invokesAgent(tokens, markCommandPositions(tokens), 0, tokens.length, /* @__PURE__ */ new Map());
}
var SPAWNER_CALLS = PROCESS_SPAWNERS.map(
  (spawner) => new RegExp(`(^|[^A-Za-z0-9_$])${spawner}\\s*\\(`, "g")
);
function spawnedCommandLines(code, literals) {
  const lines = literals.filter((literal) => literal.backQuoted).map((literal) => literal.text);
  for (const call of SPAWNER_CALLS) {
    for (const match of code.matchAll(call)) {
      const open3 = match.index + match[0].length - 1;
      const region = code.slice(open3, endOfCall(code, open3));
      for (const [, index] of region.matchAll(PLACEHOLDER)) {
        const literal = literals[Number(index)];
        if (literal !== void 0) lines.push(literal.text);
      }
    }
  }
  return lines;
}
var PLACEHOLDER = /\u0000(\d+)\u0000/g;
var placeholderFor = (index) => `\0${index}\0`;
function stripCommentsAndLiterals(source) {
  let code = "";
  const literals = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("//", index) || source[index] === "#" && startsAWord(source, index)) {
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
      code += " ";
      continue;
    }
    const triple = TRIPLE_QUOTES.find((quotes) => source.startsWith(quotes, index));
    if (triple !== void 0) {
      const close = source.indexOf(triple, index + triple.length);
      const end = close === -1 ? source.length : close;
      code += placeholderFor(literals.length);
      literals.push({ text: source.slice(index + triple.length, end), backQuoted: false });
      index = close === -1 ? source.length : close + triple.length;
      continue;
    }
    const quote = source[index] ?? "";
    if (quote === "'" || quote === '"' || quote === "`") {
      let cursor = index + 1;
      let literal = "";
      while (cursor < source.length && source[cursor] !== quote) {
        if (source[cursor] === "\\") {
          cursor += 2;
          literal += " ";
          continue;
        }
        literal += source[cursor];
        cursor++;
      }
      code += placeholderFor(literals.length);
      literals.push({ text: literal, backQuoted: quote === "`" });
      index = cursor + 1;
      continue;
    }
    code += quote;
    index++;
  }
  return { code, literals };
}
var TRIPLE_QUOTES = ['"""', "'''"];
function invokesAgent(tokens, marks, start, end, functions, visited = /* @__PURE__ */ new Set()) {
  for (let index = start; index < end; index++) {
    if (!markAt(marks, index)) continue;
    const command = basenameOf(tokenAt(tokens, index));
    if (AGENT_COMMANDS.includes(command)) return true;
    const body = functions.get(command);
    if (body === void 0 || visited.has(command)) continue;
    if (invokesAgent(tokens, marks, body.start, body.end, functions, /* @__PURE__ */ new Set([...visited, command]))) {
      return true;
    }
  }
  return false;
}

// src/evidence/adapters/harness/script-candidate.ts
var SHELL_INTERPRETERS = ["sh", "bash", "zsh"];
var SHELL_EXTENSIONS = [".sh", ".bash", ".zsh"];
var SHEBANG_PROBE_BYTES = 256;
async function readScriptCandidate(tree, path, executable) {
  const head = await tree.probe(path, SHEBANG_PROBE_BYTES);
  if (head === null) return { outcome: "unreadable" };
  const shell = hasShellShebang(head);
  if (!shell && !(executable ?? hasShebang(head))) return { outcome: "not-a-script" };
  const content = await tree.read(path);
  if (content === null) return { outcome: "unreadable" };
  return { outcome: "script", content, shell };
}
var hasShebang = (head) => head.startsWith("#!");
function hasShellShebang(head) {
  const firstLine = head.split("\n", 1)[0] ?? "";
  if (!firstLine.startsWith("#!")) return false;
  return firstLine.slice(2).split(/\s+/).filter((word) => word.length > 0).some((word) => SHELL_INTERPRETERS.includes(basenameOf(word)));
}
var hasShellExtension = (file) => SHELL_EXTENSIONS.some((extension) => file.endsWith(extension));

// src/evidence/adapters/harness/member-scan.ts
var DECIDED_PRESENT = { proven: true, undecidable: false };

// src/evidence/adapters/harness/shell-loop.ts
function readShellLoops(source) {
  const noise = stripShellNoise(source);
  const tokens = tokenize(stripArithmetic(noise));
  const commandPositions = markCommandPositions(tokens);
  const functions = findFunctionBodies(tokens, commandPositions);
  const origins = readVariableOrigins(tokenize(noise));
  let undecidable = false;
  for (const loop of findLoops(tokens, commandPositions)) {
    if (!invokesAgent(tokens, commandPositions, loop.headerStart, loop.bodyEnd, functions)) {
      continue;
    }
    if (continuationDependsOnExitStatus(tokens, commandPositions, loop, origins.status)) {
      return DECIDED_PRESENT;
    }
    if (loop.keyword === "for") continue;
    if (iterates(tokens, commandPositions, loop, origins)) continue;
    undecidable = true;
  }
  return { proven: false, undecidable };
}
function iterates(tokens, marks, loop, origins) {
  if (holdsAnEarlyStop(tokens, marks, loop)) return false;
  for (let index = loop.headerStart; index < loop.headerEnd; index++) {
    if (!isSettledReference(tokenAt(tokens, index), origins)) return false;
  }
  return true;
}
var LOOP_TERMINATORS = /* @__PURE__ */ new Set(["break", "exit", "return"]);
function holdsAnEarlyStop(tokens, marks, loop) {
  for (let index = loop.bodyStart; index < loop.bodyEnd; index++) {
    if (markAt(marks, index) && LOOP_TERMINATORS.has(tokenAt(tokens, index))) return true;
  }
  return false;
}
function isSettledReference(token, origins) {
  if (token.includes("$?")) return false;
  for (const [, name] of token.matchAll(VARIABLE_REFERENCE)) {
    if (name === void 0 || !origins.settled.has(name)) return false;
  }
  return true;
}
var VARIABLE_REFERENCE = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g;
function findLoops(tokens, marks) {
  const loops = [];
  for (let index = 0; index < tokens.length; index++) {
    if (!markAt(marks, index)) continue;
    const keyword = tokenAt(tokens, index);
    if (keyword !== "while" && keyword !== "until" && keyword !== "for") continue;
    const doIndex = indexOfCommand(tokens, marks, "do", index + 1);
    if (doIndex === -1) continue;
    const doneIndex = indexOfMatchingDone(tokens, marks, doIndex + 1);
    if (doneIndex === -1) continue;
    loops.push({
      keyword,
      headerStart: index + 1,
      headerEnd: doIndex,
      bodyStart: doIndex + 1,
      bodyEnd: doneIndex
    });
  }
  return loops;
}
function indexOfCommand(tokens, marks, word, from) {
  for (let index = from; index < tokens.length; index++) {
    if (markAt(marks, index) && tokenAt(tokens, index) === word) return index;
  }
  return -1;
}
function indexOfMatchingDone(tokens, marks, from) {
  let depth = 0;
  for (let index = from; index < tokens.length; index++) {
    if (!markAt(marks, index)) continue;
    const token = tokenAt(tokens, index);
    if (token === "do") depth++;
    else if (token === "done") {
      if (depth === 0) return index;
      depth--;
    }
  }
  return -1;
}
function continuationDependsOnExitStatus(tokens, marks, loop, statusVariables) {
  if (loop.keyword !== "for" && runsACommand(tokens, marks, loop.headerStart, loop.headerEnd, statusVariables)) {
    return true;
  }
  return breaksOnAnExitStatus(tokens, marks, loop.bodyStart, loop.bodyEnd, statusVariables);
}
var EXIT_STATUS_ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=\$\?$/;
var ASSIGNMENT_VALUE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
function readVariableOrigins(tokens) {
  const status = /* @__PURE__ */ new Set();
  const settled = /* @__PURE__ */ new Set();
  const unknown = /* @__PURE__ */ new Set();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokenAt(tokens, index);
    if (token === "read") {
      for (let next2 = index + 1; next2 < tokens.length; next2++) {
        const word = tokenAt(tokens, next2);
        if (SEPARATORS.has(word)) break;
        if (!word.startsWith("-")) settled.add(word);
      }
      continue;
    }
    const assigned = EXIT_STATUS_ASSIGNMENT.exec(token)?.[1];
    if (assigned !== void 0) {
      status.add(assigned);
      continue;
    }
    const assignment = ASSIGNMENT_VALUE.exec(token);
    if (assignment === null) continue;
    const name = assignment[1] ?? "";
    const value = assignment[2] ?? "";
    const next = tokenAt(tokens, index + 1);
    if (value === "" && next.includes("$?")) status.add(name);
    else if (value === "$" && next === "(" && tokenAt(tokens, index + 2) === "(") settled.add(name);
    else if (value === "" ? !next.includes("$") : !value.includes("$")) settled.add(name);
    else unknown.add(name);
  }
  for (const name of unknown) settled.delete(name);
  return { status, settled };
}
function runsACommand(tokens, marks, start, end, statusVariables) {
  for (let index = start; index < end; index++) {
    if (referencesExitStatus(tokenAt(tokens, index), statusVariables)) return true;
    if (!markAt(marks, index)) continue;
    const token = tokenAt(tokens, index);
    if (token.length > 0 && !NOT_A_COMMAND.has(token)) return true;
  }
  return false;
}
function referencesExitStatus(token, statusVariables) {
  if (token.includes("$?")) return true;
  for (const name of statusVariables) {
    if (token.includes(`$${name}`) || token.includes(`\${${name}}`)) return true;
  }
  return false;
}
function breaksOnAnExitStatus(tokens, marks, start, end, statusVariables) {
  for (let index = start; index < end; index++) {
    if (!markAt(marks, index) || tokenAt(tokens, index) !== "break") continue;
    if (isChainedOnACommand(tokens, marks, index, start, statusVariables)) return true;
    if (isGuardedByABranch(tokens, marks, index, start, statusVariables)) return true;
  }
  return false;
}
function isChainedOnACommand(tokens, marks, breakIndex, start, statusVariables) {
  const operator = tokenAt(tokens, breakIndex - 1);
  if (operator !== "&&" && operator !== "||") return false;
  let listStart = breakIndex - 1;
  while (listStart > start) {
    const previous = tokenAt(tokens, listStart - 1);
    if (previous === ";" || previous === "(" || KEYWORDS_BEFORE_COMMAND.has(previous)) break;
    listStart--;
  }
  return runsACommand(tokens, marks, listStart, breakIndex - 1, statusVariables);
}
function isGuardedByABranch(tokens, marks, breakIndex, start, statusVariables) {
  let thenIndex = -1;
  for (let index = breakIndex - 1; index >= start; index--) {
    if (!markAt(marks, index)) continue;
    const token = tokenAt(tokens, index);
    if (token === "fi") return false;
    if (token === "then") {
      thenIndex = index;
      break;
    }
  }
  if (thenIndex === -1) return false;
  let branchIndex = -1;
  for (let index = thenIndex - 1; index >= start; index--) {
    if (!markAt(marks, index)) continue;
    const token = tokenAt(tokens, index);
    if (token === "if" || token === "elif") {
      branchIndex = index;
      break;
    }
  }
  if (branchIndex === -1) return false;
  return runsACommand(tokens, marks, branchIndex + 1, thenIndex, statusVariables);
}

// src/evidence/adapters/harness/harness-scan.ts
var HARNESS_MEMBERS = [
  "prompts",
  "context-engineering",
  "behavior",
  "loops"
];
var NOTHING_PROVEN = { kind: "nothing" };
var proofOf = (paths) => paths.length > 0 ? { kind: "files", paths } : NOTHING_PROVEN;
async function scanHarness(tree, hasAiAttributionTrailer2, signal) {
  signal.throwIfAborted();
  const tracked = await tree.entries();
  const paths = tracked.map((entry) => entry.path);
  const capabilities = [];
  const undecidable = /* @__PURE__ */ new Set();
  const provenBy = {
    prompts: NOTHING_PROVEN,
    "context-engineering": NOTHING_PROVEN,
    behavior: NOTHING_PROVEN,
    loops: NOTHING_PROVEN
  };
  const promptPaths = provesPrompts(paths);
  if (promptPaths.length > 0) {
    capabilities.push("prompts");
    provenBy.prompts = { kind: "files", paths: promptPaths };
  } else if (hasAiAttributionTrailer2 === true) {
    capabilities.push("prompts");
    provenBy.prompts = { kind: "commit-trailer" };
  } else if (hasAiAttributionTrailer2 === null) {
    undecidable.add("prompts");
  }
  const contextPaths = provesContextEngineering(paths);
  if (contextPaths.length > 0) {
    capabilities.push("context-engineering");
    provenBy["context-engineering"] = { kind: "files", paths: contextPaths };
  }
  signal.throwIfAborted();
  const behavior = await provesBehavior(tree, tracked, signal);
  if (behavior.paths.length > 0) capabilities.push("behavior");
  if (behavior.undecidable) undecidable.add("behavior");
  provenBy.behavior = proofOf(behavior.paths);
  signal.throwIfAborted();
  const scripts = await scanScripts(tree, tracked, signal);
  if (scripts.paths.length > 0) capabilities.push("loops");
  if (scripts.undecidable) undecidable.add("loops");
  provenBy.loops = proofOf(scripts.paths);
  return {
    capabilities,
    undecidable: HARNESS_MEMBERS.filter(
      (member) => undecidable.has(member) && !capabilities.includes(member)
    ),
    provenBy
  };
}
async function scanScripts(tree, tracked, signal) {
  let provingPath = null;
  let undecidable = false;
  for (const entry of tracked) {
    if (provingPath !== null) break;
    signal.throwIfAborted();
    if (!entry.regularFile) continue;
    const candidate = await readScriptCandidate(tree, entry.path, entry.executable);
    if (candidate.outcome === "not-a-script") continue;
    if (candidate.outcome === "unreadable") {
      undecidable = true;
      continue;
    }
    if (candidate.shell || hasShellExtension(entry.path)) {
      const shell = readShellLoops(candidate.content);
      if (shell.proven) provingPath = entry.path;
      if (shell.undecidable) undecidable = true;
    } else if (looksLikeAnAgentInvocation(candidate.content)) {
      undecidable = true;
    }
  }
  return { paths: provingPath === null ? [] : [provingPath], undecidable };
}

// src/evidence/adapters/fixture-bundle.adapter.ts
var COLLECTOR_ID = "fixture-bundle";
var BUNDLE_MANIFEST = "profile.json";
var FixtureBundleEvidenceCollector = class {
  id = COLLECTOR_ID;
  supportedAxes = ["size", "harness", "intervention", "parallelism"];
  async collect(context) {
    context.signal.throwIfAborted();
    if (!await isBundle(context.path)) return { observations: [], diagnostics: [] };
    const activity = await readRecordedActivity(context.path);
    context.signal.throwIfAborted();
    return {
      observations: [
        ...await collectHarness(context, activity),
        ...collectRecorded(context, activity)
      ],
      diagnostics: []
    };
  }
};
async function isBundle(path) {
  try {
    return (await stat(join3(path, BUNDLE_MANIFEST))).isFile();
  } catch {
    return false;
  }
}
async function collectHarness(context, activity) {
  const scale = scaleFor(context.vocabulary, "harness");
  if (scale?.kind !== "set") return [];
  try {
    const tree = await bundleTree(context.path, context.signal);
    const scan = await scanHarness(tree, activity.aiAttribution, context.signal);
    const capabilities = decidedCapabilities(scan, scale);
    if (capabilities === null) return [];
    return [
      observation(
        "harness",
        capabilities,
        `recorded tree of ${context.path}, union of what was seen`
      )
    ];
  } catch (error) {
    if (context.signal.aborted) throw error;
    if (isFilesystemRefusal(error)) return [];
    throw error;
  }
}
function isFilesystemRefusal(error) {
  return error instanceof Error && typeof error.code === "string";
}
function collectRecorded(context, activity) {
  const observations = [];
  if (onOrdinalScale(context.vocabulary, "size", activity.sizeBucket)) {
    observations.push(
      observation(
        "size",
        activity.sizeBucket,
        "recorded median delivered change, lower of the lines and files buckets"
      )
    );
  }
  if (onOrdinalScale(context.vocabulary, "intervention", activity.intervention)) {
    observations.push(
      observation(
        "intervention",
        activity.intervention,
        "recorded median of corrective commits after a change was opened"
      )
    );
  }
  if (activity.parallelism !== null && scaleFor(context.vocabulary, "parallelism")?.kind === "numeric") {
    observations.push(
      observation(
        "parallelism",
        activity.parallelism,
        "recorded median, over active days, of branches worked in parallel"
      )
    );
  }
  if (activity.demonstratedParallelism !== null && scaleFor(context.vocabulary, "parallelism")?.kind === "numeric") {
    observations.push({
      axis: "parallelism",
      reading: "DEMONSTRATED",
      value: activity.demonstratedParallelism.value,
      kind: "OBSERVED",
      collector: COLLECTOR_ID,
      basis: "recorded active days carrying that many branches at once",
      demonstration: { share: activity.demonstratedParallelism.share, unit: "ACTIVE_DAYS" }
    });
  }
  return observations;
}
function onOrdinalScale(vocabulary, axis, value) {
  const scale = scaleFor(vocabulary, axis);
  return value !== null && scale?.kind === "ordinal" && scale.values.includes(value);
}
function scaleFor(vocabulary, axis) {
  return vocabulary.find((scale) => scale.axis === axis);
}
function observation(axis, value, basis) {
  return {
    axis,
    reading: "SUSTAINED",
    value,
    kind: "OBSERVED",
    collector: COLLECTOR_ID,
    basis,
    demonstration: null
  };
}

// src/evidence/models/harness-authorship.model.ts
var NO_HARNESS_AUTHORSHIP = { files: 0, commits: 0 };

// src/evidence/adapters/forge-repository/gh-process.ts
import { execFile } from "child_process";

// src/evidence/adapters/forge-repository/gh-command-failed.error.ts
var GhCommandFailedError = class extends Error {
  constructor(args, stderr) {
    super(`gh ${args.join(" ")} failed: ${stderr.trim() || "no stderr"}`);
    this.args = args;
    this.stderr = stderr;
    this.name = "GhCommandFailedError";
  }
  args;
  stderr;
};

// src/evidence/adapters/forge-repository/gh-process.ts
var GH_MAX_BUFFER = 64 * 1024 * 1024;
function runGh(args, signal, maxBuffer = GH_MAX_BUFFER) {
  return new Promise((resolve3, reject) => {
    signal.throwIfAborted();
    execFile(
      "gh",
      [...args],
      {
        signal,
        maxBuffer,
        encoding: "utf8",
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve3(stdout);
          return;
        }
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        reject(new GhCommandFailedError(args, stderr === "" ? error.message : stderr));
      }
    );
  });
}

// src/evidence/adapters/forge-repository/commit-history.ts
var PAGE_SIZE = 100;
var MAXIMUM_PAGES = 20;
var QUERY = `
query($owner: String!, $name: String!, $size: Int!, $since: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { target { ... on Commit {
      history(first: $size, since: $since, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { authoredDate author { name email user { login } } }
      } } } }
  }
}`;
async function readCommitHistory(slug, subjectActivityEnd, signal) {
  if (subjectActivityEnd === null || !Number.isFinite(subjectActivityEnd)) return null;
  const windowStart = windowStartFrom(subjectActivityEnd);
  const commits = await readCommitPages(slug, new Date(windowStart).toISOString(), signal);
  if (commits === null) return null;
  return buildCommitHistory(commits, windowStart, subjectActivityEnd);
}
async function readCommitPages(slug, since, signal) {
  signal.throwIfAborted();
  const collected = [];
  let cursor = null;
  for (let pageIndex = 0; pageIndex < MAXIMUM_PAGES; pageIndex += 1) {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${QUERY}`,
      "-F",
      `owner=${slug.owner}`,
      "-F",
      `name=${slug.name}`,
      "-F",
      `size=${PAGE_SIZE}`,
      "-F",
      `since=${since}`,
      ...cursor === null ? [] : ["-F", `after=${cursor}`]
    ];
    const page = readPage(await runGh(args, signal));
    if (page === null) return null;
    collected.push(...page.nodes);
    if (!page.hasNextPage || page.endCursor === null) return collected;
    cursor = page.endCursor;
  }
  return null;
}
function readPage(stdout) {
  let document;
  try {
    document = JSON.parse(stdout);
  } catch {
    return null;
  }
  const connection = objectAt2(
    objectAt2(
      objectAt2(objectAt2(objectAt2(document, "data"), "repository"), "defaultBranchRef"),
      "target"
    ),
    "history"
  );
  const nodes = objectAt2(connection, "nodes");
  if (!Array.isArray(nodes)) return null;
  const pageInfo = objectAt2(connection, "pageInfo");
  return {
    nodes: nodes.flatMap((node) => {
      const commit = readRawCommit(node);
      return commit === null ? [] : [commit];
    }),
    hasNextPage: objectAt2(pageInfo, "hasNextPage") === true,
    endCursor: stringAt(pageInfo, "endCursor")
  };
}
function readRawCommit(node) {
  const authoredDate = stringAt(node, "authoredDate");
  if (authoredDate === null) return null;
  const author = objectAt2(node, "author");
  return {
    authoredDate,
    email: stringAt(author, "email"),
    login: stringAt(objectAt2(author, "user"), "login")
  };
}
function buildCommitHistory(commits, windowStart, windowEnd) {
  const commitsByAccount = /* @__PURE__ */ new Map();
  const emailsByAccount = /* @__PURE__ */ new Map();
  const accountsByEmail = /* @__PURE__ */ new Map();
  for (const commit of commits) {
    const instant = Date.parse(commit.authoredDate);
    if (!Number.isFinite(instant) || instant < windowStart || instant > windowEnd) continue;
    if (commit.login !== null && commit.login.endsWith("[bot]")) continue;
    const account = commit.login;
    commitsByAccount.set(account, (commitsByAccount.get(account) ?? 0) + 1);
    if (account === null || commit.email === null) continue;
    const email = commit.email.toLowerCase();
    const accountsForEmail = accountsByEmail.get(email) ?? /* @__PURE__ */ new Set();
    accountsForEmail.add(account);
    accountsByEmail.set(email, accountsForEmail);
    const emailsForAccount = emailsByAccount.get(account) ?? /* @__PURE__ */ new Set();
    emailsForAccount.add(email);
    emailsByAccount.set(account, emailsForAccount);
  }
  const accountByEmail = /* @__PURE__ */ new Map();
  for (const [email, accounts] of accountsByEmail) {
    if (accounts.size !== 1) continue;
    const [account] = accounts;
    if (account !== void 0) accountByEmail.set(email, account);
  }
  const emailAddressesByAccount = /* @__PURE__ */ new Map();
  for (const [account, emails] of emailsByAccount) {
    emailAddressesByAccount.set(account, emails.size);
  }
  return { commitsByAccount, accountByEmail, emailAddressesByAccount };
}
function objectAt2(document, key) {
  if (typeof document !== "object" || document === null) return null;
  return document[key];
}
function stringAt(document, key) {
  const value = objectAt2(document, key);
  return typeof value === "string" && value !== "" ? value : null;
}

// src/evidence/adapters/forge-repository/derived-observations.ts
function deriveObservations(metrics, vocabulary, collectorId, basis) {
  const sizeScale = scaleFor2(vocabulary, "size");
  const interventionScale = scaleFor2(vocabulary, "intervention");
  const parallelismScale = scaleFor2(vocabulary, "parallelism");
  const observations = [];
  if (metrics.sizeBucket !== null && sizeScale?.kind === "ordinal" && sizeScale.values.includes(metrics.sizeBucket)) {
    observations.push(
      observation2(collectorId, "size", metrics.sizeBucket, `median delivered change over ${basis}`)
    );
  }
  if (metrics.demonstratedSize !== null && sizeScale?.kind === "ordinal" && sizeScale.values.includes(metrics.demonstratedSize.value)) {
    observations.push(
      demonstrated(
        collectorId,
        "size",
        metrics.demonstratedSize.value,
        { share: metrics.demonstratedSize.share, unit: "DELIVERIES" },
        `size reached by at least a third of ${basis}`
      )
    );
  }
  if (metrics.intervention !== null && interventionScale?.kind === "ordinal" && interventionScale.values.includes(metrics.intervention)) {
    observations.push(
      observation2(
        collectorId,
        "intervention",
        metrics.intervention,
        `median corrective commits after opening, over ${basis}`
      )
    );
  }
  if (metrics.demonstratedIntervention !== null && interventionScale?.kind === "ordinal" && interventionScale.values.includes(metrics.demonstratedIntervention.value)) {
    observations.push(
      demonstrated(
        collectorId,
        "intervention",
        metrics.demonstratedIntervention.value,
        { share: metrics.demonstratedIntervention.share, unit: "DELIVERIES" },
        `corrective commits after opening, over ${basis}`
      )
    );
  }
  if (metrics.parallelism !== null && parallelismScale?.kind === "numeric") {
    observations.push(
      observation2(
        collectorId,
        "parallelism",
        metrics.parallelism,
        `median, over active days, of distinct ${basis} receiving a commit`
      )
    );
  }
  if (metrics.demonstratedParallelism !== null && parallelismScale?.kind === "numeric") {
    observations.push(
      demonstrated(
        collectorId,
        "parallelism",
        metrics.demonstratedParallelism.value,
        { share: metrics.demonstratedParallelism.share, unit: "ACTIVE_DAYS" },
        `concurrent ${basis} carried on at least a third of active days`
      )
    );
  }
  return observations;
}
function scaleFor2(vocabulary, axis) {
  return vocabulary.find((scale) => scale.axis === axis);
}
function observation2(collectorId, axis, value, basis) {
  return {
    axis,
    reading: "SUSTAINED",
    value,
    kind: "OBSERVED",
    collector: collectorId,
    basis,
    demonstration: null
  };
}
function demonstrated(collectorId, axis, value, demonstration, basis) {
  return {
    axis,
    reading: "DEMONSTRATED",
    value,
    kind: "OBSERVED",
    collector: collectorId,
    basis,
    demonstration
  };
}

// src/evidence/adapters/forge-repository/pull-request-history.ts
var UNRECOVERABLE = {
  sizeBucket: null,
  demonstratedSize: null,
  intervention: null,
  demonstratedIntervention: null,
  parallelism: null,
  demonstratedParallelism: null,
  activeDays: null
};
var PAGE_SIZE2 = 50;
var MAXIMUM_PAGES2 = 20;
var QUERY2 = `
query($owner: String!, $name: String!, $size: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: MERGED, first: $size, orderBy: {field: CREATED_AT, direction: DESC}, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        createdAt
        mergedAt
        additions
        deletions
        changedFiles
        author { __typename login }
        commits(first: 100) { nodes { commit { committedDate } } }
      }
    }
  }
}`;
async function readDeliveredChanges(slug, subjectActivityEnd, signal) {
  const merged = await readMergedPullRequests(slug, signal);
  if (merged === null) return null;
  const windowEnd = subjectActivityEnd ?? merged.reduce(
    (latest, request) => Math.max(latest, Date.parse(request.mergedAt)),
    Number.NEGATIVE_INFINITY
  );
  if (!Number.isFinite(windowEnd)) return null;
  const windowStart = windowStartFrom(windowEnd);
  return merged.filter((request) => {
    if (request.openedByABot) return false;
    const instant = Date.parse(request.mergedAt);
    return Number.isFinite(instant) && instant >= windowStart && instant <= windowEnd;
  });
}
function deriveForgeMetrics(deliveries) {
  if (deliveries === null) return UNRECOVERABLE;
  const bucketPerDelivery = deliveries.map(bucketOf);
  const requestsPerActiveDay = countRequestsPerActiveDay(deliveries);
  return {
    sizeBucket: readSizeBucket2(deliveries),
    demonstratedSize: readDemonstratedSize(bucketPerDelivery),
    intervention: readIntervention2(deliveries),
    demonstratedIntervention: readDemonstratedIntervention(deliveries),
    parallelism: readParallelism(requestsPerActiveDay),
    demonstratedParallelism: readDemonstratedParallelism2(requestsPerActiveDay),
    activeDays: requestsPerActiveDay.length
  };
}
async function readMergedPullRequests(slug, signal) {
  const collected = [];
  let cursor = null;
  for (let pageIndex = 0; pageIndex < MAXIMUM_PAGES2; pageIndex += 1) {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${QUERY2}`,
      "-F",
      `owner=${slug.owner}`,
      "-F",
      `name=${slug.name}`,
      "-F",
      `size=${PAGE_SIZE2}`,
      ...cursor === null ? [] : ["-F", `after=${cursor}`]
    ];
    const page = readPage2(await runGh(args, signal));
    if (page === null) return null;
    collected.push(...page.nodes);
    if (!page.hasNextPage || page.endCursor === null) return collected;
    cursor = page.endCursor;
  }
  return null;
}
function readPage2(stdout) {
  let document;
  try {
    document = JSON.parse(stdout);
  } catch {
    return null;
  }
  const connection = objectAt3(objectAt3(objectAt3(document, "data"), "repository"), "pullRequests");
  const nodes = objectAt3(connection, "nodes");
  if (!Array.isArray(nodes)) return null;
  const pageInfo = objectAt3(connection, "pageInfo");
  return {
    nodes: nodes.flatMap((node) => {
      const request = readPullRequest(node);
      return request === null ? [] : [request];
    }),
    hasNextPage: objectAt3(pageInfo, "hasNextPage") === true,
    endCursor: stringAt2(pageInfo, "endCursor")
  };
}
function readPullRequest(node) {
  const mergedAt = stringAt2(node, "mergedAt");
  const createdAt = stringAt2(node, "createdAt");
  const additions = numberAt2(node, "additions");
  const deletions = numberAt2(node, "deletions");
  const files = numberAt2(node, "changedFiles");
  if (mergedAt === null || createdAt === null || additions === null || deletions === null || files === null) {
    return null;
  }
  const commitDates = readCommitDates(node);
  return {
    mergedAt,
    createdAt,
    // Lines changed is additions *and* deletions: a change that removes 300 lines is not empty.
    lines: additions + deletions,
    files,
    commitDays: commitDates.map((date) => date.slice(0, 10)),
    commitsAfterOpen: commitDates.filter((date) => date > createdAt).length,
    // COMPAT: GitHub types a pull request's author, and a GitHub App comes back as `Bot`. That is a
    // structural fact rather than a name, so no list of bot logins has to be kept correct here —
    // `renovate` and `dependabot` do not even carry a `[bot]` suffix on this field. `login` is read
    // from the same node and decides nothing here: it names whose sample a delivery belongs to,
    // never whether the delivery counts at all.
    openedByABot: stringAt2(objectAt3(node, "author"), "__typename") === "Bot",
    // `null` here is nobody GitHub can name: a deleted account, no author, or an empty login.
    openedBy: stringAt2(objectAt3(node, "author"), "login")
  };
}
function readCommitDates(node) {
  const nodes = objectAt3(objectAt3(node, "commits"), "nodes");
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((entry) => {
    const date = stringAt2(objectAt3(entry, "commit"), "committedDate");
    return date === null ? [] : [date];
  });
}
function bucketOf(request) {
  return lowerBucket(bucketForLines(request.lines), bucketForFiles(request.files));
}
function readSizeBucket2(inWindow) {
  if (inWindow.length < MINIMUM_DELIVERED_CHANGES) return null;
  return lowerBucket(
    bucketForLines(median(inWindow.map((request) => request.lines))),
    bucketForFiles(median(inWindow.map((request) => request.files)))
  );
}
function readDemonstratedSize(buckets) {
  return demonstratedFrom(
    buckets.length,
    SIZE_BUCKETS,
    (candidate) => buckets.filter((bucket) => SIZE_BUCKETS.indexOf(bucket) >= SIZE_BUCKETS.indexOf(candidate)).length
  );
}
function readIntervention2(inWindow) {
  if (inWindow.length < MINIMUM_DELIVERED_CHANGES) return null;
  return interventionFor(median(inWindow.map((request) => request.commitsAfterOpen)), null);
}
function readDemonstratedIntervention(inWindow) {
  const rankPerDelivery = inWindow.map(
    (request) => correctedRankOf(interventionFor(request.commitsAfterOpen, null))
  );
  return demonstratedFrom(
    rankPerDelivery.length,
    CORRECTED_INTERVENTION_RANKS,
    (candidate) => rankPerDelivery.filter((rank) => rank >= correctedRankOf(candidate)).length
  );
}
function countRequestsPerActiveDay(inWindow) {
  const requestsByDay = /* @__PURE__ */ new Map();
  for (const [index, request] of inWindow.entries()) {
    for (const day of request.commitDays) {
      const requests = requestsByDay.get(day) ?? /* @__PURE__ */ new Set();
      requests.add(`${index}`);
      requestsByDay.set(day, requests);
    }
  }
  return [...requestsByDay.values()].map((requests) => requests.size);
}
function readParallelism(perActiveDay) {
  if (perActiveDay.length < MINIMUM_ACTIVE_DAYS) return null;
  return median(perActiveDay);
}
function readDemonstratedParallelism2(perActiveDay) {
  const daysAtConcurrency = /* @__PURE__ */ new Map();
  for (const count of perActiveDay) {
    daysAtConcurrency.set(count, (daysAtConcurrency.get(count) ?? 0) + 1);
  }
  return demonstratedCountFrom(daysAtConcurrency);
}
function objectAt3(document, key) {
  if (typeof document !== "object" || document === null) return null;
  return document[key];
}
function numberAt2(document, key) {
  const value = objectAt3(document, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function stringAt2(document, key) {
  const value = objectAt3(document, key);
  return typeof value === "string" && value !== "" ? value : null;
}

// src/evidence/adapters/forge-repository/contributor-deliveries.ts
var ROSTER_COLLECTOR_ID = "forge-contributor-roster";
function readContributorDeliveries(deliveries, vocabulary) {
  const byAccount = /* @__PURE__ */ new Map();
  for (const delivery of deliveries) {
    if (delivery.openedByABot) continue;
    const bucket = byAccount.get(delivery.openedBy);
    if (bucket === void 0) {
      byAccount.set(delivery.openedBy, [delivery]);
    } else {
      bucket.push(delivery);
    }
  }
  return [...byAccount.entries()].map(
    ([account, ownDeliveries]) => readOneAccount(account, ownDeliveries, vocabulary)
  );
}
function readOneAccount(account, ownDeliveries, vocabulary) {
  const metrics = deriveForgeMetrics(ownDeliveries);
  const basis = account === null ? "merged pull requests with no named author" : `merged pull requests opened by ${account}`;
  return {
    account,
    deliveryCount: ownDeliveries.length,
    activeDays: distinctActiveDays(ownDeliveries),
    metrics,
    observations: deriveObservations(metrics, vocabulary, ROSTER_COLLECTOR_ID, basis)
  };
}
function distinctActiveDays(ownDeliveries) {
  return new Set(ownDeliveries.flatMap((delivery) => delivery.commitDays)).size;
}

// src/evidence/adapters/live-repository/git-process.ts
import { execFile as execFile2 } from "child_process";
import { realpath } from "fs/promises";

// src/evidence/adapters/live-repository/git-command-failed.error.ts
var GitCommandFailedError = class extends Error {
  constructor(args, stderr) {
    super(`git ${args.join(" ")} failed: ${stderr.trim() || "no stderr"}`);
    this.args = args;
    this.stderr = stderr;
    this.name = "GitCommandFailedError";
  }
  args;
  stderr;
};

// src/evidence/adapters/live-repository/git-process.ts
var REDIRECTING_GIT_VARIABLES = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_EXTERNAL_DIFF",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_ASKPASS",
  "GIT_PAGER",
  "GIT_EDITOR",
  "GIT_SEQUENCE_EDITOR"
];
function gitEnvironment(additions = {}) {
  const environment = { ...process.env, ...additions };
  for (const name of REDIRECTING_GIT_VARIABLES) delete environment[name];
  return environment;
}
var HARDENED_CONFIGURATION = [
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.hooksPath=/dev/null"
];
function runGit(cwd, args, signal) {
  return new Promise((resolve3, reject) => {
    signal.throwIfAborted();
    execFile2(
      "git",
      [...HARDENED_CONFIGURATION, ...args],
      {
        cwd,
        signal,
        env: gitEnvironment(),
        maxBuffer: 64 * 1024 * 1024,
        encoding: "utf8",
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve3(stdout);
          return;
        }
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        reject(new GitCommandFailedError(args, stderr));
      }
    );
  });
}
async function mostRecentCommitDate(path, signal) {
  let stdout;
  try {
    stdout = await runGit(path, ["log", "--format=%aI", "HEAD"], signal);
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
  let mostRecent = null;
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    const instant = Date.parse(line.trim());
    if (!Number.isFinite(instant)) continue;
    if (mostRecent === null || instant > mostRecent) mostRecent = instant;
  }
  return mostRecent;
}
async function isRepositoryRoot(path, signal) {
  let toplevel;
  try {
    toplevel = (await runGit(path, ["rev-parse", "--show-toplevel"], signal)).trim();
  } catch (error) {
    if (error instanceof GitCommandFailedError) return false;
    throw error;
  }
  if (toplevel === "") return false;
  try {
    return await realpath(toplevel) === await realpath(path);
  } catch {
    return false;
  }
}

// src/evidence/adapters/harness/harness-authorship.ts
var RECORD = "";
var FIELD = "";
var PROVING_PATHS_PER_LOG_INVOCATION = 500;
async function readHarnessAuthorship(path, provingPaths, accountForEmail, windowStart, signal) {
  signal.throwIfAborted();
  if (provingPaths.length === 0) return /* @__PURE__ */ new Map();
  const accumulators = /* @__PURE__ */ new Map();
  for (let from = 0; from < provingPaths.length; from += PROVING_PATHS_PER_LOG_INVOCATION) {
    const chunk = provingPaths.slice(from, from + PROVING_PATHS_PER_LOG_INVOCATION);
    signal.throwIfAborted();
    let stdout;
    try {
      stdout = await runGit(path, logArgsFor(chunk), signal);
    } catch (error) {
      if (signal.aborted) throw error;
      return null;
    }
    for (const record of parseRecords(stdout)) {
      const instant = Date.parse(record.authorDate);
      if (!Number.isFinite(instant) || instant < windowStart) continue;
      const account = accountForEmail(record.email);
      const accumulator = accumulators.get(account) ?? {
        commitHashes: /* @__PURE__ */ new Set(),
        filePaths: /* @__PURE__ */ new Set()
      };
      accumulator.commitHashes.add(record.hash);
      for (const provingPath of record.paths) accumulator.filePaths.add(provingPath);
      accumulators.set(account, accumulator);
    }
  }
  const authorship = /* @__PURE__ */ new Map();
  for (const [account, accumulator] of accumulators) {
    authorship.set(account, {
      files: accumulator.filePaths.size,
      commits: accumulator.commitHashes.size
    });
  }
  return authorship;
}
function logArgsFor(provingPaths) {
  return [
    "log",
    "--full-history",
    "--no-merges",
    "--name-only",
    "-z",
    "--no-ext-diff",
    "--no-textconv",
    `--format=${RECORD}%H${FIELD}%aI${FIELD}%ae`,
    "HEAD",
    "--",
    ...provingPaths.map((provingPath) => `:(top,literal)${provingPath}`)
  ];
}
function parseRecords(stdout) {
  const records = [];
  for (const block of stdout.split(RECORD)) {
    if (block === "") continue;
    const [header, ...rest] = block.split("\0");
    if (header === void 0) continue;
    const [hash, authorDate, email] = header.split(FIELD);
    if (hash === void 0 || authorDate === void 0 || email === void 0) continue;
    const paths = rest.map((token, index) => index === 0 ? token.replace(/^\n/, "") : token).filter((token) => token !== "");
    records.push({ hash, authorDate, email, paths });
  }
  return records;
}

// src/evidence/adapters/live-repository/git-history.ts
var MINIMUM_MERGE_SHARE = 0.25;
var FIELD2 = "";
var UNRECOVERABLE2 = {
  sizeBucket: null,
  intervention: null,
  parallelism: null
};
function isDeliveredChange(commit) {
  return commit.parents.length >= 2;
}
async function readGitDerivedMetrics(path, signal) {
  if (await isShallowRepository(path, signal)) return UNRECOVERABLE2;
  const walk3 = await readFirstParentWalk(path, signal);
  if (walk3 === null) return UNRECOVERABLE2;
  const merges = walk3.filter(isDeliveredChange);
  if (merges.length === 0) return UNRECOVERABLE2;
  const windowEnd = await mostRecentCommitDate(path, signal);
  if (windowEnd === null) return UNRECOVERABLE2;
  const windowStart = windowStartFrom(windowEnd);
  const inWindow = (authorDate) => {
    const instant = Date.parse(authorDate);
    return Number.isFinite(instant) && instant >= windowStart;
  };
  const deliveredInWindow = merges.filter((merge) => inWindow(merge.authorDate));
  const landedDirectlyInWindow = walk3.filter(
    (commit) => !isDeliveredChange(commit) && inWindow(commit.authorDate)
  );
  const readsBranchShape = mergesCarryTheDeliveries(
    deliveredInWindow.length,
    landedDirectlyInWindow.length
  );
  const sizeBucket = readsBranchShape ? await readSizeBucket3(path, deliveredInWindow, signal) : null;
  const intervention = readsBranchShape ? await readAutonomy(path, deliveredInWindow, signal) : null;
  const parallelism = readsBranchShape ? await readParallelism2(path, walk3, merges, inWindow, signal) : null;
  return { sizeBucket, intervention, parallelism };
}
function mergesCarryTheDeliveries(merges, landedDirectly) {
  const landings = merges + landedDirectly;
  return landings > 0 && merges / landings >= MINIMUM_MERGE_SHARE;
}
async function hasAiAttributionTrailer(path, signal) {
  const firstMatch = await readGit(
    path,
    [
      "log",
      "--max-count=1",
      "--format=%H",
      "--regexp-ignore-case",
      "--extended-regexp",
      ...AI_ATTRIBUTION_PATTERNS.map((pattern) => `--grep=${pattern}`),
      "HEAD"
    ],
    signal
  );
  return firstMatch === null ? null : firstMatch.trim() !== "";
}
async function readGit(path, args, signal) {
  try {
    return await runGit(path, args, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}
var AGENT_TOKENS = [
  "claude",
  "codex",
  "aider",
  "copilot",
  "cursor-agent",
  "cursoragent",
  "gemini-code-assist",
  "gemini",
  "devin",
  "cursor"
];
var KNOWN_AGENT_ADDRESSES = [
  "noreply@anthropic.com",
  "devin-ai-integration",
  "bot@cursor.sh"
];
var AGENT_WORDS = [
  "bot",
  "[bot]",
  "ai",
  "code",
  "assist",
  "agent",
  "assistant",
  "github",
  "google"
];
var AGENT_DOMAINS = [
  "google.com",
  "cursor.sh",
  "cursor.com",
  "cognition.ai",
  "anthropic.com",
  "users.noreply.github.com"
];
var REGEX_METACHARACTER = /[\\^$.|?*+()[\]{}]/g;
function asLiteral(text) {
  return text.replace(REGEX_METACHARACTER, "\\$&");
}
var TRAILER_KEY = "^[ 	]*co-authored-by[ 	]*:";
function trailerValueCarrying(identity) {
  return `${TRAILER_KEY}(.*[^a-z0-9])?${asLiteral(identity)}([^a-z0-9].*)?$`;
}
function trailerValueAddressedTo(token) {
  const domains = AGENT_DOMAINS.map(asLiteral).join("|");
  return `${TRAILER_KEY}(.*[^a-z0-9._%+-])?${asLiteral(token)}@(${domains})([^a-z0-9.-].*)?$`;
}
function trailerValueNamedByAgentComponents() {
  const component = [...AGENT_TOKENS, ...AGENT_WORDS].slice().sort((left, right) => right.length - left.length).map(asLiteral).join("|");
  return `${TRAILER_KEY}[ 	]*((${component})[ 	]*)+(<[^<>]*>)?[ 	]*$`;
}
var AI_ATTRIBUTION_PATTERNS = [
  ...KNOWN_AGENT_ADDRESSES.map(trailerValueCarrying),
  ...AGENT_TOKENS.map(trailerValueAddressedTo),
  trailerValueNamedByAgentComponents()
];
async function isShallowRepository(path, signal) {
  const answer = await readGit(path, ["rev-parse", "--is-shallow-repository"], signal);
  return answer?.trim() === "true";
}
async function readFirstParentWalk(path, signal) {
  const stdout = await readGit(
    path,
    ["log", "--first-parent", `--format=%H${FIELD2}%aI${FIELD2}%P`, "HEAD"],
    signal
  );
  if (stdout === null) return null;
  const commits = [];
  for (const record of stdout.split("\n")) {
    if (record.trim() === "") continue;
    const [hash, authorDate, parents] = record.split(FIELD2);
    if (hash === void 0 || authorDate === void 0 || parents === void 0) continue;
    commits.push({
      hash,
      authorDate,
      parents: parents.split(" ").filter((parent) => parent !== "")
    });
  }
  return commits;
}
var MERGES_PER_DIFF_INVOCATION = 500;
async function readSizeBucket3(path, deliveredChanges, signal) {
  if (deliveredChanges.length < MINIMUM_DELIVERED_CHANGES) return null;
  const diffstats = /* @__PURE__ */ new Map();
  for (let from = 0; from < deliveredChanges.length; from += MERGES_PER_DIFF_INVOCATION) {
    const chunk = deliveredChanges.slice(from, from + MERGES_PER_DIFF_INVOCATION);
    const stdout = await runGit(
      path,
      [
        "log",
        "--no-walk",
        "--diff-merges=first-parent",
        "--no-ext-diff",
        "--no-textconv",
        "--numstat",
        `--format=${RECORD2}%H`,
        ...chunk.map((merge) => merge.hash)
      ],
      signal
    );
    for (const [hash, diffstat] of readDiffstatsByCommit(stdout)) diffstats.set(hash, diffstat);
  }
  const changedLines = [];
  const changedFiles = [];
  for (const merge of deliveredChanges) {
    const diffstat = diffstats.get(merge.hash) ?? { lines: 0, files: 0 };
    changedLines.push(diffstat.lines);
    changedFiles.push(diffstat.files);
  }
  return lowerBucket(bucketForLines(median(changedLines)), bucketForFiles(median(changedFiles)));
}
var RECORD2 = "";
function readDiffstatsByCommit(stdout) {
  const byCommit = /* @__PURE__ */ new Map();
  for (const record of stdout.split(RECORD2)) {
    const [header, ...rows] = record.split("\n");
    if (header === void 0) continue;
    const hash = header.trim();
    if (hash === "") continue;
    byCommit.set(hash, readDiffstat(rows.join("\n")));
  }
  return byCommit;
}
var NUMSTAT_ROW = /^(\d+|-)\t(\d+|-)\t/;
function readDiffstat(stdout) {
  let lines = 0;
  let files = 0;
  for (const row of stdout.split("\n")) {
    const match = NUMSTAT_ROW.exec(row);
    if (match === null) continue;
    files += 1;
    const added = match[1];
    const deleted = match[2];
    if (added !== void 0 && added !== "-") lines += Number(added);
    if (deleted !== void 0 && deleted !== "-") lines += Number(deleted);
  }
  return { lines, files };
}
async function readAutonomy(path, deliveredChanges, signal) {
  if (deliveredChanges.length < MINIMUM_DELIVERED_CHANGES) return null;
  const attributed = await readAgentAttributedCommits(path, signal);
  if (attributed === null) return null;
  let zeroTouch = 0;
  for (const merge of deliveredChanges) {
    if (await absorbedAgentWorkAlone(path, merge, attributed, signal)) zeroTouch += 1;
  }
  const share = zeroTouch / deliveredChanges.length;
  return share >= ZERO_TOUCH_SHARE_FOR_AUTONOMY ? AUTONOMOUS_INTERVENTION : null;
}
async function readAgentAttributedCommits(path, signal) {
  const stdout = await readGit(
    path,
    [
      "log",
      "--format=%H",
      "--regexp-ignore-case",
      "--extended-regexp",
      ...AI_ATTRIBUTION_PATTERNS.map((pattern) => `--grep=${pattern}`),
      "HEAD"
    ],
    signal
  );
  if (stdout === null) return null;
  return new Set(
    stdout.split("\n").map((line) => line.trim()).filter((hash) => hash !== "")
  );
}
async function absorbedAgentWorkAlone(path, merge, attributed, signal) {
  let absorbed = 0;
  for (const side of mergeSideRevisions(merge)) {
    const stdout = await runGit(path, ["log", "--format=%H", ...side], signal);
    for (const line of stdout.split("\n")) {
      const hash = line.trim();
      if (hash === "") continue;
      if (!attributed.has(hash)) return false;
      absorbed += 1;
    }
  }
  return absorbed > 0;
}
function mergeSideRevisions(merge) {
  return merge.parents.slice(1).map((side) => [
    side,
    ...merge.parents.filter((parent) => parent !== side).map((parent) => `^${parent}`)
  ]);
}
async function readParallelism2(path, walk3, merges, inWindow, signal) {
  const branchesByDay = /* @__PURE__ */ new Map();
  const record = (branch, authorDate) => {
    if (!inWindow(authorDate)) return;
    const day = calendarDay(authorDate);
    if (day === null) return;
    const branches = branchesByDay.get(day) ?? /* @__PURE__ */ new Set();
    branches.add(branch);
    branchesByDay.set(day, branches);
  };
  for (const commit of walk3) {
    if (isDeliveredChange(commit)) continue;
    record("mainline", commit.authorDate);
  }
  const sides = merges.flatMap(
    (merge) => mergeSideRevisions(merge).map((revisions, index) => ({
      branch: `${merge.hash}:${index + 1}`,
      revisions
    }))
  );
  for (const dates of await inBoundedParallel(
    sides,
    (side) => runGit(path, ["log", "--format=%aI", ...side.revisions], signal).then((stdout) => ({
      branch: side.branch,
      lines: stdout.split("\n")
    }))
  )) {
    for (const line of dates.lines) {
      if (line.trim() === "") continue;
      record(dates.branch, line.trim());
    }
  }
  if (branchesByDay.size < MINIMUM_ACTIVE_DAYS) return null;
  return median([...branchesByDay.values()].map((branches) => branches.size));
}
var SPAWNS_IN_FLIGHT = 8;
async function inBoundedParallel(inputs, run2) {
  const outputs = [];
  for (let from = 0; from < inputs.length; from += SPAWNS_IN_FLIGHT) {
    outputs.push(...await Promise.all(inputs.slice(from, from + SPAWNS_IN_FLIGHT).map(run2)));
  }
  return outputs;
}
function calendarDay(authorDate) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(authorDate.trim());
  return match?.[1] ?? null;
}

// src/evidence/adapters/forge-contributor-roster.adapter.ts
var COLLECTOR_ID2 = "forge-contributor-roster";
var ForgeContributorRosterAdapter = class {
  constructor(slug, path, deliveries, tree) {
    this.slug = slug;
    this.path = path;
    this.deliveries = deliveries;
    this.tree = tree;
  }
  slug;
  path;
  deliveries;
  tree;
  id = COLLECTOR_ID2;
  async read(context) {
    try {
      context.signal.throwIfAborted();
      const subjectActivityEnd = await mostRecentCommitDate(this.path, context.signal);
      const history = await readCommitHistory(this.slug, subjectActivityEnd, context.signal);
      if (history === null) {
        return this.failed(context, "the commit walk did not complete");
      }
      context.signal.throwIfAborted();
      const deliveries = await this.deliveries.read(context.signal);
      if (deliveries === null) {
        return this.failed(context, "the delivery walk did not complete");
      }
      context.signal.throwIfAborted();
      const windowStart = windowStartFrom(subjectActivityEnd);
      const trailer = await hasAiAttributionTrailer(this.path, context.signal);
      const scan = await scanHarness(this.tree, trailer, context.signal);
      const harnessScale = harnessSetScaleFrom(context.vocabulary);
      const harnessObserved = harnessScale === void 0 ? null : decidedCapabilities(scan, harnessScale);
      const provingPaths = provingPathsOf(scan);
      const accountForEmail = accountForEmailFrom(history.accountByEmail);
      const authorship = await readHarnessAuthorship(
        this.path,
        provingPaths,
        accountForEmail,
        windowStart,
        context.signal
      );
      if (authorship === null) {
        return this.failed(context, "the harness authorship walk did not complete");
      }
      const deliveriesByAccount = new Map(
        readContributorDeliveries(deliveries, context.vocabulary).map((entry) => [
          entry.account,
          entry
        ])
      );
      const accounts = /* @__PURE__ */ new Set([
        ...history.commitsByAccount.keys(),
        ...deliveriesByAccount.keys()
      ]);
      const harnessObservation = harnessObserved === null ? null : {
        axis: "harness",
        reading: "SUSTAINED",
        value: harnessObserved,
        kind: "OBSERVED",
        collector: COLLECTOR_ID2,
        basis: `tracked tree of ${this.path}, union of what was seen \u2014 shared by every row`,
        demonstration: null
      };
      const records = [...accounts].map((account) => {
        const delivery = deliveriesByAccount.get(account) ?? emptyDeliveries(account);
        return {
          account,
          // LIMITATION: `account === null` never carries an address count — the unattributed bucket
          // is commits nothing observable could attribute, and counting the addresses it dropped
          // would state something about a person who was never named.
          emailAddresses: account === null ? 0 : history.emailAddressesByAccount.get(account) ?? 0,
          commits: history.commitsByAccount.get(account) ?? 0,
          deliveries: delivery.deliveryCount,
          activeDays: delivery.activeDays,
          harnessAuthorship: authorship.get(account) ?? NO_HARNESS_AUTHORSHIP,
          observations: harnessObservation === null ? delivery.observations : [...delivery.observations, harnessObservation]
        };
      });
      return {
        status: "COMPLETED",
        records,
        windowDays: WINDOW_DAYS,
        harnessObserved,
        harnessPaths: provingPaths.length
      };
    } catch (error) {
      return {
        status: context.signal.aborted ? "TIMED_OUT" : "FAILED",
        records: [],
        reason: reasonFor3(error)
      };
    }
  }
  failed(context, reason) {
    return {
      status: context.signal.aborted ? "TIMED_OUT" : "FAILED",
      records: [],
      reason
    };
  }
};
function harnessSetScaleFrom(vocabulary) {
  const scale = vocabulary.find((candidate) => candidate.axis === "harness");
  return scale?.kind === "set" ? scale : void 0;
}
function provingPathsOf(scan) {
  const paths = /* @__PURE__ */ new Set();
  for (const proof of Object.values(scan.provenBy)) {
    if (proof.kind === "files") {
      for (const path of proof.paths) paths.add(path);
    }
  }
  return [...paths];
}
function accountForEmailFrom(accountByEmail) {
  return (email) => accountByEmail.get(email.toLowerCase()) ?? null;
}
function emptyDeliveries(account) {
  return {
    account,
    deliveryCount: 0,
    activeDays: 0,
    metrics: deriveForgeMetrics([]),
    observations: []
  };
}
function reasonFor3(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/evidence/adapters/forge-repository.adapter.ts
var COLLECTOR_ID3 = "forge-repository";
var ForgeRepositoryEvidenceCollector = class {
  constructor(slug, deliveries) {
    this.slug = slug;
    this.deliveries = deliveries;
  }
  slug;
  deliveries;
  id = COLLECTOR_ID3;
  supportedAxes = ["size", "intervention", "parallelism"];
  async collect(context) {
    context.signal.throwIfAborted();
    if (!hasAnySupportedAxis(context.vocabulary)) return { observations: [], diagnostics: [] };
    const metrics = deriveForgeMetrics(await this.deliveries.read(context.signal));
    return {
      observations: deriveObservations(
        metrics,
        context.vocabulary,
        COLLECTOR_ID3,
        `merged pull requests of ${this.slug.owner}/${this.slug.name}`
      ),
      diagnostics: diagnosticsFor(metrics, context.vocabulary)
    };
  }
};
function diagnosticsFor(metrics, vocabulary) {
  const parallelismScale = scaleFor2(vocabulary, "parallelism");
  if (parallelismScale?.kind !== "numeric" || metrics.parallelism !== null || metrics.activeDays === null || metrics.activeDays >= MINIMUM_ACTIVE_DAYS) {
    return [];
  }
  return [
    {
      collector: COLLECTOR_ID3,
      axis: "parallelism",
      reason: "INSUFFICIENT_ACTIVE_DAYS",
      observed: metrics.activeDays,
      minimum: MINIMUM_ACTIVE_DAYS
    }
  ];
}
function hasAnySupportedAxis(vocabulary) {
  return vocabulary.some(
    (scale) => scale.axis === "size" || scale.axis === "intervention" || scale.axis === "parallelism"
  );
}

// src/evidence/adapters/forge-repository/delivery-reader.ts
function forgeDeliveryReader(slug, subjectPath) {
  let memo;
  return {
    read(signal) {
      memo ??= readDeliveredChangesFor(slug, subjectPath, signal);
      return memo;
    }
  };
}
async function readDeliveredChangesFor(slug, subjectPath, signal) {
  const subjectActivityEnd = await mostRecentCommitDate(subjectPath, signal);
  return readDeliveredChanges(slug, subjectActivityEnd, signal);
}

// src/evidence/adapters/forge-repository/repository-slug.ts
var GITHUB_REMOTE = /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/(?:[^@/]*@)?github\.com\/)([^/]+)\/(.+?)(?:\.git)?\/?$/;
async function repositorySlug(path, signal) {
  let url;
  try {
    url = (await runGit(path, ["remote", "get-url", "origin"], signal)).trim();
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
  const match = GITHUB_REMOTE.exec(url);
  const owner = match?.[1];
  const name = match?.[2];
  if (owner === void 0 || name === void 0 || owner === "" || name === "") return null;
  return { owner, name };
}

// src/evidence/adapters/live-repository/tracked-tree.ts
import { open as open2, readFile as readFile3 } from "fs/promises";
import { join as join4 } from "path";
async function trackedTree(path, signal) {
  let root = null;
  const resolvedRoot = () => {
    root ??= repositoryRoot(path, signal);
    return root;
  };
  return {
    async entries() {
      const tracked = await listTrackedEntries(await resolvedRoot(), signal);
      return tracked.map((entry) => ({
        path: entry.path,
        regularFile: isRegularFileMode(entry.mode),
        executable: isExecutableMode(entry.mode)
      }));
    },
    async probe(entryPath, bytes) {
      return probeFile2(join4(await resolvedRoot(), entryPath), bytes);
    },
    async read(entryPath) {
      return readTextFile(join4(await resolvedRoot(), entryPath));
    }
  };
}
async function repositoryRoot(path, signal) {
  return (await runGit(path, ["rev-parse", "--show-toplevel"], signal)).trim();
}
async function listTrackedEntries(root, signal) {
  const listing = await runGit(root, ["ls-files", "-s", "-z"], signal);
  return listing.split("\0").filter((entry) => entry.length > 0).flatMap((entry) => {
    const separator = entry.indexOf("	");
    const mode = entry.slice(0, entry.indexOf(" "));
    if (separator === -1 || mode.length === 0) return [];
    return [{ path: entry.slice(separator + 1), mode }];
  });
}
var isRegularFileMode = (mode) => mode.startsWith("100");
var isExecutableMode = (mode) => mode === "100755";
async function probeFile2(absolute, bytes) {
  let handle = null;
  try {
    handle = await open2(absolute, "r");
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch {
    return null;
  } finally {
    try {
      await handle?.close();
    } catch {
    }
  }
}
async function readTextFile(absolute) {
  try {
    return await readFile3(absolute, "utf8");
  } catch {
    return null;
  }
}

// src/evidence/adapters/live-repository.adapter.ts
var COLLECTOR_ID4 = "live-repository";
var EVERY_AXIS_IT_CAN_READ = ["size", "harness", "intervention", "parallelism"];
var LiveRepositoryEvidenceCollector = class {
  id = COLLECTOR_ID4;
  supportedAxes;
  // INVARIANT: The axes this collector was *built* to answer, which the composition root narrows
  // when a better source owns them. Narrowing here rather than dropping observations later is what
  // keeps `provenance` honest: it records what a collector was asked for, and a collector asked only
  // about the harness must not report having been asked about the rest.
  constructor(supportedAxes = EVERY_AXIS_IT_CAN_READ) {
    this.supportedAxes = supportedAxes;
  }
  async collect(context) {
    context.signal.throwIfAborted();
    if (!await isRepositoryRoot(context.path, context.signal)) return emptyCollection();
    const asked = {
      ...context,
      vocabulary: context.vocabulary.filter((scale) => this.supportedAxes.includes(scale.axis))
    };
    const [harness, git] = await Promise.all([collectHarness2(asked), collectGitDerived(asked)]);
    return { observations: [...harness, ...git], diagnostics: [] };
  }
};
function emptyCollection() {
  return { observations: [], diagnostics: [] };
}
async function collectHarness2(context) {
  const scale = scaleFor3(context.vocabulary, "harness");
  if (scale?.kind !== "set") return [];
  try {
    const trailer = await hasAiAttributionTrailer(context.path, context.signal);
    const tree = await trackedTree(context.path, context.signal);
    const scan = await scanHarness(tree, trailer, context.signal);
    const capabilities = decidedCapabilities(scan, scale);
    if (capabilities === null) return [];
    return [
      observation3(
        "harness",
        capabilities,
        `tracked tree of ${context.path}, union of what was seen`
      )
    ];
  } catch (error) {
    return unobservedUnlessOurs(error, context);
  }
}
async function collectGitDerived(context) {
  const sizeScale = scaleFor3(context.vocabulary, "size");
  const interventionScale = scaleFor3(context.vocabulary, "intervention");
  const parallelismScale = scaleFor3(context.vocabulary, "parallelism");
  if (sizeScale === void 0 && interventionScale === void 0 && parallelismScale === void 0) {
    return [];
  }
  try {
    const metrics = await readGitDerivedMetrics(context.path, context.signal);
    const observations = [];
    if (metrics.sizeBucket !== null && sizeScale?.kind === "ordinal" && sizeScale.values.includes(metrics.sizeBucket)) {
      observations.push(
        observation3(
          "size",
          metrics.sizeBucket,
          "median delivered change on the first-parent walk, lower of the lines and files buckets"
        )
      );
    }
    if (metrics.intervention !== null && interventionScale?.kind === "ordinal" && interventionScale.values.includes(metrics.intervention)) {
      observations.push(
        observation3(
          "intervention",
          metrics.intervention,
          "delivered changes on the first-parent walk whose every commit is attributed to an agent"
        )
      );
    }
    if (metrics.parallelism !== null && parallelismScale?.kind === "numeric") {
      observations.push(
        observation3(
          "parallelism",
          metrics.parallelism,
          "median, over active days, of distinct branches recovered from merge sides"
        )
      );
    }
    return observations;
  } catch (error) {
    return unobservedUnlessOurs(error, context);
  }
}
function unobservedUnlessOurs(error, context) {
  if (context.signal.aborted) throw error;
  if (error instanceof GitCommandFailedError) return [];
  throw error;
}
function scaleFor3(vocabulary, axis) {
  return vocabulary.find((scale) => scale.axis === axis);
}
function observation3(axis, value, basis) {
  return {
    axis,
    reading: "SUSTAINED",
    value,
    kind: "OBSERVED",
    collector: COLLECTOR_ID4,
    basis,
    demonstration: null
  };
}

// src/maturity/loading/load-maturity-model.ts
var import_yaml = __toESM(require_dist(), 1);
import { readFileSync } from "fs";

// src/maturity/loading/model-shape.ts
function requireShape(document) {
  if (!isRecord(document)) {
    throw new InvalidMaturityModelError(
      `The maturity model must be a YAML mapping, not ${describeType(document)}.`
    );
  }
  return {
    schemaVersion: requireSchemaVersion(document.schemaVersion),
    id: requireNonEmptyString(document.id, "id"),
    scales: requireScales(document.scales),
    axes: requireAxes(document.axes),
    levels: requireLevels(document.levels)
  };
}
function requireSchemaVersion(value) {
  if (typeof value !== "number" || value !== 1) {
    const got = typeof value === "number" ? String(value) : describeType(value);
    throw new InvalidMaturityModelError(`'schemaVersion' must be the number 1, got ${got}.`);
  }
  return value;
}
function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidMaturityModelError(
      `'${field}' must be a non-empty string, got ${describeType(value)}.`
    );
  }
  return value;
}
function requireNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidMaturityModelError(
      `'${field}' must be a finite number, got ${describeType(value)}.`
    );
  }
  return value;
}
function requireStringArray(value, field) {
  const isString = (item) => typeof item === "string";
  if (!Array.isArray(value) || !value.every(isString)) {
    throw new InvalidMaturityModelError(
      `'${field}' must be an array of strings, got ${describeType(value)}.`
    );
  }
  return value;
}
function requireScales(value) {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(`'scales' must be a mapping, got ${describeType(value)}.`);
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new InvalidMaturityModelError(`'scales' must declare at least one scale.`);
  }
  const scales = /* @__PURE__ */ Object.create(null);
  for (const [scaleId, raw] of entries) {
    scales[scaleId] = requireScale(raw, scaleId);
  }
  return scales;
}
function requireScale(value, scaleId) {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `Scale '${scaleId}' must be a mapping, got ${describeType(value)}.`
    );
  }
  if (value.kind === "ordinal") {
    const values = requireStringArray(value.values, `scale '${scaleId}'.values`);
    return {
      kind: "ordinal",
      values,
      descriptions: requireDescriptions(value.descriptions, values, `scale '${scaleId}'`)
    };
  }
  if (value.kind === "set") {
    const members = requireStringArray(value.members, `scale '${scaleId}'.members`);
    return {
      kind: "set",
      members,
      descriptions: requireDescriptions(value.descriptions, members, `scale '${scaleId}'`)
    };
  }
  if (value.kind === "numeric") {
    return {
      kind: "numeric",
      description: requireNonEmptyString(value.description, `scale '${scaleId}'.description`)
    };
  }
  throw new InvalidMaturityModelError(
    `Scale '${scaleId}' has an unknown kind ${describeType(value.kind)}; expected 'ordinal', 'set' or 'numeric'.`
  );
}
function requireDescriptions(value, vocabulary, field) {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `'${field}.descriptions' must be a mapping, got ${describeType(value)}.`
    );
  }
  const descriptions = /* @__PURE__ */ Object.create(null);
  for (const [term, description] of Object.entries(value)) {
    if (!vocabulary.includes(term)) {
      throw new InvalidMaturityModelError(
        `'${field}.descriptions' names '${term}', which is not on its scale.`
      );
    }
    descriptions[term] = requireNonEmptyString(description, `${field}.descriptions.${term}`);
  }
  for (const term of vocabulary) {
    if (!Object.hasOwn(descriptions, term)) {
      throw new InvalidMaturityModelError(`'${field}.descriptions' is missing '${term}'.`);
    }
  }
  return descriptions;
}
function requireAxes(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidMaturityModelError(
      `'axes' must be a non-empty array, got ${describeType(value)}.`
    );
  }
  const axes = value.map((item, index) => requireAxis(item, index));
  requireDistinctIds(
    axes.map((axis) => axis.id),
    "axes"
  );
  return axes;
}
function requireAxis(value, index) {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `axes[${index}] must be a mapping, got ${describeType(value)}.`
    );
  }
  return {
    id: requireNonEmptyString(value.id, `axes[${index}].id`),
    label: requireNonEmptyString(value.label, `axes[${index}].label`),
    scale: requireNonEmptyString(value.scale, `axes[${index}].scale`)
  };
}
function requireLevels(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidMaturityModelError(
      `'levels' must be a non-empty array, got ${describeType(value)}.`
    );
  }
  const levels = value.map((item, index) => requireLevel(item, index));
  requireDistinctIds(
    levels.map((level) => level.id),
    "levels"
  );
  return levels;
}
function requireLevel(value, index) {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `levels[${index}] must be a mapping, got ${describeType(value)}.`
    );
  }
  const id = requireNonEmptyString(value.id, `levels[${index}].id`);
  return {
    id,
    rank: requireNumber(value.rank, `level '${id}'.rank`),
    label: requireNonEmptyString(value.label, `level '${id}'.label`),
    requirements: requireRequirements(value.requirements, id)
  };
}
function requireRequirements(value, levelId) {
  if (!Array.isArray(value)) {
    throw new InvalidMaturityModelError(
      `Level '${levelId}'.requirements must be an array, got ${describeType(value)}.`
    );
  }
  return value.map((item, index) => requireRequirement(item, levelId, index));
}
function requireRequirement(value, levelId, index) {
  if (!isRecord(value)) {
    throw new InvalidMaturityModelError(
      `Level '${levelId}'.requirements[${index}] must be a mapping, got ${describeType(value)}.`
    );
  }
  const axis = requireNonEmptyString(value.axis, `level '${levelId}'.requirements[${index}].axis`);
  const hasMin = value.min !== void 0;
  const hasIncludes = value.includes !== void 0;
  if (hasMin === hasIncludes) {
    throw new InvalidMaturityModelError(
      `Level '${levelId}' requirement for axis '${axis}' must carry exactly one of 'min' or 'includes'.`
    );
  }
  if (hasIncludes) {
    return {
      axis,
      includes: requireStringArray(
        value.includes,
        `level '${levelId}' requirement for axis '${axis}'.includes`
      )
    };
  }
  const min = value.min;
  if (typeof min !== "string" && typeof min !== "number") {
    throw new InvalidMaturityModelError(
      `Level '${levelId}' requirement for axis '${axis}'.min must be a string or a number, got ${describeType(min)}.`
    );
  }
  return { axis, min };
}
function requireDistinctIds(ids, field) {
  const seen = /* @__PURE__ */ new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new InvalidMaturityModelError(`'${field}' declares '${id}' more than once.`);
    }
    seen.add(id);
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function describeType(value) {
  if (value === void 0) return "nothing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return `a ${typeof value}`;
}

// src/maturity/loading/model-consistency.ts
function requireVocabulary(model) {
  const scaleByAxis = scalesByAxis(model);
  for (const level of model.levels) {
    for (const requirement of level.requirements) {
      const scale = scaleByAxis.get(requirement.axis);
      if (scale === void 0) continue;
      requireThresholdOnScale(scale, requirement, `Level '${level.id}'`);
    }
  }
}
function requireCoverage(model) {
  requireDistinctRanks(model.levels);
  const declaredAxes = new Set(model.axes.map((axis) => axis.id));
  for (const level of model.levels) {
    const counts = /* @__PURE__ */ new Map();
    for (const requirement of level.requirements) {
      if (!declaredAxes.has(requirement.axis)) {
        throw new InvalidMaturityModelError(
          `Level '${level.id}' requires an axis the model does not declare: '${requirement.axis}'.`
        );
      }
      counts.set(requirement.axis, (counts.get(requirement.axis) ?? 0) + 1);
    }
    for (const axisId of declaredAxes) {
      const count = counts.get(axisId) ?? 0;
      if (count === 0) {
        throw noRequirementFor(level.id, axisId);
      }
      if (count > 1) {
        throw new InvalidMaturityModelError(
          `Level '${level.id}' declares axis '${axisId}' more than once.`
        );
      }
    }
  }
}
function requireDistinctRanks(levels) {
  const seen = /* @__PURE__ */ new Set();
  for (const level of levels) {
    if (seen.has(level.rank)) {
      throw new InvalidMaturityModelError(`Rank ${level.rank} is used by more than one level.`);
    }
    seen.add(level.rank);
  }
}
function requireCumulativity(model) {
  const scaleByAxis = scalesByAxis(model);
  const sorted = [...model.levels].sort((a, b) => a.rank - b.rank);
  let lower;
  for (const higher of sorted) {
    if (lower !== void 0) requireNoDip(lower, higher, scaleByAxis);
    lower = higher;
  }
}
function requireNoDip(lower, higher, scaleByAxis) {
  for (const [axisId, scale] of scaleByAxis) {
    const lowerRequirement = requirementOn(lower, axisId);
    const higherRequirement = requirementOn(higher, axisId);
    if (!reachesOrExceeds(scale, lowerRequirement, higherRequirement)) {
      throw new InvalidMaturityModelError(
        `Level '${higher.id}' asks less than '${lower.id}' on axis '${axisId}': a higher rank must never ask less than the rank below it.`
      );
    }
  }
}
function requirementOn(level, axisId) {
  const requirement = level.requirements.find((candidate) => candidate.axis === axisId);
  if (requirement === void 0) throw noRequirementFor(level.id, axisId);
  return requirement;
}
function scalesByAxis(model) {
  return new Map(model.axes.map((axis) => [axis.id, scaleNamedBy(model, axis)]));
}
function noRequirementFor(levelId, axisId) {
  return new InvalidMaturityModelError(
    `Level '${levelId}' declares no requirement for axis '${axisId}'.`
  );
}
function reachesOrExceeds(scale, lower, higher) {
  switch (scale.kind) {
    case "set": {
      if (!isSetRequirement(lower) || !isSetRequirement(higher)) {
        throw new InvalidMaturityModelError(
          `A set scale requires an 'includes' requirement to compare cumulativity.`
        );
      }
      return lower.includes.every((member) => higher.includes.includes(member));
    }
    case "numeric": {
      if (isSetRequirement(lower) || isSetRequirement(higher)) {
        throw new InvalidMaturityModelError(
          `A numeric scale requires a 'min' requirement to compare cumulativity.`
        );
      }
      return Number(higher.min) >= Number(lower.min);
    }
    case "ordinal": {
      if (isSetRequirement(lower) || isSetRequirement(higher)) {
        throw new InvalidMaturityModelError(
          `An ordinal scale requires a 'min' requirement to compare cumulativity.`
        );
      }
      return scale.values.indexOf(String(higher.min)) >= scale.values.indexOf(String(lower.min));
    }
    default: {
      const exhaustive = scale;
      throw new InvalidMaturityModelError(`Unknown scale kind: ${JSON.stringify(exhaustive)}.`);
    }
  }
}

// src/maturity/loading/load-maturity-model.ts
function loadMaturityModel(path) {
  return parseMaturityModel(readModelFile(path));
}
function readModelFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new InvalidMaturityModelError(
      `The maturity model at '${path}' could not be read: ${reason}`
    );
  }
}
function parseMaturityModel(source) {
  const document = parseYamlDocument(source);
  const model = requireShape(document);
  requireVocabulary(model);
  requireCoverage(model);
  requireCumulativity(model);
  return model;
}
function parseYamlDocument(source) {
  try {
    return import_yaml.default.parse(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new InvalidMaturityModelError(`The maturity model is not valid YAML: ${reason}`);
  }
}

// src/cli/usage.error.ts
var UsageError = class extends Error {
};

// src/cli/parsing/command-name.ts
var USAGE_LINE = "usage: aidd-audit assess <path> [--json] [--model <path>] | aidd-audit harness <path> [--json]";
function commandOperandsFor(argv2, expected) {
  const command = argv2[0];
  if (command !== expected) {
    const what = command === void 0 ? "No command given." : `Unknown command '${command}'.`;
    throw new UsageError(`${what} ${USAGE_LINE}`);
  }
  return argv2.slice(1);
}

// src/cli/parsing/assess-arguments.ts
var USAGE_LINE2 = "usage: aidd-audit assess <path> [--json] [--model <path>]";
function parseAssessArguments(argv2) {
  const operands = commandOperandsFor(argv2, "assess");
  let subjectPath;
  let modelPath = null;
  let jsonSeen = false;
  let modelSeen = false;
  let valueConsumedAt = -1;
  for (const [index, token] of operands.entries()) {
    if (index === valueConsumedAt) {
      continue;
    }
    if (token === "--json") {
      if (jsonSeen) throw usageError("Flag '--json' was given more than once.");
      jsonSeen = true;
      continue;
    }
    if (token === "--model") {
      if (modelSeen) throw usageError("Flag '--model' was given more than once.");
      const value = operands[index + 1];
      if (value === void 0) throw usageError("Flag '--model' needs a value.");
      modelSeen = true;
      modelPath = value;
      valueConsumedAt = index + 1;
      continue;
    }
    if (token.startsWith("--")) {
      throw usageError(`Unknown flag '${token}'.`);
    }
    if (subjectPath !== void 0) {
      throw usageError(`Unexpected second subject '${token}'.`);
    }
    subjectPath = token;
  }
  if (subjectPath === void 0) {
    throw usageError("No subject path given.");
  }
  return { subjectPath, modelPath, json: jsonSeen };
}
function usageError(reason) {
  return new UsageError(`${reason} ${USAGE_LINE2}`);
}

// src/cli/bootstrap/canonical-model-path.ts
import { existsSync } from "fs";
import { dirname, join as join5, resolve } from "path";
import { fileURLToPath } from "url";
function canonicalModelPath() {
  const start = dirname(fileURLToPath(import.meta.url));
  let dir = resolve(start);
  for (; ; ) {
    const candidate = join5(dir, "aidd.yml");
    if (existsSync(candidate)) {
      return candidate;
    }
    if (existsSync(join5(dir, "package.json"))) {
      throw new Error(`Could not locate 'aidd.yml' above '${start}'.`);
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate 'aidd.yml' above '${start}'.`);
    }
    dir = parent;
  }
}

// src/cli/renderers/text-style.ts
var plainText = {
  heading: (text) => text,
  faint: (text) => text,
  satisfied: (text) => text,
  practiceGap: (text) => text,
  evidenceGap: (text) => text
};
var styled = (code) => (text) => `\x1B[${code}m${text}\x1B[0m`;
var colouredText = {
  heading: styled("1"),
  faint: styled("2"),
  satisfied: styled("32"),
  practiceGap: styled("31"),
  evidenceGap: styled("33")
};

// src/cli/renderers/human.renderer.ts
function renderHumanReport(report, style = plainText) {
  const rendering = { report, style };
  const sections = [
    renderHeader(rendering),
    renderProvenSection(rendering),
    renderDemonstratedSection(rendering),
    renderCoverageSection(rendering),
    renderNoCollectorsSection(rendering),
    renderIncompleteCollectorsSection(rendering),
    renderGapsSection(rendering),
    renderContributorsSection(rendering)
  ];
  return sections.filter((section) => section.length > 0).join("\n\n");
}
var REPORT_SEPARATOR = `

${"=".repeat(72)}

`;
function renderHumanReports(reports, style = plainText) {
  return reports.map((report) => renderHumanReport(report, style)).join(REPORT_SEPARATOR);
}
function renderHeader({ report, style }) {
  const model = `Mod\xE8le ${report.model.id} (sch\xE9ma v${report.model.schemaVersion})`;
  const completed = report.provenance.filter((entry) => entry.status === "COMPLETED");
  const collectors = completed.length > 0 ? ` \xB7 collecteurs : ${completed.map((entry) => entry.collector).join(", ")}` : "";
  return [
    style.heading(`Maturit\xE9 AIDD \xB7 ${report.subject.path}`),
    style.faint(`${model}${collectors}`)
  ].join("\n");
}
function renderProvenSection(rendering) {
  const { report, style } = rendering;
  const { proven } = report;
  if (proven === null) {
    return style.heading("Niveau prouv\xE9 : aucun. Aucun niveau n'a pu \xEAtre enti\xE8rement prouv\xE9.");
  }
  return [
    style.heading(`Niveau prouv\xE9 : ${proven.label} (rang ${proven.rank})`),
    ...renderAxes(rendering, proven.axes)
  ].join("\n");
}
function renderDemonstratedSection(rendering) {
  const { report, style } = rendering;
  const { demonstrated: demonstrated2, proven } = report;
  if (demonstrated2 === null || demonstrated2.level === null) return "";
  if (proven === null) return "";
  if (demonstrated2.level.rank <= proven.rank) return "";
  return [
    style.heading(
      `D\xE9montr\xE9 : ${demonstrated2.level.label} (rang ${demonstrated2.level.rank}), atteint sur :`
    ),
    ...demonstrated2.axes.map((axis) => `  ${renderDemonstratedAxis(report, axis)}`)
  ].join("\n");
}
function renderDemonstratedAxis(report, axis) {
  const label = labelFor(report, axis.axis) ?? axis.axis;
  const percent = Math.round(axis.share * 100);
  return `${label} : ${formatScaleValue(report, axis.axis, axis.observed)} \xB7 atteint sur ${percent}% des ${occasionsOf(axis.unit)}`;
}
function occasionsOf(unit) {
  switch (unit) {
    case "DELIVERIES":
      return "livraisons";
    case "ACTIVE_DAYS":
      return "jours actifs";
  }
}
function labelFor(report, axis) {
  for (const level of report.levels) {
    const found = level.axes.find((candidate) => candidate.axis === axis);
    if (found !== void 0) return found.label;
  }
  return void 0;
}
function renderCoverageSection({ report }) {
  if (report.proven !== null) {
    return "";
  }
  const { axesRequested, axesObserved, axesConfirmed } = report.coverage;
  return `Couverture : ${axesConfirmed}/${axesRequested} axes confirm\xE9s, ${axesObserved}/${axesRequested} observ\xE9s.`;
}
function renderNoCollectorsSection({ report }) {
  if (report.provenance.length > 0) {
    return "";
  }
  return "Aucun collecteur n'a tourn\xE9 : rien n'a \xE9t\xE9 observ\xE9 sur ce sujet. Les axes ci-dessous sont non prouv\xE9s parce qu'AIDD n'a pas regard\xE9, pas parce qu'il a regard\xE9 sans rien trouver.";
}
function renderIncompleteCollectorsSection({ report, style }) {
  const incomplete = report.provenance.filter(
    (entry) => entry.status !== "COMPLETED"
  );
  if (incomplete.length === 0) {
    return "";
  }
  const lines = incomplete.map((entry) => {
    const axes = entry.axes.length > 0 ? ` sur ${entry.axes.join(", ")}` : "";
    return `  ${entry.collector} : ${glossProvenanceStatus(entry.status)}${axes} \u2014 ${entry.reason}`;
  });
  return [style.heading("Collecteurs sans r\xE9ponse compl\xE8te :"), ...lines].join("\n");
}
function glossProvenanceStatus(status) {
  switch (status) {
    case "FAILED":
      return "en \xE9chec";
    case "TIMED_OUT":
      return "d\xE9lai d\xE9pass\xE9";
    case "SKIPPED":
      return "ignor\xE9";
  }
}
function renderGapsSection(rendering) {
  const { report, style } = rendering;
  const { next } = report;
  const axes = next?.axes ?? [];
  const orphans = report.blocking.filter((blocker) => !axes.some((axis) => axis.axis === blocker.axis)).map((blocker) => renderOrphanBlocker(rendering, blocker));
  if (next === null && orphans.length === 0) {
    return "";
  }
  const blocked = new Set(report.blocking.map((blocker) => blocker.axis));
  const detailed = [];
  const carriedOver = [];
  for (const axis of axes) {
    if (blocked.has(axis.axis) || !alreadyPrinted(rendering, axis)) {
      detailed.push(...renderAxis(rendering, axis));
    } else {
      carriedOver.push(axis.label);
    }
  }
  const heading = next === null ? "Ce qui bloque :" : `Pour atteindre ${next.label} (rang ${next.rank}) :`;
  return [
    style.heading(heading),
    ...detailed,
    ...orphans,
    ...renderCarriedOver(rendering, carriedOver)
  ].join("\n");
}
function renderCarriedOver({ report, style }, labels) {
  if (labels.length === 0 || report.proven === null) {
    return [];
  }
  const names = labels.join(", ");
  return [style.faint(`  D\xE9j\xE0 au niveau requis pour ${nextLabel(report)} : ${names}.`)];
}
function nextLabel(report) {
  return report.next?.label ?? "le niveau suivant";
}
function alreadyPrinted(rendering, axis) {
  const printed = rendering.report.proven?.axes.find((candidate) => candidate.axis === axis.axis);
  if (printed === void 0) {
    return false;
  }
  return renderAxis(rendering, printed).join("\n") === renderAxis(rendering, axis).join("\n");
}
function renderAxes(rendering, axes) {
  return axes.flatMap((axis) => renderAxis(rendering, axis));
}
function renderAxis(rendering, axis) {
  return [
    `  ${markerFor(rendering.style, axis.outcome)} ${axis.label}`,
    ...axis.requirements.flatMap(
      (requirement) => renderRequirement(rendering, axis.axis, requirement)
    )
  ];
}
function markerFor(style, outcome) {
  switch (outcome) {
    case "MET":
      return style.satisfied("\u2713");
    case "NOT_MET":
      return style.practiceGap("\u2717");
    case "UNPROVEN":
      return style.evidenceGap("?");
  }
}
function renderRequirement(rendering, axis, requirement) {
  const { style } = rendering;
  if (isOrdinalPracticeGap(rendering.report, axis, requirement)) {
    const evidence = style.faint(`(${requirement.evidence})`);
    return [
      `      ${gapTagFor(style, requirement.outcome)}aujourd\u2019hui : ${describeTerm(rendering.report, axis, requirement.observed)} (${requirement.observed}) ${evidence}`,
      `          pour ${nextLabel(rendering.report)} : ${describeTerm(rendering.report, axis, requirement.threshold)} (${requirement.threshold}).`
    ];
  }
  const gloss = requirement.outcome === "UNPROVEN" ? ` \u2014 ${explainEvidenceGap(rendering, axis, requirement)}` : "";
  const fact = renderRequirementFact(rendering, axis, requirement);
  return [`      ${gapTagFor(style, requirement.outcome)}${fact}${gloss}`];
}
function isOrdinalPracticeGap(report, axis, requirement) {
  return requirement.outcome === "NOT_MET" && vocabularyFor2(report.vocabulary, axis)?.kind === "ordinal" && typeof requirement.threshold === "string" && typeof requirement.observed === "string";
}
function renderRequirementFact({ report, style }, axis, requirement) {
  const evidence = style.faint(`(${requirement.evidence})`);
  if (requirement.observed === null) {
    return `aucune observation ${evidence}`;
  }
  switch (requirement.outcome) {
    case "MET":
      return renderMetFact(report, axis, requirement, evidence);
    case "NOT_MET":
      return renderPracticeGapFact(report, axis, requirement, evidence);
    case "UNPROVEN":
      return `requis ${formatScaleValue(report, axis, requirement.threshold)} \xB7 observ\xE9 ${formatScaleValue(report, axis, requirement.observed)} ${evidence}`;
  }
}
function renderMetFact(report, axis, requirement, evidence) {
  const vocabulary = vocabularyFor2(report.vocabulary, axis);
  if (vocabulary?.kind === "set" && isStringList(requirement.observed)) {
    if (isStringList(requirement.threshold) && requirement.threshold.length === 0) {
      return `requis l'ensemble vide \xB7 pratique observ\xE9e : ${describeTerms(report, axis, requirement.observed)} ${evidence}`;
    }
    return `requis atteint : ${describeTerms(report, axis, isStringList(requirement.threshold) ? requirement.threshold : requirement.observed)} ${evidence}`;
  }
  if (vocabulary?.kind === "ordinal" && typeof requirement.observed === "string") {
    return `requis atteint : ${describeTerm(report, axis, requirement.observed)} (${requirement.observed}) ${evidence}`;
  }
  if (vocabulary?.kind === "numeric" && typeof requirement.observed === "number") {
    return `requis atteint : ${requirement.observed} ${vocabulary.description} (minimum ${requirement.threshold}) ${evidence}`;
  }
  return `requis ${formatScaleValue(report, axis, requirement.threshold)} \xB7 observ\xE9 ${formatScaleValue(report, axis, requirement.observed)} ${evidence}`;
}
function renderPracticeGapFact(report, axis, requirement, evidence) {
  const vocabulary = vocabularyFor2(report.vocabulary, axis);
  if (vocabulary?.kind === "set" && isStringList(requirement.threshold) && isStringList(requirement.observed)) {
    const observed = requirement.observed;
    const missing = requirement.threshold.filter((term) => !observed.includes(term));
    return `manque : ${describeTerms(report, axis, missing)} (${missing.join(", ")}) ${evidence}`;
  }
  if (vocabulary?.kind === "numeric" && typeof requirement.observed === "number") {
    return `requis : minimum ${requirement.threshold} \xB7 observ\xE9 : ${requirement.observed} ${vocabulary.description} ${evidence}`;
  }
  return `requis ${formatScaleValue(report, axis, requirement.threshold)} \xB7 observ\xE9 ${formatScaleValue(report, axis, requirement.observed)} ${evidence}`;
}
function gapTagFor(style, outcome) {
  switch (outcome) {
    case "MET":
      return "";
    case "NOT_MET":
      return `${style.practiceGap("[\xE9cart de pratique]")} `;
    case "UNPROVEN":
      return `${style.evidenceGap("[\xE9cart de preuve]")} `;
  }
}
function explainEvidenceGap(rendering, axis, requirement) {
  if (requirement.diagnostic !== void 0) {
    return explainDiagnostic(requirement.diagnostic);
  }
  return explainEvidenceStatus(rendering, axis, requirement.evidence);
}
function explainEvidenceStatus(rendering, axis, evidence) {
  switch (evidence) {
    case "UNKNOWN":
      return whoWasAsked(rendering.report, axis);
    case "CLAIMED":
      return "la d\xE9claration n'a pas pu \xEAtre confirm\xE9e ind\xE9pendamment";
    case "CONFLICTING":
      return "les observations se contredisent";
  }
}
function explainDiagnostic(diagnostic) {
  switch (diagnostic.reason) {
    case "INSUFFICIENT_ACTIVE_DAYS":
      return `\xE9chantillon insuffisant : ${diagnostic.observed} jours actifs de PR observ\xE9s, minimum ${diagnostic.minimum} requis`;
  }
}
function whoWasAsked(report, axis) {
  const asked = report.provenance.filter((entry) => entry.axes.includes(axis));
  if (asked.length === 0) {
    return "aucun collecteur n'a \xE9t\xE9 interrog\xE9 pour cet axe";
  }
  const names = asked.map((entry) => entry.collector).join(", ");
  return `demand\xE9 \xE0 ${names}, aucune valeur observ\xE9e`;
}
function renderOrphanBlocker(rendering, blocker) {
  const { report, style } = rendering;
  const level = report.levels.find((candidate) => candidate.id === blocker.level);
  const axisLabel = level?.axes.find((candidate) => candidate.axis === blocker.axis)?.label;
  const where = `${axisLabel ?? blocker.axis} \xE0 ${level?.label ?? blocker.level}`;
  switch (blocker.gap) {
    case "PRACTICE":
      return `  ${markerFor(style, "NOT_MET")} ${gapTagFor(style, "NOT_MET")}${where}, exigence absente du rapport`;
    case "EVIDENCE":
      return `  ${markerFor(style, "UNPROVEN")} ${gapTagFor(style, "UNPROVEN")}${where} \u2014 ${explainEvidenceStatus(rendering, blocker.axis, blocker.evidence)}`;
  }
}
function formatScaleValue(report, axis, value) {
  if (typeof value === "object") {
    if (value.length === 0) return "l'ensemble vide";
    const raw = value.join(", ");
    const explanations = value.map((term) => descriptionFor(report.vocabulary, axis, term)).flatMap(
      (description, index) => description === void 0 ? [] : [`${value[index]} : ${description}`]
    );
    return explanations.length === 0 ? raw : `${raw} (${explanations.join(" ; ")})`;
  }
  return formatTerm(report, axis, value);
}
function formatTerm(report, axis, value) {
  if (typeof value === "number") {
    const vocabulary = vocabularyFor2(report.vocabulary, axis);
    return vocabulary?.kind === "numeric" ? `${value} (${vocabulary.description})` : String(value);
  }
  const description = descriptionFor(report.vocabulary, axis, value);
  return description === void 0 ? value : `${value} (${description})`;
}
function describeTerms(report, axis, terms) {
  if (terms.length === 0) return "l'ensemble vide";
  return terms.map((term) => describeTerm(report, axis, term)).join(" ; ");
}
function isStringList(value) {
  return Array.isArray(value);
}
function describeTerm(report, axis, term) {
  return descriptionFor(report.vocabulary, axis, term) ?? term;
}
function vocabularyFor2(vocabulary, axis) {
  return vocabulary.find((candidate) => candidate.axis === axis);
}
function descriptionFor(vocabulary, axis, term) {
  const scale = vocabularyFor2(vocabulary, axis);
  if (scale === void 0 || scale.kind === "numeric") return void 0;
  return scale.descriptions[term];
}
function renderContributorsSection(rendering) {
  const { report, style } = rendering;
  const { contributors } = report;
  if (contributors === null) return "";
  if (contributors.status !== "COMPLETED") {
    return style.heading(renderFailedRoster(contributors));
  }
  const header = style.heading(renderContributorsHeader(contributors));
  if (contributors.rows.length === 0) {
    return header;
  }
  const rows = contributors.rows.map((row) => renderContributorRow(rendering, contributors, row));
  const harness = renderSharedHarnessLine(rendering, contributors);
  return [header, ...rows, ...harness === null ? [] : [harness]].join("\n\n");
}
function renderFailedRoster(roster) {
  return `Contributeurs : ${glossRosterStatus(roster.status)} \u2014 ${roster.reason}. Le niveau ci-dessus est inchang\xE9.`;
}
function glossRosterStatus(status) {
  switch (status) {
    case "FAILED":
      return "lecture impossible";
    case "TIMED_OUT":
      return "d\xE9lai d\xE9pass\xE9";
  }
}
function renderContributorsHeader(contributors) {
  if (contributors.rows.length === 0) {
    return `Contributeurs : aucun compte actif sur les ${contributors.windowDays} derniers jours.`;
  }
  const named = contributors.rows.filter((row) => row.account !== null).length;
  const accounts = named === 1 ? "1 compte actif" : `${named} comptes actifs`;
  const unattributed = contributors.rows.some((row) => row.account === null) ? ", plus des commits que GitHub ne rattache \xE0 aucun compte" : "";
  return `Contributeurs : ${accounts} sur les ${contributors.windowDays} derniers jours${unattributed}. Le niveau ci-dessus couvre toutes les livraisons de la fen\xEAtre, quel qu'en soit l'auteur ; chaque ligne ci-dessous ne couvre que celles d'un compte.`;
}
function renderContributorRow(rendering, contributors, row) {
  const { style } = rendering;
  const label = row.account ?? "non rattach\xE9";
  const lines = [
    style.heading(`  ${label} \u2014 ${renderRowProvenLabel(row)}`),
    style.faint(`    ${renderRowSample(row)}`)
  ];
  const demonstrated2 = renderRowDemonstrated(rendering, row);
  if (demonstrated2 !== null) lines.push(demonstrated2);
  if (row.proven === null) {
    const observed = renderRowObserved(rendering, row);
    if (observed !== null) lines.push(observed);
  }
  if (row.blocking.length > 0) {
    const aim = renderRowNext(rendering, row);
    if (aim !== null) lines.push(aim);
    lines.push(...renderRowGapLines(rendering, row));
  }
  lines.push(style.faint(`    ${renderRowHarness(row, contributors)}`));
  return lines.join("\n");
}
function renderRowNext(rendering, row) {
  const { style } = rendering;
  if (row.next === null) return null;
  return style.faint(`    pour atteindre ${row.next.label} (rang ${row.next.rank}) :`);
}
function renderRowObserved(rendering, row) {
  const { report, style } = rendering;
  const confirmed = row.observed.flatMap(
    (entry) => entry.evidence === "CONFIRMED" && entry.value !== null ? [{ axis: entry.axis, value: entry.value }] : []
  );
  if (confirmed.length === 0) return null;
  const parts = confirmed.map(
    (entry) => `${labelFor(report, entry.axis) ?? entry.axis} : ${formatScaleValue(report, entry.axis, entry.value)}`
  );
  return style.faint(`    observ\xE9 sur son propre \xE9chantillon \u2014 ${parts.join(" \xB7 ")}`);
}
function renderRowProvenLabel(row) {
  return row.proven === null ? "niveau prouv\xE9 : aucun" : `niveau prouv\xE9 : ${row.proven.label} (rang ${row.proven.rank})`;
}
function renderRowSample(row) {
  if (row.deliveries === 0) {
    const whose = row.account === null ? " dont l'adresse d'auteur n'est rattach\xE9e \xE0 aucun compte GitHub" : "";
    return `${countOf(0, "livraison")} \xB7 ${countOf(row.commits, "commit")}${whose}`;
  }
  return `${countOf(row.deliveries, "livraison")} \xB7 ${countOf(row.activeDays, "jour actif", "jours actifs")}`;
}
function countOf(count, one, many = `${one}s`) {
  return `${count} ${count < 2 ? one : many}`;
}
function renderRowDemonstrated(rendering, row) {
  const { report, style } = rendering;
  const { demonstrated: demonstrated2, proven } = row;
  if (demonstrated2 === null || demonstrated2.level === null) return null;
  if (proven === null) return null;
  if (demonstrated2.level.rank <= proven.rank) return null;
  const level = demonstrated2.level;
  return [
    style.faint(`    d\xE9montr\xE9 : ${level.label} (rang ${level.rank}), atteint sur :`),
    ...demonstrated2.axes.map(
      (axis) => style.faint(`      ${renderDemonstratedAxis(report, axis)}`)
    )
  ].join("\n");
}
function renderRowGapLines(rendering, row) {
  const practiceBlockers = row.blocking.filter(
    (blocker) => blocker.gap === "PRACTICE"
  );
  if (practiceBlockers.length > 0) {
    return practiceBlockers.map((blocker) => renderRowPracticeGap(rendering, row, blocker));
  }
  const evidenceBlockers = row.blocking.filter(
    (blocker) => blocker.gap === "EVIDENCE"
  );
  return evidenceBlockers.length === 0 ? [] : [renderRowEvidenceGap(rendering, evidenceBlockers)];
}
function renderRowPracticeGap(rendering, row, blocker) {
  const { report, style } = rendering;
  const located = locateAxis(report, blocker);
  const axis = row.next?.axes.find((candidate) => candidate.axis === blocker.axis);
  const levelLabel = row.next?.label ?? located.levelLabel;
  const axisLabel = axis?.label ?? located.axisLabel;
  const tag = gapTagFor(style, "NOT_MET");
  const requirement = findUniquePracticeRequirement(axis, blocker);
  if (requirement === void 0) {
    return `    ${tag}${axisLabel} \xE0 ${levelLabel} : la pratique observ\xE9e n'atteint pas l'exigence.`;
  }
  const evidence = style.faint(`(${requirement.evidence})`);
  const fact = renderPracticeGapFact(report, blocker.axis, requirement, evidence);
  return `    ${tag}${axisLabel} \xE0 ${levelLabel} : ${fact}`;
}
function renderRowEvidenceGap(rendering, blockers) {
  const { report, style } = rendering;
  const labels = blockers.map((blocker) => locateAxis(report, blocker).axisLabel);
  const verb = labels.length === 1 ? "reste" : "restent";
  return `    ${gapTagFor(style, "UNPROVEN")}l'\xE9chantillon propre \xE0 ce compte n'a pas permis de trancher : ${joinLabels(labels)} ${verb} sans r\xE9ponse pour ce compte. Ce n'est pas un constat sur sa pratique.`;
}
function joinLabels(labels) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} et ${labels[labels.length - 1]}`;
}
function locateAxis(report, blocker) {
  const level = report.levels.find((candidate) => candidate.id === blocker.level);
  const axis = level?.axes.find((candidate) => candidate.axis === blocker.axis);
  return {
    levelLabel: level?.label ?? blocker.level,
    axisLabel: axis?.label ?? blocker.axis,
    axis
  };
}
function findUniquePracticeRequirement(axis, blocker) {
  const matches = (axis?.requirements ?? []).filter(
    (candidate) => candidate.evidence === "CONFIRMED" && candidate.outcome === blocker.outcome
  );
  return matches.length === 1 ? matches[0] : void 0;
}
var HARNESS_AXIS = "harness";
function renderSharedHarnessLine({ report, style }, contributors) {
  if (contributors.harnessObserved === null) return null;
  const observed = formatScaleValue(report, HARNESS_AXIS, contributors.harnessObserved);
  return style.faint(
    `  Le harness est celui du d\xE9p\xF4t, pas celui d'une personne : ${observed}, disponible pour chaque compte ci-dessus, qui en porte la m\xEAme valeur.`
  );
}
function renderRowHarness(row, contributors) {
  if (row.harnessAuthorship === null) {
    return "harness : l'attribution n'a pas pu \xEAtre lue";
  }
  if (contributors.harnessPaths === 0) {
    return "harness : l'ensemble harness de ce d\xE9p\xF4t est vide";
  }
  const { files } = row.harnessAuthorship;
  const written = files === 0 ? `n'a \xE9crit aucun des ${contributors.harnessPaths} fichiers` : `a \xE9crit ${files} des ${contributors.harnessPaths} fichiers`;
  return `harness : ce compte ${written} de l'ensemble harness de ce d\xE9p\xF4t`;
}

// src/cli/renderers/unrenderable-report.error.ts
var UnrenderableReportError = class extends Error {
};

// src/cli/renderers/json.renderer.ts
function renderJsonReport(report) {
  return JSON.stringify(projectValidated(report, "$"), null, 2);
}
function renderJsonReports(reports) {
  const projected = reports.map((report, index) => projectValidated(report, `$[${index}]`));
  return JSON.stringify(projected, null, 2);
}
function projectValidated(report, path) {
  const projected = projectReport(report);
  assertEveryNumberFinite(projected, path);
  return projected;
}
function assertEveryNumberFinite(value, path) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new UnrenderableReportError(
        `${path} is ${value}; JSON renders it as null, which this report reads as absence.`
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertEveryNumberFinite(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, member] of Object.entries(value)) {
      assertEveryNumberFinite(member, `${path}.${key}`);
    }
  }
}
function projectReport(report) {
  return {
    schemaVersion: report.schemaVersion,
    model: { id: report.model.id, schemaVersion: report.model.schemaVersion },
    subject: { path: report.subject.path },
    contributors: projectContributors(report.contributors),
    proven: report.proven === null ? null : projectLevel(report.proven),
    next: report.next === null ? null : projectLevel(report.next),
    demonstrated: report.demonstrated === null ? null : projectDemonstrated(report.demonstrated),
    levels: report.levels.map(projectLevel),
    blocking: report.blocking.map(projectBlockingRequirement),
    vocabulary: report.vocabulary.map(projectVocabulary),
    coverage: projectCoverage(report.coverage),
    provenance: report.provenance.map(projectProvenanceEntry)
  };
}
function projectVocabulary(vocabulary) {
  switch (vocabulary.kind) {
    case "ordinal":
      return {
        axis: vocabulary.axis,
        kind: vocabulary.kind,
        values: vocabulary.values,
        descriptions: vocabulary.descriptions
      };
    case "set":
      return {
        axis: vocabulary.axis,
        kind: vocabulary.kind,
        members: vocabulary.members,
        descriptions: vocabulary.descriptions
      };
    case "numeric":
      return { axis: vocabulary.axis, kind: vocabulary.kind, description: vocabulary.description };
  }
}
function projectDemonstrated(demonstrated2) {
  return {
    level: demonstrated2.level === null ? null : projectDemonstratedLevel(demonstrated2.level),
    axes: demonstrated2.axes.map((axis) => ({
      axis: axis.axis,
      observed: axis.observed,
      share: axis.share,
      unit: axis.unit
    }))
  };
}
function projectDemonstratedLevel(level) {
  return { id: level.id, rank: level.rank, label: level.label, outcome: level.outcome };
}
function projectLevel(level) {
  return {
    id: level.id,
    rank: level.rank,
    label: level.label,
    outcome: level.outcome,
    axes: level.axes.map(projectAxis)
  };
}
function projectAxis(axis) {
  return {
    axis: axis.axis,
    label: axis.label,
    outcome: axis.outcome,
    requirements: axis.requirements.map(projectRequirement)
  };
}
function projectRequirement(requirement) {
  switch (requirement.outcome) {
    case "MET":
    case "NOT_MET":
      return {
        axis: requirement.axis,
        threshold: requirement.threshold,
        observed: requirement.observed,
        evidence: requirement.evidence,
        outcome: requirement.outcome
      };
    case "UNPROVEN":
      return {
        axis: requirement.axis,
        threshold: requirement.threshold,
        observed: requirement.observed,
        evidence: requirement.evidence,
        outcome: requirement.outcome,
        ...requirement.diagnostic === void 0 ? {} : { diagnostic: requirement.diagnostic }
      };
  }
}
function projectBlockingRequirement(blocker) {
  switch (blocker.gap) {
    case "PRACTICE":
      return {
        level: blocker.level,
        axis: blocker.axis,
        evidence: blocker.evidence,
        outcome: blocker.outcome,
        gap: blocker.gap
      };
    case "EVIDENCE":
      return {
        level: blocker.level,
        axis: blocker.axis,
        evidence: blocker.evidence,
        outcome: blocker.outcome,
        gap: blocker.gap
      };
  }
}
function projectCoverage(coverage) {
  return {
    axesRequested: coverage.axesRequested,
    axesObserved: coverage.axesObserved,
    axesConfirmed: coverage.axesConfirmed
  };
}
function projectProvenanceEntry(entry) {
  switch (entry.status) {
    case "COMPLETED":
      return { collector: entry.collector, status: entry.status, axes: entry.axes };
    case "FAILED":
    case "TIMED_OUT":
    case "SKIPPED":
      return {
        collector: entry.collector,
        status: entry.status,
        axes: entry.axes,
        reason: entry.reason
      };
  }
}
function projectContributors(contributors) {
  if (contributors === null) return null;
  switch (contributors.status) {
    case "COMPLETED":
      return {
        status: contributors.status,
        windowDays: contributors.windowDays,
        harnessObserved: contributors.harnessObserved,
        harnessPaths: contributors.harnessPaths,
        rows: contributors.rows.map(projectContributorRow)
      };
    case "FAILED":
    case "TIMED_OUT":
      return { status: contributors.status, rows: [], reason: contributors.reason };
  }
}
function projectContributorRow(row) {
  return {
    account: row.account,
    emailAddresses: row.emailAddresses,
    commits: row.commits,
    deliveries: row.deliveries,
    activeDays: row.activeDays,
    harnessAuthorship: row.harnessAuthorship === null ? null : { files: row.harnessAuthorship.files, commits: row.harnessAuthorship.commits },
    proven: row.proven === null ? null : projectLevel(row.proven),
    next: row.next === null ? null : projectLevel(row.next),
    observed: row.observed.map((entry) => ({
      axis: entry.axis,
      value: entry.value,
      evidence: entry.evidence
    })),
    demonstrated: row.demonstrated === null ? null : projectDemonstrated(row.demonstrated),
    blocking: row.blocking.map(projectBlockingRequirement)
  };
}

// src/cli/subjects/resolve-subjects.ts
import { readdir as readdir2, stat as stat3 } from "fs/promises";
import { join as join7 } from "path";

// src/evidence/adapters/fixture-bundle/bundle-manifest.ts
import { stat as stat2 } from "fs/promises";
import { join as join6 } from "path";
var BUNDLE_MANIFEST2 = "profile.json";
async function isBundle2(path) {
  try {
    return (await stat2(join6(path, BUNDLE_MANIFEST2))).isFile();
  } catch {
    return false;
  }
}

// src/cli/subjects/resolve-subjects.ts
async function resolveSubjects(path, signal) {
  signal.throwIfAborted();
  const stats = await stat3(path);
  if (stats.isFile()) {
    return { subjects: [path], isWorkTreeRoot: false, isSet: false };
  }
  if (await isBundle2(path)) {
    return { subjects: [path], isWorkTreeRoot: await isRepositoryRoot(path, signal), isSet: false };
  }
  if (await isRepositoryRoot(path, signal)) {
    return { subjects: [path], isWorkTreeRoot: true, isSet: false };
  }
  const children = await childBundles(path, signal);
  if (children.length > 0) {
    return { subjects: children, isWorkTreeRoot: false, isSet: true };
  }
  throw new UsageError(
    `Subject path '${path}' is neither a repository, a recorded bundle, nor a directory with one sitting directly inside it.`
  );
}
async function childBundles(path, signal) {
  const entries = await readEntries(path);
  const names = entries.map((entry) => entry.name).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const bundles = [];
  for (const name of names) {
    signal.throwIfAborted();
    const candidate = join7(path, name);
    if (await isBundle2(candidate)) bundles.push(candidate);
  }
  return bundles;
}
var CALLER_FAULT_CODES = /* @__PURE__ */ new Set(["EACCES", "EPERM", "ENOENT", "ENOTDIR"]);
async function readEntries(path) {
  try {
    return await readdir2(path, { withFileTypes: true });
  } catch (error) {
    const code = error.code;
    if (code === void 0 || !CALLER_FAULT_CODES.has(code)) throw error;
    throw new UsageError(`Subject path '${path}' could not be read (${code}).`);
  }
}

// src/cli/commands/assess.command.ts
async function forgeAccessFor(subjectPath, isWorkTreeRoot, signal) {
  if (!isWorkTreeRoot) return null;
  const slug = await repositorySlug(subjectPath, signal);
  if (slug === null) return null;
  return { slug, deliveries: forgeDeliveryReader(slug, subjectPath) };
}
async function rosterFor(forge, subjectPath, signal) {
  if (forge === null) return null;
  const tree = await trackedTree(subjectPath, signal);
  return new ForgeContributorRosterAdapter(forge.slug, subjectPath, forge.deliveries, tree);
}
function collectorsFor(forge) {
  if (forge === null) {
    return [new LiveRepositoryEvidenceCollector(), new FixtureBundleEvidenceCollector()];
  }
  return [
    new LiveRepositoryEvidenceCollector(["harness"]),
    new ForgeRepositoryEvidenceCollector(forge.slug, forge.deliveries),
    new FixtureBundleEvidenceCollector()
  ];
}
async function runAssess(argv2, io, options = {}) {
  const budget = new AbortController();
  try {
    const args = parseAssessArguments(argv2);
    requireExistingSubject(args.subjectPath);
    const resolved = await resolveSubjects(args.subjectPath, budget.signal);
    const model = loadMaturityModel(args.modelPath ?? canonicalModelPath());
    const reports = [];
    for (const subjectPath of resolved.subjects) {
      const isWorkTreeRoot = resolved.isSet ? await isRepositoryRoot(subjectPath, budget.signal) : resolved.isWorkTreeRoot;
      const forge = await forgeAccessFor(subjectPath, isWorkTreeRoot, budget.signal);
      const roster = "roster" in options ? options.roster : await rosterFor(forge, subjectPath, budget.signal);
      reports.push(
        await assessMaturity({
          subjectPath,
          model,
          collectors: options.collectors ?? collectorsFor(forge),
          // COMPAT: `exactOptionalPropertyTypes` forbids `roster: undefined` — the key must be
          // absent rather than present holding it, so a `null` roster (no origin, or a suite's own
          // override) is spread away instead of passed through.
          ...roster === null || roster === void 0 ? {} : { roster },
          signal: budget.signal
        })
      );
    }
    const rendered = renderReports(reports, resolved.isSet, args.json, io.colours);
    io.stdout(`${rendered}
`);
    return 0;
  } catch (error) {
    io.stderr(`${messageOf(error)}
`);
    return error instanceof UsageError || error instanceof InvalidMaturityModelError ? 2 : 1;
  } finally {
    budget.abort();
  }
}
function renderReports(reports, isSet, json, colours) {
  const [only] = reports;
  const style = colours ? colouredText : plainText;
  if (!isSet && only !== void 0)
    return json ? renderJsonReport(only) : renderHumanReport(only, style);
  return json ? renderJsonReports(reports) : renderHumanReports(reports, style);
}
function requireExistingSubject(subjectPath) {
  let stats;
  try {
    stats = statSync(subjectPath);
  } catch {
    throw new UsageError(`Subject path '${subjectPath}' does not exist.`);
  }
  if (!stats.isDirectory() && !stats.isFile()) {
    throw new UsageError(`Subject path '${subjectPath}' is neither a file nor a directory.`);
  }
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/cli/commands/harness.command.ts
import { statSync as statSync2 } from "fs";

// src/harness/adapters/claude-harness.adapter.ts
import { homedir } from "os";
import { dirname as dirname2, join as join9, resolve as resolve2 } from "path";

// src/harness/adapters/claude/context-imports.ts
var IMPORT_DEPTH_LIMIT = 4;
var FENCE = /^```/;
var BACKTICK_SPAN = /`[^`\n]*`/g;
var MACHINE_IMPORT_PREFIX = "~/.claude/";
function withoutQuotedText(content) {
  const kept = [];
  let inFence = false;
  for (const line of content.split("\n")) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
      kept.push("");
      continue;
    }
    if (inFence) {
      kept.push("");
      continue;
    }
    kept.push(line.replace(BACKTICK_SPAN, (span) => " ".repeat(span.length)));
  }
  return kept.join("\n");
}
function importsIn(content) {
  const found = [];
  for (const line of withoutQuotedText(content).split("\n")) {
    for (const token of line.split(/\s+/)) {
      if (token.startsWith("@") && token.length > 1) found.push(token.slice(1));
    }
  }
  return found;
}
function resolveRelative(fromPath, importPath) {
  if (importPath.startsWith(MACHINE_IMPORT_PREFIX)) return importPath;
  const machinePath = fromPath.startsWith(MACHINE_IMPORT_PREFIX);
  const fromDir = machinePath ? fromPath.slice(0, fromPath.lastIndexOf("/") + 1) : fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const combined = fromDir === "" ? importPath : `${fromDir}/${importPath}`;
  if (machinePath) {
    const relative = combined.slice(MACHINE_IMPORT_PREFIX.length);
    return `${MACHINE_IMPORT_PREFIX}${normalisePath(relative)}`;
  }
  return normalisePath(combined);
}
function normalisePath(combined) {
  const resolved = [];
  for (const segment of combined.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") resolved.pop();
    else resolved.push(segment);
  }
  return resolved.join("/");
}
async function followImports(entryPath, entryContent, read) {
  const visited = /* @__PURE__ */ new Set([entryPath]);
  const found = /* @__PURE__ */ new Map();
  async function collect(path, content, depth) {
    for (const rawImport of importsIn(content)) {
      const resolved = resolveRelative(path, rawImport);
      if (visited.has(resolved)) continue;
      visited.add(resolved);
      const importedContent = await read(resolved);
      found.set(resolved, { path: resolved, content: importedContent });
      if (importedContent !== null && depth < IMPORT_DEPTH_LIMIT) {
        await collect(resolved, importedContent, depth + 1);
      }
    }
  }
  await collect(entryPath, entryContent, 1);
  return [...found.values()];
}

// src/harness/adapters/claude/rule-tier.ts
var import_yaml2 = __toESM(require_dist(), 1);
var FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
function readFrontMatter(content) {
  const match = FRONT_MATTER_BLOCK.exec(content);
  if (match === null) return { present: false };
  let data;
  try {
    data = (0, import_yaml2.parse)(match[1] ?? "");
  } catch {
    return { present: true, parsed: false };
  }
  return {
    present: true,
    parsed: true,
    data: typeof data === "object" && data !== null ? data : {},
    body: match[2] ?? ""
  };
}
function tierOfRule(content) {
  const frontMatter = readFrontMatter(content);
  if (!frontMatter.present) return { decided: true, tier: "ALWAYS_LOADED" };
  if (!frontMatter.parsed) return { decided: false, reason: "INVALID_RULE_FRONT_MATTER" };
  return {
    decided: true,
    tier: "paths" in frontMatter.data ? "CONDITIONALLY_LOADED" : "ALWAYS_LOADED"
  };
}

// src/harness/adapters/claude/declaration-front-matter.ts
function splitDeclaration(content) {
  const frontMatter = readFrontMatter(content);
  if (!frontMatter.present) {
    return { decided: false, reason: "MISSING_DECLARATION_FRONT_MATTER" };
  }
  if (!frontMatter.parsed) {
    return { decided: false, reason: "INVALID_DECLARATION_FRONT_MATTER" };
  }
  const description = frontMatter.data["description"];
  if (typeof description !== "string") {
    return { decided: false, reason: "MISSING_DECLARATION_DESCRIPTION" };
  }
  return { decided: true, description, body: frontMatter.body };
}

// src/harness/adapters/claude/directory-tree.ts
import { readFile as readFile4, readdir as readdir3 } from "fs/promises";
import { join as join8 } from "path";
var NEVER_LOADED = /* @__PURE__ */ new Set(["node_modules", ".git", ".DS_Store"]);
function isSkipped(name) {
  return NEVER_LOADED.has(name) || name.startsWith(".");
}
function directoryTree(root, signal) {
  return {
    entries: (directory) => walk2(root, directory, signal),
    read: async (path) => {
      signal.throwIfAborted();
      try {
        return await readFile4(join8(root, path), "utf8");
      } catch {
        return null;
      }
    }
  };
}
async function walk2(root, directory, signal) {
  signal.throwIfAborted();
  let listing;
  try {
    listing = await readdir3(join8(root, directory), { withFileTypes: true });
  } catch {
    return [];
  }
  const entries = [];
  for (const entry of listing) {
    if (isSkipped(entry.name)) continue;
    const path = directory === "" ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      entries.push(...await walk2(root, path, signal));
    } else if (entry.isFile()) {
      entries.push({ path });
    }
  }
  return entries;
}

// src/harness/adapters/claude-harness.adapter.ts
var CONTEXT_FILE_CANDIDATES = ["CLAUDE.md", ".claude/CLAUDE.md"];
var LOCAL_CONTEXT_FILE = "CLAUDE.local.md";
var RULES_DIRECTORY = "rules";
var DECLARATION_DIRECTORIES = ["skills", "agents", "commands"];
var SUBJECT_PREFIX = ".claude/";
var MACHINE_IMPORT_PREFIX2 = "~/.claude/";
var BODY_SUFFIX = "::body";
function push(files, seen, root, path, content, tier, scope, publishAt) {
  const key = resolve2(root, path);
  if (seen.has(key)) return;
  seen.add(key);
  const published = publishAt(path);
  files.push({
    path: published,
    byteSize: Buffer.byteLength(content, "utf8"),
    content,
    tier,
    scope
  });
}
async function findContextFile(tree) {
  for (const candidate of CONTEXT_FILE_CANDIDATES) {
    const content = await tree.read(candidate);
    if (content !== null) return { path: candidate, content };
  }
  return null;
}
async function forEachImportOf(tree, machineTree, entry, publish, publishMachineImport, markUnread) {
  const imports = await followImports(
    entry.path,
    entry.content,
    (path) => path.startsWith(MACHINE_IMPORT_PREFIX2) ? machineTree.read(path.slice(MACHINE_IMPORT_PREFIX2.length)) : tree.read(path)
  );
  for (const imported of imports) {
    if (imported.content === null) {
      markUnread(imported.path);
    } else if (imported.path.startsWith(MACHINE_IMPORT_PREFIX2)) {
      publishMachineImport(imported.path, imported.content);
    } else {
      publish(imported.path, imported.content);
    }
  }
}
async function readContextFiles(tree, files, unread, seen, scope, root, machineRoot, machineTree, publishAt = (path) => path) {
  const main = await findContextFile(tree);
  if (main === null) return;
  const publish = (path, content) => push(files, seen, root, path, content, "ALWAYS_LOADED", scope, publishAt);
  const publishMachineImport = (path, content) => {
    const localPath2 = path.slice(MACHINE_IMPORT_PREFIX2.length);
    push(
      files,
      seen,
      machineRoot,
      localPath2,
      content,
      "ALWAYS_LOADED",
      "MACHINE",
      (publishedPath) => join9(machineRoot, publishedPath)
    );
  };
  const markUnread = (path) => {
    const machineImport = path.startsWith(MACHINE_IMPORT_PREFIX2);
    unread.push({
      path: machineImport ? join9(machineRoot, path.slice(MACHINE_IMPORT_PREFIX2.length)) : publishAt(path),
      scope: machineImport ? "MACHINE" : scope,
      reason: "MISSING_IMPORT"
    });
  };
  publish(main.path, main.content);
  await forEachImportOf(tree, machineTree, main, publish, publishMachineImport, markUnread);
  const localDirectory = main.path.includes("/") ? main.path.slice(0, main.path.lastIndexOf("/")) : "";
  const localPath = localDirectory === "" ? LOCAL_CONTEXT_FILE : `${localDirectory}/${LOCAL_CONTEXT_FILE}`;
  const local = await tree.read(localPath);
  if (local === null) return;
  const localEntry = { path: localPath, content: local };
  publish(localPath, local);
  await forEachImportOf(tree, machineTree, localEntry, publish, publishMachineImport, markUnread);
}
async function readRules(tree, files, unread, seen, scope, root, publishAt, prefix) {
  for (const entry of await tree.entries(`${prefix}${RULES_DIRECTORY}`)) {
    const content = await tree.read(entry.path);
    if (content === null) continue;
    const reading = tierOfRule(content);
    if (!reading.decided) {
      unread.push({ path: publishAt(entry.path), scope, reason: reading.reason });
      continue;
    }
    push(files, seen, root, entry.path, content, reading.tier, scope, publishAt);
  }
}
async function readDeclarations(tree, directory, files, unread, seen, scope, root, publishAt) {
  for (const entry of await tree.entries(directory)) {
    if (!entry.path.endsWith(".md")) continue;
    const content = await tree.read(entry.path);
    if (content === null) continue;
    const declaration = splitDeclaration(content);
    if (!declaration.decided) {
      unread.push({ path: publishAt(entry.path), scope, reason: declaration.reason });
      continue;
    }
    push(files, seen, root, entry.path, declaration.description, "ALWAYS_LOADED", scope, publishAt);
    const bodyPath = `${entry.path}${BODY_SUFFIX}`;
    push(files, seen, root, bodyPath, declaration.body, "CONDITIONALLY_LOADED", scope, publishAt);
  }
}
async function readOneScope(tree, scope, files, unread, seen, root, publishAt, prefix, machineRoot, machineTree) {
  await readContextFiles(
    tree,
    files,
    unread,
    seen,
    scope,
    root,
    machineRoot,
    machineTree,
    publishAt
  );
  await readRules(tree, files, unread, seen, scope, root, publishAt, prefix);
  for (const directory of DECLARATION_DIRECTORIES) {
    await readDeclarations(
      tree,
      `${prefix}${directory}`,
      files,
      unread,
      seen,
      scope,
      root,
      publishAt
    );
  }
}
async function readAncestors(subjectPath, signal, files, unread, seen, machineRoot, machineTree) {
  let directory = resolve2(subjectPath);
  for (; ; ) {
    const parent = dirname2(directory);
    if (parent === directory) return;
    directory = parent;
    const tree = directoryTree(directory, signal);
    await readContextFiles(
      tree,
      files,
      unread,
      seen,
      "MACHINE",
      directory,
      machineRoot,
      machineTree,
      (path) => join9(directory, path)
    );
  }
}
var ClaudeHarnessAdapter = class {
  constructor(machineConfigDirectory = join9(homedir(), ".claude")) {
    this.machineConfigDirectory = machineConfigDirectory;
  }
  machineConfigDirectory;
  tool = "claude";
  async read(subjectPath, signal) {
    const files = [];
    const unread = [];
    const seen = /* @__PURE__ */ new Set();
    const machine = this.machineConfigDirectory;
    const machineTree = directoryTree(machine, signal);
    await readOneScope(
      directoryTree(subjectPath, signal),
      "SUBJECT",
      files,
      unread,
      seen,
      subjectPath,
      (path) => path,
      SUBJECT_PREFIX,
      machine,
      machineTree
    );
    await readOneScope(
      machineTree,
      "MACHINE",
      files,
      unread,
      seen,
      machine,
      (path) => join9(machine, path),
      "",
      machine,
      machineTree
    );
    await readAncestors(subjectPath, signal, files, unread, seen, machine, machineTree);
    return { files, unread };
  }
};

// src/harness/adapters/token-encoder.adapter.ts
import { countTokens } from "gpt-tokenizer/encoding/o200k_base";
var ENCODING = "o200k_base";
var GptTokenizerEncoderAdapter = class {
  encoding = ENCODING;
  estimate(text) {
    return { tokens: countTokens(text), encoding: ENCODING };
  }
};

// src/harness/advice/guidelines.ts
var SESSION_OPENING_TOKEN_BUDGET = 1e4;
var ALWAYS_LOADED_FILE_TOKENS = 4e3;
var ALWAYS_LOADED_FILE_LINES = 200;
var PROSE_SHARE = 0.6;
var SHARED_PASSAGES_PER_PAIR = 5;
var PROSE_SHARE_MINIMUM_LINES = 20;

// src/harness/advice/harness-findings.ts
var SESSION_SUBJECT = "session opening (always-loaded, subject and machine combined)";
function sessionBudgetFinding(report) {
  const alwaysLoadedTotal = report.tierTotals.filter((total) => total.tier === "ALWAYS_LOADED").reduce((sum, total) => sum + total.tokenEstimate, 0);
  if (alwaysLoadedTotal <= SESSION_OPENING_TOKEN_BUDGET) return null;
  return {
    guideline: "SESSION_OPENING_TOKEN_BUDGET",
    subject: SESSION_SUBJECT,
    observed: alwaysLoadedTotal,
    guidelineValue: SESSION_OPENING_TOKEN_BUDGET,
    action: "Move some always-loaded content behind a path-scoped rule or an on-demand declaration so it is read only for the work that needs it.",
    potentialTokensRemoved: alwaysLoadedTotal - SESSION_OPENING_TOKEN_BUDGET
  };
}
function alwaysLoadedFileFindings(files) {
  const findings = [];
  for (const file of files) {
    if (file.tier !== "ALWAYS_LOADED") continue;
    if (file.tokenEstimate > ALWAYS_LOADED_FILE_TOKENS) {
      findings.push({
        guideline: "ALWAYS_LOADED_FILE_TOKENS",
        subject: file.path,
        observed: file.tokenEstimate,
        guidelineValue: ALWAYS_LOADED_FILE_TOKENS,
        action: `Give ${file.path} a paths: scope so it loads only for the work it concerns.`,
        potentialTokensRemoved: file.tokenEstimate
      });
    }
    if (file.lineCount > ALWAYS_LOADED_FILE_LINES) {
      findings.push({
        guideline: "ALWAYS_LOADED_FILE_LINES",
        subject: file.path,
        observed: file.lineCount,
        guidelineValue: ALWAYS_LOADED_FILE_LINES,
        action: `Split ${file.path} so a reader is not faced with the whole file at once.`,
        potentialTokensRemoved: file.tokenEstimate
      });
    }
  }
  return findings;
}
function proseShareFindings(proseShares) {
  const findings = [];
  for (const share of proseShares) {
    if (!share.countable) continue;
    const countable = share.listLines + share.proseLines;
    if (countable < PROSE_SHARE_MINIMUM_LINES) continue;
    const observed = share.proseLines / countable;
    if (observed > PROSE_SHARE) {
      findings.push({
        guideline: "PROSE_SHARE",
        subject: share.path,
        observed,
        guidelineValue: PROSE_SHARE,
        action: `Reformat ${share.path} toward more list structure and less running prose.`,
        potentialTokensRemoved: null
      });
    }
  }
  return findings;
}
function duplicationFindings(pairs, encoder) {
  const findings = [];
  for (const pair of pairs) {
    if (pair.passages.length <= SHARED_PASSAGES_PER_PAIR) continue;
    const potentialTokensRemoved = pair.passages.reduce(
      (sum, passage) => sum + encoder.estimate(passage.words.join(" ")).tokens,
      0
    );
    findings.push({
      guideline: "SHARED_PASSAGES_PER_PAIR",
      subject: `${pair.left} <-> ${pair.right}`,
      observed: pair.passages.length,
      guidelineValue: SHARED_PASSAGES_PER_PAIR,
      action: `Extract what ${pair.left} and ${pair.right} share into one file both can reference.`,
      potentialTokensRemoved
    });
  }
  return findings;
}
function byPotentialTokensRemovedDescendingNullsLast(left, right) {
  if (left.potentialTokensRemoved === null && right.potentialTokensRemoved === null) return 0;
  if (left.potentialTokensRemoved === null) return 1;
  if (right.potentialTokensRemoved === null) return -1;
  return right.potentialTokensRemoved - left.potentialTokensRemoved;
}
function harnessFindings(report, encoder) {
  const findings = [
    ...alwaysLoadedFileFindings(report.files),
    ...proseShareFindings(report.proseShares),
    ...duplicationFindings(report.duplication, encoder),
    sessionBudgetFinding(report)
  ].filter((finding) => finding !== null);
  return [...findings].sort(byPotentialTokensRemovedDescendingNullsLast);
}

// src/harness/contracts/harness-audit-report.contract.ts
var HARNESS_AUDIT_REPORT_SCHEMA_VERSION = 1;

// src/harness/models/loading-tier.model.ts
var LOADING_TIERS = ["ALWAYS_LOADED", "CONDITIONALLY_LOADED"];

// src/harness/models/reading-scope.model.ts
var READING_SCOPES = ["SUBJECT", "MACHINE"];

// src/harness/measurement/file-length.ts
function splitLines(content) {
  if (content === "") return [];
  const withoutTrailingNewline = content.endsWith("\n") ? content.slice(0, -1) : content;
  return withoutTrailingNewline.split("\n");
}
function countLines(content) {
  return splitLines(content).length;
}
function measureFileLength(content, encoder) {
  return {
    lineCount: countLines(content),
    tokenEstimate: encoder.estimate(content).tokens
  };
}

// src/harness/measurement/prose-share.ts
var LIST_LINE_READING = "a line beginning with -, *, or +; a digit followed by . or ); or | for a table row \u2014 blank lines and lines inside a fenced code block are counted as neither prose nor list";
var FENCE2 = /^```/;
var BULLET = /^[-*+]\s+/;
var ORDERED = /^\d+[.)]\s+/;
var TABLE_ROW = /^\|/;
function isListLine(trimmed) {
  return BULLET.test(trimmed) || ORDERED.test(trimmed) || TABLE_ROW.test(trimmed);
}
function stripFencedBlocks(content) {
  const kept = [];
  let inFence = false;
  for (const line of splitLines(content)) {
    if (FENCE2.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) kept.push(line);
  }
  return kept.join("\n");
}
function measureProseShare(content) {
  let listLines = 0;
  let proseLines = 0;
  let inFence = false;
  for (const line of splitLines(content)) {
    const trimmed = line.trim();
    if (FENCE2.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || trimmed === "") continue;
    if (isListLine(trimmed)) listLines += 1;
    else proseLines += 1;
  }
  if (listLines + proseLines === 0) return { countable: false };
  return { countable: true, listLines, proseLines };
}

// src/harness/measurement/shared-passages.ts
var SHINGLE_LENGTH = 8;
function normaliseWord(raw) {
  return raw.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}
function wordsOf(content) {
  return stripFencedBlocks(content).split(/\s+/).map(normaliseWord).filter((word) => word.length > 0);
}
function shingleStartsOf(words) {
  const starts = /* @__PURE__ */ new Map();
  for (let start = 0; start + SHINGLE_LENGTH <= words.length; start += 1) {
    const key = words.slice(start, start + SHINGLE_LENGTH).join(" ");
    const matching = starts.get(key);
    if (matching === void 0) starts.set(key, [start]);
    else matching.push(start);
  }
  return starts;
}
function maximalRunsBetween(left, right) {
  const rightStarts = shingleStartsOf(right);
  const passages = /* @__PURE__ */ new Map();
  for (let leftStart = 0; leftStart + SHINGLE_LENGTH <= left.length; leftStart += 1) {
    const key = left.slice(leftStart, leftStart + SHINGLE_LENGTH).join(" ");
    const matches = rightStarts.get(key);
    if (matches === void 0) continue;
    for (const rightStart of matches) {
      if (leftStart > 0 && rightStart > 0 && left[leftStart - 1] === right[rightStart - 1]) continue;
      let length = SHINGLE_LENGTH;
      while (leftStart + length < left.length && rightStart + length < right.length && left[leftStart + length] === right[rightStart + length]) {
        length += 1;
      }
      const words = left.slice(leftStart, leftStart + length);
      passages.set(words.join(" "), { words });
    }
  }
  return [...passages.values()];
}
function sharedPassagesBetween(leftContent, rightContent) {
  const left = wordsOf(leftContent);
  return maximalRunsBetween(left, wordsOf(rightContent));
}

// src/harness/measurement/compose-harness-audit.ts
function tierTotalsOf(files) {
  const totals = [];
  for (const tier of LOADING_TIERS) {
    for (const scope of READING_SCOPES) {
      const inBucket = files.filter((file) => file.tier === tier && file.scope === scope);
      if (inBucket.length === 0) continue;
      totals.push({
        tier,
        scope,
        fileCount: inBucket.length,
        lineCount: inBucket.reduce((total, file) => total + file.lineCount, 0),
        tokenEstimate: inBucket.reduce((total, file) => total + file.tokenEstimate, 0)
      });
    }
  }
  return totals;
}
function proseSharesOf(sourceFiles) {
  return sourceFiles.map((file) => {
    const share = measureProseShare(file.content);
    return share.countable ? {
      path: file.path,
      countable: true,
      listLines: share.listLines,
      proseLines: share.proseLines
    } : { path: file.path, countable: false };
  });
}
function duplicationOf(sourceFiles) {
  const pairs = [];
  for (let left = 0; left < sourceFiles.length; left += 1) {
    for (let right = left + 1; right < sourceFiles.length; right += 1) {
      const leftFile = sourceFiles[left];
      const rightFile = sourceFiles[right];
      if (leftFile === void 0 || rightFile === void 0) continue;
      const passages = sharedPassagesBetween(leftFile.content, rightFile.content);
      if (passages.length > 0) {
        pairs.push({ left: leftFile.path, right: rightFile.path, passages });
      }
    }
  }
  return pairs;
}
function composeHarnessAudit(tool, sourceFiles, encoder, unread = []) {
  const files = sourceFiles.map((file) => {
    const length = measureFileLength(file.content, encoder);
    return {
      path: file.path,
      byteSize: file.byteSize,
      lineCount: length.lineCount,
      tokenEstimate: length.tokenEstimate,
      tier: file.tier,
      scope: file.scope
    };
  });
  const reportWithoutFindings = {
    schemaVersion: HARNESS_AUDIT_REPORT_SCHEMA_VERSION,
    tool,
    encoding: encoder.encoding,
    shingleLength: SHINGLE_LENGTH,
    listLineReading: LIST_LINE_READING,
    files,
    tierTotals: tierTotalsOf(files),
    proseShares: proseSharesOf(sourceFiles),
    duplication: duplicationOf(sourceFiles),
    unread,
    findings: []
  };
  return {
    ...reportWithoutFindings,
    findings: harnessFindings(reportWithoutFindings, encoder)
  };
}

// src/harness/usecases/audit-harness.usecase.ts
async function auditHarness(input) {
  const sourceReading = await input.source.read(input.subjectPath, input.signal);
  return composeHarnessAudit(
    input.source.tool,
    sourceReading.files,
    input.encoder,
    sourceReading.unread
  );
}

// src/cli/parsing/harness-arguments.ts
var USAGE_LINE3 = "usage: aidd-audit harness <path> [--json] [--details]";
function parseHarnessArguments(argv2) {
  const operands = commandOperandsFor(argv2, "harness");
  let subjectPath;
  let jsonSeen = false;
  let detailsSeen = false;
  for (const token of operands) {
    if (token === "--json") {
      if (jsonSeen) throw usageError2("Flag '--json' was given more than once.");
      jsonSeen = true;
      continue;
    }
    if (token === "--details") {
      if (detailsSeen) throw usageError2("Flag '--details' was given more than once.");
      detailsSeen = true;
      continue;
    }
    if (token.startsWith("--")) {
      throw usageError2(`Unknown flag '${token}'.`);
    }
    if (subjectPath !== void 0) {
      throw usageError2(`Unexpected second subject '${token}'.`);
    }
    subjectPath = token;
  }
  if (subjectPath === void 0) {
    throw usageError2("No subject path given.");
  }
  return { subjectPath, json: jsonSeen, details: detailsSeen };
}
function usageError2(reason) {
  return new UsageError(`${reason} ${USAGE_LINE3}`);
}

// src/cli/renderers/harness-human.renderer.ts
var SCOPE_LABEL = {
  SUBJECT: "Subject (this repository) \u2014 reproduces the same bytes on any machine, on any day, for this subject.",
  MACHINE: "Machine (this tool's own configuration) \u2014 reproduces only against an unchanged machine, the same claim this tool makes for any source living outside the subject."
};
var TIER_LABEL = {
  ALWAYS_LOADED: "Always loaded \u2014 read at every session opening",
  CONDITIONALLY_LOADED: "Conditionally loaded \u2014 a ceiling on what could be added if every one of these triggered, never an opening cost"
};
function renderHarnessHumanReport(report, options = {}) {
  if (report.files.length === 0) {
    return [
      `Harness audit \u2014 loading convention read: ${report.tool}`,
      "Nothing was found to measure: no harness file was read for this subject.",
      renderUnreadSection(report)
    ].filter((section) => section.length > 0).join("\n\n");
  }
  const summarySections = [
    renderHeader2(report),
    renderOverviewSection(report),
    renderUnreadSection(report)
  ];
  const sections = options.details ? [...summarySections, renderMeasurementsSection(report), renderFindingsSection(report)] : [
    ...summarySections,
    renderFindingsSection(report),
    "Details: re-run with --details to list every file, prose shape and shared passage."
  ];
  return sections.filter((section) => section.length > 0).join("\n\n");
}
function renderHeader2(report) {
  return [
    `Harness audit \u2014 loading convention read: ${report.tool}`,
    `Token figures are estimates under the ${report.encoding} encoding, not the counts the model itself would produce.`
  ].join("\n");
}
function renderOverviewSection(report) {
  const lines = [
    "Context at session opening:",
    ...["SUBJECT", "MACHINE"].flatMap((scope) => renderOverviewForScope(report, scope))
  ];
  const conditional = ["SUBJECT", "MACHINE"].flatMap(
    (scope) => renderOverviewForScope(report, scope, "CONDITIONALLY_LOADED")
  );
  if (conditional.length > 0)
    lines.push("", "Conditional context \u2014 ceiling, not an opening cost:", ...conditional);
  return lines.join("\n");
}
function renderOverviewForScope(report, scope, tier = "ALWAYS_LOADED") {
  const overview = renderTierOverview(report, scope, tier);
  if (overview === "") return [];
  const reproducibility = scope === "SUBJECT" ? "same subject on any machine" : "unchanged machine configuration only";
  return [`  ${scope === "SUBJECT" ? "Subject" : "Machine"} (${reproducibility}): ${overview}`];
}
function renderTierOverview(report, scope, tier) {
  const total = report.tierTotals.find(
    (candidate) => candidate.scope === scope && candidate.tier === tier
  );
  if (total === void 0) return "";
  return `${total.fileCount} file${plural(total.fileCount)}, ${total.lineCount} lines, ~${total.tokenEstimate} tokens`;
}
function renderMeasurementsSection(report) {
  return [
    "Details \u2014 every measured file:",
    `List line reading: ${report.listLineReading}`,
    renderScopeSection(report, "SUBJECT"),
    renderScopeSection(report, "MACHINE"),
    renderDuplicationSection(report)
  ].filter((section) => section.length > 0).join("\n\n");
}
function renderScopeSection(report, scope) {
  const files = report.files.filter((file) => file.scope === scope);
  if (files.length === 0) return "";
  const tierSections = ["ALWAYS_LOADED", "CONDITIONALLY_LOADED"].map((tier) => renderTierSection(report, scope, tier)).filter((section) => section.length > 0);
  return [SCOPE_LABEL[scope], ...tierSections].join("\n");
}
function renderTierSection(report, scope, tier) {
  const files = report.files.filter((file) => file.scope === scope && file.tier === tier);
  if (files.length === 0) return "";
  const total = report.tierTotals.find(
    (candidate) => candidate.scope === scope && candidate.tier === tier
  );
  const totalLine = total === void 0 ? "" : `    total: ${total.fileCount} file${plural(total.fileCount)}, ${total.lineCount} lines, ~${total.tokenEstimate} tokens (${report.encoding} estimate)`;
  return [`  ${TIER_LABEL[tier]}`, totalLine, ...files.map((file) => renderFileLine(file, report))].filter((line) => line.length > 0).join("\n");
}
function renderFileLine(file, report) {
  const share = report.proseShares.find((candidate) => candidate.path === file.path);
  const shareText = share === void 0 ? "" : ` \xB7 ${renderProseShare(share)}`;
  return `    ${file.path}: ${file.lineCount} lines, ~${file.tokenEstimate} tokens${shareText}`;
}
function renderProseShare(share) {
  if (!share.countable) return "no countable line (blank or fenced content only)";
  return `${share.listLines} list line${plural(share.listLines)}, ${share.proseLines} prose line${plural(share.proseLines)}`;
}
function renderDuplicationSection(report) {
  if (report.duplication.length === 0) return "";
  const lines = report.duplication.map((pair) => renderDuplicationPair(pair, report));
  return ["Shared passages \u2014 exact repeated word sequences:", ...lines].join("\n");
}
function renderDuplicationPair(pair, report) {
  const header = `  ${pair.left} <-> ${pair.right}: ${pair.passages.length} shared passage${plural(pair.passages.length)}, at least ${report.shingleLength} words each`;
  const passageLines = pair.passages.map((passage) => `    "${passage.words.join(" ")}"`);
  return [header, ...passageLines].join("\n");
}
function renderUnreadSection(report) {
  if (report.unread.length === 0) return "";
  return [
    "Unread entries \u2014 excluded from measurements:",
    ...report.unread.map((entry) => `  ${entry.path} (${entry.scope}): ${entry.reason}`)
  ].join("\n");
}
function plural(count) {
  return count === 1 ? "" : "s";
}
function renderFindingsSection(report) {
  const header = `Findings \u2014 ${report.findings.length} action${plural(report.findings.length)}, measured against chosen guidelines:`;
  if (report.findings.length === 0) {
    return [header, "  nothing observed is over any stated guideline."].join("\n");
  }
  return [header, ...report.findings.map(renderFinding)].join("\n\n");
}
function renderFinding(finding) {
  const savingText = finding.potentialTokensRemoved === null ? "" : ` \xB7 potential removal: up to ~${finding.potentialTokensRemoved} tokens`;
  const shown = (value) => finding.guideline === "PROSE_SHARE" ? `${Math.round(value * 100)}% prose` : `${value}`;
  return [
    `  [${finding.guideline}] ${finding.subject}`,
    `    observed: ${shown(finding.observed)} \xB7 guideline: ${shown(finding.guidelineValue)}${savingText}`,
    `    action: ${finding.action}`
  ].join("\n");
}

// src/cli/renderers/harness-json.renderer.ts
function renderHarnessJsonReport(report) {
  const projected = projectReport2(report);
  assertEveryNumberFinite2(projected, "$");
  return JSON.stringify(projected, null, 2);
}
function assertEveryNumberFinite2(value, path) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new UnrenderableReportError(
        `${path} is ${value}; JSON renders it as null, which this report reads as absence.`
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertEveryNumberFinite2(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, member] of Object.entries(value)) {
      assertEveryNumberFinite2(member, `${path}.${key}`);
    }
  }
}
function projectReport2(report) {
  return {
    schemaVersion: report.schemaVersion,
    tool: report.tool,
    encoding: report.encoding,
    shingleLength: report.shingleLength,
    listLineReading: report.listLineReading,
    files: report.files.map(projectFile),
    tierTotals: report.tierTotals.map(projectTierTotal),
    proseShares: report.proseShares.map(projectProseShare),
    duplication: report.duplication.map(projectDuplicationPair),
    unread: report.unread.map((entry) => ({
      path: entry.path,
      scope: entry.scope,
      reason: entry.reason
    })),
    findings: report.findings.map(projectFinding)
  };
}
function projectFile(file) {
  return {
    path: file.path,
    byteSize: file.byteSize,
    lineCount: file.lineCount,
    tokenEstimate: file.tokenEstimate,
    tier: file.tier,
    scope: file.scope
  };
}
function projectTierTotal(total) {
  return {
    tier: total.tier,
    scope: total.scope,
    fileCount: total.fileCount,
    lineCount: total.lineCount,
    tokenEstimate: total.tokenEstimate
  };
}
function projectProseShare(share) {
  return share.countable ? {
    path: share.path,
    countable: true,
    listLines: share.listLines,
    proseLines: share.proseLines
  } : { path: share.path, countable: false };
}
function projectDuplicationPair(pair) {
  return {
    left: pair.left,
    right: pair.right,
    passages: pair.passages.map((passage) => ({ words: passage.words }))
  };
}
function projectFinding(finding) {
  return {
    guideline: finding.guideline,
    subject: finding.subject,
    observed: finding.observed,
    guidelineValue: finding.guidelineValue,
    action: finding.action,
    potentialTokensRemoved: finding.potentialTokensRemoved
  };
}

// src/cli/commands/harness.command.ts
async function runHarness(argv2, io, options = {}) {
  const budget = new AbortController();
  try {
    const args = parseHarnessArguments(argv2);
    requireExistingSubject2(args.subjectPath);
    const source = options.source ?? new ClaudeHarnessAdapter();
    const encoder = options.encoder ?? new GptTokenizerEncoderAdapter();
    const report = await auditHarness({
      subjectPath: args.subjectPath,
      source,
      encoder,
      signal: budget.signal
    });
    const rendered = args.json ? renderHarnessJsonReport(report) : renderHarnessHumanReport(report, { details: args.details });
    io.stdout(`${rendered}
`);
    return 0;
  } catch (error) {
    io.stderr(`${messageOf2(error)}
`);
    return error instanceof UsageError ? 2 : 1;
  } finally {
    budget.abort();
  }
}
function requireExistingSubject2(subjectPath) {
  let stats;
  try {
    stats = statSync2(subjectPath);
  } catch {
    throw new UsageError(`Subject path '${subjectPath}' does not exist.`);
  }
  if (!stats.isDirectory() && !stats.isFile()) {
    throw new UsageError(`Subject path '${subjectPath}' is neither a file nor a directory.`);
  }
}
function messageOf2(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/cli/main.ts
function coloursWanted() {
  const off = process.env.NO_COLOR;
  if (off !== void 0 && off !== "") return false;
  const on = process.env.FORCE_COLOR;
  if (on !== void 0 && on !== "") return true;
  return process.stdout.isTTY === true;
}
var argv = process.argv.slice(2);
var run = argv[0] === "harness" ? runHarness : runAssess;
var exitCode = await run(argv, {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  colours: coloursWanted()
});
process.exitCode = exitCode;
