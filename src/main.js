import Vue from 'vue';
import App from './App.vue';
import '@/utils/maya-controls';

require('aframe');
require('aframe-curve-component');

Vue.config.productionTip = false;
Vue.config.ignoredElements = [
  'a-scene',
  'a-plane',
  'a-box',
  'a-sky',
  'a-camera',
  'a-cursor',
  'a-sphere',
  'a-cylinder'
];

new Vue({
  render: h => h(App),
}).$mount('#app')
