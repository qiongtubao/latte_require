import * as node_path from "path"
import * as node_fs from "fs"
import * as node_module from "module"
import { runInThisContext } from "vm"
let R = node_module._load || {};
R.resolve = function (request) {
  var filename = node_module._resolveFilename(request, process.mainModule);
  return filename;
}
R.cache = node_module._cache;

let stripBOM = (content: string) => {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}
export default class Modules {
  dirname: string;
  cache: any;
  rootModule: Module;
  constructor(filename) {
    this.dirname = node_path.dirname(filename);
    this.cache = {};
    this.rootModule = new Module(this);
    this.rootModule.dirname = this.dirname;
  }
  require(request) {
    return this.rootModule.require(request);
  }
  resolveFilename(path: string, parent: Module): string {
    let start = path.substring(0, 2);
    if (start !== "./" && start !== "..") {
      R(path, process.mainModule);
      return R.resolve(path);
    } else {
      return node_path.normalize(parent.dirname + "/" + path);
    }
  }
  load(path: string, parent: Module = this.rootModule) {
    let filename = this.resolveFilename(path, parent);
    if (process.moduleLoadList.indexOf("Binding " + path) != -1
      || process.moduleLoadList.indexOf("NativeModule " + path) != -1) {
      return require(path);
    }
    if (R.cache[filename]) {
      return R(filename, process.mainModule);
    }
    let cachedModule = this.cache[filename];
    if (cachedModule) {
      return cachedModule.exports;
    }
    let module = new Module(this);
    this.cache[filename] = module;
    let hadException = true;
    try {
      module.load(filename);
      hadException = false;
    } catch (err) {
      console.error(err);
    } finally {
      if (hadException) {
        delete this.cache[filename];
      }
    }
    return module.exports;
  }
  extensions = {
    ".js": (module: Module, filename) => {
      //console.log(filename);
      try {
        var content = node_fs.readFileSync(filename, "utf8");
        module._compile(stripBOM(content), filename);
      } catch (e) {
        console.log("loadFile error:", filename);
        throw e;
      }
    },
    ".json": (module, filename) => {
      var content;
      try {
        content = node_fs.readFileSync(filename, "utf8");
      } catch (e) {
        console.log("loadFile error:", filename);
        throw e;
      }
    },
    ".node": process.dlopen
  }
  wrap(script) {
    return `(function (exports, require, module, __filename, __dirname) {
              ${script}
            });`
  }
  static create(filename) {
    return new Modules(filename);
  }
}

class Module {
  dirname: string;
  parent: Module;
  modules: Modules;
  exports: any;
  file: any;
  paths: string[];
  loaded: boolean;
  extension: string;
  constructor(modules: Modules) {
    this.modules = modules;
    this.paths = [];
    this.exports = {};
  }
  require(path: string) {
    return this.modules.load(path, this);
  }
  find(filename): any {
    let info = node_path.parse(filename);
    if (node_fs.existsSync(filename)) {
      if (node_fs.lstatSync(filename).isDirectory()) {
        return this.find(filename + '/index');
      }
      return info;
    }

    let types = ['.js', '.json', '.node'];
    for (let i = 0, len = types.length; i < len; i++) {
      let type = types[i];
      let result = node_fs.existsSync(info.dir + '/' + info.base + type);
      if (result) {
        info.ext = type;
        info.base += type;
        return info;
      }
    }
    return null;
  }
  //加载
  load(filename: string) {
    this.file = this.find(filename);
    if (!this.file) {
      throw new Error("ENOENT: no such file or directory " + filename);
    }
    this.dirname = this.file.dir;
    this.paths = [this.dirname];
    let extension = this.file.ext;
    this.extension = extension;
    this.modules.extensions[extension](this, this.file.dir + '/' + this.file.base);
    this.loaded = true;
  }
  _compile(content, filename) {
    content = content.replace(/^\#\!.*/, "");
    let require: any = (path: string) => {
      return this.require(path);
    }
    require.resolve = (path: string) => {
      return this.modules.resolveFilename(path, this);
    }
    require.extension = this.extension;
    require.main = this.modules.rootModule;
    require.cache = this.modules.cache;
    let wrapper = this.modules.wrap(content);
    let compiledWrapper = runInThisContext(wrapper, { filename: filename });
    let dirname = node_path.dirname(filename);
    let args = [this.exports, require, this, filename, dirname];
    return compiledWrapper.apply(this.exports, args);
  }
}


