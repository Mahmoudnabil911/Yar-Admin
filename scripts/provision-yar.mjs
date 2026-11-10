// Run outside the browser. Environment input stays private and is never bundled.
import {readFileSync,writeFileSync} from 'node:fs';
import {provisionInitialAccounts,installationScript} from './yar-initial-accounts.mjs';
const env=process.env;
const output=process.argv[2];
if(!output)throw new Error('Provide a private output path outside the project.');
const existing=env.YAR_EXISTING_ACCOUNTS_FILE?JSON.parse(readFileSync(env.YAR_EXISTING_ACCOUNTS_FILE,'utf8')):null;
const input={adminName:env.YAR_INITIAL_NAME,adminPhone:env.YAR_INITIAL_PHONE,adminPassword:env.YAR_INITIAL_PASSWORD,employeeName:env.YAR_EMPLOYEE_NAME,employeePhone:env.YAR_EMPLOYEE_PHONE,employeePassword:env.YAR_EMPLOYEE_PASSWORD,adminId:env.YAR_ADMIN_EXISTING_ID,employeeId:env.YAR_EMPLOYEE_EXISTING_ID,allowSupportPhone:env.YAR_ALLOW_SUPPORT_PHONE==='owner-approved',confirmExistingUpdate:env.YAR_CONFIRM_EXISTING_UPDATE==='owner-approved'};
try{
 const data=await provisionInitialAccounts(input,existing);
 // Exclusive creation prevents accidental replacement of private files.
 writeFileSync(output,JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
 if(!existing)writeFileSync(output+'.install.js',installationScript(data),{mode:0o600,flag:'wx'});
 console.log('Two active initial accounts prepared. Passwords were not printed. First sign-in requires changing each password.');
 console.log(existing?'Existing account IDs, requests, notifications and audit were preserved. Review the merge privately before installation.':'Private installation instructions are in the accounts README. No accounts were installed in a browser automatically.');
}catch(error){console.error(error.message);process.exitCode=1;}
