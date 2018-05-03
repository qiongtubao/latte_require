let Module = require("../index");
let m = new Module(__filename);
let data = m.load('./work/work2.js');
console.log(data);