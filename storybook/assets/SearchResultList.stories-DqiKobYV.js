import{bR as e,ca as o,a5 as h}from"./iframe-C22Bdc8U.js";import{s as y,M as S}from"./api-C7wijAat.js";import{c as L}from"./SearchResult-BR24idcq.js";import{S as s}from"./SearchResultList-DhgsGV_F.js";import{S as q}from"./SearchContext-Bkxg8fRr.js";import{L as f}from"./ListItemText-Dg3LUBZv.js";import{H as x}from"./DefaultResultListItem-5OvWWrdg.js";import{C as j}from"./icons-Cm7TF_4v.js";import{O as P,a as C}from"./appWrappers-BPNqFKXZ.js";import{L as w}from"./ListItem-BbTjj6PY.js";import{L as A}from"./ListItemIcon-B47Izv5T.js";import{a as _}from"./Plugin-CDv3WSMa.js";import{S as R}from"./Grid-D14rbkuM.js";import{L as W}from"./Link-CQ8YmDr-.js";import"./preload-helper-PPVm8Dsz.js";import"./useAnalytics-CJt-GhI1.js";import"./useAsync-e6PPYB-A.js";import"./useMountedState-BZZpNT_h.js";import"./lodash-CzCsWA5n.js";import"./useElementFilter-BJLeNWHj.js";import"./componentData-Czz8KrGb.js";import"./List-DDiVwIgZ.js";import"./ListContext-BDSSSLxN.js";import"./translation-Bl_IwGF3.js";import"./EmptyState-B48WCWYV.js";import"./makeStyles-pc3OoPEq.js";import"./Progress-DTTyKN2w.js";import"./LinearProgress-C6GWszq1.js";import"./Box-kBWWZnJr.js";import"./styled-B08B7Ia3.js";import"./ResponseErrorPanel-DwwOvYZj.js";import"./ErrorPanel-BZ8Bcjju.js";import"./WarningPanel-B1altGfj.js";import"./ExpandMore-BnlJ7L-p.js";import"./AccordionDetails-BahzDYVR.js";import"./index-B9sM2jn7.js";import"./Collapse-3cZ_4yLr.js";import"./MarkdownContent-BCrcBENs.js";import"./CodeSnippet-EHvwAr4y.js";import"./CopyTextButton-B_CYllG0.js";import"./useCopyToClipboard-Bb-wLH9E.js";import"./Tooltip-a85gtJpS.js";import"./useObjectRef-C6Mf-VD4.js";import"./useOverlayTriggerState-BGX475Yg.js";import"./utils-CFnOFsVw.js";import"./useFocusRing-qCAi8_Ud.js";import"./openLink-BOxlnep2.js";import"./number-Cj1g65UT.js";import"./I18nProvider-BXAQ5lpi.js";import"./useControlledState-BUs-K-Gh.js";import"./animation-BKz9GiXV.js";import"./useHover-Dz4wOsuT.js";import"./ButtonIcon-lgjij0u1.js";import"./Button-CGOfk1EO.js";import"./Label-CjT7LGus.js";import"./Hidden-BnpZ_K4p.js";import"./useLabel-DfmtFPMu.js";import"./useLabels-CsW9X9zn.js";import"./useButton-N_yqlyHo.js";import"./usePress-B_TG2quk.js";import"./textSelection-BI2TnTiF.js";import"./index-BrYyz6l8.js";import"./Divider-CwJLVhHq.js";import"./useApp-BHKH8xjY.js";import"./WebStorage-BTDQ7kFQ.js";import"./isSymbol-BtnOBEK7.js";import"./isObject--vsEa_js.js";import"./toString-ls7O60t3.js";import"./useObservable-CSO4zXTv.js";import"./useIsomorphicLayoutEffect-DIPk21RM.js";import"./BUIProvider-C6v06mks.js";import"./useResolvedHref-B-JSyBiI.js";import"./useRouteRef-DerxvSo0.js";import"./index-DK7MulBS.js";const v=C({id:"storybook.search.results.list.route"}),N=new S({results:[{type:"techdocs",document:{location:"search/search-result1",title:"Search Result 1",text:"Some text from the search result 1"}},{type:"custom",document:{location:"search/search-result2",title:"Search Result 2",text:"Some text from the search result 2"}}]}),et={title:"Plugins/Search/SearchResultList",component:s,decorators:[t=>P(e.jsx(h,{apis:[[y,N]],children:e.jsx(R,{container:!0,direction:"row",children:e.jsx(R,{item:!0,xs:12,children:e.jsx(t,{})})})}),{mountedRoutes:{"/":v}})],tags:["!manifest"]},n=()=>e.jsx(q,{children:e.jsx(s,{})}),a=()=>{const[t]=o.useState({types:["techdocs"]});return e.jsx(s,{query:t})},c=()=>{const[t]=o.useState({types:["techdocs"]});return e.jsx(h,{apis:[[y,{query:()=>new Promise(()=>{})}]],children:e.jsx(s,{query:t})})},u=()=>{const[t]=o.useState({types:["techdocs"]});return e.jsx(h,{apis:[[y,{query:()=>new Promise(()=>{throw new Error})}]],children:e.jsx(s,{query:t})})},m=()=>{const[t]=o.useState({types:["techdocs"]});return e.jsx(h,{apis:[[y,new S]],children:e.jsx(s,{query:t})})},p=()=>{const[t]=o.useState({types:["techdocs"]});return e.jsx(h,{apis:[[y,new S]],children:e.jsx(s,{query:t,noResultsComponent:e.jsx(f,{primary:"No results were found"})})})},D=t=>{const{icon:i,result:r}=t;return e.jsx(W,{to:r.location,children:e.jsxs(w,{alignItems:"flex-start",divider:!0,children:[i&&e.jsx(A,{children:i}),e.jsx(f,{primary:r.title,primaryTypographyProps:{variant:"h6"},secondary:r.text})]})})},l=()=>{const[t]=o.useState({types:["custom"]});return e.jsx(s,{query:t,renderResultItem:({type:i,document:r,highlight:g,rank:I})=>i==="custom"?e.jsx(D,{icon:e.jsx(j,{}),result:r,highlight:g,rank:I},r.location):e.jsx(x,{result:r},r.location)})},d=()=>{const[t]=o.useState({types:["techdocs"]}),r=_({id:"plugin"}).provide(L({name:"DefaultResultListItem",component:async()=>x}));return e.jsx(s,{query:t,children:e.jsx(r,{})})};n.__docgenInfo={description:"",methods:[],displayName:"Default"};a.__docgenInfo={description:"",methods:[],displayName:"WithQuery"};c.__docgenInfo={description:"",methods:[],displayName:"Loading"};u.__docgenInfo={description:"",methods:[],displayName:"WithError"};m.__docgenInfo={description:"",methods:[],displayName:"WithDefaultNoResultsComponent"};p.__docgenInfo={description:"",methods:[],displayName:"WithCustomNoResultsComponent"};l.__docgenInfo={description:"",methods:[],displayName:"WithCustomResultItem"};d.__docgenInfo={description:"",methods:[],displayName:"WithResultItemExtensions"};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`() => {
  return <SearchContextProvider>
      <SearchResultList />
    </SearchContextProvider>;
}`,...n.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`() => {
  const [query] = useState<Partial<SearchQuery>>({
    types: ['techdocs']
  });
  return <SearchResultList query={query} />;
}`,...a.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`() => {
  const [query] = useState<Partial<SearchQuery>>({
    types: ['techdocs']
  });
  return <TestApiProvider apis={[[searchApiRef, {
    query: () => new Promise<SearchResultSet>(() => {})
  }]]}>
      <SearchResultList query={query} />
    </TestApiProvider>;
}`,...c.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`() => {
  const [query] = useState<Partial<SearchQuery>>({
    types: ['techdocs']
  });
  return <TestApiProvider apis={[[searchApiRef, {
    query: () => new Promise<SearchResultSet>(() => {
      throw new Error();
    })
  }]]}>
      <SearchResultList query={query} />
    </TestApiProvider>;
}`,...u.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`() => {
  const [query] = useState<Partial<SearchQuery>>({
    types: ['techdocs']
  });
  return <TestApiProvider apis={[[searchApiRef, new MockSearchApi()]]}>
      <SearchResultList query={query} />
    </TestApiProvider>;
}`,...m.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`() => {
  const [query] = useState<Partial<SearchQuery>>({
    types: ['techdocs']
  });
  return <TestApiProvider apis={[[searchApiRef, new MockSearchApi()]]}>
      <SearchResultList query={query} noResultsComponent={<ListItemText primary="No results were found" />} />
    </TestApiProvider>;
}`,...p.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`() => {
  const [query] = useState<Partial<SearchQuery>>({
    types: ['custom']
  });
  return <SearchResultList query={query} renderResultItem={({
    type,
    document,
    highlight,
    rank
  }) => {
    switch (type) {
      case 'custom':
        return <CustomResultListItem key={document.location} icon={<CatalogIcon />} result={document} highlight={highlight} rank={rank} />;
      default:
        return <DefaultResultListItem key={document.location} result={document} />;
    }
  }} />;
}`,...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`() => {
  const [query] = useState<Partial<SearchQuery>>({
    types: ['techdocs']
  });
  const plugin = createPlugin({
    id: 'plugin'
  });
  const DefaultSearchResultListItem = plugin.provide(createSearchResultListItemExtension({
    name: 'DefaultResultListItem',
    component: async () => DefaultResultListItem
  }));
  return <SearchResultList query={query}>
      <DefaultSearchResultListItem />
    </SearchResultList>;
}`,...d.parameters?.docs?.source}}};const tt=["Default","WithQuery","Loading","WithError","WithDefaultNoResultsComponent","WithCustomNoResultsComponent","WithCustomResultItem","WithResultItemExtensions"];export{n as Default,c as Loading,p as WithCustomNoResultsComponent,l as WithCustomResultItem,m as WithDefaultNoResultsComponent,u as WithError,a as WithQuery,d as WithResultItemExtensions,tt as __namedExportsOrder,et as default};
