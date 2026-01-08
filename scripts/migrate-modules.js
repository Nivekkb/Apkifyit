#!/usr/bin/env node

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');

async function convertFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    
    // Comprehensive conversion rules
    const convertedContent = content
      // Convert CommonJS requires to ES imports
      .replace(/const\s+(\w+)\s*=\s*require\('([^']+)'\);/g, 'import $1 from \'$2\';')
      .replace(/const\s*{([^}]+)}\s*=\s*require\('([^']+)'\);/g, 'import { $1 } from \'$2\';')
      
      // Convert module.exports to ES exports
      .replace(/module\.exports\s*=\s*{/g, 'export default {')
      .replace(/module\.exports\.([\w.]+)\s*=\s*([\w.]+);/g, 'export const $1 = $2;')
      .replace(/module\.exports\s*=\s*([\w.]+);/g, 'export default $1;')
      
      // Handle exports.X = Y pattern
      .replace(/exports\.([\w.]+)\s*=\s*([\w.]+);/g, 'export const $1 = $2;')
      
      // Ensure React and Next.js specific imports
      .replace(/import React from 'react';/g, 'import React from \'react\';')
      .replace(/import \* as React from 'react';/g, 'import React from \'react\';');
    
    await writeFile(filePath, convertedContent);
    console.log(`Converted: ${filePath}`);
    return convertedContent;
  } catch (error) {
    console.error(`Error converting ${filePath}:`, error);
    return null;
  }
}

async function findAndConvertFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory() && 
        !fullPath.includes('node_modules') && 
        !fullPath.includes('.next') &&
        !fullPath.includes('scripts')) {
      await findAndConvertFiles(fullPath);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).slice(1);
      if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'config.js', 'config.ts'].includes(ext)) {
        await convertFile(fullPath);
      }
    }
  }
}

async function main() {
  console.log('Starting module migration...');
  await findAndConvertFiles(projectRoot);
  console.log('Module migration completed.');
}

main().catch(console.error);