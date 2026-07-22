import{bR as t}from"./iframe-C22Bdc8U.js";import{HeaderWorldClock as m}from"./index-BcQQqOmv.js";import{O as l}from"./appWrappers-BPNqFKXZ.js";import{H as a}from"./Header-DnuFZGD2.js";import"./preload-helper-PPVm8Dsz.js";import"./HeaderLabel-Cr3HPL96.js";import"./Grid-D14rbkuM.js";import"./Link-CQ8YmDr-.js";import"./index-DK7MulBS.js";import"./lodash-CzCsWA5n.js";import"./useAnalytics-CJt-GhI1.js";import"./makeStyles-pc3OoPEq.js";import"./useApp-BHKH8xjY.js";import"./WebStorage-BTDQ7kFQ.js";import"./useAsync-e6PPYB-A.js";import"./useMountedState-BZZpNT_h.js";import"./componentData-Czz8KrGb.js";import"./isSymbol-BtnOBEK7.js";import"./isObject--vsEa_js.js";import"./toString-ls7O60t3.js";import"./useObservable-CSO4zXTv.js";import"./useIsomorphicLayoutEffect-DIPk21RM.js";import"./BUIProvider-C6v06mks.js";import"./openLink-BOxlnep2.js";import"./useResolvedHref-B-JSyBiI.js";import"./Helmet-B5dcEhA-.js";import"./Box-kBWWZnJr.js";import"./styled-B08B7Ia3.js";import"./Breadcrumbs-CwQLYxE7.js";import"./index-B9sM2jn7.js";import"./Popover-woZ2_k2l.js";import"./Modal-2JpaEh66.js";import"./Portal-BXqPcT-v.js";import"./List-DDiVwIgZ.js";import"./ListContext-BDSSSLxN.js";import"./ListItem-BbTjj6PY.js";import"./Page-BLpoPypi.js";import"./useMediaQuery-BGaK1SLH.js";import"./Tooltip-rBGUr7KQ.js";import"./Popper-C3VqVVTN.js";const L={title:"Plugins/Home/Components/HeaderWorldClock",decorators:[o=>l(t.jsx(o,{}))],tags:["!manifest"]},e=()=>{const o=[{label:"NYC",timeZone:"America/New_York"},{label:"UTC",timeZone:"UTC"},{label:"STO",timeZone:"Europe/Stockholm"},{label:"TYO",timeZone:"Asia/Tokyo"}],i={hour:"2-digit",minute:"2-digit",hour12:!0};return t.jsx(a,{title:"Header World Clock",pageTitleOverride:"Home",children:t.jsx(m,{clockConfigs:o,customTimeFormat:i})})},r=()=>{const o=[{label:"NYC",timeZone:"America/New_York"},{label:"UTC",timeZone:"UTC"},{label:"STO",timeZone:"Europe/Stockholm"},{label:"TYO",timeZone:"Asia/Tokyo"}],i={hour:"2-digit",minute:"2-digit",hour12:!1};return t.jsx(a,{title:"24hr Header World Clock",pageTitleOverride:"Home",children:t.jsx(m,{clockConfigs:o,customTimeFormat:i})})};e.__docgenInfo={description:"",methods:[],displayName:"Default"};r.__docgenInfo={description:"",methods:[],displayName:"TwentyFourHourClocks"};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`() => {
  const clockConfigs: ClockConfig[] = [{
    label: 'NYC',
    timeZone: 'America/New_York'
  }, {
    label: 'UTC',
    timeZone: 'UTC'
  }, {
    label: 'STO',
    timeZone: 'Europe/Stockholm'
  }, {
    label: 'TYO',
    timeZone: 'Asia/Tokyo'
  }];
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  return <Header title="Header World Clock" pageTitleOverride="Home">
      <HeaderWorldClock clockConfigs={clockConfigs} customTimeFormat={timeFormat} />
    </Header>;
}`,...e.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`() => {
  const clockConfigs: ClockConfig[] = [{
    label: 'NYC',
    timeZone: 'America/New_York'
  }, {
    label: 'UTC',
    timeZone: 'UTC'
  }, {
    label: 'STO',
    timeZone: 'Europe/Stockholm'
  }, {
    label: 'TYO',
    timeZone: 'Asia/Tokyo'
  }];
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return <Header title="24hr Header World Clock" pageTitleOverride="Home">
      <HeaderWorldClock clockConfigs={clockConfigs} customTimeFormat={timeFormat} />
    </Header>;
}`,...r.parameters?.docs?.source}}};const M=["Default","TwentyFourHourClocks"];export{e as Default,r as TwentyFourHourClocks,M as __namedExportsOrder,L as default};
