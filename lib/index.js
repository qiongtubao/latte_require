"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_path = require("path");
var node_fs = require("fs");
var node_module = require("module");
var vm_1 = require("vm");
var R = node_module._load || {};
R.resolve = function (request) {
    var filename = node_module._resolveFilename(request, process.mainModule);
    return filename;
};
R.cache = node_module._cache;
var stripBOM = function (content) {
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
};
var Modules = (function () {
    function Modules(filename) {
        this.extensions = {
            ".js": function (module, filename) {
                try {
                    var content = node_fs.readFileSync(filename, "utf8");
                    module._compile(stripBOM(content), filename);
                }
                catch (e) {
                    console.log("loadFile error:", filename);
                    throw e;
                }
            },
            ".json": function (module, filename) {
                var content;
                try {
                    content = node_fs.readFileSync(filename, "utf8");
                }
                catch (e) {
                    console.log("loadFile error:", filename);
                    throw e;
                }
            },
            ".node": process.dlopen
        };
        this.dirname = node_path.dirname(filename);
        this.cache = {};
        this.rootModule = new Module(this);
        this.rootModule.dirname = this.dirname;
    }
    Modules.prototype.require = function (request) {
        return this.rootModule.require(request);
    };
    Modules.prototype.resolveFilename = function (path, parent) {
        var start = path.substring(0, 2);
        if (start !== "./" && start !== "..") {
            R(path, process.mainModule);
            return R.resolve(path);
        }
        else {
            return node_path.normalize(parent.dirname + "/" + path);
        }
    };
    Modules.prototype.load = function (path, parent) {
        if (parent === void 0) { parent = this.rootModule; }
        var filename = this.resolveFilename(path, parent);
        if (process.moduleLoadList.indexOf("Binding " + path) != -1
            || process.moduleLoadList.indexOf("NativeModule " + path) != -1) {
            return require(path);
        }
        if (R.cache[filename]) {
            return R(filename, process.mainModule);
        }
        var cachedModule = this.cache[filename];
        if (cachedModule) {
            return cachedModule.exports;
        }
        var module = new Module(this);
        this.cache[filename] = module;
        var hadException = true;
        try {
            module.load(filename);
            hadException = false;
        }
        catch (err) {
            console.error(err);
        }
        finally {
            if (hadException) {
                delete this.cache[filename];
            }
        }
        return module.exports;
    };
    Modules.prototype.wrap = function (script) {
        return "(function (exports, require, module, __filename, __dirname) {\n              " + script + "\n            });";
    };
    Modules.create = function (filename) {
        return new Modules(filename);
    };
    return Modules;
}());
exports.default = Modules;
var Module = (function () {
    function Module(modules) {
        this.modules = modules;
        this.paths = [];
        this.exports = {};
    }
    Module.prototype.require = function (path) {
        return this.modules.load(path, this);
    };
    Module.prototype.find = function (filename) {
        var info = node_path.parse(filename);
        if (node_fs.existsSync(filename)) {
            if (node_fs.lstatSync(filename).isDirectory()) {
                return this.find(filename + '/index');
            }
            return info;
        }
        var types = ['.js', '.json', '.node'];
        for (var i = 0, len = types.length; i < len; i++) {
            var type = types[i];
            var result = node_fs.existsSync(info.dir + '/' + info.base + type);
            if (result) {
                info.ext = type;
                info.base += type;
                return info;
            }
        }
        return null;
    };
    Module.prototype.load = function (filename) {
        this.file = this.find(filename);
        if (!this.file) {
            throw new Error("ENOENT: no such file or directory " + filename);
        }
        this.dirname = this.file.dir;
        this.paths = [this.dirname];
        var extension = this.file.ext;
        this.extension = extension;
        this.modules.extensions[extension](this, this.file.dir + '/' + this.file.base);
        this.loaded = true;
    };
    Module.prototype._compile = function (content, filename) {
        var _this = this;
        content = content.replace(/^\#\!.*/, "");
        var require = function (path) {
            return _this.require(path);
        };
        require.resolve = function (path) {
            return _this.modules.resolveFilename(path, _this);
        };
        require.extension = this.extension;
        require.main = this.modules.rootModule;
        require.cache = this.modules.cache;
        var wrapper = this.modules.wrap(content);
        var compiledWrapper = vm_1.runInThisContext(wrapper, { filename: filename });
        var dirname = node_path.dirname(filename);
        var args = [this.exports, require, this, filename, dirname];
        return compiledWrapper.apply(this.exports, args);
    };
    return Module;
}());
