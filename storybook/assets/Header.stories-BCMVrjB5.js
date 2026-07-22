import{bR as e}from"./iframe-C22Bdc8U.js";import{H as o}from"./Header-DnuFZGD2.js";import{P as p}from"./Page-DaLTJ2_2.js";import{H as r}from"./HeaderLabel-Cr3HPL96.js";import"./preload-helper-PPVm8Dsz.js";import"./Helmet-B5dcEhA-.js";import"./Box-kBWWZnJr.js";import"./styled-B08B7Ia3.js";import"./Grid-D14rbkuM.js";import"./makeStyles-pc3OoPEq.js";import"./Breadcrumbs-CwQLYxE7.js";import"./index-B9sM2jn7.js";import"./Popover-woZ2_k2l.js";import"./Modal-2JpaEh66.js";import"./Portal-BXqPcT-v.js";import"./List-DDiVwIgZ.js";import"./ListContext-BDSSSLxN.js";import"./ListItem-BbTjj6PY.js";import"./Link-CQ8YmDr-.js";import"./index-DK7MulBS.js";import"./lodash-CzCsWA5n.js";import"./useAnalytics-CJt-GhI1.js";import"./useApp-BHKH8xjY.js";import"./Page-BLpoPypi.js";import"./useMediaQuery-BGaK1SLH.js";import"./Tooltip-rBGUr7KQ.js";import"./Popper-C3VqVVTN.js";const N={title:"Layout/Header",component:o,argTypes:{type:{options:["home","tool","service","website","library","app","apis","documentation","other"],control:{type:"select"}}},tags:["!manifest"]},a=e.jsxs(e.Fragment,{children:[e.jsx(r,{label:"Owner",value:"players"}),e.jsx(r,{label:"Lifecycle",value:"Production"}),e.jsx(r,{label:"Tier",value:"Level 1"})]}),t=i=>{const{type:s}=i;return e.jsx(p,{themeId:s,children:e.jsx(o,{...i,children:a})})};t.args={type:"home",title:"This is a title",subtitle:"This is a subtitle"};t.__docgenInfo={description:"",methods:[],displayName:"Default",props:{type:{required:!0,tsType:{name:"string"},description:""},title:{required:!0,tsType:{name:"string"},description:""},subtitle:{required:!0,tsType:{name:"string"},description:""}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`(args: {
  type: string;
  title: string;
  subtitle: string;
}) => {
  const {
    type
  } = args;
  return <Page themeId={type}>
      <Header {...args}>{labels}</Header>
    </Page>;
}`,...t.parameters?.docs?.source}}};const S=["Default"];export{t as Default,S as __namedExportsOrder,N as default};
