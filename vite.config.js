import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { assertPublicEnvironment } from './scripts/public-env.mjs';

export default defineConfig(({ mode }) => {
  assertPublicEnvironment(loadEnv(mode, process.cwd(), 'VITE_'));
  return { plugins: [react()] };
});
