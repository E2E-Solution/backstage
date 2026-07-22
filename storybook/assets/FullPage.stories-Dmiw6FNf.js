import{bg as b,ca as x,cH as P,bR as e,c7 as f,w as y}from"./iframe-C22Bdc8U.js";import{P as l}from"./PluginHeader-Cl2jmorX.js";import{C as p}from"./Container-BvRpKvYR.js";import{T as t}from"./Text-ASLfG_73.js";import{B as j}from"./BUIProvider-C6v06mks.js";import"./preload-helper-PPVm8Dsz.js";import"./index-BrYyz6l8.js";import"./utils-CFnOFsVw.js";import"./useObjectRef-C6Mf-VD4.js";import"./useCollection-y9vilJSd.js";import"./useFocusRing-qCAi8_Ud.js";import"./openLink-BOxlnep2.js";import"./Hidden-BnpZ_K4p.js";import"./keyboard-B1K6fMT3.js";import"./FocusScope-C2SKSqua.js";import"./useEvent-CZy1BVjg.js";import"./I18nProvider-BXAQ5lpi.js";import"./usePress-B_TG2quk.js";import"./textSelection-BI2TnTiF.js";import"./useControlledState-BUs-K-Gh.js";import"./Link-DQ2AtxtV.js";import"./useLink-BWXLTJBY.js";import"./useHover-Dz4wOsuT.js";import"./useLocalizedStringFormatter-BjEsjPGs.js";import"./Button-CGOfk1EO.js";import"./Label-CjT7LGus.js";import"./useLabel-DfmtFPMu.js";import"./useLabels-CsW9X9zn.js";import"./number-Cj1g65UT.js";import"./useButton-N_yqlyHo.js";import"./Menu-y9LcOZLl.js";import"./Autocomplete-CA45TBTF.js";import"./getItemCount-C1YHf-DN.js";import"./Input-DSTcGvWl.js";import"./ListBox-DubSngkc.js";import"./Text-0pdp3JSb.js";import"./useListState-CPY3axc8.js";import"./Dialog-DqlhS9BY.js";import"./Heading-iR_eRUS4.js";import"./useOverlayTriggerState-BGX475Yg.js";import"./VisuallyHidden-Dxl4EIdX.js";import"./animation-BKz9GiXV.js";import"./SearchField-C0hw9QDw.js";import"./FieldError-28gIPti5.js";import"./useFormValidation-DY4qCmiy.js";import"./useTextField-chjsrgVg.js";import"./useField--nbUjXmj.js";import"./useFormReset-BC6zqMdk.js";import"./Virtualizer-BGTYrCvp.js";import"./useFilter-R3PvMZYn.js";import"./getNodeText-DGff8DAu.js";import"./Link-DAaYOWn0.js";import"./useResolvedHref-B-JSyBiI.js";import"./Tooltip-a85gtJpS.js";import"./VisuallyHidden-rCypwvyH.js";import"./Tabs-ByB1rJjg.js";import"./useHasTabbableChild-Drtm-kAQ.js";const w={"bui-FullPage":"_bui-FullPage_1vdnu_20"},T=b()({styles:w,classNames:{root:"bui-FullPage"},propDefs:{className:{}}}),r=x.forwardRef((i,n)=>{const{ownProps:d,restProps:h}=P(T,i),{classes:g}=d;return e.jsx("main",{ref:n,className:g.root,...h})});r.__docgenInfo={description:`A component that fills the remaining viewport height below the Header.

The FullPage component consumes the \`--bui-header-height\` CSS custom property
set by the Header component to calculate its height as
\`calc(100dvh - var(--bui-header-height, 0px))\`. Content inside the FullPage
scrolls independently while the Header stays visible.

@public`,methods:[],displayName:"FullPage",props:{className:{required:!1,tsType:{name:"string"},description:""}},composes:["Omit"]};const m=f.meta({title:"Backstage UI/FullPage",component:r,parameters:{layout:"fullscreen"}}),c=i=>e.jsx(y,{children:e.jsx(j,{children:e.jsx(i,{})})}),F=[{id:"overview",label:"Overview",href:"/overview"},{id:"checks",label:"Checks",href:"/checks"},{id:"tracks",label:"Tracks",href:"/tracks"},{id:"campaigns",label:"Campaigns",href:"/campaigns"}],u=Array.from({length:20},(i,n)=>e.jsx(t,{as:"p",children:"Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."},n)),o=m.story({decorators:[c],render:()=>e.jsxs(e.Fragment,{children:[e.jsx(l,{title:"My Plugin"}),e.jsx(r,{style:{backgroundColor:"#c3f0ff"},children:e.jsx(p,{children:e.jsx(t,{as:"p",children:"This content fills the remaining viewport height below the Header."})})})]})}),a=m.story({decorators:[c],render:()=>e.jsxs(e.Fragment,{children:[e.jsx(l,{title:"My Plugin"}),e.jsx(r,{children:e.jsxs(p,{children:[e.jsx(t,{as:"h2",variant:"title-medium",children:"Scrollable Content"}),e.jsx(t,{as:"p",children:"The content below scrolls independently while the Header stays pinned at the top."}),u]})})]})}),s=m.story({decorators:[c],render:()=>e.jsxs(e.Fragment,{children:[e.jsx(l,{title:"My Plugin",tabs:F}),e.jsx(r,{children:e.jsxs(p,{children:[e.jsx(t,{as:"p",children:"The FullPage height adjusts automatically when the Header includes tabs, thanks to the ResizeObserver measuring the Header's actual height."}),u]})})]})});o.input.parameters={...o.input.parameters,docs:{...o.input.parameters?.docs,source:{originalSource:`meta.story({
  decorators: [withRouter],
  render: () => <>
      <PluginHeader title="My Plugin" />
      <FullPage style={{
      backgroundColor: '#c3f0ff'
    }}>
        <Container>
          <Text as="p">
            This content fills the remaining viewport height below the Header.
          </Text>
        </Container>
      </FullPage>
    </>
})`,...o.input.parameters?.docs?.source}}};a.input.parameters={...a.input.parameters,docs:{...a.input.parameters?.docs,source:{originalSource:`meta.story({
  decorators: [withRouter],
  render: () => <>
      <PluginHeader title="My Plugin" />
      <FullPage>
        <Container>
          <Text as="h2" variant="title-medium">
            Scrollable Content
          </Text>
          <Text as="p">
            The content below scrolls independently while the Header stays
            pinned at the top.
          </Text>
          {paragraphs}
        </Container>
      </FullPage>
    </>
})`,...a.input.parameters?.docs?.source}}};s.input.parameters={...s.input.parameters,docs:{...s.input.parameters?.docs,source:{originalSource:`meta.story({
  decorators: [withRouter],
  render: () => <>
      <PluginHeader title="My Plugin" tabs={tabs} />
      <FullPage>
        <Container>
          <Text as="p">
            The FullPage height adjusts automatically when the Header includes
            tabs, thanks to the ResizeObserver measuring the Header's actual
            height.
          </Text>
          {paragraphs}
        </Container>
      </FullPage>
    </>
})`,...s.input.parameters?.docs?.source}}};const ke=["Default","WithScrollableContent","WithTabs"];export{o as Default,a as WithScrollableContent,s as WithTabs,ke as __namedExportsOrder};
