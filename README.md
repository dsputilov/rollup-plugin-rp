
```js
import build from 'rollup-plugin-rp';

export default {
  input: 'src/index.js',
  output: {
    dir: 'output',
    format: 'cjs'
  },
  plugins: [build()]
};
```

Usage:

```
account.html:

    <template name="AccountTemplate">
        name: {{model.name}},
        balance: {{model.balance}}
    </template>

account.js:

    import {AccountTemplate} from "./account.html";
    let $account = new AccountTemplate({
        name: 'Alice',
        balance: 100
    });
    document.body.appendChild($account);
    
    $account.model.balance = 200;

```
