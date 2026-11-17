import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../public/',import.meta.url);
test('frontend assets and critical screen elements are present',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8');
  const js=await readFile(new URL('app.js',root),'utf8');
  const css=await readFile(new URL('styles.css',root),'utf8');
  for(const id of ['studioPage','codeEditor','previewFrame','fileList','chatMessages','genericDialog','diagnosticList','mobilePreviewTab'])
    assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/\.\/app\.js/);assert.match(html,/\.\/styles\.css/);assert.match(css,/@media\(max-width:710px\)/);
  assert.match(html,/sandbox="allow-scripts"/);assert.doesNotMatch(html,/sandbox="[^"]*allow-same-origin/);
  assert.doesNotMatch(js,/AIza[\w-]{25,}/); // no obvious embedded Google API credentials
});
