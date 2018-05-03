#latte_require

##install
```bash
  npm install latte_require
```
##use
```js
let Module = require("latte_require");
let m = new Module(__filename);
let data = m.load('./a.js');
```