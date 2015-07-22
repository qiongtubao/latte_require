(function(define) { 'use strict';
	define("latte_require", ["require", "exports", "module", "window"],
	function(require, exports, module, window) {
        /**
          @namespace latte_require
          @class Modules
        */
        var assert = require('assert').ok;
        var Path = require("path");
        var Fs = require("fs");
        var R = require;
        var Module = require("module");
        var R = Module._load;
        (function() {
          /**
            是否兼容nodejs 暂时不知道
          */
            R.resolve = function(request) {
                var filename = Module._resolveFilename(request,  process.mainModule);
                return filename;
            }
            R.cache = Module._cache;
        }).call(R);

        var RunInThisContext = require('vm').runInThisContext;
        function stripBOM(content) {
          if(content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
          }
          return content;
        }
        var Modules = function( filename) {
          var _self = this;
          this.dirname = Path.dirname(filename);
          this._cache = {};
          var Module = function(filename) {
              this.filename = filename;
              this.dirname = Path.dirname(filename);
              this.exports = {};
          };
          (function() {

              this.require = function(path) {
                  assert(path, "missing path");
                  assert(typeof path === "string", "path must be a string");
                  return _self._load(path, this);
              }
              this.load = function(filename) {
                this.filename = filename;
                this.dirname = Path.dirname(filename);
                this.paths = [Path.dirname(filename)];
                var extension = Path.extname(filename) || ".js";
                if (!_self._extensions[extension]) extension = '.js';
                _self._extensions[extension](this, filename);
                this.loaded = true;
              }
              this._compile = function(content, filename) {
                var self = this;
                content = content.replace(/^\#\!.*/, "");
                function require(path) {
                  return self.require(path);
                }
                require.resolve = function(request) {
                  return _self._resolveFilename(request, self);
                }
                require.extension = _self.extension;
                require.main = _self.rootModule;
                require.cache = _self._cache;
                var wrapper = _self.wrap(content);
                var compiledWrapper = RunInThisContext(wrapper, {filename: filename});
                var dirname = Path.dirname(filename);
                var args = [self.exports, require, self, filename, dirname];
                return compiledWrapper.apply(self.exports, args);
              }
          }).call(Module.prototype);
          this.Module = Module;
          this.rootModule = new Module(filename);

        };
        (function() {

            this.require = function(request) {
                return this.rootModule.require(request);
            }
            this._resolveFilename = function(request, parent) {
              var start = request.substring(0,2);
              if(start !== "./" && start !== ".." ) {
        					R(request, process.mainModule);
                  return R.resolve(request);
              }else{
                  return Path.normalize(parent.dirname +"/" + request);
              }
            }
            this._load = function(request, parent) {
              var filename = this._resolveFilename(request, parent);
              if(process.moduleLoadList) {
                if(process.moduleLoadList.indexOf("Binding "+request) != -1 
                 || process.moduleLoadList.indexOf("NativeModule "+ request) != -1) {
                    return require(request);
                }
              }
              if(R.cache[filename]) {
                return R(filename, process.mainModule);
              }
              var cachedModule = this._cache[filename];
              if(cachedModule) {
                return cachedModule.exports;
              }
              var Module = this.Module;
              var module = new Module(filename, parent);
              this._cache[filename] = module;
              var hadException = true;
              try {
                module.load(filename);
                hadException = false;
              } finally {
                if(hadException) {
                  delete this._cache[filename];
                }
              }
              return module.exports;
            }
            this._extensions = {};
            (function() {
                this[".js"] = function(module, filename) {
                  var content = Fs.readFileSync(filename, "utf8");
                  module._compile(stripBOM(content), filename);
                }
                this[".json"] = function(module, filename) {
                  var content = Fs.readFileSync(filename, filename);
                  try {
                    module.exports = JSON.parse(stripBOM(content));
                  }catch(err) {
                    err.message = filename + ": " +err.message;
                    throw err;
                  }
                }
                this[".node"] = process.dlopen;
            }).call(this._extensions);
            this.wrap = function(script) {
              return this.wrapper[0] + script + this.wrapper[1];
            };
            this.wrapper = [
              '(function (exports, require, module, __filename, __dirname) { ',
              '\n});'
            ];
        }).call(Modules.prototype);
        (function() {
          /**
            @method create
            @static
            @public
            @example
              var module = new Module();
          */
          this.create = function(filename) {
              var modules = new Modules(filename);
              return modules;
          }
        }).call(Modules);
        module.exports = Modules;
  });
})(typeof define === "function"? define: function(name, reqs, factory) { factory(require, exports, module); });
