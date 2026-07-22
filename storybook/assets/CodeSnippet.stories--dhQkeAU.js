import{bR as e}from"./iframe-C22Bdc8U.js";import{C as t}from"./CodeSnippet-EHvwAr4y.js";import{I as o}from"./InfoCard-DvJ85-Ue.js";import"./preload-helper-PPVm8Dsz.js";import"./index-DK7MulBS.js";import"./CardContent-6LnMf6gM.js";import"./ErrorBoundary-g2S5ZiY_.js";import"./ErrorPanel-BZ8Bcjju.js";import"./WarningPanel-B1altGfj.js";import"./ExpandMore-BnlJ7L-p.js";import"./AccordionDetails-BahzDYVR.js";import"./index-B9sM2jn7.js";import"./Collapse-3cZ_4yLr.js";import"./MarkdownContent-BCrcBENs.js";import"./makeStyles-pc3OoPEq.js";import"./Link-CQ8YmDr-.js";import"./lodash-CzCsWA5n.js";import"./useAnalytics-CJt-GhI1.js";import"./useApp-BHKH8xjY.js";import"./Grid-D14rbkuM.js";import"./List-DDiVwIgZ.js";import"./ListContext-BDSSSLxN.js";import"./ListItem-BbTjj6PY.js";import"./ListItemText-Dg3LUBZv.js";import"./CopyTextButton-B_CYllG0.js";import"./useCopyToClipboard-Bb-wLH9E.js";import"./useMountedState-BZZpNT_h.js";import"./Tooltip-a85gtJpS.js";import"./useObjectRef-C6Mf-VD4.js";import"./useOverlayTriggerState-BGX475Yg.js";import"./utils-CFnOFsVw.js";import"./useFocusRing-qCAi8_Ud.js";import"./openLink-BOxlnep2.js";import"./number-Cj1g65UT.js";import"./I18nProvider-BXAQ5lpi.js";import"./useControlledState-BUs-K-Gh.js";import"./animation-BKz9GiXV.js";import"./useHover-Dz4wOsuT.js";import"./ButtonIcon-lgjij0u1.js";import"./Button-CGOfk1EO.js";import"./Label-CjT7LGus.js";import"./Hidden-BnpZ_K4p.js";import"./useLabel-DfmtFPMu.js";import"./useLabels-CsW9X9zn.js";import"./useButton-N_yqlyHo.js";import"./usePress-B_TG2quk.js";import"./textSelection-BI2TnTiF.js";import"./index-BrYyz6l8.js";import"./LinkButton-84afZJhT.js";import"./Button-B5OyEZ8K.js";import"./CardHeader-B_D3cb0I.js";import"./Divider-CwJLVhHq.js";import"./CardActions-Z4mwJmw3.js";import"./BottomLink-Bxly18sg.js";import"./ArrowForward-DA-lxxCd.js";import"./Box-kBWWZnJr.js";import"./styled-B08B7Ia3.js";const xe={title:"Data Display/CodeSnippet",component:t,tags:["!manifest"]},l={width:300},r=`const greeting = "Hello";
const world = "World";

const greet = person => greeting + " " + person + "!";

greet(world);
`,d=`const greeting: string = "Hello";
const world: string = "World";

const greet = (person: string): string => greeting + " " + person + "!";

greet(world);
`,c=`greeting = "Hello"
world = "World"

def greet(person):
    return f"{greeting} {person}!"

greet(world)
`,i=()=>e.jsx(o,{title:"JavaScript example",children:e.jsx(t,{text:"const hello = 'World';",language:"javascript"})}),s=()=>e.jsx(o,{title:"JavaScript multi-line example",children:e.jsx(t,{text:r,language:"javascript"})}),a=()=>e.jsx(o,{title:"Show line numbers",children:e.jsx(t,{text:r,language:"javascript",showLineNumbers:!0})}),n=()=>e.jsxs(o,{title:"Overflow",children:[e.jsx("div",{style:l,children:e.jsx(t,{text:r,language:"javascript"})}),e.jsx("div",{style:l,children:e.jsx(t,{text:r,language:"javascript",showLineNumbers:!0})})]}),p=()=>e.jsxs(o,{title:"Multiple languages",children:[e.jsx(t,{text:r,language:"javascript",showLineNumbers:!0}),e.jsx(t,{text:d,language:"typescript",showLineNumbers:!0}),e.jsx(t,{text:c,language:"python",showLineNumbers:!0})]}),m=()=>e.jsx(o,{title:"Copy Code",children:e.jsx(t,{text:r,language:"javascript",showCopyCodeButton:!0})});i.__docgenInfo={description:"",methods:[],displayName:"Default"};s.__docgenInfo={description:"",methods:[],displayName:"MultipleLines"};a.__docgenInfo={description:"",methods:[],displayName:"LineNumbers"};n.__docgenInfo={description:"",methods:[],displayName:"Overflow"};p.__docgenInfo={description:"",methods:[],displayName:"Languages"};m.__docgenInfo={description:"",methods:[],displayName:"CopyCode"};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`() => <InfoCard title="JavaScript example">
    <CodeSnippet text="const hello = 'World';" language="javascript" />
  </InfoCard>`,...i.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`() => <InfoCard title="JavaScript multi-line example">
    <CodeSnippet text={JAVASCRIPT} language="javascript" />
  </InfoCard>`,...s.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`() => <InfoCard title="Show line numbers">
    <CodeSnippet text={JAVASCRIPT} language="javascript" showLineNumbers />
  </InfoCard>`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`() => <InfoCard title="Overflow">
    <div style={containerStyle}>
      <CodeSnippet text={JAVASCRIPT} language="javascript" />
    </div>
    <div style={containerStyle}>
      <CodeSnippet text={JAVASCRIPT} language="javascript" showLineNumbers />
    </div>
  </InfoCard>`,...n.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`() => <InfoCard title="Multiple languages">
    <CodeSnippet text={JAVASCRIPT} language="javascript" showLineNumbers />
    <CodeSnippet text={TYPESCRIPT} language="typescript" showLineNumbers />
    <CodeSnippet text={PYTHON} language="python" showLineNumbers />
  </InfoCard>`,...p.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`() => <InfoCard title="Copy Code">
    <CodeSnippet text={JAVASCRIPT} language="javascript" showCopyCodeButton />
  </InfoCard>`,...m.parameters?.docs?.source}}};const Se=["Default","MultipleLines","LineNumbers","Overflow","Languages","CopyCode"];export{m as CopyCode,i as Default,p as Languages,a as LineNumbers,s as MultipleLines,n as Overflow,Se as __namedExportsOrder,xe as default};
