import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',workers:1,use:{baseURL:'http://127.0.0.1:3000',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']}},webServer:{command:'npm start',url:'http://127.0.0.1:3000/health',reuseExistingServer:true},timeout:60000});
