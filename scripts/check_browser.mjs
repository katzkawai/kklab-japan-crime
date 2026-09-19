import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.SITE_URL || 'http://127.0.0.1:4174/';
const component=id=>page.locator(`[data-component-id="${id}"]`);
async function choose(label,choice){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('menu',{name:label,exact:true}).getByText(choice,{exact:true}).click();}
try {
 await page.goto(base,{waitUntil:'networkidle'});
 assert.equal(await page.locator('html').getAttribute('lang'),'ja');
 assert.match(await component('latest-count').innerText(),/774,142/);
 assert.match(await component('latest-clearance').innerText(),/38.9%/);
 assert.equal(await component('category-change').locator('.chart-ranked-list-row').count(),6);
 assert.match(await page.locator('footer').innerText(),/GPT 6 Astro/);
 await choose('表示期間','2016年から');
 await page.getByRole('heading',{name:'認知件数 · 2016–2025年',exact:true}).waitFor();
 await page.getByRole('button',{name:'認知件数 · 2016–2025年 actions',exact:true}).click();
 await page.getByRole('menu').getByText('View data source',{exact:true}).click();
 await page.getByRole('tab',{name:'Data preview',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Data preview',exact:true}).click();
 await page.waitForTimeout(300);
 assert.match(await page.locator('body').innerText(),/2016/);
 console.log('Source inspector opened with scoped data.');
 await page.keyboard.press('Escape');
 await choose('表示期間','1946年から');
 await choose('指標','人口千人当たり');
 await page.getByRole('heading',{name:'人口千人当たり · 1946–2025年',exact:true}).waitFor();
 await choose('指標','認知件数');
 await page.getByRole('tab',{name:'罪種・詐欺',exact:true}).click();
 assert.equal(await page.locator('svg.recharts-surface').count(),13);
 await page.getByRole('button',{name:'2002年＝100',exact:true}).click();
 await page.getByRole('heading',{name:'罪種ごとの変化 · 2002年＝100',exact:true}).waitFor();
 assert.equal(await component('category-history').locator('path.recharts-line-curve').count(),6);
 await page.getByRole('button',{name:'件数',exact:true}).click();
 await page.getByRole('tab',{name:'都道府県',exact:true}).click();
 assert.equal(await component('prefecture-comparison').locator('.chart-ranked-list-row').count(),47);
 assert.match(await component('prefecture-comparison').innerText(),/鹿児島/);
 await choose('年','2016');
 await page.getByRole('heading',{name:'2016年 · 人口10万人当たり認知件数',exact:true}).waitFor();
 await choose('指標','認知件数');
 assert.match(await component('prefecture-comparison').innerText(),/134.6K/);

 await choose('都道府県','大阪');
 await page.getByRole('heading',{name:'大阪 · 人口10万人当たり認知件数 · 2016–2025年',exact:true}).waitFor();
 await page.getByRole('tab',{name:'出典・読み方',exact:true}).click();
 for (const name of ['national','categories','offenses','prefectures','fraud']) {
  const response=await page.request.get(new URL(`data/${name}.csv`,base).href);
  assert.equal(response.status(),200);assert.match(await response.text(),/年/);
 }
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:width===390?844:1000});
  for (const [name,slug] of [['全国の推移','national'],['罪種・詐欺','types'],['都道府県','regions'],['出典・読み方','sources']]) {
   await page.getByRole('tab',{name,exact:true}).click();await page.waitForTimeout(200);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const bounds=await page.locator('svg.recharts-surface').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));
   assert.ok(bounds.every(w=>w>100));
   if(process.env.CAPTURE_DIR) await page.screenshot({path:`${process.env.CAPTURE_DIR}/crime-${width}-${slug}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: 4 views, 2 viewport widths, chart marks, period reset, metric/index/region changes, source inspector, 5 CSV downloads, attribution, no runtime errors.');
} finally {await browser.close();}
