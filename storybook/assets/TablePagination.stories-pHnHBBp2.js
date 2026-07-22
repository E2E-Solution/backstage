import{T as P}from"./TablePagination-B9CkdZVR.js";import"./iframe-C22Bdc8U.js";import"./preload-helper-PPVm8Dsz.js";import"./useObjectRef-C6Mf-VD4.js";import"./index-BrYyz6l8.js";import"./Select-C_5Tyzlc.js";import"./Button-CGOfk1EO.js";import"./utils-CFnOFsVw.js";import"./Label-CjT7LGus.js";import"./Hidden-BnpZ_K4p.js";import"./useFocusRing-qCAi8_Ud.js";import"./openLink-BOxlnep2.js";import"./useLabel-DfmtFPMu.js";import"./useLabels-CsW9X9zn.js";import"./number-Cj1g65UT.js";import"./I18nProvider-BXAQ5lpi.js";import"./useButton-N_yqlyHo.js";import"./usePress-B_TG2quk.js";import"./textSelection-BI2TnTiF.js";import"./useHover-Dz4wOsuT.js";import"./FieldError-28gIPti5.js";import"./Text-0pdp3JSb.js";import"./useFormValidation-DY4qCmiy.js";import"./ListBox-DubSngkc.js";import"./useCollection-y9vilJSd.js";import"./keyboard-B1K6fMT3.js";import"./FocusScope-C2SKSqua.js";import"./useEvent-CZy1BVjg.js";import"./useControlledState-BUs-K-Gh.js";import"./getItemCount-C1YHf-DN.js";import"./Autocomplete-CA45TBTF.js";import"./useLocalizedStringFormatter-BjEsjPGs.js";import"./useListState-CPY3axc8.js";import"./Dialog-DqlhS9BY.js";import"./Heading-iR_eRUS4.js";import"./useOverlayTriggerState-BGX475Yg.js";import"./VisuallyHidden-Dxl4EIdX.js";import"./animation-BKz9GiXV.js";import"./useField--nbUjXmj.js";import"./useFormReset-BC6zqMdk.js";import"./Input-DSTcGvWl.js";import"./SearchField-C0hw9QDw.js";import"./useTextField-chjsrgVg.js";import"./useFilter-R3PvMZYn.js";import"./useCollectionAdapter-DCqEfdC4.js";import"./Avatar-BXe_rWyh.js";import"./Skeleton-xawoFBN1.js";import"./FieldLabel-BBAi7W5-.js";import"./FieldError-Dy_mYJVt.js";import"./Popover-DnAbPgsa.js";import"./Text-ASLfG_73.js";import"./ButtonIcon-lgjij0u1.js";const p=()=>{},le={title:"Backstage UI/TablePagination",component:P,argTypes:{offset:{control:"number"},pageSize:{control:"radio",options:[5,10,20,30,40,50]},totalCount:{control:"number"},hasNextPage:{control:"boolean"},hasPreviousPage:{control:"boolean"},showPageSizeOptions:{control:"boolean"}}},e={args:{offset:0,pageSize:10,totalCount:100,hasNextPage:!0,hasPreviousPage:!1,onNextPage:p,onPreviousPage:p,onPageSizeChange:p,showPageSizeOptions:!0}},o={args:{...e.args}},a={args:{...e.args,offset:90,hasNextPage:!1,hasPreviousPage:!0}},r={args:{...e.args,offset:40,hasPreviousPage:!0}},t={args:{...e.args,showPageSizeOptions:!1}},s={args:{...e.args,offset:void 0}},n={args:{...e.args,offset:20,hasPreviousPage:!0,getLabel:({offset:m,pageSize:g,totalCount:c})=>{const u=Math.floor((m??0)/g)+1,l=Math.ceil((c??0)/g);return`Page ${u} of ${l}`}}},i={args:{...e.args,totalCount:0,hasNextPage:!1}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    offset: 0,
    pageSize: 10,
    totalCount: 100,
    hasNextPage: true,
    hasPreviousPage: false,
    onNextPage: noop,
    onPreviousPage: noop,
    onPageSizeChange: noop,
    showPageSizeOptions: true
  }
}`,...e.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args
  }
}`,...o.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    offset: 90,
    hasNextPage: false,
    hasPreviousPage: true
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    offset: 40,
    hasPreviousPage: true
  }
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    showPageSizeOptions: false
  }
}`,...t.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    offset: undefined
  }
}`,...s.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    offset: 20,
    hasPreviousPage: true,
    getLabel: ({
      offset,
      pageSize,
      totalCount
    }) => {
      const page = Math.floor((offset ?? 0) / pageSize) + 1;
      const totalPages = Math.ceil((totalCount ?? 0) / pageSize);
      return \`Page \${page} of \${totalPages}\`;
    }
  }
}`,...n.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    totalCount: 0,
    hasNextPage: false
  }
}`,...i.parameters?.docs?.source}}};const Pe=["Default","FirstPage","LastPage","MiddlePage","WithoutPageSizeOptions","CursorPagination","CustomLabel","EmptyState"];export{s as CursorPagination,n as CustomLabel,e as Default,i as EmptyState,o as FirstPage,a as LastPage,r as MiddlePage,t as WithoutPageSizeOptions,Pe as __namedExportsOrder,le as default};
