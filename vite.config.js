import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // relative asset URLs so the build works under a GitHub Pages project
  // subpath (e.g. user.github.io/basilica/) without hardcoding the repo name
  base: './',
  plugins: [vue()],
})
