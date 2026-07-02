import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

function inlineCSSPlugin() {
  return {
    name: 'inline-css',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist');
        const assetsDir = path.resolve(distDir, 'assets');
        
        // Find the CSS file in dist/assets/
        const files = fs.readdirSync(assetsDir);
        const cssFile = files.find(f => f.endsWith('.css'));
        
        if (cssFile) {
          const cssPath = path.resolve(assetsDir, cssFile);
          const cssContent = fs.readFileSync(cssPath, 'utf8');
          
          // Read index.html
          const htmlPath = path.resolve(distDir, 'index.html');
          let htmlContent = fs.readFileSync(htmlPath, 'utf8');
          
          // Replace stylesheet link with style tag containing the css content
          const linkRegex = /<link\s+rel="stylesheet"\s+href="[^"]*"\s*\/?>|<link\s+href="[^"]*"\s+rel="stylesheet"\s*\/?>/gi;
          htmlContent = htmlContent.replace(linkRegex, `<style>${cssContent}</style>`);
          
          // Save index.html
          fs.writeFileSync(htmlPath, htmlContent, 'utf8');
          console.log(`[inline-css] Inlined CSS into index.html successfully!`);
        }
      } catch (err) {
        console.error('[inline-css] Error inlining CSS:', err);
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'remove-crossorigin',
        transformIndexHtml(html) {
          return html.replace(/\s*crossorigin\s*/g, ' ');
        }
      },
      inlineCSSPlugin()
    ],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
