<template>
  <a-scene>
    <a-box position="-1 0.5 -3" rotation="0 45 0" color="#4CC3D9"></a-box>
    <a-sphere position="0 1.25 -5" radius="1.25" color="#EF2D5E"></a-sphere>
    <a-cylinder position="1 0.75 -3" radius="0.5" height="1.5" color="#FFC65D"></a-cylinder>
    <a-plane position="0 0 -4" rotation="-90 0 0" width="4" height="4" color="#7BC8A4"></a-plane>
    <a-sky color="#ECECEC"></a-sky>
    <a-curve id="track1">
      <a-curve-point position="-1 1 -3"></a-curve-point>
      <a-curve-point position="1 1 -3"></a-curve-point>
    </a-curve>

    <!-- Draw the Curve -->
    <a-draw-curve curveref="#track1" material="shader: line; color: blue; linewidth: 5;"></a-draw-curve>

    <a-camera>
      <a-cursor raycaster="objects: .clickable"></a-cursor>
    </a-camera>
  </a-scene>
</template>

<script>
export default {
name: "SceneView"
}
</script>

<style scoped>

</style>