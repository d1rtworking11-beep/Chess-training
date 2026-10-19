import { defineConfig } from 'vite';
export default defineConfig({root:'public',publicDir:false,build:{outDir:'../dist',emptyOutDir:true,rollupOptions:{external:['/vendor/chess.js']}}});
