<script setup>
const props = defineProps({
  appName: {
    type: String,
    default: "Nuxt"
  }
})
</script>
<template>
</template>
<style scoped>
.nuxt-spa-loading{left:50%;position:fixed;top:50%;transform:translate(-50%,-50%)}.nuxt-spa-loading>path{fill:none;stroke:#00dc82;stroke-width:4px;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:128;stroke-dashoffset:128;animation:nuxt-spa-loading-move 3s linear infinite}
</style>