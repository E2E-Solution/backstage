import{bR as r,c7 as d}from"./iframe-C22Bdc8U.js";import{a as m}from"./useFormValidation-DY4qCmiy.js";import{c as a}from"./Input-DSTcGvWl.js";import{$ as s}from"./TextField-COwjVt7-.js";import{F as o}from"./FieldError-Dy_mYJVt.js";import"./preload-helper-PPVm8Dsz.js";import"./utils-CFnOFsVw.js";import"./useObjectRef-C6Mf-VD4.js";import"./useFocusRing-qCAi8_Ud.js";import"./openLink-BOxlnep2.js";import"./useHover-Dz4wOsuT.js";import"./Hidden-BnpZ_K4p.js";import"./FieldError-28gIPti5.js";import"./Text-0pdp3JSb.js";import"./Autocomplete-CA45TBTF.js";import"./keyboard-B1K6fMT3.js";import"./useEvent-CZy1BVjg.js";import"./useLabels-CsW9X9zn.js";import"./useLocalizedStringFormatter-BjEsjPGs.js";import"./I18nProvider-BXAQ5lpi.js";import"./useControlledState-BUs-K-Gh.js";import"./Label-CjT7LGus.js";import"./useTextField-chjsrgVg.js";import"./useField--nbUjXmj.js";import"./useLabel-DfmtFPMu.js";import"./useFormReset-BC6zqMdk.js";const l=d.meta({title:"Backstage UI/FieldError",component:o}),e=l.story({render:()=>r.jsx(m,{validationErrors:{demo:"This is a server validation error."},children:r.jsxs(s,{name:"demo",style:{display:"flex",flexDirection:"column",alignItems:"flex-start"},children:[r.jsx(a,{}),r.jsx(o,{})]})})}),i=l.story({render:()=>r.jsxs(s,{isInvalid:!0,validationBehavior:"aria",style:{display:"flex",flexDirection:"column",alignItems:"flex-start"},children:[r.jsx(a,{}),r.jsx(o,{children:"This is a custom error message."})]})}),t=l.story({render:()=>r.jsxs(s,{isInvalid:!0,validationBehavior:"aria",validate:()=>"This field is invalid",style:{display:"flex",flexDirection:"column",alignItems:"flex-start"},children:[r.jsx(a,{}),r.jsx(o,{children:({validationErrors:n})=>n.length>0?n[0]:"Field is invalid"})]})});e.input.parameters={...e.input.parameters,docs:{...e.input.parameters?.docs,source:{originalSource:`meta.story({
  render: () => <Form validationErrors={{
    demo: 'This is a server validation error.'
  }}>
      <TextField name="demo" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start'
    }}>
        <Input />
        <FieldError />
      </TextField>
    </Form>
})`,...e.input.parameters?.docs?.source}}};i.input.parameters={...i.input.parameters,docs:{...i.input.parameters?.docs,source:{originalSource:`meta.story({
  render: () => <TextField isInvalid validationBehavior="aria" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  }}>
      <Input />
      <FieldError>This is a custom error message.</FieldError>
    </TextField>
})`,...i.input.parameters?.docs?.source}}};t.input.parameters={...t.input.parameters,docs:{...t.input.parameters?.docs,source:{originalSource:`meta.story({
  render: () => <TextField isInvalid validationBehavior="aria" validate={() => 'This field is invalid'} style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  }}>
      <Input />
      <FieldError>
        {({
        validationErrors
      }) => validationErrors.length > 0 ? validationErrors[0] : 'Field is invalid'}
      </FieldError>
    </TextField>
})`,...t.input.parameters?.docs?.source}}};const k=["WithServerValidation","WithCustomMessage","WithRenderProp"];export{i as WithCustomMessage,t as WithRenderProp,e as WithServerValidation,k as __namedExportsOrder};
