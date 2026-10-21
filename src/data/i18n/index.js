// The English dictionaries, loaded only when English is on. Each file is a list of [Italian, English] pairs: `#` stands for a number, `{}` for a free part (a name, a label).
import { KEYS } from './keys.js?v=20261021-6';
import { PHRASES as ui1 } from './en-ui-1.js?v=20261021-6';
import { PHRASES as ui2 } from './en-ui-2.js?v=20261021-6';
import { PHRASES as ui3 } from './en-ui-3.js?v=20261021-6';
import { PHRASES as ui4 } from './en-ui-4.js?v=20261021-6';

export function install(installBook) {
  installBook([...ui1, ...ui2, ...ui3, ...ui4], KEYS);
}
