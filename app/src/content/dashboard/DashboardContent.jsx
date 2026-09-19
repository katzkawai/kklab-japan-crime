import React, { useState } from 'react';
import { DataComponent, EvidenceChart, MetricCard, Section, Dropdown, SegmentedControl,
  SortableRegion, SortableItem, useDataApp, useDashboardTabs } from '../../data-app-public.jsx';
import './dashboard.css';

const TABS = [{id:'national',label:'全国の推移'},{id:'types',label:'罪種・詐欺'},{id:'regions',label:'都道府県'},{id:'sources',label:'出典・読み方'}];
const URL = 'https://www.npa.go.jp/toukei/seianki/R07/r07.zuhyosakuin.htm';
const REPO = 'https://github.com/katzkawai/kklab-japan-crime';
const fmt = (v,d=0) => v==null?'—':v.toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct = (now,prev) => `${now>=prev?'+':'−'}${Math.abs((now/prev-1)*100).toFixed(1)}%`;
const CATS = ['窃盗犯','知能犯','粗暴犯','凶悪犯','風俗犯','その他の刑法犯'];
const COLORS = {'窃盗犯':'var(--chart-1)','知能犯':'var(--chart-2)','粗暴犯':'var(--chart-3)','凶悪犯':'var(--chart-4)','風俗犯':'var(--chart-5)','その他の刑法犯':'var(--chart-8)'};
const dateRows = rows => rows.map(r=>({...r,年表示:`${r.年}年`,'認知件数（万件）':r.認知件数/10000,'検挙件数（万件）':r.検挙件数==null?null:r.検挙件数/10000}));
const line = (y,extra={}) => ({type:'line',x:'年表示',y,showXAxisLabel:false,showYAxisLabel:true,startAtZero:true,stackable:false,valueDecimals:0,colors:{[y]:'var(--chart-1)'},...extra});
function Footnote({children}) { return <p className="crime-note">{children}</p>; }
function SourceLink({children='警察庁・元データ',href=URL}) { return <a href={href} target="_blank" rel="noreferrer">{children} ↗</a>; }
function Chart({id,queryId,title,rows,spec,height=300,children,...props}) {
 return <EvidenceChart id={id} queryId={queryId} title={title} variant="card" rows={rows} sourceRows={props.sourceRows||rows} spec={spec} height={height} {...props}>{children}</EvidenceChart>;
}
function National({queries}) {
 const all=queries.national.rows,cats=queries.categories.rows;
 const [period,setPeriod]=useState('1946'),[measure,setMeasure]=useState('認知件数');
 const selected=all.filter(r=>r.年>=Number(period));
 const latest=all.at(-1),last=all.at(-2),peak=all.find(r=>r.年===2002),low=all.find(r=>r.年===2021),past=all.find(r=>r.年===2019);
 const recent=all.filter(r=>r.年>=2016);
 const deltas=CATS.map(c=>({罪種:c,増減件数:cats.find(r=>r.年===2025&&r.罪種===c).認知件数-cats.find(r=>r.年===2024&&r.罪種===c).認知件数})).sort((a,b)=>b.増減件数-a.増減件数);
 return <>
  <div className="crime-meta"><span>全国 · 年次確定値 · 2025年まで</span><span>資料確認：2026年9月20日</span></div>
  <SortableRegion id="crime-national-kpis" variant="freeform" className="crime-kpis">
   <SortableItem id="latest-count" kind="metric" label="2025年の認知件数"><MetricCard id="latest-count" queryId="national" title="2025年の刑法犯認知件数" value={`${fmt(latest.認知件数)} 件`} comparison={`前年比 ${pct(latest.認知件数,last.認知件数)}`} deltaTone="neutral" displayRows={[latest]} sourceRows={[last,latest]}/></SortableItem>
   <SortableItem id="peak-change" kind="metric" label="2002年との比較"><MetricCard id="peak-change" queryId="national" title="2002年の最多時と比べて" value={pct(latest.認知件数,peak.認知件数)} comparison={`最多 ${fmt(peak.認知件数)} 件`} deltaTone="neutral" displayRows={[{比較:'2002年→2025年',増減率:(latest.認知件数/peak.認知件数-1)*100}]} sourceRows={[peak,latest]}/></SortableItem>
   <SortableItem id="latest-clearance" kind="metric" label="2025年の検挙率"><MetricCard id="latest-clearance" queryId="national" title="2025年の検挙率" value={`${fmt(latest.検挙率,1)}%`} comparison={`検挙件数 ${fmt(latest.検挙件数)} 件`} deltaTone="neutral" displayRows={[latest]} sourceRows={[latest]}/></SortableItem>
  </SortableRegion>
  <DataComponent id="national-reading" queryId="national" title="長期と直近の動き" kind="custom" showHeading={false} displayRows={[peak,low,past,latest]} sourceRows={[peak,low,past,latest]} className="crime-reading">
   <p><strong>長期の減少の後、2022年から増加。</strong>2025年は、戦後最少の2021年から {pct(latest.認知件数,low.認知件数)}、2019年から {pct(latest.認知件数,past.認知件数)} となっています。</p>
  </DataComponent>
  <Section id="long-term-heading" title="刑法犯の長期推移" spacing="after-metrics" filters={<>
   <Dropdown label="表示期間" showLabel value={period} choices={['1946','1989','2002','2016']} choiceLabels={{1946:'1946年から',1989:'1989年から',2002:'2002年から',2016:'2016年から'}} onChange={setPeriod}/>
   <Dropdown label="指標" showLabel value={measure} choices={['認知件数','人口千人当たり','検挙件数','検挙率']} onChange={setMeasure}/>
  </>}>
   <Chart id="national-history" queryId="national" title={`${measure} · ${period}–2025年`} rows={dateRows(selected)} sourceRows={selected} height={360} spec={line(['認知件数','検挙件数'].includes(measure)?`${measure}（万件）`:measure,{valueDecimals:2,yLabel:measure==='検挙率'?'％':measure==='人口千人当たり'?'件 / 千人':'万件'})}>
    <div className="crime-chart-caption"><span>横軸：認知・検挙した年（暦年）</span><SourceLink/></div>
   </Chart>
   <Footnote>認知件数は警察が把握した事件数です。未届けの被害を含む犯罪の実数ではありません。件数は万件単位で表示。人口千人当たりの数値は公表値（小数1桁）。1972年以前は沖縄の復帰前の件数を含みません。2025年の分母は2024年10月1日現在の人口です。</Footnote>
  </Section>
  <Section id="recent-heading" title="直近10年の動き" columns={2}>
   <Chart id="recent-counts" queryId="national" title="認知件数と検挙件数 · 2016–2025年" rows={dateRows(recent)} sourceRows={recent} spec={line('認知件数（万件）',{fields:['認知件数（万件）','検挙件数（万件）'],colors:{'認知件数（万件）':'var(--chart-1)','検挙件数（万件）':'var(--chart-2)'},valueDecimals:2,yLabel:'万件'})}/>
   <Chart id="recent-clearance" queryId="national" title="検挙率 · 2016–2025年" rows={dateRows(recent)} sourceRows={recent} spec={line('検挙率',{valueDecimals:1,yLabel:'％',colors:{検挙率:'var(--chart-2)'}})}/>
  </Section>
  <Footnote>検挙率＝その年の検挙件数÷認知件数。検挙には前年以前の事件も含まれるため、「その年に起きた事件の解決率」ではありません。</Footnote>
  <Section id="growth-heading" title="2025年の増加を罪種別に分ける">
   <Chart id="category-change" queryId="categories" title="2024年からの増減件数" rows={deltas} sourceRows={cats.filter(r=>r.年>=2024)} spec={{type:'rankedList',initialVisibleCount:6,sortOrder:'descending',x:'罪種',y:'増減件数',valueDecimals:0,startAtZero:true,yLabel:'件',colors:{増減件数:'var(--chart-1)'}}} height={280}>
    <Footnote>表示のKは千件を表します。総数の増加 {fmt(latest.認知件数-last.認知件数)} 件のうち、知能犯と窃盗犯が {fmt((deltas.find(r=>r.罪種==='知能犯').増減件数+deltas.find(r=>r.罪種==='窃盗犯').増減件数)/(latest.認知件数-last.認知件数)*100,1)}% を占めます。これは件数の内訳であり、増加原因の推定ではありません。</Footnote>
   </Chart>
  </Section>
 </>;
}
function Types({queries,metadata}) {
 const [mode,setMode]=useState('count');
 const cats=queries.categories.rows;
 const indexed=cats.map(r=>({...r,'2002年=100':r.認知件数/cats.find(v=>v.年===2002&&v.罪種===r.罪種).認知件数*100}));
 const detail=queries.offenses.rows,fraud=queries.fraud.rows;
 const names=['詐欺','強盗','殺人','暴行','傷害','放火','自転車盗','自動車盗','不同意性交等','不同意わいせつ'];
 return <>
  <Section id="composition-heading" title="包括罪種別の推移" spacing="none" filters={<SegmentedControl label="表示方法" value={mode} options={[{value:'count',label:'件数'},{value:'index',label:'2002年＝100'}]} onChange={setMode}/>}>
   <Chart id="category-history" queryId="categories" title={mode==='count'?'6つの罪種の認知件数 · 2002–2025年':'罪種ごとの変化 · 2002年＝100'} rows={dateRows(mode==='count'?cats:indexed)} sourceRows={cats} height={360} spec={{type:mode==='count'?'stackedArea':'line',x:'年表示',y:mode==='count'?'認知件数（万件）':'2002年=100',series:'罪種',colors:COLORS,startAtZero:true,stackable:mode==='count',valueDecimals:2,yLabel:mode==='count'?'万件':'指数',showXAxisLabel:false}}/>
   <Footnote>指数は各罪種の2002年の認知件数を100とした値（当年÷2002年×100）。規模の違いを取り除いて変化を比べます。6罪種の件数は各年の刑法犯総数と一致します。</Footnote>
  </Section>
  <Section id="offense-heading" title="主な罪名の推移 · 2016–2025年">
   <Footnote>各グラフの縦軸は0から始まりますが、上限は罪名ごとに異なります。目盛のKは千件を表します。殺人は未遂を含む事件数で、死亡者数ではありません。</Footnote>
   <SortableRegion id="offense-small-multiples" variant="freeform" className="crime-small-grid">
    {names.map((name,i)=>{const rows=detail.filter(r=>r.罪名===name),last=rows.at(-1);return <SortableItem id={`offense-${i}`} key={name} label={name} kind="chart">
     <Chart id={`offense-${i}`} queryId="offenses" title={name} rows={dateRows(rows)} sourceRows={rows} height={200} spec={line('認知件数',{colors:{認知件数:`var(--chart-${i>=8?4:1})`},yLabel:'件'})}>
      <div className="crime-mini-value" data-reviewed-rows><b>{fmt(last.認知件数)}<small>件</small></b><span>2025年 · 前年比 {pct(last.認知件数,rows.at(-2).認知件数)}</span></div>
      {i>=8&&<Footnote>2017年・2023年に法改正。旧罪名を含む系列。</Footnote>}
     </Chart>
    </SortableItem>})}
   </SortableRegion>
   <aside className="crime-caution">{metadata.sexCaveat}</aside>
  </Section>
  <Section id="fraud-heading" title="詐欺の被害を、件数と金額から見る" columns={2}>
   <Chart id="fraud-cases" queryId="fraud" title="認知件数の推移" rows={dateRows(fraud)} sourceRows={fraud} height={300} spec={line('認知件数',{series:'分類',colors:{特殊詐欺:'var(--chart-2)','SNS型投資・ロマンス詐欺':'var(--chart-4)'},yLabel:'件'})}/>
   <Chart id="fraud-losses" queryId="fraud" title="被害額の推移" rows={dateRows(fraud)} sourceRows={fraud} height={300} spec={line('被害額（億円）',{series:'分類',valueDecimals:1,colors:{特殊詐欺:'var(--chart-2)','SNS型投資・ロマンス詐欺':'var(--chart-4)'},yLabel:'億円'})}/>
  </Section>
  <Footnote>{metadata.fraudCaveat} SNS型の系列は2023年からで、それ以前を0件としていません。</Footnote>
 </>;
}
function Regions({queries}) {
 const all=queries.prefectures.rows;
 const [y,setY]=useState('2025'),[metric,setMetric]=useState('人口10万人当たり'),[pref,setPref]=useState('東京');
 const names=[...new Set(all.map(r=>r.都道府県))];
 const rows=all.filter(r=>r.年===Number(y)).sort((a,b)=>b[metric]-a[metric]),history=all.filter(r=>r.都道府県===pref);
 return <>
  <Section id="regional-heading" title="47都道府県の比較" spacing="none" filters={<><Dropdown label="年" showLabel value={y} choices={Array.from({length:10},(_,i)=>String(2025-i))} onChange={setY}/><Dropdown label="指標" showLabel value={metric} choices={['人口10万人当たり','認知件数']} onChange={setMetric}/></>}>
   <Footnote>表示の単位は件（Kは千件）です。件数は地域の人口規模にも左右されます。人口当たりの値も、通勤・観光などの人の流入を補正していないため、個人の被害確率や地域の安全度を直接表すものではありません。</Footnote>
   <Chart id="prefecture-comparison" queryId="prefectures" title={`${y}年 · ${metric}${metric==='人口10万人当たり'?'認知件数':''}`} rows={rows} sourceRows={rows} height={1175} spec={{type:'rankedList',initialVisibleCount:47,sortOrder:'descending',x:'都道府県',y:metric,startAtZero:true,valueDecimals:metric==='認知件数'?0:1,colors:{[metric]:'var(--chart-1)'},yLabel:'件'}}/>
  </Section>
  <Section id="pref-history-heading" title="都道府県ごとの推移" filters={<Dropdown label="都道府県" showLabel value={pref} choices={names} onChange={setPref}/>}>
   <Chart id="prefecture-history" queryId="prefectures" title={`${pref} · 人口10万人当たり認知件数 · 2016–2025年`} rows={dateRows(history)} sourceRows={history} height={300} spec={line('人口10万人当たり',{valueDecimals:1,yLabel:'件'})}/>
   <Footnote>2025年は2024年10月1日現在の人口を使用。全国の2025年の公表値は人口10万人当たり625.3件です。都道府県別値を単純平均したものではありません。</Footnote>
  </Section>
 </>;
}
function Sources({metadata}) {
 return <div className="crime-sources">
  <Section id="source-heading" title="資料と対象期間" spacing="none">
   <p>警察庁の確定統計を整形して可視化しています。2026年途中の月次値は年次グラフへ混在させていません。これは警察庁の公式サイトではありません。</p>
   <div className="crime-source-list">
    <article><span>01</span><div><h3><SourceLink>令和7年の刑法犯に関する統計資料</SourceLink></h3><p>主要な数値の出典。全国1946–2025年、包括罪種2002–2025年、主な罪名・47都道府県2016–2025年。図表1-1-1、1-2-1～7、1-5-1～2、2-3-6～7を使用。</p></div></article>
    <article><span>02</span><div><h3><SourceLink href="https://www.npa.go.jp/hakusyo/r07/honbun/html/bb2211000.html">令和7年版 警察白書・第2章第1節</SourceLink></h3><p>図表2-1のCSVと、全国の1952–2024年の認知件数・検挙件数・検挙人員・検挙率を照合。73年×4指標の292値が一致。</p></div></article>
    <article><span>03</span><div><h3><SourceLink href="https://www.npa.go.jp/publications/statistics/crime/situation/r7_hanzaijyosei_kakuteichi.pdf">令和7年の犯罪情勢（確定値・PDF）</SourceLink></h3><p>2026年8月27日更新。2025年の総数と前年比、人口の基準時点、性犯罪の法改正や詐欺の集計範囲を確認。</p></div></article>
   </div>
  </Section>
  <Section id="reading-heading" title="統計を読むときの注意">
   <div className="crime-definitions">{metadata.caveats.map((text,i)=><p key={i}>{text}</p>)}<p>{metadata.sexCaveat}</p><p>{metadata.fraudCaveat}</p></div>
   <Footnote><SourceLink href="https://www.npa.go.jp/hakusyo/r07/honbun/html/bbh000000.html">警察白書の凡例</SourceLink>も参照してください。警察統計上の刑法犯以外の特別法犯（薬物事犯等）、交通犯罪、相談・通告件数は今回のグラフの対象に含めていません。</Footnote>
  </Section>
  <Section id="download-heading" title="データをダウンロード">
   <p>表示に使った数値をUTF-8のCSVで公開しています。元ファイル、変換スクリプト、照合方法もリポジトリから確認できます。</p>
   <div className="crime-downloads">{Object.entries({national:'全国80年',categories:'包括罪種',offenses:'主な罪名',prefectures:'47都道府県',fraud:'詐欺・被害額'}).map(([key,label])=><a key={key} href={`./data/${key}.csv`} download>{label} CSV ↓</a>)}</div>
   <Footnote>前年比＝（当年÷前年−1）×100。増減件数＝当年−前年。被害額は円の原値÷1億。人口当たりの指標と検挙率は警察庁公表の丸め済みの値を使用。詐欺の被害額はCSVで桁が丸められているため、公式Excelの数値を使用しています。</Footnote>
  </Section>
 </div>;
}
export function DashboardContent() {
 const {snapshot,queries}=useDataApp();
 const {activeTabId}=useDashboardTabs(TABS);
 const tab=TABS.some(t=>t.id===activeTabId)?activeTabId:'national';
 return <div className="crime-page">
  {tab==='national'&&<National queries={queries}/>}{tab==='types'&&<Types queries={queries} metadata={snapshot.metadata}/>}{tab==='regions'&&<Regions queries={queries}/>}{tab==='sources'&&<Sources metadata={snapshot.metadata}/>}
  <footer className="crime-footer"><div><strong>このページは GPT 6 Astro で作成されました。</strong><span>統計出典：警察庁 ／ 資料確認日：2026年9月20日</span></div><div className="crime-footer-links"><a href={REPO} target="_blank" rel="noreferrer">GitHub ↗</a><SourceLink>出典資料</SourceLink></div></footer>
 </div>;
}
