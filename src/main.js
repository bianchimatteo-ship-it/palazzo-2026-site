import { mountApp } from './ui/app.js';
import { store } from './core/store.js';

mountApp(document.querySelector('#app'), store);
