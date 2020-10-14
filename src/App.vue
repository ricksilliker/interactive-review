<template>
  <div id="app">
    <!--    <img alt="Vue logo" src="./assets/logo.png">-->
    <!--    <HelloWorld msg="Welcome to Your Vue.js App"/>-->
    <SceneView/>
    Hi There
  </div>
</template>

<script>
// import HelloWorld from './components/HelloWorld.vue';
import SceneView from './components/SceneView';

export default {
  name: 'App',
  components: {
    // HelloWorld
    SceneView
  },
  mounted() {
    // let aframeExtrasScript = document.createElement('script');
    // aframeExtrasScript.setAttribute('src', 'https://cdn.jsdelivr.net/gh/donmccurdy/aframe-extras@v6.1.1/dist/aframe-extras.min.js');
    // document.head.append(aframeExtrasScript);
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
