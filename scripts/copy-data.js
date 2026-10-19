import {cpSync} from 'node:fs';
cpSync('public/data','dist/data',{recursive:true});

cpSync('public/pieces','dist/pieces',{recursive:true});
