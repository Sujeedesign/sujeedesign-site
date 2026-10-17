import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './visual-editor.css';
import { registerPilotTheme } from './theme-plugin.js';

const config = window.sjdVisualEditorConfig || {};

export const editor = grapesjs.init({
  container: '#visual-canvas',
  height: '100%',
  fromElement: false,
  storageManager: false,
  panels: { defaults: [] },
  blockManager: { appendTo: '#visual-blocks' },
  traitManager: { appendTo: '#visual-traits' },
  styleManager: { sectors: [] },
  canvas: { styles: config.themeStyles || ['/src/demo-theme.css'] },
  plugins: [registerPilotTheme],
});

if (config.projectData && typeof config.projectData === 'object') {
  editor.loadProjectData(config.projectData);
}

window.sjdVisualEditor = editor;
editor.on('load', () => {
  document.documentElement.dataset.visualEditorReady = '1';
});
